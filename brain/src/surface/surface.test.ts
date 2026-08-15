/**
 * The tool surface, offline — the coverage it had none of until session 3d.
 *
 * Until now the MCP server's only exercise was `probe:e09`, which needs a live
 * DAW, a fixture project and a human to run it. Everything here runs in
 * milliseconds against the Phase-0 fake, through the SAME code path the server
 * registers, so a case that passes here passes over the wire.
 *
 * The session's exit criteria, and where each one is:
 *
 *   T-roundtrip  1. a batch of note edits applies, verifies and reverts end to
 *                   end THROUGH THE TOOLS, with no probe involved
 *   T-record     2. every batch that applied is recorded, and no tool can reach
 *                   a route around the recording
 *   T-moved      3. every reversal is planned against the launcher window, and
 *                   `moved` is produced by the surface for the first time — a
 *                   clip replaced by an identical one is REFUSED
 *   T-partition  4. the partition is asserted: names, annotations, and what each
 *                   tool may emit
 *   T-words      5/6. no name, description, parameter or emitted text uses a
 *                   banned word — the mechanisms, or this project's own jargon
 *   T-surface    7. every tool runs offline
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { FakeAdapter } from '../adapters/fake/adapter.js';
import { control } from '../adapters/fake/control.js';
import { ProjectModel } from '../adapters/fake/model.js';
import {
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, ContractVersionError,
  InvalidOpError, NOTE_PROP_FIDELITY, SlotOccupiedError, StaleAddressError, WireDriftError,
  addressKey, chain as chainAt, clip as clipAt, notes as notesAt, scene as sceneAt, slot as slotAt, track as trackAt,
  type BitwigAdapter, type NoteRecord, type Op,
} from '../contract/index.js';
import { StaleExtensionError } from '../deploy.js';
import { Executor, UnprotectedWriteError } from '../engine/index.js';
import {
  ChangesetNotFoundError, EmptySliceError, Stash, type BoundaryVerdict,
} from '../stash/index.js';
import { refusalOf, verdictSentence } from './report.js';
import { SURFACE_WORDS_BANNED, bannedWordsIn } from './naming.js';
import {
  ANNOTATIONS, REMOVAL_OPS, TOOLS, WRITE_TOOLS_THAT_MAY_REMOVE, callTool,
} from './tools.js';
import { workspaceOf, type Workspace } from './workspace.js';

const HERE = dirname(fileURLToPath(import.meta.url));

interface Fixture {
  readonly fake: FakeAdapter;
  readonly stash: Stash;
  readonly workspace: Workspace;
  readonly trackA: string;
  readonly trackB: string;
  /** Every op whose adapter call reached staging, in order — how `emits` is checked. */
  readonly sent: Op[];
}

/** Two tracks, eight rows, nothing written yet. */
function fixture(): Fixture {
  const fake = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
  const sent: Op[] = [];
  // ⚠ A spy rather than a stub: everything is the fake's own behaviour, and the
  // only addition is a record of what was asked for. A stub here would let a
  // tool's declared `emits` be checked against a world that does not push back.
  const watched: BitwigAdapter = {
    hello: () => fake.hello(),
    resolve: (refs) => fake.resolve(refs),
    tracks: () => fake.tracks(),
    read: (sel) => fake.read(sel),
    settle: (budget) => fake.settle(budget),
    revision: () => fake.revision(),
    contentSince: (since) => fake.contentSince(since),
    close: () => fake.close(),
    apply: async (batch) => {
      const receipt = await fake.apply(batch);
      sent.push(...batch.ops);
      return receipt;
    },
  };
  const stash = new Stash({ now: () => 1 });
  let n = 0;
  const executor = new Executor(watched, { newId: () => `change-${++n}`, now: () => 1_000_000 });
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter: watched,
    executor,
    stash,
  });
  const [a, b] = fake.model.visibleTracks();
  return { fake, stash, workspace, trackA: a!.channelId, trackB: b!.channelId, sent };
}

const note = (over: Partial<NoteRecord> = {}): NoteRecord => ({
  startBeats: 0, pitch: 60, velocity: 100, durationBeats: 1, ...over,
});

/** Every JSON an agent could be handed, so the word guard can read all of it. */
const emitted: string[] = [];

async function call(fx: Fixture, name: string, args: unknown = {}): Promise<Record<string, unknown>> {
  const result = await callTool(fx.workspace, name, args) as Record<string, unknown>;
  emitted.push(`${name}: ${JSON.stringify(result)}`);
  return result;
}

const refused = (result: Record<string, unknown>): boolean => result['refused'] === true;

// --- exit criterion 4: the partition ----------------------------------------

test('T-partition: the names are the boundary, and no verb sits on two of them', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length, 'two tools share a name');

  const byClass = {
    read: TOOLS.filter((t) => t.kind === 'read').map((t) => t.name),
    write: TOOLS.filter((t) => t.kind === 'write').map((t) => t.name),
    destructive: TOOLS.filter((t) => t.kind === 'destructive').map((t) => t.name),
  };
  // ⚠ Not vacuous: a partition with an empty side would pass every check below.
  assert.ok(byClass.read.length > 0 && byClass.write.length > 0 && byClass.destructive.length > 0);

  // ⚠⚠ The host's "don't ask again for this tool" is a blanket grant on a NAME
  // (E20c), so a destructive verb sharing a name with a benign one would hand out
  // destruction with the benign grant.
  const benign = new Set([...byClass.read, ...byClass.write]);
  for (const name of byClass.destructive) {
    assert.equal(benign.has(name), false, `${name} is both destructive and benign`);
  }
});

