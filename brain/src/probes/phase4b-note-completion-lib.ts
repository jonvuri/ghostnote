export interface NoteObserverTarget {
  readonly generation: number;
  readonly trackId: string;
  readonly trackIndex: number;
  readonly slotIndex: number;
}

export interface NoteObserverCell {
  readonly channel: number;
  readonly x: number;
  readonly y: number;
  readonly state: string;
  readonly [property: string]: unknown;
}

export interface NoteObserverEvent extends NoteObserverTarget {
  readonly sequence: number;
  readonly armed: boolean;
  readonly callbackEpochMs: number;
  readonly sinceArmMicros?: number;
  readonly note: NoteObserverCell;
}

/** Accept only events from the current confirmed target generation. */
export function eventIsEligible(
  event: NoteObserverEvent,
  target: NoteObserverTarget,
): boolean {
  return event.armed
    && event.generation === target.generation
    && event.trackId === target.trackId
    && event.trackIndex === target.trackIndex
    && event.slotIndex === target.slotIndex;
}

/** Find eligible events for one expected cell. */
export function cellEvents(
  events: readonly NoteObserverEvent[],
  target: NoteObserverTarget,
  cell: Pick<NoteObserverCell, 'channel' | 'x' | 'y'>,
): readonly NoteObserverEvent[] {
  return events.filter((event) => eventIsEligible(event, target)
    && event.note.channel === cell.channel
    && event.note.x === cell.x
    && event.note.y === cell.y);
}

export type NoteObserverClassification = 'completion-fence' | 'wake-hint' | 'unusable';

export interface CompletionSample {
  readonly matchingCallbacks: number;
  readonly exactReadCompleted: boolean;
  readonly callbackBeforeCompleteRead: boolean;
}

/** Classify only the measured signal strength. Exact readback remains required. */
export function classifyObserver(
  samples: readonly CompletionSample[],
): NoteObserverClassification {
  if (samples.length === 0 || samples.some((sample) => sample.matchingCallbacks === 0)) {
    return 'unusable';
  }
  if (samples.some((sample) => !sample.exactReadCompleted)) return 'unusable';
  if (samples.some((sample) => sample.callbackBeforeCompleteRead)) return 'wake-hint';
  return 'completion-fence';
}
