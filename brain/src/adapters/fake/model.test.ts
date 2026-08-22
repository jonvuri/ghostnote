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
 *   T-reach       E19      no observer exists outside either bank window
 *   T-adjacency   E8-E     same-pitch notes truncate each other
 *   T-tracks      E2c      flat bank tail, unhonoured positions, auto-names
 *   T-chain       E3       device chains re-index on delete
 *   T-params      E4       parameters are not live until after the insert settles
 *   T-clip-meta   E43      raw clip marker writes leak or are ignored
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GAIN_READ_SCALE, addressKey, assertOpsWritable, chain as chainAddress, clip,
  device as deviceAddress, deviceIn as deviceInAddress,
  drumPad as drumPadAddress,
  lookupChain as chainLookup, notes as notesAddress, orderedNoteProps,
  param as paramAddress, remote as remoteAddress, remotes as remotesAddress, planStages,
  scene, slot, stepSizeFor, track, type NoteRecord, type Op,
} from '../../contract/index.js';
import { FakeAdapter } from './adapter.js';
import { VirtualClock } from './clock.js';
import { ProjectModel, noteKey, type FakeChain } from './model.js';
import {
  applyNotePropsInOrder, gainOnReadback, gridChangePoisonsRead, noteOnReadback, pointAtSlot,
  propsReadsTurnStartClip, rawLoopStartWrite, rawPlayStopWrite, stepDataIsStale, writeNoteProps,
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

test('T-clip-meta: raw loop start moves play markers, and play-stop writes are ignored (E43)', () => {
  const model = new ProjectModel();
  const slotState = model.makeSlots()[0]!;
  slotState.hasContent = true;
  slotState.lengthBeats = 10;
  slotState.playStartBeats = 0;
  slotState.playStopBeats = 8;

  rawLoopStartWrite(slotState, 1);
  assert.deepEqual(
    { loopStart: slotState.loopStartBeats, playStart: slotState.playStartBeats, playStop: slotState.playStopBeats },
    { loopStart: 1, playStart: 10, playStop: 11 },
  );

  rawPlayStopWrite(slotState, 9);
  assert.equal(slotState.playStopBeats, 11, 'a stop before the loop end is silently ignored');
  rawPlayStopWrite(slotState, 12);
  assert.equal(slotState.playStopBeats, 11, 'a stop after the loop end is also silently ignored');
});

test('T-gain: the shared contract encoder applies the measured inverse once (E24)', () => {
  const gain = orderedNoteProps(note({ gain: 0.7 })).find(([key]) => key === 'gain');
  assert.deepEqual(gain, ['gain', 0.35]);
  assert.equal(gainOnReadback(gain?.[1] as number), 0.7);
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

test('T-tracks: duplicating a track copies its contents and mints a fresh id', () => {
  const model = new ProjectModel();
  const source = model.createTrack('gn-A');
  source.devices.push({ name: 'Polysynth', paramsLive: true, params: [] });
  const copy = model.duplicateTrack(source.channelId)!;
  assert.notEqual(copy.channelId, source.channelId);
  assert.equal(copy.name, source.name);
  assert.deepEqual(copy.devices, source.devices);
  assert.notEqual(copy.devices, source.devices);
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

// --- E19 / B2: the observers only exist inside the windows -------------------

test('T-reach: a slot filling OUTSIDE the scene window fires no event at all', () => {
  // ⚠⚠ The trap, not the mitigation. `Rig.java` attaches one
  // `addHasContentObserver` per bank row on a slot bank sized by `config.scenes`,
  // so a row past it has no observer — the state change happens and the event
  // stream stays empty. A fake that fired here would certify a detector Bitwig
  // cannot supply, and the offline suite would prove `deltaComplete` correct on
  // exactly the case where it is not.
  const model = new ProjectModel();
  model.sceneCount = 8;
  model.sceneBankSize = 4;
  const track = model.createTrack('gn-A');

  model.setSlotContent(track, 1, true);
  assert.equal(model.contentRing.length, 1, 'inside the window, the observer fires');

  model.setSlotContent(track, 6, true);
  assert.equal(track.slots[6]!.hasContent, true, 'the slot really did fill...');
  assert.equal(model.contentRing.length, 1, '...and nothing reported it');
});

test('T-reach: the same hole in the TRACK dimension', () => {
  const model = new ProjectModel();
  model.trackBankSize = 1;
  model.createTrack('gn-A');
  const hidden = model.createTrack('gn-B');

  model.setSlotContent(hidden, 0, true);
  assert.equal(hidden.slots[0]!.hasContent, true);
  assert.deepEqual(model.contentRing, [], 'a bank row past the window carries no observer');
});

test('T-reach: a compaction below the window shifts rows unobserved (E3 + B2)', () => {
  // The two traps compounding: `deleteScene` compacts rows upward, and out there
  // nothing reports the occupancy changes that compaction produces.
  const model = new ProjectModel();
  model.sceneCount = 8;
  model.sceneBankSize = 4;
  const track = model.createTrack('gn-A');
  model.setSlotContent(track, 6, true);
  const before = model.contentEpoch;

  model.deleteScene(5);

  assert.equal(track.slots[5]!.hasContent, true, 'the clip moved up a row...');
  assert.equal(model.contentEpoch, before, '...and the content log says nothing happened');
  assert.equal(model.sceneEpoch > 0, true, 'only the scene epoch caught it, which is why it exists');
});

// --- E21: clip.create into an occupied slot appends a scene ------------------

test('T-append: creating a clip in an OCCUPIED slot grows the PROJECT, silently', () => {
  // ⚠⚠ The trap, not the mitigation. Bitwig neither refuses nor overwrites: it
  // appends a row at the end of the project and puts the clip out there. The
  // clip already in the slot is untouched, so nothing about the addressed row
  // looks wrong — which is why a 10-scene project reached 170 with nobody
  // creating a scene.
  const model = new ProjectModel();
  model.sceneCount = 4;
  const track = model.createTrack('gn-A');
  model.setSlotContent(track, 0, true);
  track.slots[0]!.lengthBeats = 4;

  model.appendSceneForOverflowingClip(track, 8);

  assert.equal(model.sceneCount, 5, 'the PROJECT grew a row');
  assert.equal(track.slots[0]!.hasContent, true, 'and the clip that was there is untouched');
  assert.equal(track.slots[0]!.lengthBeats, 4, 'including its length — this is not an overwrite');
  assert.equal(track.slots[4]!.hasContent, true, 'the new clip is in the appended row');
});

test('T-append: the appended row is UNOBSERVED when it lands past the window', () => {
  // The two traps compounding, and the reason the growth was invisible: the row
  // is minted at the end of the project, so on anything bigger than the window
  // no observer exists there to report it.
  const model = new ProjectModel();
  model.sceneCount = 4;
  model.sceneBankSize = 4;
  const track = model.createTrack('gn-A');
  model.setSlotContent(track, 0, true);
  const epochBefore = model.contentEpoch;

  model.appendSceneForOverflowingClip(track, 4);

  assert.equal(model.sceneCount, 5);
  assert.equal(model.contentEpoch, epochBefore, 'no content event — there is no observer out there');
  assert.notEqual(model.sceneEpoch, 0, 'only the scene COUNT moved, which is the one tell');
});

// --- e17ai / E17ad / E18b: containers, and the two facts that gate them -------

test('T-ship: the two container types do not ship alike (e17ai, E18a)', () => {
  // ⚠ The bootstrap asymmetry the whole layer-chain lifecycle turns on, and the
  // reason a seed asset may be load-bearing for one destination and pointless
  // for another. An FX Layer can be grown from nothing — insert it, duplicate
  // its chain, repeat — while an Instrument Layer has no first chain to copy.
  const model = new ProjectModel();
  assert.equal(model.shippedChains(ProjectModel.FX_LAYER_UUID)?.length, 1);
  assert.equal(model.shippedChains(ProjectModel.INSTRUMENT_LAYER_UUID)?.length, 0);
  assert.equal(model.shippedChains('a9ffacb5-33e9-4fc7-8621-b1af31e410ef'), undefined,
    'an ordinary device is not a container at all');
  assert.deepEqual(model.shippedChains(ProjectModel.FX_LAYER_UUID)?.[0]?.devices, [],
    'and the chain it ships with is EMPTY (e17ai)');
});

/**
 * A chain fixture with a DISTINCT id, because the ids are what `mintedChain`
 * reads and two fixtures sharing one would make a create look like a no-op.
 *
 * ⚠ Counted rather than taken from `mintChannelId`, so a test can build a chain
 * without a model in hand — and deliberately not shaped like a real channelId,
 * because nothing may ever depend on the shape of a value that regenerates on
 * every project load (E18b).
 */
let fixtureChainId = 0;
const someChain = (name: string, devices: FakeChain['devices'] = []): FakeChain =>
  ({ name, solo: false, id: `fixture-chain-${++fixtureChainId}`, devices });

test('T-scope: a container is observable only in the first few device positions', () => {
  // ⚠ Not a fake limitation — `Rig.slotLayerBanks` are allocated at init (D7)
  // on `SLOT_SCOPES` top-level device slots, so a container further along the
  // chain has no bank to be read through. The model carries the same number so
  // an offline pass cannot certify a reach live Bitwig does not have.
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  for (let i = 0; i <= model.containerScopes; i++) {
    track.devices.push({ name: `dev-${i}`, paramsLive: true, params: [], chains: [someChain('A')] });
  }
  assert.notEqual(model.observeContainer(track, 0), undefined);
  assert.equal(model.observeContainer(track, model.containerScopes), undefined,
    'past the scopes nothing was looked at — which is not the same as nothing being there');
});

test('T-full: a chain bank filled to its size reads as INCOMPLETE, not as complete', () => {
  // ⚠⚠ The asymmetry that keeps a blind spot from reading as a tombstone. The
  // enumeration omits empty bank slots, so a dead-full bank and an overflowing
  // one produce identical replies — and only `chainsComplete: false` stops the
  // resolver answering `absent` for a chain it simply could not see.
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  const chains = Array.from({ length: model.chainBankSize }, (_, i) => someChain(`c${i}`));
  track.devices.push({ name: 'container', paramsLive: true, params: [], chains });
  const observed = model.observeContainer(track, 0)!;
  assert.equal(observed.chains.length, model.chainBankSize);
  assert.equal(observed.chainsComplete, false);

  track.devices[0]!.chains = chains.slice(0, model.chainBankSize - 1);
  assert.equal(model.observeContainer(track, 0)!.chainsComplete, true);
});

test('T-dupname: copying a container gives two chains ONE name (e17n)', () => {
  // The ambiguity fixture, and it is the ordinary outcome of duplication rather
  // than a contrived one: names are copied, ids are minted, and the ids are
  // worthless across a project load (E17ad, E18b). A resolver that took the
  // first hit would pick one of these at random.
  const model = new ProjectModel();
  const source = model.createTrack('gn-A');
  source.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('A take')],
  });
  const copy = model.duplicateTrack(source.channelId)!;
  assert.equal(copy.devices[0]!.chains?.[0]?.name, 'A take');
  assert.notEqual(copy.devices[0]!.chains, source.devices[0]!.chains, 'and it is a real copy');
});

test('T-create: a copied chain carries its source NAME and a fresh id (e17ak, e17n)', () => {
  // ⚠⚠ The fact the whole two-step verb exists for. `Channel.duplicate()` gives
  // the copy its source's name, so the container is momentarily ambiguous and
  // nothing name-shaped can say which chain is new. A fake that named the copy
  // something helpful would make the offline suite certify a create whose live
  // readback cannot possibly work.
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('A take')],
  });

  const copy = model.duplicateChain(track, 0, 'A take')!;
  assert.equal(copy.name, 'A take', 'the copy arrives wearing the source name');
  assert.notEqual(copy.id, track.devices[0]!.chains![0]!.id, 'and is a different object');
  assert.deepEqual(track.devices[0]!.chains!.map((c) => c.name), ['A take', 'A take']);

  // ...which is exactly the state the resolver must refuse until the rename.
  const observed = model.observeContainer(track, 0)!;
  assert.deepEqual(chainLookup(observed, 'A take'), { ok: false, miss: 'ambiguous' });

  // The rename is BY ID, and it resolves the ambiguity for both names at once.
  assert.equal(model.renameChain(track, 0, copy.id, 'B take'), true);
  const settled = model.observeContainer(track, 0)!;
  assert.equal(chainLookup(settled, 'A take').ok, true, 'the source is addressable again');
  const found = chainLookup(settled, 'B take');
  assert.equal(found.ok && found.chain.id, copy.id, 'and the new name names the chain we made');
});

