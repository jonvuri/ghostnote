/** Pure composition from one measured, human-authored wide template. */
import { createHash } from 'node:crypto';

import {
  addModulator, deleteModulator, findModulatorList, listChains, listModulators,
  loadDonor, modulatorListOffsets, readMeta, replaceModulator, retarget, setAmount,
  stubValues, validate,
  type Modulator, type ValidationResult,
} from '../bwmod/index.js';
import type { NativeCatalog } from '../native-catalog/catalog.js';
import {
  COMPOSITION_TARGETS, type CompositionTargetId, type CompositionTargetRecipe,
} from './targets.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const COMPOSITION_MODULATOR_TYPES = [
  'lfo', 'random', 'classic-lfo', 'vibrato', 'expressions',
] as const;
export type CompositionModulatorType = typeof COMPOSITION_MODULATOR_TYPES[number];

const DONOR_FOR_TYPE: Readonly<Record<CompositionModulatorType, string>> = {
  lfo: 'lfo-sampler',
  random: 'random-sampler',
  'classic-lfo': 'classiclfo-poly',
  vibrato: 'vibrato-poly',
  expressions: 'expressions-poly',
};

export interface OwnedTemplateManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly assetPath: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly authoring: {
    readonly bitwigVersion: string;
    readonly creator: string;
    readonly sourceEvidence: string;
    readonly origin: 'human-authored';
  };
  readonly container: {
    readonly name: string;
    readonly guid: string;
    readonly guidOffset: number;
    readonly outerModulatorList: {
      readonly sourceIndex: 0;
      readonly fieldOffset: number;
    };
  };
  readonly maximumEntries: number;
  readonly entries: readonly OwnedTemplateEntryManifest[];
  readonly externalReferences: {
    readonly packagedFileIds: readonly string[];
    readonly sampledPresetReferenceStubs: number;
  };
}

export interface OwnedTemplateEntryManifest {
  readonly sourceIndex: number;
  readonly chainName: string;
  readonly chainStart: number;
  readonly chainEnd: number | null;
  readonly sourceDevice: {
    readonly name: string;
    readonly guid: string;
    readonly guidOffset: number;
  };
  readonly modulatorList: {
    readonly sourceIndex: number;
    readonly fieldOffset: number;
  };
}

export type CompositionModulatorRequest =
  | {
    readonly kind: 'add';
    readonly modulator: CompositionModulatorType;
    readonly target: CompositionTargetId;
    readonly amount: number;
  }
  | {
    readonly kind: 'replace';
    readonly existing: string;
    readonly modulator: CompositionModulatorType;
    readonly target?: CompositionTargetId;
    readonly amount?: number;
  }
  | {
    readonly kind: 'retarget';
    readonly modulator: string;
    readonly target: CompositionTargetId;
    readonly amount: number;
  }
  | {
    readonly kind: 'amount';
    readonly modulator: string;
    readonly target: CompositionTargetId;
    readonly amount: number;
  }
  | {
    readonly kind: 'delete';
    readonly modulator: string;
  };

export interface CompositionEntryRequest {
  /** Exact name from the generated native-device catalog. */
  readonly deviceName: string;
  readonly modulators?: readonly CompositionModulatorRequest[];
}

export interface CompositionBinding {
  readonly entryIndex: number;
  readonly sourceIndex: number;
  readonly chainName: string;
  readonly modulatorListIndex: number;
  readonly deviceName: string;
  readonly deviceGuid: string;
  readonly deviceGuidOffset: number;
}

export interface CompositionEditWitness {
  readonly entryIndex: number;
  readonly kind: CompositionModulatorRequest['kind'];
  readonly modulatorPage: string;
  readonly expectedPageCount: number;
  readonly target?: CompositionTargetId;
  readonly behavior?: {
    readonly expected: 'active' | 'inactive';
    readonly parameterId: string;
    readonly parameterName: string;
  };
}

