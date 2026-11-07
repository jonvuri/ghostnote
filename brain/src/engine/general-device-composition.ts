/**
 * Composition and reversal for general device sources.
 *
 * P01 (D65, E403): proved stages run without mid-operation proofs. New sources go directly to their layer chain's
 * end in one `chain.insert` for each run of consecutive new sources; existing sources keep `chain.relocate`. One
 * container structure read at the end supplies the result, the reversal checkpoint and the modulation witnesses.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  composeGeneralDeviceContainerPreset, GENERAL_CONTAINER_SEED_ENTRIES, GENERAL_DEVICE_COMPOSITION_CAPACITIES,
  isPresetEntryName, type GeneralDeviceContainerKind, type GeneralDeviceContainerModulation,
} from '../composition/index.js';
import {
  addressKey, chain, CHAIN_INSERT_MAX_SOURCES, device, deviceIn, planStages,
  type Address, type DeviceAddress, type DeviceSource, type ObservedDevice,
  type ObservedContainer, type ObservedDeviceBank, type ObservedDeviceSequence,
  type Op, type ParamState, type ReadOptions, type RevisionMark,
  type Snapshot, type TrackAddress,
} from '../contract/index.js';
import {
  inspectPresetModulation,
  type PresetFingerprint, type SemanticModulatorLocation,
} from './preset-modulation-inspection.js';
import type { RunOptions } from './executor.js';
import { ownChangesetReversal } from './floor.js';
import {
  authorSemanticPreset, verifyModulations, verifyPages,
  type ModulationVerification, type ModulatorPageVerification,
} from './modulator-authoring.js';
import { settleObservation } from './settlement.js';
import type { ModulationTarget } from './modulation-target.js';
import { modulationRoute } from './modulation-target.js';
import type { Take } from './take.js';

export interface GeneralDeviceCompositionHost {
  readonly throwIfCancelled?: () => void;
  devices(track: TrackAddress): Promise<ObservedDeviceBank>;
  read(addresses: readonly Address[], options?: ReadOptions): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface GeneralDeviceOrderItem {
  readonly name: string;
  readonly enabled: boolean;
}

export type GeneralDeviceSourceRequest =
  | { readonly kind: 'native'; readonly name: string; readonly uuid: string }
  | { readonly kind: 'vst3'; readonly classUid: string }
  | { readonly kind: 'clap'; readonly id: string }
  | {
    readonly kind: 'preset'; readonly path: string; readonly fingerprint?: PresetFingerprint;
    readonly modulatorLocation?: SemanticModulatorLocation;
  }
  | { readonly kind: 'existing-move'; readonly devicePosition: number }
  | { readonly kind: 'existing-copy'; readonly devicePosition: number };

export interface GeneralDeviceModulationRequest {
  readonly location: 'container' | 'device';
  readonly modulator: string;
  readonly donorId: string;
  readonly pageName: string;
  readonly target: ModulationTarget;
  readonly amount: number;
  /** `identity` (D46): the exact target id and name, with no behavior samples. */
  readonly behaviorCheck: 'active' | 'page-only' | 'identity';
}

export interface GeneralDeviceEntryDeviceRequest {
  readonly source: GeneralDeviceSourceRequest;
  readonly modulators: readonly GeneralDeviceModulationRequest[];
}

export interface GeneralDeviceEntryRequest {
  readonly entryName: string;
  readonly devices: readonly GeneralDeviceEntryDeviceRequest[];
}

export interface GeneralDeviceCompositionRequest {
  readonly track: TrackAddress;
  readonly expectedDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly containerKind: GeneralDeviceContainerKind;
  readonly containerPosition: number;
  readonly entries: readonly GeneralDeviceEntryRequest[];
}

export interface GeneralDeviceFingerprint {
  readonly algorithm: 'sha256';
  readonly sha256: string;
  readonly parameterCount: number;
}

export interface GeneralDeviceStageReceipt {
  readonly stage: 'insert-container' | 'position-container' | 'prepare-entry-name'
    | 'confirm-entry-name' | 'insert-sources' | 'relocate-source'
    | 'extract-source' | 'restore-position' | 'remove-container';
  readonly entryIndex?: number;
  readonly changeId: string;
  readonly applied: boolean;
}

export interface GeneralDeviceCheckpointEntry {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly observedName: string;
  readonly enabled: boolean;
  readonly fingerprint?: GeneralDeviceFingerprint;
  readonly fingerprintLocation?: SemanticModulatorLocation;
  readonly ownedChangeId?: string;
  readonly originalPosition?: number;
}

/**
 * Schema 5 is retained: the frozen `stable-v1` reversal tool validates this shape. `completedEntries` lists every
 * device that the final container read observed, so with `preparedEntryNames` it is the complete owned structure
 * that reversal checks. The pending fields of the earlier staged route are not produced.
 */
export interface GeneralDeviceCompositionCheckpoint {
  readonly schemaVersion: 5;
  readonly state: 'container-inserted' | 'container-positioned' | 'entries-prepared' | 'composing';
  readonly track: TrackAddress;
  readonly containerKind: GeneralDeviceContainerKind;
  readonly requestedContainerPosition: number;
  readonly containerInsertTakeId: string;
  readonly insertedContainerPosition: number;
  readonly currentContainerPosition: number;
  readonly seedUnchanged: boolean;
  readonly lastWriteAt: { readonly revision: number; readonly generation: string; readonly project: string };
  readonly originalDeviceOrder: readonly GeneralDeviceOrderItem[];
  readonly entryNames: readonly string[];
  readonly preparedEntryNames: readonly string[];
  readonly completedEntries: readonly GeneralDeviceCheckpointEntry[];
  readonly reversalRemainingEntries?: readonly GeneralDeviceCheckpointEntry[];
  readonly reversalPendingTopLevel?: GeneralDeviceCheckpointEntry & {
    readonly position: number;
  };
  readonly reversalContainerRemoved?: true;
}

export interface GeneralDeviceEntryVerification {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly entryName: string;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly sourceIdentity: Record<string, unknown>;
  readonly observed: { readonly deviceName: string; readonly enabled: boolean; readonly position: number };
  readonly instance: 'preserved' | 'new';
  readonly stateClaim: string;
  readonly pages: ModulatorPageVerification;
  readonly containerPages: ModulatorPageVerification;
  readonly behaviors: readonly ModulationVerification[];
  readonly verified: boolean;
}

export interface GeneralDeviceCompositionResult {
  readonly complete: boolean;
  /** A write threw before returning a receipt; do not infer that it wrote nothing. */
  readonly effectsPossible?: boolean;
  readonly failedStage?: string;
  readonly why?: string;
  readonly stages: readonly GeneralDeviceStageReceipt[];
  readonly checkpoint?: GeneralDeviceCompositionCheckpoint;
  readonly entries: readonly GeneralDeviceEntryVerification[];
  readonly capacities: typeof GENERAL_DEVICE_COMPOSITION_CAPACITIES;
  readonly structure?: readonly {
    readonly entryIndex: number; readonly entryName: string;
    readonly devices: readonly { readonly position: number; readonly name: string; readonly enabled: boolean }[];
  }[];
}

