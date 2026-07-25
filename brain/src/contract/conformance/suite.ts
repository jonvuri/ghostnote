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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BankWindowOverflowError, addressKey, clip, notes as notesAt, scene, slot, track,
  type Address, type BitwigAdapter, type NoteRecord, type Op, type Snapshot, type TrackAddress,
} from '../index.js';

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
}
