/**
 * Encoder frame assertions — the Class-A trap tests.
 *
 * Some Bitwig traps cannot usefully be modelled in the fake, because the fake
 * would have to accept a call it then ignores, and nothing could ever trigger
 * that path: the encoder has no `set` branch and no `invokeAction` variant, so
 * the wrong call is unreachable by construction. For those, the real test is
 * "given this op, exactly these frames come out" — which needs no adapter, no
 * socket and no DAW, because frames are plain data.
 *
 * Test ids map to the finding each one guards:
 *   E-immediate   E4    param writes must be setImmediately, never set
 *   E-resolution  E4b   DirectParameter writes must carry resolution=1
 *   E-pressure    E15-E pressure is never written — the API discards it
 *   E-insertfile  E4h   insertFile needs an absolute path and a .bwpreset name
 *   E-grid        E2    beats -> steps, and off-grid positions are refused
 *   E-point       E1/E2 track-then-slot pointing, never at an unverified slot
 *   E-batch       E8    a stage is ONE batch.run carrying N ops, verbose
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BlindSpotError, InvalidOpError, assertOpsWritable, chain as chainAt, clip, device, deviceIn, param,
  scene, slot, track,
  type NoteRecord, type Op, type TrackAddress,
} from '../../contract/index.js';
import {
  chooseStepSize, encodeOp, encodeStage, sceneRowIn, type EncodeContext,
} from './encoder.js';
import { CursorPool } from './pool.js';
import { WIRE, type Frame } from './wiremap.js';

const TRACK_A = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const TRACK_B = track('c07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const CLIP_B = clip(slot(TRACK_B, scene(0, 1)));
const SCENE_0 = scene(0, 1);
const CLIP_A = clip(slot(TRACK_A, SCENE_0));

/** The default rig's scene window, so the cases below sit comfortably inside it. */
const SCENE_WINDOW = { count: 8, bankSize: 16 } as const;

/** A one-cursor pool — the Phase-0 shape, so the cases below read unchanged. */
const ctx: EncodeContext = {
  cursorFor: () => '0',
  cursorForTrack: () => '0',
  trackIndex: (t: TrackAddress) => (t.channelId === TRACK_A.channelId ? 3 : (t.channelId === TRACK_B.channelId ? 4 : -1)),
  // ⚠ Stands in for the observation `LiveAdapter` takes before the batch. Two
  // named chains, at positions that are NOT 0 and 1, so a frame carrying an
  // array offset or a hardcoded zero fails here rather than live.
  chainIndex: (c) => (c.name === 'A take' ? 2 : (c.name === 'B take' ? 3 : -1)),
  chainId: (c) => `id-${c.name}`,
  deviceName: () => 'Polysynth',
  deviceTailIndex: () => 5,
  sceneRow: sceneRowIn(SCENE_WINDOW),
};

const methods = (frames: readonly Frame[]) => frames.map((f) => f.method);
const paramsOf = (frames: readonly Frame[], method: string) =>
  frames.find((f) => f.method === method)?.params as Record<string, unknown> | undefined;

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

// --- 3e: the measured clip primitives --------------------------------------

