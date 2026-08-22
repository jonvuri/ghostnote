/**
 * A checkpointed top-level FX-chain workflow.
 *
 * Each insert runs before its dependent scalar writes. The receipt supplies the
 * only address those writes may use. Complete chain readings guard every later
 * structural step and every automatic removal.
 */
import {
  addressKey, device, deviceEnabled, param,
  type Address, type DeviceAddress, type DeviceSource, type ObservedDevice,
  type ObservedDeviceBank, type Op, type ParamAddress, type ParamState,
  type RevisionMark, type Snapshot, type TrackAddress,
} from '../contract/index.js';
import type { RunOptions } from './executor.js';
import { ownChangesetReversal } from './floor.js';
import type { Take } from './take.js';

const VALUE_TOLERANCE = 2e-3;

/** The small host seam. A Workspace satisfies it without exposing its executor. */
export interface ManagedFxChainHost {
  devices(track: TrackAddress): Promise<ObservedDeviceBank>;
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(
    ops: readonly Op[],
    options?: RunOptions,
  ): Promise<{ readonly take: Take }>;
}

export type ManagedFxParameterSetting =
  | { readonly directId: string; readonly value: number }
  | { readonly name: string; readonly value: number };

/** One device to append, tune, and then place. */
export interface ManagedFxDeviceRequest {
  /** Caller-owned logical identity. It is not a Bitwig address. */
  readonly token: string;
  readonly source: DeviceSource;
  readonly parameters?: readonly ManagedFxParameterSetting[];
  readonly enabled?: boolean;
  /** Absolute position after prior request entries have completed. Omit to append. */
  readonly position?: number;
}

/** An exact enabled change on a device that was already in the entry chain. */
export interface ManagedFxExistingEnabledRequest {
  /** Entry-chain address. The workflow follows this logical device after inserts. */
  readonly device: DeviceAddress;
  readonly expectedName: string;
  readonly enabled: boolean;
}

export interface ManagedFxChainRequest {
  readonly track: TrackAddress;
  readonly devices: readonly ManagedFxDeviceRequest[];
  readonly existingEnabled?: readonly ManagedFxExistingEnabledRequest[];
}

/** One stable and complete top-level observation. */
export interface ManagedFxChainObservation {
  readonly at: RevisionMark;
  readonly devices: readonly ObservedDevice[];
  readonly devicesComplete: true;
  readonly bankSize: number;
}

export type ManagedFxLogicalDevice =
  | { readonly owner: 'entry'; readonly entryIndex: number }
  | { readonly owner: 'inserted'; readonly token: string };

export interface ManagedFxInsertedDevice {
  readonly token: string;
  /** The append address returned by the insertion receipt. */
  readonly minted: DeviceAddress;
  /** The address proved by the final complete observation. */
  readonly current: DeviceAddress;
  readonly name: string;
  readonly insertTakeId: string;
}

export interface ManagedFxParameterCheckpoint {
  readonly kind: 'parameter';
  readonly owner: 'inserted';
  readonly token: string;
  readonly selector: ManagedFxParameterSetting;
  readonly address: ParamAddress;
  readonly before: number;
  readonly requested: number;
  readonly readback: number | undefined;
  readonly took: boolean;
  readonly takeId: string;
}

export interface ManagedFxEnabledCheckpoint {
  readonly kind: 'enabled';
  readonly owner: 'entry' | 'inserted';
  readonly token?: string;
  readonly entryIndex?: number;
  readonly expectedName: string;
  readonly address: ReturnType<typeof deviceEnabled>;
  readonly before: boolean;
  readonly requested: boolean;
  readonly readback: boolean | undefined;
  readonly took: boolean;
  readonly takeId: string;
}

export type ManagedFxScalarCheckpoint =
  | ManagedFxParameterCheckpoint
  | ManagedFxEnabledCheckpoint;

export interface ManagedFxWarning {
  readonly token: string;
  readonly parameter: string;
  readonly condition: 'modulation' | 'automation';
  readonly message: string;
}

export interface ManagedFxNonTakingWrite {
  readonly token: string;
  readonly kind: 'parameter' | 'enabled';
  readonly requested: number | boolean;
  readonly readback: number | boolean | undefined;
}

export interface ManagedFxFailedWrite {
  readonly takeId: string;
  readonly op: string;
  readonly error?: string;
}

export interface ManagedFxChainReport {
  readonly warnings: readonly ManagedFxWarning[];
  readonly nonTaking: readonly ManagedFxNonTakingWrite[];
  readonly failed: readonly ManagedFxFailedWrite[];
  readonly promises: {
    readonly insertedDevice: 'delete-current-observed-owned-position';
    readonly scalar: 'restore-entry-base-or-remove-with-owned-device';
    readonly existingDeviceDelete: 'none';
  };
}

/** The complete record needed to prove and reverse this workflow. */
export interface ManagedFxChainCheckpoint {
  readonly track: TrackAddress;
  readonly entry: ManagedFxChainObservation;
  readonly final: ManagedFxChainObservation;
  readonly entryOrder: readonly ManagedFxLogicalDevice[];
  readonly finalOrder: readonly ManagedFxLogicalDevice[];
  readonly inserted: readonly ManagedFxInsertedDevice[];
  readonly scalars: readonly ManagedFxScalarCheckpoint[];
  readonly takes: readonly Take[];
  readonly report: ManagedFxChainReport;
}

/** A last-known-safe checkpoint returned with a failed workflow. */
export interface ManagedFxChainRecovery extends ManagedFxChainCheckpoint {
  readonly failedStage: ManagedFxStage;
}

export interface ManagedFxChainReversal {
  readonly complete: true;
  readonly before: ManagedFxChainObservation;
  readonly after: ManagedFxChainObservation;
  readonly restoredScalars: readonly ManagedFxEnabledCheckpoint[];
  readonly deleted: readonly string[];
  readonly takes: readonly Take[];
}

export type ManagedFxStage =
  | 'preflight'
  | 'insert'
  | 'inventory'
  | 'scalar'
  | 'relocate'
  | 'reversal-boundary'
  | 'restore-scalar'
  | 'delete'
  | 'final-proof';

/** A fail-closed workflow refusal. Completed takes remain available to report. */
export class ManagedFxChainError extends Error {
  partial: ManagedFxChainRecovery | undefined;

  constructor(
    readonly stage: ManagedFxStage,
    message: string,
    readonly takes: readonly Take[] = [],
    partial?: ManagedFxChainRecovery,
  ) {
    super(`managed FX chain ${stage}: ${message}`);
    this.name = new.target.name;
    this.partial = partial;
  }
}

