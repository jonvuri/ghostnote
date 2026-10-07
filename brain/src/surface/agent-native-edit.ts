/**
 * `edit_launcher_clip`: the guarded document edit limb of `agent-native-v1` (8h4c, D21).
 *
 * One call: parse the proposal with the reference codec, resolve the base ref
 * in the identity registry, read the clip fresh on all 16 channels, require the
 * D32 verdict `current`, plan the edit from fresh raw state
 * (`planLauncherClipEdit`), write through the recorded `Workspace.apply` seam
 * with the D32 reference and the revision guard, and read back independently.
 * The readback binds the new base ref with the IDs of the confirmed candidate.
 *
 * Every refusal before the write has no effect. A write that applied returns
 * its change ID; a failed readback returns the effect and does not retry.
 */
import { z } from 'zod';

import {
  ClipSnapshotRefusedError, InvalidOpError, addressKey, clipSnapshotFrom, contentTouching, deltaComplete,
  isGroupTrack, judgeClipSnapshot, snapshotAddresses, snapshotClip, track as trackAt,
  type ClipSnapshot, type ContentDelta, type RevisionMark, type Snapshot,
} from '../contract/index.js';
import { UnprotectedWriteError, takeAppliedAnything } from '../engine/index.js';
import type { BaseEntry } from '../bindings/identity-registry.js';
import { IdentityRegistry } from '../bindings/identity-registry.js';
import {
  launcherClipCells, projectLauncherClip, type LauncherClipProjection,
} from '../bindings/launcher-clip-document.js';
import {
  EditRefusal, compareReadback, planLauncherClipEdit, type EditPlan,
} from '../bindings/launcher-clip-edit.js';
import { DocumentError, parse, type Document, type Encoding } from '../document/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ToolFailure, VERDICT_CODES, failureResult,
  type Effect, type FailureStage, type Warning, type WriteResult,
} from './agent-native-result.js';
import {
  asToolFailure, bindSnapshot, checkHealth, encoded, format, guarded, identityFacts, identityRegistryOf,
  lossOf, projectionWarnings, SOURCE,
} from './agent-native.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const EDIT_SCHEMA = 'ghostnote-launcher-clip-edit/1';

const editInput = z.object({
  trackId: z.string().min(1).describe('Durable track ID from list_tracks.'),
  row: z.number().int().min(0).describe('Zero-based Launcher row (scene).'),
  document: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).describe(
    'The patch or desired document: FIELDS text, or JSON (an object or JSON text) when format is json.',
  ),
  format,
  intent: z.literal('replace').optional().describe(
    'Only for a desired document without BASE: replace the whole clip. It keeps no event IDs.',
  ),
  dryRun: z.boolean().optional().describe('Return the plan and make no write.'),
  readback: z.enum(['summary', 'document']).optional().describe(
    'summary (default): the new base, IDs, and discrepancies. document: also the read-back document.',
  ),
}).strict();
type EditInput = z.infer<typeof editInput>;