test('E-clip-block: copy, move, launch and settings encode only measured routes', () => {
  const destination = slot(TRACK_A, scene(1, 1));

  const copied = encodeOp({
    op: 'clip.duplicate', source: CLIP_A, destination,
  }, ctx);
  assert.deepEqual(copied, [{
    method: WIRE.slotDuplicateClip,
    params: { trackIndex: 3, slotIndex: 0, route: 'slot' },
  }]);

  const moved = encodeOp({ op: 'clip.move', source: CLIP_A, destination }, ctx);
  assert.deepEqual(moved, [{
    method: WIRE.slotMoveTo,
    params: {
      trackIndex: 3, slotIndex: 0, toTrackIndex: 3, toSlotIndex: 1,
      route: 'insertionPoint',
    },
  }]);

  const launched = encodeOp({
    op: 'clip.launch', clip: CLIP_A, quantization: '1', mode: 'continue_or_synced',
  }, ctx);
  assert.deepEqual(launched, [{
    method: WIRE.slotLaunchWithOptions,
    params: {
      trackIndex: 3, slotIndex: 0, quantization: '1', launchMode: 'continue_or_synced',
    },
  }]);

  const settings = encodeOp({
    op: 'clip.launchSettings',
    clip: CLIP_A,
    quantization: '1',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  }, ctx);
  assert.deepEqual(methods(settings), [
    WIRE.cursorPointTrack, WIRE.slotSelect, WIRE.cursorSetLaunchSettings,
  ]);
  assert.deepEqual(paramsOf(settings, WIRE.cursorSetLaunchSettings), {
    cursor: '0',
    launchQuantization: '1',
    launchMode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
});

test('E-clip-meta: complete metadata uses one measured writer with byte colour (E43)', () => {
  const frames = encodeOp({
    op: 'clip.update', clip: CLIP_A,
    metadata: {
      name: 'gn-take', color: { red: 31, green: 159, blue: 223 },
      lengthBeats: 9, playStartBeats: 2, loopEnabled: true,
      loopStartBeats: 1, loopEndBeats: 10,
    },
  }, ctx);
  assert.deepEqual(methods(frames), [
    WIRE.cursorPointTrack, WIRE.slotSelect, WIRE.cursorSetClipMetadata,
  ]);
  assert.deepEqual(paramsOf(frames, WIRE.cursorSetClipMetadata), {
    cursor: '0', name: 'gn-take', colorBytes: [31, 159, 223],
    lengthBeats: 9, playStartBeats: 2, loopEnabled: true,
    loopStartBeats: 1, loopEndBeats: 10,
  });
});

test('E-track-copy: duplication carries the source durable identity', () => {
  assert.deepEqual(encodeOp({ op: 'track.duplicate', track: TRACK_A }, ctx), [{
    method: WIRE.trackDuplicate,
    params: {
      trackIndex: 3,
      expectedChannelId: TRACK_A.channelId,
      route: 'channelDuplicate',
    },
  }]);
});

// --- E4 / E4b: the two parameter APIs, two different silent-no-op traps ------

test('E-immediate: a typed param write is ALWAYS setImmediately, never set (E4)', () => {
  const op: Op = { op: 'param.set', param: param(device(TRACK_A, 0), 5), value: 0.7 };
  const frames = encodeOp(op, ctx);
  assert.deepEqual(methods(frames), [WIRE.paramSet]);
  // A plain value().set() is swallowed by the controller take-over strategy: the
  // value stayed at the preset default with no error at all (E4).
  assert.equal(paramsOf(frames, WIRE.paramSet)?.['mode'], 'immediate');
});

test('E-resolution: a DirectParameter write ALWAYS carries resolution=1 (E4b)', () => {
  const op: Op = {
    op: 'param.set',
    param: param(device(TRACK_A, 0), 0, 'gain-l'),
    value: 0.25,
  };
  const frames = encodeOp(op, ctx);
  assert.deepEqual(methods(frames), [WIRE.directParamSet]);
  const p = paramsOf(frames, WIRE.directParamSet)!;
  // resolution=128 did NOT land within 1.5s and reported no error (E4b).
  assert.equal(p['resolution'], 1);
  assert.equal(p['id'], 'gain-l');
  assert.equal(p['value'], 0.25);
});

test('E-immediate: neither param path is caller-selectable', () => {
  // The op union has no `mode` and no `resolution` field, so there is no way to
  // express the swallowed variant. This asserts the *shape*, which is the actual
  // guarantee — the tests above only check today's encoder.
  const op = { op: 'param.set', param: param(device(TRACK_A, 0), 1), value: 0.5 } satisfies Op;
  assert.ok(!('mode' in op) && !('resolution' in op));
});

// --- E15-E: pressure never reaches the wire ---------------------------------

test('E-pressure: no frame ever carries pressure, whatever the caller asks for (E15-E)', () => {
  // ⚠ The inverse of what this test used to assert. E2/e02e read "gain and
  // timbre zero pressure" and the encoder answered by emitting pressure LAST.
  // E15-E measured that `setPressure` never reaches the clip at all: the value
  // lives in the writing cursor's own NoteStep cache, is invisible to every
  // other cursor, and vanishes when that cursor is re-pointed. Emitting it is
  // worse than useless — a snapshot taken through the writing cursor would read
  // the phantom back as real. `assertOpsWritable` refuses it before the encoder
  // is reached; this asserts the encoder could not emit it even if it were not.
  const frames = encodeOp(
    { op: 'note.props', clip: CLIP_A, notes: [note({ gain: 0.7, timbre: 0.3, pressure: 0.9, pan: 0.1 })] },
    ctx,
  );
  const props = paramsOf(frames, WIRE.cursorSetNoteProps)?.['props'] as Record<string, unknown>;
  assert.ok(!('pressure' in props), `pressure must never be emitted: ${Object.keys(props)}`);
  // Gson preserves insertion order and the handler iterates keySet(), so this
  // object's key order IS the write order on the device.
  assert.deepEqual(Object.keys(props), ['pan', 'gain', 'timbre']);
});

test('E-pressure: a write that asks for pressure is REFUSED by the contract (E15-E)', () => {
  assert.throws(
    () => assertOpsWritable([{ op: 'note.write', clip: CLIP_A, notes: [note({ pressure: 0.9 })] }]),
    InvalidOpError,
  );
});

test('E-pressure: a note with no expression props emits no setNoteProps at all', () => {
  const frames = encodeOp({ op: 'note.write', clip: CLIP_A, notes: [note()] }, ctx);
  assert.ok(!methods(frames).includes(WIRE.cursorSetNoteProps));
});

test('note properties keep the requested MIDI channel', () => {
  const frames = encodeOp(
    { op: 'note.props', clip: CLIP_A, channel: 12, notes: [note({ pan: 0.5 })] },
    ctx,
  );
  assert.equal(paramsOf(frames, WIRE.cursorSetNoteProps)?.['channel'], 12);
});

test('2i follow-up: a settled property page emits only page-local reads', () => {
  const frames = encodeOp({
    op: 'note.props', clip: CLIP_A,
    notes: [
      note({ startBeats: 1, durationBeats: 1 / 64, pan: 0.25 }),
      note({ startBeats: 9, pitch: 64, durationBeats: 1 / 64, pan: -0.25 }),
    ],
  }, {
    ...ctx,
    shouldPointClip: () => false,
    writerSteps: 512,
    writerPageStart: 512,
  });

  assert.deepEqual(methods(frames), [WIRE.cursorSetStepSize, WIRE.cursorSetNoteProps]);
  assert.equal(paramsOf(frames, WIRE.cursorSetNoteProps)?.['x'], 64);
  assert.equal(paramsOf(frames, WIRE.cursorSetNoteProps)?.['y'], 64);
});

// --- E4h: insertFile's three silent failure modes ---------------------------

test('E-insertfile: a relative path is refused before any frame is emitted (E4h)', () => {
  assert.throws(
    () => encodeOp({ op: 'device.insert', track: TRACK_A, source: { from: 'file', path: 'presets/x.bwpreset' } }, ctx),
    InvalidOpError,
  );
});

test('E-insertfile: a non-.bwpreset extension is refused (E4h)', () => {
  // Bitwig dispatches on the FILENAME, not the content: byte-identical data named
  // .template is ignored, silently.
  assert.throws(
    () => encodeOp({ op: 'device.insert', track: TRACK_A, source: { from: 'file', path: '/tmp/x.template' } }, ctx),
    InvalidOpError,
  );
});

test('E-insertfile: an absolute .bwpreset path is accepted', () => {
  const frames = encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'file', path: '/tmp/gn/lfo.bwpreset' } },
    ctx,
  );
  assert.deepEqual(methods(frames), [WIRE.cursorPointTrack, WIRE.deviceInsertFile]);
  assert.equal(paramsOf(frames, WIRE.deviceInsertFile)?.['path'], '/tmp/gn/lfo.bwpreset');
});