interface LogicalDeviceState {
  readonly logical: ManagedFxLogicalDevice;
  readonly name: string;
  readonly enabled?: boolean;
}

interface PendingParameter {
  readonly token: string;
  readonly selector: ManagedFxParameterSetting;
  readonly address: ParamAddress;
  readonly state: ParamState;
}

interface PendingEnabled {
  readonly owner: 'entry' | 'inserted';
  readonly token?: string;
  readonly entryIndex?: number;
  readonly expectedName: string;
  readonly address: ReturnType<typeof deviceEnabled>;
  readonly before: boolean;
  readonly requested: boolean;
}

interface ReconciledEnabledChain {
  readonly observation: ManagedFxChainObservation;
  readonly order: readonly LogicalDeviceState[];
  readonly value: boolean;
}

const insertedLogical = (token: string): ManagedFxLogicalDevice => ({ owner: 'inserted', token });
const entryLogical = (entryIndex: number): ManagedFxLogicalDevice => ({ owner: 'entry', entryIndex });

function logicalKey(value: ManagedFxLogicalDevice): string {
  return value.owner === 'entry' ? `entry:${value.entryIndex}` : `inserted:${value.token}`;
}

function copyDevice(value: ObservedDevice): ObservedDevice {
  return value.enabled === undefined
    ? { index: value.index, name: value.name }
    : { index: value.index, name: value.name, enabled: value.enabled };
}

function markEqual(a: RevisionMark, b: RevisionMark): boolean {
  return a.revision === b.revision
    && a.sceneEpoch === b.sceneEpoch
    && a.contentEpoch === b.contentEpoch
    && a.generation === b.generation
    && a.project === b.project
    && a.window.tracks.count === b.window.tracks.count
    && a.window.tracks.bankSize === b.window.tracks.bankSize
    && a.window.scenes.count === b.window.scenes.count
    && a.window.scenes.bankSize === b.window.scenes.bankSize;
}

function sameWorld(a: RevisionMark, b: RevisionMark): boolean {
  return a.generation === b.generation && a.project === b.project;
}

function deviceEqual(a: ObservedDevice, b: ObservedDevice): boolean {
  return a.index === b.index && a.name === b.name && a.enabled === b.enabled;
}

function devicesEqual(a: readonly ObservedDevice[], b: readonly ObservedDevice[]): boolean {
  return a.length === b.length && a.every((item, index) => deviceEqual(item, b[index]!));
}

function describeDevices(devices: readonly ObservedDevice[]): string {
  return `[${devices.map((item) => `${item.index}:${item.name}`).join(', ')}]`;
}

function chainFingerprint(observation: ManagedFxChainObservation): readonly string[] {
  return observation.devices.map((item) => item.name);
}

function chainEnabledFingerprint(observation: ManagedFxChainObservation): readonly boolean[] {
  return observation.devices.map((item) => {
    if (item.enabled === undefined) {
      throw new ManagedFxChainError('final-proof', 'the complete chain lost an enabled-state observation');
    }
    return item.enabled;
  });
}

function expectedDevices(order: readonly LogicalDeviceState[]): ObservedDevice[] {
  return order.map((item, index) => item.enabled === undefined
    ? { index, name: item.name }
    : { index, name: item.name, enabled: item.enabled });
}

function assertCleanSnapshot(snapshot: Snapshot, stage: ManagedFxStage): void {
  if (snapshot.unreachable.length > 0) {
    throw new ManagedFxChainError(stage, 'a required address is outside its bank window');
  }
  if (snapshot.unstable.length > 0) {
    throw new ManagedFxChainError(stage, 'a required observer inventory is unstable');
  }
}

async function stableChain(
  host: ManagedFxChainHost,
  track: TrackAddress,
  stage: ManagedFxStage,
  options: {
    readonly at?: RevisionMark;
    readonly devices?: readonly ObservedDevice[];
    readonly bankSize?: number;
  } = {},
): Promise<ManagedFxChainObservation> {
  const first = await host.read([]);
  if (options.at !== undefined && !markEqual(first.at, options.at)) {
    throw new ManagedFxChainError(stage, 'the project changed before the chain observation');
  }
  const bank = await host.devices(track);
  const second = await host.read([]);
  if (!markEqual(first.at, second.at)) {
    throw new ManagedFxChainError(stage, 'the project changed while the chain was enumerated');
  }
  if (!bank.devicesComplete) {
    throw new ManagedFxChainError(stage, 'the complete top-level device chain is not visible');
  }
  if (bank.bankSize === undefined) {
    throw new ManagedFxChainError(stage, 'the device-bank size was not observed');
  }
  const devices = bank.devices.map(copyDevice);
  if (devices.some((item, index) => item.index !== index)) {
    throw new ManagedFxChainError(stage, 'the complete chain did not report contiguous positions');
  }
  if (devices.some((item) => item.enabled === undefined)) {
    throw new ManagedFxChainError(stage, 'enabled state must be observed for every top-level device');
  }
  if (options.bankSize !== undefined && bank.bankSize !== options.bankSize) {
    throw new ManagedFxChainError(stage, 'the device-bank size changed during the workflow');
  }
  if (options.devices !== undefined && !devicesEqual(devices, options.devices)) {
    throw new ManagedFxChainError(
      stage,
      `the chain was ${describeDevices(devices)}, expected ${describeDevices(options.devices)}`,
    );
  }
  return {
    at: second.at,
    devices,
    devicesComplete: true,
    bankSize: bank.bankSize,
  };
}

/** Retry one failed structural proof without replaying its mutation. */
async function reconcileChain(
  host: ManagedFxChainHost,
  track: TrackAddress,
  stage: ManagedFxStage,
  at: RevisionMark,
  bankSize: number,
  devices?: readonly ObservedDevice[],
): Promise<ManagedFxChainObservation | undefined> {
  try {
    return await stableChain(host, track, stage, {
      at,
      bankSize,
      ...(devices === undefined ? {} : { devices }),
    });
  } catch {
    return undefined;
  }
}

function appendedDevice(
  observation: ManagedFxChainObservation,
  before: readonly ObservedDevice[],
  minted: DeviceAddress,
): ObservedDevice | undefined {
  if (observation.devices.length !== before.length + 1
      || !devicesEqual(observation.devices.slice(0, -1), before)) {
    return undefined;
  }
  const appended = observation.devices[observation.devices.length - 1];
  return appended?.index === minted.chainIndex && minted.chainIndex === before.length
    ? appended
    : undefined;
}

function topLevelMint(value: Address | undefined, track: TrackAddress): DeviceAddress | undefined {
  return value?.kind === 'device'
      && value.chain === undefined
      && value.track.channelId === track.channelId
    ? value
    : undefined;
}