export interface GeneralDeviceCompositionReversal {
  readonly complete: boolean;
  readonly failedStage?: string;
  readonly why?: string;
  readonly stages: readonly GeneralDeviceStageReceipt[];
  readonly containerRemoved: boolean;
  readonly restoredDeviceOrder: boolean;
  readonly checkpoint?: GeneralDeviceCompositionCheckpoint;
}

export interface GeneralDeviceCompositionOptions {
  readonly run?: Omit<RunOptions, 'ifRevision'>;
  readonly wait?: (milliseconds: number) => Promise<void>;
  readonly tempRoot?: string;
  readonly templatePath?: string;
  /**
   * The caller compared `expectedDeviceOrder` with a complete top-level read just before this call. Without it, the
   * engine makes that one read itself, so a stale order refuses before any write.
   */
  readonly orderValidated?: true;
}

/** The fields that place a source relative to the original top-level order. */
type SourcePlacement = Pick<GeneralDeviceCheckpointEntry, 'sourceKind' | 'originalPosition'>;

/** One prepared source: the insertion input of a new source, or the original position of an existing one. */
interface PreparedSource {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly request: GeneralDeviceEntryDeviceRequest;
  readonly insert?: DeviceSource;
  readonly identity: Record<string, unknown>;
}

/** A device the composition placed in a chain, before the final read names it. */
interface Placed {
  readonly entryIndex: number;
  readonly deviceIndex: number;
  readonly sourceKind: GeneralDeviceSourceRequest['kind'];
  readonly ownedChangeId?: string;
  readonly originalPosition?: number;
}