test('T-partition: every tool carries the annotations its class implies', () => {
  for (const spec of TOOLS) {
    const expected = ANNOTATIONS[spec.kind];
    if (spec.kind === 'read') {
      assert.equal(expected.readOnlyHint, true, `${spec.name} must be readOnlyHint`);
      assert.equal(expected.destructiveHint, false);
    }
    if (spec.kind === 'destructive') {
      assert.equal(expected.destructiveHint, true, `${spec.name} must be destructiveHint`);
      assert.equal(expected.readOnlyHint, false);
    }
    if (spec.kind === 'write') {
      assert.equal(expected.readOnlyHint, false, `${spec.name} writes`);
      assert.equal(expected.destructiveHint, false, `${spec.name} is not the destructive surface`);
    }
  }
  // ⚠ Nothing may READ its own annotations into existence: they come from the
  // class table, so this also proves the table has an entry for every class.
  assert.deepEqual(Object.keys(ANNOTATIONS).sort(), ['destructive', 'read', 'write']);
});

test('T-partition: only a destructive tool may remove, and the one crossing is named', () => {
  for (const spec of TOOLS) {
    const removes = spec.emits.filter((op) => REMOVAL_OPS.has(op));
    if (spec.kind === 'destructive') {
      assert.ok(removes.length > 0, `${spec.name} is on the destructive surface and removes nothing`);
      continue;
    }
    if (spec.kind === 'read') {
      assert.deepEqual([...spec.emits], [], `${spec.name} is a read tool and must write nothing`);
      continue;
    }
    if (removes.length > 0) {
      assert.ok(
        spec.name in WRITE_TOOLS_THAT_MAY_REMOVE,
        `${spec.name} can emit ${removes.join(', ')} from the ordinary write surface without an `
        + 'entry in WRITE_TOOLS_THAT_MAY_REMOVE. Widening a benign tool to remove things is the '
        + 'failure this design cannot recover from — the operator may already have granted it.',
      );
    }
  }
  // The exemption list must not outlive its members either.
  for (const name of Object.keys(WRITE_TOOLS_THAT_MAY_REMOVE)) {
    const spec = TOOLS.find((t) => t.name === name);
    assert.ok(spec !== undefined, `${name} is exempted and does not exist`);
    assert.ok(
      spec!.emits.some((op) => REMOVAL_OPS.has(op)),
      `${name} no longer removes anything — drop the exemption rather than leaving it standing`,
    );
  }
});

// --- exit criterion 7: it all runs, and what it sends is what it declared ----

