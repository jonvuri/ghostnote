/**
 * The tools that the `agent-native-v1` profile adds to the stable list (8h4b).
 *
 * `read_launcher_clip` reads one Launcher clip as a Document 1.0 snapshot.
 * `check_launcher_clips` checks base refs from that read with the D32 verdict.
 * Both use the shared result module and the private identity registry. Every
 * read is one fresh cold read on all 16 channels; there is no resident cache.
 *
 * This module imports only types from `tools.ts`; `tools.ts` composes the
 * profile, so there is no import cycle.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { z } from 'zod';

import {
  CLIP_READ_SOUNDING_CELLS, addressKey, clipSnapshotFrom, contentTouching, deltaComplete, isGroupTrack, judgeClipSnapshot,
  snapshotAddresses, snapshotClip, track as trackAt, unpinnedCursorTracksOf,
  type ClipSnapshot, type ClipSnapshotVerdict, type RevisionMark,
} from '../contract/index.js';
import { readWithClipSnapshots } from '../engine/index.js';
import { IdentityRegistry, type Acquired, type BaseEntry, type Retirement } from '../bindings/identity-registry.js';
import {
  LauncherClipReadError, cellKey, encodeLauncherClip,
  launcherClipCells, projectLauncherClip, type LauncherClipProjection,
} from '../bindings/launcher-clip-document.js';
import type { Encoding } from '../document/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ToolFailure, VERDICT_CODES, failureResult,
  type FailureCode, type ReadResult, type Warning,
} from './agent-native-result.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const READ_SCHEMA = 'ghostnote-launcher-clip-read/1';
export const CHECK_SCHEMA = 'ghostnote-launcher-clip-check/1';

// --- model reference -----------------------------------------------------------

const SPEC = new URL('../../../spec/ghostnote-document-v1/', import.meta.url);
const REFERENCE_SOURCE = readFileSync(new URL('MODEL-REFERENCE.md', SPEC), 'utf8');
const REFERENCE_IDENTITY = JSON.parse(readFileSync(new URL('MODEL-REFERENCE.identity.json', SPEC), 'utf8')) as {
  formatVersion: string; referenceRevision: number; sha256: string;
};
if (createHash('sha256').update(REFERENCE_SOURCE, 'utf8').digest('hex') !== REFERENCE_IDENTITY.sha256) {
  throw new Error('MODEL-REFERENCE.md does not match its identity file; run npm run document:artifacts');
}

/** The reference identity that the read names. */
export const MODEL_REFERENCE = Object.freeze({
  format: `ghostnote-document/${REFERENCE_IDENTITY.formatVersion}`,
  revision: REFERENCE_IDENTITY.referenceRevision,
  sha256: REFERENCE_IDENTITY.sha256,
});

export const OPTIONAL_REFERENCE_SECTIONS = ['Patch', 'Timing overlays', 'Groups', 'Meter and tempo'] as const;
type OptionalSection = typeof OPTIONAL_REFERENCE_SECTIONS[number];