/** Compose ordered sources inside one owned container. */
export async function composeGeneralDeviceSources(
  host: GeneralDeviceCompositionHost,
  request: GeneralDeviceCompositionRequest,
  options: GeneralDeviceCompositionOptions = {},
): Promise<GeneralDeviceCompositionResult> {
  const stages: GeneralDeviceStageReceipt[] = [];
  const placed: Placed[] = [];
  let checkpoint: GeneralDeviceCompositionCheckpoint | undefined;
  let attempted = false;
  let effectsPossible = false;
  let failedStage = 'preflight';
  let directory: string | undefined;
  // Each later stage guards on the revision that the previous stage's own take read.
  let lastAt: RevisionMark | undefined;
  const run = (ops: readonly Op[]) => host.apply(ops, {
    ...options.run, ...(lastAt === undefined ? {} : { ifRevision: lastAt.revision }),
  }).then(({ take }) => {
    lastAt = take.verify.at;
    return take;
  });
  try {
    // Validate the whole request, author presets and inspect preset files before the first write.
    assertRequest(request);
    if (options.orderValidated !== true
        && !sameOrder(await completeTop(host, request.track), request.expectedDeviceOrder)) {
      throw new Error('the top-level device order or enabled state is stale');
    }
    directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-general-compose-'));
    const prepared = await prepareSources(request, directory);
    const outerRequests: GeneralDeviceContainerModulation[] = request.entries.flatMap(
      (entry, entryIndex) => entry.devices.flatMap((entryDevice, deviceIndex) =>
        entryDevice.modulators
          .filter((item) => item.location === 'container')
          .map((item) => ({
            entryIndex, deviceIndex,
            modulator: item.modulator, target: item.target, amount: item.amount,
          }))),
    );
    // P01 (E409, E410): the seed is trimmed to the request's width and carries the requested names, so no chain
    // is grown or renamed live. Only a name with a lone UTF-16 surrogate, which is not well-formed Unicode,
    // leaves the names to the live rename stages below.
    const requestedNames = request.entries.map((item) => item.entryName);
    const containerPreset = await composeGeneralDeviceContainerPreset(request.containerKind, outerRequests, {
      ...(options.templatePath === undefined ? {} : { templatePath: options.templatePath }),
      entryCount: request.entries.length,
      ...(requestedNames.every(isPresetEntryName) ? { entryNames: requestedNames } : {}),
    });
    const containerPath = join(directory, 'general-device-container.bwpreset');
    await writeFile(containerPath, containerPreset.preset);

    // The adapter guard of this insertion validates expectedDeviceOrder against the live track.
    failedStage = 'insert-container';
    attempted = true;
    const insertion = await run([{
      op: 'device.insert', track: request.track,
      source: { from: 'file', path: containerPath },
      expectedDeviceName: request.containerKind,
      expectedChain: request.expectedDeviceOrder.map((item) => item.name),
      expectedEnabledChain: request.expectedDeviceOrder.map((item) => item.enabled),
    }]);
    stages.push(receipt('insert-container', insertion));
    const minted = insertion.receipt.minted[0];
    if (!accepted(insertion) || minted?.kind !== 'device') {
      return failure(failedStage, 'The owned container insertion was not proved.', stages, []);
    }
    checkpoint = {
      schemaVersion: 5, state: 'container-inserted', track: request.track,
      containerKind: request.containerKind, containerInsertTakeId: insertion.id,
      requestedContainerPosition: request.containerPosition,
      insertedContainerPosition: minted.chainIndex, currentContainerPosition: minted.chainIndex,
      seedUnchanged: true, lastWriteAt: minimalMark(insertion.verify.at),
      originalDeviceOrder: request.expectedDeviceOrder,
      entryNames: request.entries.map((item) => item.entryName),
      preparedEntryNames: [],
      completedEntries: [],
    };

    const withInserted = [...request.expectedDeviceOrder, { name: request.containerKind, enabled: true }];
    if (minted.chainIndex !== request.containerPosition) {
      failedStage = 'position-container';
      const positioning = await run([{
        op: 'device.relocate', track: request.track, sourceFromEnd: 0,
        expectedName: request.containerKind, before: device(request.track, request.containerPosition),
        expectedChain: withInserted.map((item) => item.name),
        expectedEnabledChain: withInserted.map((item) => item.enabled),
      }]);
      stages.push(receipt('position-container', positioning));
      if (!accepted(positioning)) {
        return await finish(failedStage, 'The owned container position was not proved.');
      }
    }
    checkpoint = {
      ...checkpoint, state: 'container-positioned',
      currentContainerPosition: request.containerPosition, lastWriteAt: minimalMark(lastAt!),
    };

    // The live names must be known before any rename; this read also waits for the container.
    failedStage = 'container-witness';
    const container = device(request.track, request.containerPosition);
    const initialStructure = await observedContainer(host, container, request.containerKind);
    const initialEntries = initialStructure === undefined ? undefined : observedEntries(initialStructure);
    const initialNames = initialEntries?.map((entry) => entry.name) ?? [];
    if (initialEntries === undefined || initialEntries.length !== request.entries.length
        || new Set(initialNames).size !== initialNames.length
        || initialEntries.some((entry) =>
          !entry.sequence.devicesComplete || entry.sequence.devices.length !== 0)) {
      return await finish(failedStage, 'The exact empty seed structure did not read back.');
    }
    checkpoint = { ...checkpoint, preparedEntryNames: [...initialNames] };

    if (JSON.stringify(initialNames) !== JSON.stringify(requestedNames)) {
      // 8i3 (E252): all entry names in one stage. A requested name that is another seed entry's name needs unique
      // temporary names first, in a stage of its own.
      const clash = requestedNames.some((name, index) =>
        initialNames.some((initial, other) => other !== index && initial === name));
      const temporaryNames = clash
        ? uniqueTemporaryNames([...initialNames, ...requestedNames], request.entries.length) : [];
      const passes: { stage: 'prepare-entry-name' | 'confirm-entry-name'; from: readonly string[];
        to: readonly string[] }[] = clash
        ? [{ stage: 'prepare-entry-name', from: initialNames, to: temporaryNames },
          { stage: 'confirm-entry-name', from: temporaryNames, to: requestedNames }]
        : [{ stage: 'confirm-entry-name', from: initialNames, to: requestedNames }];
      failedStage = 'prepare-entries';
      for (const pass of passes) {
        const ops: Op[] = pass.from.flatMap((name, index): Op[] => name === pass.to[index] ? []
          : [{ op: 'chain.rename', chain: chain(container, name), name: pass.to[index]! }]);
        const renamed = await run(ops);
        stages.push(receipt(pass.stage, renamed));
        checkpoint = { ...checkpoint, seedUnchanged: false };
        if (!accepted(renamed)) {
          // Keep only names with a proved receipt entry; the final read reports the rest. Renames share a stage,
          // and each sends one frame, so a stage's reply entries map to its ops by position.
          const preparedEntryNames = [...pass.from];
          for (const [index, stage] of planStages(ops).entries()) {
            const proof = renamed.receipt.stages.find((item) => item.index === index);
            if (proof?.applied !== true || proof.ops.length !== stage.ops.length) continue;
            for (const [position, op] of stage.ops.entries()) {
              if (op.op === 'chain.rename' && proof.ops[position]!.ok) {
                preparedEntryNames[pass.from.indexOf(op.chain.name)] = op.name;
              }
            }
          }
          checkpoint = { ...checkpoint, preparedEntryNames };
          return await finish('prepare-entries', 'The entry names were not proved.');
        }
        checkpoint = { ...checkpoint, preparedEntryNames: [...pass.to], lastWriteAt: minimalMark(lastAt!) };
      }
    }
    checkpoint = { ...checkpoint, state: 'entries-prepared' };

    // Process each entry in order. Consecutive new sources across entries share one batch, with one
    // `chain.insert` for each chain. Consecutive existing sources share another, with one `chain.relocate` stage
    // each, projected from the stages before it (P01, D65). A change of source kind ends the batch.
    let pending: { op: Extract<Op, { op: 'chain.insert' }>; sources: readonly PreparedSource[] }[] = [];
    let relocations: { op: Op; placement: Placed }[] = [];
    const counts = request.entries.map(() => 0);
    const flushRelocations = async (): Promise<string | undefined> => {
      if (relocations.length === 0) return undefined;
      const batch = relocations;
      relocations = [];
      const first = batch[0]!.placement;
      failedStage = `source-${first.entryIndex}-${first.deviceIndex}`;
      effectsPossible = true;
      const relocation = await run(batch.map((item) => item.op));
      stages.push(receipt('relocate-source', relocation, first.entryIndex));
      checkpoint = { ...checkpoint!, state: 'composing', seedUnchanged: false, lastWriteAt: minimalMark(lastAt!) };
      // Each stage was projected from the ones before it, so the first unproved stage ends the proved run.
      for (const [index, item] of batch.entries()) {
        const proof = relocation.receipt.stages.find((stage) => stage.index === index);
        if (proof?.applied !== true || proof.ops.length === 0 || !proof.ops.every((entry) => entry.ok)) {
          failedStage = `source-${item.placement.entryIndex}-${item.placement.deviceIndex}`;
          break;
        }
        placed.push(item.placement.sourceKind === 'existing-copy'
          ? { ...item.placement, ownedChangeId: relocation.id } : item.placement);
      }
      return accepted(relocation) ? undefined : 'The source relocation was not proved.';
    };
    const flush = async (): Promise<string | undefined> => {
      if (pending.length === 0) return undefined;
      const batch = pending;
      pending = [];
      failedStage = `insert-sources-${batch[0]!.sources[0]!.entryIndex}`;
      effectsPossible = true;
      checkpoint = { ...checkpoint!, state: 'composing', seedUnchanged: false };
      const inserted = await run(batch.map((item) => item.op));
      stages.push(receipt('insert-sources', inserted, batch[0]!.sources[0]!.entryIndex));
      const proved = new Set(inserted.receipt.stages.filter((stage) =>
        stage.applied && stage.ops.length > 0 && stage.ops.every((item) => item.ok)).map((stage) => stage.index));
      for (const [index, item] of batch.entries()) {
        if (!proved.has(index)) continue;
        for (const source of item.sources) {
          placed.push({
            entryIndex: source.entryIndex, deviceIndex: source.deviceIndex,
            sourceKind: source.request.source.kind, ownedChangeId: inserted.id,
          });
        }
      }
      checkpoint = { ...checkpoint!, lastWriteAt: minimalMark(lastAt!) };
      return accepted(inserted) ? undefined : 'A direct chain insertion did not complete.';
    };

    for (const [entryIndex, entry] of request.entries.entries()) {
      for (const [deviceIndex, entryDevice] of entry.devices.entries()) {
        const source = entryDevice.source;
        const preparedSource = prepared.find((item) =>
          item.entryIndex === entryIndex && item.deviceIndex === deviceIndex)!;
        if (source.kind !== 'existing-move' && source.kind !== 'existing-copy') {
          const relocated = await flushRelocations();
          if (relocated !== undefined) return await finish(failedStage, relocated);
          const last = pending.at(-1);
          const sameChain = last !== undefined && last.sources[0]!.entryIndex === entryIndex;
          if (sameChain && last.op.sources.length < CHAIN_INSERT_MAX_SOURCES) {
            last.op = { ...last.op, sources: [...last.op.sources, preparedSource.insert!] };
            last.sources = [...last.sources, preparedSource];
          } else {
            const top = projectedTop(request, placed);
            pending.push({
              op: {
                op: 'chain.insert',
                chain: chain(device(request.track, containerPosition(request, placed)), entry.entryName),
                sources: [preparedSource.insert!], expectedDeviceCount: counts[entryIndex]!,
                expectedContainerName: request.containerKind,
                expectedChain: top.map((item) => item.name), expectedEnabledChain: top.map((item) => item.enabled),
              },
              sources: [preparedSource],
            });
          }
          counts[entryIndex]! += 1;
          continue;
        }
        const why = await flush();
        if (why !== undefined) return await finish(failedStage, why);
        // Project from the proved placements and the earlier relocations in this batch.
        const projected = [...placed, ...relocations.map((item) => item.placement)];
        const top = projectedTop(request, projected);
        relocations.push({
          op: {
            op: 'chain.relocate',
            source: device(request.track, currentExistingPosition(request, source.devicePosition, projected)),
            destination: chain(device(request.track, containerPosition(request, projected)), entry.entryName),
            mode: source.kind === 'existing-copy' ? 'copy' : 'move',
            expectedChain: top.map((item) => item.name), expectedEnabledChain: top.map((item) => item.enabled),
          },
          placement: { entryIndex, deviceIndex, sourceKind: source.kind, originalPosition: source.devicePosition },
        });
        counts[entryIndex]! += 1;
      }
    }
    const relocated = await flushRelocations();
    if (relocated !== undefined) return await finish(failedStage, relocated);
    const why = await flush();
    if (why !== undefined) return await finish(failedStage, why);
    return await finish(undefined, undefined, prepared);
  } catch (error) {
    host.throwIfCancelled?.();
    const uncertainInsertion = attempted && checkpoint === undefined;
    const prefix = uncertainInsertion
      ? 'Container insertion may have applied; inspect the track before another write.'
      : checkpoint === undefined ? 'Nothing was written.' : 'The workflow stopped after a project write.';
    if (checkpoint === undefined) {
      const outcome = failure(failedStage, `${prefix} ${message(error)}`, stages, []);
      return uncertainInsertion ? { ...outcome, effectsPossible: true } : outcome;
    }
    // A thrown write may have landed in part. Never repeat it; read the owned container once and report it.
    const outcome = await finish(failedStage, `${prefix} ${message(error)}`).catch(() =>
      failure(failedStage, `${prefix} ${message(error)}`, stages, [], checkpoint));
    return effectsPossible ? { ...outcome, effectsPossible: true } : outcome;
  } finally {
    if (directory !== undefined) await rm(directory, { recursive: true, force: true });
  }

  /**
   * The one final readback: the complete container structure, attributed to the requested sources in order,
   * then the modulation witnesses of a complete composition. A failure reports what the read observed.
   */
  async function finish(
    stopped: string | undefined, why: string | undefined, sources?: readonly PreparedSource[],
  ): Promise<GeneralDeviceCompositionResult> {
    let current = checkpoint!;
    const position = current.state === 'container-inserted'
      ? current.insertedContainerPosition : containerPosition(request, placed);
    const container = device(request.track, position);
    const observed = await observedContainer(host, container, request.containerKind).catch(() => undefined);
    const entries = observed === undefined ? undefined : observedEntries(observed);
    // A stop before the seed names were recorded adopts an untouched, all-empty seed, so reversal can remove it.
    if (current.preparedEntryNames.length === 0 && entries !== undefined
        && entries.every((entry) => entry.sequence.devicesComplete && entry.sequence.devices.length === 0)) {
      current = { ...current, preparedEntryNames: entries.map((entry) => entry.name) };
    }
    const prepared = current.preparedEntryNames;
    const readable = entries !== undefined && entries.length === prepared.length
      && entries.every((entry, index) => entry.name === prepared[index] && entry.sequence.devicesComplete
        && entry.sequence.devices.every((item) => item.enabled !== undefined));
    if (!readable) {
      return failure(stopped ?? 'final-witness', why ?? 'The complete container structure did not read back.',
        stages, [], { ...current, currentContainerPosition: position });
    }
    // Attribute observed devices to the requested sources by position: every source lands at its chain's end.
    // A device that cannot be attributed is not claimed, so reversal's structure guard refuses rather than
    // removing or moving it.
    const completedEntries: GeneralDeviceCheckpointEntry[] = [];
    let matches = true;
    for (const [entryIndex, entry] of entries.entries()) {
      const wanted = request.entries[entryIndex]?.devices ?? [];
      for (const [deviceIndex, item] of entry.sequence.devices.entries()) {
        const source = wanted[deviceIndex]?.source;
        const place = placed.find((candidate) =>
          candidate.entryIndex === entryIndex && candidate.deviceIndex === deviceIndex);
        const expected = source?.kind === 'existing-move' || source?.kind === 'existing-copy'
          ? request.expectedDeviceOrder[source.devicePosition] : undefined;
        if (place === undefined) matches = false;
        if (source === undefined || (expected !== undefined
            && (item.name !== expected.name || item.enabled !== expected.enabled))) {
          matches = false;
          continue;
        }
        completedEntries.push({
          entryIndex, deviceIndex, entryName: entry.name, sourceKind: source.kind,
          observedName: item.name, enabled: item.enabled as boolean,
          ...(place?.ownedChangeId === undefined ? {} : { ownedChangeId: place.ownedChangeId }),
          ...(source?.kind === 'existing-move' || source?.kind === 'existing-copy'
            ? { originalPosition: source.devicePosition } : {}),
        });
      }
    }
    current = { ...current, completedEntries, currentContainerPosition: position };
    checkpoint = current;
    const structure = entries.map((entry, entryIndex) => ({
      entryIndex, entryName: entry.name,
      devices: entry.sequence.devices.map((item) => ({
        position: item.index, name: item.name, enabled: item.enabled as boolean,
      })),
    }));
    if (stopped !== undefined || sources === undefined) {
      return { ...failure(stopped ?? 'final-witness', why ?? 'The composition stopped.', stages, [], current),
        structure };
    }
    const complete = matches && request.entries.every((entry, index) =>
      entries[index]?.sequence.devices.length === entry.devices.length);
    if (!complete) {
      return { ...failure('final-witness', 'The complete requested structure did not read back.', stages, [],
        current), structure };
    }
    const verified = await witnesses(host, request, sources, completedEntries, position, options);
    const allVerified = verified.every((item) => item.verified);
    return {
      complete: allVerified,
      ...(allVerified ? {} : {
        failedStage: 'final-witness', why: 'One modulation witness did not pass.',
      }),
      stages, checkpoint: current, entries: verified, capacities: GENERAL_DEVICE_COMPOSITION_CAPACITIES, structure,
    };
  }
}

