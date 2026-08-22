import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readMeta } from '../bwmod/index.js';
import { TYPE, formatGuid, readStr } from '../bwmod/format.js';
import { streamOffset } from '../bwmod/header.js';

export const NATIVE_CATALOG_SCHEMA_VERSION = 1;
export const POLYSYNTH_UUID = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OBJECT_NAME_FIELD = 0x02b9;
const DEVICE_ID_FIELD = 0x0099;
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/**
 * A scalar parameter starts with its object name and one of these value fields.
 * Other named objects use different class and field pairs.
 */
const PARAMETER_SHAPES = new Map<number, readonly [fieldId: number, type: number | null]>([
  [0x0085, [0x0136, TYPE.F64]],
  [0x007f, [0x012f, TYPE.BOOL]],
  [0x00f7, [0x0273, null]],
  [0x0189, [0x0330, TYPE.U8]],
]);

export interface NativeResolutionDevice {
  readonly uuid: string;
  readonly name: string;
  readonly directParameterIds: readonly string[];
  readonly typedParameterIds: readonly string[];
}

export interface NativeResolution {
  readonly schemaVersion: 1;
  readonly bitwigVersion: string;
  readonly sourceFingerprint: string;
  readonly resolvedAt: string;
  readonly devices: readonly NativeResolutionDevice[];
}

export interface NativeCatalogDevice {
  readonly uuid: string;
  readonly name: string;
  readonly candidateParameterIds: readonly string[];
  readonly objectTokens: readonly string[];
  readonly parameterResolution:
    | { readonly status: 'unresolved' }
    | {
      readonly status: 'live-resolved';
      readonly resolvedIds: readonly string[];
      readonly unresolvedCandidateIds: readonly string[];
      readonly liveOnlyIds: readonly string[];
      readonly typedResolvedIds: readonly string[];
    };
}

export interface NativeCatalog {
  readonly schemaVersion: 1;
  readonly bitwigVersion: string;
  readonly source: {
    readonly kind: 'bitwig-native-device-settings';
    readonly fingerprint: string;
    readonly nativePresetDirectories: number;
  };
  readonly devices: readonly NativeCatalogDevice[];
}

interface ParsedPreset {
  readonly uuid: string;
  readonly name: string;
  readonly bitwigVersion: string;
  readonly candidateParameterIds: readonly string[];
  readonly objectTokens: readonly string[];
}