test('T-create: renaming by an id the container does not hold changes NOTHING', () => {
  // ⚠ The fail-closed direction. A rename that fell back to a position would
  // rename the SOURCE and leave the copy wearing the source's name — breaking
  // every address anyone held, silently.
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('A take')],
  });
  assert.equal(model.renameChain(track, 0, 'no-such-id', 'B take'), false);
  assert.equal(track.devices[0]!.chains![0]!.name, 'A take');
});

test('T-create: a copy of a chain holding devices holds its OWN copies of them', () => {
  // Nothing in this slice can put a device in a chain, so the model is written
  // for the chain the fill verb will produce rather than the one it can reach.
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  const inner = { name: 'Polysynth', paramsLive: true, params: [{ name: 'Param 1', value: 0.5 }] };
  track.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('A take', [inner])],
  });

  const copy = model.duplicateChain(track, 0, 'A take')!;
  assert.deepEqual(copy.devices.map((d) => d.name), ['Polysynth']);
  assert.notEqual(copy.devices[0], inner, 'deep, so editing one does not edit the other');
  assert.notEqual(copy.devices[0]!.params[0], inner.params[0]);
});

test('T-create: a source name the container does not hold copies nothing', () => {
  const model = new ProjectModel();
  const track = model.createTrack('gn-A');
  track.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('A take')],
  });
  assert.equal(model.duplicateChain(track, 0, 'nope'), undefined);
  assert.equal(model.duplicateChain(track, 1, 'A take'), undefined, 'and neither does a non-container');
  assert.equal(track.devices[0]!.chains!.length, 1);
});

