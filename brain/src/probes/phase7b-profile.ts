/**
 * The retired `phase-7b-agent-note-patch-v0` tools (8h4d). Research only.
 *
 * 8h4d removed the 7b profile from the selectable profiles: its comparison
 * owners (E131 pairing, E230, the E233 matrix) are discharged. The historical
 * probes that drove it still run through `callExperimental7b`. The frozen
 * registration of the profile is evidence:
 * `context/evidence/data/phase8h4d-surface/phase7b-registration.json`.
 * No product module imports this file.
 */
import { z } from 'zod';

import {
  addressKey, clip as clipAt, clipMetadata as metadataAt, notes as notesAt, scene as sceneAt, slot as slotAt,
  track as trackAt, ClipSnapshotRefusedError, clipSnapshotFrom, decodeClipSnapshotRef, encodeClipSnapshotRef,
  type Address, type ClipSnapshot, type ClipSnapshotRef, type ClipSnapshotVerdict,
} from '../contract/index.js';
import { checkClipSnapshots } from '../engine/index.js';
import {
  applyNoteProposal, compareCandidateToReference, compileNoteProposal, musicalPatchSchema,
  noteProposalInvariantsSchema, noteProposalSchema, referenceContextResultValidator, validateExactNoteSource,
  exactNoteClipRangeDiagnostic, snapshotToExactSource,
  type ExactNoteSource, type NoteCompilerRequest,
} from '../musical/index.js';
import { refusalOf } from '../surface/report.js';
import { TOOLS, callToolSpec, type ToolSpec } from '../surface/tools.js';
import type { Workspace } from '../surface/workspace.js';

export const EXPERIMENTAL_7B_TOOL_PROFILE = 'phase-7b-agent-note-patch-v0';

async function writing<T>(run: () => Promise<T>): Promise<T | ReturnType<typeof refusalOf>> {
  try {
    return await run();
  } catch (error) {
    return refusalOf(error);
  }
}

const exactSourceInput = z.custom<ExactNoteSource>((value) => {
  try {
    validateExactNoteSource(value as ExactNoteSource);
    return true;
  } catch {
    return false;
  }
}).describe(
  'Complete ghostnote-exact-note-source-v0 state from the experimental symbolic path.',
);
const referenceInput = z.object({
  projection: referenceContextResultValidator.describe(
    'Validated reference-context-v0 projection.',
  ),
  source: exactSourceInput.describe('Complete permitted reference source used by the projection.'),
}).strict();
const agentProposalBase = {
  mode: z.literal('agent-note-proposal-v0'),
  source: exactSourceInput,
  proposal: noteProposalSchema,
  invariants: noteProposalInvariantsSchema,
  reference: referenceInput.optional(),
  snapshot: z.string().min(1).optional().describe(
    'D32 snapshot reference from acquire_clip_note_source. Apply refuses before any write '
    + 'unless the reference is current.',
  ),
};
const agentProposalInput = z.discriminatedUnion('action', [
  z.object({ ...agentProposalBase, action: z.literal('preview') }).strict(),
  z.object({
    ...agentProposalBase,
    action: z.literal('apply'),
    acceptedPreviewSha256: z.string().regex(/^[0-9a-f]{64}$/),
  }).strict(),
]);
const experimentalTransformationInput = z.union([musicalPatchSchema, agentProposalInput]);

function agentProposalRequest(args: z.infer<typeof agentProposalInput>): NoteCompilerRequest {
  return {
    source: args.source,
    proposal: args.proposal,
    invariants: args.invariants,
  };
}

function proposalReferenceComparison(
  args: z.infer<typeof agentProposalInput>,
  candidate: ReturnType<typeof compileNoteProposal>['candidate'],
) {
  if (args.reference === undefined) return undefined;
  return compareCandidateToReference(
    args.reference.projection,
    args.reference.source,
    candidate,
  );
}

