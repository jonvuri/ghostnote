/**
 * Background tool completion for work that can exceed one client request.
 *
 * A start call returns an operation id immediately. The caller can then inspect
 * the operation or request cancellation. Cancellation is cooperative: the
 * running tool stops at the next workspace boundary. A project write that has
 * already started completes its verification and recording before the operation
 * becomes terminal. Thus a terminal state means no later project mutation can
 * come from that operation.
 */
import { randomUUID } from 'node:crypto';

import type { StashedChangeset } from '../stash/index.js';

export type OperationState =
  | 'accepted'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface OperationChange {
  readonly changeId: string;
  readonly seq: number;
  readonly applied: boolean;
}

export interface OperationStatus {
  readonly operationId: string;
  readonly operation: string;
  readonly state: OperationState;
  readonly terminal: boolean;
  readonly cancellationRequested: boolean;
  readonly startedAtMs: number;
  readonly finishedAtMs?: number;
  readonly changes: readonly OperationChange[];
  readonly result?: unknown;
  readonly error?: string;
}

export interface OperationContext {
  readonly signal: AbortSignal;
  record(change: StashedChangeset): void;
}

interface OperationEntry {
  readonly id: string;
  readonly operation: string;
  readonly startedAtMs: number;
  readonly controller: AbortController;
  readonly changes: OperationChange[];
  state: OperationState;
  finishedAtMs?: number;
  result?: unknown;
  error?: string;
  done: Promise<void>;
}

export interface OperationRegistryOptions {
  readonly newId?: () => string;
  readonly now?: () => number;
}

const terminal = (state: OperationState): boolean =>
  state === 'completed' || state === 'cancelled' || state === 'failed';

/** Session-owned registry. It has no module-level mutable state. */
export class OperationRegistry {
  private readonly entries = new Map<string, OperationEntry>();
  private readonly newId: () => string;
  private readonly now: () => number;

  constructor(options: OperationRegistryOptions = {}) {
    this.newId = options.newId ?? (() => randomUUID());
    this.now = options.now ?? (() => Date.now());
  }

  start(operation: string, run: (context: OperationContext) => Promise<unknown>): OperationStatus {
    const id = this.newId();
    const controller = new AbortController();
    const entry: OperationEntry = {
      id,
      operation,
      startedAtMs: this.now(),
      controller,
      changes: [],
      state: 'accepted',
      done: Promise.resolve(),
    };
    if (this.entries.has(id)) throw new Error(`duplicate operation id: ${id}`);
    this.entries.set(id, entry);

    entry.done = Promise.resolve().then(async () => {
      if (controller.signal.aborted) {
        entry.state = 'cancelled';
        entry.finishedAtMs = this.now();
        return;
      }
      entry.state = 'running';
      try {
        const result = await run({
          signal: controller.signal,
          record: (change) => {
            entry.changes.push({
              changeId: change.take.id,
              seq: change.seq,
              applied: change.take.report.applied,
            });
          },
        });
        if (controller.signal.aborted) {
          entry.state = 'cancelled';
        } else {
          entry.state = 'completed';
          entry.result = result;
        }
      } catch (error) {
        if (controller.signal.aborted) {
          entry.state = 'cancelled';
        } else {
          entry.state = 'failed';
          entry.error = error instanceof Error ? error.message : String(error);
        }
      } finally {
        entry.finishedAtMs = this.now();
      }
    });

    return this.status(id);
  }

  status(id: string): OperationStatus {
    const entry = this.require(id);
    return {
      operationId: entry.id,
      operation: entry.operation,
      state: entry.state,
      terminal: terminal(entry.state),
      cancellationRequested: entry.controller.signal.aborted,
      startedAtMs: entry.startedAtMs,
      ...(entry.finishedAtMs === undefined ? {} : { finishedAtMs: entry.finishedAtMs }),
      changes: structuredClone(entry.changes),
      ...(entry.result === undefined ? {} : { result: structuredClone(entry.result) }),
      ...(entry.error === undefined ? {} : { error: entry.error }),
    };
  }

  cancel(id: string): OperationStatus {
    const entry = this.require(id);
    if (!terminal(entry.state) && !entry.controller.signal.aborted) {
      entry.controller.abort('cancelled by caller');
      entry.state = 'cancelling';
    }
    return this.status(id);
  }

  /** Test and internal coordination seam. Public callers poll `status`. */
  async wait(id: string): Promise<OperationStatus> {
    const entry = this.require(id);
    await entry.done;
    return this.status(id);
  }

  private require(id: string): OperationEntry {
    const entry = this.entries.get(id);
    if (entry === undefined) throw new Error(`no such operation: ${id}`);
    return entry;
  }
}
