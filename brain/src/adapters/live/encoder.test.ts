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
  InvalidOpError, assertOpsWritable, clip, device, param, scene, slot, track,
  type NoteRecord, type Op, type TrackAddress,
} from '../../contract/index.js';
import { chooseStepSize, encodeOp, encodeStage, type EncodeContext } from './encoder.js';
import { CursorPool } from './pool.js';
import { WIRE, type Frame } from './wiremap.js';

const TRACK_A = track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const TRACK_B = track('c07f6b06-8f4f-4f4f-802d-ddf1a5190515');
const CLIP_B = clip(slot(TRACK_B, scene(0, 1)));
const SCENE_0 = scene(0, 1);
const CLIP_A = clip(slot(TRACK_A, SCENE_0));

/** A one-cursor pool — the Phase-0 shape, so the cases below read unchanged. */
const ctx: EncodeContext = {
  cursorFor: () => '0',
  cursorForTrack: () => '0',
  trackIndex: (t: TrackAddress) => (t.channelId === TRACK_A.channelId ? 3 : (t.channelId === TRACK_B.channelId ? 4 : -1)),
};

const methods = (frames: readonly Frame[]) => frames.map((f) => f.method);
const paramsOf = (frames: readonly Frame[], method: string) =>
  frames.find((f) => f.method === method)?.params as Record<string, unknown> | undefined;

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
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
  // `deviceInsertClap` does `params.get("clapId")`; the encoder sent `uuid`, so
  // the handler would have dereferenced null. Same shape of defect as the cursor
  // confusion above and found the same way — by reading the Java, which is the
  // only source of truth for a wire this side cannot exercise offline.
  const frames = encodeOp(
    { op: 'device.insert', track: TRACK_A, source: { from: 'clap', uuid: 'com.example.synth' } },
    ctx,
  );
  assert.deepEqual(methods(frames), [WIRE.cursorPointTrack, WIRE.deviceInsertClap]);
  assert.equal(paramsOf(frames, WIRE.deviceInsertClap)?.['clapId'], 'com.example.synth');
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
