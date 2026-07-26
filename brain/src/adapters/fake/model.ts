/**
 * The fake's project model — plain, inspectable state.
 *
 * ⚠ It is deliberately a bag of public data, not an encapsulated object. A trap
 * test MUST be able to observe the model directly: if the only way to see a trap
 * is through the mitigation that hides it, the test proves nothing about the
 * trap and everything about itself.
 *
 * This models Bitwig's OBSERVED behaviour, warts first. Every wart cites the
 * experiment that established it; that citation requirement is the mitigation
 * PHASE-0 §Risks names for fake drift ("every trap the fake models must cite the
 * FINDINGS experiment that established it").
 */
import type { NoteRecord } from '../../contract/index.js';

export type TrackType = 'Instrument' | 'Audio' | 'Effect' | 'Master' | 'Group';

export interface FakeSlot {
  hasContent: boolean;
  lengthBeats: number;
  /** Keyed `channel:pitch:startBeats` so a re-write of the same cell replaces it. */
  notes: Map<string, NoteRecord>;
  /**
   * ⚠ E15-D: until this tick, a `getStep` against this clip is unusable and any
   * property written through one is silently discarded. Set by a note write,
   * because a note write always changes the step grid on the way in.
   */
  stepDataStaleUntilTick: number;
}

export interface FakeDevice {
  name: string;
  /** Live only after E4's ~194ms settle; until then reads report `paramsLive: false`. */
  paramsLive: boolean;
  params: { name: string; value: number }[];
}

export interface FakeTrack {
  /** The durable key (E2f). Minted fresh on create; a delete+recreate gets a NEW one. */
  channelId: string;
  name: string;
  type: TrackType;
  /** Indexed by scene. */
  slots: FakeSlot[];
  devices: FakeDevice[];
}

export const noteKey = (channel: number, pitch: number, startBeats: number): string =>
  `${channel}:${pitch}:${startBeats}`;

export class ProjectModel {
  /** Ordered exactly as the flat TrackBank presents them — see `bankView()`. */
  tracks: FakeTrack[] = [];
  sceneCount = 8;

  /**
   * The bank WINDOW, not the project size. Tracks beyond it are invisible —
   * absent, not slow (E5). Default matches RigConfig's shipped default.
   */
  trackBankSize = 16;
  sceneBankSize = 16;

  /** E8's monotonic counter, owned by the executor, not by any DAW object. */
  revision = 0;

  /** Ours. Bumped by any scene create/delete so stale addresses are refusable (E3). */
  sceneEpoch = 1;

  /**
   * The pool cursor's step grid, in beats.
   *
   * ⚠ On the CURSOR, not on a clip — re-pointing carries it along, which is
   * precisely why it is a hazard: a write to one clip leaves the grid it chose
   * behind for whatever touches the cursor next (E15-D). `undefined` until
   * something sets it, because a fresh fake has no way to know what grid a real
   * pool cursor was left on, and inventing one would let the fake fail a case
   * live Bitwig would pass.
   */
  cursorStepSize: number | undefined = undefined;

  /**
   * Which clip the pool cursor points at, as `channelId:sceneIndex`.
   *
   * ⚠ Cursor state, not clip data, so it moves IMMEDIATELY rather than through
   * the pending buffer — a re-point steers the API calls that follow it in the
   * same turn (E15-D). What lags is the step DATA behind it, which is the whole
   * of E15-F.
   */
  cursorClip: string | undefined = undefined;

  private nextUuid = 1;

  mintChannelId(): string {
    // Shape-compatible with a real Bitwig channelId so nothing can depend on the
    // difference; content is deterministic so tests read cleanly.
    const n = this.nextUuid++;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  }

  makeSlots(): FakeSlot[] {
    return Array.from({ length: this.sceneCount }, () => ({
      hasContent: false,
      lengthBeats: 0,
      notes: new Map<string, NoteRecord>(),
      stepDataStaleUntilTick: 0,
    }));
  }

  /**
   * ⚠ E2c: the flat TrackBank includes the FX section and the MASTER track AFTER
   * the regular tracks. Code that treats "bank size" as "number of regular
   * tracks" is wrong — daw-mcp made exactly that mistake. `trackType()` is what
   * distinguishes them.
   */
  bankView(): FakeTrack[] {
    const regular = this.tracks.filter((t) => t.type !== 'Effect' && t.type !== 'Master');
    const tail = this.tracks.filter((t) => t.type === 'Effect' || t.type === 'Master');
    return [...regular, ...tail];
  }

  /** What the bank can actually SEE. Everything past the window is invisible (E5). */
  visibleTracks(): FakeTrack[] {
    return this.bankView().slice(0, this.trackBankSize);
  }

  /** What the project HOLDS. The gap between this and `visibleTracks` is the blind spot. */
  get trackCount(): number {
    return this.tracks.length;
  }

  get overflowing(): boolean {
    return this.trackCount > this.trackBankSize;
  }

  /** Resolve by durable key — but only inside the window, exactly like the real bank. */
  findByChannelId(channelId: string): { track: FakeTrack; index: number } | undefined {
    const visible = this.visibleTracks();
    const index = visible.findIndex((t) => t.channelId === channelId);
    return index < 0 ? undefined : { track: visible[index]!, index };
  }