/** Validate and prepare every source before the first write. Preset-local modulation is authored here. */
async function prepareSources(
  request: GeneralDeviceCompositionRequest, directory: string,
): Promise<readonly PreparedSource[]> {
  const prepared: PreparedSource[] = [];
  for (const [entryIndex, entry] of request.entries.entries()) {
    for (const [deviceIndex, entryDevice] of entry.devices.entries()) {
      const source = entryDevice.source;
      const base = { entryIndex, deviceIndex, request: entryDevice };
      if (source.kind === 'existing-move' || source.kind === 'existing-copy') {
        prepared.push({ ...base, identity: { kind: source.kind, originalDevicePosition: source.devicePosition } });
      } else if (source.kind === 'native') {
        prepared.push({ ...base, insert: { from: 'bitwig', uuid: source.uuid },
          identity: { kind: source.kind, exactCatalogName: source.name } });
      } else if (source.kind === 'vst3') {
        prepared.push({ ...base, insert: { from: 'vst3', classUid: source.classUid },
          identity: { kind: source.kind, classUid: source.classUid } });
      } else if (source.kind === 'clap') {
        prepared.push({ ...base, insert: { from: 'clap', id: source.id }, identity: { kind: source.kind, id: source.id } });
      } else {
        const deviceMods = entryDevice.modulators.filter((item) => item.location === 'device');
        let path = source.path;
        let identity: Record<string, unknown>;
        if (deviceMods.length > 0) {
          if (source.fingerprint === undefined || source.modulatorLocation === undefined) {
            throw new Error('a preset device modulation needs its exact fingerprint and semantic location');
          }
          const authored = await authorSemanticPreset(
            source.path, source.fingerprint, source.modulatorLocation,
            deviceMods.map((item) => ({
              donorId: item.donorId,
              routing: { target: modulationRoute(item.target), amount: item.amount },
            })),
          );
          path = join(directory, `${entryIndex}-${deviceIndex}-${basename(source.path)}`);
          await writeFile(path, authored.preset);
          identity = {
            presetMetadataName: authored.hostName,
            semanticLocation: authored.location,
            sampledPreset: authored.sampledPreset,
            adjustedSampleReferences: authored.adjustedSampleReferences,
          };
        } else {
          const bytes = await readFile(source.path);
          const inspection = inspectPresetModulation(bytes);
          identity = inspection.supported
            ? {
              presetBytes: bytes.length, presetMetadataName: inspection.host.name,
              sampledPreset: inspection.host.tier === 'tier-2',
            }
            : { presetBytes: bytes.length, presetMetadataUnavailable: inspection.why };
        }
        prepared.push({ ...base, insert: { from: 'file', path }, identity: { kind: source.kind, path: source.path, ...identity } });
      }
    }
  }
  return prepared;
}

