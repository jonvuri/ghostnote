/** Read, materialize, compile, and apply one complete musical patch. */
import {
  AddressUnresolvedError, SlotOccupiedError, addressKey, assertOpsWritable,
  blindSpotError, chooseStepSize, clip as clipAt, notes as notesAt, scene, slot, track,
  type ClipAddress, type NoteRecord, type Op, type Snapshot,
} from '../contract/index.js';
import { branchProtected, revertOps, type Clearance, type Disagreement, type Unverified } from '../engine/index.js';
import { sameValue, type StashedChangeset } from '../stash/index.js';
import type { Workspace } from '../surface/workspace.js';
import {
  assertMusicalToolBoundary, compileMusicalClip, parseMusicalPatch,
  type MaterializedMusicalChannel, type MaterializedMusicalTarget,
  type MusicalLoss, MusicalPatchError, type MusicalPatch, type MusicalToolBoundary,
} from './patch.js';
import { materializeMusicalTarget, toMaterializedMusicalTarget } from './theory.js';

type ClipKey = `${string}:${number}`;

interface ClipGroup {
  readonly key: ClipKey;
  readonly trackId: string;
  readonly row: number;
  readonly targetIndexes: readonly number[];
}

export interface PlannedMusicalResult {
  readonly targetIndex: number;
  readonly variationIndex: number;
  readonly clip: { readonly trackId: string; readonly row: number };
  readonly channel: number;
  readonly write: 'merge' | 'replace';
  readonly notes: readonly NoteRecord[];
  readonly effectiveSeed?: string;
  readonly seedScopes: readonly { readonly operationIndex: number; readonly scope: string }[];
}

export interface PlannedClipBlock {
  readonly trackId: string;
  readonly firstRow: number;
  readonly lastRow: number;
  readonly createdRows: readonly number[];
  readonly protectedRows: readonly number[];
}

export interface PlannedMusicalApplication {
  readonly patch: MusicalPatch;
  readonly boundary: MusicalToolBoundary;
  readonly ifRevision: number;
  readonly ops: readonly Op[];
  readonly clearance?: Clearance;
  readonly results: readonly PlannedMusicalResult[];
  readonly differences: readonly MusicalLoss[];
  readonly warnings: readonly string[];
  readonly clipBlocks: readonly PlannedClipBlock[];
}

export interface MusicalChangesetIdentity {
  readonly id: string;
  readonly seq: number;
  readonly applied: boolean;
  readonly fidelity: StashedChangeset['take']['fidelity'];
}

export interface MusicalReversalQualification {
  readonly changeId: string;
  readonly fidelity: StashedChangeset['take']['fidelity'];
  readonly unrestored: ReturnType<typeof revertOps>['unrestored'];
}

export interface MusicalPlannerResult {
  readonly schema: 'ghostnote-musical-planner-result';
  readonly version: 1;
  readonly boundary: MusicalToolBoundary;
  readonly protection: MusicalPatch['protection'];
  readonly results: readonly PlannedMusicalResult[];
  readonly differences: readonly MusicalLoss[];
  readonly warnings: readonly string[];
  readonly clipBlocks: readonly PlannedClipBlock[];
  readonly changesets: readonly MusicalChangesetIdentity[];
  readonly disagreements: readonly Disagreement[];
  readonly unverified: readonly Unverified[];
  readonly concurrent: StashedChangeset['take']['report']['concurrent'];
  readonly undecidable?: string;
  readonly reversal: readonly MusicalReversalQualification[];
}

const clipKey = (trackId: string, row: number): ClipKey => `${trackId}:${row}`;

function clipAddress(trackId: string, row: number, epoch: number): ClipAddress {
  return clipAt(slot(track(trackId), scene(row, epoch)));
}

function groupsOf(patch: MusicalPatch): readonly ClipGroup[] {
  const grouped = new Map<ClipKey, { trackId: string; row: number; targetIndexes: number[] }>();
  patch.targets.forEach((target, targetIndex) => {
    const key = clipKey(target.clip.trackId, target.clip.row);
    const current = grouped.get(key) ?? {
      trackId: target.clip.trackId, row: target.clip.row, targetIndexes: [],
    };
    current.targetIndexes.push(targetIndex);
    grouped.set(key, current);
  });
  return [...grouped.entries()].map(([key, group]) => ({ key, ...group }));
}

