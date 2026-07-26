/**
 * Direct trap tests — the fake's model, poked with NO contract involved.
 *
 * These exist because of a specific failure mode: when a trap is both modelled
 * and mitigated, production code never exercises the trap path, so the model can
 * rot silently and every other test stays green. The only way to notice is to
 * assert on the misbehaviour itself.
 *
 * So each test here says "Bitwig really does this", and the conformance suite
 * separately says "the contract handles it". Test ids name the finding:
 *
 *   T-turn        E2/E8-A  a write is invisible until the next turn
 *   T-gain        E2       gain reads back doubled
 *   T-pressure    E15-E    pressure cannot be written at all — only phantomed
 *   T-props       E15-B/D  property writes need their own turn AND a settled grid
 *   T-emptyslot   E2       pointing at an empty slot lands on the wrong clip
 *   T-scene       E3       deleting a scene compacts rows and stales the epoch
 *   T-bank        E5       tracks past the window are absent, not slow
 *   T-adjacency   E8-E     same-pitch notes truncate each other
 *   T-tracks      E2c      flat bank tail, unhonoured positions, auto-names
 *   T-chain       E3       device chains re-index on delete
 *   T-params      E4       parameters are not live until after the insert settles
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GAIN_READ_SCALE, addressKey, assertOpsWritable, clip, notes as notesAddress, orderedNoteProps,
  planStages, scene, slot, stepSizeFor, track, type NoteRecord, type Op,
} from '../../contract/index.js';
import { FakeAdapter } from './adapter.js';
import { VirtualClock } from './clock.js';
import { ProjectModel, noteKey } from './model.js';
import {
  applyNotePropsInOrder, gainOnReadback, gridChangePoisonsRead, noteOnReadback, pointAtSlot,
  propsReadsTurnStartClip, stepDataIsStale, writeNoteProps,
} from './traps.js';

const CLIP = clip(slot(track('b07f6b06-8f4f-4f4f-802d-ddf1a5190515'), scene(0, 1)));

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

// --- E2 / E8-A: two-turn write visibility ------------------------------------

test('T-turn: a staged write is invisible until the turn boundary (E2)', () => {
  const clock = new VirtualClock();
  let visible = 0;
  clock.stage(() => { visible = 1; });
  assert.equal(visible, 0, 'a setStep must NOT be visible to a getStep in the same request');
  assert.equal(clock.pendingCount, 1);
  clock.commit();
  assert.equal(visible, 1, 'it must be visible on the next request');
});

test('T-turn: the rule applies once per BATCH, not per op (E8-A)', () => {
  const clock = new VirtualClock();
  const landed: number[] = [];
  // 240 writes in one batch all become visible together, one turn later.
  for (let i = 0; i < 240; i++) clock.stage(() => landed.push(i));
  assert.equal(landed.length, 0);
  clock.commit();
  assert.equal(landed.length, 240);
});

test('T-turn: only settle advances the clock; reads must not (E1 poll loops)', () => {
  const clock = new VirtualClock();
  const before = clock.tick;
  clock.commit();
  assert.equal(clock.tick, before, 'commit alone must not advance time');
  clock.settle('tick');
  assert.equal(clock.tick, before + 1);
});

// --- E4: deferred effects need a timer queue, not a counter -------------------

test('T-params: parameters go live ~194ms AFTER the device insert lands (E4)', () => {
  const clock = new VirtualClock();
  let live = false;
  clock.after('paramsLive', 'params', () => { live = true; });
  clock.settle('tick');
  assert.equal(live, false, 'one tick is not enough for a 194ms budget');
  clock.settle('paramsLive');
  assert.equal(live, true);
});

// --- E2: gain reads back doubled ---------------------------------------------

test('T-gain: gain reads back 2x what was written (E2)', () => {
  // Set 0.7 -> settled read 1.4, reproducibly, while the javadoc claims 0..1.
  assert.equal(gainOnReadback(0.7), 1.4);
  assert.equal(gainOnReadback(0.5), 0.5 * GAIN_READ_SCALE);
  assert.equal(noteOnReadback(note({ gain: 0.7 })).gain, 1.4);
});

test('T-gain: a note without gain is returned untouched', () => {
  const n = note();
  assert.equal(noteOnReadback(n), n);
});

// --- E15-E: pressure cannot be written at all --------------------------------

test('T-pressure: pressure is never emitted, whatever order it is asked for in (E15-E)', () => {
  // ⚠ This test used to assert the OPPOSITE — that writing gain after pressure
  // "destroys" it (E2/e02e). E15-E measured that the pressure being destroyed
  // was never in the clip: `setPressure` populates only the writing cursor's own
  // NoteStep cache, invisible to every other cursor and gone the moment that
  // cursor is re-pointed. Gain and timbre did not zero it; they forced the cache
  // to be re-read, which replaced the phantom with the clip's real 0.
  assert.deepEqual(orderedNoteProps(note({ pressure: 0.9 })), []);
  assert.deepEqual(
    orderedNoteProps(note({ gain: 0.7, pressure: 0.9, pan: 0.3 })).map(([k]) => k),
    ['pan', 'gain'],
  );
});

test('T-pressure: 16 of the 17 other properties DO persist — this is pressure-specific (E15-E)', () => {
  // Measured one property at a time: write alone, settle, read, re-point the
  // writing cursor away and back, read again. Only pressure evaporated.
  for (const prop of ['pan', 'timbre', 'transpose', 'chance', 'repeatCount'] as const) {
    assert.ok(
      orderedNoteProps(note({ [prop]: 0.5 })).some(([k]) => k === prop),
      `${prop} persists live, so the contract must still write it`,
    );
  }
});

test('T-pressure: a caller who asks for it is REFUSED, not quietly ignored (E15-E)', () => {
  assert.throws(
    () => assertOpsWritable([{ op: 'note.write', clip: CLIP, notes: [note({ pressure: 0.9 })] }]),
    /pressure cannot be written/,
  );
  assert.doesNotThrow(() => assertOpsWritable([{ op: 'note.write', clip: CLIP, notes: [note({ pan: 0.3 })] }]));
});

test('T-props: property writes too soon after a grid change are DISCARDED (E15-D)', () => {
  // The trap itself, poked with no contract involved. `cursor.setNoteProps`
  // reads a NoteStep before mutating it, and that read is unusable until the
  // step grid has been re-fetched — ~120ms measured live, 0 of 3 landing below
  // that and 3 of 3 above it.
  const model = new ProjectModel();
  const slotState = model.makeSlots()[0]!;
  slotState.stepDataStaleUntilTick = 6;
  assert.equal(stepDataIsStale(slotState, 0), true, 'same turn as the grid change');
  assert.equal(stepDataIsStale(slotState, 5), true, 'still inside the window');
  assert.equal(stepDataIsStale(slotState, 6), false, 'the budget has elapsed');
});

test('T-props: a property write that MOVES the grid is DISCARDED, same turn (E15-D)', () => {
  // The other half of E15-D, poked directly. `stepDataIsStale` above models a
  // grid change made in an earlier request, which a settle in front of the stage
  // repairs; this models one the op makes ITSELF, immediately before its own
  // `clip.getStep`, where no amount of waiting afterwards helps.
  //
  // Measured in probe `e15d-props` §A with byte-identical frames: gain landed
  // only when the cursor was ALREADY on the grid the op wanted.
  assert.equal(gridChangePoisonsRead(0.5, 1), true, 'a real grid change poisons the read');
  assert.equal(gridChangePoisonsRead(0.5, 0.5), false, 'the same grid is a no-op and lands');
  // Neither side guesses. A fresh cursor has no known grid, and notes finer than
  // the grid floor never reach an adapter — the encoder refuses them first.
  assert.equal(gridChangePoisonsRead(undefined, 1), false);
  assert.equal(gridChangePoisonsRead(0.5, undefined), false);
});

test('T-props: the props op inherits the create\'s grid, so it cannot poison itself (E15-D)', () => {
  // ⚠ Why `splitNoteWrite` hands over the WHOLE note set. Filtering to the
  // expressive notes can make the props stage coarser than the create — here the
  // create is pinned to 0.5 by the plain note at beat 0.5, while the expressive
  // note alone would sit on a 1 grid — and the resulting `setStepSize` would
  // discard everything the op carries.
  const mixed = [note({ startBeats: 0, pitch: 60, durationBeats: 1, pan: -0.25 }), note({ startBeats: 0.5, pitch: 67, durationBeats: 0.5 })];
  const stages = planStages([{ op: 'note.write', clip: CLIP, notes: mixed }]);
  const write = stages[0]!.ops[0] as Extract<Op, { op: 'note.write' }>;
  const props = stages[1]!.ops[0] as Extract<Op, { op: 'note.props' }>;
  assert.equal(gridChangePoisonsRead(stepSizeFor(write.notes), stepSizeFor(props.notes)), false);
  assert.equal(gridChangePoisonsRead(stepSizeFor(write.notes), stepSizeFor(props.notes.filter((n) => n.pan !== undefined))), true,
    'and the filtered version really would have lost the properties');
});

test('T-props: a property write that RE-POINTS inside its turn is DISCARDED (E15-F)', () => {
  // The trap that killed SESSION-2 item 4's hoist, poked with no contract
  // involved. `setNoteProps` resolves its note against the clip the cursor held
  // when the TURN began, so an op that re-points looks the note up in the wrong
  // clip, finds nothing, and writes nothing.
  const A = 'chan-a:0';
  const B = 'chan-b:0';
  assert.equal(propsReadsTurnStartClip(A, A), false, 'already pointed there — lands');
  assert.equal(propsReadsTurnStartClip(A, B), true, 're-pointed inside the turn — lost');
  // A fresh cursor has no known clip, and inventing one would make the fake fail
  // cases live Bitwig passes.
  assert.equal(propsReadsTurnStartClip(undefined, B), false);
});

test('T-props: back-to-back props ops for DIFFERENT clips both lose (E15-F)', async () => {
  // ⚠ Two things at once, and the second one was a surprise.
  //
  // 1. The regression that stops SESSION-2 item 4's hoist being re-attempted
  //    from the doc without re-reading the finding.
  // 2. A caller-facing hazard in v0. `planStages` gives every `note.props` op
  //    its own stage, so a caller who hand-writes property ops for two clips
  //    gets two turns, and EACH of them re-points — so both are lost, not just
  //    one. That is worse than the hoisted shape live Bitwig showed (§B, where
  //    gn-B survived because the turn happened to start there), and it is
  //    reachable through the public op union today.
  //
  // The generated path is safe because `splitNoteWrite` always pairs a props op
  // with the create for the SAME clip immediately before it. A caller passing
  // bare `note.props` ops gets no such pairing and no warning. → Phase 1.
  //
  // The fake is asserted to REPRODUCE the loss, not to prevent it. A fake that
  // quietly made this work would certify a shape real Bitwig silently breaks,
  // which is precisely PHASE-0 §Risks' named failure mode.
  const adapter = new FakeAdapter({ tracks: ['gn-A', 'gn-B'] });
  const [tA, tB] = adapter.model.tracks;
  const clipA = clip(slot(track(tA!.channelId), scene(0, 1)));
  const clipB = clip(slot(track(tB!.channelId), scene(0, 1)));
  await adapter.apply({
    ops: [
      { op: 'clip.create', slot: slot(track(tA!.channelId), scene(0, 1)), lengthBeats: 4 },
      { op: 'clip.create', slot: slot(track(tB!.channelId), scene(0, 1)), lengthBeats: 4 },
    ],
  });
  await adapter.settle('trackStruct');

  // The creates coalesce into one stage, leaving the cursor on gn-B. The two
  // props ops then take a stage each (their settle class forces it), and each
  // one re-points away from where its turn started.
  const withPan = (pitch: number, pan: number) => note({ pitch, pan });
  await adapter.apply({
    ops: [
      { op: 'note.write', clip: clipA, notes: [note({ pitch: 60 })] },
      { op: 'note.write', clip: clipB, notes: [note({ pitch: 67 })] },
    ],
  });
  await adapter.settle('gridChange');
  await adapter.apply({
    ops: [
      { op: 'note.props', clip: clipA, notes: [withPan(60, -0.25)] },
      { op: 'note.props', clip: clipB, notes: [withPan(67, 0.5)] },
    ],
  });
  await adapter.settle('noteWrite');

  const notesOf = async (address: ReturnType<typeof clip>) => {
    const snap = await adapter.read([notesAddress(address)]);
    const entry = snap.entries[addressKey(notesAddress(address))];
    return entry?.value.of === 'notes' ? entry.value.notes : [];
  };
  // Both notes still exist — the loss is the EXPRESSION, silently, with the
  // receipt reporting every op applied.
  assert.equal((await notesOf(clipA)).length, 1);
  assert.equal((await notesOf(clipB)).length, 1);
  assert.equal((await notesOf(clipA))[0]?.pan, undefined, 'gn-A loses its pan: its turn began on gn-B');
  assert.equal((await notesOf(clipB))[0]?.pan, undefined, 'gn-B loses its too: its turn began on gn-A');
});

test('T-props: ...while the GENERATED path pairs each props op with its own create (E15-F)', async () => {
  // The contrast that makes the test above a hazard rather than a fact of life.
  // Identical intent, expressed the way callers are meant to — one `note.write`
  // per clip carrying its properties — and `splitNoteWrite` interleaves them so
  // every props stage opens on the clip it addresses.
  const adapter = new FakeAdapter({ tracks: ['gn-A', 'gn-B'] });
  const [tA, tB] = adapter.model.tracks;
  const clipA = clip(slot(track(tA!.channelId), scene(0, 1)));
  const clipB = clip(slot(track(tB!.channelId), scene(0, 1)));
  await adapter.apply({
    ops: [
      { op: 'clip.create', slot: slot(track(tA!.channelId), scene(0, 1)), lengthBeats: 4 },
      { op: 'clip.create', slot: slot(track(tB!.channelId), scene(0, 1)), lengthBeats: 4 },
    ],
  });
  await adapter.settle('trackStruct');
  await adapter.apply({
    ops: [
      { op: 'note.write', clip: clipA, notes: [note({ pitch: 60, pan: -0.25 })] },
      { op: 'note.write', clip: clipB, notes: [note({ pitch: 67, pan: 0.5 })] },
    ],
  });
  await adapter.settle('noteWrite');

  const notesOf = async (address: ReturnType<typeof clip>) => {
    const snap = await adapter.read([notesAddress(address)]);
    const entry = snap.entries[addressKey(notesAddress(address))];
    return entry?.value.of === 'notes' ? entry.value.notes : [];
  };
  assert.equal((await notesOf(clipA))[0]?.pan, -0.25, 'both clips keep their expression');
  assert.equal((await notesOf(clipB))[0]?.pan, 0.5);
});

test('T-props: properties set in the request that CREATES a note are DISCARDED (Phase 0)', () => {
  // ⚠ Discovered by the conformance suite disagreeing with the fake. `setStep`
  // is not visible to a `getStep` in the same request (E2), so the NoteStep a
  // same-request `setNoteProps` writes to is stale and every property is lost.
  // Measured live: gain 0.7 written alongside the note reads back 0.
  const written = writeNoteProps(note({ gain: 0.7, timbre: 0.3, pressure: 0.9, pan: 0.2 }));
  assert.equal(written.gain, undefined);
  assert.equal(written.pressure, undefined);
  assert.equal(written.pan, undefined, 'no property survives, not just the fragile ones');
  // The four identity fields ride on setStep itself, so those DO land.
  assert.equal(written.pitch, 60);
  assert.equal(written.durationBeats, 1);
});

test('T-props: applying properties in order no longer clobbers anything (E15-E)', () => {
  // The fake used to zero pressure here to model E2/e02e. It does not any more,
  // because the behaviour it modelled does not exist — and a fake that models a
  // disproven mechanism is exactly PHASE-0 §Risks' "certifying wrong behaviour".
  const out = applyNotePropsInOrder(note(), [['pan', 0.3], ['gain', 0.7], ['timbre', 0.2]]);
  assert.equal(out.pan, 0.3);
  assert.equal(out.gain, 0.7);
  assert.equal(out.timbre, 0.2);
});

test('T-props: planStages splits a fully-specified note into TWO turns (E15-D/E)', () => {
  // Create, then properties — and the properties stage waits for the grid the
  // create changed BEFORE it is sent. It used to be three turns, the third
  // carrying pressure alone; E15-E removed the reason for it.
  const stages = planStages([
    { op: 'note.write', clip: CLIP, notes: [note({ gain: 0.7, pan: 0.3 })] },
  ]);
  assert.deepEqual(stages.map((s) => s.ops.map((o) => o.op)), [['note.write'], ['note.props']]);

  const write = stages[0]!.ops[0] as Extract<Op, { op: 'note.write' }>;
  const props = stages[1]!.ops[0] as Extract<Op, { op: 'note.props' }>;

  assert.equal(write.notes[0]!.gain, undefined, 'the create carries identity only');
  assert.equal(props.notes[0]!.gain, 0.7);
  assert.equal(props.notes[0]!.pan, 0.3);
  // ⚠ The load-bearing assertion of the whole E15-D fix.
  assert.equal(stages[1]!.settleBefore, 'gridChange',
    'the props stage must wait for the grid the create changed, or every property is discarded');
});

test('T-props: a note carrying ONLY pressure never reaches the plan (E15-E)', () => {
  // It is refused up front, so there is no stage to build.
  assert.throws(
    () => assertOpsWritable([{ op: 'note.write', clip: CLIP, notes: [note({ pressure: 0.9 })] }]),
    /E15-E/,
  );
});

test('T-props: a note with no properties still costs exactly one turn', () => {
  // The 232x batch win must not be paid for by notes that do not need it.
  const stages = planStages([{ op: 'note.write', clip: CLIP, notes: [note()] }]);
  assert.equal(stages.length, 1);
  assert.equal(stages[0]!.settle, undefined);
});

// --- E2: the empty-slot mispointing trap -------------------------------------

test('T-emptyslot: pointing at an EMPTY slot lands on a different clip (E2)', () => {
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.slots[0]!.hasContent = true;   // a real clip at scene 0
  // Scene 3 is empty. Bitwig does not error; it silently attaches elsewhere.
  const point = pointAtSlot(track, 3);
  assert.equal(point.mispointed, true);
  assert.equal(point.sceneIndex, 0, 'landed on the wrong clip, exactly as observed');
});

test('T-emptyslot: a write to an empty slot lands in the WRONG clip', () => {
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.slots[0]!.hasContent = true;
  const point = pointAtSlot(track, 3);
  const n = note({ pitch: 64 });
  assert.ok(point.slot, 'trial 1 always lands somewhere — just not where it was asked');
  point.slot.notes.set(noteKey(0, n.pitch, n.startBeats), n);
  assert.equal(track.slots[3]!.notes.size, 0, 'the requested slot got nothing');
  assert.equal(track.slots[0]!.notes.size, 1, 'the untouched clip was silently modified');
});

test('T-emptyslot: on a WHOLLY EMPTY track the cursor stays on the PREVIOUS clip (E2)', () => {
  // ⚠ E2's other observed trial. The fallback above can only fire when the target
  // track holds a clip somewhere; on a track with nothing at all there is nothing
  // to attach to, and the cursor keeps what it already had — routinely a clip on
  // a DIFFERENT TRACK, which is what makes this worse than it looks.
  const model = new ProjectModel();
  const a = model.createTrack('gn-A');
  const b = model.createTrack('gn-B');
  a.slots[0]!.hasContent = true;
  const point = pointAtSlot(b, 2, { slot: a.slots[0]!, sceneIndex: 0 });
  assert.equal(point.mispointed, true);
  assert.equal(point.slot, a.slots[0], 'landed on the other TRACK\'s clip, not on gn-B at all');
});

test('T-emptyslot: with no clip reachable anywhere the cursor holds nothing (E2)', () => {
  // A slot with no clip cannot hold notes, so the one outcome that never happens
  // is the write landing where it was asked. `undefined` says "nowhere" instead
  // of inventing a success — see the end-to-end case below for why that matters.
  const model = new ProjectModel();
  const b = model.createTrack('gn-B');
  assert.equal(pointAtSlot(b, 2, undefined).slot, undefined);
  // A cursor parked on an EMPTY slot is holding no clip either.
  const a = model.createTrack('gn-A');
  assert.equal(pointAtSlot(b, 2, { slot: a.slots[0]!, sceneIndex: 0 }).slot, undefined);
});

test('T-emptyslot: a write to a never-created slot does NOT land there (E2)', async () => {
  // ⚠ THE REGRESSION THIS EXISTS FOR. Phase 1 creates fresh tracks and writes
  // their first clip, which is a wholly-empty track by definition. The fake used
  // to accept this write, report `ok: true` and read the note back — certifying a
  // shape that mispoints on real Bitwig, which is PHASE-0 §Risks' named failure
  // mode with the sign flipped.
  //
  // The op is still ACCEPTED, because Bitwig raises no error either; what must
  // not happen is the note appearing in the slot nobody created.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const [tA] = adapter.model.tracks;
  const target = clip(slot(track(tA!.channelId), scene(3, 1)));

  const receipt = await adapter.apply({ ops: [{ op: 'note.write', clip: target, notes: [note()] }] });
  await adapter.settle('noteWrite');

  assert.equal(receipt.accepted, true, 'Bitwig does not error here, so neither may the fake');
  const snap = await adapter.read([notesAddress(target)]);
  const entry = snap.entries[addressKey(notesAddress(target))];
  const landed = entry?.value.of === 'notes' ? entry.value.notes : [];
  assert.deepEqual(landed, [], 'the note must not appear in a slot that was never created');
});

test('T-emptyslot: creating the clip first makes pointing land correctly (the fix)', () => {
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.slots[0]!.hasContent = true;
  track.slots[3]!.hasContent = true;   // clip.create ran first
  const point = pointAtSlot(track, 3);
  assert.equal(point.mispointed, false);
  assert.equal(point.sceneIndex, 3);
});

// --- E3: scene compaction ----------------------------------------------------

test('T-scene: deleting a scene COMPACTS the rows below it upward (E3)', () => {
  const model = new ProjectModel();
  model.sceneCount = 12;              // E3 observed this at rows 9/10
  const track = model.createTrack('gn-A');
  track.slots[9]!.hasContent = true;
  track.slots[10]!.hasContent = true;
  model.deleteScene(5);
  assert.equal(track.slots[8]!.hasContent, true, 'row 9 moved to 8');
  assert.equal(track.slots[9]!.hasContent, true, 'row 10 moved to 9');
  assert.equal(track.slots[10]?.hasContent ?? false, false, 'row 10 is now empty');
});

test('T-scene: any scene op bumps the epoch, staling every prior address (E3)', () => {
  const model = new ProjectModel();
  const before = model.sceneEpoch;
  model.deleteScene(0);
  assert.equal(model.sceneEpoch, before + 1);
  model.createScenes(2);
  assert.equal(model.sceneEpoch, before + 2, 'creating scenes shifts addresses too');
});

// --- E5: the bank window -----------------------------------------------------

test('T-bank: tracks past the window are ABSENT, not slow (E5)', () => {
  const model = new ProjectModel();
  model.trackBankSize = 4;
  const hidden: string[] = [];
  for (let i = 0; i < 8; i++) hidden.push(model.createTrack(`t${i}`).channelId);
  assert.equal(model.visibleTracks().length, 4);
  assert.equal(model.trackCount, 8);
  assert.equal(model.overflowing, true);
  // channelId resolves ONLY inside the window — this is the checkpoint blind spot.
  assert.equal(model.findByChannelId(hidden[7]!), undefined);
  assert.equal(model.existsAnywhere(hidden[7]!), true, 'it exists; we simply cannot see it');
});

// --- E8-E: same-pitch adjacency truncation ----------------------------------

test('T-adjacency: consecutive same-pitch notes truncate each other (E8-E)', () => {
  // Four dur=1 notes a quarter-beat apart each come back as 0.25: Bitwig ends a
  // note where the next same-pitch note begins.
  const notes = [0, 0.25, 0.5, 0.75].map((startBeats) => note({ startBeats, durationBeats: 1 }));
  const out = ProjectModel.applyAdjacencyTruncation(notes);
  assert.deepEqual(out.map((n) => n.durationBeats), [0.25, 0.25, 0.25, 1]);
});

test('T-adjacency: different pitches do not truncate each other', () => {
  const notes = [note({ startBeats: 0, pitch: 60 }), note({ startBeats: 0.25, pitch: 64 })];
  const out = ProjectModel.applyAdjacencyTruncation(notes);
  assert.deepEqual(out.map((n) => n.durationBeats), [1, 1]);
});

// --- E2c: the flat bank's shape ---------------------------------------------

test('T-tracks: the flat bank puts FX and MASTER at the TAIL (E2c)', () => {
  const model = new ProjectModel();
  model.createTrack('gn-A');
  model.tracks.push({ channelId: 'fx', name: 'FX 1', type: 'Effect', slots: model.makeSlots(), devices: [] });
  model.createTrack('gn-B');
  // Bank size is NOT the number of regular tracks — daw-mcp made that mistake.
  assert.deepEqual(model.bankView().map((t) => t.name), ['gn-A', 'gn-B', 'FX 1']);
});

test('T-tracks: default names auto-renumber and are never identities (E2c)', () => {
  const model = new ProjectModel();
  assert.equal(model.createTrack().name, 'Inst 1');
  assert.equal(model.createTrack().name, 'Inst 2');
});

test('T-tracks: a delete-and-recreate mints a NEW channelId (E2f)', () => {
  const model = new ProjectModel();
  const first = model.createTrack('gn-A').channelId;
  model.deleteTrack(first);
  assert.notEqual(model.createTrack('gn-A').channelId, first);
  // A deleted track is a clean tombstone, never an alias.
  assert.equal(model.findByChannelId(first), undefined);
});

// --- E3: device chain re-indexing -------------------------------------------

test('T-chain: deleting a device RE-INDEXES the chain (E3)', () => {
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.devices.push({ name: 'A', paramsLive: true, params: [] });
  track.devices.push({ name: 'B', paramsLive: true, params: [] });
  model.deleteDevice(track, 0);
  assert.equal(track.devices[0]!.name, 'B', 'the survivor shifted from index 1 to 0');
});