const stableTransformation = TOOLS.find((item) => item.name === 'transform_clip_music')!;
const experimentalTransformation: ToolSpec = {
  ...stableTransformation,
  title: 'Transform music or execute an accepted agent note proposal',
  description: `${stableTransformation.description}\n`
    + `Experimental profile ${EXPERIMENTAL_7B_TOOL_PROFILE}: mode agent-note-proposal-v0 `
    + 'accepts only ghostnote-note-patch-v0. Preview is read-only and returns the complete exact '
    + 'before and candidate state, typed operations, guards, invariants, defaults, loss, and a '
    + 'preview digest. Apply needs that exact digest, refreshes complete state, uses the recorded '
    + 'workspace write seam, and performs an independent complete readback. Stale state, pressure '
    + 'loss, unreported overlap shortening, unsupported timing, and invariant failures refuse.'
    + ' Incompatible stored note coordinates refuse with this remediation: select the clip in '
    + 'Bitwig and use Consolidate. Then read the clip and preview the change again.'
    + ' With a snapshot reference, apply checks the reference before any write and again at the '
    + 'stash read. A stale reference refuses and returns the new snapshot.',
  inputValidator: experimentalTransformationInput,
  resultContract: {
    format: 'ghostnote-agent-note-proposal-result',
    version: 0,
    profile: EXPERIMENTAL_7B_TOOL_PROFILE,
    actions: ['preview', 'apply'],
    preview: [
      'before', 'candidate', 'operations', 'guards', 'invariants', 'insertionDefaults',
      'losses', 'previewDigest',
    ],
    apply: ['change', 'readback', 'reversal'],
    snapshotRefusal: ['verdicts'],
  },
  async run(workspace, input) {
    if ((input as { mode?: unknown }).mode !== 'agent-note-proposal-v0') {
      return stableTransformation.run(workspace, input as never);
    }
    const args = input as z.infer<typeof agentProposalInput>;
    return writing(async () => {
      const request = agentProposalRequest(args);
      const preview = compileNoteProposal(request);
      const referenceComparison = proposalReferenceComparison(args, preview.candidate);
      if (args.action === 'preview') {
        return {
          format: 'ghostnote-agent-note-proposal-result',
          version: 0,
          profile: EXPERIMENTAL_7B_TOOL_PROFILE,
          action: 'preview',
          applied: false,
          preview,
          ...(referenceComparison === undefined ? {} : { referenceComparison }),
        };
      }
      let refs: ClipSnapshotRef[] | undefined;
      if (args.snapshot !== undefined) {
        refs = [decodeClipSnapshotRef(args.snapshot)];
        const named = args.source.clips.some((item) => item.address.slot.track.channelId === refs![0]!.channelId
          && item.address.slot.scene.index === refs![0]!.row);
        if (!named) throw new Error('the snapshot reference names a clip that the proposal source does not contain');
        const verdicts = await checkClipSnapshots(workspace, refs);
        if (verdicts.some((item) => item.verdict !== 'current')) return snapshotRefusal(verdicts);
      }
      let application: Awaited<ReturnType<typeof applyNoteProposal>>;
      try {
        application = await applyNoteProposal(workspace, {
          ...request,
          acceptedPreviewSha256: args.acceptedPreviewSha256,
        }, refs === undefined ? {} : { ifSnapshot: refs });
      } catch (error) {
        if (error instanceof ClipSnapshotRefusedError) return snapshotRefusal(error.verdicts);
        throw error;
      }
      return {
        format: 'ghostnote-agent-note-proposal-result',
        version: 0,
        profile: EXPERIMENTAL_7B_TOOL_PROFILE,
        action: 'apply',
        applied: application.applied,
        preview: application.preview,
        ...(referenceComparison === undefined ? {} : { referenceComparison }),
        change: application.change,
        ...(application.readback === undefined ? {} : { readback: application.readback }),
        ...(application.verificationFailure === undefined
          ? {} : { verificationFailure: application.verificationFailure }),
        reversal: application.reversal,
      };
    });
  },
};

/** One snapshot as agents see it: an opaque reference and the clip content. */
function publicClipSnapshot(snapshot: ClipSnapshot) {
  return {
    snapshot: encodeClipSnapshotRef(snapshot.ref),
    clip: {
      metadata: snapshot.metadata,
      channels: snapshot.channels.map((notes, channel) => ({ channel, notes })),
    },
  };
}

/** One D32 verdict. Only a stale verdict carries a new snapshot. */
function publicVerdict(verdict: ClipSnapshotVerdict) {
  const base = {
    snapshot: encodeClipSnapshotRef(verdict.ref),
    target: { trackId: verdict.ref.channelId, row: verdict.ref.row },
    verdict: verdict.verdict,
  };
  switch (verdict.verdict) {
    case 'current':
      return base;
    case 'stale':
      return { ...base, newSnapshot: publicClipSnapshot(verdict.snapshot) };
    case 'uncovered':
      return { ...base, uncoveredIn: verdict.uncoveredIn };
    case 'identity-changed':
      return { ...base, why: verdict.why, ...(verdict.events === undefined ? {} : { events: verdict.events.map(
        (event) => ({ trackId: event.channelId, row: event.slotIndex, filled: event.filled })) }) };
    default:
      return { ...base, why: verdict.why };
  }
}

function snapshotRefusal(verdicts: readonly ClipSnapshotVerdict[]) {
  return {
    format: 'ghostnote-agent-note-proposal-result',
    version: 0,
    profile: EXPERIMENTAL_7B_TOOL_PROFILE,
    action: 'apply',
    applied: false,
    snapshotRefusal: { verdicts: verdicts.map(publicVerdict) },
  };
}

const experimentalAcquisitionInput = z.object({
  trackId: z.string().min(1).describe('Durable Bitwig track channel ID.'),
  row: z.number().int().min(0).describe('Zero-based launcher row.'),
}).strict();

