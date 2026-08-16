/** The raw per-project persistence boundary. The extension never parses this value. */
import { ObservationCapacityError } from './record.js';

export const OBSERVATION_RECORD_CAPACITY_CHARS = 262144;

export interface StoredObservationRecord {
  readonly value: string;
  readonly capacityChars: number;
}

export interface ObservationStore {
  read(): Promise<StoredObservationRecord>;
  /** Replace the complete value and return the exact confirmed readback. */
  replace(value: string): Promise<StoredObservationRecord>;
}

/** In-memory project store for offline capture and failure tests. */
export class FakeObservationStore implements ObservationStore {
  private readonly records = new Map<string, string>();

  constructor(
    readonly capacityChars = OBSERVATION_RECORD_CAPACITY_CHARS,
    private project = 'fake-project',
  ) {}

  switchProject(project: string): void {
    this.project = project;
  }

  async read(): Promise<StoredObservationRecord> {
    return { value: this.records.get(this.project) ?? '', capacityChars: this.capacityChars };
  }

  async replace(value: string): Promise<StoredObservationRecord> {
    if (value.length > this.capacityChars) {
      throw new ObservationCapacityError(value.length, this.capacityChars);
    }
    this.records.set(this.project, value);
    return this.read();
  }
}