function normalizedUuid(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} is not a string`);
  const uuid = value.startsWith('$') ? value.slice(1) : value;
  if (!UUID_RE.test(uuid)) throw new Error(`${field} is not a UUID: ${JSON.stringify(value)}`);
  return uuid;
}

function deviceObjectStart(buf: Buffer, uuid: string): number {
  const raw = Buffer.from(uuid.replaceAll('-', ''), 'hex');
  const signature = Buffer.allocUnsafe(5 + raw.length);
  signature.writeUInt32BE(DEVICE_ID_FIELD, 0);
  signature.writeUInt8(TYPE.GUID, 4);
  raw.copy(signature, 5);
  const at = buf.indexOf(signature, streamOffset(buf));
  if (at === -1) throw new Error(`object stream has no structured device UUID ${uuid}`);
  return at + signature.length;
}

/** Read parameter-shaped objects and keep all other object names separate. */
export function parseNativePreset(buf: Buffer, expectedDirectoryUuid?: string): ParsedPreset {
  const meta = readMeta(buf);
  const uuid = normalizedUuid(meta.get('device_id'), 'META device_id');
  if (expectedDirectoryUuid !== undefined && uuid !== expectedDirectoryUuid) {
    throw new Error(`directory UUID ${expectedDirectoryUuid} disagrees with preset UUID ${uuid}`);
  }
  const name = meta.get('device_name');
  if (typeof name !== 'string' || name.length === 0) throw new Error('META device_name is empty');
  const bitwigVersion = meta.get('application_version_name');
  if (typeof bitwigVersion !== 'string' || bitwigVersion.length === 0) {
    throw new Error('META application_version_name is empty');
  }

  const candidates = new Set<string>();
  const tokens = new Set<string>();
  const start = deviceObjectStart(buf, uuid);
  for (let at = start; at + 18 <= buf.length; at++) {
    if (buf.readUInt32BE(at + 4) !== OBJECT_NAME_FIELD || buf.readUInt8(at + 8) !== TYPE.STR) continue;
    const length = buf.readUInt32BE(at + 9);
    const nameAt = at + 13;
    const nextFieldAt = nameAt + length;
    if (length > 256 || nextFieldAt + 5 > buf.length) continue;
    const objectName = readStr(buf, at + 9);
    if (objectName.length === 0 || objectName.includes('\uFFFD')) continue;

    const shape = PARAMETER_SHAPES.get(buf.readUInt32BE(at));
    const nextField = buf.readUInt32BE(nextFieldAt);
    const nextType = buf.readUInt8(nextFieldAt + 4);
    if (shape !== undefined && nextField === shape[0] && (shape[1] === null || nextType === shape[1])) {
      candidates.add(objectName);
    } else {
      tokens.add(objectName);
    }
  }

  return {
    uuid,
    name,
    bitwigVersion,
    candidateParameterIds: [...candidates].sort(compareText),
    objectTokens: [...tokens].filter((token) => !candidates.has(token)).sort(compareText),
  };
}

function validateResolution(resolution: NativeResolution, version: string, fingerprint: string): void {
  if (resolution.schemaVersion !== 1) throw new Error(`unsupported resolution schema ${resolution.schemaVersion}`);
  if (resolution.bitwigVersion !== version) {
    throw new Error(`resolution Bitwig ${resolution.bitwigVersion} disagrees with bundle ${version}`);
  }
  if (resolution.sourceFingerprint !== fingerprint) {
    throw new Error('resolution source fingerprint disagrees with the Bitwig bundle');
  }
}

/** Build a stable catalog from one explicit Bitwig application root. */
export function buildNativeCatalog(appRoot: string, resolution?: NativeResolution): NativeCatalog {
  if (appRoot.length === 0) throw new Error('Bitwig application root is required');
  const settingsRoot = join(appRoot, 'Contents', 'Resources', 'Library', 'device-settings');
  if (!existsSync(settingsRoot)) throw new Error(`device-settings directory does not exist: ${settingsRoot}`);

  const parsed: ParsedPreset[] = [];
  const sourceHash = createHash('sha256');
  for (const entry of readdirSync(settingsRoot, { withFileTypes: true }).sort((a, b) => compareText(a.name, b.name))) {
    if (!entry.isDirectory() || !UUID_RE.test(entry.name)) continue;
    const presetPath = join(settingsRoot, entry.name, 'Default.bwpreset');
    if (!existsSync(presetPath)) continue;
    const bytes = readFileSync(presetPath);
    sourceHash.update(entry.name).update('\0').update(createHash('sha256').update(bytes).digest()).update('\0');
    parsed.push(parseNativePreset(bytes, entry.name));
  }
  if (parsed.length === 0) throw new Error(`no native Default.bwpreset files found under ${settingsRoot}`);
  const versions = [...new Set(parsed.map((device) => device.bitwigVersion))];
  if (versions.length !== 1) throw new Error(`native presets disagree on Bitwig version: ${versions.join(', ')}`);
  const fingerprint = `sha256:${sourceHash.digest('hex')}`;
  if (resolution !== undefined) validateResolution(resolution, versions[0]!, fingerprint);
  const resolutionByUuid = new Map((resolution?.devices ?? []).map((device) => [device.uuid, device]));

  const devices = parsed
    .sort((left, right) => compareText(left.name, right.name) || compareText(left.uuid, right.uuid))
    .map((device): NativeCatalogDevice => {
      const base = {
        uuid: device.uuid,
        name: device.name,
        candidateParameterIds: device.candidateParameterIds,
        objectTokens: device.objectTokens,
      };
      const observed = resolutionByUuid.get(device.uuid);
      if (observed === undefined) return { ...base, parameterResolution: { status: 'unresolved' } };
      if (observed.name !== device.name) {
        throw new Error(`resolution name ${observed.name} disagrees with catalog name ${device.name}`);
      }
      const candidateSet = new Set(device.candidateParameterIds);
      const directSet = new Set(observed.directParameterIds);
      const typedSet = new Set(observed.typedParameterIds);
      const directCandidates = new Set(observed.directParameterIds.flatMap((id) =>
        id.startsWith('CONTENTS/') ? [id.slice('CONTENTS/'.length)] : []));
      const resolvedIds = device.candidateParameterIds.filter((id) => directCandidates.has(id));
      const typedResolvedIds = resolvedIds.filter((id) => typedSet.has(id));
      return {
        ...base,
        parameterResolution: {
          status: 'live-resolved',
          resolvedIds,
          unresolvedCandidateIds: device.candidateParameterIds.filter((id) => !directCandidates.has(id)),
          liveOnlyIds: [...directSet]
            .filter((id) => !id.startsWith('CONTENTS/') || !candidateSet.has(id.slice('CONTENTS/'.length)))
            .sort(compareText),
          typedResolvedIds,
        },
      };
    });

  return {
    schemaVersion: NATIVE_CATALOG_SCHEMA_VERSION,
    bitwigVersion: versions[0]!,
    source: {
      kind: 'bitwig-native-device-settings',
      fingerprint,
      nativePresetDirectories: devices.length,
    },
    devices,
  };
}

export function catalogJson(catalog: NativeCatalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

export function polysynthTypedIds(catalog: NativeCatalog): readonly string[] {
  const device = catalog.devices.find((candidate) => candidate.uuid === POLYSYNTH_UUID);
  if (device === undefined) throw new Error('catalog has no Polysynth');
  return device.parameterResolution.status === 'live-resolved'
    ? device.parameterResolution.typedResolvedIds
    : device.candidateParameterIds;
}

export function javaCatalogSource(catalog: NativeCatalog): string {
  const ids = polysynthTypedIds(catalog);
  const rows = ids.map((id) => `        ${JSON.stringify(id)},`).join('\n');
  return `package com.ghostnote.extension.generated;\n\n` +
    `/** Generated native catalog input. Run npm run catalog:native in brain. */\n` +
    `public final class NativeDeviceCatalog {\n` +
    `    public static final String POLYSYNTH_UUID = ${JSON.stringify(POLYSYNTH_UUID)};\n` +
    `    public static final String[] POLYSYNTH_PARAMETER_IDS = {\n${rows}\n    };\n\n` +
    `    private NativeDeviceCatalog() {}\n` +
    `}\n`;
}