async function reconcileEnabledChain(
  host: ManagedFxChainHost,
  track: TrackAddress,
  stage: ManagedFxStage,
  at: RevisionMark,
  bankSize: number,
  order: readonly LogicalDeviceState[],
  targetIndex: number,
  values: readonly boolean[],
): Promise<ReconciledEnabledChain | undefined> {
  const observation = await reconcileChain(host, track, stage, at, bankSize);
  if (observation === undefined || order[targetIndex] === undefined) return undefined;
  for (const value of new Set(values)) {
    const candidate = [...order];
    candidate[targetIndex] = { ...candidate[targetIndex]!, enabled: value };
    if (devicesEqual(observation.devices, expectedDevices(candidate))) {
      return { observation, order: candidate, value };
    }
  }
  return undefined;
}

function validateRequest(request: ManagedFxChainRequest, entry: ManagedFxChainObservation): void {
  const tokens = new Set<string>();
  request.devices.forEach((item, requestIndex) => {
    if (item.token.trim() === '' || tokens.has(item.token)) {
      throw new ManagedFxChainError('preflight', `insert token "${item.token}" is blank or duplicated`);
    }
    tokens.add(item.token);
    const lengthAfterAppend = entry.devices.length + requestIndex + 1;
    const position = item.position ?? lengthAfterAppend - 1;
    if (!Number.isInteger(position) || position < 0 || position >= lengthAfterAppend) {
      throw new ManagedFxChainError(
        'preflight',
        `position ${position} for "${item.token}" is outside 0 through ${lengthAfterAppend - 1}`,
      );
    }
    for (const setting of item.parameters ?? []) {
      if (!Number.isFinite(setting.value) || setting.value < 0 || setting.value > 1) {
        throw new ManagedFxChainError('preflight', `parameter value for "${item.token}" must be from 0 through 1`);
      }
      const direct = 'directId' in setting;
      const named = 'name' in setting;
      const selector = direct ? setting.directId : named ? setting.name : '';
      if (direct === named || selector.trim() === '') {
        throw new ManagedFxChainError('preflight', `parameter selector for "${item.token}" is invalid`);
      }
    }
  });
  if (entry.devices.length + request.devices.length > entry.bankSize) {
    throw new ManagedFxChainError(
      'preflight',
      `the complete request needs ${entry.devices.length + request.devices.length} device rows, but the bank has ${entry.bankSize}`,
    );
  }

  const enabledTargets = new Set<number>();
  for (const setting of request.existingEnabled ?? []) {
    if (setting.device.chain !== undefined
        || setting.device.track.channelId !== request.track.channelId) {
      throw new ManagedFxChainError('preflight', 'an existing enabled target must be top-level on the workflow track');
    }
    const observed = entry.devices[setting.device.chainIndex];
    if (observed?.name !== setting.expectedName) {
      throw new ManagedFxChainError(
        'preflight',
        `entry device ${setting.device.chainIndex} was "${observed?.name ?? ''}", expected "${setting.expectedName}"`,
      );
    }
    if (enabledTargets.has(setting.device.chainIndex)) {
      throw new ManagedFxChainError('preflight', `entry device ${setting.device.chainIndex} has two enabled requests`);
    }
    enabledTargets.add(setting.device.chainIndex);
  }
}

function requireAccepted(take: Take, stage: ManagedFxStage, takes: readonly Take[]): void {
  if (!take.receipt.accepted || take.report.rejected !== undefined) {
    throw new ManagedFxChainError(stage, 'the revision guard rejected the write', [...takes, take]);
  }
}

function requireStructural(take: Take, stage: ManagedFxStage, takes: readonly Take[]): void {
  requireAccepted(take, stage, takes);
  if (take.report.failed.length > 0 || take.report.disagreements.length > 0) {
    throw new ManagedFxChainError(stage, 'structural readback did not prove the requested change', [...takes, take]);
  }
}

