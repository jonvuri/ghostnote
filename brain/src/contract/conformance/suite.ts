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
  AddressUnresolvedError, BankWindowOverflowError, NOTE_PROP_FIDELITY, addressKey, clip,
  notes as notesAt, scene, slot, track,
  type Address, type BitwigAdapter, type NoteRecord, type Op, type Snapshot, type TrackAddress,
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

  test(label('C-epoch', 'a scene op bumps the epoch and stales prior addresses (E3)'), async () => {
    const { adapter, trackA } = await h.create();
    try {
      const before = (await adapter.revision()).sceneEpoch;
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

  test(label('C-gain', 'a snapshot touching gain is labelled lossy, never silently corrected (E2)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
      await adapter.settle('noteWrite');
      const snap = await adapter.read([notesAt(clipA)]);
      const entry = snap.entries[addressKey(notesAt(clipA))]!;
      // The inverse mapping is unverified until Phase 1; correcting on a guess
      // would make every take restore a wrong gain, silently.
      assert.equal(entry.fidelity, 'lossy');
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
        const first = await executor.run([{ op: 'device.insert', track: trackA, source }]);
        const firstIndex = chainIndexOf(first.receipt);
        assert.equal(first.unrevertable.length, 0, 'an insert is no longer filed as having no inverse');

        // ⚠ The assertion that separates OBSERVED from COUNTED, and the reason it
        // is two inserts rather than one: an index hardcoded to 0, or counted from
        // the request rather than read off the chain, passes a single-insert case
        // and fails here. It also says nothing about where the chain started, so
        // it holds on a fixture track that already carries an instrument.
        const second = await executor.run([{ op: 'device.insert', track: trackA, source }]);
        assert.equal(chainIndexOf(second.receipt), firstIndex + 1,
          'the second device lands one further along the chain the first one grew');

        // Reverted NEWEST FIRST, because a chain re-indexes on delete (E3) —
        // which is exactly the order `revertOps` emits for a multi-insert batch.
        await executor.revertUnchecked(second);
        await executor.revertUnchecked(first);

        // ⚠ And this is how we know both deletes actually landed, using nothing
        // but contract surface: there is no device READBACK in v0, so the chain's
        // state is only observable through where the NEXT insert reports landing.
        const again = await executor.run([{ op: 'device.insert', track: trackA, source }]);
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

  test(label('C-slot', 'a notes read on a slot with NO clip is missing, never an empty clip (E2)'), async () => {
    // ⚠ The distinction the executor's E2 guard is built on, and a place the
    // fake and live could silently disagree: "there is no clip here" must not
    // present as "the clip is empty", or a write into a never-created slot looks
    // legal right up until the cursor lands on somebody else's clip.
    const { adapter, trackA } = await h.create();
    try {
      const { sceneEpoch } = await adapter.revision();
      // Scene 5 is deliberately never created by any case in this suite.
      const bare = notesAt(clip(slot(trackA, scene(5, sceneEpoch))));
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
      // The write-set is the WHOLE clip channel, and the stash is what readback
      // reported BEFORE the batch — never what anyone requested.
      assert.equal(take.values.length, 1);
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
      const bare = clip(slot(trackA, scene(6, sceneEpoch)));
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
      assert.equal(take.values.length, 2, 'both clips are in the write-set');

      await executor.revertUnchecked(take);
      assert.equal((await readNotes(adapter, notesAt(clipA)))[0]?.pan, -0.25,
        'clip A must get its expression back');
      assert.equal((await readNotes(adapter, notesAt(clipB)))[0]?.pan, 0.5,
        'and so must clip B — neither may be silently dropped');
    } finally {
      await h.dispose(adapter);
    }
  });

  test(label('C-exec', 'gain is captured, labelled and REPORTED — never replayed or corrected (E2, D8)'), async () => {
    await withClip(async ({ adapter, clipA }) => {
      const executor = new Executor(adapter);
      await adapter.apply({ ops: [{ op: 'note.write', clip: clipA, notes: [note({ gain: 0.7 })] }] });
      await adapter.settle('noteWrite');

      // ⚠ The stash is about to say `lossy`, which is the fidelity floor's whole
      // predicate — so this batch has to declare what is protecting it or it is
      // refused (D18c). C-floor below asserts the refusal itself.
      const take = await executor.run([
        { op: 'note.clear', clip: clipA },
        { op: 'note.write', clip: clipA, notes: [note({ pitch: 72 })] },
      ], { clearance: branchProtected('C-exec') });
      // The stash saw a doubled gain, so the take says lossy before anyone asks.
      assert.equal(take.fidelity, 'lossy');
      assert.match(take.values[0]!.caveats.join(' '), /gain: reads back/);

      const reverted = await executor.revertUnchecked(take);
      // Replaying 1.4 would write 1.4 and read back 2.8, compounding on every
      // revert. Withheld and named — the bounded failure, not the unbounded one.
      assert.deepEqual(reverted.unrestored.map((u) => u.what), ['gain']);
      assert.equal((await readNotes(adapter, notesAt(clipA)))[0]?.gain, undefined);
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
        executor.run([{ op: 'note.clear', clip: clipA }]),
        UnprotectedWriteError,
        'the response is a refusal, never an automatic branch',
      );
      assert.equal((await readNotes(adapter, notesAt(clipA))).length, 1, 'nothing was written');

      // ...and the same batch runs once something is protecting the prior state.
      const cleared = await executor.run(
        [{ op: 'note.clear', clip: clipA }],
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
          read: async (sel) => {
            const snap = await adapter.read(sel);
            await bump(adapter);
            return snap;
          },
          apply: (b) => adapter.apply(b),
          settle: (budget) => adapter.settle(budget),
          revision: () => adapter.revision(),
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
}

/**
 * A note carrying every property `NOTE_PROP_FIDELITY` calls `exact`.
 *
 * Derived from the table rather than hand-written, and asserted complete below,
 * because exit criterion 1 says "every writable expression property" — a literal
 * would quietly stop covering one the day a probe promotes it.
 */
const EXACT_VALUES: Record<string, unknown> = {
  velocity: 96, duration: 0.75, releaseVelocity: 0.4, velocitySpread: 0.2, pan: -0.25,
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
