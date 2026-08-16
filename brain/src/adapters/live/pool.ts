/**
 * The cursor pool — D6's "pinned, non-following cursor tracks" as an allocator.
 *
 * `LiveAdapter` hardcoded cursor `'0'` through Phase 0, which was fine while
 * nothing wrote two clips in one batch and cost correctness the moment something
 * did. The rig pre-allocates `cursorPool` CursorTrack + PinnableCursorClip pairs
 * at init (E1, D7 — allocation is init-only and enforced), and E1 measured three
 * of them holding three different clips concurrently through 27 user selection
 * changes. This is the thing that decides which one a given clip gets.
 *
 * ⚠ **The allocator is a CORRECTNESS mechanism, not a performance one**, and the
 * reason is E15-F. `cursor.setNoteProps` resolves its note against the clip THAT
 * CURSOR held when the turn began, so a props op that re-points loses every
 * property it carries — silently, with a clean receipt. `stages.ts` keeps the
 * generated props op directly behind its own create so the point frames are a
 * no-op; with a pool, that stops being a happy accident of ordering and becomes
 * structural: the props op asks for the same clip, gets the same cursor, and the
 * cursor is already there. Interleaving still holds the line (the pool is 3 by
 * default and a batch may address more clips than that), but the two mechanisms
 * now agree instead of one carrying the other.
 *
 * Least-recently-used, because the access pattern is "the clip I just wrote is
 * the clip I am about to set properties on".
 */
import {
  addressKey, type AddressKey, type ClipAddress, type TrackAddress,
} from '../../contract/index.js';

export class CursorPool {
  private readonly refs: readonly string[];
  /**
   * target -> cursor ref. Never survives a structural op — see `invalidate`.
   *
   * ⚠ A target is a CLIP or a TRACK, in one map on purpose. The rig allocates
   * `CursorTrack` + `PinnableCursorClip` + `DeviceBank` as one unit per pool slot
   * (`Rig.java`), so a cursor pointed at a track for device work is the very same
   * handle that was holding a clip — pointing it at the track moves it off. One
   * map makes that physical fact unrepresentable-otherwise: taking a ref for a
   * track evicts whatever clip held it, exactly as taking it for another clip
   * would, and the evicted op re-points.
   */
  private readonly held = new Map<AddressKey, string>();
  /** Least-recently-used first. */
  private lru: string[];

  constructor(sizeOrRefs: number | readonly string[]) {
    const refs = typeof sizeOrRefs === 'number'
      ? Array.from({ length: Math.max(1, Math.floor(sizeOrRefs)) }, (_, i) => String(i))
      : [...sizeOrRefs];
    if (refs.length === 0) throw new Error('a cursor pool needs at least one cursor reference');
    if (new Set(refs).size !== refs.length) throw new Error('cursor pool references must be unique');
    this.refs = refs;
    this.lru = [...this.refs];
  }

  get size(): number {
    return this.refs.length;
  }

  /**
   * Which cursor should drive this clip.
   *
   * Stable for as long as the assignment survives: asking twice for the same
   * clip returns the same ref, which is what makes a props op's point frames a
   * no-op rather than the re-point E15-F punishes.
   */
  cursorFor(clip: ClipAddress): string {
    return this.assign(addressKey(clip));
  }

  /**
   * Which cursor should drive this TRACK's device chain.
   *
   * ⚠ Device work needs a pool cursor, not a track index, and the two are not
   * interchangeable: every device handler resolves `rig.cursorTrack(ref)` /
   * `rig.cursorDeviceBanks[ref]` by POOL INDEX, so handing it a bank row number
   * addresses whichever cursor happens to share that number. The chain a device
   * op reaches is the chain its cursor is pointed at and nothing else — which is
   * also why the encoder emits the point in front of the op rather than trusting
   * an assignment to have survived (standing rule 2).
   */
  cursorForTrack(trackRef: TrackAddress): string {
    return this.assign(addressKey(trackRef));
  }

  private assign(key: AddressKey): string {
    const existing = this.held.get(key);
    if (existing !== undefined) {
      this.touch(existing);
      return existing;
    }

    const ref = this.lru[0] ?? this.refs[0]!;
    // Evicting means the target that had this cursor loses its assignment, so the
    // next op addressing it re-points. That is correct and it is why eviction
    // takes the LEAST recently used.
    for (const [heldKey, heldRef] of this.held) {
      if (heldRef === ref) this.held.delete(heldKey);
    }
    this.held.set(key, ref);
    this.touch(ref);
    return ref;
  }

  /**
   * ⚠ Standing rule 2 / D6: re-point after ANY structural op.
   *
   * A held pin's `sceneIndex()` goes PERMANENTLY stale after scene compaction —
   * E3 watched one read 10 for 3.1 seconds while the clip was really at row 9,
   * with everything else about the pin perfectly healthy. Bank indices drift the
   * same way under track create/delete. So an assignment is only valid until the
   * next structural op, and this is how that is enforced rather than remembered.
   */
  invalidate(): void {
    this.held.clear();
    this.lru = [...this.refs];
  }

  /** What is assigned right now — for tests and diagnostics, never for logic. */
  get assignments(): ReadonlyMap<AddressKey, string> {
    return new Map(this.held);
  }

  private touch(ref: string): void {
    this.lru = [...this.lru.filter((r) => r !== ref), ref];
  }
}
