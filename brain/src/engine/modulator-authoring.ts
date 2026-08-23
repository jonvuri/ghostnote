/**
 * One checkpointed `bwmod` operation.
 *
 * The byte edit happens before the project write. The executor then owns the
 * structural insert and its take. Remote readback proves modulation after the
 * insert. `validate()` proves only that the preset is structurally loadable.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  addressKey, remote, remotes,
  type Address, type DeviceAddress, type Op, type RemoteAddress, type RemoteControlState,
  type Snapshot, type TrackAddress,
} from '../contract/index.js';
import {
  addModulator, deleteModulator, identifyCuratedDonor, listModulators, loadDonor,
  modulatorBounds, replaceModulator, retarget, stubValues, validate,
} from '../bwmod/index.js';
import type { Modulator, Routing, ValidationResult } from '../bwmod/index.js';
import type { RunOptions } from './executor.js';
import type { Take } from './take.js';

const DEFAULT_SAMPLES = 8;
const DEFAULT_SAMPLE_INTERVAL_MS = 60;
const DEFAULT_INVENTORY_ATTEMPTS = 3;
const DEFAULT_INVENTORY_RETRY_MS = 200;
const DEFAULT_MINIMUM_DIVERGENCE = 1e-3;
const DEFAULT_MAXIMUM_BASE_SPREAD = 2e-3;

/** A small seam that both an executor fixture and a production Workspace satisfy. */
export interface ModulatorAuthoringHost {
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface ModulatorRemoteWitness {
  /** Control name to find in the complete remote inventory. */
  readonly controlName: string;
  /** Optional disambiguation when the same control name occurs on several pages. */
  readonly pageName?: string;
  readonly samples?: number;
  readonly sampleIntervalMs?: number;
  /** Complete-inventory attempts after a new preset load. */
  readonly inventoryAttempts?: number;
  readonly inventoryRetryMs?: number;
  readonly minimumDivergence?: number;
  readonly maximumBaseSpread?: number;
}

export interface ModulatorBehaviorWitness extends ModulatorRemoteWitness {
  /** `active` requires divergence. `inactive` requires its absence. */
  readonly expected: 'active' | 'inactive';
}

export interface ModulatorPageWitness {
  readonly pageName: string;
  readonly expectedCount: number;
}

/** Measured Tier-2 reference-stub movement for one topology edit. */
export interface ModulatorStubRelocation {
  readonly stubCount: number;
  readonly before: readonly number[];
  readonly after: readonly number[];
  readonly insertedFootprint: number;
  readonly removedFootprint: number;
  readonly delta: number;
}

export interface AddModulatorRequest {
  readonly track: TrackAddress;
  /** Absolute path to one human-saved `.bwpreset` template. */
  readonly templatePath: string;
  /** Curated id from `assets/modulators/index.json`. */
  readonly donorId: string;
  readonly routing: Routing;
  readonly witness: ModulatorRemoteWitness;
  /** Complete top-level names from the caller's last accepted observation. */
  readonly expectedChain?: readonly string[];
  /** Aligned top-level enabled flags from the same observation. */
  readonly expectedEnabledChain?: readonly boolean[];
}

export interface ModulationSample {
  readonly value: number;
  readonly modulatedValue: number;
  readonly divergence: number;
  readonly hasAutomation?: boolean;
}

export type ModulationVerification =
  | {
    readonly verified: true;
    readonly selector: RemoteAddress;
    readonly samples: readonly ModulationSample[];
    readonly maximumDivergence: number;
    readonly baseSpread: number;
  }
  | {
    readonly verified: false;
    readonly why: string;
    readonly selector?: RemoteAddress;
    readonly samples: readonly ModulationSample[];
    readonly maximumDivergence: number;
    readonly baseSpread: number;
  };

export interface AddModulatorResult {
  readonly take: Take;
  readonly minted?: DeviceAddress;
  readonly edit: {
    readonly kind: 'modulator.add';
    readonly structural: true;
    readonly templatePath: string;
    readonly donorId: string;
    readonly routing: Routing;
    readonly modulatorCountBefore: number;
    readonly modulatorCountAfter: number;
    readonly stubRelocation?: ModulatorStubRelocation;
    readonly validationWarnings: readonly string[];
    /**
     * This is the fidelity of restoring the prior absence. It does not claim
     * complete readback of the inserted preset's opaque structure.
     */
    readonly restoreFidelity: Take['fidelity'];
  };
  readonly verification: ModulationVerification;
}

export interface AddModulatorOptions {
  readonly run?: RunOptions;
  /** Test seam. Production uses a fresh directory under the system temp root. */
  readonly tempRoot?: string;
  /** Test seam. Production waits between samples so a free-running source moves. */
  readonly wait?: (milliseconds: number) => Promise<void>;
  /** Test seam for observing the validated bytes before the project write. */
  readonly onValidated?: (preset: Buffer, result: ValidationResult) => void;
}

export type ModulatorEdit =
  | {
    readonly kind: 'replace';
    readonly index: number;
    readonly donorId: string;
    readonly removedFootprint?: number;
  }
  | {
    readonly kind: 'retarget';
    readonly index: number;
    readonly target: string;
    readonly routeIndex?: number;
  }
  | {
    readonly kind: 'delete';
    readonly index: number;
    readonly removedFootprint?: number;
  };

export interface ModulatorEditRequest {
  readonly track: TrackAddress;
  /** Absolute path to one human-saved `.bwpreset` template. */
  readonly templatePath: string;
  readonly edit: ModulatorEdit;
  readonly pageWitnesses?: readonly ModulatorPageWitness[];
  readonly behaviorWitnesses?: readonly ModulatorBehaviorWitness[];
  /** Complete top-level names from the caller's last accepted observation. */
  readonly expectedChain?: readonly string[];
  /** Aligned top-level enabled flags from the same observation. */
  readonly expectedEnabledChain?: readonly boolean[];
}

export interface ModulatorPageVerification {
  readonly verified: boolean;
  readonly actualPages: readonly string[];
  readonly witnesses: readonly (ModulatorPageWitness & { readonly actualCount: number })[];
  readonly why?: string;
}

export interface ModulatorEditResult {
  readonly take: Take;
  readonly minted?: DeviceAddress;
  readonly edit: {
    readonly kind: `modulator.${ModulatorEdit['kind']}`;
    readonly structural: true;
    readonly templatePath: string;
    readonly operation: ModulatorEdit;
    readonly modulatorsBefore: readonly Modulator[];
    readonly modulatorsAfter: readonly Modulator[];
    readonly stubRelocation?: ModulatorStubRelocation;
    readonly validationWarnings: readonly string[];
    /** Fidelity of restoring the prior absence, not preset-state readback. */
    readonly restoreFidelity: Take['fidelity'];
  };
  readonly verification: {
    readonly verified: boolean;
    readonly pages: ModulatorPageVerification;
    readonly behaviors: readonly ModulationVerification[];
  };
}

export type ModulatorEditOptions = AddModulatorOptions;

export class ModulatorAuthoringError extends Error {
  readonly stage: 'request' | 'edit' | 'validate';