export interface ComposedTemplate {
  readonly preset: Buffer;
  readonly manifestId: string;
  readonly requested: readonly CompositionEntryRequest[];
  readonly bindings: readonly CompositionBinding[];
  readonly edits: readonly CompositionEditWitness[];
  readonly validationWarnings: readonly string[];
}

export interface ComposeTemplateOptions {
  /** Test seam. Production does not alter the composed bytes before validation. */
  readonly beforeValidate?: (preset: Buffer) => void;
}

export class TemplateCompositionError extends Error {
  constructor(
    readonly stage: 'request' | 'asset' | 'edit' | 'validate',
    message: string,
  ) {
    super(`template composition ${stage}: ${message}`);
    this.name = 'TemplateCompositionError';
  }
}

/**
 * Keep the final N measured entries, substitute their native devices, and edit
 * only each entry's bound modulator list.
 */
export function composeOwnedTemplate(
  source: Buffer,
  manifest: OwnedTemplateManifest,
  catalog: NativeCatalog,
  requested: readonly CompositionEntryRequest[],
  options: ComposeTemplateOptions = {},
): ComposedTemplate {
  assertRequest(requested, manifest.maximumEntries);
  assertManifest(source, manifest);
  const resolved = requested.map((entry, index) => ({
    request: copyEntry(entry),
    device: resolveNative(catalog, entry.deviceName, index),
  }));

  const retained = manifest.entries.slice(manifest.maximumEntries - requested.length);
  let out: Buffer = Buffer.from(source);
  for (const entry of manifest.entries.slice(0, manifest.maximumEntries - requested.length).reverse()) {
    if (entry.chainEnd === null) {
      throw new TemplateCompositionError('asset', `entry ${entry.sourceIndex} has no exact removable chain end`);
    }
    out = Buffer.concat([out.subarray(0, entry.chainStart), out.subarray(entry.chainEnd)]);
  }

  const trimmedBaseline = Buffer.from(out);
  const bindings = bindRetained(out, manifest, retained, resolved.map((item) => item.device));
  for (const binding of bindings) {
    const bytes = guidBytes(binding.deviceGuid);
    bytes.copy(out, binding.deviceGuidOffset);
  }

  const edits: CompositionEditWitness[] = [];
  for (const binding of bindings) {
    for (const edit of requested[binding.entryIndex]!.modulators ?? []) {
      const applied = applyNamedEdit(out, binding, edit);
      out = applied.preset;
      edits.push(applied.witness);
    }
  }

  const finalBindings = refreshBindingOffsets(out, bindings);
  assertFinalWitnesses(out, finalBindings, edits);
  options.beforeValidate?.(out);
  const warnings: string[] = [];
  const complete = validate(out, { reference: trimmedBaseline });
  assertValidation(complete, 'complete preset');
  warnings.push(...complete.warnings);
  for (let listIndex = 0; listIndex < modulatorListOffsets(out).length; listIndex++) {
    const checked = validate(out, { reference: trimmedBaseline, listIndex });
    assertValidation(checked, `modulator list ${listIndex}`);
    warnings.push(...checked.warnings);
  }

  assertComposedBindings(out, finalBindings);
  return {
    preset: Buffer.from(out),
    manifestId: manifest.id,
    requested: requested.map(copyEntry),
    bindings: finalBindings,
    edits,
    validationWarnings: [...new Set(warnings)],
  };
}

/** Refuse edit sequences whose intermediate claims cannot hold in the final preset. */
function assertFinalWitnesses(
  preset: Buffer,
  bindings: readonly CompositionBinding[],
  edits: readonly CompositionEditWitness[],
): void {
  for (const edit of edits) {
    const binding = bindings[edit.entryIndex];
    if (binding === undefined) {
      throw new TemplateCompositionError('edit', `entry ${edit.entryIndex} has no final binding`);
    }
    const matches = listModulators(preset, binding.modulatorListIndex)
      .filter((modulator) => modulator.deviceName === edit.modulatorPage);
    if (matches.length !== edit.expectedPageCount) {
      throw new TemplateCompositionError(
        'edit',
        `entry ${edit.entryIndex} ${edit.kind} witness for ${JSON.stringify(edit.modulatorPage)} `
          + `conflicts with the final page count ${matches.length}`,
      );
    }
    if (edit.behavior === undefined || edit.target === undefined) continue;
    const route = matches[0]?.routing;
    const target = targetFor(binding, edit.target);
    const active = route?.target === target.route && route.amount !== 0;
    const inactive = route?.target === target.route && route.amount === 0;
    if ((edit.behavior.expected === 'active' && !active)
        || (edit.behavior.expected === 'inactive' && !inactive)) {
      throw new TemplateCompositionError(
        'edit',
        `entry ${edit.entryIndex} ${edit.kind} witness for ${edit.target} conflicts with the final route`,
      );
    }
  }
}

