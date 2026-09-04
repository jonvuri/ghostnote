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
  addressKey, chain, deviceIn, deviceSlot, param, remote, remotes,
  type Address, type DeviceAddress, type Op, type ParamAddress, type ParamState,
  type RemoteAddress, type RemoteControlState, type Snapshot, type TrackAddress,
} from '../contract/index.js';
import {
  addModulator, deleteModulator, findModulatorList, identifyCuratedDonor, listModulators, loadDonor,
  modulatorBounds, replaceModulator, retarget, setAmount, stubValues, validate,
} from '../bwmod/index.js';
import type { Modulator, Routing, ValidationResult } from '../bwmod/index.js';
import type { RunOptions } from './executor.js';
import type { Take } from './take.js';
import {
  assertPresetFingerprint, inspectPresetModulation,
  type PresetFingerprint, type PublicPresetModulator, type SemanticModulatorLocation,
} from './preset-modulation-inspection.js';
import { matchPageFamily } from './page-family.js';
import {
  settleObservation, type SettlementOptions, type SettlementReport,
} from './settlement.js';

const DEFAULT_SAMPLES = 8;
const DEFAULT_SAMPLE_INTERVAL_MS = 60;
const DEFAULT_MINIMUM_DIVERGENCE = 1e-3;
const DEFAULT_MAXIMUM_BASE_SPREAD = 2e-3;

/** A small seam that both an executor fixture and a production Workspace satisfy. */
export interface ModulatorAuthoringHost {
  /** Throw the exact cancellation reason when the host supports cancellation. */
  readonly throwIfCancelled?: () => void;
  read(addresses: readonly Address[]): Promise<Snapshot>;
  apply(ops: readonly Op[], options?: RunOptions): Promise<{ readonly take: Take }>;
}

export interface ModulatorParameterWitness {
  /** Exact DirectParameter id returned by `inspect_device_parameters`. */
  readonly parameterId: string;
  /** Exact name returned with `parameterId` in the same stable inventory. */
  readonly parameterName: string;
  readonly samples?: number;
  readonly sampleIntervalMs?: number;
  /** Complete-inventory attempts after a new preset load. */
  readonly inventoryAttempts?: number;
  readonly inventoryRetryMs?: number;
  readonly minimumDivergence?: number;
  readonly maximumBaseSpread?: number;
  /** Select one nested device below the inserted container. */
  readonly nestedDevice?: {
    readonly chainName?: string;
    readonly slotName?: string;
    readonly chainIndex: number;
  };
}

export interface ModulatorBehaviorWitness extends ModulatorParameterWitness {
  /** `active` requires divergence. `inactive` requires its absence. */
  readonly expected: 'active' | 'inactive';
}

export interface ModulationBatchWitness extends ModulatorParameterWitness {
  readonly expected?: 'active' | 'inactive';
}

export interface ModulatorPageWitness {
  readonly pageName: string;
  readonly expectedCount: number;
  /** Select one nested device below the inserted container. */
  readonly nestedDevice?: ModulatorParameterWitness['nestedDevice'];
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
  /** Curated id from `assets/modulators/manifest.json`. */
  readonly donorId: string;
  readonly routing: Routing;
  readonly witness: ModulatorParameterWitness;
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
    readonly selector: ParamAddress;
    readonly samples: readonly ModulationSample[];
    readonly maximumDivergence: number;
    readonly baseSpread: number;
    readonly settlement?: SettlementReport;
  }
  | {
    readonly verified: false;
    readonly why: string;
    readonly selector?: ParamAddress;
    readonly samples: readonly ModulationSample[];
    readonly maximumDivergence: number;
    readonly baseSpread: number;
    readonly settlement?: SettlementReport;
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
    readonly kind: 'add';
    readonly donorId: string;
    readonly routing: Routing;
  }
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
    readonly kind: 'amount';
    readonly index: number;
    readonly amount: number;
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
  /** Required to edit a container preset that holds several device lists. */
  readonly listIndex?: number;
  readonly edit: ModulatorEdit;
  /** Exact saved host name that structural insertion readback must observe. */
  readonly expectedDeviceName?: string;
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
    readonly listIndex?: number;
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

/** A fingerprinted edit addressed only by the semantic location from inspection. */
export interface SemanticModulatorEditRequest extends Omit<ModulatorEditRequest, 'listIndex'> {
  readonly fingerprint: PresetFingerprint;
  readonly location: SemanticModulatorLocation;
}

