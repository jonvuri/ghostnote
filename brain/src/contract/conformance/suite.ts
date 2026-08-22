/**
 * The conformance suite — one set of cases, two adapters.
 *
 * PHASE-0 §Risks names the classic failure of fake adapters: "the fake diverges
 * from live Bitwig and starts certifying wrong behaviour". The mitigations it
 * prescribes are (a) every modelled trap cites its experiment, and (b) the
 * archived probes stay runnable as the live cross-check. This file is the third
 * and strongest one: the SAME assertions run against the fake offline and against
 * real Bitwig on demand, so divergence is a failing test rather than a slow
 * realisation.
 *
 * Run offline by `conformance/fake.test.ts` (picked up by `npm test`), and live
 * by `src/probes/conformance.live.ts` (`npm run probe:conformance`). The
 * `.live.ts` suffix keeps the live entry point out of the `*.test.ts` glob, so
 * `npm test` can never accidentally try to reach a DAW.
 *
 * What CANNOT be in here:
 *   - anything using `TrapControl` — it is not on `BitwigAdapter`, by design;
 *   - assertions on real durations, which are tautological against a virtual clock;
 *   - anything needing a human at the keyboard (E6/E8b interference, E14).
 * Those stay probes.
 *
 * ⚠ This file imports `engine/` as well as the contract, which looks backwards
 * for something living under `contract/`. It is deliberate: PHASE-1 session 1's
 * exit criterion 6 is "new conformance cases so session 5 can run the same
 * assertions live with no new test code", and the executor's claims — a revert
 * round-trips, a stale revision rejects whole, an empty slot is refused — are
 * exactly the ones that must hold on BOTH adapters. Putting them anywhere else
 * would mean writing them twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, InvalidOpError, NOTE_PROP_FIDELITY,
  SlotOccupiedError, addressKey, chain, clip, clipLaunch, clipMetadata, contentTouching, deltaComplete, device, deviceIn,
  notes as notesAt, param, scene, slot, track,
  type Address, type BitwigAdapter, type DeviceAddress, type NoteRecord, type ObservedContainer,
  type Op, type Snapshot, type TrackAddress,
} from '../index.js';
import { Executor, branchProtected, UnprotectedWriteError } from '../../engine/index.js';

export interface ConformanceCapabilities {
  readonly hasRealBitwig: boolean;
  readonly hasDeterministicClock: boolean;
  readonly canOverflowBank: boolean;
  readonly canInjectInterference: boolean;
  readonly hasDeviceModel: boolean;
}

export interface AdapterHarness {
  readonly name: 'fake' | 'live';
  readonly capabilities: ConformanceCapabilities;
  /** A fresh adapter with two empty instrument tracks available. */
  create(): Promise<{ adapter: BitwigAdapter; trackA: TrackAddress; trackB: TrackAddress }>;
  dispose(adapter: BitwigAdapter): Promise<void>;

  /**
   * Required when `capabilities.canOverflowBank`. Manufacturing 300 tracks in
   * someone's real project is not something a conformance run should do, so the
   * harness decides HOW to create the condition — the assertions stay shared.
   * Live evidence for the underlying behaviour is banked in probe e05b.
   */
  forceOverflow?(adapter: BitwigAdapter): void;
  /** Required when `canOverflowBank`: push one known track out of view. */
  hideTrack?(adapter: BitwigAdapter, track: TrackAddress): void;
  /**
   * ⚠ Required when `canOverflowBank`: leave the project holding more scene ROWS
   * than the scene bank can address, and return the first row that is outside.
   *
   * A separate hook from `forceOverflow` because the two conditions are separate
   * and one masks the other — a track-overflowing project refuses every write at
   * `assertBankVisible`, so it could never reach the scene refusals under test.
   *
   * ⚠ It is also the hook a live harness cannot implement, and the reason is the
   * finding: getting there costs a `scene.create` past the window, which strands a
   * row nothing can address or delete (E19). The live evidence is banked in
   * `probe:e21` instead, which measures the refusals from the other side — an
   * over-budget create is refused BEFORE the call, so it needs no oversized
   * project at all.
   */
  forceSceneOverflow?(adapter: BitwigAdapter): { readonly outsideRow: number };

  /**
   * Required when `capabilities.canInjectInterference`: make the world move the
   * way a human at the keyboard would, between our stash and our apply.
   *
   * The mechanism differs per adapter — the fake bumps its model counter, live
   * calls `revision.bump` — but E8's claim does not: a batch tagged with the old
   * revision then applies ZERO of its ops. Keeping the mechanism in the harness
   * is what lets the ASSERTION be shared.
   */
  bumpRevision?(adapter: BitwigAdapter): Promise<void>;
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