function assertRequest(requested: readonly CompositionEntryRequest[], capacity: number): void {
  if (requested.length === 0) {
    throw new TemplateCompositionError('request', 'at least one entry is required');
  }
  if (requested.length > capacity) {
    throw new TemplateCompositionError('request', `requested ${requested.length} entries; capacity is ${capacity}`);
  }
  requested.forEach((entry, entryIndex) => {
    if (entry.deviceName.trim() === '') {
      throw new TemplateCompositionError('request', `entry ${entryIndex} has an empty device name`);
    }
    for (const edit of entry.modulators ?? []) assertEditRequest(edit, entryIndex);
  });
}

function assertEditRequest(edit: CompositionModulatorRequest, entryIndex: number): void {
  if ('amount' in edit && edit.amount !== undefined
      && (!Number.isFinite(edit.amount) || edit.amount < -1 || edit.amount > 1)) {
    throw new TemplateCompositionError('request', `entry ${entryIndex} modulation amount is outside -1 through 1`);
  }
  if ('modulator' in edit && edit.modulator.trim() === '') {
    throw new TemplateCompositionError('request', `entry ${entryIndex} has an empty modulator name`);
  }
  if (edit.kind === 'replace' && (edit.target === undefined) !== (edit.amount === undefined)) {
    throw new TemplateCompositionError(
      'request',
      `entry ${entryIndex} replace must provide target and amount together`,
    );
  }
}

function assertManifest(source: Buffer, manifest: OwnedTemplateManifest): void {
  const fail = (message: string): never => {
    throw new TemplateCompositionError('asset', message);
  };
  if (manifest.schemaVersion !== 1) fail(`unsupported manifest schema ${manifest.schemaVersion}`);
  if (manifest.authoring.origin !== 'human-authored') fail('the template origin is not human-authored');
  if (source.length !== manifest.byteLength) {
    fail(`byte length drifted: ${source.length}, expected ${manifest.byteLength}`);
  }
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== manifest.sha256) fail(`SHA-256 drifted: ${hash}, expected ${manifest.sha256}`);
  if (manifest.maximumEntries !== manifest.entries.length || manifest.maximumEntries < 1) {
    fail('maximumEntries does not match the entry manifest');
  }
  if (!UUID_RE.test(manifest.container.guid)) fail('container GUID is invalid');
  assertGuidAt(source, manifest.container.guidOffset, manifest.container.guid, 'container');
  const meta = readMeta(source);
  if (meta.get('application_version_name') !== manifest.authoring.bitwigVersion) {
    fail('authoring Bitwig version disagrees with preset META');
  }
  if (meta.get('creator') !== manifest.authoring.creator) fail('creator disagrees with preset META');
  if (meta.get('device_name') !== manifest.container.name) fail('container name disagrees with preset META');
  if (meta.get('device_id') !== manifest.container.guid) fail('container GUID disagrees with preset META');
  const packaged = meta.get('referenced_packaged_file_ids');
  if (!Array.isArray(packaged)
      || JSON.stringify(packaged) !== JSON.stringify(manifest.externalReferences.packagedFileIds)) {
    fail('packaged-file references disagree with the manifest');
  }
  if (stubValues(source).length !== manifest.externalReferences.sampledPresetReferenceStubs) {
    fail('sample-reference stub count disagrees with the manifest');
  }

  const chains = listChains(source);
  const lists = modulatorListOffsets(source);
  if (chains.length !== manifest.maximumEntries) fail(`found ${chains.length} chains`);
  if (lists.length !== manifest.maximumEntries + 1) fail(`found ${lists.length} modulator lists`);
  if (lists[0] !== manifest.container.outerModulatorList.fieldOffset) {
    fail('outer modulator-list binding drifted');
  }
  manifest.entries.forEach((entry, index) => {
    const chain = chains[index];
    if (entry.sourceIndex !== index || entry.modulatorList.sourceIndex !== index + 1) {
      fail(`entry ${index} indexes are not sequential`);
    }
    if (chain?.name !== entry.chainName || chain.start !== entry.chainStart || chain.end !== entry.chainEnd) {
      fail(`entry ${index} chain span drifted`);
    }
    if (lists[entry.modulatorList.sourceIndex] !== entry.modulatorList.fieldOffset) {
      fail(`entry ${index} modulator-list binding drifted`);
    }
    if (!UUID_RE.test(entry.sourceDevice.guid)) fail(`entry ${index} source GUID is invalid`);
    assertGuidAt(source, entry.sourceDevice.guidOffset, entry.sourceDevice.guid, `entry ${index}`);
    if (entry.sourceDevice.guidOffset < entry.chainStart
        || (entry.chainEnd !== null && entry.sourceDevice.guidOffset + 16 > entry.chainEnd)) {
      fail(`entry ${index} device GUID is outside its chain span`);
    }
    if (entry.modulatorList.fieldOffset < entry.chainStart
        || (entry.chainEnd !== null && entry.modulatorList.fieldOffset >= entry.chainEnd)) {
      fail(`entry ${index} modulator list is outside its chain span`);
    }
  });
}

