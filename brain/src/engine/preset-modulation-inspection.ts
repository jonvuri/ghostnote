/** Read-only semantic inspection of one human-saved Bitwig preset. */
import { createHash } from 'node:crypto';

import {
  FID, TYPE, findModulatorList, hasCountStubs, listChains, listModulators,
  modulatorListOffsets, parseHeader, readMeta,
} from '../bwmod/index.js';
import { readStr } from '../bwmod/format.js';
import { findFields } from '../bwmod/stream.js';

export interface PresetFingerprint {
  readonly algorithm: 'sha256';
  readonly sha256: string;
  readonly byteLength: number;
}

export type PresetHostFormat = 'native' | 'vst3' | 'clap';

export interface SemanticDeviceStep {
  readonly position: number;
  readonly name: string;
}

export type SemanticModulatorLocation =
  | { readonly kind: 'self' }
  | { readonly kind: 'container'; readonly name: string }
  | {
    readonly kind: 'entry';
    readonly entry: { readonly position: number; readonly name: string };
    readonly devicePath: readonly SemanticDeviceStep[];
  };

export type PublicModulationTarget =
  | {
    readonly standing: 'resolved';
    readonly parameter: { readonly parameterId: string; readonly parameterName: string };
  }
  | { readonly standing: 'unresolved' };

export interface PublicPresetModulator {
  readonly position: number;
  readonly name: string;
  readonly category: string;
  readonly routes: readonly {
    readonly position: number;
    readonly amount: number;
    readonly rangeLo?: number;
    readonly rangeHi?: number;
    readonly target: PublicModulationTarget;
  }[];
}

export interface SemanticModulatorInventory {
  readonly location: SemanticModulatorLocation;
  readonly modulators: readonly PublicPresetModulator[];
}

export interface PresetEntryInventory {
  readonly position: number;
  readonly name: string;
  readonly devices: readonly SemanticDeviceStep[];
}

export type PresetModulationInspection =
  | {
    readonly supported: true;
    readonly fingerprint: PresetFingerprint;
    readonly host: {
      readonly tier: 'tier-1' | 'tier-2';
      readonly format: PresetHostFormat;
      readonly name: string;
      readonly creator: string;
    };
    readonly containerKind: string | null;
    readonly entries: readonly PresetEntryInventory[];
    readonly modulation: readonly SemanticModulatorInventory[];
    readonly complete: true;
  }
  | {
    readonly supported: false;
    readonly fingerprint: PresetFingerprint;
    readonly why: string;
  };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PARAMETER_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Polysynth: {
    'CONTENTS/F1FREQ': 'Filter Frequency',
    'CONTENTS/F1RESO': 'Filter Resonance',
    'CONTENTS/PITCH': 'Pitch',
  },
  Sampler: {
    'CONTENTS/AMP_ATTACK_TIME': 'AEG Attack Time',
    'CONTENTS/TRANSPOSE': 'Transpose',
  },
  'Delay+': { 'CONTENTS/BLUR': 'Blur Amount' },
  'Phase-4': { 'CONTENTS/PITCH': 'Pitch' },
  Organ: { 'CONTENTS/PITCH': 'Pitch' },
  Zebra3: { 'CONTENTS/PID411': 'Cutoff' },
};

export class PresetInspectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetInspectionError';
  }
}

/** Create the public identity that guards a later write against stale bytes. */
export function fingerprintPreset(preset: Buffer): PresetFingerprint {
  return {
    algorithm: 'sha256',
    sha256: createHash('sha256').update(preset).digest('hex'),
    byteLength: preset.length,
  };
}

/** Refuse a later write when the inspected file bytes are no longer exact. */
export function assertPresetFingerprint(preset: Buffer, expected: PresetFingerprint): void {
  const actual = fingerprintPreset(preset);
  if (expected.algorithm !== 'sha256'
      || expected.sha256 !== actual.sha256
      || expected.byteLength !== actual.byteLength) {
    throw new PresetInspectionError(
      'The preset file changed after inspection. Inspect it again before a write.',
    );
  }
}

/** Inspect one in-memory preset without changing it. */
export function inspectPresetModulation(preset: Buffer): PresetModulationInspection {
  const fingerprint = fingerprintPreset(preset);
  try {
    const header = parseHeader(preset);
    if (header.encoding !== '0002') return unsupported(fingerprint);

    const meta = readMeta(preset);
    const name = requiredMetaString(meta, 'device_name');
    const creator = requiredMetaString(meta, 'device_creator');
    const category = requiredMetaString(meta, 'device_category');
    const format = hostFormat(requiredMetaString(meta, 'device_id'));
    if (format === null) return unsupported(fingerprint);

    const lists = modulatorListOffsets(preset);
    if (lists.length === 0) return unsupported(fingerprint);
    const chains = listChains(preset);
    const deviceNames = deviceNameFields(preset);
    const isContainer = category === 'Container';

    let bindings: InternalBinding[];
    let entries: PresetEntryInventory[];
    let containerKind: string | null;
    if (!isContainer) {
      if (chains.length !== 0 || lists.length !== 1
          || exactOwnerName(deviceNames, header.streamOffset, lists[0]!) !== name) {
        return unsupported(fingerprint);
      }
      bindings = [{ listPosition: 0, deviceName: name, location: { kind: 'self' } }];
      entries = [];
      containerKind = null;
    } else {
      const mapped = bindContainer(preset, name, lists, chains, deviceNames, header.streamOffset);
      if (mapped === null) return unsupported(fingerprint);
      bindings = mapped.bindings;
      entries = mapped.entries;
      containerKind = name;
    }

    if (bindings.length !== lists.length
        || new Set(bindings.map((binding) => binding.listPosition)).size !== lists.length
        || new Set(bindings.map((binding) => JSON.stringify(binding.location))).size !== lists.length) {
      return unsupported(fingerprint);
    }

    return {
      supported: true,
      fingerprint,
      host: {
        tier: hasCountStubs(preset) ? 'tier-2' : 'tier-1',
        format,
        name,
        creator,
      },
      containerKind,
      entries,
      modulation: bindings
        .sort((left, right) => left.listPosition - right.listPosition)
        .map((binding) => ({
          location: binding.location,
          modulators: publicModulators(preset, binding.listPosition, binding.deviceName),
        })),
      complete: true,
    };
  } catch {
    return unsupported(fingerprint);
  }
}