test('T-surface: every tool runs offline, and emits only what it declares', async () => {
  const fx = fixture();
  const ran = new Set<string>();

  /** Run one tool and check what actually went out against its declaration. */
  const exercise = async (name: string, args: unknown): Promise<Record<string, unknown>> => {
    const before = fx.sent.length;
    const result = await call(fx, name, args);
    const spec = TOOLS.find((t) => t.name === name)!;
    const sent = fx.sent.slice(before).map((op) => op.op);
    for (const op of sent) {
      assert.ok(
        spec.emits.includes(op),
        `${name} sent ${op}, which is not in its declared emits [${spec.emits.join(', ')}]`,
      );
    }
    ran.add(name);
    return result;
  };

  // -- reading first: an agent with no ids has nowhere else to start.
  const connection = await exercise('check_connection', {});
  assert.equal(connection['reachable'], true);

  const listed = await exercise('list_tracks', {}) as {
    tracks: { trackId: string; name: string }[];
  };
  assert.ok(listed.tracks.some((t) => t.trackId === fx.trackA && t.name === 'gn-A'));
  assert.equal(listed.tracks.length, 4, 'two instrument tracks, an effect return and the master');

  // -- writing.
  const created = await exercise('add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 64 })] }],
  });
  assert.equal(created['applied'], true, JSON.stringify(created));

  assert.equal(
    (await exercise('write_notes', {
      clips: [{ trackId: fx.trackA, row: 0, notes: [note({ startBeats: 1, pitch: 67 })] }],
    }))['applied'],
    true,
  );

  const read = await exercise('read_clip', { trackId: fx.trackA, row: 0 }) as {
    clipExists: boolean; lengthBeats: number; notes: NoteRecord[];
  };
  assert.equal(read.clipExists, true);
  // ⚠ An id that names nothing must not read as an empty slot: both are simply
  // absent from a snapshot, and only one of them is worth telling an agent.
  const nowhere = await call(fx, 'read_clip', { trackId: 'no-such-track', row: 0 });
  assert.equal(nowhere['readable'], false);
  assert.match(nowhere['why'] as string, /does not name a track/);
  assert.equal(read.lengthBeats, 4);
  assert.deepEqual(read.notes.map((n) => n.pitch).sort(), [64, 67]);

  const geometry = await exercise('inspect_clip_block', {
    trackId: fx.trackA, firstRow: 0, lastRow: 0,
  }) as { contiguous: boolean; boundaryBelow: string };
  assert.equal(geometry.contiguous, true);
  assert.equal(geometry.boundaryBelow, 'empty');

  const copied = await exercise('copy_clip_down', {
    trackId: fx.trackA,
    row: 0,
    quantization: '1',
    mode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  assert.equal(copied['applied'], true, JSON.stringify(copied));
  assert.equal(copied['clickLaunchVerified'], true, JSON.stringify(copied));

  assert.equal((await exercise('set_clip_launch', {
    clips: [{
      trackId: fx.trackA,
      row: 1,
      quantization: '1/4',
      mode: 'from_start',
      useLoopStartAsQuantizationReference: true,
    }],
  }))['applied'], true);

  const launched = await exercise('launch_clip', {
    trackId: fx.trackA, row: 1, quantization: 'none', mode: 'from_start',
  }) as { applied: boolean; playback: { isPlaying: boolean } };
  assert.equal(launched.applied, true);
  assert.equal(launched.playback.isPlaying, true);

  assert.equal((await exercise('erase_notes', {
    clips: [{ trackId: fx.trackA, row: 0, range: { fromBeat: 1, toBeat: 2 } }],
  }))['applied'], true);

  const moved = await exercise('move_clip_block', {
    trackId: fx.trackA, firstRow: 0, lastRow: 1, destinationFirstRow: 2,
  }) as { applied: boolean; movedTo: { firstRow: number; lastRow: number } };
  assert.equal(moved.applied, true, JSON.stringify(moved));
  assert.deepEqual(moved.movedTo, {
    firstRow: 2, lastRow: 3, firstBitwigSceneRow: 3, lastBitwigSceneRow: 4,
  });

  const renamed = await exercise('rename_track', {
    tracks: [{ trackId: fx.trackB, name: 'gn-B renamed' }],
  });
  assert.equal(renamed['applied'], true);
  const renameChangeId = renamed['changeId'] as string;

  const addedTrack = await exercise('add_track', { names: ['gn-C'] }) as {
    applied: boolean; created: { trackId: string }[];
  };
  assert.equal(addedTrack.applied, true);
  assert.equal(addedTrack.created.length, 1, 'the new track reports the id it actually got');

  assert.equal((await exercise('add_scenes', { count: 1 }))['applied'], true);

  const addedDevice = await exercise('add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'gn-test-device' }],
  }) as { applied: boolean; added: { devicePosition: number }[] };
  assert.equal(addedDevice.applied, true);
  assert.equal(addedDevice.added[0]?.devicePosition, 0, 'the position is read back, never assumed');

  assert.equal((await exercise('set_parameter', {
    settings: [{ trackId: fx.trackA, devicePosition: 0, index: 0, value: 0.25 }],
  }))['applied'], true);

  const createdAlternates = await exercise('create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'instrument',
    names: ['gn-tool-source', 'gn-tool-alt'],
  }) as {
    applied: boolean;
    structure: { container: { devicePosition: number }; alternates: { name: string }[] };
  };
  assert.equal(createdAlternates.applied, true, JSON.stringify(createdAlternates));
  assert.deepEqual(
    createdAlternates.structure.alternates.map((item) => item.name),
    ['gn-tool-source', 'gn-tool-alt'],
  );

  const inspected = await exercise('inspect_device_alternates', {
    trackId: fx.trackA,
    containerPosition: createdAlternates.structure.container.devicePosition,
  }) as {
    readable: boolean;
    complete: boolean;
    exclusiveActive: string | null;
    alternates: { soloed: boolean | null }[];
  };
  assert.equal(inspected.readable, true);
  assert.equal(inspected.complete, true);
  assert.equal(inspected.exclusiveActive, null,
    'two open siblings are not mislabeled as one exclusively active alternate');
  assert.deepEqual(inspected.alternates.map((item) => item.soloed), [false, false]);

  const filled = await exercise('fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: createdAlternates.structure.container.devicePosition,
    alternateName: 'gn-tool-source',
    sourceDevicePositions: [0],
    mode: 'move',
  }) as {
    applied: boolean;
    finalContainerPosition: number;
    structure: { alternates: { name: string; devices: { name: string }[] }[] };
  };
  assert.equal(filled.applied, true, JSON.stringify(filled));
  assert.equal(filled.finalContainerPosition, 0);
  assert.equal(filled.structure.alternates[0]?.devices.length, 1);

  const effectAlternates = await call(fx, 'create_device_alternates', {
    trackId: fx.trackB,
    containerType: 'effect',
    names: ['gn-effect-source', 'gn-effect-alt'],
  }) as { applied: boolean; structure: { container: { devicePosition: number } } };
  assert.equal(effectAlternates.applied, true, JSON.stringify(effectAlternates));

  const switched = await exercise('switch_device_alternate', {
    trackId: fx.trackA,
    containerPosition: filled.finalContainerPosition,
    alternateName: 'gn-tool-alt',
  }) as { applied: boolean; exclusiveActive: string; exclusiveStateConfirmed: boolean };
  assert.equal(switched.applied, true, JSON.stringify(switched));
  assert.equal(switched.exclusiveActive, 'gn-tool-alt');
  assert.equal(switched.exclusiveStateConfirmed, true);

  // -- the record of all of it, and putting one of them back.
  const changes = await exercise('list_changes', {}) as { changes: { changeId: string }[] };
  assert.ok(changes.changes.length >= 8);

  const renameChange = changes.changes.find((c) => c.changeId === renameChangeId);
  assert.ok(renameChange !== undefined, 'the rename is in the record');
  const check = await exercise('check_revert', { changeId: renameChangeId }) as {
    fullyRestorable: boolean;
  };
  assert.equal(check.fullyRestorable, true);
  assert.equal((await exercise('revert_change', { changeId: renameChangeId }))['applied'], true);
  assert.equal(fx.fake.model.tracks[1]?.name, 'gn-B', 'the rename really was put back');

  const copiedTrack = await exercise('copy_track', {
    trackId: fx.trackA, name: 'gn-A copy',
  }) as {
    applied: boolean;
    copyConfirmed: boolean;
    nameConfirmed: boolean;
    copied: { trackId: string };
  };
  assert.equal(copiedTrack.applied, true, JSON.stringify(copiedTrack));
  assert.equal(copiedTrack.copyConfirmed, true, JSON.stringify(copiedTrack));
  assert.equal(copiedTrack.nameConfirmed, true, JSON.stringify(copiedTrack));
  assert.notEqual(copiedTrack.copied.trackId, fx.trackA, 'the copy receives a fresh durable id');

  // -- destroying.
  assert.equal((await exercise('delete_device', {
    devices: [{ trackId: fx.trackA, position: 0 }],
  }))['applied'], true);
  assert.equal((await call(fx, 'delete_device', {
    devices: [{
      trackId: fx.trackB,
      position: effectAlternates.structure.container.devicePosition,
    }],
  }))['applied'], true);

  assert.equal((await exercise('delete_clip', {
    clips: [{ trackId: fx.trackA, row: 2 }],
  }))['applied'], true);

  assert.equal((await exercise('delete_scene', { rows: [8] }))['applied'], true);

  assert.equal((await exercise('delete_track', {
    trackIds: [addedTrack.created[0]!.trackId, copiedTrack.copied.trackId],
  }))['applied'], true);

  // ⚠ The coverage claim, asserted rather than assumed: a tool added without a
  // case here fails this, which is the only way "the surface has offline
  // coverage" stays true after today.
  assert.deepEqual(
    TOOLS.map((t) => t.name).filter((n) => !ran.has(n)),
    [],
    'a registered tool has no offline case',
  );
});

