/**
 * The encoder: contract `Op` -> wire frames, and wire results -> contract state.
 *
 * Pure. No socket, no adapter, no clock — given an op and a resolution context it
 * returns an array of frames, which means "does the contract emit the right
 * calls?" is answerable offline against a recording transport, with no Bitwig and
 * no fake modelling anything.
 *
 * THIS FILE IS WHERE THE SILENT-NO-OP TRAPS DIE. Each of these is a case where
 * the underlying API accepts the wrong call and does nothing, so the mitigation
 * has to be structural — a caller must not be able to express the wrong thing:
 *
 *   - `param.set` always sends `mode: 'immediate'`. A plain `value().set()` is
 *     swallowed by the controller take-over strategy: the value stayed at the
 *     preset default with no error (E4).
 *   - `directparam.set` always sends `resolution: 1`. At 128 the write silently
 *     did not land within 1.5s (E4b). Different API from the above, different
 *     trap, and it is the only path that works for CLAP plugins.
 *   - note properties are emitted in `NOTE_PROP_WRITE_ORDER`, and `pressure` is
 *     NOT AMONG THEM: the write never reaches the clip, it only populates the
 *     writing cursor's own NoteStep cache (E15-E). `assertOpsWritable` refuses it
 *     in the contract, so it cannot arrive here at all.
 *   - `device.insert` from a file is REFUSED unless the path is absolute and ends
 *     `.bwpreset`. A relative path, a wrong extension and a missing file are all
 *     silent no-ops — Bitwig dispatches on the filename, not the content, so
 *     byte-identical data named `.template` is simply ignored (E4h).
 *   - pointing uses track-then-slot, the only mechanism of three that works (E1).
 *
 * Time is beats throughout; the beats <-> step conversion happens here and only
 * here, which is what makes standing rule 12 ("the step grid is a per-operation
 * view, not global state") unbreakable by construction.
 */
import { isAbsolute, extname } from 'node:path';

import {
  BlindSpotError, InvalidOpError, assertNever, chooseStepSize, orderedNoteProps,
  type ChainAddress, type ClipAddress, type NoteRecord, type Op, type SceneAddress,
  type TrackAddress, type WindowCoverage,
} from '../../contract/index.js';
import { WIRE, frame, type Frame } from './wiremap.js';

// Re-exported because the grid used to be defined here, and because this is
// still the only module that turns one into a step index on a wire.
export { STEP_SIZES, chooseStepSize } from '../../contract/index.js';