/** Per-device results from the final structure, with the modulation witnesses that a device requests. */
async function witnesses(
  host: GeneralDeviceCompositionHost,
  request: GeneralDeviceCompositionRequest,
  sources: readonly PreparedSource[],
  completed: readonly GeneralDeviceCheckpointEntry[],
  position: number,
  options: GeneralDeviceCompositionOptions,
): Promise<GeneralDeviceEntryVerification[]> {
  const pause = options.wait ?? wait;
  const container = device(request.track, position);
  const empty: ModulatorPageVerification = { verified: true, actualPages: [], witnesses: [] };
  const outerPages = request.entries.flatMap((item) => item.devices.flatMap((entryItem) =>
    entryItem.modulators.filter((mod) => mod.location === 'container').map((mod) => mod.pageName)));
  const containerPages = outerPages.length === 0 ? empty
    : await verifyPages(host, container, pageWitnesses(outerPages), pause);
  const verified: GeneralDeviceEntryVerification[] = [];
  for (const prepared of sources) {
    const { entryIndex, deviceIndex } = prepared;
    const entryDevice = prepared.request;
    const source = entryDevice.source;
    const entryName = request.entries[entryIndex]!.entryName;
    const observed = completed.find((item) => item.entryIndex === entryIndex && item.deviceIndex === deviceIndex)!;
    const nested = deviceIn(chain(container, entryName), deviceIndex);
    const deviceMods = entryDevice.modulators.filter((item) => item.location === 'device');
    const containerMods = entryDevice.modulators.filter((item) => item.location === 'container');
    const deviceWitness = deviceMods.length === 0
      ? { address: nested }
      : deviceModulationWitness(nested, source.kind === 'preset' ? source.modulatorLocation : undefined);
    let hostMatches = true;
    if (deviceWitness.expectedName !== undefined) {
      const inventory = await stableInventory(host, deviceWitness.address, pause);
      hostMatches = inventory.name === deviceWitness.expectedName;
    }
    const pages = deviceMods.length === 0 ? empty
      : await verifyPages(host, deviceWitness.address, pageWitnesses(deviceMods.map((item) => item.pageName)), pause);
    // 8i3 (E252): the active witnesses of one device share each sample round, and each keeps its own verdict.
    const active = entryDevice.modulators.filter((modulator) => modulator.behaviorCheck !== 'page-only');
    const behaviors: ModulationVerification[] = [];
    for (const address of [deviceWitness.address, nested]) {
      const indices = active.flatMap((item, index) =>
        (item.location === 'device' ? deviceWitness.address : nested) === address ? [index] : []);
      if (indices.length > 0) {
        const results = await verifyModulations(host, address, indices.map((index) => ({
          ...active[index]!.target,
          expected: active[index]!.behaviorCheck === 'identity' ? 'identity' as const : 'active' as const,
        })), pause);
        indices.forEach((index, at) => { behaviors[index] = results[at]!; });
      }
      if (deviceWitness.address === nested) break;
    }
    const metadataName = prepared.identity['presetMetadataName'];
    const sourceIdentity = source.kind === 'preset' ? {
      ...prepared.identity, observedDeviceName: observed.observedName,
      nameMatchesPresetMetadata: typeof metadataName === 'string'
        ? metadataName === observed.observedName : 'not-observed',
    } : prepared.identity;
    const ownContainerPages = containerMods.length === 0 ? empty : containerPages;
    verified.push({
      entryIndex, deviceIndex, entryName, sourceKind: source.kind, sourceIdentity,
      observed: { deviceName: observed.observedName, enabled: observed.enabled, position: deviceIndex },
      instance: source.kind === 'existing-move' ? 'preserved' : 'new',
      stateClaim: source.kind === 'existing-move'
        ? 'The same device instance moved. Opaque state was not read back byte for byte.'
        : source.kind === 'existing-copy'
          ? 'The copy is a new instance. No state-identity claim is made.'
          : 'The source created a new device instance.',
      pages, containerPages: ownContainerPages, behaviors,
      verified: hostMatches && pages.verified && ownContainerPages.verified
        && behaviors.filter((item) => item !== undefined).length === active.length
        && behaviors.every((item) => item.verified),
    });
  }
  return verified;
}