async function applyAt(
  host: ManagedFxChainHost,
  ops: readonly Op[],
  at: RevisionMark,
  stage: ManagedFxStage,
  options: Omit<RunOptions, 'ifRevision'> = {},
): Promise<Take> {
  let result: { readonly take: Take };
  try {
    result = await host.apply(ops, { ...options, ifRevision: at.revision });
  } catch (error) {
    throw new ManagedFxChainError(
      stage,
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!sameWorld(at, result.take.receipt.at)) {
    throw new ManagedFxChainError(stage, 'the project identity changed during a write', [result.take]);
  }
  return result.take;
}

function snapshotEntry(snapshot: Snapshot, address: Address, stage: ManagedFxStage) {
  assertCleanSnapshot(snapshot, stage);
  const entry = snapshot.entries[addressKey(address)];
  if (entry === undefined) {
    throw new ManagedFxChainError(stage, 'a required address was not present in independent readback');
  }
  return entry;
}

function resolveParameters(
  token: string,
  at: DeviceAddress,
  settings: readonly ManagedFxParameterSetting[],
  state: readonly ParamState[],
): PendingParameter[] {
  const resolved: PendingParameter[] = [];
  const addresses = new Set<string>();
  for (const selector of settings) {
    const matches = 'directId' in selector
      ? state.filter((candidate) => candidate.id === selector.directId)
      : state.filter((candidate) => candidate.name === selector.name);
    if (matches.length !== 1) {
      const name = 'directId' in selector ? selector.directId : selector.name;
      throw new ManagedFxChainError(
        'inventory',
        `parameter selector "${name}" on "${token}" matched ${matches.length} controls`,
      );
    }
    const address = param(at, matches[0]!.id);
    const key = addressKey(address);
    if (addresses.has(key)) {
      throw new ManagedFxChainError('inventory', `two settings on "${token}" resolve to the same parameter`);
    }
    addresses.add(key);
    resolved.push({ token, selector, address, state: matches[0]! });
  }
  return resolved;
}

function warningsOf(parameter: PendingParameter): ManagedFxWarning[] {
  const warnings: ManagedFxWarning[] = [];
  const state = parameter.state;
  if (state.observed.modulatedValue && state.modulatedValue !== undefined
      && Math.abs(state.modulatedValue - state.value) > 1e-9) {
    warnings.push({
      token: parameter.token,
      parameter: state.name,
      condition: 'modulation',
      message: 'the observed modulated value differs from the stored base value',
    });
  }
  if (state.observed.hasAutomation && state.hasAutomation === true) {
    warnings.push({
      token: parameter.token,
      parameter: state.name,
      condition: 'automation',
      message: 'host automation can override the static base-value write',
    });
  }
  return warnings;
}

function addWarnings(
  target: ManagedFxWarning[],
  additions: readonly ManagedFxWarning[],
): void {
  for (const warning of additions) {
    if (!target.some((item) => item.token === warning.token
        && item.parameter === warning.parameter
        && item.condition === warning.condition)) {
      target.push(warning);
    }
  }
}

function failedOf(take: Take): ManagedFxFailedWrite[] {
  return take.report.failed.map((failure) => ({
    takeId: take.id,
    op: failure.op,
    ...(failure.error === undefined ? {} : { error: failure.error }),
  }));
}

function updateEnabledCheckpoint(
  scalars: ManagedFxScalarCheckpoint[],
  scalarStart: number,
  nonTaking: ManagedFxNonTakingWrite[],
  nonTakingStart: number,
  pending: PendingEnabled,
  value: boolean,
  takeId: string,
  reportToken: string,
  record: boolean,
): void {
  const recordedAt = scalars.findIndex((item, index) => index >= scalarStart
    && item.kind === 'enabled' && item.takeId === takeId);
  if (recordedAt >= 0) scalars.splice(recordedAt, 1);
  for (let index = nonTaking.length - 1; index >= nonTakingStart; index--) {
    const item = nonTaking[index]!;
    if (item.kind === 'enabled' && item.token === reportToken) nonTaking.splice(index, 1);
  }
  if (!record) return;
  const took = value === pending.requested;
  scalars.push({
    kind: 'enabled',
    ...pending,
    readback: value,
    took,
    takeId,
  });
  if (!took) nonTaking.push({
    token: reportToken,
    kind: 'enabled',
    requested: pending.requested,
    readback: value,
  });
}

function currentAddress(track: TrackAddress, order: readonly LogicalDeviceState[], logical: ManagedFxLogicalDevice) {
  const key = logicalKey(logical);
  const index = order.findIndex((candidate) => logicalKey(candidate.logical) === key);
  if (index < 0) throw new ManagedFxChainError('final-proof', `logical device ${key} is absent`);
  return device(track, index);
}

function completedInserts(
  track: TrackAddress,
  final: ManagedFxChainObservation,
  finalOrder: readonly ManagedFxLogicalDevice[],
  inserted: readonly Omit<ManagedFxInsertedDevice, 'current'>[],
): ManagedFxInsertedDevice[] {
  return inserted.map((item) => {
    const matches = finalOrder
      .map((logical, index) => ({ logical, index }))
      .filter((candidate) => candidate.logical.owner === 'inserted'
        && candidate.logical.token === item.token);
    if (matches.length !== 1) {
      throw new ManagedFxChainError('final-proof', `inserted token "${item.token}" is not unique in the final order`);
    }
    const index = matches[0]!.index;
    if (final.devices[index]?.name !== item.name) {
      throw new ManagedFxChainError('final-proof', `inserted token "${item.token}" disagrees with final chain readback`);
    }
    return { ...item, current: device(track, index) };
  });
}

function recoveryOf(
  stage: ManagedFxStage,
  track: TrackAddress,
  entry: ManagedFxChainObservation,
  current: ManagedFxChainObservation,
  order: readonly LogicalDeviceState[],
  inserted: readonly Omit<ManagedFxInsertedDevice, 'current'>[],
  scalars: readonly ManagedFxScalarCheckpoint[],
  takes: readonly Take[],
  warnings: readonly ManagedFxWarning[],
  nonTaking: readonly ManagedFxNonTakingWrite[],
  failed: readonly ManagedFxFailedWrite[],
): ManagedFxChainRecovery | undefined {
  const devices = expectedDevices(order);
  if (!devicesEqual(current.devices, devices)) return undefined;
  const finalOrder = order.map((item) => item.logical);
  return {
    failedStage: stage,
    track,
    entry,
    final: current,
    entryOrder: entry.devices.map((_, index) => entryLogical(index)),
    finalOrder,
    inserted: completedInserts(track, current, finalOrder, inserted),
    scalars,
    takes,
    report: {
      warnings,
      nonTaking,
      failed,
      promises: {
        insertedDevice: 'delete-current-observed-owned-position',
        scalar: 'restore-entry-base-or-remove-with-owned-device',
        existingDeviceDelete: 'none',
      },
    },
  };
}

/** Build, tune, place, and checkpoint a complete top-level device chain. */
export async function buildManagedFxChain(
  host: ManagedFxChainHost,
  request: ManagedFxChainRequest,
): Promise<ManagedFxChainCheckpoint> {
  const entry = await stableChain(host, request.track, 'preflight');
  validateRequest(request, entry);

  const order: LogicalDeviceState[] = entry.devices.map((item, entryIndex) => ({
    logical: entryLogical(entryIndex),
    name: item.name,
    ...(item.enabled === undefined ? {} : { enabled: item.enabled }),
  }));
  const takes: Take[] = [];
  const inserted: Array<Omit<ManagedFxInsertedDevice, 'current'>> = [];
  const scalars: ManagedFxScalarCheckpoint[] = [];
  const warnings: ManagedFxWarning[] = [];
  const nonTaking: ManagedFxNonTakingWrite[] = [];
  const failed: ManagedFxFailedWrite[] = [];
  let current = entry;

  try {
    for (const spec of request.devices) {
      const insertTake = await applyAt(host, [{
        op: 'device.insert',
        track: request.track,
        source: spec.source,
        expectedChain: chainFingerprint(current),
        expectedEnabledChain: chainEnabledFingerprint(current),
      }], current.at, 'insert');
      const minted = insertTake.receipt.minted[0];
      const oldDevices = expectedDevices(order);
      const mintedDevice = topLevelMint(minted, request.track);
      let afterInsert: ManagedFxChainObservation;
      let observed: ObservedDevice;
      try {
        requireStructural(insertTake, 'insert', takes);
        takes.push(insertTake);
        if (mintedDevice === undefined) {
          throw new ManagedFxChainError(
            'insert',
            `insert "${spec.token}" did not return a top-level minted address`,
            takes,
          );
        }

        afterInsert = await stableChain(host, request.track, 'insert', {
          at: insertTake.receipt.at,
          bankSize: entry.bankSize,
        });
        if (afterInsert.devices.length !== oldDevices.length + 1
            || !devicesEqual(afterInsert.devices.slice(0, -1), oldDevices)) {
          throw new ManagedFxChainError('insert', `insert "${spec.token}" did not preserve the prior chain prefix`, takes);
        }
        observed = afterInsert.devices[afterInsert.devices.length - 1]!;
        if (mintedDevice.chainIndex !== observed.index) {
          throw new ManagedFxChainError('insert', `insert "${spec.token}" mint disagreed with full chain readback`, takes);
        }
      } catch (error) {
        if (insertTake.receipt.accepted && insertTake.report.rejected === undefined) {
          const reconciled = await reconcileChain(
            host,
            request.track,
            'insert',
            insertTake.receipt.at,
            entry.bankSize,
          );
          const appended = reconciled === undefined || mintedDevice === undefined
            ? undefined
            : appendedDevice(reconciled, oldDevices, mintedDevice);
          if (reconciled !== undefined && devicesEqual(reconciled.devices, oldDevices)) {
            current = reconciled;
          } else if (reconciled !== undefined && appended !== undefined && mintedDevice !== undefined) {
            const logical = insertedLogical(spec.token);
            order.push({
              logical,
              name: appended.name,
              ...(appended.enabled === undefined ? {} : { enabled: appended.enabled }),
            });
            inserted.push({
              token: spec.token,
              minted: mintedDevice,
              name: appended.name,
              insertTakeId: insertTake.id,
            });
            current = reconciled;
          }
        }
        throw error;
      }
      if (mintedDevice === undefined) {
        throw new ManagedFxChainError('insert', `insert "${spec.token}" lost its proved minted address`, takes);
      }
      const logical = insertedLogical(spec.token);
      order.push({
        logical,
        name: observed.name,
        ...(observed.enabled === undefined ? {} : { enabled: observed.enabled }),
      });
      inserted.push({ token: spec.token, minted: mintedDevice, name: observed.name, insertTakeId: insertTake.id });
      current = afterInsert;

      const settings = spec.parameters ?? [];
      if (settings.length > 0 || spec.enabled !== undefined) {
        const enabledAddress = deviceEnabled(mintedDevice);
        const reads: Address[] = [mintedDevice, ...(spec.enabled === undefined ? [] : [enabledAddress])];
        const inventory = await host.read(reads);
        if (!markEqual(inventory.at, current.at)) {
          throw new ManagedFxChainError('inventory', `the project changed before "${spec.token}" was inventoried`, takes);
        }
        const deviceEntry = snapshotEntry(inventory, mintedDevice, 'inventory');
        if (deviceEntry.value.of !== 'device' || deviceEntry.value.device.params === undefined) {
          throw new ManagedFxChainError('inventory', `device "${spec.token}" has no stable parameter inventory`, takes);
        }
        const parameters = resolveParameters(spec.token, mintedDevice, settings, deviceEntry.value.device.params);
        addWarnings(warnings, parameters.flatMap(warningsOf));

        let pendingEnabled: PendingEnabled | undefined;
        if (spec.enabled !== undefined) {
          const enabledEntry = snapshotEntry(inventory, enabledAddress, 'inventory');
          if (enabledEntry.value.of !== 'deviceEnabled') {
            throw new ManagedFxChainError('inventory', `device "${spec.token}" enabled state was not readable`, takes);
          }
          pendingEnabled = {
            owner: 'inserted',
            token: spec.token,
            expectedName: observed.name,
            address: enabledAddress,
            before: enabledEntry.value.enabled,
            requested: spec.enabled,
          };
        }

        const ops: Op[] = [
          ...parameters.map((setting): Op => ({
            op: 'param.set',
            param: setting.address,
            value: setting.selector.value,
            expectedName: observed.name,
            expectedChain: chainFingerprint(current),
            expectedEnabledChain: chainEnabledFingerprint(current),
          })),
          ...(pendingEnabled === undefined ? [] : [{
            op: 'device.setEnabled' as const,
            device: mintedDevice,
            enabled: pendingEnabled.requested,
            expectedName: pendingEnabled.expectedName,
            expectedEnabled: pendingEnabled.before,
            expectedChain: chainFingerprint(current),
            expectedEnabledChain: chainEnabledFingerprint(current),
          }]),
        ];
        const scalarTake = await applyAt(host, ops, current.at, 'scalar');
        const scalarStart = scalars.length;
        const nonTakingStart = nonTaking.length;
        const enabledGuardFailed = scalarTake.report.failed.some((item) =>
          item.op === 'device.setEnabled' && /enabled(?: state| chain) changed/i.test(item.error ?? ''));
        try {
          requireAccepted(scalarTake, 'scalar', takes);
          takes.push(scalarTake);
          failed.push(...failedOf(scalarTake));
          if (enabledGuardFailed) {
            throw new ManagedFxChainError('scalar', 'the enabled-state guard refused the write', takes);
          }

          const scalarAddresses: Address[] = [
            ...parameters.map((item) => item.address),
            ...(pendingEnabled === undefined ? [] : [pendingEnabled.address]),
          ];
          const readback = await host.read(scalarAddresses);
          if (!markEqual(readback.at, scalarTake.receipt.at)) {
            throw new ManagedFxChainError('scalar', `the project changed before "${spec.token}" scalar readback`, takes);
          }
          assertCleanSnapshot(readback, 'scalar');
          for (const setting of parameters) {
            const entry = readback.entries[addressKey(setting.address)];
            const value = entry?.value.of === 'param' ? entry.value.param.value : undefined;
            if (entry?.value.of === 'param') {
              addWarnings(warnings, warningsOf({ ...setting, state: entry.value.param }));
            }
            const took = value !== undefined && Math.abs(value - setting.selector.value) <= VALUE_TOLERANCE;
            const checkpoint: ManagedFxParameterCheckpoint = {
              kind: 'parameter',
              owner: 'inserted',
              token: setting.token,
              selector: setting.selector,
              address: setting.address,
              before: setting.state.value,
              requested: setting.selector.value,
              readback: value,
              took,
              takeId: scalarTake.id,
            };
            scalars.push(checkpoint);
            if (!took) nonTaking.push({
              token: setting.token,
              kind: 'parameter',
              requested: setting.selector.value,
              readback: value,
            });
          }
          if (pendingEnabled !== undefined) {
            const enabledEntry = readback.entries[addressKey(pendingEnabled.address)];
            const value = enabledEntry?.value.of === 'deviceEnabled' ? enabledEntry.value.enabled : undefined;
            const took = value === pendingEnabled.requested;
            scalars.push({
              kind: 'enabled',
              ...pendingEnabled,
              readback: value,
              took,
              takeId: scalarTake.id,
            });
            if (!took) nonTaking.push({
              token: spec.token,
              kind: 'enabled',
              requested: pendingEnabled.requested,
              readback: value,
            });
            const nextOrder = [...order];
            const item = nextOrder[nextOrder.length - 1]!;
            if (item.enabled !== undefined && value !== undefined) {
              nextOrder[nextOrder.length - 1] = { ...item, enabled: value };
            }
            const next = await stableChain(host, request.track, 'scalar', {
              at: scalarTake.receipt.at,
              devices: expectedDevices(nextOrder),
              bankSize: entry.bankSize,
            });
            order.splice(0, order.length, ...nextOrder);
            current = next;
          } else {
            current = await stableChain(host, request.track, 'scalar', {
              at: scalarTake.receipt.at,
              devices: expectedDevices(order),
              bankSize: entry.bankSize,
            });
          }
        } catch (error) {
          if (scalarTake.receipt.accepted && scalarTake.report.rejected === undefined) {
            const targetIndex = order.length - 1;
            if (pendingEnabled === undefined) {
              const reconciled = await reconcileChain(
                host, request.track, 'scalar', scalarTake.receipt.at, entry.bankSize,
                expectedDevices(order),
              );
              if (reconciled !== undefined) current = reconciled;
            } else {
              const reconciled = await reconcileEnabledChain(
                host,
                request.track,
                'scalar',
                scalarTake.receipt.at,
                entry.bankSize,
                order,
                targetIndex,
                enabledGuardFailed
                  ? [false, true]
                  : [pendingEnabled.before, pendingEnabled.requested],
              );
              if (reconciled !== undefined) {
                order.splice(0, order.length, ...reconciled.order);
                current = reconciled.observation;
                updateEnabledCheckpoint(
                  scalars,
                  scalarStart,
                  nonTaking,
                  nonTakingStart,
                  pendingEnabled,
                  reconciled.value,
                  scalarTake.id,
                  spec.token,
                  !enabledGuardFailed,
                );
              }
            }
          }
          throw error;
        }
      }

      const appendIndex = order.length - 1;
      const position = spec.position ?? appendIndex;
      if (position !== appendIndex) {
        const nextOrder = [...order];
        const moved = nextOrder.pop()!;
        nextOrder.splice(position, 0, moved);
        const relocateTake = await applyAt(host, [{
          op: 'device.relocate',
          track: request.track,
          sourceFromEnd: 0,
          expectedName: observed.name,
          before: device(request.track, position),
          expectedChain: chainFingerprint(current),
          expectedEnabledChain: chainEnabledFingerprint(current),
        }], current.at, 'relocate');
        let next: ManagedFxChainObservation;
        try {
          requireStructural(relocateTake, 'relocate', takes);
          takes.push(relocateTake);
          next = await stableChain(host, request.track, 'relocate', {
            at: relocateTake.receipt.at,
            devices: expectedDevices(nextOrder),
            bankSize: entry.bankSize,
          });
        } catch (error) {
          if (relocateTake.receipt.accepted && relocateTake.report.rejected === undefined) {
            const reconciled = await reconcileChain(
              host,
              request.track,
              'relocate',
              relocateTake.receipt.at,
              entry.bankSize,
            );
            if (reconciled !== undefined
                && devicesEqual(reconciled.devices, expectedDevices(nextOrder))) {
              order.splice(0, order.length, ...nextOrder);
              current = reconciled;
            } else if (reconciled !== undefined
                && devicesEqual(reconciled.devices, expectedDevices(order))) {
              current = reconciled;
            }
          }
          throw error;
        }
        order.splice(0, order.length, ...nextOrder);
        current = next;
      }
    }

    for (const setting of request.existingEnabled ?? []) {
      const logical = entryLogical(setting.device.chainIndex);
      const at = currentAddress(request.track, order, logical);
      const address = deviceEnabled(at);
      const beforeRead = await host.read([address]);
      if (!markEqual(beforeRead.at, current.at)) {
        throw new ManagedFxChainError('scalar', 'the project changed before an existing enabled checkpoint', takes);
      }
      const entryValue = snapshotEntry(beforeRead, address, 'scalar');
      if (entryValue.value.of !== 'deviceEnabled') {
        throw new ManagedFxChainError('scalar', `enabled state for "${setting.expectedName}" was not readable`, takes);
      }
      const pending: PendingEnabled = {
        owner: 'entry',
        entryIndex: setting.device.chainIndex,
        expectedName: setting.expectedName,
        address,
        before: entryValue.value.enabled,
        requested: setting.enabled,
      };
      const orderIndex = order.findIndex((item) => logicalKey(item.logical) === logicalKey(logical));
      const take = await applyAt(host, [{
        op: 'device.setEnabled',
        device: at,
        enabled: setting.enabled,
        expectedName: setting.expectedName,
        expectedEnabled: pending.before,
        expectedChain: chainFingerprint(current),
        expectedEnabledChain: chainEnabledFingerprint(current),
      }], current.at, 'scalar');
      const scalarStart = scalars.length;
      const nonTakingStart = nonTaking.length;
      const enabledGuardFailed = take.report.failed.some((item) =>
        item.op === 'device.setEnabled' && /enabled(?: state| chain) changed/i.test(item.error ?? ''));
      try {
        requireAccepted(take, 'scalar', takes);
        takes.push(take);
        failed.push(...failedOf(take));
        if (enabledGuardFailed) {
          throw new ManagedFxChainError('scalar', 'the enabled-state guard refused the write', takes);
        }
        const afterRead = await host.read([address]);
        if (!markEqual(afterRead.at, take.receipt.at)) {
          throw new ManagedFxChainError('scalar', `the project changed before "${setting.expectedName}" enabled readback`, takes);
        }
        const afterValue = afterRead.entries[addressKey(address)]?.value;
        const value = afterValue?.of === 'deviceEnabled' ? afterValue.enabled : undefined;
        const took = value === setting.enabled;
        const checkpoint: ManagedFxEnabledCheckpoint = {
          kind: 'enabled',
          ...pending,
          readback: value,
          took,
          takeId: take.id,
        };
        scalars.push(checkpoint);
        if (!took) nonTaking.push({
          token: `entry:${setting.device.chainIndex}`,
          kind: 'enabled',
          requested: setting.enabled,
          readback: value,
        });
        const nextOrder = [...order];
        const item = nextOrder[orderIndex]!;
        if (item.enabled !== undefined && value !== undefined) nextOrder[orderIndex] = { ...item, enabled: value };
        const next = await stableChain(host, request.track, 'scalar', {
          at: take.receipt.at,
          devices: expectedDevices(nextOrder),
          bankSize: entry.bankSize,
        });
        order.splice(0, order.length, ...nextOrder);
        current = next;
      } catch (error) {
        if (take.receipt.accepted && take.report.rejected === undefined) {
          const reconciled = await reconcileEnabledChain(
            host,
            request.track,
            'scalar',
            take.receipt.at,
            entry.bankSize,
            order,
            orderIndex,
            enabledGuardFailed ? [false, true] : [pending.before, pending.requested],
          );
          if (reconciled !== undefined) {
            order.splice(0, order.length, ...reconciled.order);
            current = reconciled.observation;
            updateEnabledCheckpoint(
              scalars,
              scalarStart,
              nonTaking,
              nonTakingStart,
              pending,
              reconciled.value,
              take.id,
              `entry:${setting.device.chainIndex}`,
              !enabledGuardFailed,
            );
          }
        }
        throw error;
      }
    }

    const final = await stableChain(host, request.track, 'final-proof', {
      at: current.at,
      devices: expectedDevices(order),
      bankSize: entry.bankSize,
    });
    const finalOrder = order.map((item) => item.logical);
    const completeInserted = completedInserts(request.track, final, finalOrder, inserted);
    return {
      track: request.track,
      entry,
      final,
      entryOrder: entry.devices.map((_, index) => entryLogical(index)),
      finalOrder,
      inserted: completeInserted,
      scalars,
      takes,
      report: {
        warnings,
        nonTaking,
        failed,
        promises: {
          insertedDevice: 'delete-current-observed-owned-position',
          scalar: 'restore-entry-base-or-remove-with-owned-device',
          existingDeviceDelete: 'none',
        },
      },
    };
  } catch (error) {
    const stage = error instanceof ManagedFxChainError ? error.stage : 'final-proof';
    const errorTakes = error instanceof ManagedFxChainError ? error.takes : [];
    const allTakes = [...takes];
    for (const take of errorTakes) {
      if (!allTakes.some((candidate) => candidate.id === take.id)) allTakes.push(take);
    }
    const partial = inserted.length === 0 && scalars.length === 0 ? undefined : recoveryOf(
      stage, request.track, entry, current, order, inserted, scalars,
      allTakes, warnings, nonTaking, failed,
    );
    if (error instanceof ManagedFxChainError) {
      const prefix = `managed FX chain ${error.stage}: `;
      const detail = error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : error.message;
      throw new ManagedFxChainError(
        error.stage,
        detail,
        allTakes,
        error.partial ?? partial,
      );
    }
    throw new ManagedFxChainError(stage, error instanceof Error ? error.message : String(error), allTakes, partial);
  }
}

function finalLogicalState(checkpoint: ManagedFxChainCheckpoint): LogicalDeviceState[] {
  if (checkpoint.finalOrder.length !== checkpoint.final.devices.length) {
    throw new ManagedFxChainError('reversal-boundary', 'the checkpoint final order is incomplete');
  }
  const validated = completedInserts(
    checkpoint.track, checkpoint.final, checkpoint.finalOrder, checkpoint.inserted,
  );
  for (const item of validated) {
    const recorded = checkpoint.inserted.find((candidate) => candidate.token === item.token);
    if (recorded?.current.chainIndex !== item.current.chainIndex) {
      throw new ManagedFxChainError('reversal-boundary', `inserted token "${item.token}" has a stale current address`);
    }
  }
  return checkpoint.finalOrder.map((logical, index) => {
    const observed = checkpoint.final.devices[index]!;
    return {
      logical,
      name: observed.name,
      ...(observed.enabled === undefined ? {} : { enabled: observed.enabled }),
    };
  });
}

async function assertSurvivingScalars(
  host: ManagedFxChainHost,
  checkpoint: ManagedFxChainCheckpoint,
  order: readonly LogicalDeviceState[],
  at: RevisionMark,
): Promise<void> {
  const surviving = checkpoint.scalars.filter(
    (item): item is ManagedFxEnabledCheckpoint => item.kind === 'enabled' && item.owner === 'entry',
  );
  if (surviving.length === 0) return;
  const addresses = surviving.map((item) => deviceEnabled(currentAddress(
    checkpoint.track,
    order,
    entryLogical(item.entryIndex!),
  )));
  const snapshot = await host.read(addresses);
  if (!markEqual(snapshot.at, at)) {
    throw new ManagedFxChainError('reversal-boundary', 'the project changed while scalar boundaries were read');
  }
  assertCleanSnapshot(snapshot, 'reversal-boundary');
  surviving.forEach((item, index) => {
    const value = snapshot.entries[addressKey(addresses[index]!)!]?.value;
    const current = value?.of === 'deviceEnabled' ? value.enabled : undefined;
    if (current !== item.readback) {
      throw new ManagedFxChainError(
        'reversal-boundary',
        `enabled state for entry device ${item.entryIndex} changed after the checkpoint`,
      );
    }
  });
}

/** Build a retryable checkpoint from the last fully proved reversal state. */
function reversalContinuation(
  checkpoint: ManagedFxChainCheckpoint,
  failedStage: ManagedFxStage,
  current: ManagedFxChainObservation,
  order: readonly LogicalDeviceState[],
  scalars: readonly ManagedFxScalarCheckpoint[],
): ManagedFxChainRecovery {
  const finalOrder = order.map((item) => item.logical);
  const remainingTokens = new Set(finalOrder.flatMap((item) =>
    item.owner === 'inserted' ? [item.token] : []));
  const remainingInserted = checkpoint.inserted.filter((item) => remainingTokens.has(item.token));
  const remainingScalars = scalars.filter((item) =>
    item.owner === 'entry' || (item.token !== undefined && remainingTokens.has(item.token)));
  return {
    ...checkpoint,
    failedStage,
    final: current,
    finalOrder,
    inserted: completedInserts(
      checkpoint.track,
      current,
      finalOrder,
      remainingInserted,
    ),
    scalars: remainingScalars,
  };
}

/** Reverse one managed chain without using stale append addresses. */
export async function reverseManagedFxChain(
  host: ManagedFxChainHost,
  checkpoint: ManagedFxChainCheckpoint,
): Promise<ManagedFxChainReversal> {
  const takes: Take[] = [];
  let lastProved: ManagedFxChainCheckpoint | undefined;
  try {
    const order = finalLogicalState(checkpoint);
    let current = await stableChain(host, checkpoint.track, 'reversal-boundary', {
      devices: checkpoint.final.devices,
      bankSize: checkpoint.final.bankSize,
    });
    await assertSurvivingScalars(host, checkpoint, order, current.at);
    current = await stableChain(host, checkpoint.track, 'reversal-boundary', {
      at: current.at,
      devices: expectedDevices(order),
      bankSize: checkpoint.final.bankSize,
    });
    lastProved = reversalContinuation(
      checkpoint,
      'reversal-boundary',
      current,
      order,
      checkpoint.scalars,
    );

    const restoredScalars: ManagedFxEnabledCheckpoint[] = [];
    let remainingScalars = [...checkpoint.scalars];
    const surviving = checkpoint.scalars.filter(
      (item): item is ManagedFxEnabledCheckpoint => item.kind === 'enabled' && item.owner === 'entry',
    );
    for (const scalar of surviving) {
      const nextRemainingScalars = remainingScalars.filter((item) => item !== scalar);
      if (scalar.readback === scalar.before) {
        remainingScalars = nextRemainingScalars;
        lastProved = reversalContinuation(
          checkpoint,
          'restore-scalar',
          current,
          order,
          remainingScalars,
        );
        continue;
      }
      const logical = entryLogical(scalar.entryIndex!);
      const at = currentAddress(checkpoint.track, order, logical);
      const index = order.findIndex((item) => logicalKey(item.logical) === logicalKey(logical));
      const expectedEnabled = order[index]?.enabled;
      if (expectedEnabled === undefined) {
        throw new ManagedFxChainError('restore-scalar', 'the enabled restore has no proved prior state', takes);
      }
      const nextOrder = [...order];
      nextOrder[index] = { ...nextOrder[index]!, enabled: scalar.before };
      const take = await applyAt(host, [{
        op: 'device.setEnabled',
        device: at,
        enabled: scalar.before,
        expectedName: scalar.expectedName,
        expectedEnabled,
        expectedChain: chainFingerprint(current),
        expectedEnabledChain: chainEnabledFingerprint(current),
      }], current.at, 'restore-scalar', { clearance: ownChangesetReversal(scalar.takeId) });
      try {
        requireAccepted(take, 'restore-scalar', takes);
        takes.push(take);
        const address = deviceEnabled(at);
        const readback = await host.read([address]);
        if (!markEqual(readback.at, take.receipt.at)) {
          throw new ManagedFxChainError('restore-scalar', 'the project changed before scalar restore readback', takes);
        }
        const value = readback.entries[addressKey(address)]?.value;
        if (value?.of !== 'deviceEnabled' || value.enabled !== scalar.before) {
          throw new ManagedFxChainError('restore-scalar', 'an exact enabled restore did not take', takes);
        }
        const next = await stableChain(host, checkpoint.track, 'restore-scalar', {
          at: take.receipt.at,
          devices: expectedDevices(nextOrder),
          bankSize: checkpoint.entry.bankSize,
        });
        order.splice(0, order.length, ...nextOrder);
        current = next;
        remainingScalars = nextRemainingScalars;
        restoredScalars.push(scalar);
        lastProved = reversalContinuation(
          checkpoint,
          'restore-scalar',
          current,
          order,
          remainingScalars,
        );
      } catch (error) {
        if (take.receipt.accepted && take.report.rejected === undefined) {
          const reconciled = await reconcileEnabledChain(
            host,
            checkpoint.track,
            'restore-scalar',
            take.receipt.at,
            checkpoint.entry.bankSize,
            order,
            index,
            [expectedEnabled, scalar.before],
          );
          if (reconciled !== undefined) {
            order.splice(0, order.length, ...reconciled.order);
            current = reconciled.observation;
            if (reconciled.value === scalar.before) {
              remainingScalars = nextRemainingScalars;
              restoredScalars.push(scalar);
            }
            lastProved = reversalContinuation(
              checkpoint,
              'restore-scalar',
              current,
              order,
              remainingScalars,
            );
          }
        }
        throw error;
      }
    }

    const byToken = new Map(checkpoint.inserted.map((item) => [item.token, item]));
    const removalTokens = order
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.logical.owner === 'inserted')
      .sort((a, b) => b.index - a.index)
      .map((entry) => (entry.item.logical as Extract<ManagedFxLogicalDevice, { owner: 'inserted' }>).token);
    const deleted: string[] = [];
    for (const token of removalTokens) {
      const logical = insertedLogical(token);
      const index = order.findIndex((item) => logicalKey(item.logical) === logicalKey(logical));
      const owned = byToken.get(token);
      if (index < 0 || owned === undefined) {
        throw new ManagedFxChainError('delete', `inserted token "${token}" is absent from its checkpoint`, takes);
      }
      const expectedName = order[index]!.name;
      const nextOrder = [...order];
      nextOrder.splice(index, 1);
      const take = await applyAt(host, [{
        op: 'device.delete',
        device: device(checkpoint.track, index),
        expectedName,
        expectedChain: chainFingerprint(current),
        expectedEnabledChain: chainEnabledFingerprint(current),
      }], current.at, 'delete', { clearance: ownChangesetReversal(owned.insertTakeId) });
      try {
        requireStructural(take, 'delete', takes);
        takes.push(take);
        const next = await stableChain(host, checkpoint.track, 'delete', {
          at: take.receipt.at,
          devices: expectedDevices(nextOrder),
          bankSize: checkpoint.entry.bankSize,
        });
        order.splice(0, order.length, ...nextOrder);
        current = next;
        deleted.push(token);
        lastProved = reversalContinuation(
          checkpoint,
          'delete',
          current,
          order,
          remainingScalars,
        );
      } catch (error) {
        if (take.receipt.accepted && take.report.rejected === undefined) {
          const reconciled = await reconcileChain(
            host,
            checkpoint.track,
            'delete',
            take.receipt.at,
            checkpoint.entry.bankSize,
          );
          if (reconciled !== undefined
              && devicesEqual(reconciled.devices, expectedDevices(nextOrder))) {
            order.splice(0, order.length, ...nextOrder);
            current = reconciled;
            deleted.push(token);
            lastProved = reversalContinuation(
              checkpoint,
              'delete',
              current,
              order,
              remainingScalars,
            );
          } else if (reconciled !== undefined
              && devicesEqual(reconciled.devices, expectedDevices(order))) {
            current = reconciled;
            lastProved = reversalContinuation(
              checkpoint,
              'delete',
              current,
              order,
              remainingScalars,
            );
          }
        }
        throw error;
      }
    }

    const after = await stableChain(host, checkpoint.track, 'final-proof', {
      at: current.at,
      devices: checkpoint.entry.devices,
      bankSize: checkpoint.entry.bankSize,
    });
    return { complete: true, before: checkpoint.final, after, restoredScalars, deleted, takes };
  } catch (error) {
    const stage = error instanceof ManagedFxChainError ? error.stage : 'final-proof';
    const prefix = `managed FX chain ${stage}: `;
    const detail = error instanceof Error && error.message.startsWith(prefix)
      ? error.message.slice(prefix.length)
      : error instanceof Error ? error.message : String(error);
    const allTakes = [...takes];
    if (error instanceof ManagedFxChainError) {
      for (const take of error.takes) {
        if (!allTakes.some((candidate) => candidate.id === take.id)) allTakes.push(take);
      }
    }
    throw new ManagedFxChainError(
      stage,
      detail,
      allTakes,
      lastProved === undefined
        ? undefined
        : { ...lastProved, failedStage: stage },
    );
  }
}