/** The maintained reference split into its `## ` sections, without the title block. */
function referenceSections(): ReadonlyMap<string, string> {
  const pieces = REFERENCE_SOURCE.split(/(?=^## )/m).slice(1);
  return new Map(pieces.map((piece) => [piece.split('\n')[0]!.slice(3), piece.trimEnd()]));
}
const SECTIONS = referenceSections();

/** The Core section, as the read tool description carries it. */
export const CORE_REFERENCE = SECTIONS.get('Core')!;

function selectedReference(sections: readonly OptionalSection[]): string {
  return [...new Set(sections)].map((name) => SECTIONS.get(name)!).join('\n\n') + '\n';
}

// --- registry ------------------------------------------------------------------

/** The workspace owns the registry, so spread copies of a workspace share it. */
export function identityRegistryOf(workspace: Workspace): IdentityRegistry {
  return workspace.documents;
}

// --- shared pieces -------------------------------------------------------------

export const format = z.enum(['fields', 'json']).default('fields').describe(
  'Document encoding: fields (canonical FIELDS text, default) or json (the equivalent canonical JSON object).',
);

export function encoded(document: LauncherClipProjection['document'], encoding: Encoding): unknown {
  const text = encodeLauncherClip(document, encoding);
  return encoding === 'json' ? JSON.parse(text) : text;
}

export const SOURCE = Object.freeze({
  host: 'bitwig-launcher',
  read: 'fresh-cold-read-all-16-channels',
  document: MODEL_REFERENCE.format,
  reference: { revision: MODEL_REFERENCE.revision, sha256: MODEL_REFERENCE.sha256 },
});

/**
 * The wrapper coverage of a projection. The document COVERAGE record states the span, the channels, and the
 * covered fields; the description states the constant uncovered fields and their reasons (8h4b2).
 */
export const DOCUMENT_COVERAGE = Object.freeze({ status: 'complete' });

/** The loss facts, or nothing when the read moved no timing. The description states the constant D23 facts. */
export function lossOf(projection: LauncherClipProjection) {
  const { loss } = projection;
  const moved = loss.onsetsMoved + loss.durationsRounded + loss.minimumDurationPromotions + loss.changedOverlaps;
  return moved === 0 ? {} : { loss };
}

export function projectionWarnings(projection: LauncherClipProjection): Warning[] {
  const warnings: Warning[] = [];
  const { loss } = projection;
  if (loss.onsetsMoved + loss.durationsRounded > 0) {
    warnings.push({ code: 'normalized-timing', message: `${loss.onsetsMoved} onsets and ${loss.durationsRounded} `
      + 'durations moved to the 1/512-beat cell plane. See data.loss.' });
  }
  if (projection.notesPastLength > 0) {
    warnings.push({ code: 'notes-past-length', message: `${projection.notesPastLength} notes end after the clip `
      + 'length. The document holds them. The current host writer refuses such notes.' });
  }
  return warnings;
}

export function identityFacts(acquired: Acquired, projection?: LauncherClipProjection) {
  const carried = projection?.overlays;
  return {
    identity: acquired.outcome,
    retainedIds: acquired.retained,
    mintedIds: acquired.minted,
    ...(acquired.retired === undefined ? {} : {
      retiredRefs: acquired.retired.map((item) => ({ ref: item.ref, reason: item.reason })),
    }),
    ...(carried === undefined || carried.removed.length + carried.staled.length === 0 ? {} : {
      overlays: {
        ...(carried.removed.length === 0 ? {} : { removed: carried.removed }),
        ...(carried.staled.length === 0 ? {} : { staled: carried.staled }),
      },
    }),
  };
}

/**
 * Bind and project one acquisition through the registry. A stale verdict on an older ref, when a newer entry at
 * the address (for example a verified edit) has the fresh source, reuses that entry: it is current.
 */
export function bindSnapshot(
  registry: IdentityRegistry,
  snapshot: ClipSnapshot,
  prior: { entry: BaseEntry; verdict: ClipSnapshotVerdict['verdict'] } | undefined,
): { acquired: Acquired; projection: LauncherClipProjection } {
  const latest = registry.latestAt(snapshot.ref.channelId, snapshot.ref.row);
  if (prior?.verdict === 'stale' && latest !== undefined && latest !== prior.entry
      && latest.snapshot.source.sha256 === snapshot.ref.source.sha256) {
    prior = { entry: latest, verdict: 'current' };
  }
  const cells = launcherClipCells(snapshot);
  let projection: LauncherClipProjection | undefined;
  const acquired = registry.acquire({
    snapshot: snapshot.ref,
    cells,
    ...(prior === undefined ? {} : { prior }),
    project: ({ clipId, eventIds, overlays, envelope }) => {
      projection = projectLauncherClip(snapshot, clipId, eventIds, overlays, envelope);
      return projection;
    },
  });
  if (projection === undefined) {
    const { entry } = acquired;
    projection = projectLauncherClip(snapshot, entry.clipId, cells.map((key) => entry.events.get(cellKey(key))!),
      entry.overlays, entry.envelope);
    if (projection.contentHash !== entry.contentHash) throw new Error('a current ref projected another document');
  }
  return { acquired, projection };
}

export function asToolFailure(error: unknown): unknown {
  if (error instanceof LauncherClipReadError) {
    return new ToolFailure(error.code, 'project', error.message, {
      ...(error.detail === undefined ? {} : { detail: error.detail }),
      ...(error.code === 'range' ? { retryWhen: 'after the clip is consolidated in Bitwig' } : {}),
    });
  }
  return error;
}

export async function guarded<T>(workspace: Workspace, work: () => Promise<T>): Promise<T> {
  return workspace.preserveSelection === undefined ? work() : workspace.preserveSelection(work);
}

export function checkHealth(mark: RevisionMark): void {
  if (mark.project.length === 0) {
    throw new ToolFailure('unhealthy', 'resolve', 'The live project identity is unavailable.', {
      retryWhen: 'after a project is open in Bitwig' });
  }
  if (mark.window.tracks.count < 0 || mark.window.scenes.count < 0) {
    throw new ToolFailure('unhealthy', 'resolve', 'The project track or scene inventory is not settled.', {
      retryWhen: 'after the project finishes loading' });
  }
  if (mark.window.tracks.count > mark.window.tracks.bankSize || mark.window.scenes.count > mark.window.scenes.bankSize) {
    throw new ToolFailure('outside-limit', 'resolve', 'The project has more tracks or scenes than the observed window.');
  }
  checkCursorPins(mark);
}

/**
 * D43 (E250): an unpinned Ghostnote cursor can follow and change the person's selection in a saved project. The
 * extension pins every owned cursor track at start; a listed track means that the pin did not take.
 */
export function checkCursorPins(mark: RevisionMark): void {
  const unpinned = unpinnedCursorTracksOf(mark) ?? [];
  if (unpinned.length === 0) return;
  throw new ToolFailure('unhealthy', 'resolve', `${unpinned.length} extension track handle(s) are not held in place `
    + `(${unpinned.join(', ')}). Such a handle can follow the selection and change it.`, {
    retryWhen: 'after the operator replaces the Ghostnote controller in Bitwig Settings' });
}

// --- read_launcher_clip --------------------------------------------------------

const readInput = z.object({
  trackId: z.string().min(1).describe('Durable track ID from list_tracks.'),
  row: z.number().int().min(0).describe('Zero-based Launcher row (scene).'),
  format,
  reference: z.array(z.enum(OPTIONAL_REFERENCE_SECTIONS)).max(4).optional().describe(
    'Optional model reference sections to return in the result. The Core section is in this description.',
  ),
  diagnostic: z.boolean().optional().describe('Also return the exact host source of the read. Use only to diagnose a problem.'),
}).strict();
type ReadInput = z.infer<typeof readInput>;

const READ_DESCRIPTION = `Profile ${AGENT_NATIVE_TOOL_PROFILE}. Read one Launcher clip as a Ghostnote `
  + 'Document 1.0 snapshot. Address it by durable trackId and zero-based row. Each call is one fresh '
  + 'read of the complete clip on all 16 MIDI channels. Note timing uses the 1/512-beat cell plane. '
  + 'The read sees each onset at its cell, so a finer source onset is not observable, and it cannot see '
  + 'two source notes in one cell. data.loss is present only when the read moved timing; it counts onsets '
  + 'and durations that moved to the cell plane. articulation and repeat are not covered: they have no '
  + 'measured host mapping. playRange is not covered: the read has no play-stop marker. Gain 1 is also '
  + 'the value of a note that Bitwig shows at -inf dB; the host reports both as one value. Bitwig reports '
  + 'note pressure as 0, also when a person set it, so pressure is always 0 in a read.\n'
  + 'Result: data.occupancy is occupied or empty. An empty slot has no document; it is not an empty '
  + 'clip. authority.base has the document sha256 and an opaque base ref. A repeated read of an '
  + 'unchanged clip returns the same ref and the same IDs (identity current). After a human edit, '
  + 'unchanged notes keep their event IDs and a note with a new pitch, channel, or onset gets a new '
  + 'ID (identity stale). A scene insert or delete, a project change, or a missing clip retires the '
  + 'ref; the next read mints new IDs. Give refs to check_launcher_clips. Refs live in this server '
  + 'process only and a restart retires them.\n'
  + 'Overlays, META, and EXTENSIONS that edit_launcher_clip stored come back with the document while the clip '
  + 'ID stays. When notes change, authority.overlays names the claims that became stale or were removed.\n'
  + 'A failure has failure.code: absent, outside-limit, unhealthy, authority-unavailable, '
  + 'target-changed, stale-address, group-slot, collapsed-group-row, range (select the clip in Bitwig '
  + 'and use Consolidate, then read again), collision, partial, or unavailable. Branch on the code, '
  + 'not on the message. outside-limit also means that the clip is above a reader limit: more than '
  + `${CLIP_READ_SOUNDING_CELLS} sounding 1/512-beat cells (each note counts its length in cells), or longer `
  + 'than 8,192 beats. Nothing is read; split or shorten the clip in Bitwig.\n'
  + `Model format reference revision ${MODEL_REFERENCE.revision} (sha256 ${MODEL_REFERENCE.sha256.slice(0, 12)}), `
  + 'Core section:\n'
  + CORE_REFERENCE;

async function readLauncherClip(workspace: Workspace, args: ReadInput): Promise<unknown> {
  const started = performance.now();
  const encoding: Encoding = args.format ?? 'fields';
  const target = { trackId: args.trackId, row: args.row };
  let stage: 'resolve' | 'acquire' | 'project' | 'registry' = 'resolve';
  try {
    const registry = identityRegistryOf(workspace);
    const before = await workspace.mark();
    checkHealth(before);
    registry.sweep(before);
    if (args.row >= before.window.scenes.count) {
      throw new ToolFailure('absent', 'resolve', `Launcher row ${args.row} is outside the project `
        + `(${before.window.scenes.count} scenes).`);
    }
    const matching = (await workspace.tracks()).filter((item) => item.channelId === args.trackId);
    if (matching.length !== 1) {
      throw new ToolFailure('absent', 'resolve', 'The trackId does not name exactly one track. Use list_tracks.');
    }
    const trackState = matching[0]!;
    if (isGroupTrack(trackState)) {
      throw new ToolFailure('group-slot', 'resolve', 'The track is a group track. Its launcher slots mirror '
        + 'the clips of its child tracks. Address a child track by its trackId.');
    }
    const named = { ...target, trackName: trackState.name };
    const clip = snapshotClip({ channelId: args.trackId, row: args.row }, before.sceneEpoch);
    stage = 'acquire';
    const readStarted = performance.now();
    const read = await guarded(workspace, () => workspace.read(
      [trackAt(args.trackId), ...snapshotAddresses(clip)], { sources: [clip] }));
    const readMs = performance.now() - readStarted;
    const prior = registry.latestAt(args.trackId, args.row);
    const delta = await workspace.contentSince(read.at);
    const priorDelta = prior === undefined ? undefined : await workspace.contentSince(prior.snapshot.mark);
    const after = delta.mark ?? await workspace.mark();
    if (after.project !== read.at.project || after.generation !== read.at.generation
        || after.sceneEpoch !== read.at.sceneEpoch || after.window.scenes.count !== read.at.window.scenes.count
        || !deltaComplete(delta) || contentTouching(delta, clip).length > 0) {
      throw new ToolFailure('target-changed', 'acquire', 'The project or the clip changed during the read.', {
        retryWhen: 'after the project stops changing; read the clip again' });
    }
    const entry = read.entries[addressKey(clip)];
    if (entry === undefined) {
      const unreachable = read.unreachable.some((address) => addressKey(address) === addressKey(clip));
      throw new ToolFailure(unreachable ? 'outside-limit' : 'absent', 'acquire', unreachable
        ? 'The clip is outside the observed window.' : 'The track or the launcher slot does not exist.');
    }
    if (entry.value.of !== 'clip' || !entry.value.exists) {
      registry.retireAddress({ channelId: args.trackId, row: args.row }, 'absent');
      const result: ReadResult<{ occupancy: 'empty' }> = {
        schema: READ_SCHEMA,
        source: SOURCE,
        target: named,
        coverage: { status: 'complete', occupancy: 'empty' },
        authority: { kind: 'fresh-read', base: null },
        data: { occupancy: 'empty' },
        warnings: [],
        timing: { readMs, totalMs: performance.now() - started },
        ...(args.reference === undefined ? {} : { reference: selectedReference(args.reference) }),
      };
      return result;
    }
    stage = 'project';
    const snapshot = clipSnapshotFrom(read, clip);
    const verdict = prior === undefined ? undefined
      : judgeClipSnapshot(prior.snapshot, read, priorDelta!, after).verdict;
    stage = 'registry';
    const { acquired, projection } = bindSnapshot(registry, snapshot,
      prior === undefined ? undefined : { entry: prior, verdict: verdict! });
    const result: ReadResult<Record<string, unknown>> = {
      schema: READ_SCHEMA,
      source: SOURCE,
      target: named,
      coverage: DOCUMENT_COVERAGE,
      authority: {
        kind: 'fresh-read',
        base: { sha256: acquired.entry.contentHash, ref: acquired.entry.ref },
        ...identityFacts(acquired, projection),
      },
      data: {
        occupancy: 'occupied',
        format: encoding,
        document: encoded(projection.document, encoding),
        ...lossOf(projection),
      },
      warnings: projectionWarnings(projection),
      timing: { readMs, totalMs: performance.now() - started },
      ...(args.reference === undefined ? {} : { reference: selectedReference(args.reference) }),
      ...(args.diagnostic === true ? { diagnostic: exactSource(snapshot) } : {}),
    };
    return result;
  } catch (error) {
    return failureResult(READ_SCHEMA, stage, asToolFailure(error), target);
  }
}

/** The exact host source of one read: diagnostic only. */
function exactSource(snapshot: ClipSnapshot) {
  return {
    source: snapshot.ref.source,
    mark: snapshot.ref.mark,
    metadata: snapshot.metadata,
    channels: snapshot.channels.map((notes, channel) => ({ channel: channel + 1, notes }))
      .filter((item) => item.notes.length > 0),
  };
}

const readLauncherClipTool: ToolSpec = {
  name: 'read_launcher_clip',
  kind: 'read',
  title: 'Read one Launcher clip as a document',
  description: READ_DESCRIPTION,
  inputSchema: readInput.shape,
  inputValidator: readInput,
  emits: [],
  resultContract: {
    schema: READ_SCHEMA,
    profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings', 'timing'],
    failure: ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen'],
    occupancy: ['occupied', 'empty'],
    identity: ['new', 'current', 'stale', 'retired-and-new'],
    reference: MODEL_REFERENCE,
  },
  run: (workspace, input) => readLauncherClip(workspace, input as ReadInput),
};

// --- check_launcher_clips ------------------------------------------------------

const checkInput = z.object({
  refs: z.array(z.string().min(1)).min(1).max(64)
    .refine((refs) => new Set(refs).size === refs.length, { message: 'refs must be unique' })
    .describe('Base refs from read_launcher_clip or from an earlier check.'),
  format,
}).strict();
type CheckInput = z.infer<typeof checkInput>;

const CHECK_DESCRIPTION = `Profile ${AGENT_NATIVE_TOOL_PROFILE}. Check base refs from read_launcher_clip. `
  + 'One fresh read covers all live refs. Each result has one verdict. current: the clip at the address '
  + 'is unchanged; the ref and IDs stay valid. stale: the content changed at the same address; the '
  + 'result has the new document and a new base ref, unchanged notes keep their event IDs, and a note '
  + 'with a new pitch, channel, or onset has a new ID. identity-changed: the scene layout or the slot '
  + 'changed, or the change record is incomplete. absent: the track or clip is missing. incomparable: '
  + 'the project changed or the extension reloaded. uncovered: the clip is outside the observed window. '
  + 'Every verdict other than current and stale retires the ref; read the clip again. A ref that this '
  + 'server process does not hold has code expired-ref; a malformed ref has code invalid-ref. A current '
  + 'verdict states equal content at the same address, not the same host clip object.';

interface CheckItem {
  readonly ref: string;
  readonly verdict?: ClipSnapshotVerdict['verdict'];
  readonly code?: FailureCode;
  readonly retired?: boolean;
  readonly target?: { readonly trackId: string; readonly row: number };
  readonly [key: string]: unknown;
}

function retiredItem(retirement: Retirement): CheckItem {
  const target = { trackId: retirement.channelId, row: retirement.row };
  if (retirement.reason === 'evicted') {
    return { ref: retirement.ref, code: 'expired-ref', target, message: 'The registry retired this ref to stay in its bound.' };
  }
  return { ref: retirement.ref, verdict: retirement.reason, retired: true, target, code: VERDICT_CODES[retirement.reason] };
}

async function checkLauncherClips(workspace: Workspace, args: CheckInput): Promise<unknown> {
  const started = performance.now();
  const encoding: Encoding = args.format ?? 'fields';
  try {
    const registry = identityRegistryOf(workspace);
    const now = await workspace.mark();
    const swept = new Map(registry.sweep(now).map((item) => [item.ref, item]));
    const items: (CheckItem | BaseEntry)[] = args.refs.map((ref) => {
      if (!IdentityRegistry.isRefShape(ref)) return { ref, code: 'invalid-ref' as const };
      const found = registry.lookup(ref);
      if (found.state === 'live') return found.entry;
      if (found.state === 'retired') return retiredItem(swept.get(ref) ?? found.retirement);
      return { ref, code: 'expired-ref' as const, message: 'This server process holds no such ref. Read the clip again.' };
    });
    const live = items.filter((item): item is BaseEntry => item instanceof Object && 'snapshot' in item);
    const checked = live.length === 0 ? [] : (await guarded(workspace,
      () => readWithClipSnapshots(workspace, live.map((entry) => entry.snapshot)))).verdicts;
    const verdicts = new Map(live.map((entry, index) => [entry.ref, checked[index]!]));
    const results: CheckItem[] = items.map((item) => {
      if (!('snapshot' in item)) return item as CheckItem;
      const entry = item as BaseEntry;
      const verdict = verdicts.get(entry.ref)!;
      const target = { trackId: entry.snapshot.channelId, row: entry.snapshot.row };
      if (verdict.verdict === 'current') return { ref: entry.ref, verdict: 'current', target };
      if (verdict.verdict === 'stale') {
        try {
          const { acquired, projection } = bindSnapshot(registry, verdict.snapshot, { entry, verdict: 'stale' });
          return {
            ref: entry.ref, verdict: 'stale', target,
            base: { sha256: acquired.entry.contentHash, ref: acquired.entry.ref },
            ...identityFacts(acquired, projection),
            coverage: DOCUMENT_COVERAGE,
            format: encoding,
            document: encoded(projection.document, encoding),
            ...lossOf(projection),
            warnings: projectionWarnings(projection),
          };
        } catch (error) {
          const failure = failureResult(CHECK_SCHEMA, 'project', asToolFailure(error));
          return { ref: entry.ref, verdict: 'stale', target, code: failure.failure.code, message: failure.message,
            ...(failure.detail === undefined ? {} : { detail: failure.detail }) };
        }
      }
      registry.retireAddress(entry.snapshot, verdict.verdict);
      return {
        ref: entry.ref, verdict: verdict.verdict, retired: true, target, code: VERDICT_CODES[verdict.verdict],
        ...('why' in verdict ? { why: verdict.why } : {}),
        ...(verdict.verdict === 'uncovered' ? { uncoveredIn: verdict.uncoveredIn } : {}),
      };
    });
    const result: ReadResult<{ results: CheckItem[] }> = {
      schema: CHECK_SCHEMA,
      source: SOURCE,
      target: { refs: args.refs.length },
      coverage: { status: 'complete', checked: live.length, unresolved: args.refs.length - live.length },
      authority: { kind: 'fresh-read' },
      data: { results },
      warnings: [],
      timing: { totalMs: performance.now() - started },
    };
    return result;
  } catch (error) {
    return failureResult(CHECK_SCHEMA, 'acquire', asToolFailure(error));
  }
}

const checkLauncherClipsTool: ToolSpec = {
  name: 'check_launcher_clips',
  kind: 'read',
  title: 'Check Launcher clip base refs',
  description: CHECK_DESCRIPTION,
  inputSchema: checkInput.shape,
  inputValidator: checkInput,
  emits: [],
  resultContract: {
    schema: CHECK_SCHEMA,
    profile: AGENT_NATIVE_TOOL_PROFILE,
    verdicts: ['current', 'stale', 'identity-changed', 'absent', 'incomparable', 'uncovered'],
    itemCodes: ['expired-ref', 'invalid-ref'],
    staleCarries: ['base', 'document', 'loss when timing moved'],
  },
  run: (workspace, input) => checkLauncherClips(workspace, input as CheckInput),
};

/** The tools that `agent-native-v1` adds to the stable list, in order. */
export const AGENT_NATIVE_ADDITIONS: readonly ToolSpec[] = [readLauncherClipTool, checkLauncherClipsTool];
