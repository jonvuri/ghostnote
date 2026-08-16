/** Production capture for instruction context and confirmed tool results. */
import { randomUUID } from 'node:crypto';

import { TOOL_DESCRIPTION_VERSION } from '../surface/description-cohort.js';
import {
  appendObservationEntry,
  decodeObservationRecord,
  emptyObservationRecord,
  encodeObservationRecord,
  enrichInstructionObservation,
  instructionObservation,
  type InstructionObservation,
  type JsonValue,
  type ObservationEntry,
  type ObservationRecordV1,
  type OperatorResponse,
  type RequestedScope,
} from './record.js';
import type { ObservationStore } from './store.js';

export interface ObservationCaptureOptions {
  readonly newId?: () => string;
  readonly now?: () => number;
}

export interface ObservationExecution {
  readonly executionId: string;
  readonly resultId: string;
  readonly correlationId: string;
  readonly instructionId?: string;
}

export interface BeginInstructionInput {
  readonly requestedScope: RequestedScope;
  readonly rawScope: JsonValue;
  readonly rationale?: string;
  readonly resultIds?: readonly string[];
}

export interface EnrichInstructionInput {
  readonly instructionId: string;
  readonly rationale?: string;
  readonly operatorResponse?: Exclude<OperatorResponse, 'silent'>;
  readonly resultIds?: readonly string[];
  readonly complete?: boolean;
}

export type ConfirmedToolResult =
  | {
    readonly kind: 'device-alternate';
    readonly trackId: string;
    readonly containerPosition: number;
    readonly alternateNames: readonly string[];
  }
  | {
    readonly kind: 'clip-block';
    readonly trackId: string;
    readonly sourceRow: number;
    readonly copiedRow: number;
  }
  | {
    readonly kind: 'copy-track';
    readonly sourceTrackId: string;
    readonly copiedTrackId: string;
  };

/**
 * Serialize complete-record replacements and hold one explicit instruction for
 * subsequent tool results in this MCP session.
 */