test('T-create: the LAST bank slot is usable, and the create after it refuses', async () => {
  // ⚠⚠ The boundary the mint diff is written around. A container filled to its
  // bank width reports itself INCOMPLETE, because the enumeration omits nothing
  // past the window and a full bank is byte-identical to an overflowing one. If
  // the diff demanded completeness on both sides, this create would copy the
  // chain and then decline to name it — leaving it wearing the source's name,
  // every time, in every container's last slot.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.tracks.find((t) => t.channelId === first.channelId)!;
  const bank = adapter.model.chainBankSize;
  model.devices.push({
    name: 'container',
    paramsLive: true,
    params: [],
    chains: Array.from({ length: bank - 1 }, (_, i) => someChain(`c${i}`)),
  });
  const container = deviceAddress(track(first.channelId), 0);
  const source = chainAddress(container, 'c0');

  const filled = await adapter.apply({ ops: [{ op: 'chain.create', source, name: 'last' }] });
  assert.deepEqual(filled.minted[0], chainAddress(container, 'last'),
    'the chain that fills the bank is still identified and still named');
  const hit = (await adapter.resolve([chainAddress(container, 'last')])).resolved[0];
  assert.equal(hit?.found, true, 'and it resolves, because a visible name resolves either way');

  // ⚠ And now the bank IS full, so standing rule 5 refuses the next one before
  // anything is copied. A chain created past the window could be resolved by
  // nothing and removed by nothing — there is no typed chain delete at all.
  await assert.rejects(
    adapter.apply({ ops: [{ op: 'chain.create', source, name: 'overflow' }] }),
    /chain bank is full/,
  );
  assert.equal(model.devices[0]!.chains!.length, bank, 'nothing was copied');
});

