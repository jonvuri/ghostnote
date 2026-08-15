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
import type {
  ContentEvent, LaunchMode, LaunchQuantization, NoteRecord, ObservedContainer,
} from '../../contract/index.js';

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
  launchQuantization: LaunchQuantization;
  launchMode: LaunchMode;
  useLoopStartAsQuantizationReference: boolean;
  isPlaying: boolean;
  isPlaybackQueued: boolean;
  isStopQueued: boolean;
}

/**
 * A device-layer chain inside a container device.
 *
 * ⚠ The `id` is NOT an address, and this comment used to say the field should
 * not exist at all — for a good reason that turned out to be about the wrong
 * question. The reason stands: a chain's `channelId` is minted by the project
 * LOADER, so it regenerates on every document load while the name survives
 * (E17ad 8/8, E18b), and resolving a chain by it would be the fake certifying a
 * reach live Bitwig does not have. Nothing here resolves by it, and
 * `observeContainer` is the only reader.
 *
 * ⚠⚠ What it exists for is the question a NAME cannot answer, which arrived
 * with chain creation in session 3f step 6b-2: a duplicate carries its source's
 * name, so between the copy and its rename the container holds two chains that
 * are identical to every name-based lookup. `mintedChain` tells them apart by
 * this, in the same turn, exactly as `apply` diffs the track bank by
 * `channelId` after a create (E2c) — and the fake has to model it or the shared
 * diff is exercised on one adapter only.
 *
 * ⚠ It is minted per-chain and never copied by `duplicateChain`, because a
 * duplicate that inherited its source's id would make the diff below unable to
 * see it — which is precisely the failure the field guards against.
 */
export interface FakeChain {
  name: string;
  mute?: boolean;
  solo: boolean;
  volume?: number;
  pan?: number;
  color?: { red: number; green: number; blue: number };
  /** ⚠ A within-session witness, never an address. See above. */
  id: string;
  devices: FakeDevice[];
}

export interface FakeDevice {
  name: string;
  /** Live only after E4's ~194ms settle; until then reads report `paramsLive: false`. */
  paramsLive: boolean;
  params: { name: string; value: number }[];
  /**
   * ⚠ Present only on a CONTAINER device, and the two container kinds do not
   * ship alike — which is the whole bootstrap question for the layer-chain
   * lifecycle. A fresh **FX Layer ships with ONE (empty) chain**, so it can be
   * grown entirely typed; a fresh **Instrument Layer ships with ZERO** and has
   * no first chain to duplicate (`e17ai`, re-confirmed at three destinations by
   * E18a). `ProjectModel.shippedChains` is where that mapping lives.
   */
  chains?: FakeChain[];
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
  /**
   * ⚠ The SCENE window, and it now does work rather than being decoration.
   *
   * It was declared, reported in `hello()`'s limits, and consulted by nothing —
   * so the fake happily addressed row 40 of a 16-wide bank and certified a write
   * that live Bitwig answers with *"Parameter index (=99) must be in the range 0
   * to 16"* from the middle of a batch (E19). That is PHASE-0 §Risks' named
   * failure mode in the one direction it must never point: the fake being MORE
   * PERMISSIVE than the thing it stands in for.
   */
  sceneBankSize = 16;

  /**
   * ⚠⚠ THE CONTAINER WINDOWS, and they are small on purpose — these are
   * `Rig.SLOT_SCOPES`, `Rig.SLOT_LAYER_BANK` and `Rig.SLOT_LAYER_DEVICE_BANK`,
   * the banks `chain.inventory` reads through.
   *
   * A layer bank is not the track bank: it is fixed at init, it is narrow, and a
   * container is only observable at all in the FIRST FEW top-level device
   * positions, because a `DeviceLayerBank` has to hang off a bank slot that
   * exists when the extension starts (D7 — allocation is init-only). Modelled
   * rather than idealised for the reason PHASE-0 §Risks names: a fake that could
   * see every chain everywhere would certify resolution live Bitwig answers with
   * silence, and "we could not look" would ship as "it is not there".
   */
  containerScopes = 2;
  chainBankSize = 4;
  chainDeviceBankSize = 4;
  /** The top-level device bank mirrors RigConfig's shipped default. */
  deviceBankSize = 8;