function assertGuidAt(source: Buffer, offset: number, guid: string, label: string): void {
  const bytes = guidBytes(guid);
  if (!Number.isInteger(offset) || offset < 0 || offset + bytes.length > source.length
      || !source.subarray(offset, offset + bytes.length).equals(bytes)) {
    throw new TemplateCompositionError('asset', `${label} measured GUID occurrence drifted`);
  }
  let hits = 0;
  for (let at = source.indexOf(bytes); at !== -1; at = source.indexOf(bytes, at + 1)) hits++;
  if (hits !== 1) {
    throw new TemplateCompositionError('asset', `${label} GUID has ${hits} binary occurrences; expected one`);
  }
}

function bindRetained(
  trimmed: Buffer,
  manifest: OwnedTemplateManifest,
  retained: readonly OwnedTemplateEntryManifest[],
  devices: readonly { readonly uuid: string; readonly name: string }[],
): CompositionBinding[] {
  const chains = listChains(trimmed);
  const lists = modulatorListOffsets(trimmed);
  if (chains.length !== retained.length || lists.length !== retained.length + 1) {
    throw new TemplateCompositionError('asset', 'trim did not preserve the expected chain and list counts');
  }
  if (lists[0] !== manifest.container.outerModulatorList.fieldOffset) {
    throw new TemplateCompositionError('asset', 'trim changed the outer modulator-list binding');
  }
  return retained.map((entry, entryIndex) => {
    const chain = chains[entryIndex]!;
    const guidRelative = entry.sourceDevice.guidOffset - entry.chainStart;
    const listRelative = entry.modulatorList.fieldOffset - entry.chainStart;
    const deviceGuidOffset = chain.start + guidRelative;
    const listIndex = entryIndex + 1;
    const list = findModulatorList(trimmed, listIndex);
    if (list.fieldOffset !== chain.start + listRelative) {
      throw new TemplateCompositionError('asset', `entry ${entryIndex} lost its measured modulator-list binding`);
    }
    assertGuidAt(trimmed, deviceGuidOffset, entry.sourceDevice.guid, `retained entry ${entryIndex}`);
    return {
      entryIndex,
      sourceIndex: entry.sourceIndex,
      chainName: chain.name,
      modulatorListIndex: listIndex,
      deviceName: devices[entryIndex]!.name,
      deviceGuid: devices[entryIndex]!.uuid,
      deviceGuidOffset,
    };
  });
}