interface DeviceNameField {
  readonly fieldStart: number;
  readonly name: string;
}

interface InternalBinding {
  readonly listPosition: number;
  readonly deviceName: string;
  readonly location: SemanticModulatorLocation;
}

function unsupported(fingerprint: PresetFingerprint): PresetModulationInspection {
  return {
    supported: false,
    fingerprint,
    why: 'The preset structure does not provide one complete, unambiguous semantic modulator mapping.',
  };
}

function requiredMetaString(meta: Map<string, unknown>, key: string): string {
  const value = meta.get(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PresetInspectionError(`Preset metadata is incomplete: ${key}.`);
  }
  return value;
}

function hostFormat(deviceId: string): PresetHostFormat | null {
  if (deviceId.startsWith('vst3:')) return 'vst3';
  if (deviceId.startsWith('clap:')) return 'clap';
  return UUID_RE.test(deviceId) ? 'native' : null;
}

function deviceNameFields(preset: Buffer): DeviceNameField[] {
  return findFields(preset, 0, preset.length, FID.DEVICE_NAME, TYPE.STR).map((valueStart) => ({
    fieldStart: valueStart - 5,
    name: readStr(preset, valueStart),
  }));
}

function exactOwnerName(
  names: readonly DeviceNameField[],
  start: number,
  end: number,
): string | null {
  const candidates = names.filter((candidate) => candidate.fieldStart >= start && candidate.fieldStart < end);
  return candidates.length === 1 ? candidates[0]!.name : null;
}

function bindContainer(
  preset: Buffer,
  containerName: string,
  lists: readonly number[],
  chains: ReturnType<typeof listChains>,
  names: readonly DeviceNameField[],
  streamStart: number,
): { readonly bindings: InternalBinding[]; readonly entries: PresetEntryInventory[] } | null {
  if (chains.length === 0) return null;
  const firstChainStart = chains[0]!.start;
  const outerLists = lists
    .map((fieldStart, listPosition) => ({ fieldStart, listPosition }))
    .filter((item) => item.fieldStart < firstChainStart);
  if (outerLists.length !== 1
      || exactOwnerName(names, streamStart, outerLists[0]!.fieldStart) !== containerName) return null;

  const bindings: InternalBinding[] = [{
    listPosition: outerLists[0]!.listPosition,
    deviceName: containerName,
    location: { kind: 'container', name: containerName },
  }];
  const entries: PresetEntryInventory[] = [];

  for (const chain of chains) {
    const chainEnd = chain.end ?? preset.length;
    const chainLists = lists
      .map((fieldStart, listPosition) => ({ fieldStart, listPosition }))
      .filter((item) => item.fieldStart >= chain.start && item.fieldStart < chainEnd);
    if (chainLists.length === 0) return null;

    let ownerStart = chain.start;
    const devices: SemanticDeviceStep[] = [];
    for (const item of chainLists) {
      const deviceName = exactOwnerName(names, ownerStart, item.fieldStart);
      if (deviceName === null) return null;
      const device = { position: devices.length, name: deviceName };
      devices.push(device);
      bindings.push({
        listPosition: item.listPosition,
        deviceName,
        location: {
          kind: 'entry',
          entry: { position: chain.index, name: chain.name },
          devicePath: [device],
        },
      });
      ownerStart = findModulatorList(preset, item.listPosition).listEnd + 8;
    }
    entries.push({ position: chain.index, name: chain.name, devices });
  }

  const mapped = new Set(bindings.map((binding) => binding.listPosition));
  if (mapped.size !== lists.length) return null;
  return { bindings, entries };
}

function publicModulators(
  preset: Buffer,
  listPosition: number,
  deviceName: string,
): PublicPresetModulator[] {
  return listModulators(preset, listPosition).map((modulator) => ({
    position: modulator.index,
    name: modulator.deviceName,
    category: modulator.category,
    routes: modulator.routes.map((route, position) => ({
      position,
      amount: route.amount,
      ...(route.rangeLo === undefined ? {} : { rangeLo: route.rangeLo }),
      ...(route.rangeHi === undefined ? {} : { rangeHi: route.rangeHi }),
      target: resolveTarget(deviceName, route.target),
    })),
  }));
}

function resolveTarget(deviceName: string, route: string): PublicModulationTarget {
  const plugin = /^CONTENTS\/ROOT_GENERIC_MODULE\/(PID[0-9a-f]+)$/i.exec(route)?.[1];
  const parameterId = plugin === undefined ? route : `CONTENTS/${plugin}`;
  const parameterName = PARAMETER_NAMES[deviceName]?.[parameterId];
  return parameterName === undefined
    ? { standing: 'unresolved' }
    : { standing: 'resolved', parameter: { parameterId, parameterName } };
}