  constructor(stage: ModulatorAuthoringError['stage'], message: string) {
    super(message);
    this.name = 'ModulatorAuthoringError';
    this.stage = stage;
  }
}

/** Add one curated modulator, load the preset, and prove its live route. */
export async function authorModulatorAdd(
  host: ModulatorAuthoringHost,
  request: AddModulatorRequest,
  options: AddModulatorOptions = {},
): Promise<AddModulatorResult> {
  assertRequest(request);

  let template: Buffer;
  let edited: Buffer;
  let warnings: readonly string[];
  let beforeCount: number;
  let afterCount: number;
  let stubRelocation: ModulatorStubRelocation | undefined;
  try {
    template = await readFile(request.templatePath);
    beforeCount = listModulators(template).length;
    const donor = loadDonor(request.donorId);
    edited = addModulator(template, donor, request.routing);
    afterCount = listModulators(edited).length;
    stubRelocation = relocationEvidence(
      stubValues(template), stubValues(edited), donor.footprint ?? 0, 0,
    );
    const checked = validate(edited, {
      reference: template,
      ...(stubRelocation === undefined ? {} : { stubDelta: stubRelocation.delta }),
    });
    if (!checked.ok) {
      throw new ModulatorAuthoringError(
        'validate',
        `the edited preset failed validation: ${checked.problems.join('; ')}`,
      );
    }
    options.onValidated?.(Buffer.from(edited), {
      ok: checked.ok,
      problems: [...checked.problems],
      warnings: [...checked.warnings],
    });
    warnings = checked.warnings;
  } catch (error) {
    if (error instanceof ModulatorAuthoringError) throw error;
    throw new ModulatorAuthoringError('edit', errorMessage(error));
  }

  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-bwmod-'));
  const outputPath = join(directory, `${safeName(request.donorId)}.bwpreset`);
  let take: Take;
  try {
    await writeFile(outputPath, edited);
    ({ take } = await host.apply([{
      op: 'device.insert',
      track: request.track,
      source: { from: 'file', path: outputPath },
      ...(request.expectedChain === undefined ? {} : { expectedChain: request.expectedChain }),
      ...(request.expectedEnabledChain === undefined
        ? {} : { expectedEnabledChain: request.expectedEnabledChain }),
    }], options.run));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const minted = take.receipt.minted[0];
  const device = minted?.kind === 'device' ? minted : undefined;
  const verification = device === undefined
    ? failedVerification('the preset insert returned no observed device address')
    : await verifyModulation(host, device, request.witness, options.wait ?? wait);

  return {
    take,
    ...(device === undefined ? {} : { minted: device }),
    edit: {
      kind: 'modulator.add',
      structural: true,
      templatePath: request.templatePath,
      donorId: request.donorId,
      routing: request.routing,
      modulatorCountBefore: beforeCount,
      modulatorCountAfter: afterCount,
      ...(stubRelocation === undefined ? {} : { stubRelocation }),
      validationWarnings: warnings,
      restoreFidelity: take.fidelity,
    },
    verification,
  };
}

/** Apply one topology edit, checkpoint its load, and prove live readback. */
export async function authorModulatorEdit(
  host: ModulatorAuthoringHost,
  request: ModulatorEditRequest,
  options: ModulatorEditOptions = {},
): Promise<ModulatorEditResult> {
  assertEditRequest(request);

  let template: Buffer;
  let edited: Buffer;
  let warnings: readonly string[];
  let modulatorsBefore: readonly Modulator[];
  let modulatorsAfter: readonly Modulator[];
  let stubRelocation: ModulatorStubRelocation | undefined;
  try {
    template = await readFile(request.templatePath);
    modulatorsBefore = listModulators(template);
    const footprints = editFootprints(template, request.edit);
    edited = applyEdit(template, request.edit);
    modulatorsAfter = listModulators(edited);
    const beforeStubs = stubValues(template);
    const afterStubs = stubValues(edited);
    stubRelocation = relocationEvidence(
      beforeStubs, afterStubs, footprints.inserted, footprints.removed,
    );
    const checked = validate(edited, {
      reference: template,
      ...(stubRelocation === undefined ? {} : { stubDelta: stubRelocation.delta }),
    });
    if (!checked.ok) {
      throw new ModulatorAuthoringError(
        'validate',
        `the edited preset failed validation: ${checked.problems.join('; ')}`,
      );
    }
    options.onValidated?.(Buffer.from(edited), {
      ok: checked.ok,
      problems: [...checked.problems],
      warnings: [...checked.warnings],
    });
    warnings = checked.warnings;
  } catch (error) {
    if (error instanceof ModulatorAuthoringError) throw error;
    throw new ModulatorAuthoringError('edit', errorMessage(error));
  }

  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-bwmod-'));
  const outputPath = join(directory, `${safeName(request.edit.kind)}.bwpreset`);
  let take: Take;
  try {
    await writeFile(outputPath, edited);
    ({ take } = await host.apply([{
      op: 'device.insert',
      track: request.track,
      source: { from: 'file', path: outputPath },
      ...(request.expectedChain === undefined ? {} : { expectedChain: request.expectedChain }),
      ...(request.expectedEnabledChain === undefined
        ? {} : { expectedEnabledChain: request.expectedEnabledChain }),
    }], options.run));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const minted = take.receipt.minted[0];
  const device = minted?.kind === 'device' ? minted : undefined;
  const pause = options.wait ?? wait;
  const pages = device === undefined
    ? failedPageVerification('the preset insert returned no observed device address')
    : await verifyPages(host, device, request.pageWitnesses ?? [], pause);
  const behaviors: ModulationVerification[] = [];
  if (device !== undefined) {
    for (const witness of request.behaviorWitnesses ?? []) {
      behaviors.push(await verifyModulation(host, device, witness, pause, witness.expected));
    }
  }
  const allBehaviorsVerified = device !== undefined
    && behaviors.length === (request.behaviorWitnesses?.length ?? 0)
    && behaviors.every((verification) => verification.verified);

  return {
    take,
    ...(device === undefined ? {} : { minted: device }),
    edit: {
      kind: `modulator.${request.edit.kind}`,
      structural: true,
      templatePath: request.templatePath,
      operation: request.edit,
      modulatorsBefore,
      modulatorsAfter,
      ...(stubRelocation === undefined ? {} : { stubRelocation }),
      validationWarnings: warnings,
      restoreFidelity: take.fidelity,
    },
    verification: {
      verified: pages.verified && allBehaviorsVerified,
      pages,
      behaviors,
    },
  };
}

async function verifyModulation(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  witness: ModulatorRemoteWitness,
  pause: (milliseconds: number) => Promise<void>,
  expected: 'active' | 'inactive' = 'active',
): Promise<ModulationVerification> {
  const inventoryAddress = remotes(device);
  let inventory: Snapshot | undefined;
  let inventoryFailure = 'the inserted device returned no complete remote inventory';
  const inventoryAttempts = witness.inventoryAttempts ?? DEFAULT_INVENTORY_ATTEMPTS;
  const inventoryRetryMs = witness.inventoryRetryMs ?? DEFAULT_INVENTORY_RETRY_MS;
  for (let attempt = 0; attempt < inventoryAttempts; attempt++) {
    try {
      const candidate = await host.read([inventoryAddress]);
      const value = candidate.entries[addressKey(inventoryAddress)]?.value;
      if (value?.of === 'remotes') {
        inventory = candidate;
        break;
      }
      inventoryFailure = candidate.unstable.some((address) => addressKey(address) === addressKey(inventoryAddress))
        ? 'the remote inventory did not settle'
        : 'the inserted device returned no complete remote inventory';
    } catch (error) {
      inventoryFailure = `remote inventory failed: ${errorMessage(error)}`;
    }
    if (attempt + 1 < inventoryAttempts && inventoryRetryMs > 0) await pause(inventoryRetryMs);
  }
  if (inventory === undefined) return failedVerification(inventoryFailure);
  const entry = inventory.entries[addressKey(inventoryAddress)];
  if (entry?.value.of !== 'remotes') return failedVerification(inventoryFailure);

  const namedMatches = entry.value.remotes.pages.flatMap((page) => page.controls
    .filter((control) => control.name === witness.controlName)
    .map((control) => remote(device, page.index, page.name, control.index, control.name)));
  const matches = namedMatches.filter((selector) => witness.pageName === undefined
    || selector.pageName === witness.pageName);
  if (matches.length !== 1) {
    const scope = witness.pageName === undefined
      ? `control ${JSON.stringify(witness.controlName)}`
      : `control ${JSON.stringify(witness.controlName)} on page ${JSON.stringify(witness.pageName)}`;
    return failedVerification(
      `${scope} matched ${matches.length} remote selectors; exact verification requires one; `
      + `name matches: ${selectorSummary(namedMatches)}`,
    );
  }

  const selector = matches[0]!;
  const samples: ModulationSample[] = [];
  const count = witness.samples ?? DEFAULT_SAMPLES;
  const interval = witness.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
  for (let index = 0; index < count; index++) {
    let snapshot: Snapshot;
    try {
      snapshot = await host.read([selector]);
    } catch (error) {
      return failedVerification(
        `remote sample ${index + 1} failed: ${errorMessage(error)}`,
        selector,
        samples,
      );
    }
    const value = snapshot.entries[addressKey(selector)]?.value;
    if (value?.of !== 'remote') {
      return failedVerification(
        `remote sample ${index + 1} did not return the exact selector`,
        selector,
        samples,
      );
    }
    samples.push(sampleOf(value.remote));
    if (index + 1 < count && interval > 0) await pause(interval);
  }

  const maximumDivergence = max(samples.map((sample) => sample.divergence));
  const bases = samples.map((sample) => sample.value);
  const baseSpread = max(bases) - min(bases);
  const minimumDivergence = witness.minimumDivergence ?? DEFAULT_MINIMUM_DIVERGENCE;
  const maximumBaseSpread = witness.maximumBaseSpread ?? DEFAULT_MAXIMUM_BASE_SPREAD;
  if (samples.some((sample) => sample.hasAutomation === true)) {
    return failedVerification(
      'the witness has host automation, so divergence does not prove the authored route',
      selector,
      samples,
    );
  }
  if (samples.some((sample) => sample.hasAutomation === undefined)) {
    return failedVerification(
      'the witness automation state was not observed, so divergence does not prove the authored route',
      selector,
      samples,
    );
  }
  if (baseSpread > maximumBaseSpread) {
    return failedVerification(
      `the remote base moved by ${baseSpread}; the limit is ${maximumBaseSpread}`,
      selector,
      samples,
    );
  }
  if (expected === 'active' && maximumDivergence < minimumDivergence) {
    return failedVerification(
      `base and modulated values never diverged by ${minimumDivergence}`,
      selector,
      samples,
    );
  }
  if (expected === 'inactive' && maximumDivergence >= minimumDivergence) {
    return failedVerification(
      `base and modulated values diverged by ${maximumDivergence}; the inactive limit is ${minimumDivergence}`,
      selector,
      samples,
    );
  }
  return { verified: true, selector, samples, maximumDivergence, baseSpread };
}

async function verifyPages(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  witnesses: readonly ModulatorPageWitness[],
  pause: (milliseconds: number) => Promise<void>,
): Promise<ModulatorPageVerification> {
  const inventoryAddress = remotes(device);
  let failure = 'the inserted device returned no complete remote inventory';
  for (let attempt = 0; attempt < DEFAULT_INVENTORY_ATTEMPTS; attempt++) {
    try {
      const snapshot = await host.read([inventoryAddress]);
      const value = snapshot.entries[addressKey(inventoryAddress)]?.value;
      if (value?.of === 'remotes') {
        const actualPages = value.remotes.pages.map((page) => page.name);
        const observed = witnesses.map((witness) => ({
          ...witness,
          actualCount: actualPages.filter((page) => page === witness.pageName).length,
        }));
        const failed = observed.filter((witness) => witness.actualCount !== witness.expectedCount);
        return failed.length === 0
          ? { verified: true, actualPages, witnesses: observed }
          : {
            verified: false,
            actualPages,
            witnesses: observed,
            why: `remote page counts did not match: ${failed.map((item) =>
              `${JSON.stringify(item.pageName)} expected ${item.expectedCount}, got ${item.actualCount}`).join('; ')}`,
          };
      }
      failure = snapshot.unstable.some((address) => addressKey(address) === addressKey(inventoryAddress))
        ? 'the remote inventory did not settle'
        : failure;
    } catch (error) {
      failure = `remote inventory failed: ${errorMessage(error)}`;
    }
    if (attempt + 1 < DEFAULT_INVENTORY_ATTEMPTS) await pause(DEFAULT_INVENTORY_RETRY_MS);
  }
  return failedPageVerification(failure);
}

function failedPageVerification(why: string): ModulatorPageVerification {
  return { verified: false, actualPages: [], witnesses: [], why };
}

function sampleOf(control: RemoteControlState): ModulationSample {
  return {
    value: control.value,
    modulatedValue: control.modulatedValue,
    divergence: Math.abs(control.modulatedValue - control.value),
    ...(control.hasAutomation === undefined ? {} : { hasAutomation: control.hasAutomation }),
  };
}

function failedVerification(
  why: string,
  selector?: RemoteAddress,
  samples: readonly ModulationSample[] = [],
): ModulationVerification {
  const bases = samples.map((sample) => sample.value);
  return {
    verified: false,
    why,
    ...(selector === undefined ? {} : { selector }),
    samples,
    maximumDivergence: max(samples.map((sample) => sample.divergence)),
    baseSpread: bases.length === 0 ? 0 : max(bases) - min(bases),
  };
}

function relocationEvidence(
  before: readonly number[],
  after: readonly number[],
  insertedFootprint: number,
  removedFootprint: number,
): ModulatorStubRelocation | undefined {
  if (before.length === 0 && after.length === 0) return undefined;
  return {
    stubCount: before.length,
    before: [...before],
    after: [...after],
    insertedFootprint,
    removedFootprint,
    delta: insertedFootprint - removedFootprint,
  };
}

function editFootprints(
  template: Buffer,
  edit: ModulatorEdit,
): { readonly inserted: number; readonly removed: number } {
  if (stubValues(template).length === 0 || edit.kind === 'retarget') {
    return { inserted: 0, removed: 0 };
  }
  const removed = residentFootprint(template, edit.index, edit.removedFootprint);
  if (edit.kind === 'delete') return { inserted: 0, removed };
  const donor = loadDonor(edit.donorId);
  if (donor.footprint === null) {
    throw new Error(
      `this preset embeds a sample, but donor ${edit.donorId} has no measured footprint; `
      + 'a guessed footprint rejects the whole preset silently',
    );
  }
  return { inserted: donor.footprint, removed };
}

function residentFootprint(template: Buffer, index: number, explicit?: number): number {
  if (explicit !== undefined) return explicit;
  const asset = identifyCuratedDonor(template.subarray(...modulatorBounds(template, index)));
  if (asset?.footprint != null) return asset.footprint;
  throw new Error(
    `the sampled preset modulator at index ${index} has no measured removed footprint; `
    + 'pass removedFootprint explicitly because a guess rejects the whole preset silently',
  );
}

function applyEdit(template: Buffer, edit: ModulatorEdit): Buffer {
  switch (edit.kind) {
    case 'replace':
      return replaceModulator(template, edit.index, loadDonor(edit.donorId), {
        ...(edit.removedFootprint === undefined ? {} : { removedFootprint: edit.removedFootprint }),
      });
    case 'retarget':
      return retarget(template, edit.index, edit.target, edit.routeIndex ?? 0);
    case 'delete':
      return deleteModulator(template, edit.index, {
        ...(edit.removedFootprint === undefined ? {} : { removedFootprint: edit.removedFootprint }),
      });
  }
}

function assertEditRequest(request: ModulatorEditRequest): void {
  assertTemplatePath(request.templatePath);
  if (!Number.isInteger(request.edit.index) || request.edit.index < 0) {
    throw new ModulatorAuthoringError('request', 'edit.index is out of range');
  }
  if (request.edit.kind === 'replace' && request.edit.donorId.trim() === '') {
    throw new ModulatorAuthoringError('request', 'edit.donorId must not be empty');
  }
  if (request.edit.kind === 'retarget') {
    if (request.edit.target.trim() === '') {
      throw new ModulatorAuthoringError('request', 'edit.target must not be empty');
    }
    if (request.edit.routeIndex !== undefined
        && (!Number.isInteger(request.edit.routeIndex) || request.edit.routeIndex < 0)) {
      throw new ModulatorAuthoringError('request', 'edit.routeIndex is out of range');
    }
  }
  if (request.edit.kind !== 'retarget' && request.edit.removedFootprint !== undefined
      && (!Number.isInteger(request.edit.removedFootprint) || request.edit.removedFootprint < 0)) {
    throw new ModulatorAuthoringError('request', 'edit.removedFootprint is out of range');
  }
  const pageWitnesses = request.pageWitnesses ?? [];
  const behaviorWitnesses = request.behaviorWitnesses ?? [];
  if (pageWitnesses.length + behaviorWitnesses.length === 0) {
    throw new ModulatorAuthoringError('request', 'at least one live witness is required');
  }
  for (const witness of pageWitnesses) {
    if (witness.pageName.trim() === '') {
      throw new ModulatorAuthoringError('request', 'pageWitness.pageName must not be empty');
    }
    if (!Number.isInteger(witness.expectedCount) || witness.expectedCount < 0) {
      throw new ModulatorAuthoringError('request', 'pageWitness.expectedCount is out of range');
    }
  }
  for (const witness of behaviorWitnesses) {
    assertWitness(witness);
    if (witness.pageName === undefined) {
      throw new ModulatorAuthoringError(
        'request',
        'behaviorWitness.pageName is required for an exact selector',
      );
    }
  }
}

function assertRequest(request: AddModulatorRequest): void {
  assertTemplatePath(request.templatePath);
  if (request.donorId.trim() === '') {
    throw new ModulatorAuthoringError('request', 'donorId must not be empty');
  }
  if (request.routing.target.trim() === '') {
    throw new ModulatorAuthoringError('request', 'routing.target must not be empty');
  }
  assertWitness(request.witness);
  if (!Number.isFinite(request.routing.amount)) {
    throw new ModulatorAuthoringError('request', 'routing.amount must be finite');
  }
}

function assertTemplatePath(templatePath: string): void {
  if (!isAbsolute(templatePath)) {
    throw new ModulatorAuthoringError('request', 'templatePath must be absolute');
  }
  if (!templatePath.toLowerCase().endsWith('.bwpreset')) {
    throw new ModulatorAuthoringError('request', 'templatePath must end with .bwpreset');
  }
}

function assertWitness(witness: ModulatorRemoteWitness): void {
  if (witness.controlName.trim() === '') {
    throw new ModulatorAuthoringError('request', 'witness.controlName must not be empty');
  }
  if (witness.pageName !== undefined && witness.pageName.trim() === '') {
    throw new ModulatorAuthoringError('request', 'witness.pageName must not be blank');
  }
  for (const [name, value] of [
    ['samples', witness.samples],
    ['sampleIntervalMs', witness.sampleIntervalMs],
    ['inventoryAttempts', witness.inventoryAttempts],
    ['inventoryRetryMs', witness.inventoryRetryMs],
  ] as const) {
    const positive = name === 'samples' || name === 'inventoryAttempts';
    if (value !== undefined && (!Number.isInteger(value) || value < (positive ? 1 : 0))) {
      throw new ModulatorAuthoringError('request', `${name} is out of range`);
    }
  }
  const minimumDivergence = witness.minimumDivergence;
  if (minimumDivergence !== undefined
      && (!Number.isFinite(minimumDivergence) || minimumDivergence <= 0)) {
    throw new ModulatorAuthoringError('request', 'minimumDivergence must be positive');
  }
  const maximumBaseSpread = witness.maximumBaseSpread;
  if (maximumBaseSpread !== undefined
      && (!Number.isFinite(maximumBaseSpread) || maximumBaseSpread < 0)) {
    throw new ModulatorAuthoringError('request', 'maximumBaseSpread is out of range');
  }
}

function max(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

function min(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.min(...values);
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function selectorSummary(selectors: readonly RemoteAddress[]): string {
  if (selectors.length === 0) return 'none';
  return selectors.map((selector) => `${selector.pageIndex}:${JSON.stringify(selector.pageName)}`
    + `/${selector.controlIndex}:${JSON.stringify(selector.controlName)}`).join(', ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