const EDIT_DESCRIPTION = `Profile ${AGENT_NATIVE_TOOL_PROFILE}. Edit one Launcher clip with a Ghostnote Document 1.0 `
  + 'patch or desired document. Address it by trackId and row, as in read_launcher_clip. A patch or a desired '
  + 'document needs BASE with the sha256 and the ref of a read of this clip. A patch changes only what it names. '
  + 'A desired document is the complete new state: omitted notes are removed and omitted fields have their '
  + 'defaults. With intent replace, a desired document without BASE replaces the whole clip; it keeps no event IDs.\n'
  + 'Each call reads the clip again and checks the base ref. A change since the read refuses with no write; '
  + 'code stale returns the new document and base in detail. The edit keeps every unnamed note and every host '
  + 'value that the document does not show. A new note gets every field explicitly. A changed note keeps its ID, '
  + 'also when its pitch, channel, or onset changes. When the edit only adds, removes, or moves notes to new '
  + 'cells, the write touches only those cells; any other note change rewrites the whole clip.\n'
  + 'Bitwig does not report note pressure, so a whole-clip rewrite loses pressure that a person set in Bitwig; '
  + 'the result then has warning pressure-unobservable.\n'
  + 'Refusals before any write: code unsupported with detail.reason: pressure (the document sets a nonzero '
  + 'pressure; the host cannot write it), repeat and articulation (no host mapping), overlap (two notes of one channel and pitch overlap), transpose outside '
  + '-96..96, recurrence length above 8, timing (no writable grid), play-range, loop (only null or 0..length), '
  + 'clip-colour (a clip property change needs a palette colour). Code range: a note would start or end after '
  + 'the clip length. Code invalid-input: the codec rejected the document (detail has rule and line), or BASE '
  + 'does not match. Code absent: no clip in the slot.\n'
  + 'Result: applied, effects (each with a changeId for revert_change), and readback from an independent read of '
  + 'all 16 channels: the new base (sha256 and ref), the IDs, and discrepancies (empty when every value landed). '
  + 'readback document returns the new document too. dryRun returns the plan and writes nothing. A failed write '
  + 'states its effects and is not retried; read the clip before another edit.\n'
  + 'Overlays in the document are stored with the base ref in this server process. A later read returns them, '
  + 'stale or removed when their notes changed.';

function parseProposal(args: EditInput): Document {
  const encoding: Encoding = args.format ?? 'fields';
  if (typeof args.document !== 'string' && encoding !== 'json') {
    throw new ToolFailure('invalid-input', 'input', 'A JSON object document needs format json.');
  }
  try {
    const text = typeof args.document === 'string' ? args.document : JSON.stringify(args.document);
    return parse(text, encoding);
  } catch (error) {
    if (error instanceof DocumentError) {
      throw new ToolFailure('invalid-input', 'input', `The document is not valid (${error.rule}).`, {
        detail: {
          rule: error.rule, path: error.path, message: error.message,
          ...(error.line === undefined ? {} : { line: error.line, column: error.column }),
        },
      });
    }
    throw error;
  }
}

interface Fresh {
  readonly read: Snapshot;
  readonly delta: ContentDelta;
  readonly after: RevisionMark;
}

/** One fresh read of the clip, and the content delta since `since` (the base mark, or the read mark). */
async function readFresh(workspace: Workspace, trackId: string, row: number, since?: RevisionMark): Promise<Fresh> {
  const now = await workspace.mark();
  const clip = snapshotClip({ channelId: trackId, row }, now.sceneEpoch);
  const read = await guarded(workspace, () => workspace.read(
    [trackAt(trackId), ...snapshotAddresses(clip)], { sources: [clip] }));
  const delta = await workspace.contentSince(since ?? read.at);
  const after = await workspace.mark();
  return { read, delta, after };
}

/** Is the slot occupied in this read? Throws for an address that the read did not reach. */
function occupied(read: Snapshot, trackId: string, row: number): boolean {
  const clip = snapshotClip({ channelId: trackId, row }, read.at.sceneEpoch);
  const entry = read.entries[addressKey(clip)];
  if (entry === undefined) {
    const unreachable = read.unreachable.some((address) => addressKey(address) === addressKey(clip));
    throw new ToolFailure(unreachable ? 'outside-limit' : 'absent', 'acquire', unreachable
      ? 'The clip is outside the observed window.' : 'The track or the launcher slot does not exist.');
  }
  return entry.value.of === 'clip' && entry.value.exists;
}

