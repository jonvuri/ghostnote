/**
 * `TrapControl` — the fake's test side channel.
 *
 * ⚠ Deliberately NOT part of `BitwigAdapter`. The conformance suite receives a
 * `BitwigAdapter` and therefore CANNOT reach any of this, which is the structural
 * separation between "portable behaviour both adapters must exhibit" and
 * "fake-only manipulation". Without that separation a conformance case would
 * quietly start depending on a knob real Bitwig does not have, and the suite
 * would stop meaning anything when pointed at a live DAW.
 */
import type { FakeAdapter } from './adapter.js';
import type { ProjectModel } from './model.js';

export class TrapControl {
  constructor(private readonly fake: FakeAdapter) {}

  /** Direct model access — how a trap test observes a trap without the mitigation. */
  get model(): ProjectModel {
    return this.fake.model;
  }

  get tick(): number {
    return this.fake.clock.tick;
  }

  /** Writes staged but not yet visible to `read` — the two-turn rule, observable. */
  get pendingWrites(): number {
    return this.fake.clock.pendingCount;
  }

  /** Force the turn boundary without going through apply/settle. */
  commitNow(): void {
    this.fake.clock.commit();
  }

  advance(ticks = 1): void {
    this.fake.clock.advance(ticks);
  }

  /**
   * A competing writer — the user nudging a clip by hand mid-batch. E8 proved a
   * batch tagged with the old revision then applies ZERO of its ops.
   */
  bumpRevision(): number {
    return ++this.fake.model.revision;
  }

  /** Shrink the window so overflow can be proven without inventing 300 tracks (E5). */
  setBankWindow(size: number): void {
    this.fake.model.trackBankSize = size;
  }

  /** Tracks the bank cannot see — present in the project, absent from every read. */
  addTracksBeyondWindow(count: number): void {
    for (let i = 0; i < count; i++) this.fake.model.createTrack(`hidden ${i + 1}`);
  }

  /** Delete a scene directly, compacting rows and staling every epoch (E3). */
  compactScene(index: number): void {
    this.fake.model.deleteScene(index);
  }
}

export function control(fake: FakeAdapter): TrapControl {
  return new TrapControl(fake);
}