// --- exit criterion 1: end to end through the tools --------------------------

test('T-roundtrip: notes applied, verified and put back, entirely through the tools', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 2, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 2, notes: [note({ pitch: 60 }), note({ startBeats: 2, pitch: 63 })] }],
  });
  assert.equal(written['applied'], true);
  const changeId = written['changeId'] as string;

  // Verified by reading it back through the surface, not by trusting the receipt.
  const after = await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] };
  assert.deepEqual(after.notes.map((n) => n.pitch).sort(), [60, 63]);

  // What the undo would do, before doing it.
  const preview = await call(fx, 'check_revert', { changeId }) as {
    fullyRestorable: boolean; wouldWriteAnything: boolean; wouldNotRestore: unknown[];
  };
  assert.equal(preview.fullyRestorable, true);
  assert.equal(preview.wouldWriteAnything, true);
  assert.deepEqual(preview.wouldNotRestore, []);

  const undone = await call(fx, 'revert_change', { changeId });
  assert.equal(undone['applied'], true);

  const restored = await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as {
    clipExists: boolean; notes: NoteRecord[];
  };
  assert.deepEqual(restored.notes, [], 'the clip is back to empty');
  assert.equal(restored.clipExists, true, 'and the clip itself is untouched — only its notes moved');
});

test('T-roundtrip: a partial undo touches only what it was scoped to', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 0, lengthBeats: 4 },
      { trackId: fx.trackB, row: 0, lengthBeats: 4 },
    ],
  });
  const written = await call(fx, 'write_notes', {
    clips: [
      { trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackB, row: 0, notes: [note({ pitch: 72 })] },
    ],
  });

  await call(fx, 'revert_change', {
    changeId: written['changeId'],
    scope: { trackId: fx.trackA },
  });

  const a = await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] };
  const b = await call(fx, 'read_clip', { trackId: fx.trackB, row: 0 }) as { notes: NoteRecord[] };
  assert.deepEqual(a.notes, [], 'the scoped track was put back');
  assert.deepEqual(b.notes.map((n) => n.pitch), [72], 'and the other one was left alone');
});

// --- exit criterion 2: nothing that applied goes unrecorded ------------------

test('T-record: every batch that applied is in the record, and no tool can go around it', async () => {
  const fx = fixture();
  assert.deepEqual(fx.stash.list(), []);

  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 1, lengthBeats: 2 }] });
  await call(fx, 'write_notes', { clips: [{ trackId: fx.trackA, row: 1, notes: [note()] }] });
  await call(fx, 'delete_clip', { clips: [{ trackId: fx.trackA, row: 1 }] });

  assert.equal(fx.stash.list().length, 3, 'one record per batch that reached Bitwig');
  // ⚠ A refused batch writes nothing and records nothing — there is no world to
  // put back. The count above must not move.
  const refusal = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 1, notes: [note()] }],
  });
  assert.ok(refused(refusal), 'the clip was deleted, so this write has nowhere to land');
  assert.equal(fx.stash.list().length, 3);

  // ⚠ The structural half. A tool receives a `Workspace`, and a `Workspace` has
  // no executor to call and no way to record — or to FORGET, which is the
  // destructive mutation here: the record is the only "before" an unbranched
  // write has.
  const workspace = fx.workspace as unknown as Record<string, unknown>;
  assert.equal('executor' in workspace, false, 'a tool could bypass the recording');
  assert.equal('apply' in workspace, true, 'and the check is not vacuous');
  for (const banned of ['record', 'forget']) {
    assert.equal(banned in (fx.workspace.changes as object), false, `${banned} is reachable`);
  }
  assert.ok(Object.isFrozen(fx.workspace));
});

test('T-copy-track: copy and explicit naming are ordinary recorded edits, and reversal keeps the copy', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 73 })] }],
  });

  const before = fx.stash.list().length;
  const result = await call(fx, 'copy_track', {
    trackId: fx.trackA, name: 'gn-A explicit copy',
  }) as {
    changeId: string;
    copyConfirmed: boolean;
    nameConfirmed: boolean;
    copied: { trackId: string };
    namingChange: { changeId: string; applied: boolean };
    automaticReversal: string;
  };

  assert.equal(result.copyConfirmed, true, JSON.stringify(result));
  assert.equal(result.nameConfirmed, true, JSON.stringify(result));
  assert.notEqual(result.copied.trackId, fx.trackA);
  assert.notEqual(result.namingChange.changeId, result.changeId);
  assert.equal(fx.stash.list().length, before + 2,
    'the structural copy and its typed rename are both in ordinary change history');

  const source = fx.fake.model.findByChannelId(fx.trackA)?.track;
  const copy = fx.fake.model.findByChannelId(result.copied.trackId)?.track;
  assert.equal(source?.name, 'gn-A', 'the source is not renamed');
  assert.equal(copy?.name, 'gn-A explicit copy');
  assert.deepEqual([...copy!.slots[0]!.notes.values()], [...source!.slots[0]!.notes.values()],
    'the source contents travel with the track');

  const preview = await call(fx, 'check_revert', { changeId: result.changeId }) as {
    fullyRestorable: boolean; wouldWriteAnything: boolean; wouldNotRestore: unknown[];
  };
  assert.equal(preview.fullyRestorable, false);
  assert.equal(preview.wouldWriteAnything, false);
  assert.ok(preview.wouldNotRestore.length > 0, 'the preview says the copied track remains');

  const reversed = await call(fx, 'revert_change', { changeId: result.changeId });
  assert.equal(reversed['applied'], false);
  assert.ok(fx.fake.model.findByChannelId(result.copied.trackId),
    'automatic reversal does not delete a copied track');
  assert.match(result.automaticReversal, /delete_track/);
});