test('T-create: two creates in ONE batch are SUMMED against the bank, not checked one at a time', async () => {
  // ⚠⚠ The regression, and it is the mistake `assertSceneRoom`'s header already
  // names one population up: nothing has been applied when the guard runs, so
  // every create in a batch sees the same reading, and checking each against it
  // independently is a post-hoc check wearing a precondition's clothes.
  //
  // Measured before the fix, on exactly this fixture: two creates against a
  // 3-of-4 container produced FIVE chains — one stranded past a bank that can
  // address four, unresolvable and with no typed delete to remove it — and both
  // stage receipts reported `ok: true`.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.tracks.find((t) => t.channelId === first.channelId)!;
  const bank = adapter.model.chainBankSize;
  model.devices.push({
    name: 'container',
    paramsLive: true,
    params: [],
    chains: Array.from({ length: bank - 1 }, (_, i) => someChain(`c${i}`)),
  });
  const container = deviceAddress(track(first.channelId), 0);
  const source = chainAddress(container, 'c0');

  await assert.rejects(
    adapter.apply({
      ops: [
        { op: 'chain.create', source, name: 'x1' },
        { op: 'chain.create', source, name: 'x2' },
      ],
    }),
    /would leave the container holding 5 chains in a bank 4 wide/,
  );
  // ⚠ The WHOLE batch is refused, so not even the first create ran. A create
  // that landed and a create that was refused cannot be mixed here: there is no
  // typed delete, so a partial batch is a partial batch forever.
  assert.equal(model.devices[0]!.chains!.length, bank - 1, 'nothing was copied');
});