/** What the encoder needs to know that an address alone cannot tell it. */
export interface EncodeContext {
  /**
   * Which pool cursor drives this clip — a pinned, non-following CursorTrack +
   * PinnableCursorClip pair, pre-allocated at init (E1, D7).
   *
   * ⚠ A FUNCTION rather than a single ref, and the reason is E15-F rather than
   * throughput: `cursor.setNoteProps` resolves its note against the clip that
   * cursor held at TURN START, so the generated props op must reach the same
   * cursor its create used or it silently loses everything. `CursorPool` keeps
   * the assignment stable for exactly that long. See `pool.ts`.
   */
  readonly cursorFor: (clip: ClipAddress) => string;
  /**
   * Whether this op must send the UI-selection-changing point frames.
   *
   * The live adapter can omit them when a prior independent read verified that
   * the same non-following cursor still owns this clip. Pure encoder callers do
   * not hold that live state, so absence means that pointing is required.
   */
  readonly shouldPointClip?: (clip: ClipAddress, cursor: string) => boolean;
  /**
   * Which pool cursor drives this TRACK's device chain.
   *
   * ⚠ Not the same thing as `trackIndex`, and conflating them is a wrong-chain
   * write rather than an error: every device handler resolves
   * `rig.cursorTrack(ref)` / `rig.cursorDeviceBanks[ref]` by POOL index, so a
   * bank row number passed as a cursor addresses whichever cursor shares that
   * number — and it reports `ok` either way.
   */
  readonly cursorForTrack: (track: TrackAddress) => string;
  /** channelId -> current bank index. Valid only until the next structural op. */
  readonly trackIndex: (track: TrackAddress) => number;
  /**
   * ⚠⚠ A chain -> the position its container reported it at, from an
   * observation THIS BATCH took.
   *
   * A function and not a field for the same reason `trackIndex` is one: it is
   * live state with a short life. A chain's bank position is not part of its
   * address — a chain is addressed by NAME (`ChainAddress`, E17ad/E18b) — so the
   * only place a position may come from is a `chain.inventory` reply, and the
   * only place it stays valid is the turn that read it. `LiveAdapter` fills this
   * from the observation its own preconditions already took, and it REFUSES
   * rather than guessing when a chain was never observed.
   */
  readonly chainIndex: (chain: ChainAddress) => number;
  /** Within-turn identity from the same container observation as `chainIndex`. */
  readonly chainId: (chain: ChainAddress) => string;
  /** Source name from the structural reading that immediately precedes relocation. */
  readonly deviceName?: (device: import('../../contract/index.js').DeviceAddress) => string;
  /** Absolute source position resolved from a complete tail-relative reading. */
  readonly deviceTailIndex?: (track: TrackAddress, fromEnd: number, expectedName: string) => number;
  /**
   * ⚠⚠ A scene ROW -> the index the bank will accept for it.
   *
   * A function, and a REFUSING one, because this file used to conflate two things
   * that are only accidentally equal. A `SceneAddress.index` is a position in the
   * project; `sceneBank.getScene(i)` and `ClipLauncherSlotBank.getItemAt(i)` are
   * positions in a WINDOW `config.scenes` wide. They agree exactly while the bank
   * sits at scroll position 0 and the row is inside it, and they agree on nothing
   * at all past that: `sceneBank.itemCount()` reports the PROJECT total (E15-A's
   * behaviour, measured for scenes in E21), so a row 99 of 99 went out on the wire
   * as bank index 99 and came back *"Parameter index (=99) must be in the range 0
   * to 16"* — from the middle of a batch, after earlier ops had landed
   * (`FINDINGS.md` E19).
   *
   * `apply` refuses such a batch before anything runs (`assertOpsAddressable`), so
   * reaching the throw here means a caller drove the encoder directly. It throws
   * anyway: the identity is only safe inside the window, and a pure function that
   * silently narrows its meaning at the edge is how the conflation got here.
   *
   * ⚠ Deliberately NOT a scroll. Scrolling would turn rule 5's refusal into a
   * retry loop and would need its own re-resolution discipline (D6) — session 3c
   * names it out of scope for exactly that reason.
   */
  readonly sceneRow: (scene: SceneAddress) => number;
}

/**
 * The one implementation of `sceneRow`, so an adapter cannot supply a laxer one.
 *
 * Identity while the bank does not scroll; a refusal past the window.
 */
export function sceneRowIn(scenes: WindowCoverage): (scene: SceneAddress) => number {
  return (scene) => {
    if (scene.index >= scenes.bankSize) throw new BlindSpotError('scenes', [scene], scenes.bankSize);
    return scene.index;
  };
}

/**
 * Point the pool cursor at a slot, then act — in the SAME request, deliberately.
 *
 * ⚠ Never point at an EMPTY slot: the cursor silently lands on the WRONG clip —
 * observed both staying on the previous clip and attaching to a different clip on
 * the target track — and in both cases `cursor.status` looks perfectly healthy
 * (E2). Every op that emits pointing therefore either creates the clip first or
 * is only valid against a clip the caller has already verified exists.
 *
 * ● Pointing and WRITING in one request is SOUND, measured in E15-D. This was
 * filed as a defect on the reasoning that pointing settles in ~25ms, so a write
 * issued in the same turn might land on the previous clip. It does not, and the
 * reason is an asymmetry worth stating once:
 *
 *     `selectChannel`/`selectSlot` retarget the cursor for the API calls that
 *     FOLLOW them in the same turn. What lags ~24ms is the OBSERVABLE state —
 *     `cursor.status`'s trackPosition and sceneIndex — not the target itself.
 *
 * Measured directly: park the cursor on clip A, then send point-B + `setNotes`
 * as one `batch.run` — the note lands in B and A is untouched. Same for
 * `clearNotes`, and for two different clips pointed and written in one batch.
 * So there is no `cursor.point` op and no point-hoisting in `planStages`: the
 * contract stays cursor-free, and one batch stays one turn (E8's 232x win).
 *
 * The rule that DOES bite is the mirror image, and it is on `note.props`, not
 * here: `cursor.setNoteProps` READS a `NoteStep` before mutating it, and a read
 * cannot see what the same turn (or the last ~120ms of grid change) did. That is
 * `OP_SETTLE_BEFORE` in the contract — see `encodeOp`'s `note.props` case.
 */