test('T-copy-track: unsupported track kinds and a full bank refuse before the first write', async () => {
  const unsupported = fixture();
  const effect = unsupported.fake.model.visibleTracks().find((t) => t.type === 'Effect')!;
  const unsupportedBefore = unsupported.sent.length;
  const unsupportedResult = await call(unsupported, 'copy_track', {
    trackId: effect.channelId, name: 'not allowed',
  });
  assert.equal(refused(unsupportedResult), true);
  assert.equal(unsupported.sent.length, unsupportedBefore, 'unsupported kinds emit no op');

  const full = fixture();
  control(full.fake).setBankWindow(full.fake.model.trackCount);
  const idsBefore = full.fake.model.tracks.map((t) => t.channelId);
  const sentBefore = full.sent.length;
  const fullResult = await call(full, 'copy_track', {
    trackId: full.trackA, name: 'no room',
  });
  assert.equal(refused(fullResult), true);
  assert.equal(full.sent.length, sentBefore, 'capacity is checked before the adapter runs an op');
  assert.deepEqual(full.fake.model.tracks.map((t) => t.channelId), idsBefore,
    'no unaddressable copy is created');
});

test('T-record: no tool source mentions the executor or the recording call', async () => {
  // The `WIRE_METHODS_BANNED` idiom: the only real enforcement of a "never" is a
  // test that greps for it. `workspace.ts` names both because it is the one place
  // allowed to; every other file in the surface must not.
  const source = await readFile(join(HERE, 'tools.ts'), 'utf8');
  assert.doesNotMatch(source, /\bexecutor\b/i, 'tools.ts reaches for an executor');
  assert.doesNotMatch(source, /\.record\(/, 'tools.ts records by hand rather than through apply');
  assert.doesNotMatch(source, /planReversal/, 'tools.ts plans a reversal without the launcher window');
});

// --- exit criterion 3: the launcher window, and `moved` ----------------------

test('T-moved: a clip replaced by an identical one is REFUSED, not overwritten', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });
  const changeId = written['changeId'] as string;

  // ⚠ A person deletes the clip and puts an identical one in its place. Every
  // byte compares equal afterwards; the slot is nonetheless not holding the clip
  // we wrote, and a clip has no id of its own to tell us so.
  control(fx.fake).replaceClipInPlace(fx.trackA, 0);

  const preview = await call(fx, 'check_revert', { changeId }) as {
    fullyRestorable: boolean;
    wouldWriteAnything: boolean;
    wouldNotRestore: { why: string }[];
  };
  assert.equal(preview.fullyRestorable, false);
  assert.equal(preview.wouldWriteAnything, false);
  assert.match(preview.wouldNotRestore[0]!.why, /clip launcher reports this slot/);
  assert.match(preview.wouldNotRestore[0]!.why, /no id of its own/);

  const attempt = await call(fx, 'revert_change', { changeId }) as { applied: boolean };
  assert.equal(attempt.applied, false);
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
    'the notes are exactly as they were: refusing means not writing',
  );
});

test('T-moved: the CONTROL — without the launcher window the same case reads as ours', async () => {
  // ⚠ This is what makes the test above mean something. `planReversal` takes the
  // window optionally, and omitting it degrades the check to comparing contents —
  // which cannot see a move, because the contents are identical. So the same
  // situation, planned the way a caller who forgot would plan it, says the clip
  // is ours and offers to write over somebody else's.
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });
  const changeId = written['changeId'] as string;
  control(fx.fake).replaceClipInPlace(fx.trackA, 0);

  const current = await fx.fake.read(fx.stash.log.readSetFor(changeId));
  const blind = fx.stash.log.planReversal(changeId, current);
  assert.ok(blind.ops.length > 0, 'the content comparison alone sees nothing wrong');
  assert.deepEqual(blind.withheld, []);

  // ...and the surface's own path, which always passes the window, does not.
  const seeing = await fx.workspace.planRevert(changeId);
  assert.deepEqual(seeing.ops, []);
  assert.deepEqual(seeing.withheld.map((w) => w.verdict), ['moved']);
});

test('T-moved: an edit by somebody else inside our own write is reported, never overwritten', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const written = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ pitch: 60 })] }],
  });

  // A person plays another note into the same clip afterwards.
  await fx.fake.apply({ ops: [{ op: 'note.write', clip: clipAt(slotAt(trackAt(fx.trackA), sceneAt(0, 1))), notes: [note({ pitch: 62, startBeats: 3 })] }] });
  await fx.fake.settle('noteWrite');

  const attempt = await call(fx, 'revert_change', { changeId: written['changeId'] }) as {
    applied: boolean; wouldNotRestore: { why: string }[];
  };
  assert.equal(attempt.applied, false);
  assert.match(attempt.wouldNotRestore[0]!.why, /a person edited it/);
  assert.equal(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] })
      .notes.length,
    2,
    'both notes are still there',
  );
});