/**
 * 8h4e: a read-only preview of `reverseGeneralDeviceSources`: the same two guard reads, with no write. A later
 * reversal stage can still fail, so a pass here is not a promise that every stage completes.
 */
export async function previewGeneralDeviceReversal(
  host: GeneralDeviceCompositionHost,
  checkpoint: GeneralDeviceCompositionCheckpoint,
): Promise<{ readonly wouldWrite: boolean; readonly why?: string }> {
  try {
    const guard = await reversalGuards(host, checkpoint);
    if (guard.done) return { wouldWrite: false, why: 'The owned container is already removed and the original order reads back.' };
    return guard.why === undefined ? { wouldWrite: true } : { wouldWrite: false, why: guard.why };
  } catch (error) {
    return { wouldWrite: false, why: message(error) };
  }
}

/**
 * The reversal checks the current top level and the owned container against the checkpoint, once each. It
 * returns moved existing devices to their original positions, then removes the owned container with every new
 * and copied source in one owned removal, and reads the top level once at the end.
 */
export async function reverseGeneralDeviceSources(
  host: GeneralDeviceCompositionHost,
  checkpoint: GeneralDeviceCompositionCheckpoint,
  options: Pick<GeneralDeviceCompositionOptions, 'run'> = {},
): Promise<GeneralDeviceCompositionReversal> {
  const stages: GeneralDeviceStageReceipt[] = [];
  let progress = checkpoint;
  const failed = (stage: string, why?: string) => reversalFailure(stage, stages, why, progress);
  const run = (ops: readonly Op[], clearance?: string) => host.apply(ops, {
    ...options.run, ...(clearance === undefined ? {} : { clearance: ownChangesetReversal(clearance) }),
  }).then(({ take }) => take);
  try {
    const guard = await reversalGuards(host, checkpoint);
    if (guard.done) return { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true };
    if (guard.why !== undefined) return failed('reversal-boundary', guard.why);

    let remaining = [...(checkpoint.reversalRemainingEntries ?? checkpoint.completedEntries)];
    const restore = async (
      item: GeneralDeviceCheckpointEntry, position: number, nextRemaining: readonly GeneralDeviceCheckpointEntry[],
    ): Promise<boolean> => {
      const desired = topTokens(checkpoint.originalDeviceOrder, checkpoint.containerKind,
        checkpoint.requestedContainerPosition, nextRemaining);
      const target = desired.findIndex((entry) => entry.originalPosition === item.originalPosition);
      const current = topWithPending(checkpoint, nextRemaining, { ...item, position });
      if (target < 0) return false;
      if (target !== position) {
        const reordered = await run([{
          op: 'device.relocate', track: checkpoint.track, sourceFromEnd: current.length - 1 - position,
          expectedName: item.observedName, before: device(checkpoint.track, target),
          expectedChain: current.map((entry) => entry.name), expectedEnabledChain: current.map((entry) => entry.enabled),
        }]);
        stages.push(receipt('restore-position', reordered, item.entryIndex));
        if (!accepted(reordered)) return false;
        progress = clearReversalPending(progress, reordered.verify.at);
      } else {
        const { reversalPendingTopLevel: _pending, ...rest } = progress;
        progress = rest;
      }
      return true;
    };

    const pendingTop = progress.reversalPendingTopLevel;
    if (pendingTop !== undefined && !await restore(pendingTop, pendingTop.position, remaining)) {
      return failed('restore-position');
    }

    // Extract moved existing devices last-first, so earlier chain positions stay valid.
    const moved = [...remaining].filter((item) => item.sourceKind === 'existing-move')
      .sort((left, right) => right.entryIndex - left.entryIndex || right.deviceIndex - left.deviceIndex);
    for (const item of moved) {
      const containerAt = layout(checkpoint, remaining).container;
      const local = remaining.filter((entry) => entry.entryIndex === item.entryIndex)
        .sort((left, right) => left.deviceIndex - right.deviceIndex).indexOf(item);
      const top = topWithPending(checkpoint, remaining);
      const extracted = await run([{
        op: 'chain.relocate',
        source: deviceIn(chain(device(checkpoint.track, containerAt), item.entryName), local),
        destination: checkpoint.track, mode: 'move',
        expectedChain: top.map((entry) => entry.name), expectedEnabledChain: top.map((entry) => entry.enabled),
      }]);
      stages.push(receipt('extract-source', extracted, item.entryIndex));
      if (!accepted(extracted)) return failed('extract-source');
      remaining = remaining.filter((entry) => entry !== item);
      const position = top.length;
      progress = {
        ...progress, reversalRemainingEntries: remaining,
        reversalPendingTopLevel: { ...item, position }, lastWriteAt: minimalMark(extracted.verify.at),
      };
      if (!await restore(item, position, remaining)) return failed('restore-position');
    }

    // Every remaining device is owned: a new source or a copy. Remove them with the container.
    const containerAt = progress.state === 'container-inserted'
      ? progress.insertedContainerPosition : layout(checkpoint, []).container;
    const top = progress.state === 'container-inserted'
      ? [...checkpoint.originalDeviceOrder, { name: checkpoint.containerKind, enabled: true }]
      : topWithPending(checkpoint, []);
    const removal = await run([{
      op: 'device.delete', device: device(checkpoint.track, containerAt),
      expectedName: checkpoint.containerKind,
      expectedChain: top.map((entry) => entry.name), expectedEnabledChain: top.map((entry) => entry.enabled),
    }], checkpoint.containerInsertTakeId);
    stages.push(receipt('remove-container', removal));
    if (!accepted(removal)) return failed('remove-container');
    progress = {
      ...progress, reversalRemainingEntries: [], reversalContainerRemoved: true,
      lastWriteAt: minimalMark(removal.verify.at),
    };
    const final = await completeTop(host, checkpoint.track);
    const restored = sameOrder(final, checkpoint.originalDeviceOrder);
    return restored
      ? { complete: true, stages, containerRemoved: true, restoredDeviceOrder: true }
      : { ...failed('final-witness', 'The original top-level order did not read back after removal.'),
        containerRemoved: true };
  } catch (error) {
    return failed('reversal-boundary', message(error));
  }
}