test('E-chain: a create names its container by SLOT and its source by OBSERVED position', () => {
  // ⚠ The whole reason `chainIndex` is a context function. A chain is addressed
  // by NAME (E17ad, E18b), so its bank position exists nowhere in the address —
  // the only honest source is a `chain.inventory` reply, and the encoder must
  // take it from one rather than deriving anything.
  const source = chainAt(device(TRACK_A, 1), 'A take');
  const frames = encodeOp({ op: 'chain.create', source, name: 'B take' }, ctx);

  assert.deepEqual(methods(frames), [WIRE.chainDuplicate],
    'ONE frame: the rename cannot be encoded, because nothing yet knows which chain to rename');
  const params = paramsOf(frames, WIRE.chainDuplicate);
  // ⚠ `slot` is the CONTAINER's position in the track's own device chain, and
  // `layerIndex` is the source chain's position inside that container. Two
  // different numbers at two different levels; the stub answers 2 for this
  // chain, so a frame that reused the container's 1 fails here.
  assert.equal(params?.['slot'], 1);
  assert.equal(params?.['layerIndex'], 2);
  // ⚠ Carried so the extension can refuse a position that re-indexed since it
  // was observed, instead of copying whatever slid into it (E3, one level down).
  assert.equal(params?.['expectedName'], 'A take');
  // ⚠ And NO cursor and NO trackIndex: these banks hang off `cursorTracks[0]`
  // via the slot scopes, and the load-bearing point is the settled one the
  // adapter makes in an earlier request. A point in this frame would look like a
  // precondition while guaranteeing nothing.
  assert.equal(params?.['cursor'], undefined);
  assert.equal(params?.['trackIndex'], undefined);
});