// --- refusals ----------------------------------------------------------------

test('T-refusal: writing into a slot with no clip is refused, and says what to do', async () => {
  const fx = fixture();
  const result = await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 5, notes: [note()] }],
  });
  assert.ok(refused(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.match(result['why'] as string, /no clip in that slot/);
  assert.match(result['why'] as string, /add_clip/, 'the refusal names the way forward');
});

test('T-device-alternate names: every invalid name refuses before container insertion', async () => {
  const spec = TOOLS.find((tool) => tool.name === 'create_device_alternates')!;
  for (const names of [[' '], ['valid', '\t'], ['same', 'same']]) {
    const fx = fixture();
    const before = JSON.stringify(fx.fake.model.findByChannelId(fx.trackA)!.track.devices);
    const beforeChanges = fx.stash.list().length;
    const beforeSent = fx.sent.length;
    const result = await spec.run(fx.workspace, {
      trackId: fx.trackA,
      containerType: 'effect',
      names,
    } as never) as Record<string, unknown>;
    assert.equal(result['refused'], true, JSON.stringify(result));
    assert.equal(result['nothingWasWritten'], true, JSON.stringify(result));
    assert.equal(JSON.stringify(fx.fake.model.findByChannelId(fx.trackA)!.track.devices), before);
    assert.equal(fx.stash.list().length, beforeChanges);
    assert.equal(fx.sent.length, beforeSent);
  }

  assert.equal(z.object(spec.inputSchema).safeParse({
    trackId: 'track', containerType: 'effect', names: [' '],
  }).success, false, 'the public schema itself rejects a whitespace-only first name');
  assert.equal(z.object(spec.inputSchema).safeParse({
    trackId: 'track', containerType: 'effect', names: ['valid', '  '],
  }).success, false, 'the public schema itself rejects a whitespace-only later name');
});

test('T-device-alternate names: a requested name matching the shipped entry is still explicitly written', async () => {
  const fx = fixture();
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const result = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA,
    containerType: 'effect',
    names: [ProjectModel.SHIPPED_CHAIN_NAME],
  }) as {
    applied: boolean;
    namingConfirmed: boolean;
    preparationChange?: { changeId: string };
    structure: { alternates: { name: string }[] };
  };
  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.namingConfirmed, true);
  assert.equal(result.structure.alternates[0]?.name, ProjectModel.SHIPPED_CHAIN_NAME);
  assert.equal(typeof result.preparationChange?.changeId, 'string',
    'the untouched shipped name was changed away and explicitly restored');
  assert.deepEqual(
    fx.sent.slice(beforeSent).map((op) => op.op),
    ['device.insert', 'chain.rename', 'chain.rename'],
  );
  assert.equal(fx.stash.list().length, beforeChanges + 3,
    'both explicit naming writes travelled through the recorded executor path');
});

test('T-fill preflight: cumulative capacity refuses the whole request without state, history, or emitted writes', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [
      { trackId: fx.trackA, from: 'bitwig', id: 'source-a' },
      { trackId: fx.trackA, from: 'bitwig', id: 'source-b' },
    ],
  });
  fx.fake.model.chainDeviceBankSize = 1;
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const beforeRevision = (await fx.fake.revision()).revision;

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [1, 2],
    mode: 'copy',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(JSON.stringify(track.devices), before, 'both sources and the destination are unchanged');
  assert.equal(fx.stash.list().length, beforeChanges, 'no change was recorded');
  assert.equal(fx.sent.length, beforeSent, 'no write batch was emitted by the adapter');
  assert.equal((await fx.fake.revision()).revision, beforeRevision, 'no stage ran');
});

test('T-fill preflight: a valid first source followed by an invalid source writes nothing', async () => {
  const fx = fixture();
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'source-a' }],
  });
  const track = fx.fake.model.findByChannelId(fx.trackA)!.track;
  const before = JSON.stringify(track.devices);
  const beforeChanges = fx.stash.list().length;
  const beforeSent = fx.sent.length;
  const beforeRevision = (await fx.fake.revision()).revision;

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [1, 7],
    mode: 'move',
  });
  assert.equal(result['refused'], true, JSON.stringify(result));
  assert.equal(result['nothingWasWritten'], true);
  assert.equal(JSON.stringify(track.devices), before, 'the valid first source and destination are unchanged');
  assert.equal(fx.stash.list().length, beforeChanges);
  assert.equal(fx.sent.length, beforeSent);
  assert.equal((await fx.fake.revision()).revision, beforeRevision);
});

test('T-fill projection: non-sorted caller order preserves requested order through move compaction', async () => {
  const fx = fixture();
  await call(fx, 'add_device', {
    devices: [{ trackId: fx.trackA, from: 'bitwig', id: 'source-a' }],
  });
  const made = await call(fx, 'create_device_alternates', {
    trackId: fx.trackA, containerType: 'effect', names: ['destination'],
  }) as { structure: { container: { devicePosition: number } } };
  await call(fx, 'add_device', {
    devices: [
      { trackId: fx.trackA, from: 'bitwig', id: 'source-b' },
      { trackId: fx.trackA, from: 'bitwig', id: 'source-c' },
    ],
  });

  const result = await call(fx, 'fill_device_alternate', {
    trackId: fx.trackA,
    containerPosition: made.structure.container.devicePosition,
    alternateName: 'destination',
    sourceDevicePositions: [3, 0],
    mode: 'move',
  }) as {
    applied: boolean;
    finalContainerPosition: number;
    structure: { alternates: { name: string; devices: { name: string }[] }[] };
  };
  assert.equal(result.applied, true, JSON.stringify(result));
  assert.equal(result.finalContainerPosition, 0);
  assert.deepEqual(
    result.structure.alternates[0]?.devices.map((item) => item.name),
    ['source-c', 'source-a'],
  );
  assert.deepEqual(
    fx.fake.model.findByChannelId(fx.trackA)!.track.devices.map((item) => item.name),
    [ProjectModel.FX_LAYER_UUID, 'source-b'],
  );
});