export interface SemanticModulatorEditResult {
  readonly take: Take;
  readonly minted?: DeviceAddress;
  readonly edit: {
    readonly kind: `modulator.${ModulatorEdit['kind']}`;
    readonly structural: true;
    readonly templatePath: string;
    readonly location: SemanticModulatorLocation;
    readonly modulatorsBefore: readonly PublicPresetModulator[];
    readonly modulatorsAfter: readonly PublicPresetModulator[];
    readonly siblingInventoriesUnchanged: true;
    readonly stubRelocation?: ModulatorStubRelocation;
    readonly validationWarnings: readonly string[];
    readonly restoreFidelity: Take['fidelity'];
  };
  readonly verification: ModulatorEditResult['verification'];
}

export interface SemanticPresetModulatorAdd {
  readonly donorId: string;
  readonly routing: Routing;
}

export interface AuthoredSemanticPreset {
  readonly preset: Buffer;
  readonly hostName: string;
  readonly location: SemanticModulatorLocation;
  readonly modulatorsBefore: readonly PublicPresetModulator[];
  readonly modulatorsAfter: readonly PublicPresetModulator[];
  readonly siblingInventoriesUnchanged: true;
  readonly sampledPreset: boolean;
  readonly adjustedSampleReferences: number;
  readonly validationWarnings: readonly string[];
}

export class ModulatorAuthoringError extends Error {
  readonly stage: 'request' | 'edit' | 'validate';

  constructor(stage: ModulatorAuthoringError['stage'], message: string) {
    super(message);
    this.name = 'ModulatorAuthoringError';
    this.stage = stage;
  }
}