function pointFrames(
  cursor: string,
  trackIndex: number,
  sceneIndex: number,
  needed = true,
): Frame[] {
  if (!needed) return [];
  return [
    frame(WIRE.cursorPointTrack, { cursor, trackIndex }),
    frame(WIRE.slotSelect, { trackIndex, slotIndex: sceneIndex, mechanism: 'track' }),
  ];
}

/** Expression properties for one note, in the mandated write order. */
function notePropFrames(cursor: string, note: NoteRecord, x: number): Frame[] {
  // `orderedNoteProps` is the CONTRACT's ordering, shared with the fake — if the
  // mitigation lived only here, the two adapters would disagree about the same
  // op and the conformance suite could not be adapter-agnostic.
  const entries = orderedNoteProps(note);
  if (entries.length === 0) return [];
  const props: Record<string, unknown> = {};
  for (const [key, value] of entries) props[key] = value;
  // Gson preserves JsonObject insertion order and the Java handler iterates
  // params.keySet(), so this object's key order IS the write order on the device.
  return [frame(WIRE.cursorSetNoteProps, { cursor, x, y: note.pitch, props })];
}

function validateDeviceSource(op: Extract<Op, { op: 'device.insert' }>): void {
  const { source } = op;
  if (source.from !== 'file') return;
  if (!isAbsolute(source.path)) {
    throw new InvalidOpError('device.insert', `insertFile needs an ABSOLUTE path, got "${source.path}" (E4h)`);
  }
  if (extname(source.path) !== '.bwpreset') {
    throw new InvalidOpError(
      'device.insert',
      `insertFile dispatches on the FILENAME, not the content: "${source.path}" must end .bwpreset ` +
        'or Bitwig ignores it silently (E4h)',
    );
  }
}

/**
 * One op -> the frames that perform it.
 *
 * Frames within an op are ordered and must stay so; the batch executor runs them
 * in sequence inside a single control-surface turn.
 */
