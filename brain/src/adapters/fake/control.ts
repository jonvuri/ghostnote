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
import { ProjectModel } from './model.js';

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

  /** Make accepted parameter writes remain unchanged. */
  setParameterWritesTake(take: boolean): void {
    this.fake.model.parameterWritesTake = take;
  }

  /** Return stale observer generations before the next stable inventory. */
  staleParameterInventories(count: number): void {
    this.fake.model.staleParameterInventories = count;
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

  /**
   * ⚠ Shrink the SCENE window, so a project can outgrow it without growing.
   *
   * The only way this condition is reachable in a test at all. Live it costs a
   * project with more scenes than the bank, and getting one is a one-way door:
   * `scene.create` past the window strands a row that `sceneBank.getScene(i)`
   * cannot address and therefore cannot delete — `probe:e19` produced exactly
   * that and the operator had to remove the scene by hand (E19).
   */
  setSceneWindow(size: number): void {
    this.fake.model.sceneBankSize = size;
  }

  /**
   * ⚠ Rows the scene bank cannot see — present in the project, unaddressable and
   * UNOBSERVED.
   *
   * Goes through the model's own `createScenes`, so the rows are real slots on
   * every track and the scene epoch moves exactly as a create does. What it does
   * NOT do is make them reachable: that is the point.
   */
  addScenesBeyondWindow(count: number): void {
    this.fake.model.createScenes(count);
  }

  /**
   * ⚠⚠ A human filling a launcher slot the observers cannot see — B2's failure,
   * reproducible.
   *
   * The state change is real and the event stream stays silent, because
   * `ProjectModel.observes` says no observer exists out there. *"A control that
   * reproduces the FAILURE is worth as much as one that reproduces the success"*
   * (E17 method guard 10): without this, a passing coverage test proves only that
   * the flag was plumbed, not that anything was ever missed.
   */
  fillUnobservedSlot(channelId: string, slotIndex: number): void {
    const model = this.fake.model;
    const track = model.tracks.find((t) => t.channelId === channelId);
    if (track === undefined) throw new Error(`fillUnobservedSlot: no track ${channelId}`);
    if (model.observes(track, slotIndex)) {
      throw new Error(
        `fillUnobservedSlot: (${channelId}, ${slotIndex}) IS inside both windows, so an observer `
        + 'would fire and this control would be modelling nothing. Shrink a window first.',
      );
    }
    model.setSlotContent(track, slotIndex, true);
  }

  /** Delete a scene directly, compacting rows and staling every epoch (E3). */
  compactScene(index: number): void {
    this.fake.model.deleteScene(index);
  }

  /**
   * ⚠ A human dragging a clip from one launcher slot to another — the edit E16s
   * measured, and the reason the content epoch exists.
   *
   * The scene count does not move (it is the same grid), so the scene epoch sits
   * still and the ONLY signal is the pair of content events: source emptied,
   * destination filled. That asymmetry is the finding; reproducing it here is
   * what lets the offline suite assert on it.
   *
   * ⚠ It moves the CONTENT, not just the flag, because a detector proved against
   * a flag that moved without its notes would pass while the thing it is
   * detecting had not happened.
   */
  dragClip(channelId: string, fromSlot: number, toSlot: number): void {
    const model = this.fake.model;
    const track = model.tracks.find((t) => t.channelId === channelId);
    const from = track?.slots[fromSlot];
    const to = track?.slots[toSlot];
    if (track === undefined || from === undefined || to === undefined) {
      throw new Error(`dragClip: no slot ${channelId}:${fromSlot} -> ${toSlot}`);
    }
    to.notes = new Map(from.notes);
    to.name = from.name;
    to.color = { ...from.color };
    to.playStartBeats = from.playStartBeats;
    to.playStopBeats = from.playStopBeats;
    to.loopEnabled = from.loopEnabled;
    to.loopStartBeats = from.loopStartBeats;
    to.lengthBeats = from.lengthBeats;
    to.launchQuantization = from.launchQuantization;
    to.launchMode = from.launchMode;
    to.useLoopStartAsQuantizationReference = from.useLoopStartAsQuantizationReference;
    from.notes = new Map();
    from.name = '';
    from.color = { red: 87, green: 97, blue: 198 };
    from.playStartBeats = 0;
    from.playStopBeats = 0;
    from.loopEnabled = true;
    from.loopStartBeats = 0;
    from.lengthBeats = 0;
    from.launchQuantization = 'default';
    from.launchMode = 'default';
    from.useLoopStartAsQuantizationReference = false;
    model.setSlotContent(track, toSlot, true);
    model.setSlotContent(track, fromSlot, false);
  }

  /**
   * ⚠ A human deleting a clip and putting an IDENTICAL one in its place.
   *
   * The case the content fingerprint cannot see and the launcher observer can:
   * every byte compares equal afterwards, and the slot is nonetheless not
   * holding the clip we wrote. Built as its own control because *"a control that
   * reproduces the FAILURE is worth as much as one that reproduces the success"*
   * (E17 method guard 10) — without it, a passing `moved` test proves only that
   * the events were plumbed, not that they buy anything the fingerprint lacks.
   */
  replaceClipInPlace(channelId: string, slotIndex: number): void {
    const model = this.fake.model;
    const track = model.tracks.find((t) => t.channelId === channelId);
    const slot = track?.slots[slotIndex];
    if (track === undefined || slot === undefined) {
      throw new Error(`replaceClipInPlace: no slot ${channelId}:${slotIndex}`);
    }
    const notes = new Map(slot.notes);
    const length = slot.lengthBeats;
    model.setSlotContent(track, slotIndex, false);
    slot.notes = notes;
    slot.lengthBeats = length;
    model.setSlotContent(track, slotIndex, true);
  }

  /**
   * ⚠ Flood the event ring so a window loses the names it needed.
   *
   * Not a hypothetical: the ring is 24 entries in the extension and a human
   * dragging a handful of clips around while a batch runs exhausts it. The
   * failure it produces is the dangerous kind — a window that reports FEWER
   * events than happened and therefore reads as quieter than the world was — so
   * it has to be reachable from a test.
   */
  floodContentEvents(count: number): void {
    for (let i = 0; i < count; i++) {
      this.fake.model.pushContentEvent('flood-track', i, i % 2 === 0);
    }
  }

  /** An event the observer could not attribute — the id had not arrived yet. */
  unattributableContentEvent(slotIndex: number): void {
    this.fake.model.pushContentEvent('', slotIndex, true);
  }

  /**
   * ⚠⚠ A DIFFERENT PROJECT loaded, with the extension still running — the
   * discontinuity that has no numeric tell.
   *
   * Modelled faithfully rather than conveniently, and the difference matters:
   * the generation is UNCHANGED (a project load does not re-`init()` anything)
   * and the content epoch goes UP, not back to zero, because the observers
   * re-fire initial values for the new project's clips. So a stale mark's window
   * is a perfectly ordinary-looking busy one, and only `RevisionMark.project`
   * separates it from a session where the human filled a few slots.
   *
   * ⚠ The tracks are replaced with freshly minted `channelId`s, because that is
   * what makes the case dangerous: every positional address in a stash from the
   * old project now names a track that does not exist.
   */
  loadProject(name: string, tracks: readonly string[] = ['gn-A']): void {
    const model = this.fake.model;
    model.project = name;
    model.tracks = [];
    for (const trackName of tracks) model.createTrack(trackName);
    // Initial values arrive through the same callbacks (§3.2.3), so the epoch
    // CLIMBS across a project load. Anything that reset it here would make the
    // fake kinder than Bitwig in exactly the direction that hides the bug.
    for (const track of model.tracks) {
      for (const [slotIndex, slot] of track.slots.entries()) {
        if (slot.hasContent) model.pushContentEvent(track.channelId, slotIndex, true);
      }
    }
    model.pushContentEvent(model.tracks[0]?.channelId ?? '', 0, false);
  }

  /**
   * ⚠ Bitwig restarting, or the extension reloading: a NEW generation, and both
   * epoch counters back to zero.
   *
   * The counters coming back SMALLER is what makes this its own failure rather
   * than a large jump — a mark taken before compares equal to one taken after,
   * which is a difference that reads as no difference. Nothing but the
   * generation nonce catches it.
   *
   * ⚠ Contrast `loadProject` above, which is the same class of incomparability
   * reached the other way: there the counters keep CLIMBING and nothing looks
   * wrong at all. Two controls, because two different fields catch them.
   */
  restartExtension(): void {
    const model = this.fake.model;
    model.generation = `fake-gen-${Math.random().toString(36).slice(2, 10)}`;
    model.contentEpoch = 0;
    model.contentRing = [];
    // ⚠⚠ THE SCENE EPOCH RESTARTS TOO, and omitting it made the fake MORE
    // PERMISSIVE than Bitwig — the one direction a fake must never be wrong in
    // (PHASE-0 §Risks). `sceneCountChanges` is an observer like any other: it is
    // re-`init()`ed with the rest of the rig and comes back at its resting value
    // (measured 7 -> 2 across a controller reload, FINDINGS E19). Carrying the
    // old value across a fake restart let a scene-relative address minted before
    // it keep AUTHORISING, where live it is refused as stale. Found by review;
    // the window tests never caught it because they check `generation`, and the
    // address-authorisation path does not consult that at all — see the ⚠ below.
    model.sceneEpoch = ProjectModel.RESTING_SCENE_EPOCH;
  }
}

export function control(fake: FakeAdapter): TrapControl {
  return new TrapControl(fake);
}