  /**
   * ⚠ What a freshly inserted container SHIPS WITH, by device uuid (`e17ai`,
   * E18a). Anything not listed here is not a container at all.
   *
   * ⚠ The shipped chain's NAME is not a measurement — E4c only established that
   * a DEFAULT name tracks the chain's content, and nothing has ever recorded
   * what a fresh FX Layer calls its one chain. So the fake uses an obviously
   * synthetic name, and any test that hardcodes it is asserting on the fake
   * rather than on Bitwig. Read the name back and use what you were given.
   */
  static readonly FX_LAYER_UUID = 'a0913b7f-096b-4ac9-bddd-33c775314b42';
  static readonly INSTRUMENT_LAYER_UUID = '5024be2e-65d6-4d40-bbfe-8b2ea993c445';
  static readonly SHIPPED_CHAIN_NAME = 'fake-shipped-alternate';

  /** E8's monotonic counter, owned by the executor, not by any DAW object. */
  revision = 0;

  /**
   * ⚠ What a freshly-`init()`ed extension reports before anyone touches a scene.
   *
   * Named rather than inlined so `restartExtension` and this field cannot drift:
   * the whole point of a restart is that the counter comes back HERE, and a
   * literal in two places is how one of them stops being the resting value.
   * Live, `sceneCountChanges` starts at 0 and the observer's first delivery makes
   * it small-and-nonzero — measured at 2 across a controller reload where it had
   * been 7 (`FINDINGS.md` E19).
   */
  static readonly RESTING_SCENE_EPOCH = 1;

  /**
   * Bumped by any scene create/delete so stale addresses are refusable (E3).
   *
   * ⚠ It used to be described as "ours". It is not any more: live, this counter
   * is an OBSERVER in the extension that sees the user's scene ops as well as
   * ours (D4 rev), and the fake models the counter, not the old ownership. ⚠ Which
   * also means it RESTARTS with the extension — see `TrapControl.restartExtension`.
   */
  sceneEpoch = ProjectModel.RESTING_SCENE_EPOCH;

  /**
   * ⚠ The launcher-content epoch and its ring — the fake's model of E16s.
   *
   * `ClipLauncherSlotBank.addHasContentObserver` fires when a slot changes
   * between empty and occupied, so a clip MOVE arrives as a PAIR (source
   * emptied, destination filled) where the scene count sits still. The fake has
   * to model it because the two failure modes that matter most cannot be
   * produced on demand against a live DAW: a ring that has dropped the names we
   * needed, and a mark from a previous life of the extension.
   *
   * ⚠ Same ring size as the extension. Deliberately the same wrong-by-being-small
   * number rather than a generous one — a fake with a bigger buffer would pass
   * the truncation cases the live adapter fails.
   */
  static readonly CONTENT_RING = 24;
  contentEpoch = 0;
  contentRing: ContentEvent[] = [];

  /**
   * ⚠ Minted per model, standing in for the extension's per-`init()` nonce, and
   * settable so `TrapControl.restartExtension()` can prove the discontinuity.
   */
  generation = `fake-gen-${Math.random().toString(36).slice(2, 10)}`;

  /**
   * ⚠ Which project is loaded — modelled because a project change is the ONE
   * discontinuity with no numeric tell.
   *
   * A restart resets `contentEpoch` to 0, which a comparison can at least notice
   * as impossible. A project LOAD leaves the extension running, so the counter
   * keeps climbing and a stale mark's window looks like an ordinary busy one.
   * `TrapControl.loadProject` models it faithfully — same generation, epoch goes
   * UP — which is the only way a test can prove the field is doing the work.
   */
  project = 'fake-project-A';