test('T-create: two creates in ONE batch cannot claim the same name', async () => {
  // ⚠ Measured before the fix: this produced ["src", "dup", "dup"] with both ops
  // reporting `ok: true`, and `resolve` then answering `ambiguous` for the only
  // address either of them could be addressed by.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.tracks.find((t) => t.channelId === first.channelId)!;
  model.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('src')],
  });
  const container = deviceAddress(track(first.channelId), 0);
  const source = chainAddress(container, 'src');

  await assert.rejects(
    adapter.apply({
      ops: [
        { op: 'chain.create', source, name: 'dup' },
        { op: 'chain.create', source, name: 'dup' },
      ],
    }),
    /"dup" is already used by a chain in this container at the point this op runs/,
  );
  assert.deepEqual(model.devices[0]!.chains!.map((c) => c.name), ['src']);
});

test('T-create: a chain an EARLIER create in the batch made is a usable source', async () => {
  // The positive half of the same projection, and the reason it tracks names
  // rather than just counting: the guard reasons about the container as the
  // creates before it leave it, so a batch can build a chain and then copy it.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.tracks.find((t) => t.channelId === first.channelId)!;
  model.devices.push({
    name: 'container', paramsLive: true, params: [], chains: [someChain('src')],
  });
  const container = deviceAddress(track(first.channelId), 0);

  const receipt = await adapter.apply({
    ops: [
      { op: 'chain.create', source: chainAddress(container, 'src'), name: 'a' },
      { op: 'chain.create', source: chainAddress(container, 'a'), name: 'b' },
    ],
  });

  assert.deepEqual(model.devices[0]!.chains!.map((c) => c.name).sort(), ['a', 'b', 'src']);
  assert.deepEqual(receipt.minted[1], chainAddress(container, 'b'));
  assert.deepEqual(receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok), []);
});

test('T-create: a container inside a chain is refused — no route reaches that deep', async () => {
  // The depth seam, still where step 6a put it. `chain.create` declares its
  // container as a device address, so `assertDevicesRoutable` refuses a nested
  // one for free rather than sending its `chainIndex` as a top-level position.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const outer = chainAddress(deviceAddress(track(first.channelId), 0), 'outer');
  const nested = chainAddress(deviceInAddress(outer, 0), 'inner');
  await assert.rejects(
    adapter.apply({ ops: [{ op: 'chain.create', source: nested, name: 'x' }] }),
    /device-layer chain/,
  );
});