/** Add several modulators to one semantic preset location without loading it. */
export async function authorSemanticPreset(
  templatePath: string,
  fingerprint: PresetFingerprint,
  location: SemanticModulatorLocation,
  additions: readonly SemanticPresetModulatorAdd[],
): Promise<AuthoredSemanticPreset> {
  assertTemplatePath(templatePath);
  if (additions.length === 0) {
    throw new ModulatorAuthoringError('request', 'at least one preset modulator is required');
  }
  try {
    const template = await readFile(templatePath);
    assertPresetFingerprint(template, fingerprint);
    const before = inspectPresetModulation(template);
    if (!before.supported) throw new Error(before.why);
    const listIndex = semanticListIndex(before, location);
    let edited: Buffer = Buffer.from(template);
    let insertedFootprint = 0;
    for (const addition of additions) {
      const edit: ModulatorEdit = { kind: 'add', ...addition };
      insertedFootprint += editFootprints(edited, edit, listIndex).inserted;
      edited = applyEdit(edited, edit, listIndex);
    }
    const beforeStubs = stubValues(template);
    const checked = validate(edited, {
      reference: template,
      listIndex,
      ...(beforeStubs.length === 0 ? {} : { stubDelta: insertedFootprint }),
    });
    if (!checked.ok) {
      throw new ModulatorAuthoringError(
        'validate', `the edited preset failed validation: ${checked.problems.join('; ')}`,
      );
    }
    const after = inspectPresetModulation(edited);
    if (!after.supported || semanticListIndex(after, location) !== listIndex) {
      throw new ModulatorAuthoringError(
        'validate', 'the edit removed or changed the semantic modulator location',
      );
    }
    assertSiblingInventories(before, after, listIndex);
    return {
      preset: edited,
      hostName: before.host.name,
      location,
      modulatorsBefore: before.modulation[listIndex]!.modulators,
      modulatorsAfter: after.modulation[listIndex]!.modulators,
      siblingInventoriesUnchanged: true,
      sampledPreset: beforeStubs.length > 0,
      adjustedSampleReferences: beforeStubs.length,
      validationWarnings: checked.warnings,
    };
  } catch (error) {
    if (error instanceof ModulatorAuthoringError) throw error;
    throw new ModulatorAuthoringError('edit', errorMessage(error));
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
    : await verifyModulation(
      host,
      witnessDevice(device, request.witness),
      request.witness,
      options.wait ?? wait,
    );

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
    modulatorsBefore = listModulators(template, request.listIndex);
    const footprints = editFootprints(template, request.edit, request.listIndex);
    edited = applyEdit(template, request.edit, request.listIndex);
    modulatorsAfter = listModulators(edited, request.listIndex);
    const beforeStubs = stubValues(template);
    const afterStubs = stubValues(edited);
    stubRelocation = relocationEvidence(
      beforeStubs, afterStubs, footprints.inserted, footprints.removed,
    );
    const checked = validate(edited, {
      reference: template,
      ...(request.listIndex === undefined ? {} : { listIndex: request.listIndex }),
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
      ...(request.expectedDeviceName === undefined
        ? {} : { expectedDeviceName: request.expectedDeviceName }),
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
    : request.expectedDeviceName !== undefined && (request.pageWitnesses?.length ?? 0) === 0
      ? { verified: true, actualPages: [], witnesses: [] }
      : await verifyPages(host, device, request.pageWitnesses ?? [], pause);
  const behaviors: ModulationVerification[] = [];
  if (device !== undefined) {
    for (const witness of request.behaviorWitnesses ?? []) {
      behaviors.push(await verifyModulation(
        host,
        witnessDevice(device, witness),
        witness,
        pause,
        witness.expected,
      ));
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
      ...(request.listIndex === undefined ? {} : { listIndex: request.listIndex }),
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

/** Resolve one inspected semantic location, apply an edit, and report public inventories. */
export async function authorSemanticModulatorEdit(
  host: ModulatorAuthoringHost,
  request: SemanticModulatorEditRequest,
  options: ModulatorEditOptions = {},
): Promise<SemanticModulatorEditResult> {
  assertTemplatePath(request.templatePath);
  let template: Buffer;
  let beforeInspection: Extract<ReturnType<typeof inspectPresetModulation>, { supported: true }>;
  let listIndex: number;
  try {
    template = await readFile(request.templatePath);
    assertPresetFingerprint(template, request.fingerprint);
    const inspection = inspectPresetModulation(template);
    if (!inspection.supported) throw new Error(inspection.why);
    beforeInspection = inspection;
    listIndex = semanticListIndex(inspection, request.location);
  } catch (error) {
    throw new ModulatorAuthoringError('edit', errorMessage(error));
  }

  const directory = await mkdtemp(join(options.tempRoot ?? tmpdir(), 'ghostnote-semantic-bwmod-'));
  const snapshotPath = join(directory, 'inspected.bwpreset');
  let afterInspection:
    | Extract<ReturnType<typeof inspectPresetModulation>, { supported: true }>
    | undefined;
  try {
    await writeFile(snapshotPath, template);
    const result = await authorModulatorEdit(host, {
      track: request.track,
      templatePath: snapshotPath,
      listIndex,
      edit: request.edit,
      expectedDeviceName: beforeInspection.host.name,
      ...(request.pageWitnesses === undefined ? {} : { pageWitnesses: request.pageWitnesses }),
      ...(request.behaviorWitnesses === undefined
        ? {} : { behaviorWitnesses: request.behaviorWitnesses }),
      ...(request.expectedChain === undefined ? {} : { expectedChain: request.expectedChain }),
      ...(request.expectedEnabledChain === undefined
        ? {} : { expectedEnabledChain: request.expectedEnabledChain }),
    }, {
      ...options,
      onValidated(preset, checked) {
        const inspection = inspectPresetModulation(preset);
        if (!inspection.supported) {
          throw new ModulatorAuthoringError(
            'validate',
            'the edit removed the complete semantic modulator mapping',
          );
        }
        const afterListIndex = semanticListIndex(inspection, request.location);
        if (afterListIndex !== listIndex) {
          throw new ModulatorAuthoringError('validate', 'the selected semantic location changed position');
        }
        assertSiblingInventories(beforeInspection, inspection, listIndex);
        afterInspection = inspection;
        options.onValidated?.(preset, checked);
      },
    });
    if (afterInspection === undefined) {
      throw new ModulatorAuthoringError('validate', 'the semantic edit produced no validated preset');
    }

    return {
      take: result.take,
      ...(result.minted === undefined ? {} : { minted: result.minted }),
      edit: {
        kind: result.edit.kind,
        structural: true,
        templatePath: request.templatePath,
        location: request.location,
        modulatorsBefore: beforeInspection.modulation[listIndex]!.modulators,
        modulatorsAfter: afterInspection.modulation[listIndex]!.modulators,
        siblingInventoriesUnchanged: true,
        ...(result.edit.stubRelocation === undefined
          ? {} : { stubRelocation: result.edit.stubRelocation }),
        validationWarnings: result.edit.validationWarnings,
        restoreFidelity: result.edit.restoreFidelity,
      },
      verification: result.verification,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function verifyModulation(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  witness: ModulatorParameterWitness,
  pause: (milliseconds: number) => Promise<void>,
  expected: 'active' | 'inactive' = 'active',
  settlementOptions: SettlementOptions = {},
): Promise<ModulationVerification> {
  return (await verifyModulations(
    host, device, [{ ...witness, expected }], pause, settlementOptions,
  ))[0]!;
}

/** Prove several targets with one inventory and one read for each sample round. */
export async function verifyModulations(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  witnesses: readonly ModulationBatchWitness[],
  pause: (milliseconds: number) => Promise<void>,
  settlementOptions: SettlementOptions = {},
): Promise<readonly ModulationVerification[]> {
  if (witnesses.length === 0) return [];
  const singleWitness = witnesses.length === 1 ? witnesses[0] : undefined;
  const selectors = witnesses.map((witness) => param(device, witness.parameterId));
  let failure = 'the DirectParameter inventories did not settle';
  const initial = await settleObservation<Snapshot>(async () => {
    try {
      const snapshot = await host.read(selectors);
      const complete = selectors.every((selector) =>
        snapshot.entries[addressKey(selector)]?.value.of === 'param');
      if (complete) {
        return {
          complete: true as const,
          value: snapshot,
          progress: { stage: 'direct-parameters', detail: 'all exact parameters are stable' },
        };
      }
      failure = snapshot.unstable.some((address) =>
        selectors.some((selector) => addressKey(address) === addressKey(selector)))
        ? 'the DirectParameter inventories did not settle'
        : witnesses.length === 1
          ? `DirectParameter id ${JSON.stringify(witnesses[0]!.parameterId)} is missing after the preset load`
          : 'one or more exact DirectParameter ids are missing after the preset load';
    } catch (error) {
      throwIfCancellation(host, error);
      failure = `DirectParameter inventory failed: ${errorMessage(error)}`;
    }
    return {
      complete: false as const,
      progress: { stage: 'direct-parameters', detail: failure },
    };
  }, settlementFor(host, pause, singleWitness, settlementOptions));
  if (!initial.complete) {
    const why = settlementFailure(failure, initial.report);
    return selectors.map((selector) => failedVerification(why, selector, [], initial.report));
  }

  const originals = selectors.map((selector) => {
    const value = initial.value.entries[addressKey(selector)]?.value;
    return value?.of === 'param' ? value.param : undefined;
  });
  const sampleSelectors: (ParamAddress | RemoteAddress | undefined)[] = [...selectors];
  const failures: (string | undefined)[] = witnesses.map((witness, index) => {
    const selected = originals[index];
    if (selected?.name === witness.parameterName) return undefined;
    return `DirectParameter id ${JSON.stringify(witness.parameterId)} has name `
      + `${JSON.stringify(selected?.name ?? 'missing')}, not ${JSON.stringify(witness.parameterName)}`;
  });

  const fallbackIndices = originals.flatMap((selected, index) =>
    selected !== undefined && (!selected.observed.modulatedValue || selected.modulatedValue === undefined)
      && failures[index] === undefined ? [index] : []);
  const reports = witnesses.map(() => initial.report);
  if (fallbackIndices.length > 0) {
    const inventoryAddress = remotes(device);
    let remoteFailure = 'the supplementary remote inventory did not settle';
    const remoteResult = await settleObservation<Snapshot>(async () => {
      try {
        const snapshot = await host.read([inventoryAddress]);
        if (snapshot.entries[addressKey(inventoryAddress)]?.value.of === 'remotes') {
          return {
            complete: true as const,
            value: snapshot,
            progress: { stage: 'supplementary-remotes', detail: 'the complete inventory is stable' },
          };
        }
        remoteFailure = snapshot.unstable.some((address) =>
          addressKey(address) === addressKey(inventoryAddress))
          ? 'the supplementary remote inventory did not settle'
          : 'the supplementary remote inventory is missing';
      } catch (error) {
        throwIfCancellation(host, error);
        remoteFailure = `supplementary remote inventory failed: ${errorMessage(error)}`;
      }
      return {
        complete: false as const,
        progress: { stage: 'supplementary-remotes', detail: remoteFailure },
      };
    }, settlementFor(host, pause, singleWitness, settlementOptions));
    for (const index of fallbackIndices) reports[index] = remoteResult.report;
    if (!remoteResult.complete) {
      const why = settlementFailure(remoteFailure, remoteResult.report);
      for (const index of fallbackIndices) failures[index] = why;
    } else {
      const value = remoteResult.value.entries[addressKey(inventoryAddress)]?.value;
      const pages = value?.of === 'remotes' ? value.remotes.pages : [];
      for (const index of fallbackIndices) {
        const name = witnesses[index]!.parameterName;
        const matches = pages.flatMap((page) => page.controls
          .filter((control) => control.name === name)
          .map((control) => remote(device, page.index, page.name, control.index, control.name)));
        if (matches.length === 1) sampleSelectors[index] = matches[0]!;
        else failures[index] = `DirectParameter ${JSON.stringify(name)} has no modulated value; `
          + `its name matched ${matches.length} supplementary remote controls`;
      }
    }
  }

  let samples = witnesses.map((): ModulationSample[] => []);
  const maximumSamples = max(witnesses.map((witness) => witness.samples ?? DEFAULT_SAMPLES));
  const sampledIndices = witnesses.flatMap((_, index) =>
    failures[index] === undefined ? [index] : []);
  if (sampledIndices.length > 0) {
    const sampled = await settleObservation<readonly ModulationSample[][]>(async () => {
      const attemptSamples = witnesses.map((): ModulationSample[] => []);
      for (let round = 0; round < maximumSamples; round++) {
        const active = sampledIndices.filter((index) =>
          round < (witnesses[index]!.samples ?? DEFAULT_SAMPLES));
        if (active.length === 0) break;
        const addresses = active.map((index) => sampleSelectors[index]!);
        let snapshot: Snapshot;
        try {
          snapshot = await host.read(addresses);
        } catch (error) {
          throwIfCancellation(host, error);
          return { complete: false as const, progress: {
            stage: 'behavior-samples', detail: `sample ${round + 1} failed: ${errorMessage(error)}`,
          } };
        }
        for (const index of active) {
          const address = sampleSelectors[index]!;
          const value = snapshot.entries[addressKey(address)]?.value;
          const witness = witnesses[index]!;
          if (value?.of !== 'param' && value?.of !== 'remote') {
            return { complete: false as const, progress: {
              stage: 'behavior-samples', detail: `sample ${round + 1} did not return the exact target`,
            } };
          }
          const name = value.of === 'param' ? value.param.name : value.remote.name;
          if (name !== witness.parameterName) {
            return { complete: false as const, progress: {
              stage: 'behavior-samples',
              detail: `sample ${round + 1} changed name to ${JSON.stringify(name)}`,
            } };
          }
          const sample = value.of === 'param'
            ? sampleOfParameter(value.param) : sampleOfRemote(value.remote);
          if (sample === undefined) {
            return { complete: false as const, progress: {
              stage: 'behavior-samples',
              detail: `sample ${round + 1} did not expose base and modulated values`,
            } };
          }
          attemptSamples[index]!.push(sample);
        }
        if (round + 1 < maximumSamples) {
          const interval = max(active.map((index) =>
            witnesses[index]!.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS));
          if (interval > 0) await pause(interval);
        }
      }
      return {
        complete: true as const,
        value: attemptSamples,
        progress: { stage: 'behavior-samples', detail: 'all exact sample rounds completed' },
      };
    }, settlementFor(host, pause, singleWitness, settlementOptions));
    for (const index of sampledIndices) reports[index] = sampled.report;
    if (sampled.complete) {
      samples = sampled.value.map((rows) => [...rows]);
    } else {
      const why = settlementFailure(sampled.report.lastProgress.detail, sampled.report);
      for (const index of sampledIndices) failures[index] = why;
    }
  }

  return witnesses.map((witness, index) => failures[index] === undefined
    ? evaluateSamples(
      witness, witness.expected ?? 'active', selectors[index]!, samples[index]!, reports[index],
    )
    : failedVerification(failures[index]!, selectors[index], samples[index], reports[index]));
}

function evaluateSamples(
  witness: ModulatorParameterWitness,
  expected: 'active' | 'inactive',
  selector: ParamAddress,
  samples: readonly ModulationSample[],
  settlement?: SettlementReport,
): ModulationVerification {
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
      settlement,
    );
  }
  if (samples.some((sample) => sample.hasAutomation === undefined)) {
    return failedVerification(
      'the witness automation state was not observed, so divergence does not prove the authored route',
      selector,
      samples,
      settlement,
    );
  }
  if (baseSpread > maximumBaseSpread) {
    return failedVerification(
      `the remote base moved by ${baseSpread}; the limit is ${maximumBaseSpread}`,
      selector,
      samples,
      settlement,
    );
  }
  if (expected === 'active' && maximumDivergence < minimumDivergence) {
    return failedVerification(
      `base and modulated values never diverged by ${minimumDivergence}`,
      selector,
      samples,
      settlement,
    );
  }
  if (expected === 'inactive' && maximumDivergence >= minimumDivergence) {
    return failedVerification(
      `base and modulated values diverged by ${maximumDivergence}; the inactive limit is ${minimumDivergence}`,
      selector,
      samples,
      settlement,
    );
  }
  return {
    verified: true, selector, samples, maximumDivergence, baseSpread,
    ...(settlement === undefined ? {} : { settlement }),
  };
}

export async function verifyPages(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  witnesses: readonly ModulatorPageWitness[],
  pause: (milliseconds: number) => Promise<void>,
): Promise<ModulatorPageVerification> {
  if (witnesses.length === 0) {
    const result = await remotePageNames(host, device, pause);
    return typeof result === 'string'
      ? failedPageVerification(result)
      : { verified: true, actualPages: result, witnesses: [] };
  }
  const actualPages: string[] = [];
  const pagesByDevice = new Map<string, readonly string[] | string>();
  const observed: (ModulatorPageWitness & {
    readonly actualCount: number;
    readonly matches: boolean;
  })[] = [];
  for (const witness of witnesses) {
    const selected = nestedWitnessDevice(device, witness.nestedDevice);
    const key = addressKey(selected);
    let result = pagesByDevice.get(key);
    if (result === undefined) {
      result = await remotePageNames(host, selected, pause);
      pagesByDevice.set(key, result);
      if (typeof result !== 'string') actualPages.push(...result);
    }
    if (typeof result === 'string') return failedPageVerification(result);
    const family = matchPageFamily(result, witness.pageName, witness.expectedCount);
    observed.push({ ...witness, ...family });
  }
  const failed = observed.filter((witness) => !witness.matches);
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

async function remotePageNames(
  host: ModulatorAuthoringHost,
  device: DeviceAddress,
  pause: (milliseconds: number) => Promise<void>,
): Promise<readonly string[] | string> {
  const inventoryAddress = remotes(device);
  let failure = 'the inserted device returned no complete remote inventory';
  const result = await settleObservation<readonly string[]>(async () => {
    try {
      const snapshot = await host.read([inventoryAddress]);
      const value = snapshot.entries[addressKey(inventoryAddress)]?.value;
      if (value?.of === 'remotes') {
        return {
          complete: true as const,
          value: value.remotes.pages.map((page) => page.name),
          progress: { stage: 'remote-pages', detail: 'the complete page inventory is stable' },
        };
      }
      failure = snapshot.unstable.some((address) => addressKey(address) === addressKey(inventoryAddress))
        ? 'the remote inventory did not settle'
        : failure;
    } catch (error) {
      throwIfCancellation(host, error);
      failure = `remote inventory failed: ${errorMessage(error)}`;
    }
    return { complete: false as const, progress: { stage: 'remote-pages', detail: failure } };
  }, settlementFor(host, pause));
  return result.complete ? result.value : settlementFailure(failure, result.report);
}

function failedPageVerification(why: string): ModulatorPageVerification {
  return { verified: false, actualPages: [], witnesses: [], why };
}

function throwIfCancellation(host: ModulatorAuthoringHost, error: unknown): void {
  host.throwIfCancelled?.();
  if (!(error instanceof Error) || error.name === 'AbortError') throw error;
}

function sampleOfParameter(parameter: ParamState): ModulationSample | undefined {
  if (!parameter.observed.modulatedValue || parameter.modulatedValue === undefined) return undefined;
  return {
    value: parameter.value,
    modulatedValue: parameter.modulatedValue,
    divergence: Math.abs(parameter.modulatedValue - parameter.value),
    ...(parameter.hasAutomation === undefined ? {} : { hasAutomation: parameter.hasAutomation }),
  };
}

function sampleOfRemote(control: RemoteControlState): ModulationSample {
  return {
    value: control.value,
    modulatedValue: control.modulatedValue,
    divergence: Math.abs(control.modulatedValue - control.value),
    ...(control.hasAutomation === undefined ? {} : { hasAutomation: control.hasAutomation }),
  };
}

function failedVerification(
  why: string,
  selector?: ParamAddress,
  samples: readonly ModulationSample[] = [],
  settlement?: SettlementReport,
): ModulationVerification {
  const bases = samples.map((sample) => sample.value);
  return {
    verified: false,
    why,
    ...(selector === undefined ? {} : { selector }),
    samples,
    maximumDivergence: max(samples.map((sample) => sample.divergence)),
    baseSpread: bases.length === 0 ? 0 : max(bases) - min(bases),
    ...(settlement === undefined ? {} : { settlement }),
  };
}

function settlementFor(
  host: ModulatorAuthoringHost,
  pause: (milliseconds: number) => Promise<void>,
  witness?: ModulatorParameterWitness,
  options: SettlementOptions = {},
): SettlementOptions {
  const legacyAttempts = witness?.inventoryAttempts;
  const legacyRetry = witness?.inventoryRetryMs;
  return {
    ...options,
    wait: pause,
    throwIfCancelled: host.throwIfCancelled,
    ...((legacyAttempts === undefined && legacyRetry === undefined) ? {} : {
      policy: {
        deadlineMs: Math.max(1, legacyAttempts ?? 3) * Math.max(1, legacyRetry ?? 200),
        retryMs: legacyRetry ?? 200,
        maximumAttempts: legacyAttempts ?? 3,
      },
    }),
  };
}

function settlementFailure(why: string, report: SettlementReport): string {
  return `${why}; stopped after ${report.elapsedMs} ms and ${report.attempts} `
    + `observation${report.attempts === 1 ? '' : 's'} (${report.cause}); last progress: `
    + `${report.lastProgress.stage}: ${report.lastProgress.detail}`;
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
  listIndex?: number,
): { readonly inserted: number; readonly removed: number } {
  if (stubValues(template).length === 0 || edit.kind === 'retarget' || edit.kind === 'amount') {
    return { inserted: 0, removed: 0 };
  }
  if (edit.kind === 'add') {
    const donor = loadDonor(edit.donorId);
    if (donor.footprint === null) {
      throw new Error(
        `this preset embeds a sample, but donor ${edit.donorId} has no measured footprint; `
        + 'a guessed footprint rejects the whole preset silently',
      );
    }
    return { inserted: donor.footprint, removed: 0 };
  }
  const removed = residentFootprint(template, edit.index, edit.removedFootprint, listIndex);
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

function residentFootprint(
  template: Buffer,
  index: number,
  explicit?: number,
  listIndex?: number,
): number {
  if (explicit !== undefined) return explicit;
  const list = findModulatorList(template, listIndex);
  const asset = identifyCuratedDonor(template.subarray(...modulatorBounds(template, index, list)));
  if (asset?.footprint != null) return asset.footprint;
  throw new Error(
    `the sampled preset modulator at index ${index} has no measured removed footprint; `
    + 'pass removedFootprint explicitly because a guess rejects the whole preset silently',
  );
}

function applyEdit(template: Buffer, edit: ModulatorEdit, listIndex?: number): Buffer {
  switch (edit.kind) {
    case 'add':
      return addModulator(template, loadDonor(edit.donorId), edit.routing, { listIndex });
    case 'replace':
      return replaceModulator(template, edit.index, loadDonor(edit.donorId), {
        listIndex,
        ...(edit.removedFootprint === undefined ? {} : { removedFootprint: edit.removedFootprint }),
      });
    case 'retarget':
      return retarget(template, edit.index, edit.target, edit.routeIndex ?? 0, listIndex);
    case 'amount':
      return setAmount(template, edit.index, edit.amount, edit.routeIndex ?? 0, listIndex);
    case 'delete':
      return deleteModulator(template, edit.index, {
        listIndex,
        ...(edit.removedFootprint === undefined ? {} : { removedFootprint: edit.removedFootprint }),
      });
  }
}

function semanticListIndex(
  inspection: Extract<ReturnType<typeof inspectPresetModulation>, { supported: true }>,
  location: SemanticModulatorLocation,
): number {
  const wanted = JSON.stringify(location);
  const matches = inspection.modulation
    .map((inventory, listIndex) => ({ inventory, listIndex }))
    .filter(({ inventory }) => JSON.stringify(inventory.location) === wanted);
  if (matches.length === 0) {
    throw new Error('The semantic modulator location is missing. Inspect the preset again.');
  }
  if (matches.length !== 1) {
    throw new Error('The semantic modulator location is ambiguous. No edit was applied.');
  }
  return matches[0]!.listIndex;
}

function assertSiblingInventories(
  before: Extract<ReturnType<typeof inspectPresetModulation>, { supported: true }>,
  after: Extract<ReturnType<typeof inspectPresetModulation>, { supported: true }>,
  selectedListIndex: number,
): void {
  if (before.modulation.length !== after.modulation.length) {
    throw new ModulatorAuthoringError('validate', 'the edit changed the semantic modulator-list count');
  }
  for (let listIndex = 0; listIndex < before.modulation.length; listIndex++) {
    if (listIndex === selectedListIndex) continue;
    if (JSON.stringify(before.modulation[listIndex]) !== JSON.stringify(after.modulation[listIndex])) {
      throw new ModulatorAuthoringError(
        'validate',
        `the edit changed sibling semantic inventory ${listIndex}`,
      );
    }
  }
}

function assertEditRequest(request: ModulatorEditRequest): void {
  assertTemplatePath(request.templatePath);
  if (request.edit.kind !== 'add'
      && (!Number.isInteger(request.edit.index) || request.edit.index < 0)) {
    throw new ModulatorAuthoringError('request', 'edit.index is out of range');
  }
  if (request.listIndex !== undefined
      && (!Number.isInteger(request.listIndex) || request.listIndex < 0)) {
    throw new ModulatorAuthoringError('request', 'listIndex is out of range');
  }
  if ((request.edit.kind === 'add' || request.edit.kind === 'replace')
      && request.edit.donorId.trim() === '') {
    throw new ModulatorAuthoringError('request', 'edit.donorId must not be empty');
  }
  if (request.edit.kind === 'add') {
    if (request.edit.routing.target.trim() === '') {
      throw new ModulatorAuthoringError('request', 'edit.routing.target must not be empty');
    }
    if (!Number.isFinite(request.edit.routing.amount)) {
      throw new ModulatorAuthoringError('request', 'edit.routing.amount must be finite');
    }
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
  if (request.edit.kind === 'amount') {
    if (!Number.isFinite(request.edit.amount)) {
      throw new ModulatorAuthoringError('request', 'edit.amount must be finite');
    }
    if (request.edit.routeIndex !== undefined
        && (!Number.isInteger(request.edit.routeIndex) || request.edit.routeIndex < 0)) {
      throw new ModulatorAuthoringError('request', 'edit.routeIndex is out of range');
    }
  }
  if ((request.edit.kind === 'replace' || request.edit.kind === 'delete')
      && request.edit.removedFootprint !== undefined
      && (!Number.isInteger(request.edit.removedFootprint) || request.edit.removedFootprint < 0)) {
    throw new ModulatorAuthoringError('request', 'edit.removedFootprint is out of range');
  }
  const pageWitnesses = request.pageWitnesses ?? [];
  const behaviorWitnesses = request.behaviorWitnesses ?? [];
  if (request.expectedDeviceName !== undefined && request.expectedDeviceName.trim() === '') {
    throw new ModulatorAuthoringError('request', 'expectedDeviceName must not be empty');
  }
  if (pageWitnesses.length + behaviorWitnesses.length === 0
      && request.expectedDeviceName === undefined) {
    throw new ModulatorAuthoringError('request', 'at least one live witness is required');
  }
  for (const witness of pageWitnesses) {
    if (witness.pageName.trim() === '') {
      throw new ModulatorAuthoringError('request', 'pageWitness.pageName must not be empty');
    }
    if (!Number.isInteger(witness.expectedCount) || witness.expectedCount < 0) {
      throw new ModulatorAuthoringError('request', 'pageWitness.expectedCount is out of range');
    }
    assertNestedDevice(witness.nestedDevice);
  }
  for (const witness of behaviorWitnesses) {
    assertWitness(witness);
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

function assertWitness(witness: ModulatorParameterWitness): void {
  if (witness.parameterId.trim() === '') {
    throw new ModulatorAuthoringError('request', 'witness.parameterId must not be empty');
  }
  if (witness.parameterName.trim() === '') {
    throw new ModulatorAuthoringError('request', 'witness.parameterName must not be empty');
  }
  assertNestedDevice(witness.nestedDevice);
  assertWitnessNumbers(witness);
}

function assertNestedDevice(nested: ModulatorParameterWitness['nestedDevice']): void {
  if (nested !== undefined) {
    const names = [nested.chainName, nested.slotName]
      .filter((name) => name !== undefined);
    if (names.length !== 1 || names[0]!.trim() === '') {
      throw new ModulatorAuthoringError(
        'request',
        'nestedDevice needs exactly one non-empty chainName or slotName',
      );
    }
    if (!Number.isInteger(nested.chainIndex) || nested.chainIndex < 0) {
      throw new ModulatorAuthoringError('request', 'nestedDevice.chainIndex is out of range');
    }
  }
}

function assertWitnessNumbers(witness: ModulatorParameterWitness): void {
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

function witnessDevice(container: DeviceAddress, witness: ModulatorParameterWitness): DeviceAddress {
  return nestedWitnessDevice(container, witness.nestedDevice);
}

function nestedWitnessDevice(
  container: DeviceAddress,
  nested: ModulatorParameterWitness['nestedDevice'],
): DeviceAddress {
  if (nested === undefined) return container;
  const parent = nested.slotName === undefined
    ? chain(container, nested.chainName!)
    : deviceSlot(container, nested.slotName);
  return deviceIn(
    parent,
    nested.chainIndex,
  );
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