  /**
   * The ONE place a slot changes occupancy — so every route into that state
   * change emits the observer event, exactly as Bitwig does.
   *
   * ⚠ Only a CHANGE fires. A note write into an already-occupied slot is not a
   * content event, and modelling it as one would make the fake noisier than the
   * thing it stands in for, which is worse than useless for a detector whose
   * whole value is that silence means something.
   */
  setSlotContent(track: FakeTrack, sceneIndex: number, has: boolean): void {
    const slot = track.slots[sceneIndex];
    if (slot === undefined || slot.hasContent === has) return;
    slot.hasContent = has;
    // ⚠⚠ THE OBSERVER ONLY EXISTS INSIDE THE WINDOWS, and the state change
    // happens either way — which is the whole of B2.
    //
    // `Rig.java` attaches one `addHasContentObserver` per bank row across
    // `config.tracks`, on a slot bank sized by `config.scenes`. A clip appearing
    // on a track past the track window, or in a row past the scene window, fires
    // NOTHING. The world moved and the event stream is silent, which is
    // indistinguishable from a quiet window if you only count events.
    //
    // ⚠ Modelled rather than mitigated, deliberately. A fake that fired here
    // would certify a detector that live Bitwig cannot supply, and the offline
    // suite would prove `deltaComplete` correct on exactly the case where it is
    // not. The mitigation is `RevisionMark.window` making the reach visible.
    if (this.observes(track, sceneIndex)) this.pushContentEvent(track.channelId, sceneIndex, has);
  }

  /** ⚠ Would a launcher observer exist for this cell at all? See `setSlotContent`. */
  observes(track: FakeTrack, sceneIndex: number): boolean {
    return sceneIndex < this.sceneBankSize
      && this.bankView().indexOf(track) >= 0
      && this.bankView().indexOf(track) < this.trackBankSize;
  }

  /** ⚠ Also used to model an edit made by a HUMAN, which is the point of the detector. */
  pushContentEvent(channelId: string, slotIndex: number, filled: boolean): void {
    const seq = ++this.contentEpoch;
    const trackIndex = this.bankView().findIndex((t) => t.channelId === channelId);
    this.contentRing.push({ seq, channelId, trackIndex, slotIndex, filled });
    if (this.contentRing.length > ProjectModel.CONTENT_RING) this.contentRing.shift();
  }

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
      launchQuantization: 'default',
      launchMode: 'default',
      useLoopStartAsQuantizationReference: false,
      isPlaying: false,
      isPlaybackQueued: false,
      isStopQueued: false,
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

