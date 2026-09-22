/** Phase 7b live dogfood for guarded agent note proposals and references. */
import { createInterface } from 'node:readline/promises';

import { LiveAdapter, type LiveTimingEvent } from '../adapters/live/adapter.js';
import { BridgeTransport, type Transport } from '../adapters/live/transport.js';
import type { Frame } from '../adapters/live/wiremap.js';
import {
  addressKey, clip, clipMetadata, scene, slot, track,
  type ClipAddress, type TrackState,
} from '../contract/index.js';
import { Executor, ownChangesetReversal, takeAppliedAnything } from '../engine/index.js';
import {
  NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA,
  compareCandidateToReference, compileNoteProposal, exactSourceToContext,
  hostBeatToRational, readExactNoteSource, referenceProjection, serializeExactNoteSource,
  type NoteCompilerTimingEvent, type NoteProposal, type NoteProposalInvariants,
} from '../musical/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import {
  EXPERIMENTAL_7B_TOOL_PROFILE, callTool,
} from '../surface/tools.js';
import { workspaceOf, type Workspace } from '../surface/workspace.js';
import { client as bridge } from './lib.js';

interface RequestTiming {
  readonly method: string;
  readonly elapsedMs: number;
  readonly scanMicros?: number;
}

class TimingTransport implements Transport {
  readonly requests: RequestTiming[] = [];

  constructor(private readonly inner: Transport) {}

  async send(frame: Frame): Promise<unknown> {
    const started = performance.now();
    const result = await this.inner.send(frame);
    const scanMicros = (result as { scanMicros?: unknown } | undefined)?.scanMicros;
    this.requests.push({
      method: frame.method,
      elapsedMs: performance.now() - started,
      ...(typeof scanMicros === 'number' ? { scanMicros } : {}),
    });
    return result;
  }