test('T-ambig: the fake ADAPTER refuses a duplicated chain name, exactly as live does', async () => {
  // ⚠ This case cannot be built live yet, and that is why it is here rather than
  // in the conformance suite: producing two same-named chains in ONE container
  // needs chain duplication, which is measured (`e17ak`) but not promoted. The
  // fake can build the fixture today, so the shared resolver's ambiguity path is
  // proven offline now and becomes a two-sided conformance row the moment the
  // create verb lands.
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.tracks.find((t) => t.channelId === first.channelId)!;
  model.devices.push({
    name: 'container',
    paramsLive: true,
    params: [],
    chains: [someChain('A take'), someChain('A take')],
  });

  const target = chainAddress(deviceAddress(track(first.channelId), 0), 'A take');
  const hit = (await adapter.resolve([target])).resolved[0];
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'ambiguous' });

  // ⚠ And the READ answers nothing rather than picking one. A refusal belongs on
  // `resolve`, which is the call made before acting; a stash is not the place to
  // discover that an address named two objects.
  const snapshot = await adapter.read([target]);
  assert.equal(snapshot.entries[addressKey(target)], undefined);
  assert.deepEqual(snapshot.missing.map(addressKey), [addressKey(target)]);
});

test('T-direct-param: observer settlement and stale generations are explicit', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  const device = {
    name: 'Polysynth',
    paramsLive: false,
    params: Array.from({ length: 12 }, (_, index) => ({
      id: `P${index + 1}`, name: `Parameter ${index + 1}`, value: index / 12,
    })),
  };
  model.devices.push(device);
  const address = paramAddress(deviceAddress(track(first.channelId), 0), 'P1');

  const settling = await adapter.read([address]);
  assert.deepEqual(settling.unstable.map(addressKey), [addressKey(address)]);
  device.paramsLive = true;
  adapter.model.staleParameterInventories = 1;
  const stale = await adapter.read([address]);
  assert.deepEqual(stale.unstable.map(addressKey), [addressKey(address)]);
  const stable = await adapter.read([address]);
  assert.equal(stable.entries[addressKey(address)]?.value.of, 'param');
  assert.equal(adapter.model.parameterObservationGeneration, 3);
});

test('T-direct-param: a non-taking write is accepted but leaves exact readback unchanged', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  model.devices.push({
    name: 'Polysynth', paramsLive: true,
    params: [{ id: 'P1', name: 'Parameter 1', value: 0.25 }],
  });
  const address = paramAddress(deviceAddress(track(first.channelId), 0), 'P1');
  adapter.model.parameterWritesTake = false;
  await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.75 }] });
  await adapter.settle('tick');
  const readback = await adapter.read([address]);
  const entry = readback.entries[addressKey(address)];
  assert.equal(entry?.value.of === 'param' ? entry.value.param.value : undefined, 0.25);
});

test('T-direct-param: device re-indexing invalidates the prior parameter position', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  model.devices.push(
    { name: 'A', paramsLive: true, params: [{ id: 'A1', name: 'A 1', value: 0.1 }] },
    { name: 'B', paramsLive: true, params: [{ id: 'B1', name: 'B 1', value: 0.2 }] },
  );
  const stale = paramAddress(deviceAddress(track(first.channelId), 1), 'B1');
  assert.equal((await adapter.resolve([stale])).resolved[0]?.found, true);
  adapter.model.deleteDevice(model, 0);
  const resolved = (await adapter.resolve([stale])).resolved[0];
  assert.deepEqual({ found: resolved?.found, reason: resolved?.reason },
    { found: false, reason: 'absent' });
});

test('4f: recursive parameter routing reads and writes at measured depth 2', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  const leaf = {
    name: 'Leaf', paramsLive: true,
    params: [{ id: 'P1', name: 'Depth', value: 0.25 }],
  };
  const inner = { name: 'Inner container', paramsLive: true, params: [], chains: [someChain('Inner', [leaf])] };
  model.devices.push({
    name: 'Outer container', paramsLive: true, params: [], chains: [someChain('Outer', [inner])],
  });
  const top = deviceAddress(track(first.channelId), 0);
  const level1 = deviceInAddress(chainAddress(top, 'Outer'), 0);
  const deep = deviceInAddress(chainAddress(level1, 'Inner'), 0);
  const target = paramAddress(deep, 'P1');

  const before = await adapter.read([deep, target]);
  assert.equal(before.entries[addressKey(deep)]?.value.of, 'device');
  assert.equal(before.entries[addressKey(target)]?.value.of, 'param');
  await adapter.apply({ ops: [{ op: 'param.set', param: target, value: 0.75 }] });
  await adapter.settle('tick');
  const after = await adapter.read([target]);
  const afterEntry = after.entries[addressKey(target)];
  assert.equal(afterEntry?.value.of === 'param' ? afterEntry.value.param.value : undefined, 0.75);
});