  /** Does this track exist at all, even out of view? Distinguishes absent from unreachable. */
  existsAnywhere(channelId: string): boolean {
    return this.tracks.some((t) => t.channelId === channelId);
  }

  /**
   * Resolve `cursorClip` back to the slot it names — what the cursor is HOLDING,
   * as opposed to what an op asked it to hold.
   *
   * Needed only by E2's empty-slot trap: when a point finds nothing to attach to,
   * the cursor keeps its previous clip, so the fake has to know what that was.
   *
   * ⚠ Searches ALL tracks rather than `visibleTracks()`. The pool cursor is pinned
   * and non-following (E1), so where it is parked does not depend on what the bank
   * window can currently see; filtering here would invent a "cursor is nowhere"
   * that the real one does not have.
   */
  resolveClipKey(key: string | undefined): { track: FakeTrack; slot: FakeSlot; sceneIndex: number } | undefined {
    if (key === undefined) return undefined;
    const sep = key.lastIndexOf(':');
    if (sep < 0) return undefined;
    const channelId = key.slice(0, sep);
    const sceneIndex = Number(key.slice(sep + 1));
    const track = this.tracks.find((t) => t.channelId === channelId);
    const slot = track?.slots[sceneIndex];
    return track === undefined || slot === undefined ? undefined : { track, slot, sceneIndex };
  }

  /**
   * ⚠ E2c: `createInstrumentTrack(position)` does NOT honour the requested
   * position — asking for the end landed at index 7 of 9, asking for 0 landed at
   * 1. The only safe procedure is create, then diff the bank by channelId. The
   * fake appends before the FX/Master tail, which is close enough to "somewhere
   * you did not choose" to keep callers honest.
   *
   * ⚠ E2c also: default names auto-renumber, so 'Inst 2' is a positional
   * auto-name and never an identity.
   */
  createTrack(name?: string): FakeTrack {
    const track: FakeTrack = {
      channelId: this.mintChannelId(),
      name: name ?? `Inst ${this.tracks.filter((t) => t.type === 'Instrument').length + 1}`,
      type: 'Instrument',
      slots: this.makeSlots(),
      devices: [],
    };
    const tailAt = this.tracks.findIndex((t) => t.type === 'Effect' || t.type === 'Master');
    if (tailAt < 0) this.tracks.push(track);
    else this.tracks.splice(tailAt, 0, track);
    return track;
  }

  deleteTrack(channelId: string): boolean {
    const at = this.tracks.findIndex((t) => t.channelId === channelId);
    if (at < 0) return false;
    this.tracks.splice(at, 1);
    return true;
  }

  /**
   * ⚠ E3: deleting a scene COMPACTS the rows below it upward — markers at rows
   * 9/10 moved to 8/9 and row 10 emptied. The launcher grid is not sparse and not
   * absolute, so scene deletion silently shifts clip addresses. Bumping the epoch
   * is what converts that into a refusal at `resolve()` instead of a wrong write.
   */
  deleteScene(index: number): void {
    for (const track of this.tracks) track.slots.splice(index, 1);
    this.sceneCount--;
    this.sceneEpoch++;
  }

  createScenes(count: number): void {
    for (const track of this.tracks) {
      for (let i = 0; i < count; i++) {
        track.slots.push({ hasContent: false, lengthBeats: 0, notes: new Map(), stepDataStaleUntilTick: 0 });
      }
    }
    this.sceneCount += count;
    this.sceneEpoch++;
  }

  /**
   * ⚠ E3: the device chain RE-INDEXES on delete, exactly like tracks — deleting
   * device[0] shifted the survivor from index 1 to 0.
   */
  deleteDevice(track: FakeTrack, chainIndex: number): boolean {
    if (chainIndex < 0 || chainIndex >= track.devices.length) return false;
    track.devices.splice(chainIndex, 1);
    return true;
  }

  /**
   * ⚠ E8-E: consecutive SAME-PITCH notes truncate each other — Bitwig ends a note
   * where the next same-pitch note begins, so four adjacent `dur=1` notes each
   * come back as 0.25. A written duration is not guaranteed to survive, which is
   * why D5 says a take stores what readback REPORTED, never what was requested.
   *
   * There is no mitigation for this. The contract's job is to report it honestly.
   */
  static applyAdjacencyTruncation(notes: NoteRecord[]): NoteRecord[] {
    const byPitch = new Map<number, NoteRecord[]>();
    for (const n of notes) {
      const list = byPitch.get(n.pitch) ?? [];
      list.push(n);
      byPitch.set(n.pitch, list);
    }
    const out: NoteRecord[] = [];
    for (const list of byPitch.values()) {
      const sorted = [...list].sort((a, b) => a.startBeats - b.startBeats);
      sorted.forEach((n, i) => {
        const next = sorted[i + 1];
        if (next === undefined) {
          out.push(n);
          return;
        }
        const room = next.startBeats - n.startBeats;
        out.push(n.durationBeats > room ? { ...n, durationBeats: room } : n);
      });
    }
    return out.sort((a, b) => a.startBeats - b.startBeats || a.pitch - b.pitch);
  }
}