/** The two guard reads of a reversal: the top level, then the owned container. */
async function reversalGuards(
  host: GeneralDeviceCompositionHost, checkpoint: GeneralDeviceCompositionCheckpoint,
): Promise<{ readonly done: boolean; readonly why?: string }> {
  const top = await completeTop(host, checkpoint.track);
  if (checkpoint.reversalContainerRemoved === true) {
    return sameOrder(top, checkpoint.originalDeviceOrder) ? { done: true }
      : { done: false, why: 'The owned container is removed, but the original top-level order does not read back.' };
  }
  const remaining = checkpoint.reversalRemainingEntries ?? checkpoint.completedEntries;
  const pending = checkpoint.reversalPendingTopLevel;
  const expected = checkpoint.state === 'container-inserted'
    ? [...checkpoint.originalDeviceOrder, { name: checkpoint.containerKind, enabled: true }]
    : topWithPending(checkpoint, remaining, pending);
  if (!sameOrder(top, expected)) return { done: false, why: 'The top-level device order changed.' };
  const containerAt = checkpoint.state === 'container-inserted'
    ? checkpoint.insertedContainerPosition : layout(checkpoint, remaining, pending).container;
  const exact = await exactEntries(host, device(checkpoint.track, containerAt),
    checkpoint.preparedEntryNames, remaining, checkpoint.containerKind);
  return exact ? { done: false } : { done: false, why: 'The owned container structure changed.' };
}

/** The projected top level: original order without moved devices still in the container, plus a pending one. */
function layout(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  remaining: readonly SourcePlacement[],
  pending?: GeneralDeviceCheckpointEntry & { readonly position: number },
): { readonly order: GeneralDeviceOrderItem[]; readonly container: number } {
  const tokens: { order: GeneralDeviceOrderItem; container: boolean }[] = topTokens(
    checkpoint.originalDeviceOrder, checkpoint.containerKind,
    checkpoint.requestedContainerPosition, pending === undefined ? remaining : [...remaining, pending]);
  if (pending !== undefined) {
    tokens.splice(pending.position, 0, {
      order: { name: pending.observedName, enabled: pending.enabled }, container: false,
    });
  }
  return { order: tokens.map((item) => item.order), container: tokens.findIndex((item) => item.container) };
}

function topWithPending(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  remaining: readonly SourcePlacement[],
  pending?: GeneralDeviceCheckpointEntry & { readonly position: number },
): GeneralDeviceOrderItem[] {
  return layout(checkpoint, remaining, pending).order;
}

/** One complete top-level read. The live bank itself requires equal repeated pages. */
async function completeTop(
  host: GeneralDeviceCompositionHost, track: TrackAddress,
): Promise<readonly ObservedDevice[]> {
  const bank = await host.devices(track);
  if (!bank.devicesComplete || bank.bankSize === undefined
      || bank.devices.some((item, index) => item.index !== index || item.enabled === undefined)) {
    throw new Error('the complete ordered top-level device state is not visible');
  }
  return bank.devices;
}

function sameOrder(devices: readonly ObservedDevice[], expected: readonly GeneralDeviceOrderItem[]): boolean {
  return devices.length === expected.length && devices.every((item, index) =>
    item.name === expected[index]!.name && item.enabled === expected[index]!.enabled);
}

async function stableInventory(
  host: GeneralDeviceCompositionHost, address: DeviceAddress,
  pause: (milliseconds: number) => Promise<void> = wait,
): Promise<{
  readonly at: RevisionMark;
  readonly name: string;
  readonly params: readonly ParamState[];
}> {
  const key = addressKey(address);
  let lastError: unknown;
  const settled = await settleObservation<{
    readonly at: RevisionMark;
    readonly name: string;
    readonly params: readonly ParamState[];
  }>(async () => {
    try {
      const snapshot = await host.read([address]);
      const value = snapshot.entries[key]?.value;
      if (!snapshot.unreachable.some((item) => addressKey(item) === key)
          && !snapshot.unstable.some((item) => addressKey(item) === key)
          && value?.of === 'device' && value.device.params !== undefined
          && new Set(value.device.params.map((item) => item.id)).size === value.device.params.length) {
        return {
          complete: true as const,
          value: { at: snapshot.at, name: value.device.name, params: value.device.params },
          progress: { stage: 'direct-parameters', detail: 'the complete inventory is stable' },
        };
      }
    } catch (error) {
      host.throwIfCancelled?.();
      lastError = error;
    }
    return {
      complete: false as const,
      progress: {
        stage: 'direct-parameters',
        detail: lastError === undefined ? 'the inventory is incomplete' : message(lastError),
      },
    };
  }, {
    wait: pause,
    throwIfCancelled: host.throwIfCancelled,
  });
  if (settled.complete) return settled.value;
  throw new Error(
    `the complete stable DirectParameter inventory did not settle after `
    + `${settled.report.elapsedMs} ms and ${settled.report.attempts} observations; `
    + `last progress: ${settled.report.lastProgress.detail}`,
  );
}

async function exactEntries(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  names: readonly string[],
  occupied: readonly Pick<GeneralDeviceCheckpointEntry,
  'entryIndex' | 'deviceIndex' | 'entryName' | 'observedName' | 'enabled'>[],
  containerKind: GeneralDeviceContainerKind,
): Promise<boolean> {
  const structure = await observedContainer(host, container, containerKind);
  const entries = structure === undefined ? undefined : observedEntries(structure);
  if (entries === undefined || entries.length !== names.length) return false;
  return entries.every((entry, index) => {
    const expected = occupied.filter((item) => item.entryIndex === index)
      .sort((left, right) => left.deviceIndex - right.deviceIndex);
    return entry.name === names[index] && entry.sequence.devicesComplete
      && entry.sequence.devices.length === expected.length
      && entry.sequence.devices.every((item, deviceIndex) => item.index === deviceIndex
        && item.name === expected[deviceIndex]?.observedName
        && item.enabled === expected[deviceIndex]?.enabled);
  });
}

async function observedContainer(
  host: GeneralDeviceCompositionHost,
  container: DeviceAddress,
  containerKind: GeneralDeviceContainerKind,
): Promise<ObservedContainer | undefined> {
  // 8i3 (E252): the proof compares the layer chains and their devices only. A structure read is the container scope
  // without the settled DirectParameter inventory of the container (about 0.3 s for each proof).
  const snapshot = await host.read([container], { structure: true });
  const value = snapshot.entries[addressKey(container)]?.value;
  if (value?.of !== 'device' || value.device.name !== containerKind) return undefined;
  return value.device.container;
}

function observedEntries(
  structure: ObservedContainer,
): readonly { readonly name: string; readonly sequence: ObservedDeviceSequence }[] | undefined {
  if (!structure.chainsComplete) return undefined;
  return structure.chains.map((entry) => ({ name: entry.name, sequence: entry }));
}