export function encodeOp(op: Op, ctx: EncodeContext): Frame[] {
  switch (op.op) {
    case 'note.write': {
      if (op.notes.length === 0) return [];
      const t = ctx.trackIndex(op.clip.slot.track);
      const s = ctx.sceneRow(op.clip.slot.scene);
      const stepSize = chooseStepSize(op.notes);
      const channel = op.channel ?? 0;
      // ● `setStepSize` immediately before `setNotes` in one request is SOUND
      // (E15-D): `setStep` is a pure write and is steered by the new grid at
      // once. Measured — x=2 sent on a cursor sitting at 1/16, with the grid
      // changed to 1/2 in the same batch, lands at beat 1.0 and not at 0.125.
      // Only the READING op (`note.props` below) has to wait for the grid.
      const cursor = ctx.cursorFor(op.clip);
      const frames: Frame[] = [
        ...pointFrames(cursor, t, s, ctx.shouldPointClip?.(op.clip, cursor) ?? true),
        frame(WIRE.cursorSetStepSize, { cursor, stepSize }),
        frame(WIRE.cursorSetNotes, {
          cursor,
          channel,
          notes: op.notes.map((n) => [
            Math.round(n.startBeats / stepSize),
            n.pitch,
            Math.round(n.velocity),
            n.durationBeats,
          ]),
        }),
      ];
      for (const note of op.notes) {
        frames.push(...notePropFrames(cursor, note, Math.round(note.startBeats / stepSize)));
      }
      return frames;
    }

    case 'note.props': {
      if (op.notes.length === 0) return [];
      const t = ctx.trackIndex(op.clip.slot.track);
      const s = ctx.sceneRow(op.clip.slot.scene);
      const stepSize = chooseStepSize(op.notes);
      // ⚠ These frames are safe only under TWO conditions, and they are
      // different conditions with different owners (E15-D).
      //
      // 1. `planStages` gives this op `settleBefore: 'gridChange'`, so the grid
      //    the PREVIOUS stage set has landed. `cursor.setNoteProps` resolves
      //    `clip.getStep(channel, x, y)` and mutates what comes back, and that
      //    read is unusable for ~120ms after a `setStepSize` — every property
      //    written into the window is discarded with no error and no failed op
      //    in the batch result. Measured: 0 of 3 landed at gaps of
      //    0/24/48/72/96ms, 3 of 3 at 120/144/192/288ms.
      // 2. `stepSize` here must EQUAL the grid the cursor is already on, so the
      //    call below is a no-op rather than a change. A settle in front cannot
      //    help with a change made inside this very turn. For a props op that
      //    `splitNoteWrite` generated this holds by construction, because it
      //    carries the same note set as its create — see `stages.ts`. For a props
      //    op a CALLER wrote it is the caller's problem, and today an unmet one:
      //    a bare `note.props` whose grid differs from whatever the pool cursor
      //    was left on loses everything, silently. Not reachable through
      //    `note.write`, but not refused either. → recorded for Phase 1.
      //
      // Sending the grid at all is what makes `x` mean the same thing it meant in
      // the create stage.
      // ⚠ The SAME cursor its create used, guaranteed by `CursorPool` keeping
      // the assignment stable. The live adapter omits the point frames when an
      // earlier read verified that the non-following cursor still owns this
      // clip. The turn then begins on the clip the lookup needs (E15-F).
      const cursor = ctx.cursorFor(op.clip);
      const frames: Frame[] = [
        ...pointFrames(cursor, t, s, ctx.shouldPointClip?.(op.clip, cursor) ?? true),
        frame(WIRE.cursorSetStepSize, { cursor, stepSize }),
      ];
      // Deliberately NO setNotes here: re-issuing setStep would reset the very
      // properties the preceding stage just wrote.
      for (const note of op.notes) {
        frames.push(...notePropFrames(cursor, note, Math.round(note.startBeats / stepSize)));
      }
      return frames;
    }

    case 'note.clear': {
      const t = ctx.trackIndex(op.clip.slot.track);
      const s = ctx.sceneRow(op.clip.slot.scene);
      const cursor = ctx.cursorFor(op.clip);
      return [
        ...pointFrames(cursor, t, s, ctx.shouldPointClip?.(op.clip, cursor) ?? true),
        frame(WIRE.cursorClearNotes, { cursor }),
      ];
    }

    case 'clip.create':
      return [
        frame(WIRE.clipCreate, {
          trackIndex: ctx.trackIndex(op.slot.track),
          slotIndex: ctx.sceneRow(op.slot.scene),
          lengthBeats: op.lengthBeats,
        }),
      ];

    case 'clip.delete':
      return [
        frame(WIRE.slotDelete, {
          trackIndex: ctx.trackIndex(op.slot.track),
          slotIndex: ctx.sceneRow(op.slot.scene),
        }),
      ];

    case 'clip.duplicate':
      return [frame(WIRE.slotDuplicateClip, {
        trackIndex: ctx.trackIndex(op.source.slot.track),
        slotIndex: ctx.sceneRow(op.source.slot.scene),
        route: 'slot',
      })];

    case 'clip.move':
      return [frame(WIRE.slotMoveTo, {
        trackIndex: ctx.trackIndex(op.source.slot.track),
        slotIndex: ctx.sceneRow(op.source.slot.scene),
        toTrackIndex: ctx.trackIndex(op.destination.track),
        toSlotIndex: ctx.sceneRow(op.destination.scene),
        route: 'insertionPoint',
      })];

    case 'clip.launch':
      return [frame(WIRE.slotLaunchWithOptions, {
        trackIndex: ctx.trackIndex(op.clip.slot.track),
        slotIndex: ctx.sceneRow(op.clip.slot.scene),
        quantization: op.quantization,
        launchMode: op.mode,
      })];

    case 'clip.launchSettings': {
      const t = ctx.trackIndex(op.clip.slot.track);
      const s = ctx.sceneRow(op.clip.slot.scene);
      const cursor = ctx.cursorFor(op.clip);
      return [
        ...pointFrames(cursor, t, s),
        frame(WIRE.cursorSetLaunchSettings, {
          cursor,
          launchQuantization: op.quantization,
          launchMode: op.mode,
          useLoopStartAsQuantizationReference: op.useLoopStartAsQuantizationReference,
        }),
      ];
    }

    case 'track.create':
      // `position` is a REQUEST, not a promise: createInstrumentTrack does not
      // honour bank positions (asking for 9 landed at 7, asking for 0 landed at
      // 1), so the caller must diff the bank by channelId afterwards (E2c). The
      // receipt's `minted` map is where that lands.
      return [frame(WIRE.trackCreate, { position: -1 })];

    case 'track.duplicate':
      return [frame(WIRE.trackDuplicate, {
        trackIndex: ctx.trackIndex(op.track),
        expectedChannelId: op.track.channelId,
        route: 'channelDuplicate',
      })];

    case 'track.rename':
      return [frame(WIRE.trackSetName, { trackIndex: ctx.trackIndex(op.track), name: op.name })];

    case 'track.delete':
      return [frame(WIRE.trackDelete, { trackIndex: ctx.trackIndex(op.track) })];

    case 'scene.create':
      return [frame(WIRE.sceneCreate, { count: op.count })];

    case 'scene.delete':
      return [frame(WIRE.sceneDelete, { sceneIndex: ctx.sceneRow(op.scene) })];

    // ⚠ POINT, THEN ACT — and it is not the clip pointing above. Every device
    // handler operates on `rig.cursorTrack(cursor)` / `rig.cursorDeviceBanks[cursor]`,
    // i.e. on whatever track THAT POOL CURSOR is pointed at, and the insert
    // handlers say so outright: *"The cursor must already be pointed at the target
    // track."* Both ops used to send a bank row number instead — `device.insert`
    // under a `trackIndex` key the handler never reads (`params.get("cursor")`
    // would be null), and `device.delete` under a `cursor` key holding a track
    // index, which addresses whichever cursor shares that number and deletes from
    // its chain. The point frame is what makes the address mean the track it names.
    //
    // ⚠ `cursor.pointTrack` is `CursorTrack.selectChannel`, which SETS the UI
    // selection — so device ops borrow the user's selection exactly the way note
    // ops do, and the adapter's capture/restore covers them for that reason.
    //
    // No `slot.select`: a device chain hangs off the CursorTrack, so there is
    // nothing to gain from pointing at a slot and E2's empty-slot trap to lose.
    case 'device.insert': {
      validateDeviceSource(op);
      const cursor = ctx.cursorForTrack(op.track);
      const point = frame(WIRE.cursorPointTrack, { cursor, trackIndex: ctx.trackIndex(op.track) });
      switch (op.source.from) {
        case 'bitwig':
          return [point, frame(WIRE.deviceInsertBitwig, { cursor, uuid: op.source.uuid })];
        case 'clap':
          return [point, frame(WIRE.deviceInsertClap, { cursor, clapId: op.source.uuid })];
        case 'file':
          return [point, frame(WIRE.deviceInsertFile, { cursor, path: op.source.path })];
      }
      break;
    }

    // ⚠⚠ Both guards, and the DURABLE one is the load-bearing half.
    //
    // The point frame above resolves a track by BANK ROW, out of the last scan
    // (`LiveAdapter.trackIndex`). A track added, removed or reordered since then
    // moves every row below it, so the same number aims the cursor at a
    // different track — and `expectedName` cannot notice, because it guards a
    // DEVICE name and container names repeat across tracks ("FX Layer" on two
    // tracks is the ordinary case, not the contrived one). The result would be a
    // deletion nobody addressed, on a track nobody named, reported `ok`.
    //
    // `device.relocate` already sends `expectedTrackChannelId` for exactly this
    // reason; a delete is the one that cannot be taken back afterwards, so it
    // carries the same guard. Derived from the address rather than added to the
    // op: the durable id is already part of every `DeviceAddress`.
    case 'device.delete': {
      const cursor = ctx.cursorForTrack(op.device.track);
      return [
        frame(WIRE.cursorPointTrack, { cursor, trackIndex: ctx.trackIndex(op.device.track) }),
        frame(WIRE.deviceDelete, {
          cursor,
          deviceIndex: op.device.chainIndex,
          expectedTrackChannelId: op.device.track.channelId,
          ...(op.expectedName === undefined ? {} : { expectedName: op.expectedName }),
        }),
      ];
    }

    case 'device.relocate': {
      const cursor = ctx.cursorForTrack(op.track);
      const sourceIndex = ctx.deviceTailIndex?.(op.track, op.sourceFromEnd, op.expectedName);
      if (sourceIndex === undefined) {
        throw new InvalidOpError(op.op, 'no fresh complete reading resolved the tail-relative source');
      }
      return [
        frame(WIRE.cursorPointTrack, { cursor, trackIndex: ctx.trackIndex(op.track) }),
        frame(WIRE.deviceMoveTo, {
          cursor,
          deviceIndex: sourceIndex,
          where: 'before',
          anchorIndex: op.before.chainIndex,
          expectedTrackChannelId: op.track.channelId,
          expectedSourceName: op.expectedName,
          expectedAnchorName: ctx.deviceName?.(op.before),
        }),
      ];
    }

    // ⚠⚠ ONE FRAME, and the op is not finished when it returns. `chain.create`
    // is the only op in the union whose second half cannot be encoded: the
    // rename has to name the chain the duplicate produced, and nothing knows
    // which one that is until the container has been observed AGAIN, in a later
    // request (E2 — a write is not visible to a read in the same one). So the
    // encoder emits the copy and `LiveAdapter.apply` brackets the stage with the
    // two observations and the rename, the same shape `device.insert`'s mint
    // already has and for the same reason.
    //
    // ⚠ NO POINT FRAME, and its absence is deliberate. `chain.duplicate` reads
    // `Rig.slotLayerBanks`, which hang off `cursorDeviceBanks[0]` on the track
    // `cursorTracks[0]` points at — and a bank RE-SCOPE is not a same-turn
    // effect the way a cursor retarget is. A point in this request would look
    // like a precondition while guaranteeing nothing. The load-bearing point is
    // the settled one `containerScope` makes immediately before this stage, and
    // the identity guard on its reply is what proves it landed.
    case 'chain.create':
      return [frame(WIRE.chainDuplicate, {
        slot: op.source.container.chainIndex,
        layerIndex: ctx.chainIndex(op.source),
        // ⚠ Sent so the extension can refuse a chain that is not the one we
        // observed. The index is a bank position and a bank re-indexes; the
        // handler compares this against `layer.name().get()` before it selects
        // anything, which turns a stale position into an error instead of a copy
        // of somebody else's chain.
        expectedName: op.source.name,
      })];

    case 'chain.rename':
      return [frame(WIRE.chainSetName, {
        slot: op.chain.container.chainIndex,
        channelId: ctx.chainId(op.chain),
        name: op.name,
      })];

    case 'chain.relocate': {
      const sourceChain = op.source.chain;
      const destinationChain = op.destination.kind === 'chain' ? op.destination : undefined;
      return [frame(WIRE.chainMove, {
        src: sourceChain === undefined ? 'top' : 'chain',
        srcDevice: op.source.chainIndex,
        ...(sourceChain === undefined ? {} : {
          srcSlot: sourceChain.container.chainIndex,
          srcLayer: ctx.chainIndex(sourceChain),
          expectedSourceChain: sourceChain.name,
        }),
        dst: destinationChain === undefined ? 'top' : 'chain',
        ...(destinationChain === undefined ? { where: 'chainEnd' } : {
          dstSlot: destinationChain.container.chainIndex,
          dstLayer: ctx.chainIndex(destinationChain),
          expectedDestinationChain: destinationChain.name,
        }),
        verb: op.mode,
        expectedTrackChannelId: op.source.track.channelId,
        expectedSourceName: ctx.deviceName?.(op.source),
      })];
    }

    case 'chain.activate':
      return [frame(WIRE.chainActivate, {
        slot: op.chain.container.chainIndex,
        layerIndex: ctx.chainIndex(op.chain),
        expectedName: op.chain.name,
        expectedTrackChannelId: op.chain.container.track.channelId,
      })];

    case 'param.set':
      // ⚠ Two different APIs, two different traps. Neither is selectable by the
      // caller, because the wrong choice is a SILENT no-op in both directions.
      return op.param.directId !== undefined
        ? [frame(WIRE.directParamSet, { id: op.param.directId, value: op.value, resolution: 1 })]
        : [frame(WIRE.paramSet, { index: op.param.index, value: op.value, mode: 'immediate' })];

    case 'notify':
      return [frame(WIRE.notify, { message: op.message })];

    default:
      return assertNever(op, 'encodeOp');
  }
  return assertNever(op as never, 'encodeOp');
}