test('T-refusal: a write it could not put back is refused, and names what is in the way', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  // Written into an empty clip, so there is nothing it could fail to put back —
  // this one is allowed. What it leaves behind is not.
  assert.equal((await call(fx, 'write_notes', {
    clips: [{ trackId: fx.trackA, row: 0, notes: [note({ gain: 0.7 })] }],
  }))['applied'], true);

  const result = await call(fx, 'erase_notes', { clips: [{ trackId: fx.trackA, row: 0 }] });
  assert.ok(refused(result), 'the clip now holds a value that cannot be recorded exactly');
  const inTheWay = result['inTheWay'] as { where: { row: number }; why: string[] }[];
  assert.equal(inTheWay[0]?.where.row, 0);
  assert.match(inTheWay[0]!.why.join(' '), /twice the value written/);
  // ⚠ And the notes are untouched: a refusal is not a partial application.
  assert.equal(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 0 }) as { notes: NoteRecord[] }).notes.length,
    1,
  );
});

test('T-refusal: undoing something this session did not do is refused in terms an agent can act on', async () => {
  const fx = fixture();
  const result = await call(fx, 'revert_change', { changeId: 'not-a-change' });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /list_changes/);
});

test('T-refusal: a slot that already holds a clip is refused rather than appended past the end', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', { clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }] });
  const result = await call(fx, 'add_clip', {
    clips: [{ trackId: fx.trackA, row: 0, lengthBeats: 4 }],
  });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /already holds a clip/);
  assert.equal(fx.fake.model.sceneCount, 8, 'and the project did not grow a row');
});

test('T-clip-block: copy refuses an occupied next row before the wire call', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 0, lengthBeats: 4, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackA, row: 1, lengthBeats: 4, notes: [note({ pitch: 72 })] },
    ],
  });
  const before = fx.sent.length;
  const result = await call(fx, 'copy_clip_down', {
    trackId: fx.trackA, row: 0, quantization: '1', mode: 'continue_or_synced',
  });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /would replace it without any occupancy event/);
  assert.equal(fx.sent.length, before, 'the unsafe copy never reached the adapter');
  const destination = await call(fx, 'read_clip', {
    trackId: fx.trackA, row: 1,
  }) as { notes: NoteRecord[] };
  assert.deepEqual(destination.notes.map((n) => n.pitch), [72], 'the destination stayed intact');
});

test('T-clip-block: an overlapping move is ordered safely and its reported reverse works', async () => {
  const fx = fixture();
  await call(fx, 'add_clip', {
    clips: [
      { trackId: fx.trackA, row: 1, lengthBeats: 4, notes: [note({ pitch: 60 })] },
      { trackId: fx.trackA, row: 2, lengthBeats: 4, notes: [note({ pitch: 72 })] },
    ],
  });
  const moved = await call(fx, 'move_clip_block', {
    trackId: fx.trackA, firstRow: 1, lastRow: 2, destinationFirstRow: 2,
  }) as { applied: boolean; reverse: Record<string, unknown> };
  assert.equal(moved.applied, true, JSON.stringify(moved));
  assert.equal((await call(fx, 'read_clip', {
    trackId: fx.trackA, row: 1,
  }))['clipExists'], false);
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
  );
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 3 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [72],
  );

  const { tool: reverseTool, ...reverseArgs } = moved.reverse;
  const reversed = await call(fx, reverseTool as string, reverseArgs);
  assert.equal(reversed['applied'], true, JSON.stringify(reversed));
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 1 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [60],
  );
  assert.deepEqual(
    (await call(fx, 'read_clip', { trackId: fx.trackA, row: 2 }) as { notes: NoteRecord[] })
      .notes.map((n) => n.pitch),
    [72],
  );
});

test('T-refusal: more rows than can be addressed is refused before anything happens', async () => {
  const fx = fixture();
  const result = await call(fx, 'add_scenes', { count: 100 });
  assert.ok(refused(result));
  assert.match(result['why'] as string, /rig\.json/, 'the refusal names the only fix');
  assert.equal(fx.fake.model.sceneCount, 8);
});

// --- exit criteria 5 and 6: the words ---------------------------------------