function rowsFor(group: ClipGroup, patch: MusicalPatch): readonly number[] {
  if (patch.protection.kind === 'direct') return [group.row];
  if (patch.protection.reason === 'requested-variations') {
    return Array.from({ length: patch.protection.takes }, (_, index) => group.row + index);
  }
  return Array.from({ length: patch.protection.takes + 1 }, (_, index) => group.row + index);
}

function workRowsFor(group: ClipGroup, patch: MusicalPatch): readonly number[] {
  if (patch.protection.kind === 'clip-block'
      && patch.protection.reason === 'requested-variations') {
    return Array.from({ length: patch.protection.takes }, (_, index) => group.row + index);
  }
  return [group.row];
}

function assertBlocksDoNotOverlap(groups: readonly ClipGroup[], patch: MusicalPatch): void {
  const owner = new Map<ClipKey, ClipKey>();
  for (const group of groups) {
    for (const row of rowsFor(group, patch)) {
      const key = clipKey(group.trackId, row);
      const previous = owner.get(key);
      if (previous !== undefined && previous !== group.key) {
        throw new MusicalPatchError(
          `musical clip blocks overlap at track ${group.trackId}, row ${row}`,
        );
      }
      owner.set(key, group.key);
    }
  }
}

function uniqueAddresses(addresses: readonly Parameters<Workspace['read']>[0][number][]) {
  return [...new Map(addresses.map((address) => [addressKey(address), address])).values()];
}

function requireClip(snapshot: Snapshot, address: ClipAddress): void {
  const entry = snapshot.entries[addressKey(address)];
  if (entry?.value.of !== 'clip' || !entry.value.exists) {
    throw new AddressUnresolvedError(address, 'the musical target slot does not contain a clip');
  }
}

function requireEmptyClip(snapshot: Snapshot, address: ClipAddress): void {
  const entry = snapshot.entries[addressKey(address)];
  if (entry?.value.of !== 'clip') {
    throw new AddressUnresolvedError(address, 'the clip-block destination could not be read');
  }
  if (entry.value.exists) throw new SlotOccupiedError([address], 'overwrite');
}

function channelsAt(snapshot: Snapshot, address: ClipAddress): readonly MaterializedMusicalChannel[] {
  return Array.from({ length: 16 }, (_, channel) => {
    const noteAddress = notesAt(address, channel);
    const entry = snapshot.entries[addressKey(noteAddress)];
    if (entry?.value.of !== 'notes') {
      throw new AddressUnresolvedError(
        noteAddress,
        `MIDI channel ${channel} was not read; an absent channel cannot be treated as empty`,
      );
    }
    return { channel, notes: entry.value.notes };
  });
}

function channelsMatch(
  left: readonly MaterializedMusicalChannel[],
  right: readonly MaterializedMusicalChannel[],
): boolean {
  return left.every((channel, index) => sameValue(
    { of: 'notes', notes: channel.notes },
    { of: 'notes', notes: right[index]?.notes ?? [] },
  ));
}

function preflightAddresses(
  groups: readonly ClipGroup[],
  patch: MusicalPatch,
  epoch: number,
) {
  const addresses: Parameters<Workspace['read']>[0][number][] = [];
  for (const group of groups) {
    addresses.push(track(group.trackId));
    const rows = rowsFor(group, patch);
    rows.forEach((row, index) => {
      const address = clipAddress(group.trackId, row, epoch);
      addresses.push(address);
      const requestedDestination = patch.protection.kind === 'clip-block'
        && patch.protection.reason === 'requested-variations' && index > 0;
      if (!requestedDestination) {
        addresses.push(...Array.from({ length: 16 }, (_, channel) => notesAt(address, channel)));
      }
    });
  }
  return uniqueAddresses(addresses);
}

function assertRowsExist(groups: readonly ClipGroup[], patch: MusicalPatch, sceneCount: number): void {
  for (const group of groups) {
    const additionalRows = patch.protection.kind === 'direct'
      ? 0
      : patch.protection.reason === 'requested-variations'
        ? patch.protection.takes - 1
        : patch.protection.takes;
    const lastRow = group.row + additionalRows;
    if (!Number.isSafeInteger(lastRow) || lastRow >= sceneCount) {
      throw new MusicalPatchError(
        `musical preflight refused last row ${lastRow} on track ${group.trackId}: `
          + `the project has ${sceneCount} rows`,
      );
    }
  }
}