test('E-chain: a source nobody observed is REFUSED, never given a guessed position', () => {
  const unseen = chainAt(device(TRACK_A, 0), 'never enumerated');
  assert.equal(ctx.chainIndex(unseen), -1, 'the stub reports "no observation" as -1');
  // The real context throws; this asserts the shape the encoder passes through,
  // so a future default of 0 would show up as a frame aimed at the first chain.
  const frames = encodeOp({ op: 'chain.create', source: unseen, name: 'B' }, ctx);
  assert.equal(paramsOf(frames, WIRE.chainDuplicate)?.['layerIndex'], -1,
    'whatever the context says is what goes out — the encoder invents no position');
});

test('E-chain-rename: a durable name write targets the freshly observed identity', () => {
  const source = chainAt(device(TRACK_A, 1), 'A take');
  const frames = encodeOp({ op: 'chain.rename', chain: source, name: 'Original' }, ctx);
  assert.deepEqual(methods(frames), [WIRE.chainSetName]);
  const params = paramsOf(frames, WIRE.chainSetName);
  assert.equal(params?.['slot'], 1);
  assert.equal(params?.['channelId'], 'id-A take');
  assert.equal(params?.['name'], 'Original');
  assert.equal(params?.['layerIndex'], undefined, 'a position is never the rename identity');
});

test('E-chain-relocate: all directions use one guarded slot-scoped mover', () => {
  const a = chainAt(device(TRACK_A, 0), 'A take');
  const b = chainAt(device(TRACK_A, 1), 'B take');
  const cases: Op[] = [
    { op: 'chain.relocate', source: device(TRACK_A, 1), destination: a, mode: 'move' },
    { op: 'chain.relocate', source: deviceIn(a, 0), destination: TRACK_A, mode: 'move' },
    { op: 'chain.relocate', source: deviceIn(a, 0), destination: b, mode: 'copy' },
  ];
  const params = cases.map((op) => paramsOf(encodeOp(op, ctx), WIRE.chainMove));
  assert.deepEqual(params.map((value) => [value?.['src'], value?.['dst'], value?.['verb']]), [
    ['top', 'chain', 'move'], ['chain', 'top', 'move'], ['chain', 'chain', 'copy'],
  ]);
  assert.equal(params[0]?.['dstLayer'], 2);
  assert.equal(params[1]?.['srcLayer'], 2);
  assert.equal(params[2]?.['dstLayer'], 3);
  for (const value of params) {
    assert.equal(value?.['expectedTrackChannelId'], TRACK_A.channelId);
    assert.equal(value?.['expectedSourceName'], 'Polysynth');
  }
});