test('T-words: no tool name, description or parameter uses a banned word', () => {
  const offenders: string[] = [];
  for (const spec of TOOLS) {
    // The JSON Schema is literally what an agent is handed, so scanning it covers
    // parameter names and every `.describe()` in one pass — including the nested
    // ones, which a hand-walk of the shape would miss.
    const schema = JSON.stringify(z.toJSONSchema(z.object(spec.inputSchema)));
    for (const [where, text] of [
      ['name', spec.name],
      ['title', spec.title],
      ['description', spec.description],
      ['schema', schema],
    ] as const) {
      for (const word of bannedWordsIn(text, `${spec.name}.${where}`)) {
        offenders.push(`${spec.name}.${where}: "${word}" — ${SURFACE_WORDS_BANNED[word]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.join('\n')}`);
});

test('T-words: nothing a tool EMITTED uses a banned word either', () => {
  // ⚠ The half that catches a leak nobody wrote: a receipt or a refusal that
  // forwards a sentence from inside the engine. `emitted` is filled by every
  // other test in this file, so the coverage of this guard is the coverage of the
  // suite — which is why T-surface asserts that every tool has a case.
  assert.ok(emitted.length > 20, 'the guard must have something to read');
  const offenders: string[] = [];
  for (const text of emitted) {
    for (const word of bannedWordsIn(text)) {
      offenders.push(`${word} in ${text.slice(0, 160)}`);
    }
  }
  assert.deepEqual(offenders, [], `\n${offenders.slice(0, 5).join('\n')}`);
});

test('T-words: no refusal redirects a change onto a mechanism', () => {
  // ⚠ The same assertion `executor.test.ts` makes about the engine's own refusal
  // text, made about everything this surface says. It overlaps the ban list on
  // purpose: this one is the sentence D18c actually forbids, and it should still
  // fail if somebody ever decides a word is "fine in context".
  for (const text of [...emitted, ...TOOLS.map((t) => t.description)]) {
    assert.doesNotMatch(text, /\bfork|\blayer|\bchain|\bduplicate|track instead/i, text.slice(0, 160));
  }
});

test('T-words: EVERY refusal the surface can produce is written in its own words', () => {
  // ⚠ The emitted-text guard above only reads what the suite happened to run.
  // This one enumerates the refusal catalogue directly, so a path nobody
  // exercised — a blind spot, a stale build, an unrecognised failure — is covered
  // too. Each error is built with a deliberately internal-sounding message, and
  // the assertion is that none of it comes out the other side.
  const marker = 'INTERNAL-TEXT-THAT-MUST-NOT-TRAVEL';
  const clip = clipAt(slotAt(trackAt('t-1'), sceneAt(0, 1)));
  const notesAddress = notesAt(clip, 0);
  const value = {
    address: notesAddress,
    key: addressKey(notesAddress),
    fidelity: 'lossy' as const,
    value: { of: 'notes' as const, notes: [note({ gain: 0.7 })] },
    caveats: [marker],
  };

  const catalogue: unknown[] = [
    new UnprotectedWriteError('lossy', [marker], marker, [value]),
    new SlotOccupiedError([clip]),
    new BlindSpotError('scenes', [clip], 8),
    new BankWindowOverflowError('tracks', 4, 40, 16),
    new StaleAddressError(clip, 1, 2),
    new AddressUnresolvedError(notesAddress, marker),
    new AddressUnresolvedError(trackAt('t-1'), marker),
    new ChangesetNotFoundError('nope'),
    new EmptySliceError([marker]),
    new InvalidOpError('scene.create', marker),
    new ContractVersionError(0, 1),
    new WireDriftError('aaa', 'bbb'),
    new StaleExtensionError({ state: 'stale', detail: marker } as never),
    new Error(marker),
  ];

  for (const error of catalogue) {
    const said = JSON.stringify(refusalOf(error));
    assert.deepEqual(bannedWordsIn(said), [], said);
    assert.equal(said.includes('nothingWasWritten'), true);
    // ⚠ The unrecognised-failure fallback is the ONE that may carry internal
    // text, and it says so by putting it under `unexpected` rather than under
    // `why` — a bug report, not a message.
    const forwarded = said.includes(marker);
    assert.equal(
      forwarded,
      error instanceof Error && error.constructor === Error,
      `a classified refusal forwarded internal wording: ${said}`,
    );
  }
});

test('T-words: every boundary verdict has a sentence of its own, in the surface\'s words', () => {
  // ⚠ A `Record` over the union rather than a list, so a verdict added later
  // fails to COMPILE here — the same reason `verdictSentence` is a switch.
  const all: Record<BoundaryVerdict, true> = {
    ours: true, superseded: true, changed: true, moved: true, undecidable: true,
    unverified: true, unread: true, blind: true, unseen: true,
  };
  for (const verdict of Object.keys(all) as BoundaryVerdict[]) {
    const said = verdictSentence(verdict);
    assert.deepEqual(bannedWordsIn(said), [], `${verdict}: ${said}`);
    if (verdict === 'ours') {
      assert.equal(said, '', 'the one verdict that needs no explanation is the one that is fine');
      continue;
    }
    assert.ok(said.length > 40, `${verdict} needs a real sentence, not a label`);
  }
});

test('T-words: the note input covers every writable property and none of the others', () => {
  const schema = z.toJSONSchema(z.object(TOOLS.find((t) => t.name === 'write_notes')!.inputSchema));
  const text = JSON.stringify(schema);
  for (const [prop, fidelity] of Object.entries(NOTE_PROP_FIDELITY)) {
    // `duration` is `durationBeats` on the surface; the contract names the API
    // property, the surface names the unit it is in.
    const key = prop === 'duration' ? 'durationBeats' : prop;
    const present = text.includes(`"${key}"`);
    if (fidelity === 'unwritable') {
      assert.equal(present, false,
        `${key} cannot be written through this API, so it must not be on the surface — a caller `
        + 'who set it would see it work on a read and lose it for real');
      continue;
    }
    assert.equal(present, true,
      `${key} can be written and is missing from the surface, so nothing can ask for it`);
  }
});

// --- the transport ------------------------------------------------------------

test('T-stdout: nothing in the surface writes to stdout', async () => {
  // ⚠ stdio uses STDOUT for the protocol itself, so one stray log breaks the
  // transport with no message anywhere — the failure mode is "the tool silently
  // stops existing". Named as a risk in the session plan, and cheap to hold.
  const files = [
    ...(await readdir(HERE)).filter((f) => f.endsWith('.ts')).map((f) => join(HERE, f)),
    join(HERE, '..', 'mcp-server.ts'),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    // ⚠ Comments are stripped first, and finding out why is the reason this note
    // exists: the guard's first version failed on the very comment warning
    // against `console.log`. A guard that fires on its own documentation gets
    // deleted rather than fixed.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    assert.doesNotMatch(code, /console\.log|process\.stdout\.write/, `${file} writes to stdout`);
  }
});