/** Resolve the base ref of a guarded proposal to its live registry entry. */
function resolveBase(registry: IdentityRegistry, proposal: Document, trackId: string, row: number): BaseEntry {
  const ref = proposal.base?.ref;
  if (ref === undefined) {
    throw new ToolFailure('invalid-ref', 'resolve', 'A guarded edit needs BASE with the ref of read_launcher_clip. '
      + 'To replace the whole clip without a read, send a desired document with intent replace.');
  }
  if (!IdentityRegistry.isRefShape(ref)) throw new ToolFailure('invalid-ref', 'resolve', 'BASE ref is malformed.');
  const found = registry.lookup(ref);
  if (found.state === 'unknown') {
    throw new ToolFailure('expired-ref', 'resolve', 'This server process holds no such ref. Read the clip again.');
  }
  if (found.state === 'retired') {
    const reason = found.retirement.reason;
    if (reason === 'evicted') {
      throw new ToolFailure('expired-ref', 'resolve', 'The registry retired this ref to stay in its bound. Read the clip again.');
    }
    throw new ToolFailure(VERDICT_CODES[reason], 'resolve', `The base ref was retired (${reason}). Read the clip again.`);
  }
  const { entry } = found;
  if (entry.snapshot.channelId !== trackId || entry.snapshot.row !== row) {
    throw new ToolFailure('invalid-input', 'resolve', 'BASE ref names another clip than trackId and row.', {
      detail: { refTarget: { trackId: entry.snapshot.channelId, row: entry.snapshot.row } } });
  }
  return entry;
}

function planFailure(error: unknown): unknown {
  if (error instanceof EditRefusal) {
    return new ToolFailure(error.code, 'plan', error.message, { detail: { reason: error.reason, ...error.detail } });
  }
  return asToolFailure(error);
}

/** Map an executor refusal. Each of these is thrown before the first host mutation. */
function writeFailure(error: unknown): unknown {
  if (error instanceof UnprotectedWriteError) {
    return new ToolFailure('unsupported', 'write', 'The prior state of this clip cannot be recorded for exact '
      + 'reversal, so nothing was written.', { detail: { reason: 'protection', fidelity: error.fidelity }, cause: error });
  }
  if (error instanceof InvalidOpError) {
    return new ToolFailure('target-changed', 'write', 'The clip changed between the fresh read and the write. '
      + 'Nothing was written.', { retryWhen: 'after a new read', cause: error });
  }
  if (error instanceof ClipSnapshotRefusedError) {
    const first = error.verdicts.find((item) => item.verdict !== 'current');
    const code = first === undefined ? 'internal' : VERDICT_CODES[first.verdict as keyof typeof VERDICT_CODES];
    return new ToolFailure(code, 'write', 'The base ref was not current at the write. Nothing was written.', {
      retryWhen: 'after a new read', cause: error });
  }
  return error;
}

/** Bitwig reports note pressure as 0, also when a person set it (E236). A whole-clip rewrite loses it. */
const PRESSURE_WARNING: Warning = {
  code: 'pressure-unobservable',
  message: 'This edit rewrote the whole clip. Bitwig does not report note pressure, so pressure that a person set '
    + 'on a note in this clip is lost.',
};

function summaryOf(plan: EditPlan) {
  const { report } = plan;
  const clipFields = report.clipFields.flatMap((item) => item.fields);
  return {
    route: plan.route,
    added: report.added.length,
    removed: report.removed.length,
    changed: report.changedFields.length,
    moved: plan.moved.length,
    ...(clipFields.length === 0 ? {} : { clipFields }),
    ...(report.overlayChanges.length === 0 ? {} : { overlays: report.overlayChanges.length }),
  };
}

function summaryText(plan: EditPlan): string {
  const s = summaryOf(plan);
  const parts = [`${s.added} added`, `${s.removed} removed`, `${s.changed} changed (${s.moved} moved)`];
  if (s.clipFields !== undefined) parts.push(`clip ${s.clipFields.join(', ')}`);
  return `Edited notes: ${parts.join(', ')}. Route ${s.route}.`;
}