export class ObservationCapture {
  private readonly newId: () => string;
  private readonly now: () => number;
  private active: { readonly instructionId: string; readonly correlationId: string } | undefined;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ObservationStore,
    options: ObservationCaptureOptions = {},
  ) {
    this.newId = options.newId ?? (() => randomUUID());
    this.now = options.now ?? (() => Date.now());
  }

  /** Allocate identity before a relevant tool runs. No row exists until confirmation. */
  execution(): ObservationExecution {
    return {
      executionId: this.newId(),
      resultId: this.newId(),
      correlationId: this.active?.correlationId ?? this.newId(),
      ...(this.active === undefined ? {} : { instructionId: this.active.instructionId }),
    };
  }

  /** Create caller context and make it active for later confirmed results. */
  async begin(input: BeginInstructionInput): Promise<InstructionObservation> {
    return this.exclusive(async () => {
      if (this.active !== undefined) {
        throw new Error(
          `instruction observation ${this.active.instructionId} is still active. `
          + 'Complete it before another observation begins.',
        );
      }
      const stored = await this.read();
      const resultIds = input.resultIds ?? [];
      const correlationId = correlationFor(stored.record, resultIds) ?? this.newId();
      const entry = instructionObservation({
        id: this.newId(),
        correlationId,
        recordedAtMs: this.now(),
        descriptionVersion: TOOL_DESCRIPTION_VERSION,
        requestedScope: input.requestedScope,
        rawScope: input.rawScope,
        ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
      });
      let next = appendObservationEntry(stored.record, entry);
      if (resultIds.length > 0) {
        next = enrichInstructionObservation(next, { instructionId: entry.id, resultIds });
      }
      await this.replace(next, stored.capacityChars);
      this.active = { instructionId: entry.id, correlationId };
      return instructionFrom(next, entry.id);
    });
  }

  /** Add only caller-supplied context. Completion clears this session's active instruction. */
  async enrich(input: EnrichInstructionInput): Promise<InstructionObservation> {
    return this.exclusive(async () => {
      const stored = await this.read();
      const current = instructionFrom(stored.record, input.instructionId);
      const supplied = input.resultIds ?? [];
      const resultIds = supplied.filter((id) => !current.resultIds.includes(id));
      const next = enrichInstructionObservation(stored.record, {
        instructionId: input.instructionId,
        ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
        ...(input.operatorResponse === undefined
          ? {}
          : { operatorResponse: input.operatorResponse }),
        ...(resultIds.length === 0 ? {} : { resultIds }),
      });
      await this.replace(next, stored.capacityChars);
      if ((input.complete ?? true) && this.active?.instructionId === input.instructionId) {
        this.active = undefined;
      }
      return instructionFrom(next, input.instructionId);
    });
  }

  /** Append one confirmed result and link it to the active instruction in one replacement. */
  async recordResult(result: ConfirmedToolResult, execution: ObservationExecution): Promise<string> {
    return this.exclusive(async () => {
      const stored = await this.read();
      const common = {
        id: execution.resultId,
        correlationId: execution.correlationId,
        executionId: execution.executionId,
        recordedAtMs: this.now(),
        descriptionVersion: TOOL_DESCRIPTION_VERSION,
      } as const;
      const entry: ObservationEntry = result.kind === 'device-alternate'
        ? {
          type: 'managed-event', ...common,
          structure: 'device-alternate', tool: 'create_device_alternates',
          result: {
            trackId: result.trackId,
            containerPosition: result.containerPosition,
            alternateNames: result.alternateNames,
          },
        }
        : result.kind === 'clip-block'
          ? {
            type: 'managed-event', ...common,
            structure: 'clip-block', tool: 'copy_clip_down',
            result: {
              trackId: result.trackId,
              sourceRow: result.sourceRow,
              copiedRow: result.copiedRow,
            },
          }
          : {
            type: 'ordinary-use', ...common,
            outcome: 'copy-track', tool: 'copy_track',
            result: {
              sourceTrackId: result.sourceTrackId,
              copiedTrackId: result.copiedTrackId,
            },
          };
      let next = appendObservationEntry(stored.record, entry);
      if (execution.instructionId !== undefined) {
        next = enrichInstructionObservation(next, {
          instructionId: execution.instructionId,
          resultIds: [entry.id],
        });
      }
      await this.replace(next, stored.capacityChars);
      return entry.id;
    });
  }

  private async read(): Promise<{
    readonly record: ObservationRecordV1;
    readonly capacityChars: number;
  }> {
    const stored = await this.store.read();
    return {
      record: stored.value.length === 0
        ? emptyObservationRecord()
        : decodeObservationRecord(stored.value),
      capacityChars: stored.capacityChars,
    };
  }

  private async replace(record: ObservationRecordV1, capacityChars: number): Promise<void> {
    await this.store.replace(encodeObservationRecord(record, { capacityChars }));
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.tail.then(run, run);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function correlationFor(record: ObservationRecordV1, resultIds: readonly string[]): string | undefined {
  let correlationId: string | undefined;
  for (const id of resultIds) {
    const result = record.entries.find((entry) => entry.id === id);
    if (result === undefined || result.type === 'instruction-observation') {
      throw new Error(`result id ${id} does not name a recorded tool result.`);
    }
    if (correlationId !== undefined && result.correlationId !== correlationId) {
      throw new Error('the supplied result ids do not share one correlation id.');
    }
    correlationId = result.correlationId;
  }
  return correlationId;
}

function instructionFrom(record: ObservationRecordV1, id: string): InstructionObservation {
  const entry = record.entries.find((candidate) => candidate.id === id);
  if (entry?.type !== 'instruction-observation') {
    throw new Error(`instruction observation ${id} does not exist.`);
  }
  return entry;
}