  /**
   * ⚠ The same question one population down: does the project hold rows the scene
   * bank cannot address?
   *
   * Live, the two numbers are `sceneBank.itemCount()` (the PROJECT total —
   * measured, E21 arm 1) and `config.scenes`. Here they are `sceneCount` and
   * `sceneBankSize`, which is why a test can produce the condition at all: a real
   * session cannot be asked to grow to 99 scenes, and a scene created past the
   * window cannot be given back (E19).
   */
  get sceneOverflowing(): boolean {
    return this.sceneCount > this.sceneBankSize;
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

  /** E16: a copy lands beside its source with fresh durable identity. */
  duplicateTrack(channelId: string): FakeTrack | undefined {
    const at = this.tracks.findIndex((t) => t.channelId === channelId);
    const source = this.tracks[at];
    if (at < 0 || source === undefined) return undefined;
    const copy: FakeTrack = {
      channelId: this.mintChannelId(),
      name: source.name,
      type: source.type,
      slots: source.slots.map((slot) => ({ ...slot, notes: new Map(slot.notes) })),
      devices: source.devices.map((device) => ({
        ...device,
        params: device.params.map((param) => ({ ...param })),
        // ⚠ Deep, and a copied container's chains keep their NAMES — which is
        // exactly the `e17n` artifact: two containers whose chains are named
        // identically and are different objects. That is the fixture the
        // ambiguity refusal exists for, so the fake has to be able to produce it.
        ...(device.chains === undefined ? {} : {
          chains: device.chains.map((c) => ({
            name: c.name,
            solo: c.solo,
            // ⚠ A FRESH id under the SAME name, which is `e17n` stated exactly:
            // a duplicated container's chains are different objects wearing
            // identical names. Copying the id would model them as the same
            // object, which is the one thing they demonstrably are not.
            id: this.mintChannelId(),
            devices: c.devices.map((d) => ({ ...d, params: d.params.map((p) => ({ ...p })) })),
          })),
        }),
      })),
    };
    this.tracks.splice(at + 1, 0, copy);
    return copy;
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
    // ⚠ The content observer is INDEXED BY SLOT POSITION, so a compaction is
    // visible to it as every position whose occupancy changed underneath it —
    // which is a second, independent reason a scene op invalidates clip
    // addresses, and one the scene epoch alone would not have shown. Derived by
    // diffing the same positions before and after rather than predicted, because
    // predicting it is exactly the guess the epoch exists to avoid.
    const before = this.tracks.map((t) => t.slots.map((s) => s.hasContent));
    for (const track of this.tracks) track.slots.splice(index, 1);
    this.emitCompaction(before);
    this.sceneCount--;
    this.sceneEpoch++;
  }

  /**
   * ⚠⚠ E21: what `Track.createNewLauncherClip` does to an OCCUPIED slot.
   *
   * Not an error, and not an overwrite. Bitwig APPENDS A SCENE to the project and
   * puts the new clip in the new row, leaving the clip that was there alone —
   * measured live, `gn-conf-A` row 0, 169 -> 170 scenes with every row inside the
   * window unchanged.
   *
   * ⚠ That makes the op a silent, unbudgeted `scene.create`, and the row it mints
   * is at the END of the project: past the bank window on anything bigger than
   * it, so nothing can address it, delete it, or observe it. It is how a project
   * reaches 99 scenes with nobody creating one, which is the state `probe:e19`
   * tripped over and mis-attributed.
   *
   * The epoch moves because the count moved — the same reason a real
   * `scene.create` moves it — which is the one tell the old code had, and it read
   * as an unexplained epoch bump rather than as growth.
   */
  appendSceneForOverflowingClip(track: FakeTrack, lengthBeats: number): void {
    const row = this.sceneCount;
    this.createScenes(1);
    const appended = track.slots[row];
    if (appended === undefined) return;
    appended.hasContent = true;
    appended.lengthBeats = lengthBeats;
    // ⚠ Deliberately NOT through `setSlotContent`: the new row is past the slot
    // bank window by construction on any project bigger than it, so no observer
    // exists to fire. Routing it through the observer path would make the fake
    // report an event Bitwig cannot produce.
    if (this.observes(track, row)) this.pushContentEvent(track.channelId, row, true);
  }

  createScenes(count: number): void {
    for (const track of this.tracks) {
      for (let i = 0; i < count; i++) {
        track.slots.push({
          hasContent: false, lengthBeats: 0, notes: new Map(), stepDataStaleUntilTick: 0,
          launchQuantization: 'default', launchMode: 'default',
          useLoopStartAsQuantizationReference: false,
          isPlaying: false, isPlaybackQueued: false, isStopQueued: false,
        });
      }
    }
    this.sceneCount += count;
    this.sceneEpoch++;
  }

  /**
   * One event per slot POSITION whose occupancy differs after a compaction.
   *
   * ⚠ Bounded by the same observer reach as `setSlotContent`: a compaction that
   * shifts rows below the scene window shifts them unobserved.
   */
  private emitCompaction(before: boolean[][]): void {
    for (const [t, track] of this.tracks.entries()) {
      const was = before[t] ?? [];
      const rows = Math.max(was.length, track.slots.length);
      for (let s = 0; s < rows; s++) {
        const now = track.slots[s]?.hasContent ?? false;
        if ((was[s] ?? false) !== now && this.observes(track, s)) {
          this.pushContentEvent(track.channelId, s, now);
        }
      }
    }
  }

  /** What a container of this uuid ships with; `undefined` if it is not a container. */
  shippedChains(uuid: string): FakeChain[] | undefined {
    if (uuid === ProjectModel.FX_LAYER_UUID) {
      return [{
        name: ProjectModel.SHIPPED_CHAIN_NAME,
        mute: false,
        solo: false,
        volume: 1,
        pan: 0.5,
        color: { red: 0.341, green: 0.38, blue: 0.776 },
        id: this.mintChannelId(),
        devices: [],
      }];
    }
    return uuid === ProjectModel.INSTRUMENT_LAYER_UUID ? [] : undefined;
  }

  /**
   * ⚠⚠ `layer.select` + `Channel.duplicate()` (`e17ak`), as the fake models it.
   *
   * Three facts are modelled and each of them is load-bearing somewhere:
   *
   *   1. **The copy carries the SOURCE'S NAME.** That is what makes the
   *      container momentarily ambiguous, what forces the rename into the same
   *      verb, and what `mintedChain` exists to see through. A fake that named
   *      the copy something helpful would make the offline suite pass a create
   *      whose live readback cannot work.
   *   2. **It gets a FRESH id**, because it is a different object.
   *   3. **It lands directly after its source**, which is the reasonable
   *      expectation and is deliberately NOT what anything depends on — the
   *      identity diff would find it anywhere, and `M-chain` proves that by
   *      landing it elsewhere.
   *
   * ⚠ Devices are copied DEEP, so a copy of a chain holding devices holds its
   * own copies of them. Nothing in this slice can put a device in a chain, so
   * today every real copy is of an empty chain; the model is written for the
   * chain the fill verb will produce rather than for the one it can reach now.
   */
  duplicateChain(
    track: FakeTrack,
    containerIndex: number,
    sourceName: string,
  ): FakeChain | undefined {
    const chains = track.devices[containerIndex]?.chains;
    if (chains === undefined) return undefined;
    const at = chains.findIndex((c) => c.name === sourceName);
    const source = chains[at];
    if (at < 0 || source === undefined) return undefined;
    const copy: FakeChain = {
      name: source.name,
      mute: source.mute,
      solo: source.solo,
      volume: source.volume,
      pan: source.pan,
      ...(source.color === undefined ? {} : { color: { ...source.color } }),
      id: this.mintChannelId(),
      devices: source.devices.map((d) => ({ ...d, params: d.params.map((p) => ({ ...p })) })),
    };
    chains.splice(at + 1, 0, copy);
    return copy;
  }

  /**
   * Rename the chain with this WITHIN-SESSION id.
   *
   * ⚠ By id and not by name or position, and that is the whole point of the
   * two-step verb: at the moment this runs the container holds two chains under
   * one name, so a name-addressed rename could only pick between them by luck,
   * and a position-addressed one would depend on where the copy landed.
   */
  renameChain(track: FakeTrack, containerIndex: number, id: string, name: string): boolean {
    const hit = track.devices[containerIndex]?.chains?.find((c) => c.id === id);
    if (hit === undefined) return false;
    hit.name = name;
    return true;
  }

  /**
   * What the container scopes can SEE at one top-level device position — the
   * fake's half of `chain.inventory`.
   *
   * ⚠ `undefined` means the position is past `containerScopes`: no bank was ever
   * built there, so nothing was looked at. That is NOT the same as a position
   * holding no container, which is an observation and reports empty-and-complete.
   *
   * ⚠⚠ Completeness is `visible < bankSize`, never `<=`, and the asymmetry is
   * deliberate: the live enumeration omits empty bank slots, so a full bank and
   * an overflowing one produce byte-identical replies. A fake that reported a
   * dead-full bank as complete would answer `absent` where live must answer
   * `outside-bank-window` — the fake being the permissive one, which is the
   * direction PHASE-0 §Risks forbids.
   */
  observeContainer(track: FakeTrack, containerIndex: number): ObservedContainer | undefined {
    if (containerIndex < 0 || containerIndex >= this.containerScopes) return undefined;
    const held = track.devices[containerIndex]?.chains ?? [];
    const visible = held.slice(0, this.chainBankSize);
    return {
      chains: visible.map((c, index) => {
        const devices = c.devices.slice(0, this.chainDeviceBankSize);
        return {
          index,
          name: c.name,
          ...(c.mute === undefined ? {} : { mute: c.mute }),
          solo: c.solo,
          ...(c.volume === undefined ? {} : { volume: c.volume }),
          ...(c.pan === undefined ? {} : { pan: c.pan }),
          ...(c.color === undefined ? {} : { color: { ...c.color } }),
          // ⚠ Reported because live reports it (`chain.inventory` reads
          // `layer.channelId()`), and for one consumer only — `mintedChain`.
          // See `FakeChain.id`: it is a within-session witness, and nothing in
          // either adapter resolves an address through it.
          id: c.id,
          devices: devices.map((d, at) => ({ index: at, name: d.name })),
          devicesComplete: c.devices.length <= this.chainDeviceBankSize,
          devicesBankSize: this.chainDeviceBankSize,
        };
      }),
      chainsComplete: visible.length < this.chainBankSize,
      // ⚠ Reported for the guards that have to reason about a container two
      // creates from now — see `ObservedContainer.chainsBankSize`. The fake
      // carries the same number the rig does (`Rig.SLOT_LAYER_BANK`), because a
      // fake with a roomier bank would pass batches live Bitwig strands.
      chainsBankSize: this.chainBankSize,
    };
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