function validateCompiledOps(ops: readonly Op[]): void {
  assertOpsWritable(ops);
  for (const op of ops) {
    if (op.op === 'note.write' || op.op === 'note.props') chooseStepSize(op.notes);
  }
}

function clearanceFor(groups: readonly ClipGroup[], patch: MusicalPatch): Clearance | undefined {
  if (patch.protection.kind === 'direct') return undefined;
  const blocks = groups.map((group) => {
    const rows = rowsFor(group, patch);
    return `${group.trackId}:${rows[0]}-${rows.at(-1)}`;
  }).join('|');
  return branchProtected(`musical-clip-block:${blocks}`);
}

/** Build one revision-bound application plan without changing the project. */
export async function planMusicalPatch(
  workspace: Workspace,
  input: unknown,
  boundary: MusicalToolBoundary,
): Promise<PlannedMusicalApplication> {
  const patch = parseMusicalPatch(input);
  assertMusicalToolBoundary(patch, boundary);
  const groups = groupsOf(patch);

  const marked = await workspace.mark();
  assertRowsExist(groups, patch, marked.window.scenes.count);
  assertBlocksDoNotOverlap(groups, patch);
  const snapshot = await workspace.read(preflightAddresses(groups, patch, marked.sceneEpoch));
  if (snapshot.unreachable.length > 0) {
    throw blindSpotError(snapshot.unreachable, snapshot.at.window);
  }
  if (snapshot.at.sceneEpoch !== marked.sceneEpoch
      || snapshot.at.generation !== marked.generation
      || snapshot.at.project !== marked.project) {
    throw new MusicalPatchError(
      'the project or launcher rows changed during musical preflight; plan again',
    );
  }

  const channels = new Map<ClipKey, readonly MaterializedMusicalChannel[]>();
  for (const group of groups) {
    const trackEntry = snapshot.entries[addressKey(track(group.trackId))];
    if (trackEntry?.value.of !== 'track') {
      throw new AddressUnresolvedError(track(group.trackId), 'the musical target track does not exist');
    }
    const rows = rowsFor(group, patch);
    for (const [index, row] of rows.entries()) {
      const address = clipAddress(group.trackId, row, marked.sceneEpoch);
      const requestedDestination = patch.protection.kind === 'clip-block'
        && patch.protection.reason === 'requested-variations' && index > 0;
      if (requestedDestination) {
        requireEmptyClip(snapshot, address);
        continue;
      }
      requireClip(snapshot, address);
      channels.set(clipKey(group.trackId, row), channelsAt(snapshot, address));
    }

    if (patch.protection.kind === 'clip-block'
        && patch.protection.reason === 'fidelity-required') {
      const source = channels.get(group.key)!;
      const protectedRows = rows.slice(1);
      if (!protectedRows.some((row) => channelsMatch(
        source, channels.get(clipKey(group.trackId, row))!,
      ))) {
        throw new MusicalPatchError(
          `fidelity-required clip block on track ${group.trackId}, row ${group.row} needs `
            + 'an adjacent existing take with the same complete 16-channel note state',
        );
      }
    }
  }

  const ops: Op[] = [];
  const results: PlannedMusicalResult[] = [];
  const differences: MusicalLoss[] = [];
  const warnings: string[] = [];

  for (const group of groups) {
    const sourceChannels = channels.get(group.key)!;
    const rows = workRowsFor(group, patch);
    const rowOps: Op[][] = [];
    for (const [variationIndex, row] of rows.entries()) {
      const materialized: MaterializedMusicalTarget[] = [];
      for (const targetIndex of group.targetIndexes) {
        const target = patch.targets[targetIndex]!;
        const source = sourceChannels.find((entry) => entry.channel === target.channel)!;
        const outcome = materializeMusicalTarget(
          target, source.notes, targetIndex, variationIndex,
          patch.seed === undefined ? {} : { seed: patch.seed },
        );
        if (!outcome.ok) throw new MusicalPatchError(outcome.reason, [outcome.reason]);
        const compiledTarget = toMaterializedMusicalTarget(outcome.value);
        materialized.push(compiledTarget);
        differences.push(...outcome.value.loss);
        warnings.push(...outcome.warnings.map((warning) =>
          `target ${targetIndex}, variation ${variationIndex}: ${warning}`));
        results.push({
          targetIndex,
          variationIndex,
          clip: { trackId: group.trackId, row },
          channel: target.channel,
          write: target.write,
          notes: compiledTarget.notes,
          ...(outcome.value.effectiveSeed === undefined
            ? {}
            : { effectiveSeed: outcome.value.effectiveSeed }),
          seedScopes: outcome.value.seedScopes,
        });
      }
      const targetAddress = clipAddress(group.trackId, row, marked.sceneEpoch);
      const existingChannels = patch.protection.kind === 'clip-block'
        && patch.protection.reason === 'requested-variations'
        ? sourceChannels
        : channels.get(clipKey(group.trackId, row))!;
      const compiled = compileMusicalClip(targetAddress, materialized, {
        revision: snapshot.at.revision,
        channels: existingChannels,
      });
      rowOps.push([...compiled.ops]);
      differences.push(...compiled.loss);
    }
    if (patch.protection.kind === 'clip-block'
        && patch.protection.reason === 'requested-variations') {
      // The host can copy only one row down. Complete the adjacent copy chain
      // while each source still holds the original clip state.
      for (let index = 1; index < rows.length; index += 1) {
        ops.push({
          op: 'clip.duplicate',
          source: clipAddress(group.trackId, rows[index - 1]!, marked.sceneEpoch),
          destination: clipAddress(group.trackId, rows[index]!, marked.sceneEpoch).slot,
        });
      }
      ops.push(...rowOps.flat());
    } else {
      ops.push(...rowOps.flat());
    }
  }

  validateCompiledOps(ops);
  const requestedBlocks = patch.protection.kind === 'clip-block'
    && patch.protection.reason === 'requested-variations';
  const clipBlocks: PlannedClipBlock[] = patch.protection.kind === 'direct' ? [] : groups.map((group) => {
    const rows = rowsFor(group, patch);
    return {
      trackId: group.trackId,
      firstRow: rows[0]!,
      lastRow: rows.at(-1)!,
      createdRows: requestedBlocks ? rows.slice(1) : [],
      protectedRows: requestedBlocks ? [] : rows.slice(1),
    };
  });
  const clearance = clearanceFor(groups, patch);
  return {
    patch, boundary, ifRevision: snapshot.at.revision, ops,
    ...(clearance === undefined ? {} : { clearance }),
    results, differences, warnings, clipBlocks,
  };
}