function resolveNative(
  catalog: NativeCatalog,
  name: string,
  entryIndex: number,
): { readonly uuid: string; readonly name: string } {
  if (catalog.schemaVersion !== 1) {
    throw new TemplateCompositionError('asset', `unsupported native catalog schema ${catalog.schemaVersion}`);
  }
  const matches = catalog.devices.filter((device) => device.name === name);
  if (matches.length === 0) {
    throw new TemplateCompositionError('request', `entry ${entryIndex} native device ${JSON.stringify(name)} is unknown`);
  }
  if (matches.length !== 1) {
    throw new TemplateCompositionError(
      'request',
      `entry ${entryIndex} native device ${JSON.stringify(name)} is ambiguous (${matches.length} exact matches)`,
    );
  }
  return matches[0]!;
}

function applyNamedEdit(
  preset: Buffer,
  binding: CompositionBinding,
  edit: CompositionModulatorRequest,
): { readonly preset: Buffer; readonly witness: CompositionEditWitness } {
  const target = 'target' in edit && edit.target !== undefined
    ? targetFor(binding, edit.target)
    : undefined;
  let out = preset;
  let pageName: string;
  let expectedPageCount = 1;
  switch (edit.kind) {
    case 'add': {
      const donor = loadDonor(DONOR_FOR_TYPE[edit.modulator]);
      out = addModulator(out, donor, { target: target!.route, amount: edit.amount }, {
        listIndex: binding.modulatorListIndex,
      });
      pageName = donor.deviceName;
      break;
    }
    case 'replace': {
      const index = exactModulatorIndex(out, binding.modulatorListIndex, edit.existing);
      const donor = loadDonor(DONOR_FOR_TYPE[edit.modulator]);
      out = replaceModulator(out, index, donor, { listIndex: binding.modulatorListIndex });
      pageName = donor.deviceName;
      if (target !== undefined) {
        const replacedIndex = exactModulatorIndex(out, binding.modulatorListIndex, donor.deviceName);
        out = retarget(out, replacedIndex, target.route, 0, binding.modulatorListIndex);
        out = setAmount(out, replacedIndex, edit.amount!, 0, binding.modulatorListIndex);
      }
      break;
    }
    case 'retarget': {
      const index = exactModulatorIndex(out, binding.modulatorListIndex, edit.modulator);
      out = retarget(out, index, target!.route, 0, binding.modulatorListIndex);
      out = setAmount(out, index, edit.amount, 0, binding.modulatorListIndex);
      pageName = edit.modulator;
      break;
    }
    case 'amount': {
      const index = exactModulatorIndex(out, binding.modulatorListIndex, edit.modulator);
      const route = listModulators(out, binding.modulatorListIndex)[index]?.routing;
      if (route?.target !== target!.route) {
        throw new TemplateCompositionError(
          'edit',
          `entry ${binding.entryIndex} modulator ${JSON.stringify(edit.modulator)} does not target ${edit.target}`,
        );
      }
      out = setAmount(out, index, edit.amount, 0, binding.modulatorListIndex);
      pageName = edit.modulator;
      break;
    }
    case 'delete': {
      const index = exactModulatorIndex(out, binding.modulatorListIndex, edit.modulator);
      out = deleteModulator(out, index, { listIndex: binding.modulatorListIndex });
      pageName = edit.modulator;
      expectedPageCount = 0;
      break;
    }
  }
  const amount = 'amount' in edit ? edit.amount : undefined;
  return {
    preset: out,
    witness: {
      entryIndex: binding.entryIndex,
      kind: edit.kind,
      modulatorPage: pageName,
      expectedPageCount,
      ...(edit.kind === 'delete' || target === undefined ? {} : {
        target: edit.target,
        behavior: {
          expected: amount === 0 ? 'inactive' : 'active',
          parameterId: target.parameterId,
          parameterName: target.parameterName,
        },
      }),
    },
  };
}