/** Normalize one validated source and reject event identity loss. */
export function normalizeExactSourceForAcquisition(source: ExactNoteSource) {
  const eventIds = new Map(source.eventMap.map((item) => [
    `${item.channel}:${item.pitch}:${item.startBeats}`, item.id,
  ]));
  const collisionKeys = new Set<string>();
  return source.clips[0]!.channels.flatMap((channel) => channel.notes.map((item) => {
    const startTick = Math.round(item.startBeats * 512);
    const durationTicks = Math.max(1, Math.round(item.durationBeats * 512));
    const collisionKey = `${channel.channel}:${item.pitch}:${startTick}`;
    if (collisionKeys.has(collisionKey)) {
      throw new Error(`normalization collision at MIDI channel ${channel.channel}, pitch `
        + `${item.pitch}, tick ${startTick}`);
    }
    collisionKeys.add(collisionKey);
    const eventId = eventIds.get(`${channel.channel}:${item.pitch}:${item.startBeats}`);
    if (eventId === undefined) throw new Error('the exact event identity map is incomplete');
    const { startBeats: _start, durationBeats: _duration, ...fields } = item;
    return { eventId, channel: channel.channel, startTick, durationTicks, ...fields };
  }));
}

/** Acquire one guarded clip through the complete reader, then normalize agent timing. */
const experimentalClipAcquisition: ToolSpec = {
  name: 'acquire_clip_note_source',
  kind: 'read',
  title: 'Acquire one complete launcher clip',
  description: `Experimental profile ${EXPERIMENTAL_7B_TOOL_PROFILE}. Read one launcher clip by `
    + 'durable track ID and row. The result uses the 8h3c cold reader: one 1/512-beat capture of '
    + 'the complete clip (D31). It covers all 16 MIDI channels and note fields, and labels itself '
    + 'authoritative. Normalized note timing uses integer 1/512-beat ticks. The call refuses a '
    + 'missing target, unsupported played range, incomplete coverage, project or target drift, and '
    + 'a normalization collision. It returns the guarded exact source accepted by '
    + 'agent-note-proposal-v0 and a D32 snapshot reference. Give the reference to '
    + 'check_clip_snapshots or to an agent-note-proposal-v0 apply.',
  inputSchema: experimentalAcquisitionInput.shape,
  inputValidator: experimentalAcquisitionInput,
  emits: [],
  resultContract: {
    format: 'ghostnote-clip-acquisition',
    version: 0,
    profile: EXPERIMENTAL_7B_TOOL_PROFILE,
    authority: 'authoritative-complete-scan',
    reader: 'cold-1/512-d31',
    normalizedTiming: { unit: 'beat-tick', ticksPerBeat: 512 },
    coverage: 'complete-all-16-channels',
    guards: ['project', 'generation', 'revision', 'sceneEpoch', 'contentEpoch', 'sourceSha256'],
    snapshot: 'ghostnote-clip-snapshot/1',
  },
  async run(workspace, input) {
    const args = input as z.infer<typeof experimentalAcquisitionInput>;
    const started = performance.now();
    const before = await workspace.mark();
    if (before.project.length === 0) throw new Error('the live project identity is unavailable');
    if (before.window.tracks.count < 0 || before.window.scenes.count < 0) {
      throw new Error('the project track or scene inventory is not settled');
    }
    if (before.window.tracks.count > before.window.tracks.bankSize
        || before.window.scenes.count > before.window.scenes.bankSize) {
      throw new Error('the complete project target inventory is outside the observed window');
    }
    if (args.row >= before.window.scenes.count || args.row >= before.window.scenes.bankSize) {
      throw new Error(`launcher row ${args.row} is outside the current project`);
    }
    const matchingTracks = (await workspace.tracks())
      .filter((item) => item.channelId === args.trackId);
    if (matchingTracks.length !== 1) {
      throw new Error(`durable track ID ${args.trackId} did not resolve to exactly one track`);
    }
    const address = clipAt(slotAt(trackAt(args.trackId), sceneAt(args.row, before.sceneEpoch)));
    const addresses: Address[] = [
      trackAt(args.trackId), address, metadataAt(address),
      ...Array.from({ length: 16 }, (_, channel) => notesAt(address, channel)),
    ];
    const acquisitionStarted = performance.now();
    const read = () => workspace.read(addresses, { sources: [address] });
    const snapshot = workspace.preserveSelection === undefined
      ? await read()
      : await workspace.preserveSelection(read);
    const acquisitionMs = performance.now() - acquisitionStarted;
    if (snapshot.at.project !== before.project || snapshot.at.generation !== before.generation
        || snapshot.at.sceneEpoch !== before.sceneEpoch
        || snapshot.at.contentEpoch !== before.contentEpoch) {
      throw new Error('the project or launcher target changed during acquisition');
    }
    const source = snapshotToExactSource({
      snapshot,
      clips: [address],
      source: {
        kind: 'live-bitwig',
        id: `launcher:${args.trackId}:${args.row}`,
        permission: 'live project state requested through the experimental Ghostnote profile',
      },
      expectedGeneration: before.generation,
    });
    const diagnostic = exactNoteClipRangeDiagnostic(source.clips[0]!);
    if (diagnostic !== undefined) throw new Error(diagnostic.message);
    const normalizationStarted = performance.now();
    const notes = normalizeExactSourceForAcquisition(source);
    const normalizationMs = performance.now() - normalizationStarted;
    return {
      format: 'ghostnote-clip-acquisition',
      version: 0,
      profile: EXPERIMENTAL_7B_TOOL_PROFILE,
      authority: 'authoritative-complete-scan',
      target: {
        trackId: args.trackId,
        trackName: matchingTracks[0]!.name,
        row: args.row,
      },
      coverage: {
        complete: true,
        channels: 16,
        notes: notes.length,
        omittedFields: [],
        unavailableFields: [],
      },
      timingPlane: { unit: 'beat-tick', ticksPerBeat: 512 },
      clip: { metadata: source.clips[0]!.metadata, notes },
      guards: {
        project: snapshot.at.project,
        generation: snapshot.at.generation,
        revision: snapshot.at.revision,
        sceneEpoch: snapshot.at.sceneEpoch,
        contentEpoch: snapshot.at.contentEpoch,
        sourceSha256: source.digest.value,
      },
      exactSource: source,
      snapshot: encodeClipSnapshotRef(clipSnapshotFrom(snapshot, address).ref),
      timing: {
        acquisitionMs,
        normalizationMs,
        totalMs: performance.now() - started,
      },
    };
  },
};