/**
 * A whole stage as ONE `batch.run` request — the 232x lever (E8). `verbose` is
 * always on: the wire only returns per-op results when asked, and §8c requires a
 * report of what applied and what did not.
 */
export function encodeStage(ops: readonly Op[], ctx: EncodeContext, ifRevision?: number): Frame {
  const wireOps = ops.flatMap((op) => encodeOp(op, ctx)).map((f) => ({ method: f.method, params: f.params ?? {} }));
  const params: Record<string, unknown> = { ops: wireOps, verbose: true };
  if (ifRevision !== undefined) params['ifRevision'] = ifRevision;
  return frame(WIRE.batchRun, params);
}

/** Wire note tuple `[x, y, velocity, duration]` -> a contract note, in beats. */
export function decodeNote(tuple: readonly number[], stepSize: number): NoteRecord {
  const [x = 0, y = 0, velocity = 0, duration = 0] = tuple;
  return { startBeats: x * stepSize, pitch: y, velocity, durationBeats: duration };
}

/**
 * A `cursor.getNotesVerbose` step -> a contract note, expression properties and
 * all.
 *
 * ⚠ Only properties that were actually SET come back meaningfully; Bitwig
 * reports a default for every one of them. Carrying all 19 defaults into every
 * snapshot would make each one look like it set gain (and so degrade every take
 * to `lossy`, D5), so a property equal to its documented default is dropped.
 * `velocity` is renormalised to the 0-127 the write side uses.
 */