/** Register every portable case against `h`. Called once per adapter. */
export function runConformance(h: AdapterHarness): void {
  const label = (id: string, what: string) => `${id} [${h.name}]: ${what}`;

  /** Acquire one complete caller-owned boundary before a top-level insert. */
  async function acceptedDeviceBoundary(
    adapter: BitwigAdapter,
    target: TrackAddress,
  ): Promise<{ readonly names: readonly string[]; readonly enabled: readonly boolean[] }> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const observed = await adapter.devices(target);
      const enabled = observed.devices.map((item) => item.enabled);
      if (observed.devicesComplete
          && observed.bankSize !== undefined
          && enabled.every((value): value is boolean => value !== undefined)) {
        return { names: observed.devices.map((item) => item.name), enabled };
      }
      await adapter.settle('trackStruct');
    }
    assert.fail('the complete top-level device boundary did not settle');
  }

  /** Boilerplate: fresh adapter, a clip at scene 0 on track A, ready to write. */
  async function withClip(
    body: (ctx: {
      adapter: BitwigAdapter;
      trackA: TrackAddress;
      trackB: TrackAddress;
      epoch: number;
      clipA: ReturnType<typeof clip>;
    }) => Promise<void>,
  ): Promise<void> {
    const { adapter, trackA, trackB } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      const slotA = slot(trackA, scene(0, sceneEpoch));
      // ⚠⚠ DELETED FIRST, and it is not tidiness. `clip.create` into an OCCUPIED
      // slot appends a scene to the project (E21) — so this helper, run once per
      // case against a real project that keeps whatever the last case left, grew
      // the project by one row per test. It is what took a 10-scene project to
      // 170 in one afternoon, and the refusal that now stops it would fail every
      // case here instead. The fake gets a fresh model per case and so never saw
      // it; live it was every case after the first.
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: slotA }] });
      await adapter.settle('trackStruct');
      // ⚠ E2: the clip MUST exist before anything points at that slot, or the
      // cursor silently lands on a different clip and status looks healthy.
      await adapter.apply({ ops: [{ op: 'clip.create', slot: slotA, lengthBeats: 4 }] });
      await adapter.settle('trackStruct');
      // ⚠ And it must be EMPTY. The fake gets a fresh model per case, but a real
      // project keeps whatever the previous case wrote — so without this every
      // note assertion downstream reads someone else's leftovers and the two
      // adapters disagree for a reason that has nothing to do with Bitwig.
      await adapter.apply({ ops: [{ op: 'note.clear', clip: clip(slotA) }] });
      await adapter.settle('noteWrite');
      await body({ adapter, trackA, trackB, epoch: sceneEpoch, clipA: clip(slotA) });
    } finally {
      await h.dispose(adapter);
    }
  }

  /**
   * Remove the LAST scene row, back down to `was`.
   *
   * ⚠ From the end, always. `Scene.deleteObject()` compacts the rows below it
   * upward (E3), so removing a middle row stales every address beneath it
   * permanently — `probe:e20b`'s discipline, and the reason a suite that adds a
   * row has to take that one back rather than any row.
   */
  const giveBackLastScene = async (adapter: BitwigAdapter, was: number): Promise<void> => {
    const at = await adapter.revision();
    if (at.window.scenes.count <= was) return;
    await adapter.apply({ ops: [{ op: 'scene.delete', scene: scene(at.window.scenes.count - 1, at.sceneEpoch) }] });
    await adapter.settle('tick');
  };

  const readNotes = async (adapter: BitwigAdapter, address: Address): Promise<readonly NoteRecord[]> => {
    const snap = await adapter.read([address]);
    const entry = snap.entries[addressKey(address)];
    return entry?.value.of === 'notes' ? entry.value.notes : [];
  };

  // --- handshake -------------------------------------------------------------

  test(label('C-coverage', 'the round-trip note covers every property NOTE_PROP_FIDELITY calls exact'), () => {
    const exact = Object.entries(NOTE_PROP_FIDELITY).filter(([, f]) => f === 'exact').map(([k]) => k);
    assert.deepEqual(
      exact.filter((k) => !(k in EXACT_VALUES)),
      [],
      'a property promoted to `exact` must be given a value, or C-revert stops meaning ' +
        '"every writable expression property"',
    );
  });

  test(label('C-hello', 'reports the contract tag, its kind and its limits'), async () => {
    const { adapter } = await h.create();
    try {
      const info = await adapter.hello();
      assert.equal(info.contract, 'ghostnote/0');
      assert.equal(info.contractVersion, 0);
      assert.equal(info.kind, h.name);
      assert.ok(info.limits.trackBankSize > 0);
    } finally {
      await h.dispose(adapter);
    }
  });

  // --- addressing (E2f, E3, E5) ---------------------------------------------

  test(label('C-resolve', 'a durable channelId round-trips to a live index (E2f)'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const res = await adapter.resolve([trackA]);
      assert.equal(res.resolved[0]!.found, true);
      assert.equal(typeof res.resolved[0]!.index, 'number');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-resolve', 'an unknown channelId is a clean miss, never an alias (E2f)'), async () => {
    const { adapter } = await h.create();
    try {
      const ghost = track('deadbeef-0000-4000-8000-000000000000');
      const res = await adapter.resolve([ghost]);
      assert.equal(res.resolved[0]!.found, false);
      assert.equal(res.resolved[0]!.reason, 'absent');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-list', 'every enumerated track resolves, and the two agree about identity'), async () => {
    // ⚠ The enumeration is where a caller's first `channelId` comes from, so the
    // property that matters is not "it returns rows" — it is that every id it
    // hands out is one `resolve` accepts. A listing whose ids resolve to nothing
    // would be worse than no listing: the caller would address the world with
    // keys that look durable and are not (E2f, standing rule 2).
    const { adapter, trackA, trackB } = await h.create();
    try {
      const listed = await adapter.tracks();
      const ids = listed.map((t) => t.channelId);
      assert.ok(ids.includes(trackA.channelId), 'the fixture track is missing from the listing');
      assert.ok(ids.includes(trackB.channelId));
      assert.equal(new Set(ids).size, ids.length, 'a channelId appeared twice');

      const { resolved } = await adapter.resolve(ids.map((id) => track(id)));
      assert.deepEqual(
        resolved.filter((r) => !r.found).map((r) => r.address),
        [],
        'the listing offered an id that does not resolve',
      );
      // The same fact read the other way: a listed track reads back as itself.
      const snap = await adapter.read([track(ids[0]!)]);
      const entry = snap.entries[addressKey(track(ids[0]!))];
      assert.equal(entry?.value.of, 'track');
      if (entry?.value.of === 'track') assert.equal(entry.value.track.channelId, ids[0]);
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-epoch', 'a scene op bumps the epoch and stales prior addresses (E3)'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const start = await adapter.revision();
      const before = start.sceneEpoch;
      const stale = slot(trackA, scene(0, before));
      await adapter.apply({ ops: [{ op: 'scene.create', count: 1 }] });
      await adapter.settle('tick');

      const after = (await adapter.revision()).sceneEpoch;
      assert.notEqual(after, before, 'a scene op must invalidate scene-relative addresses');

      // ⚠ E3: a pinned cursor's sceneIndex goes PERMANENTLY stale after
      // compaction while looking healthy. Refusing is the only safe answer.
      const res = await adapter.resolve([stale]);
      assert.equal(res.resolved[0]!.found, false);
      assert.equal(res.resolved[0]!.reason, 'stale-epoch');

      // ⚠ GIVE IT BACK, from the END. This case and `C-content` below each left a
      // scene behind on every live run — slow next to the ~24 rows `clip.create`
      // was appending (E21), and the same failure: a suite that grows the project
      // it is run against eventually pushes it past the window, where rule 5
      // correctly refuses everything. E3 is why it must be the LAST row: a
      // mid-grid delete compacts every row beneath it, permanently.
      await giveBackLastScene(adapter, start.window.scenes.count);
    } finally {
      await h.dispose(adapter);
    }
  });

  // --- two-turn visibility (E2, E8-A) ---------------------------------------

  test(
    label('C-turn', 'a write is NOT visible to a read in the same turn (E2)'),
    // ⚠ Fake-only, and the reason is worth stating: the trap is absolutely real
    // in Bitwig (E2 measured setStep invisible to a getStep in the SAME request),
    // but `LiveAdapter.read` cannot observe it — pointing the cursor and setting
    // the grid are themselves several round-trips, so by the time it scans, the
    // write has long since landed. Asserting it against live would be asserting
    // that reads are instantaneous, which they are not.
    //
    // The live cross-check for this trap is probe e02, which drives
    // `cursor.setAndReadNote` — a handler that exists precisely to do both halves
    // inside one request, where the trap IS observable.
    { skip: !h.capabilities.hasDeterministicClock },
    async () => {
      await withClip(async ({ adapter, clipA }) => {
        const address = notesAt(clipA);
        await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note()] }] });
        assert.equal((await readNotes(adapter, address)).length, 0);
        await adapter.settle('noteWrite');
        assert.equal((await readNotes(adapter, address)).length, 1);
      });
    },
  );

  test(label('C-turn', 'the rule applies once per batch, not per op (E8-A)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const many = [0, 1, 2, 3].map((i) => note({ startBeats: i, pitch: 60 + i }));
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: many }] });
      await adapter.settle('noteWrite');
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 4);
    });
  });

  // --- note fidelity (E2, E8-E) ---------------------------------------------

  test(label('C-notes', 'a plain note round-trips exactly (E2)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const written = note({ startBeats: 1, pitch: 64, velocity: 100, durationBeats: 0.5 });
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [written] }] });
      await adapter.settle('noteWrite');
      const [got] = await readNotes(adapter, notesAt(clipA));
      assert.equal(got?.startBeats, 1);
      assert.equal(got?.pitch, 64);
      assert.equal(got?.durationBeats, 0.5);
    });
  });

  test(label('C-props', 'expression properties survive the grid change the write makes (E15-D)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      // ⚠ THE E15-D REGRESSION TEST. `note.write` emits `cursor.setStepSize`
      // before `cursor.setNotes`; the `note.props` stage that follows resolves
      // `clip.getStep`, which is unusable for ~120ms after that grid change and
      // discards every property written into the window — no error, no failed
      // op. Without `settleBefore: 'gridChange'` this case fails whenever the
      // cursor arrives on a different grid, which is precisely what a preceding
      // readback leaves behind. It is written to be order-DEPENDENT on purpose:
      // running it after a case that read notes back is the whole point.
      const written = note({ pan: -0.25, timbre: 0.3 });
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [written] }] });
      await adapter.settle('noteWrite');
      const [got] = await readNotes(adapter, notesAt(clipA));
      assert.ok(got, 'the note itself must exist');
      assert.equal(got.pan, -0.25, 'pan was written in a later stage and must have landed');
      assert.ok(Math.abs((got.timbre ?? 0) - 0.3) < 2e-3, `timbre must round-trip, got ${got.timbre}`);
    });
  });

  test(label('C-props', 'properties survive a write that MIXES plain and expressive notes (E15-D)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      // ⚠ The case C-props above cannot see, because it writes a single note and
      // so both stages inevitably agree about the grid.
      //
      // The create stage derives its grid from every note it writes; the
      // properties stage derives its grid from the notes IT holds. Filter the
      // properties stage down to the expressive notes and those two answers can
      // differ — here beat 0.5 forces the create onto a 0.5 grid while the lone
      // property-bearing note at beat 0 with duration 1 would put the props op on
      // a 1 grid. That op then emits a `setStepSize` that genuinely MOVES the
      // grid, in the same turn as its own `clip.getStep`, and `pan` is discarded
      // with no error — the `settleBefore` in front of the stage cannot help,
      // because the damage is done inside it (probe `e15d-props` §A).
      //
      // `splitNoteWrite` hands the props op the whole note set for exactly this
      // reason. Both notes are asserted, so a fix that quietly dropped the plain
      // one to dodge the problem would fail here too.
      const expressive = note({ startBeats: 0, pitch: 60, durationBeats: 1, pan: -0.25 });
      const plain = note({ startBeats: 0.5, pitch: 67, durationBeats: 0.5 });
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [expressive, plain] }] });
      await adapter.settle('noteWrite');

      const got = await readNotes(adapter, notesAt(clipA));
      assert.deepEqual(got.map((n) => n.pitch), [60, 67], 'both notes must exist');
      assert.equal(got[0]?.pan, -0.25, 'the expressive note keeps its pan');
      assert.equal(got[1]?.pan, undefined, 'the plain note gains nothing it did not ask for');
    });
  });

  test(label('C-twoclips', 'two clips addressed in ONE batch each get their own notes (E15-D)'), async () => {
    const { adapter, trackA, trackB } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      const clipA = clip(slot(trackA, scene(0, sceneEpoch)));
      const clipB = clip(slot(trackB, scene(0, sceneEpoch)));
      // ⚠ Deleted first — see `withClip`. A `clip.create` into an occupied slot
      // appends a scene to the project rather than failing (E21), so a case that
      // assumed an empty slot grew the project every time it ran.
      await adapter.apply({
        ops: [
          { op: 'clip.delete', slot: clipA.slot },
          { op: 'clip.delete', slot: clipB.slot },
        ],
      });
      await adapter.settle('trackStruct');
      await adapter.apply({
        ops: [
          { op: 'clip.create', slot: slot(trackA, scene(0, sceneEpoch)), lengthBeats: 4 },
          { op: 'clip.create', slot: slot(trackB, scene(0, sceneEpoch)), lengthBeats: 4 },
        ],
      });
      await adapter.settle('trackStruct');
      await adapter.apply({ ops: [{ op: 'note.clear', clip: clipA }, { op: 'note.clear', clip: clipB }] });
      await adapter.settle('noteWrite');

      // ⚠ Both writes ride in ONE `batch.run`, with a re-point between them.
      // E15-D measured that this is sound — `selectChannel`/`selectSlot`
      // retarget the cursor for the calls that FOLLOW them in the same turn,
      // and only the observable `cursor.status` lags. So ops addressing
      // different clips MAY share a stage, and the E8 batch win is kept.
      await adapter.apply({
        ops: [
          { op: 'note.write', clip: clipA, notes: [note({ pitch: 60 })] },
          { op: 'note.write', clip: clipB, notes: [note({ pitch: 67, startBeats: 1 })] },
        ],
      });
      await adapter.settle('noteWrite');

      assert.deepEqual((await readNotes(adapter, notesAt(clipA))).map((n) => n.pitch), [60]);
      assert.deepEqual((await readNotes(adapter, notesAt(clipB))).map((n) => n.pitch), [67]);

      // ⚠ E15-F. The same two clips, now carrying EXPRESSION, which is a
      // different problem: `note.props` resolves its note against the clip the
      // cursor held when the turn began, so a plan that let the two property
      // writes share a stage would silently lose one of them. `splitNoteWrite`
      // interleaves instead — write A, props A, write B, props B — and this is
      // the case that fails the moment anyone collapses that.
      await adapter.apply({ ops: [{ op: 'note.clear', clip: clipA }, { op: 'note.clear', clip: clipB }] });
      await adapter.settle('noteWrite');
      await adapter.apply({
        ops: [
          { op: 'note.write', clip: clipA, notes: [note({ pitch: 60, pan: -0.25 })] },
          { op: 'note.write', clip: clipB, notes: [note({ pitch: 67, startBeats: 1, pan: 0.5 })] },
        ],
      });
      await adapter.settle('noteWrite');
      assert.equal((await readNotes(adapter, notesAt(clipA)))[0]?.pan, -0.25,
        'clip A keeps its expression when two clips are written in one batch');
      assert.equal((await readNotes(adapter, notesAt(clipB)))[0]?.pan, 0.5,
        'and so does clip B — neither may be silently dropped');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-pressure', 'a write that asks for pressure is REFUSED, never silently lost (E15-E)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      // `NoteStep.setPressure` populates only the writing cursor's own NoteStep
      // cache: no other cursor can see it and it is gone as soon as that cursor
      // is re-pointed. Since `read` goes through the same pool cursor, a caller
      // would see it "work" on readback and lose it for real — and a snapshot
      // would record a value the clip does not contain. 16 of the other 17
      // properties persist under the identical test, so this is specific.
      await assert.rejects(
        adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ pressure: 0.9 })] }] }),
        /pressure cannot be written/,
        'a property the API accepts and discards must be refused, not attempted',
      );
      // And the refusal is total: nothing was applied on the way to it.
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 0);
    });
  });

  test(label('C-gain', 'the measured inverse makes gain exact through readback (E24)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
      await adapter.settle('noteWrite');
      const snap = await adapter.read([notesAt(clipA)]);
      const entry = snap.entries[addressKey(notesAt(clipA))]!;
      assert.equal(entry.fidelity, 'exact');
      assert.ok(entry.value.of === 'notes');
      assert.ok(Math.abs((entry.value.of === 'notes' ? entry.value.notes[0]?.gain ?? 0 : 0) - 0.7) <= 2e-3);
    });
  });

  test(label('C-adjacency', 'a snapshot reports what readback said, not what was asked (E8-E)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      // Four adjacent same-pitch dur=1 notes: Bitwig truncates each at the next.
      const written = [0, 0.25, 0.5, 0.75].map((startBeats) => note({ startBeats, durationBeats: 1 }));
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: written }] });
      await adapter.settle('noteWrite');
      const got = await readNotes(adapter, notesAt(clipA));
      assert.equal(got.length, 4);
      assert.ok(
        got.slice(0, 3).every((n) => n.durationBeats < 1),
        'a written duration is not guaranteed to survive; the take must store the readback',
      );
    });
  });

  // --- the write-set / revert primitive (§8b) -------------------------------

  test(label('C-stash', 'read -> write -> read-back -> restore is lossless for plain notes'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const address = notesAt(clipA);
      const original = [note({ startBeats: 0, pitch: 60 }), note({ startBeats: 2, pitch: 67 })];
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: original }] });
      await adapter.settle('noteWrite');

      // 1. stash exactly the addresses about to be written
      const stash: Snapshot = await adapter.read([address]);
      const before = stash.entries[addressKey(address)]!;
      assert.equal(before.value.of, 'notes');

      // 2. apply optimistically
      await adapter.apply({
        ops: [
          { op: 'note.clear', clip: clipA },
          { op: 'note.write', clip: clipA, notes: [note({ startBeats: 1, pitch: 72 })] },
        ],
      });
      await adapter.settle('noteWrite');
      assert.deepEqual((await readNotes(adapter, address)).map((n) => n.pitch), [72]);

      // 3. revert = replay the stash. No inverse-operation algebra needed.
      const stashed = before.value.of === 'notes' ? before.value.notes : [];
      await adapter.apply({
        ops: [{ op: 'note.clear', clip: clipA }, { op: 'note.write', clip: clipA, notes: stashed }],
      });
      await adapter.settle('noteWrite');
      assert.deepEqual((await readNotes(adapter, address)).map((n) => n.pitch), [60, 67]);
    });
  });

  // --- the revision guard (E8-D) --------------------------------------------

  test(label('C-revision', 'a batch claims the next revision on acceptance (E8-D)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const before = (await adapter.revision()).revision;
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note()] }] });
      assert.ok((await adapter.revision()).revision > before);
    });
  });

  test(label('C-revision', 'a stale ifRevision rejects the batch WHOLE, applying zero ops (E8-D)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const receipt = await adapter.apply({
        ifRevision: 9999,
        ops: [{ op: 'note.write', clip: clipA, notes: [note()] }],
      });
      assert.equal(receipt.accepted, false);
      assert.equal(receipt.rejected?.reason, 'stale-revision');
      assert.deepEqual(receipt.stages, [], 'nothing may be applied');
      await adapter.settle('noteWrite');
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 0);
    });
  });

  test(label('C-revision', 'a matching ifRevision applies normally'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const { revision } = await adapter.revision();
      const receipt = await adapter.apply({
        ifRevision: revision,
        ops: [{ op: 'note.write', clip: clipA, notes: [note()] }],
      });
      assert.equal(receipt.accepted, true);
      await adapter.settle('noteWrite');
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 1);
    });
  });

  // --- minted identity (E2c) -------------------------------------------------

  test(label('C-minted', 'track.create reports the channelId it actually got (E2c)'), async () => {
    const { adapter } = await h.create();
    try {
      const ops: Op[] = [{ op: 'track.create', name: 'gn-conf' }];
      const receipt = await adapter.apply({ ops });
      await adapter.settle('trackStruct');
      const created = receipt.minted[0];
      // createInstrumentTrack does not honour requested positions, so identity
      // can only come from reading back what was created.
      assert.ok(created, 'a create must report the identity it minted');
      assert.equal(created.kind, 'track');
      assert.equal((await adapter.resolve([created])).resolved[0]!.found, true);
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-track-copy', 'a track copy reports a fresh durable id and remains addressable (E16)'), async () => {
    const { adapter, trackA } = await h.create();
    let copied: TrackAddress | undefined;
    try {
      const before = await adapter.tracks();
      const source = before.find((t) => t.channelId === trackA.channelId);
      assert.ok(source, 'the source track must be observable before the write');

      const receipt = await adapter.apply({ ops: [{ op: 'track.duplicate', track: trackA }] });
      const minted = receipt.minted[0];
      assert.ok(minted, 'acknowledgement alone is not a successful copy receipt');
      assert.equal(minted.kind, 'track');
      if (minted.kind !== 'track') return;
      copied = minted;
      assert.notEqual(copied.channelId, trackA.channelId);
      assert.equal((await adapter.resolve([copied])).resolved[0]!.found, true);

      const after = await adapter.tracks();
      const copy = after.find((t) => t.channelId === copied!.channelId);
      assert.equal(copy?.name, source!.name, 'Bitwig first copies the source name');
      assert.equal(copy?.type, source!.type, 'the copied track keeps the measured source kind');

      await adapter.apply({
        ops: [{ op: 'track.rename', track: copied, name: 'gn-conf' }],
      });
      await adapter.settle('trackStruct');
      assert.equal((await adapter.tracks()).find((t) => t.channelId === copied!.channelId)?.name, 'gn-conf');
    } finally {
      if (copied !== undefined && (await adapter.resolve([copied])).resolved[0]?.found) {
        await adapter.apply({ ops: [{ op: 'track.delete', track: copied }] });
        await adapter.settle('trackStruct');
      }
      await h.dispose(adapter);
    }
  });

  test(
    label('C-device', 'an insert reports the chain index it PRODUCED, and the revert undoes it (D16 rev 2)'),
    // The first use of this capability, and a real one: the case needs a device
    // chain that behaves like a chain, not merely an adapter that accepts the op.
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      // ⚠ The case that would have caught the amendment shipping half-built. The
      // FAKE minted `device.insert` and the live adapter did not, so the inverse
      // D16 rev 2 claims — delete it at the index the receipt minted — existed
      // offline only, and nothing in this suite looked. That is PHASE-0 §Risks'
      // named failure mode aimed at a revert.
      const { adapter, trackA } = await h.create();
      const executor = new Executor(adapter);
      // Polysynth's real Bitwig UUID (E3, E4). The fake names its device after
      // whatever uuid it is handed, so one constant serves both adapters.
      const source = { from: 'bitwig', uuid: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef' } as const;
      const chainIndexOf = (receipt: { minted: Record<number, Address> }): number => {
        const address = receipt.minted[0];
        assert.ok(address, 'an insert must report the identity it minted (E2c, D20)');
        assert.equal(address.kind, 'device');
        return address.kind === 'device' ? address.chainIndex : -1;
      };

      try {
        const insert = async () => {
          const boundary = await acceptedDeviceBoundary(adapter, trackA);
          return executor.run([{
            op: 'device.insert', track: trackA, source,
            expectedChain: boundary.names,
            expectedEnabledChain: boundary.enabled,
          }]);
        };
        const first = await insert();
        const firstIndex = chainIndexOf(first.receipt);
        assert.equal(first.unrevertable.length, 0, 'an insert is no longer filed as having no inverse');

        // ⚠ The assertion that separates OBSERVED from COUNTED, and the reason it
        // is two inserts rather than one: an index hardcoded to 0, or counted from
        // the request rather than read off the chain, passes a single-insert case
        // and fails here. It also says nothing about where the chain started, so
        // it holds on a fixture track that already carries an instrument.
        const second = await insert();
        assert.equal(chainIndexOf(second.receipt), firstIndex + 1,
          'the second device lands one further along the chain the first one grew');

        // Reverted NEWEST FIRST, because a chain re-indexes on delete (E3) —
        // which is exactly the order `revertOps` emits for a multi-insert batch.
        await executor.revertUnchecked(second);
        await executor.revertUnchecked(first);

        // ⚠ And this is how we know both deletes actually landed, using nothing
        // but contract surface: there is no device READBACK in v0, so the chain's
        // state is only observable through where the NEXT insert reports landing.
        const again = await insert();
        assert.equal(chainIndexOf(again.receipt), firstIndex,
          'the chain is back to the length it started at, so the reverts removed what they claimed');
        await executor.revertUnchecked(again);
      } finally {
        // ⚠ LIVE RESIDUE, stated rather than guessed at: a case that fails
        // between an insert and its revert leaves that device in the fixture
        // chain. The assertions above are all RELATIVE, so a later run still
        // passes — but the chain grows, and a chain longer than the device bank
        // window stops minting at all (`blind`). If C-device starts failing on a
        // rig where it used to pass, look at the fixture track's chain first.
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-nested-device', 'nested parameter routing reports absence and does not mis-aim'),
    async () => {
      // A nested parameter has its own confirmed route. Other device writes
      // remain refused. A missing path must not fall back to a top-level device.
      const { adapter, trackA } = await h.create();
      try {
        const alt = chain(device(trackA, 0), 'gn-conf-alt');
        const inner = deviceIn(alt, 0);
        const innerParam = param(inner, 0);
        const resolution = await adapter.resolve([alt, inner, innerParam]);
        assert.deepEqual(
          resolution.resolved.map((r) => ({ found: r.found, reason: r.reason, index: r.index })),
          [
            { found: false, reason: 'absent', index: undefined },
            { found: false, reason: 'absent', index: undefined },
            { found: false, reason: 'absent', index: undefined },
          ],
          'a visible track anchor must not be promoted into false chain-family resolution',
        );
        // General device resolution still stops at one structural level. The
        // depth-2 parameter route does not use this structural shortcut.
        const deep = deviceIn(chain(deviceIn(chain(device(trackA, 0), 'outer'), 0), 'inner'), 0);
        const deepRes = await adapter.resolve([deep]);
        assert.deepEqual(
          { found: deepRes.resolved[0]?.found, reason: deepRes.resolved[0]?.reason },
          { found: false, reason: 'unsupported' },
        );
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'device.delete', device: inner }] }),
          /device-layer chain/,
        );
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'param.set', param: param(inner, 0), value: 0.5 }] }),
          /parameter.*(missing|absent)|target is absent/i,
        );
        // The route looked at the complete nested path and found no target.
        const snapshot = await adapter.read([alt, inner, innerParam]);
        for (const address of [alt, inner, innerParam]) {
          assert.equal(snapshot.entries[addressKey(address)], undefined,
            'no adapter may answer a chain-family read with top-level device state');
        }
        assert.deepEqual(snapshot.missing.map(addressKey), [alt, inner, innerParam].map(addressKey));
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-chain-observe', 'a real container\'s chains are observable, and every miss says which kind it is'),
    // Needs a device chain that behaves like one — the same capability `C-device`
    // gates on, and for the same reason: an adapter that merely accepts the op
    // would prove nothing here.
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      // ⚠⚠ THE BOOTSTRAP CASE. A chain is addressed by NAME, and nothing in this
      // system can invent one: the loader mints a chain's `channelId` afresh on
      // every project load (E17ad, E18b) so the name is all there is, and a name
      // has to be LEARNED before it can be addressed. The container's own read is
      // where it is learned — which is why `DeviceState.container` exists and why
      // no ninth adapter method was needed for it.
      //
      // ⚠ The fixture is a fresh FX Layer, because that is the container type
      // that ships with ONE chain (`e17ai`, re-confirmed at three destinations by
      // E18a). An Instrument Layer ships with zero and would make every
      // assertion below vacuous.
      const { adapter, trackA } = await h.create();
      const executor = new Executor(adapter);
      const FX_LAYER = { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' } as const;
      let inserted: Address | undefined;
      try {
        const receipt = await executor.run([{ op: 'device.insert', track: trackA, source: FX_LAYER }]);
        inserted = receipt.receipt.minted[0];
        assert.ok(inserted && inserted.kind === 'device', 'the insert must report where it landed');
        const container = inserted as ReturnType<typeof device>;

        const containerRead = await adapter.read([container]);
        const entry = containerRead.entries[addressKey(container)];
        assert.ok(entry, 'a container inside the observable scopes must read back');
        assert.equal(entry.value.of, 'device');
        const observed = entry.value.of === 'device' ? entry.value.device.container : undefined;
        assert.ok(observed, 'a container read carries the chains, or nothing can ever name one');
        assert.equal(observed.chains.length, 1, 'a fresh FX Layer ships with exactly one chain (e17ai)');
        // ⚠ NOT a literal. What a fresh container calls its one chain has never
        // been measured — E4c established only that a DEFAULT name tracks the
        // chain's content — so the name is read back and used, never asserted.
        const shipped = observed.chains[0]!;

        const alt = chain(container, shipped.name);
        const hit = (await adapter.resolve([alt])).resolved[0];
        assert.equal(hit?.found, true, 'the chain the container just reported must resolve by name');
        assert.equal(hit?.index, shipped.index, 'and at the position the container reported');

        // ⚠ The same container, a name it does not hold: `absent`, because the
        // view was complete. This is the assertion that separates a real lookup
        // from the step-6a stub, which answered `unsupported` for everything.
        const miss = (await adapter.resolve([chain(container, 'gn-conf-no-such-chain')])).resolved[0];
        assert.deepEqual({ found: miss?.found, reason: miss?.reason }, { found: false, reason: 'absent' });

        // ⚠ A container position with NO SCOPE is a fact about our reach, not
        // about the music — `outside-bank-window`, and `unreachable` on a read.
        // The layer banks are allocated at init (D7) on the first few device
        // slots only, so this is an ordinary position, not an extreme one.
        const far = chain(device(trackA, 9), 'anything');
        const blind = (await adapter.resolve([far])).resolved[0];
        assert.deepEqual({ found: blind?.found, reason: blind?.reason },
          { found: false, reason: 'outside-bank-window' });
        const blindRead = await adapter.read([far]);
        assert.deepEqual(blindRead.unreachable.map(addressKey), [addressKey(far)],
          'a container we cannot see must not be reported as empty');

        // The chain reads back as what was observed, and as nothing restorable.
        const chainRead = await adapter.read([alt]);
        const chainEntry = chainRead.entries[addressKey(alt)];
        assert.ok(chainEntry);
        assert.equal(chainEntry.value.of, 'chain');
        assert.equal(chainEntry.fidelity, 'none',
          'a chain has no typed delete and no create-from-nothing, so it is a record, not a restore plan');
        assert.equal(chainEntry.value.of === 'chain' && chainEntry.value.chain.name, shipped.name);

        // ⚠ A device INSIDE the shipped chain: the FX Layer's chain ships EMPTY,
        // so position 0 is absent — and absent is the answer only because the
        // device view was complete. Nothing in this slice can put a device in
        // there, which is exactly what the next one is for.
        const innerMiss = (await adapter.resolve([deviceIn(alt, 0)])).resolved[0];
        assert.deepEqual({ found: innerMiss?.found, reason: innerMiss?.reason },
          { found: false, reason: 'absent' });
      } finally {
        // ⚠ LIVE RESIDUE: the inserted container stays in the fixture chain if
        // an assertion above fails between the insert and here. Same hazard
        // `C-device` documents, and the same remedy — look at the fixture
        // track's chain first if this row starts failing where it used to pass.
        if (inserted?.kind === 'device') {
          await adapter.apply({ ops: [{ op: 'device.delete', device: inserted }] });
          await adapter.settle('trackStruct');
        }
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-chain-create', 'a chain is CREATED, named, and proved by resolving the name — not by the writer'),
    // Same capability gate as the two rows above, and for the same reason: an
    // adapter that merely accepted the op would prove nothing about a container.
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      // ⚠⚠ THE FIRST TYPED WRITE INSIDE A CONTAINER. `e17ak` closed chain
      // creation as fully autonomous — select the chain, then
      // `Channel.duplicate()` — after the whole spike had recorded it as
      // impossible, and after the sibling `DuplicableObject.duplicateObject()`
      // was found genuinely dead on the same object.
      //
      // ⚠ The fixture is a fresh FX Layer because that is the container type
      // that ships with ONE chain (`e17ai`, E18a at three destinations), and
      // this verb COPIES — it cannot make a chain out of nothing. An Instrument
      // Layer ships with zero and has no first chain to copy, which is the
      // bootstrap asymmetry the seed-asset question is about.
      const { adapter, trackA } = await h.create();
      const executor = new Executor(adapter);
      const FX_LAYER = { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' } as const;
      const SOURCE = 'gn-conf-source';
      const MADE = 'gn-conf-made';
      let inserted: Address | undefined;
      try {
        const insert = await executor.run([{ op: 'device.insert', track: trackA, source: FX_LAYER }]);
        inserted = insert.receipt.minted[0];
        assert.ok(inserted && inserted.kind === 'device', 'the insert must report where it landed');
        const container = inserted;

        // ⚠ The name is READ BACK, never assumed. What a fresh container calls
        // its one chain has never been measured — E4c established only that a
        // default name tracks the chain's content — so a literal here would be
        // asserting on the fixture rather than on Bitwig.
        const entry = (await adapter.read([container])).entries[addressKey(container)];
        const observed = entry?.value.of === 'device' ? entry.value.device.container : undefined;
        assert.ok(observed, 'a container read carries the chains, or nothing can name a source');
        const shipped = chain(container, observed.chains[0]!.name);
        const renamed = await executor.run([{ op: 'chain.rename', chain: shipped, name: SOURCE }]);
        assert.equal(renamed.report.failed.length, 0, 'the shipped entry is explicitly named before use');
        const source = chain(container, SOURCE);
        assert.equal((await adapter.resolve([source])).resolved[0]?.found, true,
          'the explicit source name resolves independently');
        assert.deepEqual(
          (await adapter.resolve([shipped])).resolved[0],
          { address: shipped, found: false, reason: 'absent' },
          'the old shipped name no longer resolves after the verified rename',
        );

        const made = await executor.run([{ op: 'chain.create', source, name: MADE }]);

        // ⚠⚠ THE ACCEPTANCE CRITERION, and the reason the op takes three round
        // trips. Success is INDEPENDENT RESOLUTION of the created chain: the
        // acknowledgement is identical whether or not anything happened (E6
        // blocker 4), and the writer's own selected handle is not evidence.
        const minted = made.receipt.minted[0];
        assert.ok(minted && minted.kind === 'chain', 'a create that could not be proved mints nothing');
        assert.equal(minted.name, MADE);
        const hit = (await adapter.resolve([minted])).resolved[0];
        assert.equal(hit?.found, true, 'the created chain resolves by the name the verb gave it');

        // ⚠ And the SOURCE still resolves under its own name. This is the half a
        // rename aimed at the wrong chain would break: the copy arrives wearing
        // the source's name, so picking wrong leaves the source renamed and the
        // copy impersonating it — with every prior address silently broken.
        const still = (await adapter.resolve([source])).resolved[0];
        assert.equal(still?.found, true, 'the source was not the chain that got renamed');

        // The container now holds one more chain than it shipped with, observed
        // rather than counted from the request.
        const after = (await adapter.read([container])).entries[addressKey(container)];
        const grown = after?.value.of === 'device' ? after.value.device.container : undefined;
        assert.equal(grown?.chains.length, observed.chains.length + 1);
        assert.deepEqual(
          [...(grown?.chains ?? [])].map((c) => c.name).sort(),
          [source.name, MADE].sort(),
        );

        // ⚠⚠ IT CANNOT BE TAKEN BACK, and the report says so rather than
        // implying a clean undo. Every typed chain delete refuses — both
        // `DeleteableObject` forms, each bracketed by a `Track` sibling deleting
        // in the same run (`e17al`, `e17am`) — so reduction is a different
        // operation (move the devices out, delete the container) that this verb
        // does not pretend to have.
        assert.equal(made.unrevertable.length, 1, 'a created chain is filed as having no inverse');
        assert.equal(made.unrevertable[0]?.op, 'chain.create');
        assert.match(made.unrevertable[0]?.why ?? '', /e17al/);

        // ⚠ A second create under the SAME name is refused before anything is
        // written, on both adapters, from the shared contract rule. Without it
        // the verb would manufacture exactly the ambiguity `lookupChain` exists
        // to refuse — and there is no delete to clean it up with.
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'chain.create', source, name: MADE }] }),
          /already used by a chain in this container/,
        );
        // ...and so is naming a copy after its own source, which is the same
        // hazard reached from the other side.
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'chain.create', source, name: source.name }] }),
          /leave two chains sharing one name/,
        );
        // ⚠⚠ And so are TWO creates in one batch claiming one name. Nothing has
        // been applied when the preconditions run, so both would be checked
        // against the same reading and both would pass — the post-hoc check
        // wearing a precondition's clothes, which `assertSceneRoom` already
        // names one population up. Measured before it was fixed: two creates
        // named the same thing produced two chains with that name, and both
        // stage receipts said `ok`. The whole batch refuses instead.
        await assert.rejects(
          adapter.apply({
            ops: [
              { op: 'chain.create', source, name: 'gn-conf-pair' },
              { op: 'chain.create', source, name: 'gn-conf-pair' },
            ],
          }),
          /already used by a chain in this container at the point this op runs/,
        );

        // ⚠⚠ DISTINCT names do not make a batch safe when its projected total
        // outgrows the fixed four-wide chain bank. The container has two chains
        // here (the shipped source and MADE), so this three-create batch would
        // place the last copy at position 4, outside every observable slot scope.
        // The projection must reject the WHOLE batch before even its first copy.
        await assert.rejects(
          adapter.apply({
            ops: [
              { op: 'chain.create', source, name: 'gn-conf-cap-a' },
              { op: 'chain.create', source, name: 'gn-conf-cap-b' },
              { op: 'chain.create', source, name: 'gn-conf-cap-c' },
            ],
          }),
          /would leave the container holding 5 chains in a bank 4 wide/,
        );
        const unchanged = (await adapter.read([container])).entries[addressKey(container)];
        const chainsNow = unchanged?.value.of === 'device' ? unchanged.value.device.container : undefined;
        assert.equal(chainsNow?.chains.length, observed.chains.length + 1,
          'all refusals happened before any copy was made');
        assert.deepEqual(
          [...(chainsNow?.chains ?? [])].map((c) => c.name).sort(),
          [source.name, MADE].sort(),
          'the refused batches left the container names unchanged',
        );

        // Nested device deletion is still unsupported. Nested parameter writes
        // use their own route and report that this new chain is empty.
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'device.delete', device: deviceIn(minted, 0) }] }),
          /device-layer chain/,
        );
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'param.set', param: param(deviceIn(minted, 0), 0), value: 0.5 }] }),
          /parameter.*(missing|absent)|target is absent/i,
        );
      } finally {
        // ⚠ LIVE RESIDUE, and worse here than for the rows above: there is no
        // typed route that removes a chain, so deleting the CONTAINER is the
        // only cleanup — which takes the created chain with it. If this row
        // fails between the insert and here, the fixture track keeps an FX Layer
        // with an extra chain in it; look there first.
        if (inserted?.kind === 'device') {
          await adapter.apply({ ops: [{ op: 'device.delete', device: inserted }] });
          await adapter.settle('trackStruct');
        }
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-chain-relocate', 'devices fill and leave chains with ordered structural proof'),
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      const { adapter, trackA } = await h.create();
      const executor = new Executor(adapter);
      const FX_LAYER = { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' } as const;
      const A = { from: 'bitwig', uuid: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef' } as const;
      const B = { from: 'bitwig', uuid: 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a' } as const;
      // A third measured Bitwig device, and the row needs a third NAME rather
      // than a third device: the restoration proof below can only see names.
      const C = { from: 'bitwig', uuid: '8f58138b-03aa-4e9d-83bd-a038c99a4ed5' } as const;
      let container: Address | undefined;
      const chainDevices = async (at: Address, name: string): Promise<string[]> => {
        assert.equal(at.kind, 'device');
        const entry = (await adapter.read([at])).entries[addressKey(at)];
        const observed = entry?.value.of === 'device' ? entry.value.device.container : undefined;
        const hit = observed?.chains.find((item) => item.name === name);
        assert.ok(hit, `chain ${name} must remain independently observable`);
        return hit.devices.map((item) => item.name);
      };
      try {
        await executor.run([{ op: 'device.insert', track: trackA, source: A }]);
        const beforeContainer = await adapter.read([device(trackA, 0)]);
        const beforeValue = beforeContainer.entries[addressKey(device(trackA, 0))]?.value;
        assert.equal(beforeValue?.of, 'device');
        const aName = beforeValue?.of === 'device' ? beforeValue.device.name : '';

        const inserted = await executor.run([{ op: 'device.insert', track: trackA, source: FX_LAYER }]);
        container = inserted.receipt.minted[0];
        assert.ok(container?.kind === 'device');
        const initial = (await adapter.read([container])).entries[addressKey(container)];
        const observed = initial?.value.of === 'device' ? initial.value.device.container : undefined;
        const containerName = initial?.value.of === 'device' ? initial.value.device.name : '';
        assert.ok(observed?.chains[0]);
        const shipped = chain(container, observed.chains[0].name);
        const madeFirst = await adapter.apply({ ops: [{
          op: 'chain.create', source: shipped, name: 'gn-conf-fill',
        }] });
        assert.equal(madeFirst.stages[0]?.ops[0]?.ok, true);
        let first = chain(container, 'gn-conf-fill');
        const madeAlt = await adapter.apply({ ops: [{
          op: 'chain.create', source: first, name: 'gn-conf-alt',
        }] });
        assert.equal(madeAlt.stages[0]?.ops[0]?.ok, true);
        let alt = chain(container, 'gn-conf-alt');

        const readName = async (index: number): Promise<string> => {
          const at = device(trackA, index);
          const value = (await adapter.read([at])).entries[addressKey(at)]?.value;
          assert.equal(value?.of, 'device');
          return value?.of === 'device' ? value.device.name : '';
        };

        // The whole projected request is checked before stage one. The first
        // source is valid and would move the container from 1 to 0; the later
        // projected source is absent. Neither adapter may let the first move
        // land before discovering that fact.
        const beforeInvalidRevision = (await adapter.revision()).revision;
        await assert.rejects(
          adapter.apply({ ops: [
            {
              op: 'chain.relocate',
              source: device(trackA, 0),
              destination: first,
              mode: 'move',
            },
            {
              op: 'chain.relocate',
              source: device(trackA, 7),
              destination: chain(device(trackA, 0), first.name),
              mode: 'move',
            },
          ] }),
          /no source device exists at projected position/,
        );
        assert.equal((await adapter.revision()).revision, beforeInvalidRevision,
          'a failed later source emitted zero stages');
        assert.equal(await readName(0), aName, 'the valid first source did not move');
        assert.deepEqual(await chainDevices(container, first.name), [],
          'the destination remained empty');

        // A sits BEFORE the container. Moving it in compacts the top-level list,
        // so independent destination readback must follow the container from
        // position 1 to position 0 rather than inspecting its now-empty old slot.
        const firstFill = await adapter.apply({ ops: [{
          op: 'chain.relocate', source: device(trackA, 0), destination: first, mode: 'move',
        }] });
        assert.equal(firstFill.stages[0]?.ops[0]?.ok, true,
          JSON.stringify(firstFill.stages[0]?.ops[0]));
        container = device(trackA, 0);
        first = chain(container, first.name);
        alt = chain(container, alt.name);

        await executor.run([{ op: 'device.insert', track: trackA, source: B }]);
        const bName = await readName(1);
        const secondFill = await adapter.apply({ ops: [{
          op: 'chain.relocate', source: device(trackA, 1), destination: first, mode: 'move',
        }] });
        assert.equal(secondFill.stages[0]?.ops[0]?.ok, true,
          JSON.stringify(secondFill.stages[0]?.ops[0]));
        assert.deepEqual(await chainDevices(container, first.name), [aName, bName],
          'repeated fills preserve device order');

        // Copy retains the top-level source and adds exactly one nested device.
        const copied = await adapter.apply({ ops: [{
          op: 'chain.relocate', source: deviceIn(first, 0), destination: alt, mode: 'copy',
        }] });
        assert.equal(copied.stages[0]?.ops[0]?.ok, true);
        assert.deepEqual(await chainDevices(container, first.name), [aName, bName]);
        assert.deepEqual(await chainDevices(container, alt.name), [aName]);

        // Chain→chain removes from the source and appends at the destination.
        const crossed = await adapter.apply({ ops: [{
          op: 'chain.relocate', source: deviceIn(first, 1), destination: alt, mode: 'move',
        }] });
        assert.equal(crossed.stages[0]?.ops[0]?.ok, true);
        assert.deepEqual(await chainDevices(container, first.name), [aName]);
        assert.deepEqual(await chainDevices(container, alt.name), [aName, bName]);

        // Chain→top extraction is proved by both the nested miss and top read.
        const extracted = await adapter.apply({ ops: [{
          op: 'chain.relocate', source: deviceIn(alt, 0), destination: trackA, mode: 'move',
        }] });
        assert.equal(extracted.stages[0]?.ops[0]?.ok, true);
        assert.deepEqual(await chainDevices(container, alt.name), [bName]);
        const top = await adapter.read([device(trackA, 1)]);
        assert.equal(top.entries[addressKey(device(trackA, 1))]?.value.of, 'device');

        // The collapse workflow's second relocation: a named tail device can be
        // restored before an existing top-level anchor, with full-order proof.
        const movedBeforeContainer = await adapter.apply({ ops: [{
          op: 'device.relocate',
          track: trackA,
          sourceFromEnd: 0,
          expectedName: aName,
          before: device(trackA, 0),
        }] });
        assert.equal(movedBeforeContainer.stages[0]?.ops.every((item) => item.ok), true,
          JSON.stringify(movedBeforeContainer.stages[0]?.ops));
        container = device(trackA, 1);
        first = chain(container, first.name);
        alt = chain(container, alt.name);
        const restoredContainer = await adapter.apply({ ops: [{
          op: 'device.relocate',
          track: trackA,
          sourceFromEnd: 0,
          expectedName: containerName,
          before: device(trackA, 0),
        }] });
        assert.equal(restoredContainer.stages[0]?.ops.every((item) => item.ok), true,
          JSON.stringify(restoredContainer.stages[0]?.ops));
        container = device(trackA, 0);
        first = chain(container, first.name);
        alt = chain(container, alt.name);

        // Leave exactly one nested slot free, then request two devices from two
        // valid sources. Capacity is cumulative over the request, so the first
        // copy must not land before the second is refused.
        for (let i = 0; i < 2; i += 1) {
          const prefill = await adapter.apply({ ops: [{
            op: 'chain.relocate', source: deviceIn(first, 0), destination: alt, mode: 'copy',
          }] });
          assert.equal(prefill.stages[0]?.ops[0]?.ok, true);
        }
        const beforeCapacity = (await adapter.read([container])).entries[addressKey(container)];
        const beforeCapacityRevision = (await adapter.revision()).revision;
        await assert.rejects(
          adapter.apply({ ops: [
            { op: 'chain.relocate', source: deviceIn(first, 0), destination: alt, mode: 'copy' },
            { op: 'chain.relocate', source: device(trackA, 1), destination: alt, mode: 'copy' },
          ] }),
          /complete request would leave 5 devices in a destination bank 4 wide/,
        );
        assert.equal((await adapter.revision()).revision, beforeCapacityRevision,
          'a cumulative-capacity refusal emitted zero stages');
        const afterCapacity = (await adapter.read([container])).entries[addressKey(container)];
        assert.deepEqual(afterCapacity, beforeCapacity,
          'source and destination structure stayed byte-for-byte unchanged');
        assert.equal(await readName(1), aName, 'the top-level source stayed in place');

        // The general nested-device refusal is untouched outside this verb.
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'device.delete', device: deviceIn(alt, 0) }] }),
          /device-layer chain/,
        );

        // ⚠⚠ The collapse fixture is built out of DISTINCT device names on
        // purpose, and that is a finding rather than tidiness. Restoration is
        // proved from a top-level NAME sequence — a device has no durable id to
        // diff — so two devices sharing a name make "it moved back" and "nothing
        // happened" the same reading, and the contract refuses such a batch
        // before its first frame (`reorderIndistinguishable`). The capacity
        // section above deliberately leaves two copies of A beside a top-level
        // A, which is exactly that shape. So the surplus copies are pushed into
        // the alternate that is about to be destroyed anyway, and a third
        // distinct device becomes the following anchor the restoration lands
        // before.
        const tidied = await adapter.apply({ ops: [
          { op: 'chain.relocate', source: deviceIn(alt, 2), destination: first, mode: 'move' },
          { op: 'chain.relocate', source: device(trackA, 1), destination: first, mode: 'move' },
        ] });
        assert.equal(tidied.stages.flatMap((stage) => stage.ops).every((item) => item.ok), true,
          JSON.stringify(tidied.stages));
        await executor.run([{ op: 'device.insert', track: trackA, source: C }]);
        const cName = await readName(1);
        assert.notEqual(cName, aName, 'the following anchor must be nameable apart from the winner');
        assert.deepEqual(await chainDevices(container, alt.name), [bName, aName],
          'the winner holds two distinctly named devices in order');

        // Collapse the named winner through the same guarded sequence the
        // production tool uses: exact state/order preflight, ordered extraction,
        // independent empty-chain proof, guarded container removal, then exact
        // restoration at the container's former signal position.
        const fullBefore = await adapter.devices(trackA);
        assert.equal(fullBefore.devicesComplete, true);
        const collapseRead = (await adapter.read([container])).entries[addressKey(container)];
        const collapseContainer = collapseRead?.value.of === 'device'
          ? collapseRead.value.device.container : undefined;
        const winner = collapseContainer?.chains.find((item) => item.name === alt.name);
        assert.ok(winner?.devicesComplete, 'the named winner device order must be complete');
        assert.equal(typeof winner.mute, 'boolean');
        assert.equal(typeof winner.solo, 'boolean');
        assert.equal(typeof winner.volume, 'number');
        assert.equal(typeof winner.pan, 'number');
        assert.ok(winner.color, 'the named winner colour must be observed');
        const winnerNames = winner.devices.map((item) => item.name);
        const initialNames = fullBefore.devices.map((item) => item.name);
        const extractedWinner = await adapter.apply({
          ops: winnerNames.map(() => ({
            op: 'chain.relocate' as const,
            source: deviceIn(alt, 0),
            destination: trackA,
            mode: 'move' as const,
          })),
        });
        assert.equal(extractedWinner.stages.flatMap((stage) => stage.ops).every((item) => item.ok), true,
          JSON.stringify(extractedWinner.stages));
        assert.deepEqual((await adapter.devices(trackA)).devices.map((item) => item.name),
          [...initialNames, ...winnerNames]);
        assert.deepEqual(await chainDevices(container, alt.name), [],
          'an independent nested read proves the winner empty before deletion');

        const removedContainer = await adapter.apply({ ops: [{
          op: 'device.delete', device: container, expectedName: containerName,
        }] });
        assert.equal(removedContainer.stages.flatMap((stage) => stage.ops).every((item) => item.ok), true,
          JSON.stringify(removedContainer.stages));
        const afterRemovalNames = initialNames.slice(1).concat(winnerNames);
        assert.deepEqual((await adapter.devices(trackA)).devices.map((item) => item.name),
          afterRemovalNames, 'only the guarded container was removed');

        if (initialNames[1] !== undefined) {
          const restoredWinner = await adapter.apply({
            ops: winnerNames.map((name, index) => ({
              op: 'device.relocate' as const,
              track: trackA,
              sourceFromEnd: winnerNames.length - 1 - index,
              expectedName: name,
              before: device(trackA, index),
            })),
          });
          assert.equal(restoredWinner.stages.flatMap((stage) => stage.ops).every((item) => item.ok), true,
            JSON.stringify(restoredWinner.stages));
        }
        assert.deepEqual((await adapter.devices(trackA)).devices.map((item) => item.name),
          [...winnerNames, ...initialNames.slice(1)],
          'the winner replaces the container without changing its signal position');
        container = undefined;
      } finally {
        if (container?.kind === 'device') {
          await adapter.apply({ ops: [{ op: 'device.delete', device: container }] });
          await adapter.settle('trackStruct');
        }
        // Extracted/collapsed devices remain top-level after the container goes.
        for (let guard = 0; guard < 8; guard += 1) {
          const at = device(trackA, 0);
          if ((await adapter.read([at])).entries[addressKey(at)] === undefined) break;
          await adapter.apply({ ops: [{ op: 'device.delete', device: at }] });
          await adapter.settle('trackStruct');
        }
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-chain-reduce', 'a proved replacement preserves two survivors before the old container is removed'),
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      const { adapter, trackA } = await h.create();
      const executor = new Executor(adapter);
      const FX_LAYER = { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' } as const;
      const A = { from: 'bitwig', uuid: 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef' } as const;
      const B = { from: 'bitwig', uuid: 'f2dcfe9a-7b66-4c84-984a-b25685a1c21a' } as const;
      let original: Address | undefined;
      let replacement: Address | undefined;
      const observed = async (at: Address): Promise<ObservedContainer> => {
        assert.equal(at.kind, 'device');
        const entry = (await adapter.read([at])).entries[addressKey(at)];
        const container = entry?.value.of === 'device' ? entry.value.device.container : undefined;
        assert.ok(container?.chainsComplete, 'the complete replacement structure must be readable');
        return container;
      };
      try {
        original = (await executor.run([{
          op: 'device.insert', track: trackA, source: FX_LAYER,
        }])).receipt.minted[0];
        assert.ok(original?.kind === 'device');
        const originalSeed = (await observed(original)).chains[0]!;
        await adapter.apply({ ops: [{
          op: 'chain.rename', chain: chain(original, originalSeed.name), name: 'gn-reduce-a',
        }] });
        await adapter.apply({ ops: [{
          op: 'chain.create', source: chain(original, 'gn-reduce-a'), name: 'gn-reduce-remove',
        }] });
        await adapter.apply({ ops: [{
          op: 'chain.create', source: chain(original, 'gn-reduce-remove'), name: 'gn-reduce-b',
        }] });

        replacement = (await executor.run([{
          op: 'device.insert', track: trackA, source: FX_LAYER,
        }])).receipt.minted[0];
        assert.ok(replacement?.kind === 'device');
        const replacementSeed = (await observed(replacement)).chains[0]!;
        await adapter.apply({ ops: [{
          op: 'chain.rename', chain: chain(replacement, replacementSeed.name), name: 'gn-reduce-a',
        }] });
        await adapter.apply({ ops: [{
          op: 'chain.create', source: chain(replacement, 'gn-reduce-a'), name: 'gn-reduce-b',
        }] });

        await executor.run([
          { op: 'device.insert', track: trackA, source: A },
          { op: 'device.insert', track: trackA, source: B },
        ]);
        const sourceNames = (await adapter.devices(trackA)).devices.slice(2).map((item) => item.name);
        assert.equal(sourceNames.length, 2);
        await adapter.apply({ ops: sourceNames.map(() => ({
          op: 'chain.relocate' as const,
          source: device(trackA, 2),
          destination: chain(original as DeviceAddress, 'gn-reduce-a'),
          mode: 'move' as const,
        })) });
        await adapter.apply({ ops: sourceNames.map(() => ({
          op: 'chain.relocate' as const,
          source: deviceIn(chain(original as DeviceAddress, 'gn-reduce-a'), 0),
          destination: chain(replacement as DeviceAddress, 'gn-reduce-a'),
          mode: 'move' as const,
        })) });
        await adapter.apply({ ops: [{
          op: 'chain.activate', chain: chain(original, 'gn-reduce-b'),
        }] });
        await adapter.apply({ ops: [{
          op: 'chain.activate', chain: chain(replacement, 'gn-reduce-b'),
        }] });

        const oldBeforeDelete = await observed(original);
        const replacementBeforeDelete = await observed(replacement);
        assert.deepEqual(oldBeforeDelete.chains.map((item) => item.name),
          ['gn-reduce-a', 'gn-reduce-remove', 'gn-reduce-b']);
        assert.deepEqual(
          oldBeforeDelete.chains.find((item) => item.name === 'gn-reduce-a')?.devices,
          [],
          'the preserved source is empty before deletion',
        );
        assert.deepEqual(replacementBeforeDelete.chains.map((item) => item.name),
          ['gn-reduce-a', 'gn-reduce-b']);
        assert.deepEqual(
          replacementBeforeDelete.chains.find((item) => item.name === 'gn-reduce-a')
            ?.devices.map((item) => item.name),
          sourceNames,
          'the complete multi-device survivor order is proved before deletion',
        );
        for (const survivor of replacementBeforeDelete.chains) {
          assert.equal(typeof survivor.mute, 'boolean');
          assert.equal(typeof survivor.solo, 'boolean');
          assert.equal(typeof survivor.volume, 'number');
          assert.equal(typeof survivor.pan, 'number');
          assert.ok(survivor.color);
        }
        assert.deepEqual(
          replacementBeforeDelete.chains.filter((item) => item.solo).map((item) => item.name),
          ['gn-reduce-b'],
        );

        const originalName = (await adapter.devices(trackA)).devices[0]!.name;
        const removed = await adapter.apply({ ops: [{
          op: 'device.delete', device: original, expectedName: originalName,
        }] });
        assert.equal(removed.stages.flatMap((stage) => stage.ops).every((item) => item.ok), true,
          JSON.stringify(removed.stages));
        replacement = device(trackA, 0);
        original = undefined;
        assert.equal((await adapter.devices(trackA)).devices.length, 1,
          'only the proved replacement remains');
        const final = await observed(replacement);
        assert.deepEqual(final.chains.map((item) => item.name), ['gn-reduce-a', 'gn-reduce-b']);
        assert.deepEqual(
          final.chains.find((item) => item.name === 'gn-reduce-a')
            ?.devices.map((item) => item.name),
          sourceNames,
        );
      } finally {
        // Both containers and all nested devices are owned by this row.
        for (let guard = 0; guard < 4; guard += 1) {
          const full = await adapter.devices(trackA);
          if (!full.devicesComplete || full.devices.length === 0) break;
          await adapter.apply({ ops: [{ op: 'device.delete', device: device(trackA, 0) }] });
          await adapter.settle('trackStruct');
        }
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-chain-switch', 'exclusive solo is proved locally and leaves another track unchanged'),
    { skip: !h.capabilities.hasDeviceModel },
    async () => {
      const { adapter, trackA, trackB } = await h.create();
      const executor = new Executor(adapter);
      const FX_LAYER = { from: 'bitwig', uuid: 'a0913b7f-096b-4ac9-bddd-33c775314b42' } as const;
      let containerA: Address | undefined;
      let containerB: Address | undefined;
      const insertContainer = async (track: TrackAddress): Promise<Address | undefined> => {
        const boundary = await acceptedDeviceBoundary(adapter, track);
        const inserted = await executor.run([{
          op: 'device.insert', track, source: FX_LAYER,
          expectedChain: boundary.names,
          expectedEnabledChain: boundary.enabled,
        }]);
        const minted = inserted.receipt.minted[0];
        if (minted?.kind === 'device') return minted;
        // Device insertion acknowledgement can precede the observer used by
        // minting. This switch row needs the independently observed position,
        // not the mint mechanism itself (C-device owns that assertion).
        const full = await adapter.devices(track);
        return full.devicesComplete && full.devices.length === 1
          ? device(track, full.devices[0]!.index)
          : undefined;
      };
      const observed = async (at: Address) => {
        assert.equal(at.kind, 'device');
        let value: ObservedContainer | undefined;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const entry = (await adapter.read([at])).entries[addressKey(at)];
          value = entry?.value.of === 'device' ? entry.value.device.container : undefined;
          if (value?.chainsComplete
              && value.chains.every((item) => typeof item.solo === 'boolean')) break;
          // A fresh layer bank can report its device before its sibling/state
          // observers populate. The product refuses that partial view; this live
          // conformance helper waits to assert the eventual exact observation.
          await adapter.settle('cursorPoint');
        }
        assert.ok(value?.chainsComplete, 'the whole sibling set must be observable');
        assert.ok(value.chains.every((item) => typeof item.solo === 'boolean'),
          'every chain must carry exact solo state');
        return value;
      };
      try {
        containerA = await insertContainer(trackA);
        containerB = await insertContainer(trackB);
        assert.ok(containerA?.kind === 'device' && containerB?.kind === 'device');

        const a0 = await observed(containerA);
        const b0 = await observed(containerB);
        assert.ok(a0.chains[0] && b0.chains[0]);
        const source = chain(containerA, a0.chains[0].name);
        const unrelatedBefore = b0.chains.map((item) => [item.name, item.solo]);
        const made = await adapter.apply({ ops: [{ op: 'chain.create', source, name: 'gn-conf-switch' }] });
        assert.equal(made.stages[0]?.ops[0]?.ok, true);
        const alternate = chain(containerA, 'gn-conf-switch');

        const first = await adapter.apply({ ops: [{ op: 'chain.activate', chain: source }] });
        assert.equal(first.stages[0]?.ops[0]?.ok, true, JSON.stringify(first.stages[0]?.ops[0]));
        const firstState = await observed(containerA);
        assert.deepEqual(firstState.chains.filter((item) => item.solo).map((item) => item.name),
          [source.name]);

        const switched = await adapter.apply({ ops: [{ op: 'chain.activate', chain: alternate }] });
        assert.equal(switched.stages[0]?.ops[0]?.ok, true,
          JSON.stringify(switched.stages[0]?.ops[0]));
        const finalState = await observed(containerA);
        assert.deepEqual(finalState.chains.filter((item) => item.solo).map((item) => item.name),
          [alternate.name], 'the addressed alternate is active and every sibling is inactive');
        assert.deepEqual(
          (await observed(containerB)).chains.map((item) => [item.name, item.solo]),
          unrelatedBefore,
          'an unrelated track did not change',
        );
      } finally {
        // Both are conformance-owned empty-device scratch tracks. Enumerate
        // rather than trusting mint receipts so a failed setup cannot strand a
        // container and poison the next run.
        for (const track of [trackA, trackB]) {
          for (let guard = 0; guard < 8; guard += 1) {
            const full = await adapter.devices(track);
            if (!full.devicesComplete || full.devices.length === 0) break;
            await adapter.apply({ ops: [{ op: 'device.delete', device: device(track, 0) }] });
            await adapter.settle('trackStruct');
          }
        }
        await h.dispose(adapter);
      }
    },
  );

  // --- staged application ----------------------------------------------------

  test(label('C-stage', 'instant ops coalesce and settling ops get their own stage (E8)'), async () => {
    await withClip(async ({ adapter, clipA, trackA }) => {
      const receipt = await adapter.apply({
        ops: [
          { op: 'note.write', clip: clipA, notes: [note()] },
          { op: 'track.rename', track: trackA, name: 'gn-renamed' },
        ],
      });
      assert.equal(receipt.accepted, true);
      assert.equal(receipt.stages.length, 2, 'a settling op must not share a stage');
      assert.equal(receipt.stages[0]!.settled, undefined);
      assert.equal(receipt.stages[1]!.settled, 'trackStruct');
    });
  });

  test(label('C-stage', 'apply resolves on completion, so the write is one settle away'), async () => {
    await withClip(async ({ adapter, trackA }) => {
      // Nothing is fire-and-forget: no delayMs, so no acceptance-only response.
      await adapter.apply({ ops: [{ op: 'track.rename', track: trackA, name: 'gn-done' }] });
      const snap = await adapter.read([trackA]);
      const entry = snap.entries[addressKey(trackA)]!;
      assert.equal(entry.value.of === 'track' ? entry.value.track.name : '', 'gn-done');
    });
  });

  // --- the bank window (E5) --------------------------------------------------

  test(
    label('C-track-room', 'the complete structural batch is refused before it can overflow the track window'),
    async () => {
      const { adapter, trackA } = await h.create();
      try {
        const before = await adapter.revision();
        const room = before.window.tracks.bankSize - before.window.tracks.count;
        assert.ok(room >= 0, 'the fixture project must fit inside its own track window');
        const ops: Op[] = Array.from({ length: room + 1 }, (_, index) => index % 2 === 0
          ? { op: 'track.create', name: `gn-room-${index}` }
          : { op: 'track.duplicate', track: trackA });

        await assert.rejects(adapter.apply({ ops }), BankWindowOverflowError);

        const after = await adapter.revision();
        assert.equal(after.window.tracks.count, before.window.tracks.count,
          'the budget covers creates and copies across the whole batch before mutation');
        assert.equal(after.revision, before.revision, 'a refused structural batch claims no revision');
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-bank', 'an overflowing project refuses to be written, loudly (E5)'),
    { skip: !h.capabilities.canOverflowBank },
    async () => {
      const { adapter, trackA } = await h.create();
      try {
        assert.ok(h.forceOverflow, 'canOverflowBank harness must provide forceOverflow');
        h.forceOverflow(adapter);
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'track.rename', track: trackA, name: 'nope' }] }),
          BankWindowOverflowError,
          'a partially-visible project is a checkpoint blind spot, not a slow read',
        );
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-bank', 'a track outside the window reads as unreachable, never as empty (E5)'),
    { skip: !h.capabilities.canOverflowBank },
    async () => {
      const { adapter, trackB } = await h.create();
      try {
        assert.ok(h.hideTrack, 'canOverflowBank harness must provide hideTrack');
        h.hideTrack(adapter, trackB);
        const snap = await adapter.read([trackB]);
        // Collapsing unreachable into missing is how a blind spot becomes a
        // silently empty snapshot and a revert that under-delivers.
        assert.deepEqual(snap.missing, []);
        assert.equal(snap.unreachable.length, 1);
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  // --- the SCENE window: rule 5's second population (E19, session 3c) --------

  test(
    label('C-scene-room', 'a scene.create past the window is refused BEFORE the call (rule 5)'),
    async () => {
      // ⚠ No oversized project needed, which is why this case runs LIVE as well
      // as offline. The refusal is a precondition, so asking for more rows than
      // any window could hold is refused without a single scene being created —
      // and that is the whole point: `scene.create` past the window strands a row
      // nothing can address or delete, so a post-hoc check runs after the damage
      // (E19, and rule 5's own words).
      const { adapter } = await h.create();
      try {
        const before = await adapter.revision();
        const room = before.window.scenes.bankSize - before.window.scenes.count;
        assert.ok(room >= 0, 'the fixture project must fit inside its own scene window');

        await assert.rejects(
          adapter.apply({ ops: [{ op: 'scene.create', count: room + 1 }] }),
          BankWindowOverflowError,
        );

        const after = await adapter.revision();
        assert.equal(after.window.scenes.count, before.window.scenes.count,
          'refused BEFORE the call — never a partial operation, and never a stranded row');
        assert.equal(after.sceneEpoch, before.sceneEpoch, 'and nothing moved the epoch either');
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-scene-room', 'two creates in ONE batch are summed, not checked one at a time'),
    async () => {
      // The post-hoc check wearing a precondition's clothes: each half fits, the
      // pair does not, and checking them separately lets the second one strand.
      const { adapter } = await h.create();
      try {
        const before = await adapter.revision();
        const room = before.window.scenes.bankSize - before.window.scenes.count;
        const half = Math.floor(room / 2) + 1;
        assert.ok(half <= room, 'the fixture needs room for one half but not for two');

        await assert.rejects(
          adapter.apply({
            ops: [{ op: 'scene.create', count: half }, { op: 'scene.create', count: half }],
          }),
          BankWindowOverflowError,
        );
        assert.equal((await adapter.revision()).window.scenes.count, before.window.scenes.count);
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-slot-free', 'a clip.create into an OCCUPIED slot is REFUSED, not a silent scene (E21)'),
    async () => {
      // ⚠⚠ The door the scene budget does not cover, and the one that was
      // actually open. `Track.createNewLauncherClip` on an occupied slot neither
      // fails nor overwrites: it APPENDS A SCENE at the end of the project and
      // puts the clip out there — past the window, unaddressable, un-deletable,
      // unobserved. Measured live at 169 -> 170 with every row inside the window
      // unchanged. A budget that only counts `scene.create` misses all of it.
      await withClip(async ({ adapter, clipA }) => {
        const before = await adapter.revision();
        await assert.rejects(
          adapter.apply({ ops: [{ op: 'clip.create', slot: clipA.slot, lengthBeats: 4 }] }),
          SlotOccupiedError,
        );
        const after = await adapter.revision();
        assert.equal(after.window.scenes.count, before.window.scenes.count,
          'refused before the call, so the project did not grow a row');
      });
    },
  );

  test(
    label('C-slot-free', 'and an EMPTY slot still takes a clip, so the refusal is not blanket'),
    async () => {
      const { adapter, trackA } = await h.create();
      try {
        const at = await adapter.revision();
        // A row this suite creates nothing in, cleared first so the case is
        // re-runnable against a real project.
        const target = slot(trackA, scene(4, at.sceneEpoch));
        await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
        await adapter.settle('trackStruct');

        const before = await adapter.revision();
        await adapter.apply({ ops: [{ op: 'clip.create', slot: target, lengthBeats: 4 }] });
        await adapter.settle('trackStruct');

        const entry = (await adapter.read([clip(target)])).entries[addressKey(clip(target))];
        assert.equal(entry?.value.of === 'clip' ? entry.value.exists : false, true);
        assert.equal((await adapter.revision()).window.scenes.count, before.window.scenes.count,
          'creating into an empty slot costs no scene');

        await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-scene-row', 'an op naming a row past the window is refused, applying nothing'),
    async () => {
      // ⚠ `encoder.ts` handed this straight to `sceneBank.getScene(i)` as a bank
      // index, and the bank is bounded to its window — so the throw came from the
      // MIDDLE of a batch, after whatever ran before it had already landed.
      // Also live-safe: nothing is created, and the row is refused unopened.
      const { adapter, trackA } = await h.create();
      try {
        const at = await adapter.revision();
        const outside = scene(at.window.scenes.bankSize + 4, at.sceneEpoch);

        await assert.rejects(
          adapter.apply({ ops: [{ op: 'scene.delete', scene: outside }] }),
          BlindSpotError,
        );
        // The same refusal for a clip op, because the slot bank is the same width.
        await assert.rejects(
          adapter.apply({
            ops: [{ op: 'clip.create', slot: slot(trackA, outside), lengthBeats: 4 }],
          }),
          BlindSpotError,
        );
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-scene-row', 'a row past the window resolves as outside-bank-window, not absent'),
    async () => {
      const { adapter, trackA } = await h.create();
      try {
        const at = await adapter.revision();
        // ⚠ A row inside the PROJECT and outside the WINDOW is the interesting
        // one, and only a project bigger than its window has any. Without that,
        // the honest answer for a far row is `absent` and this case would be
        // asserting the wrong thing — so it needs the harness hook.
        if (h.capabilities.canOverflowBank) {
          assert.ok(h.forceSceneOverflow, 'canOverflowBank harness must provide forceSceneOverflow');
          const { outsideRow } = h.forceSceneOverflow(adapter);
          const now = await adapter.revision();
          const row = slot(trackA, scene(outsideRow, now.sceneEpoch));
          const [resolved] = (await adapter.resolve([row])).resolved;
          assert.equal(resolved?.found, false);
          assert.equal(resolved?.reason, 'outside-bank-window',
            'invisible is not absent — collapsing them is how a revert under-delivers');
        }
        // A row past the PROJECT's own scene count is genuinely absent, on both
        // adapters and with no setup. The two answers must not be the same.
        const far = slot(trackA, scene(at.window.scenes.bankSize + 4, at.sceneEpoch));
        const [beyond] = (await adapter.resolve([far])).resolved;
        assert.equal(beyond?.found, false);
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-scene-row', 'blind clip ROWS are in Snapshot.unreachable, not a clean snapshot (B1c)'),
    { skip: !h.capabilities.canOverflowBank },
    async () => {
      // The under-delivery D5 forbids: `unreachable` reported blind TRACKS and
      // stayed silent about blind rows, so a project with more scenes than the
      // window produced a clean-looking snapshot of a grid whose lower half
      // nothing had looked at.
      const { adapter, trackA } = await h.create();
      try {
        assert.ok(h.forceSceneOverflow, 'canOverflowBank harness must provide forceSceneOverflow');
        const { outsideRow } = h.forceSceneOverflow(adapter);
        const at = await adapter.revision();
        const blind = clip(slot(trackA, scene(outsideRow, at.sceneEpoch)));

        const snap = await adapter.read([blind]);
        assert.deepEqual(snap.missing, [], 'a row we cannot see is not a row we saw was empty');
        assert.equal(snap.unreachable.length, 1);
        assert.equal(Object.keys(snap.entries).length, 0);
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-cover', 'a window that cannot see the whole project is NOT complete (B2)'),
    { skip: !h.capabilities.canOverflowBank },
    async () => {
      // ⚠⚠ The fourth way a window lies, and the only one the delta cannot notice
      // on its own: the observers are attached per bank row across `config.tracks`
      // on a slot bank sized by `config.scenes`, so an edit outside either window
      // fires NOTHING — and an empty event list then reads as "quiet" when it
      // means "we were not looking".
      const { adapter } = await h.create();
      try {
        assert.ok(h.forceSceneOverflow, 'canOverflowBank harness must provide forceSceneOverflow');
        h.forceSceneOverflow(adapter);
        const mark = await adapter.revision();
        const delta = await adapter.contentSince(mark);

        assert.deepEqual(delta.events, [], 'genuinely nothing to report...');
        assert.equal(delta.truncated, false, '...and none of the other three verdicts fires');
        assert.equal(delta.discontinuous, false);
        assert.equal(delta.uncovered, true, 'so this is the only thing standing between');
        assert.equal(delta.uncoveredIn, 'scenes');
        assert.equal(deltaComplete(delta), false,
          'an unobservable window must never read as an intact empty one');
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-cover', 'the TRACK dimension reports it too, and both together say so'),
    { skip: !h.capabilities.canOverflowBank },
    async () => {
      const { adapter } = await h.create();
      try {
        assert.ok(h.forceOverflow && h.forceSceneOverflow, 'harness must provide both hooks');
        h.forceOverflow(adapter);
        assert.equal((await adapter.contentSince(await adapter.revision())).uncoveredIn, 'tracks');
        h.forceSceneOverflow(adapter);
        assert.equal((await adapter.contentSince(await adapter.revision())).uncoveredIn, 'both');
      } finally {
        await h.dispose(adapter);
      }
    },
  );

  test(
    label('C-cover', 'a window that DOES cover the project is complete, so the flag can be believed'),
    async () => {
      // The control. Without it, a `uncovered` that was simply always true would
      // pass every case above and make the delta useless in the other direction.
      await withClip(async ({ adapter }) => {
        const mark = await adapter.revision();
        assert.equal(mark.window.tracks.count <= mark.window.tracks.bankSize, true);
        assert.equal(mark.window.scenes.count <= mark.window.scenes.bankSize, true);
        const delta = await adapter.contentSince(mark);
        assert.equal(delta.uncovered, false);
        assert.equal(delta.uncoveredIn, undefined);
        assert.ok(deltaComplete(delta));
      });
    },
  );

  test(label('C-slot', 'a notes read on a slot with NO clip is missing, never an empty clip (E2)'), async () => {
    // ⚠ The distinction the executor's E2 guard is built on, and a place the
    // fake and live could silently disagree: "there is no clip here" must not
    // present as "the clip is empty", or a write into a never-created slot looks
    // legal right up until the cursor lands on somebody else's clip.
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      // ⚠ Row 5 is one no case in this suite writes to — and "no case writes to
      // it" is not the same as "it is empty". A real project arrives with its own
      // clips, and this one did: the assertion below is about a slot with NO
      // CLIP, so the case has to establish that rather than assume it. The
      // suite's own rule, from `C-clip`: a case that only passes the first time
      // is worse than no case at all.
      const bare = notesAt(clip(slot(trackA, scene(5, sceneEpoch))));
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: slot(trackA, scene(5, sceneEpoch)) }] });
      await adapter.settle('trackStruct');
      const snap = await adapter.read([bare]);
      assert.equal(snap.entries[addressKey(bare)], undefined);
      assert.equal(snap.missing.length, 1);
    } finally {
      await h.dispose(adapter);
    }
  });

  // --- the executor (PHASE-1 session 1) --------------------------------------
  //
  // ⚠ These run the SAME pipeline offline and live. Session 5's exit-criteria
  // sweep is `npm run probe:conformance` with these in it and no new test code,
  // which is the whole reason the executor was written against the fake first.

  test(label('C-exec', 'the pipeline stashes prior state, applies, and verifies by readback (§8b)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const executor = new Executor(adapter);
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ pitch: 60 })] }] });
      await adapter.settle('noteWrite');

      const take = await executor.run([
        { op: 'note.clear', clip: clipA },
        { op: 'note.write', clip: clipA, notes: [note({ pitch: 67, startBeats: 1 })] },
      ]);

      assert.equal(take.report.applied, true);
      // The host clear is clip-wide, so all 16 channels are protected. The stash
      // is what readback reported before the batch, never what anyone requested.
      assert.equal(take.values.length, 16);
      const before = take.values[0]!.value;
      assert.deepEqual(before?.of === 'notes' ? before.notes.map((n) => n.pitch) : [], [60]);
      // ...and the verify half proves it landed, without a second read by hand.
      const after = take.verify.entries[addressKey(notesAt(clipA))]!;
      assert.deepEqual(after.value.of === 'notes' ? after.value.notes.map((n) => n.pitch) : [], [67]);
    });
  });

  test(label('C-exec', 'a note write into a slot with no clip is REFUSED, not attempted (E2)'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      // ⚠ Established, not assumed — see the note on row 5 in `C-slot`. The whole
      // case is about a slot with NO clip, so arriving at one is part of it.
      const bare = clip(slot(trackA, scene(6, sceneEpoch)));
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: bare.slot }] });
      await adapter.settle('trackStruct');
      await assert.rejects(
        new Executor(adapter).run([{ op: 'note.write', clip: bare, notes: [note()] }]),
        AddressUnresolvedError,
        'pointing at an empty slot lands on a DIFFERENT clip with a healthy status — the batch ' +
          'must never go out',
      );
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-revert', 'a full expression round-trip reverts to a byte-identical note set'), async () => {
    // ⚠ PHASE-1 SESSION-1 EXIT CRITERION 1, and the reason clips were chosen as
    // the object class to build the checkpoint engine on: `setStep` -> `getStep`
    // is exact for every property except the two that are labelled, so a revert
    // bug here is unambiguous rather than a fidelity argument.
    await withClip(async ({ adapter, clipA }) => {
      const address = notesAt(clipA);
      const executor = new Executor(adapter);
      const authored = [conformanceFullNote(), conformanceFullNote({ startBeats: 2, pitch: 67 })];

      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: authored }] });
      await adapter.settle('noteWrite');
      const baseline = await readNotes(adapter, address);
      assert.equal(baseline.length, 2, 'the fixture itself must have landed');

      const take = await executor.run([
        { op: 'note.clear', clip: clipA },
        { op: 'note.write', clip: clipA, notes: [note({ startBeats: 1, pitch: 72 })] },
      ]);
      assert.deepEqual((await readNotes(adapter, address)).map((n) => n.pitch), [72]);

      const reverted = await executor.revertUnchecked(take);
      assert.deepEqual(reverted.unrestored, [], 'nothing here is unverified or unwritable');
      assert.deepEqual(await readNotes(adapter, address), baseline);
    });
  });

  test(label('C-revert', 'a TWO-CLIP revert keeps the expression on both (E15-F)'), async () => {
    // ⚠ EXIT CRITERION 2. `revertOps` emits clear+write per clip and relies on
    // `planStages` keeping every generated `note.props` directly behind its own
    // create. Hoist them into one trailing stage and this case loses one clip's
    // expression, silently and with a clean receipt.
    const { adapter, trackA, trackB } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      const slotA = slot(trackA, scene(0, sceneEpoch));
      const slotB = slot(trackB, scene(0, sceneEpoch));
      const clipA = clip(slotA);
      const clipB = clip(slotB);
      // ⚠ Deleted first — see `withClip` and E21.
      await adapter.apply({
        ops: [{ op: 'clip.delete', slot: slotA }, { op: 'clip.delete', slot: slotB }],
      });
      await adapter.settle('trackStruct');
      await adapter.apply({
        ops: [
          { op: 'clip.create', slot: slotA, lengthBeats: 4 },
          { op: 'clip.create', slot: slotB, lengthBeats: 4 },
        ],
      });
      await adapter.settle('trackStruct');
      await adapter.apply({
        ops: [
          { op: 'note.clear', clip: clipA },
          { op: 'note.clear', clip: clipB },
        ],
      });
      await adapter.settle('noteWrite');
      await adapter.apply({
        ops: [
          { op: 'note.write', clip: clipA, notes: [note({ pitch: 60, pan: -0.25 })] },
          { op: 'note.write', clip: clipB, notes: [note({ pitch: 67, pan: 0.5 })] },
        ],
      });
      await adapter.settle('noteWrite');

      const executor = new Executor(adapter);
      const take = await executor.run([
        { op: 'note.clear', clip: clipA },
        { op: 'note.clear', clip: clipB },
      ]);
      assert.equal(take.values.length, 32, 'all channels of both clips are in the write-set');

      await executor.revertUnchecked(take);
      assert.equal((await readNotes(adapter, notesAt(clipA)))[0]?.pan, -0.25,
        'clip A must get its expression back');
      assert.equal((await readNotes(adapter, notesAt(clipB)))[0]?.pan, 0.5,
        'and so must clip B — neither may be silently dropped');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-exec', 'gain is captured and restored exactly through the measured inverse (E24)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const executor = new Executor(adapter);
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
      await adapter.settle('noteWrite');

      const take = await executor.run([
        { op: 'note.clear', clip: clipA },
        { op: 'note.write', clip: clipA, notes: [note({ pitch: 72 })] },
      ]);
      assert.equal(take.fidelity, 'exact');

      const reverted = await executor.revertUnchecked(take);
      assert.deepEqual(reverted.unrestored, []);
      assert.ok(Math.abs(((await readNotes(adapter, notesAt(clipA)))[0]?.gain ?? 0) - 0.7) <= 2e-3);
    });
  });

  test(label('C-floor', 'a batch that cannot be put back exactly is REFUSED unless cleared (D18c)'), async () => {
    // ⚠ Portable on purpose. The floor's predicate is engine logic, but its INPUT
    // is the fidelity each adapter reports from its own readback — so a fake that
    // graded a clip carrying gain as `exact` would let a batch through offline
    // that Bitwig refuses, which is PHASE-0 §Risks' failure mode aimed straight
    // at a safety gate.
    await withClip(async ({ adapter, clipA }) => {
      const executor = new Executor(adapter);
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
      await adapter.settle('noteWrite');

      await assert.rejects(
        executor.run([{ op: 'clip.delete', slot: clipA.slot }]),
        UnprotectedWriteError,
        'the response is a refusal, never an automatic branch',
      );
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 1, 'nothing was written');

      // ...and the same batch runs once something is protecting the prior state.
      const cleared = await executor.run(
        [{ op: 'clip.delete', slot: clipA.slot }],
        { clearance: branchProtected('C-floor') },
      );
      assert.equal(cleared.report.applied, true);
      assert.equal(cleared.fidelity, 'lossy', 'clearance changes whether it runs, never what it claims');
    });
  });

  test(label('C-floor', 'an ordinary write into a clean clip pays nothing'), async () => {
    // The other half, and the reason the floor is a predicate over the stash
    // rather than a list of op classes: this is the SAME op that was refused
    // above, and here it is exact.
    await withClip(async ({ adapter, clipA }) => {
      const take = await new Executor(adapter).run([
        { op: 'note.write', clip: clipA, notes: [note({ pitch: 64 })] },
      ]);
      assert.equal(take.fidelity, 'exact');
      assert.equal(take.report.applied, true);
    });
  });

  test(label('C-clip', 'a clip capture carries its LENGTH, and absence is exact (D16 rev)'), async () => {
    // ⚠ The fake/live disagreement §3.3.3 named: `StateValue` declared
    // `lengthBeats?`, the fake populated it and the live adapter did not — an
    // unexercised divergence, because nothing read the field until the revert
    // path started rebuilding clips from it. This is the case that exercises it.
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      const target = slot(trackA, scene(4, sceneEpoch));
      // ⚠ Make the precondition TRUE rather than assume it. The fake gets a fresh
      // model per case; a real project keeps whatever the last run left here, and
      // a case that only passes the first time is worse than no case at all.
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await adapter.settle('trackStruct');

      const before = await adapter.read([clip(target)]);
      const empty = before.entries[addressKey(clip(target))];
      assert.equal(empty?.value.of === 'clip' ? empty.value.exists : true, false);
      assert.equal(empty?.fidelity, 'exact', 'absence has no content to fail to recreate (D16d)');

      await adapter.apply({ ops: [{ op: 'clip.create', slot: target, lengthBeats: 8 }] });
      await adapter.settle('trackStruct');

      const after = await adapter.read([clip(target)]);
      const held = after.entries[addressKey(clip(target))];
      assert.equal(held?.value.of === 'clip' ? held.value.exists : false, true);
      assert.equal(held?.fidelity, 'lossy', 'restorable, but not everything about it is');
      assert.equal(held?.value.of === 'clip' ? held.value.lengthBeats : undefined, 8);

      await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await adapter.settle('trackStruct');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-clip-meta', 'metadata is exact, invalid marker state is refused, and duplication copies the clip (E43)'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      const sourceSlot = slot(trackA, scene(4, sceneEpoch));
      const destinationSlot = slot(trackA, scene(5, sceneEpoch));
      const source = clip(sourceSlot);
      const destination = clip(destinationSlot);
      const metadata = {
        name: 'gn-2e-meta', color: { red: 31, green: 159, blue: 223 },
        lengthBeats: 9, playStartBeats: 2, loopEnabled: true,
        loopStartBeats: 1, loopEndBeats: 10,
      } as const;

      await adapter.apply({ ops: [
        { op: 'clip.delete', slot: sourceSlot },
        { op: 'clip.delete', slot: destinationSlot },
      ] });
      await adapter.settle('trackStruct');
      await adapter.apply({ ops: [
        { op: 'clip.create', slot: sourceSlot, lengthBeats: 8 },
        { op: 'clip.update', clip: source, metadata },
        { op: 'clip.launchSettings', clip: source, quantization: '1/4', mode: 'continue_or_synced', useLoopStartAsQuantizationReference: true },
        { op: 'note.write', clip: source, notes: [note({ pitch: 65, durationBeats: 2 })] },
      ] });
      await adapter.settle('trackStruct');

      const before = await adapter.read([clipMetadata(source)]);
      assert.deepEqual(before.entries[addressKey(clipMetadata(source))]?.value, {
        of: 'clipMetadata', metadata,
      }, 'the complete writer must hide the raw marker side effects');

      await assert.rejects(
        adapter.apply({ ops: [{
          op: 'clip.update', clip: source,
          metadata: { ...metadata, lengthBeats: 8 },
        }] }),
        InvalidOpError,
      );
      const unchanged = await adapter.read([clipMetadata(source)]);
      assert.deepEqual(unchanged.entries[addressKey(clipMetadata(source))]?.value, {
        of: 'clipMetadata', metadata,
      });

      await adapter.apply({ ops: [{ op: 'clip.duplicate', source, destination: destinationSlot }] });
      await adapter.settle('trackStruct');
      const copied = await adapter.read([
        clipMetadata(destination), clipLaunch(destination), notesAt(destination),
      ]);
      assert.deepEqual(copied.entries[addressKey(clipMetadata(destination))]?.value, {
        of: 'clipMetadata', metadata,
      });
      assert.deepEqual(copied.entries[addressKey(clipLaunch(destination))]?.value, {
        of: 'clipLaunch',
        launch: {
          quantization: '1/4', mode: 'continue_or_synced',
          useLoopStartAsQuantizationReference: true,
        },
      });
      const copiedNotes = copied.entries[addressKey(notesAt(destination))]?.value;
      assert.deepEqual(
        copiedNotes?.of === 'notes' ? copiedNotes.notes.map((entry) => entry.pitch) : [],
        [65],
      );

      await adapter.apply({ ops: [
        { op: 'clip.delete', slot: destinationSlot },
        { op: 'clip.delete', slot: sourceSlot },
      ] });
      await adapter.settle('trackStruct');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-exec', 'readback disagreeing with the request is REPORTED, not swallowed (E8-E)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      // Four adjacent same-pitch dur=1 notes: Bitwig ends each where the next
      // begins. Every op reports ok, which is exactly why §8c needs this.
      const written = [0, 0.25, 0.5, 0.75].map((startBeats) => note({ startBeats, durationBeats: 1 }));
      const take = await new Executor(adapter).run([{ op: 'note.write', clip: clipA, notes: written }]);

      assert.equal(take.report.applied, true);
      assert.deepEqual(take.report.failed, []);
      const durations = take.report.disagreements.filter((d) => d.field === 'durationBeats');
      assert.equal(durations.length, 3, 'the last note has no successor to truncate it');
      assert.match(durations[0]!.known ?? '', /same-pitch adjacency/);
    });
  });

  test(
    label('C-exec', 'a write landing between stash and apply rejects the batch WHOLE (E8-D)'),
    { skip: !h.capabilities.canInjectInterference },
    async () => {
      // ⚠ EXIT CRITERION 3, asserted at the EXECUTOR rather than the adapter: the
      // guard the batch runs under is the revision its own STASH was taken at,
      // so a human editing in the gap invalidates it without anyone passing
      // `ifRevision` by hand.
      await withClip(async ({ adapter, clipA }) => {
        assert.ok(h.bumpRevision, 'canInjectInterference harness must provide bumpRevision');
        const bump = h.bumpRevision;
        const executor = new Executor({
          hello: () => adapter.hello(),
          resolve: (refs) => adapter.resolve(refs),
          tracks: () => adapter.tracks(),
          devices: (trackRef) => adapter.devices(trackRef),
          read: async (sel) => {
            const snap = await adapter.read(sel);
            await bump(adapter);
            return snap;
          },
          apply: (b) => adapter.apply(b),
          settle: (budget) => adapter.settle(budget),
          revision: () => adapter.revision(),
          contentSince: (since) => adapter.contentSince(since),
          preserveSelection: (work) => adapter.preserveSelection(work),
          showClipInEditor: (clipRef, verifiedAt) => adapter.showClipInEditor(clipRef, verifiedAt),
          close: async () => {},
        });

        const take = await executor.run([{ op: 'note.write', clip: clipA, notes: [note()] }]);
        assert.equal(take.report.applied, false);
        assert.equal(take.report.rejected?.reason, 'stale-revision');
        assert.deepEqual(take.receipt.stages, [], 'zero ops may be applied');
        await adapter.settle('noteWrite');
        assert.deepEqual(await readNotes(adapter, notesAt(clipA)), [], 'and the clip is untouched');
      });
    },
  );

  // --- the observers (session 3) --------------------------------------------

  test(label('C-mark', 'the mark carries a generation and BOTH epochs, from the extension'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const mark = await adapter.revision();
      // ⚠ Portable because the SHAPE is the contract, not the values. The
      // numbers are meaningless as absolutes — Bitwig delivers initial values
      // through the same callbacks, so they are nonzero at rest — and the
      // generation is what makes any later difference honest.
      assert.equal(typeof mark.generation, 'string');
      assert.ok(mark.generation.length > 0, 'a mark with no generation is not comparable to anything');
      assert.equal(typeof mark.sceneEpoch, 'number');
      assert.equal(typeof mark.contentEpoch, 'number');
      // ⚠ Which PROJECT the epochs were counted in. A project load does not
      // re-init the extension, so `generation` cannot see it — and unlike a
      // restart it leaves the counters looking entirely normal.
      assert.equal(typeof mark.project, 'string');
      assert.ok(mark.project.length > 0,
        'an empty project name means the handle was never obtained; every window then fails '
        + 'closed, which is safe but useless — check `projectStatus` on the rig');

      // Two marks in a row, with nothing in between, are the same generation.
      // If this ever fails live, the nonce is being minted per REQUEST rather
      // than per init() and every window would read as discontinuous.
      assert.equal((await adapter.revision()).generation, mark.generation);
      assert.equal((await adapter.revision()).project, mark.project);
      assert.ok(trackA.channelId.length > 0);
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-mark', 'a window with nothing in it reports nothing, and is intact'), async () => {
    await withClip(async ({ adapter }) => {
      const mark = await adapter.revision();
      const delta = await adapter.contentSince(mark);
      assert.deepEqual(delta.events, []);
      assert.equal(delta.truncated, false);
      assert.equal(delta.discontinuous, false);
      assert.ok(deltaComplete(delta), 'an empty window means "quiet" only while it is complete');
    });
  });

  test(label('C-content', 'creating and deleting a clip is visible in the launcher window'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      // ⚠ A slot the fixture has not touched, so the assertions below are about
      // THIS batch's events and not about leftovers a previous case created —
      // the same reason `withClip` clears its clip.
      const target = slot(trackA, scene(2, sceneEpoch));
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await adapter.settle('trackStruct');

      const before = await adapter.revision();
      await adapter.apply({ ops: [{ op: 'clip.create', slot: target, lengthBeats: 4 }] });
      await adapter.settle('trackStruct');

      const delta = await adapter.contentSince(before);
      assert.ok(deltaComplete(delta), 'the window must be usable for the rest of this to mean anything');
      const touching = contentTouching(delta, clip(target));
      assert.equal(touching.length, 1, 'one occupancy change, on the slot we addressed');
      assert.equal(touching[0]?.filled, true);
      // ⚠ Matched by DURABLE identity. A bank index would pass here and fail the
      // moment anything re-indexed the bank, which is the failure standing rule
      // 2 exists for and which a same-session test would never surface.
      assert.equal(touching[0]?.channelId, trackA.channelId);

      const mid = await adapter.revision();
      await adapter.apply({ ops: [{ op: 'clip.delete', slot: target }] });
      await adapter.settle('trackStruct');
      const after = await adapter.contentSince(mid);
      assert.equal(contentTouching(after, clip(target))[0]?.filled, false);
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-content', 'a note write into an EXISTING clip is not an occupancy event'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const before = await adapter.revision();
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note()] }] });
      await adapter.settle('noteWrite');

      const delta = await adapter.contentSince(before);
      // ⚠ The detector's whole value is that silence means something. If Bitwig
      // fires content callbacks on note writes, this fails — and that failure is
      // the finding, because every batch would then look like a concurrent edit.
      assert.deepEqual(contentTouching(delta, clipA), []);
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 1, 'the write did happen');
    });
  });

  test(label('C-content', 'a scene op moves the scene epoch, and stales scene-relative addresses'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const before = await adapter.revision();
      await adapter.apply({ ops: [{ op: 'scene.create', count: 1 }] });
      await adapter.settle('trackStruct');
      const after = await adapter.revision();

      // ⚠ This is now an OBSERVER reading, not a counter we bump — which is the
      // session's whole change, and the reason the same assertion is worth
      // running live: the fake can only prove we read the field.
      assert.notEqual(after.sceneEpoch, before.sceneEpoch);
      assert.equal(after.generation, before.generation, 'a scene op is not a restart');

      const stale = clip(slot(trackA, scene(0, before.sceneEpoch)));
      const [resolved] = (await adapter.resolve([stale])).resolved;
      assert.equal(resolved?.found, false);
      assert.equal(resolved?.reason, 'stale-epoch');

      // ⚠ Given back from the END — see `C-epoch`.
      await giveBackLastScene(adapter, before.window.scenes.count);
    } finally {
      await h.dispose(adapter);
    }
  });
}