test('E-chain-activate: exclusive switching carries stable identity guards', () => {
  const target = chainAt(device(TRACK_A, 1), 'B take');
  const frames = encodeOp({ op: 'chain.activate', chain: target }, ctx);
  assert.deepEqual(methods(frames), [WIRE.chainActivate]);
  const params = paramsOf(frames, WIRE.chainActivate);
  assert.equal(params?.['slot'], 1);
  assert.equal(params?.['layerIndex'], 3);
  assert.equal(params?.['expectedName'], 'B take');
  assert.equal(params?.['expectedTrackChannelId'], TRACK_A.channelId);
});

test('E-device-relocate: a fresh tail source and before-anchor carry identity guards', () => {
  const before = device(TRACK_A, 1);
  const frames = encodeOp({
    op: 'device.relocate',
    track: TRACK_A,
    sourceFromEnd: 0,
    expectedName: 'Polysynth',
    before,
  }, ctx);
  assert.deepEqual(methods(frames), [WIRE.cursorPointTrack, WIRE.deviceMoveTo]);
  const params = paramsOf(frames, WIRE.deviceMoveTo);
  assert.equal(params?.['deviceIndex'], 5);
  assert.equal(params?.['anchorIndex'], 1);
  assert.equal(params?.['where'], 'before');
  assert.equal(params?.['expectedTrackChannelId'], TRACK_A.channelId);
  assert.equal(params?.['expectedSourceName'], 'Polysynth');
  assert.equal(params?.['expectedAnchorName'], 'Polysynth');
});

test('E-device-delete: a removal carries the durable track identity, not just a position', () => {
  // ⚠ The positional cursor is the whole hazard. `trackIndex` is a BANK ROW from
  // the last scan, so a track added, removed or reordered since retargets the
  // point — and an expected DEVICE name alone cannot notice, because container
  // names repeat across tracks. `device.relocate` already sends the durable id;
  // a delete is the one that cannot be taken back, so it must too.
  const frames = encodeOp({
    op: 'device.delete', device: device(TRACK_A, 2), expectedName: 'FX Layer',
  }, ctx);
  const params = paramsOf(frames, WIRE.deviceDelete);
  assert.equal(params?.['expectedTrackChannelId'], TRACK_A.channelId);
  assert.equal(params?.['expectedName'], 'FX Layer');
  assert.equal(params?.['deviceIndex'], 2);
});

test('E-device: a device op POINTS a cursor at its track, and addresses that cursor', () => {
  // ⚠ The bug this locks out is silent, not loud. Every device handler resolves
  // `rig.cursorTrack(cursor)` / `rig.cursorDeviceBanks[cursor]` by POOL index, so
  // the old encoding — a bank row number under a `trackIndex` key the insert
  // handler never reads, and under a `cursor` key the delete handler reads as a
  // pool ref — either threw inside the extension or deleted from a different
  // track's chain while reporting `ok`.
  const pool = new CursorPool(3);
  const poolCtx: EncodeContext = {
    ...ctx,
    cursorForTrack: (t) => pool.cursorForTrack(t),
  };

  const inserted = encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'bitwig', uuid: 'abc' } },
    poolCtx,
  );
  assert.deepEqual(methods(inserted), [WIRE.cursorPointTrack, WIRE.deviceInsertBitwig]);
  const cursor = paramsOf(inserted, WIRE.cursorPointTrack)?.['cursor'];
  // The point names the BANK ROW; the op names the CURSOR. Two different numbers
  // that happened to be spelled the same way before.
  assert.equal(paramsOf(inserted, WIRE.cursorPointTrack)?.['trackIndex'], 3);
  assert.equal(paramsOf(inserted, WIRE.deviceInsertBitwig)?.['cursor'], cursor);
  assert.equal(paramsOf(inserted, WIRE.deviceInsertBitwig)?.['uuid'], 'abc');

  // A delete on the SAME track reuses that cursor rather than re-pointing a
  // second one, which is the allocator doing its job (E1, E15-F).
  const deleted = encodeOp({ op: 'device.delete', device: device(TRACK_A, 2) }, poolCtx);
  assert.deepEqual(methods(deleted), [WIRE.cursorPointTrack, WIRE.deviceDelete]);
  assert.equal(paramsOf(deleted, WIRE.deviceDelete)?.['cursor'], cursor);
  assert.equal(paramsOf(deleted, WIRE.deviceDelete)?.['deviceIndex'], 2);

  // ...and a different track gets a different cursor, so two chains in one batch
  // cannot silently become one.
  const other = encodeOp({ op: 'device.delete', device: device(TRACK_B, 0) }, poolCtx);
  assert.notEqual(paramsOf(other, WIRE.deviceDelete)?.['cursor'], cursor);
  assert.equal(paramsOf(other, WIRE.cursorPointTrack)?.['trackIndex'], 4);
});