export function decodeVerboseNote(step: Record<string, number | boolean | string>, stepSize: number): NoteRecord {
  const num = (k: string, fallback = 0): number => (typeof step[k] === 'number' ? (step[k] as number) : fallback);
  const bool = (k: string): boolean => step[k] === true;

  const note: Record<string, unknown> = {
    startBeats: num('x') * stepSize,
    pitch: num('y'),
    velocity: Math.round(num('velocity') * 127),
    durationBeats: num('duration'),
  };

  // ⚠ `gain` defaults to 0, not to the 0.5 this table used to claim (E15-D,
  // measured on a freshly created note with no property ever written to it).
  // The old value made EVERY note look like it had set gain, so every live
  // snapshot degraded to `lossy` while the fake reported `exact` — a fake/live
  // divergence that the conformance suite could not see, because the only case
  // asserting the label wrote gain explicitly.
  const DEFAULTS: Record<string, number | boolean | string> = {
    releaseVelocity: 0, velocitySpread: 0, gain: 0, pan: 0, pressure: 0, timbre: 0,
    transpose: 0, chance: 1, isChanceEnabled: false, isMuted: false,
    isOccurrenceEnabled: false, occurrence: 'ALWAYS', isRecurrenceEnabled: false,
    isRepeatEnabled: false, repeatCount: 0, repeatCurve: 0,
    repeatVelocityCurve: 0, repeatVelocityEnd: 0,
  };
  for (const [key, fallback] of Object.entries(DEFAULTS)) {
    const value = typeof fallback === 'boolean' ? bool(key) : step[key];
    if (value !== undefined && value !== fallback) note[key] = value;
  }
  if (bool('isRecurrenceEnabled')) {
    note['recurrence'] = [num('recurrenceLength'), num('recurrenceMask')] as const;
  }
  return note as unknown as NoteRecord;
}
