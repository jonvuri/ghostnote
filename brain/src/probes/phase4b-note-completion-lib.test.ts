import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cellEvents, classifyObserver, eventIsEligible,
  type NoteObserverEvent, type NoteObserverTarget,
} from './phase4b-note-completion-lib.js';

const target: NoteObserverTarget = {
  generation: 4,
  trackId: 'track-a',
  trackIndex: 7,
  slotIndex: 2,
};

const event = (overrides: Partial<NoteObserverEvent> = {}): NoteObserverEvent => ({
  ...target,
  sequence: 11,
  armed: true,
  callbackEpochMs: 1000,
  note: { channel: 3, x: 8, y: 64, state: 'NoteOn' },
  ...overrides,
});

test('4b-note-event: initial and stale-target events cannot wake a read', () => {
  assert.equal(eventIsEligible(event({ armed: false }), target), false);
  assert.equal(eventIsEligible(event({ generation: 3 }), target), false);
  assert.equal(eventIsEligible(event({ trackId: 'track-b' }), target), false);
  assert.equal(eventIsEligible(event({ slotIndex: 1 }), target), false);
  assert.equal(eventIsEligible(event(), target), true);
});

test('4b-note-event: a wake must match the exact channel and cell', () => {
  const events = [
    event(),
    event({ sequence: 12, note: { channel: 4, x: 8, y: 64, state: 'NoteOn' } }),
    event({ sequence: 13, note: { channel: 3, x: 9, y: 64, state: 'NoteOn' } }),
  ];
  assert.deepEqual(cellEvents(events, target, { channel: 3, x: 8, y: 64 }), [events[0]]);
});

test('4b-note-event: early activity is a wake hint, not a completion fence', () => {
  assert.equal(classifyObserver([
    { matchingCallbacks: 1, exactReadCompleted: true, callbackBeforeCompleteRead: true },
  ]), 'wake-hint');
  assert.equal(classifyObserver([
    { matchingCallbacks: 0, exactReadCompleted: true, callbackBeforeCompleteRead: false },
  ]), 'unusable');
  assert.equal(classifyObserver([
    { matchingCallbacks: 1, exactReadCompleted: true, callbackBeforeCompleteRead: false },
  ]), 'completion-fence');
});