test('E-device: a CLAP insert sends `clapId`, which is the key its handler reads', () => {
  const frames = encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'clap', id: 'com.example.synth' } },
    ctx,
  );
  assert.deepEqual(methods(frames), [WIRE.cursorPointTrack, WIRE.deviceInsertClap]);
  assert.equal(paramsOf(frames, WIRE.deviceInsertClap)?.['clapId'], 'com.example.synth');
});

test('4e-device: VST3 and CLAP use distinct validated identifiers', () => {
  const classUid = 'D39D5B69D6AF42FA123456785A334D44';
  const vst3 = encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'vst3', classUid } },
    ctx,
  );
  assert.deepEqual(methods(vst3), [WIRE.cursorPointTrack, WIRE.deviceInsertVst3]);
  assert.equal(paramsOf(vst3, WIRE.deviceInsertVst3)?.['vst3Id'], classUid);

  assert.throws(() => encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'vst3', classUid: 'not-a-uid' } },
    ctx,
  ), InvalidOpError);
  assert.throws(() => encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'clap', id: ' bad.id ' } },
    ctx,
  ), InvalidOpError);
  assert.throws(() => encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'clap', id: '' } },
    ctx,
  ), InvalidOpError);
});

// --- E2: beats are the unit; the grid is a per-op view ----------------------

test('E-grid: the coarsest exact grid is chosen', () => {
  assert.equal(chooseStepSize([note({ startBeats: 0, durationBeats: 1 })]), 1);
  assert.equal(chooseStepSize([note({ startBeats: 0.5, durationBeats: 0.5 })]), 0.5);
  assert.equal(chooseStepSize([note({ startBeats: 0.75, durationBeats: 0.25 })]), 0.25);
  assert.equal(chooseStepSize([note({ startBeats: 0.125, durationBeats: 1 })]), 0.125);
});

test('E-grid: beats convert to step indices against the chosen grid (E2)', () => {
  const frames = encodeOp(
    {
      op: 'note.write',
      clip: CLIP_A,
      notes: [note({ startBeats: 0, pitch: 60 }), note({ startBeats: 1.5, pitch: 64, durationBeats: 0.5 })],
    },
    ctx,
  );
  assert.equal(paramsOf(frames, WIRE.cursorSetStepSize)?.['stepSize'], 0.5);
  // [x, y, velocity, duration] — x in steps, duration still in beats.
  assert.deepEqual(paramsOf(frames, WIRE.cursorSetNotes)?.['notes'], [
    [0, 60, 100, 1],
    [3, 64, 100, 0.5],
  ]);
});

test('E-grid: a position finer than the grid floor is refused, not snapped (E2)', () => {
  // Off-grid notes are reported snapped DOWN, so accepting one would silently
  // corrupt every snapshot taken afterwards.
  assert.throws(() => chooseStepSize([note({ startBeats: 0.01 })]), InvalidOpError);
});

// --- E1/E2: pointing ---------------------------------------------------------

test('E-point: note ops point track-then-slot, the only mechanism that works (E1)', () => {
  const frames = encodeOp({ op: 'note.write', clip: CLIP_A, notes: [note()] }, ctx);
  assert.deepEqual(methods(frames).slice(0, 2), [WIRE.cursorPointTrack, WIRE.slotSelect]);
  assert.equal(paramsOf(frames, WIRE.cursorPointTrack)?.['trackIndex'], 3);
  assert.equal(paramsOf(frames, WIRE.slotSelect)?.['mechanism'], 'track');
});