/** Apply one fully preflighted patch through the workspace write seam. */
export async function applyMusicalPatch(
  workspace: Workspace,
  input: unknown,
  boundary: MusicalToolBoundary,
): Promise<MusicalPlannerResult> {
  const plan = await planMusicalPatch(workspace, input, boundary);
  const change = await workspace.apply(plan.ops, {
    ifRevision: plan.ifRevision,
    ...(plan.clearance === undefined ? {} : { clearance: plan.clearance }),
  });
  const reversal = change.take.report.applied
    ? { fidelity: change.take.fidelity, ...revertOps(change.take) }
    : { fidelity: 'exact' as const, unrestored: [] };
  return {
    schema: 'ghostnote-musical-planner-result',
    version: 1,
    boundary,
    protection: plan.patch.protection,
    results: plan.results,
    differences: plan.differences,
    warnings: plan.warnings,
    clipBlocks: plan.clipBlocks,
    changesets: [{
      id: change.take.id, seq: change.seq,
      applied: change.take.report.applied, fidelity: change.take.fidelity,
    }],
    disagreements: change.take.report.disagreements,
    unverified: change.take.report.unverified,
    concurrent: change.take.report.concurrent,
    ...(change.take.report.undecidable === undefined
      ? {}
      : { undecidable: change.take.report.undecidable }),
    reversal: [{
      changeId: change.take.id,
      fidelity: reversal.fidelity,
      unrestored: reversal.unrestored,
    }],
  };
}