test('4f: duplicate, empty and outside-window layer paths stay distinct', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  const leaf = { name: 'Leaf', paramsLive: true, params: [{ id: 'P1', name: 'P1', value: 0.2 }] };
  model.devices.push({
    name: 'Container', paramsLive: true, params: [],
    chains: [someChain('dup', [leaf]), someChain('dup', [leaf])],
  });
  const top = deviceAddress(track(first.channelId), 0);
  const duplicate = paramAddress(deviceInAddress(chainAddress(top, 'dup'), 0), 'P1');
  const ambiguous = (await adapter.resolve([duplicate])).resolved[0];
  assert.equal(ambiguous?.reason, 'ambiguous');

  model.devices[0]!.chains = [];
  const empty = (await adapter.resolve([duplicate])).resolved[0];
  assert.equal(empty?.reason, 'absent');

  model.devices[0]!.chains = Array.from(
    { length: adapter.model.chainBankSize + 1 }, (_, index) => someChain(`c${index}`),
  );
  const blind = (await adapter.resolve([duplicate])).resolved[0];
  assert.equal(blind?.reason, 'outside-bank-window');
});

test('4f: a drum pad is addressed by channel and selects its first device', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  const pads: import('./model.js').FakeDevice[][] = [];
  pads[3] = [{
    name: 'Pad synth', paramsLive: true,
    params: [{ id: 'P1', name: 'Tone', value: 0.4 }],
  }];
  const container = { name: 'Drum Machine', paramsLive: true, params: [], drumPads: pads };
  model.devices.push(container);
  const top = deviceAddress(track(first.channelId), 0);
  const target = paramAddress(deviceInAddress(drumPadAddress(top, 3), 0), 'P1');
  assert.equal((await adapter.resolve([target])).resolved[0]?.found, true);
  assert.equal((await adapter.read([target])).entries[addressKey(target)]?.value.of, 'param');
});

test('4f: remote pages enumerate and one named control round-trips', async () => {
  const adapter = new FakeAdapter({ tracks: ['gn-A'] });
  const first = (await adapter.tracks())[0]!;
  const model = adapter.model.findByChannelId(first.channelId)!.track;
  model.devices.push({
    name: 'Remote device', paramsLive: true, params: [],
    remotePages: [{
      name: 'Filter',
      controls: [{ name: 'Cutoff', value: 0.3, modulatedValue: 0.45 }],
    }],
  });
  const device = deviceAddress(track(first.channelId), 0);
  const inventoryAddress = remotesAddress(device);
  const controlAddress = remoteAddress(device, 0, 'Filter', 0, 'Cutoff');
  const inventory = await adapter.read([inventoryAddress, controlAddress]);
  const pages = inventory.entries[addressKey(inventoryAddress)];
  assert.equal(pages?.value.of === 'remotes' ? pages.value.remotes.pages[0]?.name : undefined, 'Filter');
  const control = inventory.entries[addressKey(controlAddress)];
  assert.equal(control?.value.of === 'remote' ? control.value.remote.modulatedValue : undefined, 0.45);
  await adapter.apply({ ops: [{ op: 'remote.set', remote: controlAddress, value: 0.7 }] });
  await adapter.settle('tick');
  const after = await adapter.read([controlAddress]);
  const afterEntry = after.entries[addressKey(controlAddress)];
  assert.equal(afterEntry?.value.of === 'remote' ? afterEntry.value.remote.value : undefined, 0.7);
});