test('E-point: addresses resolve through the context, never a raw index', () => {
  const frames = encodeOp({ op: 'track.rename', track: TRACK_A, name: 'gn-A' }, ctx);
  assert.equal(paramsOf(frames, WIRE.trackSetName)?.['trackIndex'], 3);
});

// --- E8: the batch is the unit ----------------------------------------------

test('E-batch: a stage is ONE batch.run carrying every op\'s frames in order (E8)', () => {
  const ops: Op[] = [
    { op: 'notify', message: 'writing' },
    { op: 'note.write', clip: CLIP_A, notes: [note()] },
  ];
  const f = encodeStage(ops, ctx, 7);
  assert.equal(f.method, WIRE.batchRun);
  const wireOps = f.params!['ops'] as { method: string }[];
  assert.deepEqual(wireOps.map((o) => o.method), [
    WIRE.notify, WIRE.cursorPointTrack, WIRE.slotSelect, WIRE.cursorSetStepSize, WIRE.cursorSetNotes,
  ]);
  // §8c requires a report of what applied and what did not, and the wire only
  // returns per-op results when asked.
  assert.equal(f.params!['verbose'], true);
  assert.equal(f.params!['ifRevision'], 7);
});

test('E-batch: ifRevision is omitted rather than sent as undefined', () => {
  const f = encodeStage([{ op: 'notify', message: 'x' }], ctx);
  assert.ok(!('ifRevision' in f.params!));
});

test('E-batch: nothing the encoder emits is a nested batch (E8 refuses them)', () => {
  const f = encodeStage([{ op: 'note.write', clip: CLIP_A, notes: [note()] }], ctx);
  const wireOps = f.params!['ops'] as { method: string }[];
  assert.ok(wireOps.every((o) => !o.method.startsWith('batch.')));
});

test('4b settlement: adjacent compatible note writes share one wire frame', () => {
  const f = encodeStage([
    { op: 'note.write', clip: CLIP_A, channel: 3, notes: [note({ pitch: 60 })] },
    { op: 'note.write', clip: CLIP_A, channel: 3, notes: [note({ startBeats: 1, pitch: 64 })] },
  ], ctx);
  const wireOps = f.params!['ops'] as { method: string; params: Record<string, unknown> }[];
  assert.equal(wireOps.filter((op) => op.method === WIRE.cursorSetNotes).length, 1);
  assert.deepEqual(
    wireOps.find((op) => op.method === WIRE.cursorSetNotes)?.params['notes'],
    [[0, 60, 100, 1], [1, 64, 100, 1]],
  );
});

test('4b settlement: transport merging stops at a grid or channel boundary', () => {
  const f = encodeStage([
    { op: 'note.write', clip: CLIP_A, channel: 0, notes: [note({ pitch: 60 })] },
    { op: 'note.write', clip: CLIP_A, channel: 0,
      notes: [note({ startBeats: 0.5, pitch: 64, durationBeats: 0.5 })] },
    { op: 'note.write', clip: CLIP_A, channel: 1, notes: [note({ pitch: 67 })] },
  ], ctx);
  const wireOps = f.params!['ops'] as { method: string }[];
  assert.equal(wireOps.filter((op) => op.method === WIRE.cursorSetNotes).length, 3);
});

// --- E1/E15-F: the cursor pool ----------------------------------------------

test('E-pool: the same clip always gets the same cursor, so a props op never re-points (E15-F)', () => {
  const pool = new CursorPool(3);
  const poolCtx: EncodeContext = { ...ctx, cursorFor: (c) => pool.cursorFor(c) };

  // The shape `splitNoteWrite` produces: write A, props A, write B, props B.
  const cursorOf = (frames: readonly Frame[]) =>
    (frames[0]?.params as Record<string, unknown> | undefined)?.['cursor'];
  const writeA = encodeOp({ op: 'note.write', clip: CLIP_A, notes: [note({ pan: 0.5 })] }, poolCtx);
  const propsA = encodeOp({ op: 'note.props', clip: CLIP_A, notes: [note({ pan: 0.5 })] }, poolCtx);
  const writeB = encodeOp({ op: 'note.write', clip: CLIP_B, notes: [note({ pan: -0.5 })] }, poolCtx);
  const propsB = encodeOp({ op: 'note.props', clip: CLIP_B, notes: [note({ pan: -0.5 })] }, poolCtx);

  // ⚠ THE POINT. `cursor.setNoteProps` resolves its note against the clip THAT
  // CURSOR held at turn start, so a props op reaching a different cursor than
  // its create loses every property, silently and with a clean receipt.
  assert.equal(cursorOf(propsA), cursorOf(writeA));
  assert.equal(cursorOf(propsB), cursorOf(writeB));
  assert.notEqual(cursorOf(writeA), cursorOf(writeB), 'two clips, two cursors — E1 held three');
});