function planView(plan: EditPlan) {
  return {
    ...summaryOf(plan),
    changes: {
      added: plan.report.added,
      removed: plan.report.removed,
      changed: plan.report.changedFields,
      ...(plan.moved.length === 0 ? {} : { moved: plan.moved.map((item) => ({ id: item.id,
        from: { channel: item.from.channel + 1, pitch: item.from.pitch, at: `${item.from.cell}/512` },
        to: { channel: item.to.channel + 1, pitch: item.to.pitch, at: `${item.to.cell}/512` } })) }),
      ...(plan.report.clipFields.length === 0 ? {} : { clip: plan.report.clipFields }),
      ...(plan.report.overlayChanges.length === 0 ? {} : { overlays: plan.report.overlayChanges }),
    },
    operations: plan.ops.map((op) => op.op),
    expectedSha256: plan.expectedHash,
  };
}

async function editLauncherClip(workspace: Workspace, args: EditInput): Promise<unknown> {
  const started = performance.now();
  const encoding: Encoding = args.format ?? 'fields';
  const target = { trackId: args.trackId, row: args.row };
  const timing: Record<string, number> = {};
  let stage: FailureStage = 'input';
  let effects: Effect[] = [];
  try {
    const proposal = parseProposal(args);
    if (proposal.kind === 'snapshot') {
      throw new ToolFailure('invalid-input', 'input', 'A snapshot is not an edit. Send a patch or a desired document.');
    }
    const replace = args.intent === 'replace';
    if (replace && (proposal.kind !== 'desired' || proposal.base !== undefined)) {
      throw new ToolFailure('invalid-input', 'input', 'intent replace takes a desired document without BASE.');
    }

    stage = 'resolve';
    const registry = identityRegistryOf(workspace);
    const now = await workspace.mark();
    checkHealth(now);
    registry.sweep(now);
    // The base ref first: after a project switch its verdict names the cause before the track lookup can.
    const guardedEntry = replace ? undefined : resolveBase(registry, proposal, args.trackId, args.row);
    if (args.row >= now.window.scenes.count) {
      throw new ToolFailure('absent', 'resolve', `Launcher row ${args.row} is outside the project `
        + `(${now.window.scenes.count} scenes).`);
    }
    const matching = (await workspace.tracks()).filter((item) => item.channelId === args.trackId);
    if (matching.length !== 1) {
      throw new ToolFailure('absent', 'resolve', 'The trackId does not name exactly one track. Use list_tracks.');
    }
    if (isGroupTrack(matching[0]!)) {
      throw new ToolFailure('group-slot', 'resolve', 'The track is a group track. Its launcher slots mirror '
        + 'the clips of its child tracks. Address a child track by its trackId.');
    }

    stage = 'acquire';
    const readStarted = performance.now();
    const fresh = await readFresh(workspace, args.trackId, args.row, guardedEntry?.snapshot.mark);
    timing.readMs = performance.now() - readStarted;
    let entry: BaseEntry;
    let snapshot: ClipSnapshot;
    if (guardedEntry !== undefined) {
      const verdict = judgeClipSnapshot(guardedEntry.snapshot, fresh.read, fresh.delta, fresh.after);
      if (verdict.verdict === 'stale') {
        stage = 'project';
        const { acquired, projection } = bindSnapshot(registry, verdict.snapshot, { entry: guardedEntry, verdict: 'stale' });
        throw new ToolFailure('stale', 'guard', 'The clip changed since the base read. Nothing was written. '
          + 'detail has the new document and base; make the edit again on it.', {
          detail: {
            base: { sha256: acquired.entry.contentHash, ref: acquired.entry.ref },
            ...identityFacts(acquired, projection),
            format: encoding,
            document: encoded(projection.document, encoding),
            ...lossOf(projection),
          },
        });
      }
      if (verdict.verdict !== 'current') {
        registry.retireAddress(guardedEntry.snapshot, verdict.verdict);
        throw new ToolFailure(VERDICT_CODES[verdict.verdict], 'guard', `The base ref is ${verdict.verdict}. `
          + 'Nothing was written. Read the clip again.', {
          detail: { verdict: verdict.verdict, ...('why' in verdict ? { why: verdict.why } : {}) } });
      }
      entry = guardedEntry;
      snapshot = clipSnapshotFrom(fresh.read, snapshotClip(entry.snapshot, fresh.read.at.sceneEpoch));
    } else {
      const clip = snapshotClip({ channelId: args.trackId, row: args.row }, fresh.read.at.sceneEpoch);
      if (fresh.after.project !== fresh.read.at.project || fresh.after.generation !== fresh.read.at.generation
          || fresh.after.sceneEpoch !== fresh.read.at.sceneEpoch || !deltaComplete(fresh.delta)
          || contentTouching(fresh.delta, clip).length > 0) {
        throw new ToolFailure('target-changed', 'acquire', 'The project or the clip changed during the read.', {
          retryWhen: 'after the project stops changing' });
      }
      if (!occupied(fresh.read, args.trackId, args.row)) {
        throw new ToolFailure('absent', 'acquire', 'The launcher slot holds no clip. Create the clip first.');
      }
      snapshot = clipSnapshotFrom(fresh.read, clip);
      stage = 'registry';
      const prior = registry.latestAt(args.trackId, args.row);
      const priorDelta = prior === undefined ? undefined : await workspace.contentSince(prior.snapshot.mark);
      const verdict = prior === undefined ? undefined
        : judgeClipSnapshot(prior.snapshot, fresh.read, priorDelta!, fresh.after).verdict;
      entry = bindSnapshot(registry, snapshot, prior === undefined ? undefined : { entry: prior, verdict: verdict! })
        .acquired.entry;
    }

    stage = 'plan';
    const planStarted = performance.now();
    let plan: EditPlan;
    try {
      plan = planLauncherClipEdit({ snapshot, entry, proposal, mode: replace ? 'replace' : 'guarded', fresh });
    } catch (error) {
      throw planFailure(error);
    }
    timing.planMs = performance.now() - planStarted;
    const base = { sha256: entry.contentHash, ref: entry.ref };
    if (plan.noChange) {
      const result: WriteResult<Record<string, unknown>> = {
        schema: EDIT_SCHEMA, applied: false, effects: [],
        readback: { base, status: 'unchanged' },
        timing: { ...timing, totalMs: performance.now() - started },
      };
      return { ...result, target, plan: planView(plan) };
    }
    if (args.dryRun === true) {
      const result: WriteResult<null> = {
        schema: EDIT_SCHEMA, applied: false, effects: [], readback: null,
        timing: { ...timing, totalMs: performance.now() - started },
      };
      return {
        ...result, target, dryRun: true, base, plan: planView(plan),
        ...(plan.route === 'whole-clip' ? { warnings: [PRESSURE_WARNING] } : {}),
        expected: { format: encoding, document: encoded(plan.expected, encoding) },
      };
    }

    stage = 'write';
    let changeId: string | undefined;
    if (plan.ops.length > 0) {
      const writeStarted = performance.now();
      let change;
      try {
        change = await workspace.apply(plan.ops, { ifRevision: fresh.read.at.revision, ifSnapshot: [entry.snapshot] });
      } catch (error) {
        throw writeFailure(error);
      }
      timing.writeMs = performance.now() - writeStarted;
      if (!takeAppliedAnything(change.take)) {
        throw new ToolFailure('target-changed', 'write', 'The project changed before the write. Nothing was '
          + 'written.', { retryWhen: 'after a new read' });
      }
      changeId = change.take.id;
      effects = [{
        changeId, target, summary: summaryText(plan), fidelity: change.take.fidelity,
      }];
    }

    stage = 'readback';
    const readbackStarted = performance.now();
    const warnings: Warning[] = plan.route === 'whole-clip' ? [PRESSURE_WARNING] : [];
    let readback: Record<string, unknown>;
    try {
      const observed = await readFresh(workspace, args.trackId, args.row);
      const clip = snapshotClip({ channelId: args.trackId, row: args.row }, observed.read.at.sceneEpoch);
      const after = clipSnapshotFrom(observed.read, clip);
      const discrepancies = compareReadback(plan, after);
      let projection: LauncherClipProjection | undefined;
      const acquired = registry.recordWrite({
        snapshot: after.ref,
        cells: launcherClipCells(after),
        clipId: plan.clipId,
        ids: plan.ids,
        overlays: plan.expected.overlays,
        envelope: {
          ...(plan.expected.meta === undefined ? {} : { meta: plan.expected.meta }),
          ...(plan.expected.extensions === undefined ? {} : { extensions: plan.expected.extensions }),
        },
        project: ({ clipId, eventIds, overlays, envelope }) => {
          projection = projectLauncherClip(after, clipId, eventIds, overlays, envelope);
          return projection;
        },
      });
      warnings.push(...projectionWarnings(projection!));
      readback = {
        status: discrepancies.length === 0 && acquired.entry.contentHash === plan.expectedHash ? 'verified' : 'differs',
        base: { sha256: acquired.entry.contentHash, ref: acquired.entry.ref },
        ...identityFacts(acquired, projection),
        discrepancies: discrepancies.slice(0, 64),
        ...(discrepancies.length > 64 ? { discrepancyCount: discrepancies.length } : {}),
        ...(acquired.entry.contentHash === plan.expectedHash ? {} : { expectedSha256: plan.expectedHash }),
        ...lossOf(projection!),
        ...(args.readback === 'document' ? { format: encoding, document: encoded(projection!.document, encoding) } : {}),
      };
    } catch (error) {
      const failure = failureResult(EDIT_SCHEMA, 'readback', asToolFailure(error));
      readback = { status: 'unavailable', code: failure.failure.code, message: failure.message };
      warnings.push({ code: 'readback-unavailable', message: 'The write applied, but the independent readback '
        + 'failed. Read the clip before another edit. Do not repeat the edit.' });
    }
    timing.readbackMs = performance.now() - readbackStarted;
    const result: WriteResult<Record<string, unknown>> = {
      schema: EDIT_SCHEMA,
      applied: true,
      effects,
      readback,
      ...(changeId === undefined ? {} : { next: { revert: { tool: 'revert_change', changeId } } }),
      warnings,
      timing: { ...timing, totalMs: performance.now() - started },
    };
    return { ...result, target, plan: summaryOf(plan) };
  } catch (error) {
    const failure = failureResult(EDIT_SCHEMA, stage, error, target);
    return effects.length === 0 ? failure : { ...failure, failure: { ...failure.failure, effects } };
  }
}

export const editLauncherClipTool: ToolSpec = {
  name: 'edit_launcher_clip',
  kind: 'write',
  title: 'Edit one Launcher clip with a document',
  description: EDIT_DESCRIPTION,
  inputSchema: editInput.shape,
  inputValidator: editInput,
  emits: ['clip.update', 'note.remove', 'note.insert', 'note.clear', 'note.write'],
  resultContract: {
    schema: EDIT_SCHEMA,
    profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: ['schema', 'applied', 'effects', 'readback', 'next', 'warnings', 'timing', 'target', 'plan'],
    failure: ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen', 'detail'],
    readbackStatus: ['verified', 'differs', 'unavailable', 'unchanged'],
    routes: ['none', 'targeted', 'whole-clip'],
    refusalReasons: ['pressure', 'repeat', 'articulation', 'overlap', 'transpose', 'recurrence', 'timing',
      'play-range', 'loop', 'clip-colour', 'protection'],
  },
  run: (workspace, input) => editLauncherClip(workspace, input as EditInput),
};