function assertRequest(request: GeneralDeviceCompositionRequest): void {
  if (!Number.isInteger(request.containerPosition) || request.containerPosition < 0
      || request.containerPosition > request.expectedDeviceOrder.length) {
    throw new Error('containerPosition is outside the complete top-level container scope');
  }
  if (request.entries.length < 1) throw new Error('the container needs at least one entry');
  if (request.entries.length > GENERAL_CONTAINER_SEED_ENTRIES) {
    throw new Error(`the container supports at most ${GENERAL_CONTAINER_SEED_ENTRIES} entries`);
  }
  const entryNames = request.entries.map((item) => item.entryName);
  if (new Set(entryNames).size !== entryNames.length) throw new Error('each entry name must be unique');
  // Refuse unsupported modulation before inserting the container, even if moving
  // existing sources could eventually bring it back into the parameter window.
  if (request.entries.some((entry) => entry.devices.some((item) => item.modulators.length > 0))
      && (request.entries.length > 5 || request.containerPosition >= 16
        || request.entries.some((entry) => entry.devices.length > 4))) {
    throw new Error('modulation requires the first parameter windows (16 top-level positions, 5 chains, 4 devices)');
  }
  for (const entry of request.entries) {
    if (entry.devices.length < 1) {
      throw new Error('each entry needs at least one ordered device');
    }
    for (const entryDevice of entry.devices) {
      if (entryDevice.source.kind === 'preset'
          && entryDevice.source.modulatorLocation?.kind === 'entry'
          && 1 + entryDevice.source.modulatorLocation.devicePath.length
            > GENERAL_DEVICE_COMPOSITION_CAPACITIES.parameterRouteDepth) {
        throw new Error('the total preset device route exceeds the supported depth of two');
      }
      if (entryDevice.source.kind !== 'preset'
          && entryDevice.modulators.some((item) => item.location === 'device')) {
        throw new Error('device-local modulator authoring requires an explicit preset source');
      }
      if ((entryDevice.source.kind === 'existing-move' || entryDevice.source.kind === 'existing-copy')
          && request.expectedDeviceOrder[entryDevice.source.devicePosition] === undefined) {
        throw new Error('an existing source position is missing from expectedDeviceOrder');
      }
    }
  }
  const devices = request.entries.flatMap((entry) => entry.devices);
  const moved = devices.filter((item) => item.source.kind === 'existing-move')
    .map((item) => (item.source as Extract<GeneralDeviceSourceRequest, { kind: 'existing-move' }>).devicePosition);
  if (new Set(moved).size !== moved.length) throw new Error('one existing device cannot move twice');
  const alreadyMoved = new Set<number>();
  for (const entry of devices) {
    if ((entry.source.kind === 'existing-move' || entry.source.kind === 'existing-copy')
        && alreadyMoved.has(entry.source.devicePosition)) {
      throw new Error('an existing source cannot be used again after it moves');
    }
    if (entry.source.kind === 'existing-move') alreadyMoved.add(entry.source.devicePosition);
  }
}

function currentExistingPosition(
  request: GeneralDeviceCompositionRequest,
  original: number,
  completed: readonly SourcePlacement[],
): number {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).findIndex((item) => item.originalPosition === original);
}

function projectedTop(
  request: GeneralDeviceCompositionRequest, completed: readonly SourcePlacement[],
): GeneralDeviceOrderItem[] {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).map((item) => item.order);
}

function containerPosition(
  request: GeneralDeviceCompositionRequest,
  completed: readonly SourcePlacement[],
): number {
  return topTokens(
    request.expectedDeviceOrder, request.containerKind, request.containerPosition, completed,
  ).findIndex((item) => item.container);
}

function topTokens(
  original: readonly GeneralDeviceOrderItem[],
  containerKind: GeneralDeviceContainerKind,
  requestedPosition: number,
  nested: readonly SourcePlacement[],
): { readonly order: GeneralDeviceOrderItem; readonly container: boolean; readonly originalPosition?: number }[] {
  const moved = new Set(nested.filter((item) => item.sourceKind === 'existing-move')
    .map((item) => item.originalPosition));
  const tokens: {
    order: GeneralDeviceOrderItem; container: boolean; originalPosition?: number;
  }[] = original.map((order, originalPosition) => ({ order, container: false, originalPosition }));
  tokens.splice(requestedPosition, 0, {
    order: { name: containerKind, enabled: true }, container: true,
  });
  return tokens.filter((item) => item.container || !moved.has(item.originalPosition));
}

function receipt(
  stage: GeneralDeviceStageReceipt['stage'], take: Take, entryIndex?: number,
): GeneralDeviceStageReceipt {
  return { stage, ...(entryIndex === undefined ? {} : { entryIndex }), changeId: take.id, applied: accepted(take) };
}

function accepted(take: Take): boolean {
  return take.receipt.accepted && take.report.rejected === undefined
    && take.report.failed.length === 0 && take.report.disagreements.length === 0;
}

function pageWitnesses(pages: readonly string[]): { pageName: string; expectedCount: number }[] {
  return [...new Set(pages)].map((pageName) => ({
    pageName, expectedCount: pages.filter((item) => item === pageName).length,
  }));
}

function deviceModulationWitness(
  sourceRoot: DeviceAddress,
  location: SemanticModulatorLocation | undefined,
): { readonly address: DeviceAddress; readonly expectedName?: string } {
  if (location?.kind !== 'entry') {
    return { address: sourceRoot };
  }
  const selected = location.devicePath[0];
  if (selected === undefined) return { address: sourceRoot };
  return {
    address: deviceIn(chain(sourceRoot, selected.name), selected.position),
    expectedName: selected.name,
  };
}

function failure(
  failedStage: string, why: string,
  stages: readonly GeneralDeviceStageReceipt[], entries: readonly GeneralDeviceEntryVerification[],
  checkpoint?: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceCompositionResult {
  return {
    complete: false, failedStage, why, stages, entries,
    capacities: GENERAL_DEVICE_COMPOSITION_CAPACITIES,
    ...(checkpoint === undefined ? {} : { checkpoint }),
  };
}

function reversalFailure(
  failedStage: string, stages: readonly GeneralDeviceStageReceipt[],
  why = 'The guarded reversal stage was not proved.',
  checkpoint?: GeneralDeviceCompositionCheckpoint,
): GeneralDeviceCompositionReversal {
  return {
    complete: false, failedStage, why, stages,
    containerRemoved: checkpoint?.reversalContainerRemoved === true,
    restoredDeviceOrder: false,
    ...(checkpoint === undefined ? {} : { checkpoint }),
  };
}

function clearReversalPending(
  checkpoint: GeneralDeviceCompositionCheckpoint,
  at: RevisionMark,
): GeneralDeviceCompositionCheckpoint {
  const { reversalPendingTopLevel: _pending, ...rest } = checkpoint;
  return { ...rest, lastWriteAt: minimalMark(at) };
}

function uniqueTemporaryNames(names: readonly string[], count: number): string[] {
  const reserved = new Set(names);
  return Array.from({ length: count }, (_, index) => {
    let name = `ghostnote pending general entry ${index + 1}`;
    while (reserved.has(name)) name += ' pending';
    reserved.add(name);
    return name;
  });
}

function minimalMark(mark: RevisionMark): GeneralDeviceCompositionCheckpoint['lastWriteAt'] {
  return { revision: mark.revision, generation: mark.generation, project: mark.project };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