const snapshotCheckInput = z.object({
  snapshots: z.array(z.string().min(1)).min(1).max(64)
    .describe('D32 snapshot references from acquire_clip_note_source or an earlier check.'),
}).strict();

/** The D32 survey: one verdict for each reference, and a new snapshot only for a stale clip. */
const experimentalSnapshotCheck: ToolSpec = {
  name: 'check_clip_snapshots',
  kind: 'read',
  title: 'Check clip snapshot references',
  description: `Experimental profile ${EXPERIMENTAL_7B_TOOL_PROFILE}. Read each referenced launcher `
    + 'clip again and give one verdict for each reference. current: the clip content at the address '
    + 'is unchanged. stale: the content changed; the result has the new snapshot. identity-changed: '
    + 'the scene layout or the launcher slot changed, or the change record is incomplete; resolve '
    + 'the address again. absent: the track or the clip is missing. incomparable: the project '
    + 'changed or the extension reloaded. uncovered: the project is outside the observed window. '
    + 'Only stale returns a snapshot. A current verdict states equal content at the same address. '
    + 'It does not prove the same host clip object.',
  inputSchema: snapshotCheckInput.shape,
  inputValidator: snapshotCheckInput,
  emits: [],
  resultContract: {
    format: 'ghostnote-clip-snapshot-check',
    version: 0,
    profile: EXPERIMENTAL_7B_TOOL_PROFILE,
    verdicts: ['current', 'stale', 'identity-changed', 'absent', 'incomparable', 'uncovered'],
  },
  async run(workspace, input) {
    const args = input as z.infer<typeof snapshotCheckInput>;
    const started = performance.now();
    const refs = args.snapshots.map(decodeClipSnapshotRef);
    // 8h4a: a selection from an earlier project is no selection, so the outer scope no longer
    // refuses after a project switch. The 8h3e workaround without a scope is removed.
    const check = () => checkClipSnapshots(workspace, refs);
    const verdicts = workspace.preserveSelection === undefined
      ? await check()
      : await workspace.preserveSelection(check);
    return {
      format: 'ghostnote-clip-snapshot-check',
      version: 0,
      profile: EXPERIMENTAL_7B_TOOL_PROFILE,
      verdicts: verdicts.map(publicVerdict),
      timing: { totalMs: performance.now() - started },
    };
  },
};

export const EXPERIMENTAL_7B_TOOLS: readonly ToolSpec[] = [
  ...TOOLS.map((item) => item.name === 'transform_clip_music' ? experimentalTransformation : item),
  experimentalClipAcquisition,
  experimentalSnapshotCheck,
];

/** Run one tool of the retired 7b list by name. */
export async function callExperimental7b(workspace: Workspace, name: string, args: unknown = {}): Promise<unknown> {
  const spec = EXPERIMENTAL_7B_TOOLS.find((item) => item.name === name);
  if (spec === undefined) throw new Error(`no such tool: ${name}`);
  return callToolSpec(workspace, spec, args);
}
