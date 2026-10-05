/** Compute the 8h3a verdict from the raw close capture and callback records. */
import assert from 'node:assert/strict';
import { decodeIssues, declaredNotes, type DecodedRow, type Defaults, type FixturePlan, type BatchRow, type ValueRow, type Wire } from './phase8h2a-replay-lib.js';
export const DEALBREAKER_MARKER = '8h3a-dealbreakers-v2';
export function verdict(trial: Wire, defaults: Defaults): Wire {
  const epoch = trial.status as Wire, target = trial.target as FixturePlan;
  assert.equal(epoch.droppedBatches, 0); assert.equal(epoch.droppedValues, 0);
  const declared = declaredNotes(target, defaults);
  if (trial.writeVelocity !== undefined) declared[declared.length - 1]!.velocity = Number(trial.writeVelocity) * 127;
  const closeMs = Number(epoch.closeMs), closeSeq = Number(epoch.closeSeq);
  const issues = closeMs < 0 ? ['no-close-signal'] : decodeIssues(trial.rows as DecodedRow[], declared);
  const batches = epoch.batches as BatchRow[], signal = (epoch.values as ValueRow[])
    .find(v => v[0] === 'clipExists' && v[1] === 'true');
  const callbacks = Number(epoch.callbacks);
  const singleBatch = callbacks === 0 || (batches.length === 1 && batches[0]![2] === callbacks);
  const startCloses = signal !== undefined && signal[4] === callbacks;
  const cursor = trial.cursor as Wire, address = trial.target as Wire;
  const targetMatches = cursor.trackChannelId === address.trackId && cursor.sceneIndex === address.row && cursor.clipExists === true;
  return { batches: batches.length, singleBatch, startCloses, targetMatches, closeMs, closeSeq,
    afterClose: closeSeq < 0 ? null : Number(epoch.callbacks) - closeSeq, duplicates: epoch.duplicates,
    exact: issues.length === 0, issues, pass: closeMs >= 0 && issues.length === 0 && singleBatch && startCloses && targetMatches
      && Number(epoch.callbacks) === closeSeq && epoch.duplicates === 0 };
}