test('E-pool: a structural op invalidates every assignment (standing rule 2, E3)', () => {
  const pool = new CursorPool(2);
  const first = pool.cursorFor(CLIP_A);
  assert.equal(pool.cursorFor(CLIP_A), first, 'stable while nothing structural happens');

  // A held pin's sceneIndex goes PERMANENTLY stale after compaction while
  // looking healthy, so an assignment cannot outlive a structural op.
  pool.invalidate();
  assert.equal(pool.assignments.size, 0);
});

test('E-pool: an explicit cursor partition cannot allocate outside its references', () => {
  const pool = new CursorPool(['writer']);
  assert.equal(pool.cursorFor(CLIP_A), 'writer');
  assert.equal(pool.cursorFor(CLIP_B), 'writer');
  assert.throws(() => new CursorPool([]), /at least one cursor/);
  assert.throws(() => new CursorPool(['0', '0']), /unique/);
});

test('E-pool: more clips than cursors evicts the LEAST recently used, never the newest', () => {
  const pool = new CursorPool(2);
  const a = pool.cursorFor(CLIP_A);
  const b = pool.cursorFor(CLIP_B);
  assert.notEqual(a, b);

  const clipC = clip(slot(track('d07f6b06-8f4f-4f4f-802d-ddf1a5190515'), scene(0, 1)));
  const c = pool.cursorFor(clipC);
  // A took the oldest slot, so A is what gets evicted — and B, which is what a
  // pending props op is most likely to want, keeps its cursor.
  assert.equal(c, a);
  assert.equal(pool.cursorFor(CLIP_B), b);
});

// --- the scene ROW: a project index is not a bank index (E19, session 3c) ----

test('E-row: every scene index on the wire goes through the window, not straight out', () => {
  // ⚠ The conflation this fixes was silent because the two numbers agree for
  // every row inside the window — which is every row anyone had tested.
  const inside = scene(3, 1);
  assert.equal(
    paramsOf(encodeOp({ op: 'scene.delete', scene: inside }, ctx), WIRE.sceneDelete)?.['sceneIndex'],
    3,
    'identity while the bank sits at scroll position 0 and the row is inside it');
  assert.equal(
    paramsOf(
      encodeOp({ op: 'clip.create', slot: slot(TRACK_A, inside), lengthBeats: 4 }, ctx),
      WIRE.clipCreate,
    )?.['slotIndex'],
    3,
    'and the SLOT bank is the same width, so clip ops carry the same constraint');
});

test('E-row: a row past the window REFUSES rather than emitting a frame the bank rejects', () => {
  // Live, `sceneBank.getScene(99)` answered "Parameter index (=99) must be in the
  // range 0 to 16" — from inside a batch, after earlier ops had already landed
  // (E19). A pure function that narrows its meaning at the edge is how that got
  // there, so the edge throws.
  const outside = scene(SCENE_WINDOW.bankSize + 2, 1);
  assert.throws(() => encodeOp({ op: 'scene.delete', scene: outside }, ctx), BlindSpotError);
  assert.throws(
    () => encodeOp({ op: 'clip.create', slot: slot(TRACK_A, outside), lengthBeats: 4 }, ctx),
    BlindSpotError);
  assert.throws(
    () => encodeOp({ op: 'note.write', clip: clip(slot(TRACK_A, outside)), notes: [note()] }, ctx),
    BlindSpotError);
});