function exactModulatorIndex(preset: Buffer, listIndex: number, name: string): number {
  const matches = listModulators(preset, listIndex)
    .filter((modulator) => modulator.deviceName === name);
  if (matches.length === 0) {
    throw new TemplateCompositionError('edit', `modulator ${JSON.stringify(name)} is absent from the bound entry list`);
  }
  if (matches.length !== 1) {
    throw new TemplateCompositionError(
      'edit',
      `modulator ${JSON.stringify(name)} is ambiguous in the bound entry list (${matches.length} matches)`,
    );
  }
  return matches[0]!.index;
}

function targetFor(binding: CompositionBinding, id: CompositionTargetId): CompositionTargetRecipe {
  const target = COMPOSITION_TARGETS[id];
  if (target === undefined || target.deviceName !== binding.deviceName) {
    throw new TemplateCompositionError(
      'edit',
      `target ${JSON.stringify(id)} is unsupported for ${binding.deviceName}`,
    );
  }
  return target;
}

function assertValidation(result: ValidationResult, label: string): void {
  if (!result.ok) {
    throw new TemplateCompositionError('validate', `${label} failed: ${result.problems.join('; ')}`);
  }
}

function assertComposedBindings(preset: Buffer, bindings: readonly CompositionBinding[]): void {
  const chains = listChains(preset);
  if (chains.length !== bindings.length || modulatorListOffsets(preset).length !== bindings.length + 1) {
    throw new TemplateCompositionError('validate', 'the final retained structure changed after editing');
  }
  bindings.forEach((binding, index) => {
    const chain = chains[index]!;
    if (chain.name !== binding.chainName) {
      throw new TemplateCompositionError('validate', `entry ${index} chain order changed`);
    }
    const actual = preset.subarray(binding.deviceGuidOffset, binding.deviceGuidOffset + 16);
    if (!actual.equals(guidBytes(binding.deviceGuid))) {
      throw new TemplateCompositionError('validate', `entry ${index} does not contain its requested device GUID`);
    }
    if (findModulatorList(preset, binding.modulatorListIndex).fieldOffset <= chain.start) {
      throw new TemplateCompositionError('validate', `entry ${index} lost its modulator-list binding`);
    }
  });
}

function refreshBindingOffsets(
  preset: Buffer,
  bindings: readonly CompositionBinding[],
): CompositionBinding[] {
  const chains = listChains(preset);
  return bindings.map((binding, index) => {
    const chain = chains[index];
    if (chain === undefined) {
      throw new TemplateCompositionError('validate', `entry ${index} chain is absent after editing`);
    }
    const bytes = guidBytes(binding.deviceGuid);
    const limit = chain.end ?? preset.length;
    const hits: number[] = [];
    for (let at = preset.indexOf(bytes, chain.start); at !== -1 && at + bytes.length <= limit;
      at = preset.indexOf(bytes, at + 1)) {
      hits.push(at);
    }
    if (hits.length !== 1) {
      throw new TemplateCompositionError(
        'validate',
        `entry ${index} requested device GUID has ${hits.length} occurrences in its retained chain`,
      );
    }
    return { ...binding, deviceGuidOffset: hits[0]! };
  });
}

function guidBytes(guid: string): Buffer {
  if (!UUID_RE.test(guid)) throw new TemplateCompositionError('asset', `invalid GUID ${JSON.stringify(guid)}`);
  return Buffer.from(guid.replaceAll('-', ''), 'hex');
}

function copyEntry(entry: CompositionEntryRequest): CompositionEntryRequest {
  return {
    deviceName: entry.deviceName,
    ...(entry.modulators === undefined ? {} : {
      modulators: entry.modulators.map((edit) => ({ ...edit })),
    }),
  };
}

/** Semantic modulator content without unstable byte spans. */
export function compositionModulatorSemantics(preset: Buffer, listIndex: number): readonly Omit<Modulator, 'span'>[] {
  return listModulators(preset, listIndex).map(({ span: _span, ...modulator }) => modulator);
}