  close(): Promise<void> {
    return this.inner.close();
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function requireArgument(name: string): string {
  const value = argument(name);
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value;
}

function rowArgument(name: string, fallback?: number): number {
  const text = argument(name);
  const value = text === undefined ? fallback : Number(text);
  if (!Number.isSafeInteger(value) || value! < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value!;
}

function resolveTrack(
  tracks: readonly TrackState[],
  selector: string,
): TrackState {
  const byId = tracks.find((item) => item.channelId === selector);
  if (byId !== undefined) return byId;
  const byName = tracks.filter((item) => item.name === selector);
  if (byName.length !== 1) {
    throw new Error(`track selector ${JSON.stringify(selector)} did not resolve uniquely`);
  }
  return byName[0]!;
}

function countByMethod(requests: readonly RequestTiming[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const request of requests) counts.set(request.method, (counts.get(request.method) ?? 0) + 1);
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function sumLivePhases(events: readonly LiveTimingEvent[]): Record<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) totals.set(event.phase, (totals.get(event.phase) ?? 0) + event.elapsedMs);
  return Object.fromEntries([...totals]);
}

function noteCount(source: Awaited<ReturnType<typeof readExactNoteSource>>['source']): number {
  return source.clips.reduce((total, item) => total
    + item.channels.reduce((channelTotal, channel) => channelTotal + channel.notes.length, 0), 0);
}

function fixtureNotes(pitchOffset: number): readonly {
  startBeats: number;
  pitch: number;
  velocity: number;
  durationBeats: number;
}[] {
  return Array.from({ length: 16 }, (_, index) => ({
    startBeats: index,
    pitch: 60 + pitchOffset + index,
    velocity: 100,
    durationBeats: 0.75,
  }));
}

function assertOwnedFixture(
  source: Awaited<ReturnType<typeof readExactNoteSource>>['source'],
  pitchOffset: number,
  includeRevisionLayer: boolean,
): void {
  const clipState = source.clips[0];
  if (source.clips.length !== 1 || clipState?.metadata.lengthBeats !== 16) {
    throw new Error('the owned fixture clip geometry changed');
  }
  if (clipState.channels.slice(1).some((channel) => channel.notes.length > 0)) {
    throw new Error('the owned fixture has unexpected MIDI-channel content');
  }
  const expected = [
    ...fixtureNotes(pitchOffset).map((item) => ({
      ...item,
      releaseVelocity: 100 / 127,
      isChanceEnabled: true,
      isOccurrenceEnabled: true,
      isRecurrenceEnabled: true,
      recurrence: [1, 1] as const,
      isRepeatEnabled: true,
    })),
    ...(includeRevisionLayer ? [12, 13, 14, 15].map((startBeats, index) => ({
      startBeats,
      pitch: 84 + index,
      velocity: 92,
      durationBeats: 0.75,
      releaseVelocity: 64 / 127,
      gain: 1,
      isChanceEnabled: true,
      isOccurrenceEnabled: true,
      isRecurrenceEnabled: true,
      recurrence: [1, 1] as const,
      isRepeatEnabled: true,
    })) : []),
  ].sort((left, right) => left.startBeats - right.startBeats || left.pitch - right.pitch);
  const observed = [...clipState.channels[0]!.notes]
    .sort((left, right) => left.startBeats - right.startBeats || left.pitch - right.pitch);
  const canonicalNotes = (notes: readonly object[]) => JSON.stringify(notes.map((note) =>
    Object.fromEntries(Object.entries(note).sort(([left], [right]) => left.localeCompare(right)))));
  if (canonicalNotes(observed) !== canonicalNotes(expected)) {
    throw new Error('the owned fixture content changed; cleanup refused');
  }
}

function transposeProposal(
  source: Awaited<ReturnType<typeof readExactNoteSource>>['source'],
  value: string,
): NoteProposal {
  const changes = value.split(',').map((item) => {
    const match = /^([^:]+):(-?[0-9]+)$/.exec(item.trim());
    if (match === null) throw new Error('--transpose must use event-id:semitones entries');
    return { id: match[1]!, semitones: Number(match[2]!) };
  });
  const bySemitones = new Map<number, string[]>();
  for (const change of changes) {
    if (!source.eventMap.some((item) => item.id === change.id)) {
      throw new Error(`--transpose names unknown event ${change.id}`);
    }
    const ids = bySemitones.get(change.semitones) ?? [];
    ids.push(change.id);
    bySemitones.set(change.semitones, ids);
  }
  return {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [...bySemitones].map(([semitones, note_ids]) => ({
      op: 'transpose' as const, note_ids, semitones,
    })),
  };
}

function insertProposal(
  source: Awaited<ReturnType<typeof readExactNoteSource>>['source'],
  value: string,
): NoteProposal {
  if (source.aliases.length !== 1) {
    throw new Error('--insert needs a target source with one track alias');
  }
  const notes = value.split(',').map((item, index) => {
    const match = /^([^:]+):([^:]+):([0-9]+):([0-9]+)$/.exec(item.trim());
    if (match === null) throw new Error('--insert must use start:duration:pitch:velocity entries');
    return {
      id: `agent-new-${index + 1}`,
      track: source.aliases[0]!.alias,
      start: match[1]!,
      duration: match[2]!,
      pitch: Number(match[3]!),
      velocity: Number(match[4]!),
    };
  });
  return {
    schema: NOTE_PROPOSAL_SCHEMA,
    base_sha256: source.digest.value,
    ops: [{ op: 'insert', default_policy: 'track-neutral-v0', notes }],
  };
}

function proposalInvariants(
  source: Awaited<ReturnType<typeof readExactNoteSource>>['source'],
  proposal: NoteProposal,
): NoteProposalInvariants {
  const sourceCount = noteCount(source);
  const deleted = proposal.ops.reduce((total, operation) =>
    total + (operation.op === 'delete' ? operation.note_ids.length : 0), 0);
  const inserted = proposal.ops.reduce((total, operation) =>
    total + (operation.op === 'insert' ? operation.notes.length : 0), 0);
  const count = sourceCount - deleted + inserted;
  const allowedOperations = [...new Set(proposal.ops.map((operation) => operation.op))];
  return {
    schema: NOTE_INVARIANTS_SCHEMA,
    preserveUnmentionedFields: true,
    samePitchOverlap: 'refuse',
    allowedOperations,
    allowedTrackAliases: source.aliases.map((item) => item.alias),
    noteCount: { min: count, max: count },
    pitchRange: { min: 0, max: 127 },
    beatRange: {
      from: '0', to: hostBeatToRational(source.clips[0]!.metadata.lengthBeats),
      noteEndsWithin: true,
    },
    requiredEventIds: source.eventMap
      .filter((item) => !proposal.ops.some((operation) =>
        operation.op === 'delete' && operation.note_ids.includes(item.id)))
      .map((item) => item.id),
  };
}

function timedWorkspace(workspace: Workspace, events: { phase: string; elapsedMs: number }[]): Workspace {
  const timed = async <T>(phase: string, work: () => Promise<T>): Promise<T> => {
    const started = performance.now();
    try {
      return await work();
    } finally {
      events.push({ phase, elapsedMs: performance.now() - started });
    }
  };
  return Object.freeze<Workspace>({
    ...workspace,
    mark: () => timed('guard-mark', () => workspace.mark()),
    read: (addresses) => timed('complete-workspace-read', () => workspace.read(addresses)),
    apply: (ops, options) => timed('recorded-workspace-apply', () => workspace.apply(ops, options)),
  });
}

async function inventory(
  adapter: LiveAdapter,
  tracks: readonly TrackState[],
): Promise<void> {
  const at = await adapter.revision();
  const clipTracks = tracks.filter((item) =>
    item.type === 'Instrument' || item.type === 'Audio' || item.type === 'Hybrid');
  const candidates = clipTracks.flatMap((item) => Array.from(
    { length: at.window.scenes.count },
    (_, row) => ({ trackState: item, row, address: clip(slot(track(item.channelId), scene(row, at.sceneEpoch))) }),
  ));
  const snapshot = await adapter.preserveSelection(() =>
    adapter.read(candidates.map((item) => item.address)));
  const occupied = candidates.filter((item) => {
    const entry = snapshot.entries[addressKey(item.address)];
    return entry?.value.of === 'clip' && entry.value.exists;
  });
  const metadata = await adapter.preserveSelection(() =>
    adapter.read(occupied.map((item) => clipMetadata(item.address))));
  console.log(JSON.stringify({
    schema: 'ghostnote-phase7b-inventory-v0',
    at,
    clips: occupied.map((item) => {
      const entry = metadata.entries[addressKey(clipMetadata(item.address))];
      return {
        trackId: item.trackState.channelId,
        trackName: item.trackState.name,
        trackType: item.trackState.type,
        row: item.row,
        ...(entry?.value.of === 'clipMetadata' ? { metadata: entry.value.metadata } : {}),
      };
    }),
    effects: 'none',
  }, null, 2));
}

await bridge.connect();
const rig = await bridge.request('rig.info') as {
  readonly noteReadSteps?: number;
  readonly fineSteps?: number;
};
const selectionBefore = await bridge.request('selection.status') as {
  readonly trackIndex?: number;
  readonly slotIndex?: number;
  readonly mixerTrackIndex?: number;
};
const transport = new TimingTransport(new BridgeTransport(bridge));
const liveTimings: LiveTimingEvent[] = [];
const adapter = new LiveAdapter({ transport, onTiming: (event) => liveTimings.push(event) });
let emergencyCleanup: (() => Promise<void>) | undefined;

try {
  const adapterInfo = await adapter.hello();
  const tracks = await adapter.tracks();
  if (process.argv.includes('--restore-selection')) {
    const trackIndex = rowArgument('--track-index');
    const slotIndex = rowArgument('--slot-index');
    const result = await bridge.request('slot.select', {
      trackIndex, slotIndex, mechanism: 'track',
    });
    let observed = await bridge.request('selection.status') as {
      readonly trackIndex?: number; readonly slotIndex?: number;
    };
    const started = Date.now();
    while ((observed.trackIndex !== trackIndex || observed.slotIndex !== slotIndex)
        && Date.now() - started < 4_000) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      observed = await bridge.request('selection.status') as typeof observed;
    }
    console.log(JSON.stringify({
      schema: 'ghostnote-phase7b-selection-restore-v0',
      requested: { trackIndex, slotIndex },
      result,
      observed,
      effects: 'ui-selection-only',
    }, null, 2));
  } else if (process.argv.includes('--inventory')) {
    await inventory(adapter, tracks);
  } else {
    const selectedPosition = selectionBefore.mixerTrackIndex ?? selectionBefore.trackIndex;
    const selectedTrack = tracks.find((item) => item.position === selectedPosition);
    const targetTrack = argument('--target-track') === undefined
      ? selectedTrack : resolveTrack(tracks, argument('--target-track')!);
    if (targetTrack === undefined) {
      throw new Error('select a target track or supply --target-track');
    }
    const targetRow = rowArgument('--target-row', selectionBefore.slotIndex ?? 0);
    const referenceTrack = resolveTrack(tracks, requireArgument('--reference-track'));
    const referenceRow = rowArgument('--reference-row');
    const bpm = Number(argument('--bpm') ?? '120');
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error('--bpm must be positive');
    const projectEntry = await adapter.revision();
    let baseline = projectEntry;
    const targetAddress = clip(slot(
      track(targetTrack.channelId), scene(targetRow, baseline.sceneEpoch),
    ));
    const referenceAddress = clip(slot(
      track(referenceTrack.channelId), scene(referenceRow, baseline.sceneEpoch),
    ));
    if (addressKey(targetAddress) === addressKey(referenceAddress)) {
      throw new Error('the target and reference clip addresses must be separate');
    }

    const workspaceEvents: { phase: string; elapsedMs: number }[] = [];
    const stash = new Stash();
    const baseWorkspace = workspaceOf({
      ready: async () => undefined,
      adapter,
      executor: new Executor(adapter),
      stash,
      observationStore: new FakeObservationStore(),
    });
    const workspace = timedWorkspace(baseWorkspace, workspaceEvents);
    const fixture = process.argv.includes('--fixture');
    let fixtureSetupChangeId: string | undefined;
    let auditionChangeId: string | undefined;
    let auditionRestored = false;
    let fixtureCleaned = false;
    const reverseExact = async (changeId: string) => {
      const plan = await baseWorkspace.planRevert(changeId);
      if (plan.fidelity !== 'exact' || plan.unrestored.length > 0 || plan.withheld.length > 0) {
        throw new Error(`change ${changeId} does not have an exact safe reversal boundary`);
      }
      const reverted = await baseWorkspace.apply(plan.ops, { clearance: plan.clearance });
      if (!takeAppliedAnything(reverted.take)) {
        throw new Error(`change ${changeId} reversal wrote nothing`);
      }
      return { plan, changeId: reverted.take.id };
    };
    const cleanupFixture = async () => {
      if (!fixture || fixtureCleaned) return undefined;
      const changes: unknown[] = [];
      if (auditionChangeId !== undefined && !auditionRestored) {
        changes.push({ kind: 'audition', ...(await reverseExact(auditionChangeId)) });
        auditionRestored = true;
      }
      if (fixtureSetupChangeId !== undefined) {
        const target = await readExactNoteSource(adapter, {
          clips: [targetAddress],
          source: {
            kind: 'live-bitwig', id: 'phase7b-owned-fixture-target-final',
            permission: 'remove only the exact temporary Session 7b fixture',
          },
          expectedGeneration: baseline.generation,
        });
        const reference = await readExactNoteSource(adapter, {
          clips: [referenceAddress],
          source: {
            kind: 'live-bitwig', id: 'phase7b-owned-fixture-reference-final',
            permission: 'remove only the exact temporary Session 7b fixture',
          },
          expectedGeneration: baseline.generation,
        });
        assertOwnedFixture(target.source, 0, false);
        assertOwnedFixture(reference.source, 12, false);
        const setupChangeId = fixtureSetupChangeId;
        const reverted = await baseWorkspace.apply([
          { op: 'clip.delete', slot: targetAddress.slot },
          { op: 'clip.delete', slot: referenceAddress.slot },
        ], { clearance: ownChangesetReversal(setupChangeId) });
        if (!takeAppliedAnything(reverted.take)) {
          throw new Error('the temporary fixture cleanup wrote nothing');
        }
        changes.push({
          kind: 'fixture', of: setupChangeId, changeId: reverted.take.id,
        });
        fixtureSetupChangeId = undefined;
      }
      const empty = await baseWorkspace.read([targetAddress, referenceAddress]);
      const exactEmpty = [targetAddress, referenceAddress].every((address) => {
        const entry = empty.entries[addressKey(address)];
        return entry?.value.of === 'clip' && !entry.value.exists;
      });
      if (!exactEmpty) throw new Error('the temporary live fixture did not return to empty slots');
      fixtureCleaned = true;
      emergencyCleanup = undefined;
      return { exactEmpty, changes };
    };
    emergencyCleanup = fixture ? async () => { await cleanupFixture(); } : undefined;

    if (fixture) {
      if (argument('--apply-preview') !== 'generated') {
        throw new Error('--fixture requires --apply-preview generated for one-process cleanup');
      }
      const empty = await baseWorkspace.read([targetAddress, referenceAddress]);
      for (const address of [targetAddress, referenceAddress]) {
        const entry = empty.entries[addressKey(address)];
        if (entry?.value.of !== 'clip' || entry.value.exists) {
          throw new Error('--fixture needs two verified empty target slots');
        }
      }
      const setup = await baseWorkspace.apply([
        { op: 'clip.create', slot: targetAddress.slot, lengthBeats: 16 },
        { op: 'clip.create', slot: referenceAddress.slot, lengthBeats: 16 },
        { op: 'note.write', clip: targetAddress, channel: 0, notes: fixtureNotes(0) },
        { op: 'note.write', clip: referenceAddress, channel: 0, notes: fixtureNotes(12) },
      ]);
      if (!takeAppliedAnything(setup.take)) throw new Error('the temporary fixture wrote nothing');
      fixtureSetupChangeId = setup.take.id;
      baseline = await adapter.revision();
    }

    if (process.argv.includes('--cleanup-owned-fixture')) {
      const target = await readExactNoteSource(adapter, {
        clips: [targetAddress],
        source: {
          kind: 'live-bitwig', id: 'phase7b-owned-fixture-target-cleanup',
          permission: 'remove only the exact temporary Session 7b fixture',
        },
        expectedGeneration: baseline.generation,
      });
      const reference = await readExactNoteSource(adapter, {
        clips: [referenceAddress],
        source: {
          kind: 'live-bitwig', id: 'phase7b-owned-fixture-reference-cleanup',
          permission: 'remove only the exact temporary Session 7b fixture',
        },
        expectedGeneration: baseline.generation,
      });
      assertOwnedFixture(target.source, 0, true);
      assertOwnedFixture(reference.source, 12, false);
      const fixtureChangeId = requireArgument('--fixture-change');
      const cleanup = await baseWorkspace.apply([
        { op: 'clip.delete', slot: targetAddress.slot },
        { op: 'clip.delete', slot: referenceAddress.slot },
      ], { clearance: ownChangesetReversal(fixtureChangeId) });
      if (!takeAppliedAnything(cleanup.take)) throw new Error('owned fixture cleanup wrote nothing');
      const empty = await baseWorkspace.read([targetAddress, referenceAddress]);
      const exactEmpty = [targetAddress, referenceAddress].every((address) => {
        const entry = empty.entries[addressKey(address)];
        return entry?.value.of === 'clip' && !entry.value.exists;
      });
      if (!exactEmpty) throw new Error('owned fixture cleanup did not leave both slots empty');
      console.log(JSON.stringify({
        schema: 'ghostnote-phase7b-owned-fixture-cleanup-v0',
        targetSourceSha256: target.source.digest.value,
        referenceSourceSha256: reference.source.digest.value,
        fixtureChangeId,
        cleanupChangeId: cleanup.take.id,
        exactEmpty,
        exit: await adapter.revision(),
      }, null, 2));
    } else {
      const targetAcquisition = await readExactNoteSource(adapter, {
      clips: [targetAddress],
      source: {
        kind: 'live-bitwig',
        id: `phase7b-seed:${baseline.generation}:${targetTrack.channelId}:${targetRow}`,
        permission: 'operator-requested private project edit for session 7b',
      },
      expectedGeneration: baseline.generation,
    });
    const referenceAcquisition = await readExactNoteSource(adapter, {
      clips: [referenceAddress],
      source: {
        kind: 'live-bitwig',
        id: `phase7b-reference:${baseline.generation}:${referenceTrack.channelId}:${referenceRow}`,
        permission: 'operator-requested private project reference for session 7b',
      },
      expectedGeneration: baseline.generation,
    });
    const targetSource = targetAcquisition.source;
    const referenceSource = referenceAcquisition.source;
    const targetLength = targetSource.clips[0]!.metadata.lengthBeats;
    const referenceLength = referenceSource.clips[0]!.metadata.lengthBeats;
    if (!process.argv.includes('--allow-short') && (targetLength < 8 || referenceLength < 8)) {
      throw new Error('the dogfood target and reference must each be at least eight beats');
    }
    const targetContext = exactSourceToContext({
      source: targetSource,
      task: {
        id: 'phase7b-reference-conditioned-revision',
        mode: 'compact-bar-v0',
        coverage: { fromBeats: 0, toBeats: targetLength },
        meter: { numerator: 4, denominator: 4 },
        tempoMap: [{ atBeats: 0, bpm }],
        measurements: ['note-count-v0', 'pitch-span-v0'],
      },
    });
    const referenceStarted = performance.now();
    const referenceContext = referenceProjection({
      seed: targetSource,
      reference: referenceSource,
      expectedReferenceSha256: referenceSource.digest.value,
      task: {
        id: 'phase7b-reference-conditioned-revision',
        profile: 'extracted-structure-v0',
        coverage: { fromBeats: 0, toBeats: referenceLength },
        roles: [
          {
            source: 'seed', trackId: targetTrack.channelId,
            role: 'revision-target', provenance: 'live Phase 7b task declaration',
          },
          {
            source: 'reference', trackId: referenceTrack.channelId,
            role: 'revision-target', provenance: 'live Phase 7b task declaration',
          },
        ],
      },
    });
    const referenceProjectionMs = performance.now() - referenceStarted;
    const transpose = argument('--transpose');
    const insert = argument('--insert');
    if (transpose !== undefined && insert !== undefined) {
      throw new Error('use only one of --transpose or --insert');
    }
    const requestedEdit = transpose !== undefined || insert !== undefined;
    const baseOutput = {
      schema: 'ghostnote-phase7b-run-v0',
      profile: EXPERIMENTAL_7B_TOOL_PROFILE,
      permissions: [
        'read one complete target clip',
        'read one complete private reference clip',
        ...(requestedEdit ? ['one accepted guarded target edit'] : ['no project write']),
      ],
      adapter: adapterInfo,
      reader: { advertisedSteps: rig.noteReadSteps ?? rig.fineSteps ?? null },
      target: {
        trackId: targetTrack.channelId, trackName: targetTrack.name,
        row: targetRow, lengthBeats: targetLength,
        sourceSha256: targetSource.digest.value,
        exactBytes: Buffer.byteLength(serializeExactNoteSource(targetSource), 'utf8'),
        noteCount: noteCount(targetSource),
        context: targetContext.rendered,
      },
      reference: {
        trackId: referenceTrack.channelId, trackName: referenceTrack.name,
        row: referenceRow, lengthBeats: referenceLength,
        sourceSha256: referenceSource.digest.value,
        permission: referenceSource.source.permission,
        exactBytes: Buffer.byteLength(serializeExactNoteSource(referenceSource), 'utf8'),
        noteCount: noteCount(referenceSource),
        context: referenceContext,
      },
      projectEntry,
      baseline,
      fixture: fixture ? {
        temporary: true,
        setupChangeId: fixtureSetupChangeId,
        cleanupPolicy: 'remove both temporary clips after the operator verdict',
      } : undefined,
      selectionBefore,
    };
    if (!requestedEdit) {
      console.log(JSON.stringify({
        ...baseOutput,
        timingMs: {
          targetAcquisition: targetAcquisition.acquisitionMs,
          targetCanonicalizationAndHash: targetAcquisition.canonicalizationAndHashMs,
          referenceAcquisition: referenceAcquisition.acquisitionMs,
          referenceCanonicalizationAndHash: referenceAcquisition.canonicalizationAndHashMs,
          referenceProjection: referenceProjectionMs,
          adapterPhases: sumLivePhases(liveTimings),
        },
        bridgeRequestCounts: countByMethod(transport.requests),
        exit: await adapter.revision(),
        selectionAfter: await bridge.request('selection.status'),
        effects: 'none',
      }, null, 2));
    } else {
      const proposal = transpose === undefined
        ? insertProposal(targetSource, insert!)
        : transposeProposal(targetSource, transpose);
      const invariants = proposalInvariants(targetSource, proposal);
      const compilerTimings: NoteCompilerTimingEvent[] = [];
      const compiled = compileNoteProposal(
        { source: targetSource, proposal, invariants },
        { onTiming: (event) => compilerTimings.push(event) },
      );
      const comparisonStarted = performance.now();
      const comparison = compareCandidateToReference(
        referenceContext, referenceSource, compiled.candidate,
      );
      const comparisonMs = performance.now() - comparisonStarted;
      const input = {
        mode: 'agent-note-proposal-v0' as const,
        source: targetSource,
        proposal,
        invariants,
        reference: { projection: referenceContext, source: referenceSource },
      };
      const previewStarted = performance.now();
      const preview = await callTool(workspace, 'transform_clip_music', {
        ...input, action: 'preview',
      }, EXPERIMENTAL_7B_TOOL_PROFILE) as Record<string, unknown>;
      const previewToolMs = performance.now() - previewStarted;
      const previewValue = preview['preview'] as {
        readonly previewDigest?: { readonly value?: string };
      } | undefined;
      const previewSha256 = previewValue?.previewDigest?.value;
      if (previewSha256 !== compiled.previewDigest.value) {
        throw new Error('the experimental tool preview differs from the measured compiler preview');
      }
      const applyPreviewArgument = argument('--apply-preview');
      const acceptedPreviewSha256 = applyPreviewArgument === 'generated'
        ? previewSha256 : applyPreviewArgument;
      if (acceptedPreviewSha256 === undefined) {
        console.log(JSON.stringify({
          ...baseOutput,
          proposal,
          invariants,
          preview,
          comparison,
          timingMs: {
            targetAcquisition: targetAcquisition.acquisitionMs,
            targetCanonicalizationAndHash: targetAcquisition.canonicalizationAndHashMs,
            referenceAcquisition: referenceAcquisition.acquisitionMs,
            referenceCanonicalizationAndHash: referenceAcquisition.canonicalizationAndHashMs,
            referenceProjection: referenceProjectionMs,
            compilerPhases: compilerTimings,
            completeReferenceComparison: comparisonMs,
            experimentalPreviewInclusive: previewToolMs,
            adapterPhases: sumLivePhases(liveTimings),
          },
          bridgeRequestCounts: countByMethod(transport.requests),
          exit: await adapter.revision(),
          selectionAfter: await bridge.request('selection.status'),
          effects: 'none',
        }, null, 2));
      } else {
        const backing = requireArgument('--backing');
        const listeningInstruction = requireArgument('--listening-instruction');
        const applyStarted = performance.now();
        const application = await callTool(workspace, 'transform_clip_music', {
          ...input,
          action: 'apply',
          acceptedPreviewSha256,
        }, EXPERIMENTAL_7B_TOOL_PROFILE) as Record<string, unknown>;
        const applyToolMs = performance.now() - applyStarted;
        if (application['applied'] !== true) {
          throw new Error(`the experimental apply did not complete: ${JSON.stringify(application)}`);
        }
        const change = application['change'] as { readonly id: string };
        auditionChangeId = change.id;
        const readback = application['readback'] as { readonly discrepancies?: readonly unknown[] };
        if ((readback.discrepancies?.length ?? 0) !== 0) {
          throw new Error('the independent complete readback differs from the accepted candidate');
        }
        await baseWorkspace.showClipInEditor(targetAddress, await adapter.revision());
        console.log(JSON.stringify({
          ...baseOutput,
          proposal,
          invariants,
          preview,
          comparison,
          application,
          audition: {
            backing,
            targetLengthBeats: targetLength,
            instruction: listeningInstruction,
            verdict: 'pending-operator-response',
          },
          timingMs: {
            targetAcquisition: targetAcquisition.acquisitionMs,
            targetCanonicalizationAndHash: targetAcquisition.canonicalizationAndHashMs,
            referenceAcquisition: referenceAcquisition.acquisitionMs,
            referenceCanonicalizationAndHash: referenceAcquisition.canonicalizationAndHashMs,
            referenceProjection: referenceProjectionMs,
            compilerPhases: compilerTimings,
            completeReferenceComparison: comparisonMs,
            experimentalPreviewInclusive: previewToolMs,
            experimentalApplyInclusive: applyToolMs,
            workspaceEvents,
            adapterPhases: sumLivePhases(liveTimings),
          },
          bridgeRequestCounts: countByMethod(transport.requests),
          effects: 'applied-awaiting-verdict',
        }, null, 2));
        console.log('GHOSTNOTE_VERDICT_REQUIRED accepted|rejected');
        const prompt = createInterface({ input: process.stdin, output: process.stdout });
        const verdict = (await prompt.question('verdict> ')).trim().toLowerCase();
        prompt.close();
        if (verdict !== 'accepted' && verdict !== 'rejected') {
          throw new Error('the operator verdict must be accepted or rejected');
        }
        let reversal: unknown;
        if (verdict === 'rejected') {
          reversal = await reverseExact(change.id);
          auditionRestored = true;
          const restored = await readExactNoteSource(adapter, {
            clips: [targetAddress],
            source: targetSource.source,
            expectedGeneration: targetSource.observedAt.generation,
          });
          const exactRestored = JSON.stringify(restored.source.clips)
            === JSON.stringify(targetSource.clips);
          reversal = {
            ...(reversal as object), exactRestored,
            restoredSourceSha256: restored.source.digest.value,
          };
          if (!exactRestored) throw new Error('the rejected result did not restore exact clip state');
        }
        const fixtureCleanup = await cleanupFixture();
        const exit = await adapter.revision();
        console.log(JSON.stringify({
          schema: 'ghostnote-phase7b-verdict-v0',
          targetSourceSha256: targetSource.digest.value,
          referenceSourceSha256: referenceSource.digest.value,
          changeId: change.id,
          verdict,
          ...(reversal === undefined ? {} : { reversal }),
          ...(fixtureCleanup === undefined ? {} : { fixtureCleanup }),
          exit,
          selectionAfter: await bridge.request('selection.status'),
          changes: stash.log.list(),
        }, null, 2));
      }
    }
    }
  }
} finally {
  await emergencyCleanup?.();
  await adapter.close();
}