/**
 * A note carrying every property `NOTE_PROP_FIDELITY` calls `exact`.
 *
 * Derived from the table rather than hand-written, and asserted complete below,
 * because exit criterion 1 says "every writable expression property" — a literal
 * would quietly stop covering one the day a probe promotes it.
 */
const EXACT_VALUES: Record<string, unknown> = {
  velocity: 96, duration: 0.75, releaseVelocity: 0.4, velocitySpread: 0.2, gain: 0.7, pan: -0.25,
  timbre: 0.3, transpose: 2, chance: 0.6, isChanceEnabled: true, isMuted: true,
  isOccurrenceEnabled: true, occurrence: 'FIRST', isRecurrenceEnabled: true, recurrence: [4, 5],
  isRepeatEnabled: true, repeatCount: 3, repeatCurve: 0.2, repeatVelocityCurve: -0.1,
  repeatVelocityEnd: 0.8,
};

function conformanceFullNote(over: Partial<NoteRecord> = {}): NoteRecord {
  const bag: Record<string, unknown> = {
    startBeats: 0, pitch: 60,
    velocity: EXACT_VALUES['velocity'], durationBeats: EXACT_VALUES['duration'],
  };
  for (const [key, value] of Object.entries(EXACT_VALUES)) {
    if (key === 'velocity' || key === 'duration') continue;
    bag[key] = value;
  }
  return { ...(bag as unknown as NoteRecord), ...over };
}
