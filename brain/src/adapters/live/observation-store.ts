/** Live access to the hidden per-project observation setting. */
import {
  OBSERVATION_RECORD_CAPACITY_CHARS,
  ObservationCapacityError,
  ObservationProjectNameChangedError,
  ObservationStaleReadbackError,
  ObservationStorageAbsentError,
  ObservationStorageDowncastError,
  ObservationStoreUnavailableError,
  type ObservationStore,
  type StoredObservationRecord,
} from '../../observation/index.js';
import type { Transport } from './transport.js';
import { WIRE } from './wiremap.js';

interface WireStoreReply {
  readonly available?: boolean;
  readonly accepted?: boolean;
  readonly failure?: string;
  readonly error?: string;
  readonly capacityChars?: number;
  readonly projectName?: string;
  readonly value?: string;
}

export interface LiveObservationStoreOptions {
  readonly transport: Transport;
  /** Returns the foreground project name after normal session readiness checks. */
  readonly projectName: () => Promise<string>;
  readonly maxReadAttempts?: number;
  readonly pollIntervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export class LiveObservationStore implements ObservationStore {
  private readonly maxReadAttempts: number;
  private readonly pollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: LiveObservationStoreOptions) {
    this.maxReadAttempts = options.maxReadAttempts ?? 40;
    this.pollIntervalMs = options.pollIntervalMs ?? 25;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (!Number.isInteger(this.maxReadAttempts) || this.maxReadAttempts < 1) {
      throw new RangeError('maxReadAttempts must be a positive integer');
    }
    if (!Number.isFinite(this.pollIntervalMs) || this.pollIntervalMs < 0) {
      throw new RangeError('pollIntervalMs must be nonnegative');
    }
  }

  async read(): Promise<StoredObservationRecord> {
    const projectName = await this.currentProjectName();
    const reply = await this.readWire();
    await this.assertSameProjectName(projectName, reply.projectName);
    return this.stored(reply);
  }

  async replace(value: string): Promise<StoredObservationRecord> {
    if (value.length > OBSERVATION_RECORD_CAPACITY_CHARS) {
      throw new ObservationCapacityError(value.length, OBSERVATION_RECORD_CAPACITY_CHARS);
    }

    const projectName = await this.currentProjectName();
    const accepted = this.parseReply(await this.options.transport.send({
      method: WIRE.observationReplace,
      params: { value },
    }));
    this.assertAvailable(accepted);
    await this.assertSameProjectName(projectName, accepted.projectName);
    if (accepted.failure === 'size-overflow' || accepted.accepted === false) {
      throw new ObservationCapacityError(value.length, this.capacity(accepted));
    }
    if (accepted.accepted !== true) {
      throw new ObservationStoreUnavailableError(
        'the extension did not acknowledge the observation replacement',
      );
    }

    let observed = '';
    for (let attempt = 1; attempt <= this.maxReadAttempts; attempt += 1) {
      const now = await this.currentProjectName();
      if (now !== projectName) {
        throw new ObservationProjectNameChangedError(projectName, now);
      }
      const reply = await this.readWire();
      await this.assertSameProjectName(projectName, reply.projectName);
      const stored = this.stored(reply);
      observed = stored.value;
      if (observed === value) return stored;
      if (attempt < this.maxReadAttempts) await this.sleep(this.pollIntervalMs);
    }
    throw new ObservationStaleReadbackError(value, observed, this.maxReadAttempts);
  }

  private async readWire(): Promise<WireStoreReply> {
    const reply = this.parseReply(await this.options.transport.send({
      method: WIRE.observationRead,
    }));
    this.assertAvailable(reply);
    return reply;
  }

  private parseReply(value: unknown): WireStoreReply {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new ObservationStoreUnavailableError('the observation store returned a malformed reply');
    }
    return value as WireStoreReply;
  }

  private assertAvailable(reply: WireStoreReply): void {
    if (reply.available === true) return;
    const detail = reply.error ?? 'the extension did not provide the hidden observation setting';
    if (reply.failure === 'downcast-refused') {
      throw new ObservationStorageDowncastError(detail);
    }
    if (reply.failure === 'storage-absent' || reply.available === false) {
      throw new ObservationStorageAbsentError(detail);
    }
    throw new ObservationStoreUnavailableError(detail);
  }

  private stored(reply: WireStoreReply): StoredObservationRecord {
    if (typeof reply.value !== 'string') {
      throw new ObservationStoreUnavailableError('the observation store readback was not a string');
    }
    return { value: reply.value, capacityChars: this.capacity(reply) };
  }

  private capacity(reply: WireStoreReply): number {
    if (!Number.isInteger(reply.capacityChars) || (reply.capacityChars ?? 0) < 1) {
      throw new ObservationStoreUnavailableError('the observation store did not report its capacity');
    }
    return reply.capacityChars!;
  }

  private async currentProjectName(): Promise<string> {
    const projectName = await this.options.projectName();
    if (projectName.length === 0) {
      throw new ObservationStoreUnavailableError(
        'the foreground project name is unavailable, so this operation cannot check for a '
        + 'name-visible project switch',
      );
    }
    return projectName;
  }

  /**
   * Detect a foreground-project name change around one wire call.
   *
   * Bitwig API 25 exposes no stable project identifier. Two project tabs can
   * have the same name, so this is a lossy safety check. DocumentState still
   * scopes the setting itself per project.
   */
  private async assertSameProjectName(
    expected: string,
    wireProjectName: string | undefined,
  ): Promise<void> {
    const current = await this.currentProjectName();
    const observed = wireProjectName ?? '';
    if (current !== expected) throw new ObservationProjectNameChangedError(expected, current);
    if (observed !== expected) throw new ObservationProjectNameChangedError(expected, observed);
  }
}
