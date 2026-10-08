/**
 * The device and layer-chain tools of `agent-native-v1` (8h4e, D18).
 *
 * D18: Instrument Layer and FX Layer are ordinary container devices. Their named
 * parallel children are layer chains. There is no managed device-alternate
 * object. A/B audition and winner collapse are recipes over the generic limbs
 * here; the tool text states them.
 *
 * Vocabulary (E135): `container` is the parent device, `containerKind` names
 * its kind, and `layer_chain` is one named parallel child. Do not use bare
 * `chain` in a public name.
 *
 * Reach: only the top-level positions 0 through 2 expose layer chains (the
 * three slot scopes of `Rig`). Each limb reads the complete structure first and
 * refuses before a write when the route is not observable.
 *
 * This module imports only types from `tools.ts`. `tools.ts` calls
 * `agentNativeDeviceTools` with the stable tools, so there is no import cycle.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { z } from 'zod';

import { NATIVE_CATALOG_PATH } from '../composition/index.js';
import {
  addressKey, chain as chainAt, device as deviceAt, deviceIn, lookupChain, projectedReorder,
  track as trackAt, verifyExclusiveChain,
  type ChainAddress, type DeviceAddress, type DeviceSource, type DeviceState, type ObservedChain,
  type ObservedContainer, type ObservedDeviceBank, type Op, type TrackAddress,
} from '../contract/index.js';
import { takeAppliedAnything } from '../engine/index.js';
import {
  isNativeDeviceUuid, NativeNameResolutionError, resolveExactNativeDevices, type NativeCatalog,
} from '../native-catalog/catalog.js';
import type { StashedChangeset } from '../stash/index.js';
import {
  AGENT_NATIVE_TOOL_PROFILE, ToolFailure, failureResult,
  type Effect, type FailureStage, type ReadResult, type WriteResult,
} from './agent-native-result.js';
import {
  deviceControlSchemas, enabledFingerprint, readDeviceControls, setDeviceControls,
  type DeviceControlNames, type ParameterSetting,
} from './device-controls.js';
import {
  deviceStructureCompositionInputValidator, modulatorEdit, runDeviceStructureComposition,
} from './device-structure-composition.js';
import {
  drumMachineCompositionInputValidator, drumPadAssignment, runDrumMachineComposition,
} from './drum-machine-composition.js';
import { existingDeviceModulationWrapperSchemas } from './existing-device-modulation-wrapper.js';
import {
  generalDeviceCompositionInputValidator, modulation, runGeneralDeviceComposition,
  source as compositionSource,
} from './general-device-composition.js';
import { modulatorAuthoringSchemas, runModulatorAuthoring } from './modulator-authoring.js';
import {
  presetModulationInspectionInputSchema, presetModulationInspectionInputValidator,
  runPresetModulationInspection,
} from './preset-modulation-inspection.js';
import { causeOf, receiptOf } from './report.js';
import type { ToolSpec } from './tools.js';
import type { Workspace } from './workspace.js';

export const DEVICES_SCHEMA = 'ghostnote-devices/1';
export const ADD_DEVICES_SCHEMA = 'ghostnote-device-add/1';
export const COMPOSE_SCHEMA = 'ghostnote-device-compose/1';
export const DUPLICATE_SCHEMA = 'ghostnote-layer-chain-duplicate/1';
export const RENAME_SCHEMA = 'ghostnote-layer-chain-rename/1';
export const MOVE_SCHEMA = 'ghostnote-device-move/1';
export const COPY_SCHEMA = 'ghostnote-device-copy/1';
export const SOLO_SCHEMA = 'ghostnote-layer-chain-solo/1';
export const DELETE_DEVICE_SCHEMA = 'ghostnote-device-delete/1';

/** The top-level positions whose layer chains `Rig` can observe (three slot scopes). */
export const LAYER_CHAIN_POSITIONS = 3;

const PROFILE = `Profile ${AGENT_NATIVE_TOOL_PROFILE}.`;
const FAILURE_FIELDS = ['schema', 'failure.code', 'failure.stage', 'failure.effects', 'message', 'retryWhen', 'detail'];
const WRITE_FIELDS = ['schema', 'applied', 'effects', 'readback', 'next', 'warnings', 'timing', 'target'];
const READ_FIELDS = ['schema', 'source', 'target', 'coverage', 'authority', 'data', 'warnings', 'timing'];

export const AGENT_NATIVE_DEVICE_NAMES: DeviceControlNames = {
  readControls: 'read_device_controls',
  readDevices: 'read_devices',
  layerStep: 'layer-chain',
  layerStepName: 'The exact layer-chain name returned by read_devices.',
};

const trackId = z.string().min(1).describe('Durable track ID from list_tracks.');
const { deviceTarget, parameterSetting, expectedDeviceOrder } = deviceControlSchemas(
  trackId, AGENT_NATIVE_DEVICE_NAMES,
);
const containerPosition = z.number().int().min(0).max(LAYER_CHAIN_POSITIONS - 1).describe(
  'Top-level position of the container, from read_devices. Only positions 0 through 2 expose layer chains.',
);
const layerChainName = z.string().min(1).describe('Exact layer-chain name from read_devices.');
const newLayerChainName = z.string().min(1).refine((name) => name.trim().length > 0, {
  message: 'A layer-chain name cannot contain only whitespace.',
}).describe('New unique layer-chain name in this container.');

const SOURCE = Object.freeze({ host: 'bitwig-devices', read: 'fresh-structure-read' });

// --- shared pieces -------------------------------------------------------------

interface RunState {
  stage: FailureStage;
  effects: Effect[];
}

/** Run one tool body. A throw becomes the failure envelope with the effects that happened first. */
async function guardedRun(
  schema: string,
  target: Readonly<Record<string, unknown>> | undefined,
  body: (state: RunState) => Promise<unknown>,
): Promise<unknown> {
  const state: RunState = { stage: 'input', effects: [] };
  try {
    return await body(state);
  } catch (error) {
    const failure = failureResult(schema, state.stage, error, target);
    return state.effects.length === 0 ? failure
      : { ...failure, failure: { ...failure.failure, effects: [...state.effects, ...failure.failure.effects] } };
  }
}

function effectOf(change: StashedChangeset, target: Readonly<Record<string, unknown>>, summary: string): Effect {
  return { changeId: change.take.id, target, summary, fidelity: change.take.fidelity };
}

/**
 * Record the effect of one recorded change and require complete readback. A change that the guard refused
 * whole wrote nothing. A change that wrote and then failed its readback keeps its effect.
 */
function requireProved(
  state: RunState, change: StashedChangeset, target: Readonly<Record<string, unknown>>, summary: string,
): void {
  const receipt = receiptOf(change);
  if (!takeAppliedAnything(change.take)) {
    throw new ToolFailure('target-changed', 'write', 'The device structure changed before the write. '
      + 'Nothing was written.', { retryWhen: 'after a fresh read_devices', detail: {
        ...(receipt.failed === undefined ? {} : { failed: receipt.failed }) } });
  }
  state.effects.push(effectOf(change, target, summary));
  if (!receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
      || receipt.notReadBack !== undefined) {
    throw new ToolFailure('unavailable', 'readback', `${summary} The write was not proved by readback. `
      + 'Read the structure again with read_devices before the next write.', { detail: {
        ...(receipt.failed === undefined ? {} : { failed: receipt.failed }),
        ...(receipt.mismatches === undefined ? {} : { mismatches: receipt.mismatches }),
        ...(receipt.notReadBack === undefined ? {} : { notReadBack: receipt.notReadBack }),
      } });
  }
}

/** The complete top-level bank with every enabled state. */
async function completeBank(workspace: Workspace, track: TrackAddress): Promise<ObservedDeviceBank & {
  readonly bankSize: number;
  readonly enabled: readonly boolean[];
}> {
  const bank = await workspace.devices(track);
  const enabled = enabledFingerprint(bank);
  if (!bank.devicesComplete || bank.bankSize === undefined || enabled === undefined) {
    throw new ToolFailure('partial', 'acquire', 'The complete top-level device order and enabled states are not '
      + 'visible. Nothing was written.', { detail: { devices: bank.devices.length, bankSize: bank.bankSize ?? null } });
  }
  return { ...bank, bankSize: bank.bankSize, enabled };
}

/** One structure read of the devices at the named positions (no parameter inventory). */
async function structureAt(
  workspace: Workspace, track: TrackAddress, positions: readonly number[],
): Promise<Map<number, DeviceState | 'unreachable' | 'missing'>> {
  const out = new Map<number, DeviceState | 'unreachable' | 'missing'>();
  if (positions.length === 0) return out;
  const addresses = positions.map((position) => deviceAt(track, position));
  const snapshot = await workspace.read(addresses, { structure: true });
  for (const [index, address] of addresses.entries()) {
    const key = addressKey(address);
    const entry = snapshot.entries[key];
    if (entry?.value.of === 'device') out.set(positions[index]!, entry.value.device);
    else if (snapshot.unreachable.some((item) => addressKey(item) === key)
      || snapshot.unstable.some((item) => addressKey(item) === key)) out.set(positions[index]!, 'unreachable');
    else out.set(positions[index]!, 'missing');
  }
  return out;
}

interface ReadContainer {
  readonly device: DeviceState;
  readonly container: ObservedContainer;
  readonly address: DeviceAddress;
}

/** One complete layer container at a top-level position, or a typed failure. */
async function readContainer(workspace: Workspace, id: string, position: number): Promise<ReadContainer> {
  const track = trackAt(id);
  if (position >= LAYER_CHAIN_POSITIONS) {
    throw new ToolFailure('outside-limit', 'acquire', 'Only top-level positions 0 through 2 expose layer chains.');
  }
  const read = (await structureAt(workspace, track, [position])).get(position);
  if (read === 'missing' || read === undefined) {
    throw new ToolFailure('absent', 'acquire', `No device is at top-level position ${position}. Use read_devices.`);
  }
  if (read === 'unreachable') {
    throw new ToolFailure('authority-unavailable', 'acquire', 'The container structure did not read.',
      { retryWhen: 'once; then check the connection' });
  }
  const container = read.container;
  if (container === undefined || (container.chains.length === 0 && (container.slots?.length ?? 0) > 0)) {
    throw new ToolFailure('unsupported', 'acquire', `The device at position ${position} (${read.name}) is not a `
      + 'layer container.', { detail: { reason: 'not-a-layer-container', deviceName: read.name } });
  }
  if (!container.chainsComplete) {
    throw new ToolFailure('partial', 'acquire', 'The complete layer-chain list is not visible. Nothing was written.');
  }
  return { device: read, container, address: deviceAt(track, position) };
}

function requireChain(container: ObservedContainer, name: string): ObservedChain {
  const found = lookupChain(container, name);
  if (found.ok) return found.chain;
  if (found.miss === 'ambiguous') {
    throw new ToolFailure('invalid-input', 'resolve', `More than one layer chain is named "${name}". A typed write `
      + 'cannot address it. Rename one with computer control in Bitwig, then read_devices again.',
    { detail: { reason: 'ambiguous-layer-chain' } });
  }
  throw new ToolFailure('absent', 'resolve', `No layer chain is named "${name}". Use read_devices.`);
}

function requireNewName(container: ObservedContainer, name: string): void {
  if (container.chains.some((item) => item.name === name)) {
    throw new ToolFailure('collision', 'input', `A layer chain is already named "${name}". Layer-chain names `
      + 'must be unique in a container.');
  }
}

/** The public shape of one layer chain. */
function publicLayerChain(item: ObservedChain) {
  return {
    position: item.index,
    name: item.name,
    solo: typeof item.solo === 'boolean' ? item.solo : null,
    mute: typeof item.mute === 'boolean' ? item.mute : null,
    volume: typeof item.volume === 'number' ? item.volume : null,
    pan: typeof item.pan === 'number' ? item.pan : null,
    color: item.color ?? null,
    devices: item.devices.map((nested) => ({ devicePosition: nested.index, name: nested.name })),
    devicesComplete: item.devicesComplete,
    deviceCapacity: item.devicesBankSize ?? null,
  };
}

function publicContainer(device: DeviceState) {
  const container = device.container!;
  return {
    containerKind: device.name,
    layerChains: container.chains.map(publicLayerChain),
    complete: container.chainsComplete && container.chains.every((item) => item.devicesComplete),
    capacity: container.chainsBankSize ?? null,
  };
}

const sameNames = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((name, index) => name === right[index]);

const containerTarget = (args: { trackId: string; containerPosition: number }) =>
  ({ trackId: args.trackId, containerPosition: args.containerPosition });

// --- read_devices --------------------------------------------------------------

const readInput = z.object({ trackId }).strict();
type ReadInput = z.infer<typeof readInput>;

const READ_DESCRIPTION = `${PROFILE} Read the complete top-level device order of one track, and the layer `
  + 'chains of each container at top-level positions 0 through 2. Each device has its devicePosition, name, and '
  + 'enabled state. A container (Instrument Layer or FX Layer; containerKind) lists its layer chains in order: '
  + 'name, solo, mute, volume, pan, colour, and the ordered devices in each. Positions are not IDs: a device-order '
  + 'edit changes later positions, so read again after each structural edit. Layer-chain names are the address '
  + 'of a layer chain. A device after position 2 reports layerChains outside-limit: its chains are not '
  + 'observable. coverage states the bank size and completeness; a partial view is not evidence that the hidden '
  + 'tail is empty. Instrument Layer chains all receive the same MIDI input and run in parallel; there is no '
  + 'per-note routing. This reads no parameters (use read_device_controls).\n'
  + 'Recipes over the generic limbs. A/B audition: compose_devices or duplicate_layer_chain makes the named layer '
  + 'chains; edit each with the device tools; set_layer_chain_solo mode exclusive makes one audible; repeat that '
  + 'call while the person listens. Winner collapse: read_devices; move_devices the winning layer chain\'s devices '
  + 'to the track end; check that the layer chain is empty; delete_device the container; move_devices the '
  + 'extracted devices to the former container position; read_devices again. The steps are not atomic. Each step '
  + 'needs fresh structure. Layer-chain name, mute, solo, volume, pan, and colour do not move with the devices.';

async function readDevices(workspace: Workspace, args: ReadInput): Promise<unknown> {
  const started = performance.now();
  const target = { trackId: args.trackId };
  try {
    const track = trackAt(args.trackId);
    const bank = await workspace.devices(track);
    const scoped = bank.devices.map((item) => item.index).filter((index) => index < LAYER_CHAIN_POSITIONS);
    const structure = await structureAt(workspace, track, scoped);
    let containersComplete = true;
    const devices = bank.devices.map((item) => {
      const base = { devicePosition: item.index, name: item.name, enabled: item.enabled ?? null };
      if (item.index >= LAYER_CHAIN_POSITIONS) return { ...base, layerChains: 'outside-limit' as const };
      const read = structure.get(item.index);
      if (read === undefined || typeof read === 'string') {
        containersComplete = false;
        return { ...base, layerChains: 'unavailable' as const };
      }
      if (read.container === undefined || read.container.chains.length === 0) {
        if (read.container !== undefined && !read.container.chainsComplete) containersComplete = false;
        return base;
      }
      const container = publicContainer(read);
      if (!container.complete) containersComplete = false;
      return { ...base, container };
    });
    const result: ReadResult<Record<string, unknown>> = {
      schema: DEVICES_SCHEMA,
      source: SOURCE,
      target,
      coverage: {
        status: bank.devicesComplete && containersComplete ? 'complete' : 'partial',
        devicesComplete: bank.devicesComplete,
        bankSize: bank.bankSize ?? null,
        layerChainPositions: [0, 1, 2],
      },
      authority: { kind: 'fresh-read' },
      data: { trackId: args.trackId, devices },
      warnings: [],
      timing: { totalMs: performance.now() - started },
    };
    return result;
  } catch (error) {
    return failureResult(DEVICES_SCHEMA, 'acquire', error, target);
  }
}

// --- set_layer_chain_solo ------------------------------------------------------

const soloInput = z.object({
  trackId,
  containerPosition,
  layerChain: layerChainName,
  mode: z.enum(['exclusive', 'on', 'off']).describe(
    'exclusive: solo this layer chain and clear solo on every other one. on or off: set only this layer chain.',
  ),
}).strict();
type SoloInput = z.infer<typeof soloInput>;

const SOLO_DESCRIPTION = `${PROFILE} Set the container-local solo of one layer chain. mode exclusive solos the `
  + 'named layer chain and clears solo on every other layer chain in the container: the A/B audition step. mode on '
  + 'or off changes only the named layer chain. The call is idempotent: when the state already matches, nothing is '
  + 'written (applied false, readback status already-set). The solo flag of every layer chain must be readable or '
  + 'nothing is written. A fresh container read proves the result. The change is immediate and not beat-aligned, '
  + 'and it can change the sound at once. Layer-chain solo does not change track solo. There is no automatic '
  + 'reversal: call again with the earlier state.';

async function setLayerChainSolo(workspace: Workspace, args: SoloInput): Promise<unknown> {
  const started = performance.now();
  const target = { ...containerTarget(args), layerChain: args.layerChain, mode: args.mode };
  return guardedRun(SOLO_SCHEMA, target, async (state) => {
    state.stage = 'acquire';
    const before = await readContainer(workspace, args.trackId, args.containerPosition);
    const chain = requireChain(before.container, args.layerChain);
    const unknown = before.container.chains.filter((item) => typeof item.solo !== 'boolean');
    if (unknown.length > 0) {
      throw new ToolFailure('unavailable', 'acquire', 'The solo state of every layer chain must be readable. '
        + 'Nothing was written.', { detail: { layerChains: unknown.map((item) => item.name) } });
    }
    const solos = (container: ObservedContainer) => container.chains.map((item) => ({
      name: item.name, solo: item.solo === true }));
    const matches = (container: ObservedContainer): boolean => {
      const found = lookupChain(container, args.layerChain);
      if (!found.ok || container.chains.some((item) => typeof item.solo !== 'boolean')) return false;
      if (args.mode === 'exclusive') return verifyExclusiveChain(container, args.layerChain).ok;
      return found.chain.solo === (args.mode === 'on');
    };
    if (matches(before.container)) {
      const result: WriteResult<unknown> = {
        schema: SOLO_SCHEMA, applied: false, effects: [],
        readback: { status: 'already-set', layerChains: solos(before.container) },
        warnings: [], timing: { totalMs: performance.now() - started },
      };
      return { ...result, target };
    }
    state.stage = 'write';
    const address: ChainAddress = chainAt(before.address, chain.name);
    const op: Op = args.mode === 'exclusive'
      ? { op: 'chain.activate', chain: address }
      : { op: 'chain.solo', chain: address, solo: args.mode === 'on' };
    const change = await workspace.apply([op]);
    requireProved(state, change, target, `Set layer chain "${args.layerChain}" solo ${args.mode}.`);
    state.stage = 'readback';
    const after = await readContainer(workspace, args.trackId, args.containerPosition);
    const result: WriteResult<unknown> = {
      schema: SOLO_SCHEMA, applied: true, effects: state.effects,
      readback: { status: matches(after.container) ? 'verified' : 'differs', layerChains: solos(after.container) },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

// --- rename_layer_chain --------------------------------------------------------

const renameInput = z.object({ trackId, containerPosition, layerChain: layerChainName, name: newLayerChainName })
  .strict();
type RenameInput = z.infer<typeof renameInput>;

const RENAME_DESCRIPTION = `${PROFILE} Give one layer chain a new durable name. The name is the address of a `
  + 'layer chain, and it must be unique in its container: a blank, used, or ambiguous name refuses before a write. '
  + 'A fresh container read proves the new name on the same layer chain. There is no automatic reversal: rename '
  + 'it again.';

async function renameLayerChain(workspace: Workspace, args: RenameInput): Promise<unknown> {
  const started = performance.now();
  const target = { ...containerTarget(args), layerChain: args.layerChain };
  return guardedRun(RENAME_SCHEMA, target, async (state) => {
    state.stage = 'acquire';
    const before = await readContainer(workspace, args.trackId, args.containerPosition);
    requireChain(before.container, args.layerChain);
    if (args.name === args.layerChain) {
      throw new ToolFailure('invalid-input', 'input', 'The new name must differ from the current name.');
    }
    requireNewName(before.container, args.name);
    state.stage = 'write';
    const change = await workspace.apply([{
      op: 'chain.rename', chain: chainAt(before.address, args.layerChain), name: args.name }]);
    requireProved(state, change, target, `Renamed layer chain "${args.layerChain}" to "${args.name}".`);
    state.stage = 'readback';
    const after = await readContainer(workspace, args.trackId, args.containerPosition);
    const found = lookupChain(after.container, args.name);
    const result: WriteResult<unknown> = {
      schema: RENAME_SCHEMA, applied: true, effects: state.effects,
      readback: {
        status: found.ok && !after.container.chains.some((item) => item.name === args.layerChain)
          ? 'verified' : 'differs',
        layerChains: after.container.chains.map((item) => item.name),
      },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

// --- duplicate_layer_chain -----------------------------------------------------

const duplicateInput = z.object({ trackId, containerPosition, layerChain: layerChainName, name: newLayerChainName })
  .strict();
type DuplicateInput = z.infer<typeof duplicateInput>;

const DUPLICATE_DESCRIPTION = `${PROFILE} Copy one complete layer chain, with its devices and device state, to a `
  + 'new layer chain with a new unique name. Bitwig has no typed route to create an empty layer chain, so a new '
  + 'layer chain always starts as a copy. A container holds at most 5 layer chains here. The copy loads new '
  + 'device instances and can add engine load; it is audible at once unless solo excludes it. readback gives the '
  + 'position where the copy landed. No typed operation deletes one layer chain, so revert_change cannot remove '
  + 'the copy: remove it with computer control in Bitwig, then read_devices again.';

async function duplicateLayerChain(workspace: Workspace, args: DuplicateInput): Promise<unknown> {
  const started = performance.now();
  const target = { ...containerTarget(args), layerChain: args.layerChain };
  return guardedRun(DUPLICATE_SCHEMA, target, async (state) => {
    state.stage = 'acquire';
    const before = await readContainer(workspace, args.trackId, args.containerPosition);
    const source = requireChain(before.container, args.layerChain);
    requireNewName(before.container, args.name);
    if (!source.devicesComplete) {
      throw new ToolFailure('partial', 'acquire', 'The device list of the source layer chain is not complete.');
    }
    const capacity = before.container.chainsBankSize;
    if (capacity === undefined || before.container.chains.length >= capacity) {
      throw new ToolFailure('outside-limit', 'acquire', `The container already holds ${before.container.chains.length} `
        + `layer chains, the observable limit${capacity === undefined ? '' : ` of ${capacity}`}.`);
    }
    state.stage = 'write';
    const change = await workspace.apply([{
      op: 'chain.create', source: chainAt(before.address, args.layerChain), name: args.name }]);
    requireProved(state, change, target, `Copied layer chain "${args.layerChain}" to "${args.name}".`);
    state.stage = 'readback';
    const after = await readContainer(workspace, args.trackId, args.containerPosition);
    const copy = lookupChain(after.container, args.name);
    const sourceNames = source.devices.map((item) => item.name);
    const result: WriteResult<unknown> = {
      schema: DUPLICATE_SCHEMA, applied: true, effects: state.effects,
      readback: {
        status: copy.ok && copy.chain.devicesComplete
          && sameNames(copy.chain.devices.map((item) => item.name), sourceNames) ? 'verified' : 'differs',
        layerChain: copy.ok ? publicLayerChain(copy.chain) : null,
        layerChains: after.container.chains.map((item) => item.name),
      },
      next: { remove: 'computer control in Bitwig, then read_devices' },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

// --- move_devices and copy_devices ---------------------------------------------

const topLevelSource = z.object({
  from: z.literal('top-level'),
  devicePosition: z.number().int().min(0).describe('Top-level device position from read_devices.'),
}).strict();
const layerChainSource = z.object({
  from: z.literal('layer-chain'),
  containerPosition,
  layerChain: layerChainName,
  devicePosition: z.number().int().min(0).describe('Device position inside the layer chain, from read_devices.'),
}).strict();
const deviceSource = z.discriminatedUnion('from', [topLevelSource, layerChainSource]);
const toLayerChain = z.object({
  to: z.literal('layer-chain'), containerPosition, layerChain: layerChainName,
}).strict().describe('Append at the end of this layer chain.');
const toTrackEnd = z.object({ to: z.literal('track-end') }).strict()
  .describe('Append at the end of the top-level device order.');
const toTopLevelPosition = z.object({
  to: z.literal('top-level-position'),
  devicePosition: z.number().int().min(0).describe(
    'Final top-level position of the first moved device, from the starting order. It must be before the sources.',
  ),
}).strict().describe('Put top-level devices before the device at this position.');

const moveInput = z.object({
  trackId,
  devices: z.array(deviceSource).min(1).max(4).describe(
    'One through four devices, in the order to place them. All come from the top level, or all from one layer '
    + 'chain. Positions are from one starting read.',
  ),
  destination: z.discriminatedUnion('to', [toLayerChain, toTrackEnd, toTopLevelPosition]),
}).strict();
type MoveInput = z.infer<typeof moveInput>;

const copyInput = z.object({
  trackId,
  devices: z.array(deviceSource).min(1).max(4).describe(
    'One through four devices, in the order to place them. All come from the top level, or all from one layer '
    + 'chain. Positions are from one starting read.',
  ),
  destination: toLayerChain,
}).strict();
type CopyInput = z.infer<typeof copyInput>;

const MOVE_DESCRIPTION = `${PROFILE} Move devices, with their device state, on one track. Routes: top-level devices `
  + 'into a layer chain, devices from one layer chain into another layer chain, devices from a layer chain to the '
  + 'track end, and top-level devices to an earlier top-level position (the extracted devices of a winner '
  + 'collapse). Each device is the same instance after the move. Each move is a separate host stage of about 4 '
  + 's. The complete source and destination structure is read first; an unsupported or unprovable route, or a '
  + 'move that no reading could tell from no move (two devices with one name), refuses before a write. readback '
  + 'gives the final top-level order and each touched layer chain. A move changes the signal path and can be '
  + 'audible. Layer-chain name, mute, solo, volume, pan, and colour stay on the layer chain. revert_change does '
  + 'not reverse a move: move the devices back.';

const COPY_DESCRIPTION = `${PROFILE} Copy devices into a layer chain on the same track: top-level devices, or the `
  + 'devices of another layer chain. Each copy is a new device instance with the device state of its source; '
  + 'it loads another instance and can add engine load. Each copy is a separate host stage of about 4 s. The '
  + 'complete source and destination structure is read first, and an unsupported route refuses before a write. '
  + 'readback gives the destination layer chain. revert_change does not remove a copy: delete it with computer '
  + 'control or move it out and delete_device it.';

interface PlannedMove {
  readonly ops: Op[];
  /** The expected top-level names after the batch. */
  readonly topLevel: readonly string[];
  /** The expected device names of each touched layer chain after the batch, by "position:name". */
  readonly chains: ReadonlyMap<string, { readonly containerPosition: number; readonly name: string;
    readonly devices: readonly string[] }>;
  readonly containerPositions: readonly number[];
}

const chainKey = (position: number, name: string) => `${position}:${name}`;

async function planRelocation(
  workspace: Workspace, args: MoveInput | CopyInput, mode: 'move' | 'copy',
): Promise<PlannedMove> {
  const track = trackAt(args.trackId);
  const first = args.devices[0]!;
  if (args.devices.some((item) => item.from !== first.from
      || (item.from === 'layer-chain' && first.from === 'layer-chain'
        && (item.containerPosition !== first.containerPosition || item.layerChain !== first.layerChain)))) {
    throw new ToolFailure('unsupported', 'input', 'All devices in one call must come from the top level, or all '
      + 'from one layer chain.', { detail: { reason: 'mixed-sources' } });
  }
  const positions = args.devices.map((item) => item.devicePosition);
  if (new Set(positions).size !== positions.length) {
    throw new ToolFailure('invalid-input', 'input', 'Each source device can appear only once.');
  }
  const destination = args.destination;
  if (first.from === 'top-level' && destination.to === 'track-end') {
    throw new ToolFailure('unsupported', 'input', 'Top-level devices move to an earlier top-level-position, not to '
      + 'the track end.', { detail: { reason: 'route' } });
  }
  if (first.from === 'layer-chain' && destination.to === 'top-level-position') {
    throw new ToolFailure('unsupported', 'input', 'Move layer-chain devices to the track end first, then to a '
      + 'top-level position.', { detail: { reason: 'route' } });
  }
  if (first.from === 'layer-chain' && destination.to === 'layer-chain'
      && destination.containerPosition === first.containerPosition && destination.layerChain === first.layerChain) {
    throw new ToolFailure('invalid-input', 'input', 'The source and destination layer chains must differ.');
  }

  const bank = await completeBank(workspace, track);
  const topNames = bank.devices.map((item) => item.name);
  const containerPositions = [...new Set([
    ...(first.from === 'layer-chain' ? [first.containerPosition] : []),
    ...(destination.to === 'layer-chain' ? [destination.containerPosition] : []),
  ])];
  const containers = new Map<number, ReadContainer>();
  for (const position of containerPositions) {
    containers.set(position, await readContainer(workspace, args.trackId, position));
  }
  const chains = new Map<string, { containerPosition: number; name: string; devices: string[] }>();
  const chainOf = (position: number, name: string) => {
    const key = chainKey(position, name);
    let entry = chains.get(key);
    if (entry === undefined) {
      const found = requireChain(containers.get(position)!.container, name);
      if (!found.devicesComplete) {
        throw new ToolFailure('partial', 'acquire', `The device list of layer chain "${name}" is not complete.`);
      }
      entry = { containerPosition: position, name, devices: found.devices.map((item) => item.name) };
      chains.set(key, entry);
    }
    return entry;
  };
  const destinationChain = destination.to === 'layer-chain'
    ? chainOf(destination.containerPosition, destination.layerChain) : undefined;
  const destinationCapacity = destination.to === 'layer-chain'
    ? requireChain(containers.get(destination.containerPosition)!.container, destination.layerChain).devicesBankSize
    : undefined;
  if (destinationChain !== undefined
      && (destinationCapacity === undefined || destinationChain.devices.length + args.devices.length
        > destinationCapacity)) {
    throw new ToolFailure('outside-limit', 'acquire', 'The destination layer chain has no room for the devices '
      + `(capacity ${destinationCapacity ?? 'not observed'}).`);
  }

  const ops: Op[] = [];
  const top = [...topNames];
  if (first.from === 'top-level') {
    for (const position of positions) {
      if (position >= topNames.length) {
        throw new ToolFailure('absent', 'resolve', `No device is at top-level position ${position}.`);
      }
    }
    if (destination.to === 'layer-chain' && positions.includes(destination.containerPosition)) {
      throw new ToolFailure('invalid-input', 'input', 'A container cannot be moved into one of its own layer chains.');
    }
    if (destination.to === 'layer-chain') {
      const moved: number[] = [];
      for (const original of positions) {
        const current = mode === 'move' ? original - moved.filter((item) => item < original).length : original;
        const containerNow = mode === 'move'
          ? destination.containerPosition - moved.filter((item) => item < destination.containerPosition).length
          : destination.containerPosition;
        if (containerNow >= LAYER_CHAIN_POSITIONS) {
          throw new ToolFailure('outside-limit', 'plan', 'The container would leave the observable positions.');
        }
        ops.push({
          op: 'chain.relocate', source: deviceAt(track, current),
          destination: chainAt(deviceAt(track, containerNow), destination.layerChain), mode,
        });
        destinationChain!.devices.push(topNames[original]!);
        if (mode === 'move') moved.push(original);
      }
      if (mode === 'move') {
        const removed = new Set(positions);
        top.splice(0, top.length, ...topNames.filter((_, index) => !removed.has(index)));
      }
    } else if (destination.to === 'top-level-position') {
      // device.relocate moves one device from the observed tail end to before an anchor. Each step is
      // projected, and a step that no reading could tell from no step refuses (keep_device_alternate rule).
      let projected = [...topNames];
      const identity = topNames.map((_, index) => index);
      for (const [index, original] of positions.entries()) {
        const name = topNames[original]!;
        const currentIndex = identity.indexOf(original);
        const anchor = destination.devicePosition + index;
        if (anchor >= currentIndex) {
          throw new ToolFailure('unsupported', 'plan', 'The proved top-level route moves a device to an earlier '
            + 'position only.', { detail: { reason: 'route', device: name } });
        }
        const next = projectedReorder(projected, currentIndex, anchor);
        if (next === undefined || sameNames(next, projected)) {
          throw new ToolFailure('unsupported', 'plan', `The move of "${name}" would read the same before and `
            + 'after: devices are observed by position and name only. Rename the devices that share a name.',
          { detail: { reason: 'indistinguishable-move', deviceOrder: projected } });
        }
        ops.push({
          op: 'device.relocate', track, sourceFromEnd: projected.length - 1 - currentIndex,
          expectedName: name, before: deviceAt(track, anchor),
        });
        identity.splice(anchor, 0, ...identity.splice(currentIndex, 1));
        projected = next;
      }
      top.splice(0, top.length, ...projected);
    }
  } else {
    const sourceChain = chainOf(first.containerPosition, first.layerChain);
    const startNames = [...sourceChain.devices];
    for (const position of positions) {
      if (position >= startNames.length) {
        throw new ToolFailure('absent', 'resolve', `No device is at position ${position} in layer chain `
          + `"${first.layerChain}".`);
      }
    }
    const moved: number[] = [];
    const containerAddress = deviceAt(track, first.containerPosition);
    for (const original of positions) {
      const current = mode === 'move' ? original - moved.filter((item) => item < original).length : original;
      ops.push({
        op: 'chain.relocate',
        source: deviceIn(chainAt(containerAddress, first.layerChain), current),
        destination: destination.to === 'layer-chain'
          ? chainAt(deviceAt(track, destination.containerPosition), destination.layerChain)
          : track,
        mode,
      });
      if (destination.to === 'layer-chain') destinationChain!.devices.push(startNames[original]!);
      else top.push(startNames[original]!);
      if (mode === 'move') moved.push(original);
    }
    if (mode === 'move') {
      const removed = new Set(positions);
      sourceChain.devices.splice(0, sourceChain.devices.length, ...startNames.filter((_, index) => !removed.has(index)));
    }
    if (destination.to === 'track-end' && top.length > bank.bankSize) {
      throw new ToolFailure('outside-limit', 'plan', `The top-level order would hold ${top.length} devices, more than `
        + `the observable bank of ${bank.bankSize}.`);
    }
  }
  return { ops, topLevel: top, chains, containerPositions };
}

async function relocateDevices(
  workspace: Workspace, args: MoveInput | CopyInput, mode: 'move' | 'copy',
): Promise<unknown> {
  const started = performance.now();
  const schema = mode === 'move' ? MOVE_SCHEMA : COPY_SCHEMA;
  const target = { trackId: args.trackId, devices: args.devices.length, destination: args.destination };
  return guardedRun(schema, target, async (state) => {
    state.stage = 'acquire';
    const plan = await planRelocation(workspace, args, mode);
    state.stage = 'write';
    const change = await workspace.apply(plan.ops);
    requireProved(state, change, target, `${mode === 'move' ? 'Moved' : 'Copied'} ${args.devices.length} device(s).`);
    state.stage = 'readback';
    const track = trackAt(args.trackId);
    const after = await workspace.devices(track);
    const topLevel = after.devices.map((item) => item.name);
    const touched: Array<Record<string, unknown>> = [];
    let verified = after.devicesComplete && sameNames(topLevel, plan.topLevel);
    for (const expected of plan.chains.values()) {
      // A container can change its position only on a top-level move into a layer chain.
      const position = expected.containerPosition
        - (mode === 'move' && args.devices[0]!.from === 'top-level'
          ? args.devices.filter((item) => item.devicePosition < expected.containerPosition).length : 0);
      const read = await readContainer(workspace, args.trackId, position);
      const found = lookupChain(read.container, expected.name);
      const names = found.ok ? found.chain.devices.map((item) => item.name) : [];
      verified &&= found.ok && found.chain.devicesComplete && sameNames(names, expected.devices);
      touched.push({ containerPosition: position, ...(found.ok ? publicLayerChain(found.chain)
        : { name: expected.name, devices: null }) });
    }
    const result: WriteResult<unknown> = {
      schema, applied: true, effects: state.effects,
      readback: {
        status: verified ? 'verified' : 'differs',
        topLevel: after.devices.map((item) => ({ devicePosition: item.index, name: item.name, enabled: item.enabled ?? null })),
        topLevelComplete: after.devicesComplete,
        layerChains: touched,
      },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

// --- add_devices ----------------------------------------------------------------

const addSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('native'), name: z.string().min(1).describe('Exact native-device catalog name.') })
    .strict(),
  z.object({
    kind: z.literal('bitwig'),
    id: z.string().refine(isNativeDeviceUuid, 'A Bitwig device id must be a lowercase UUID.')
      .describe('Bitwig device UUID in lowercase canonical form.'),
  }).strict(),
  z.object({
    kind: z.literal('vst3'),
    id: z.string().regex(/^[0-9A-Fa-f]{32}$/).describe('VST3 class UID as 32 hexadecimal characters.'),
  }).strict(),
  z.object({
    kind: z.literal('clap'),
    id: z.string().min(1).refine((id) => id === id.trim() && !/[\u0000-\u001f\u007f]/.test(id),
      'A CLAP id cannot have surrounding space or control characters.'),
  }).strict(),
  z.object({ kind: z.literal('preset'), path: z.string().describe('Absolute .bwpreset path.') }).strict(),
]);

const addInput = z.object({
  trackId,
  devices: z.array(addSource).min(1).max(16).describe('One through 16 devices. They append in this order.'),
  expectedDeviceOrder: expectedDeviceOrder.optional(),
}).strict();
type AddInput = z.infer<typeof addInput>;

const ADD_DESCRIPTION = `${PROFILE} Append devices at the end of the top-level device order of one track. Each `
  + 'source is explicit: an exact native-device catalog name, a Bitwig device UUID, a VST3 class UID, a CLAP id, '
  + 'or an absolute .bwpreset path. All native names resolve before the first write; an unknown or non-unique name '
  + 'refuses with every failed name in detail.failedDeviceNames. A relative preset path, another extension, or a '
  + 'missing file refuses before a write, because the host accepts all three and does nothing. Each insertion '
  + 'reads the complete order first (expectedDeviceOrder from read_devices replaces the first read) and is proved '
  + 'by readback; each takes about 4 s. A plug-in loads a new instance and can add engine load. Each effect has a '
  + 'changeId; revert_change removes that device while its position and the order are unchanged. This tool does '
  + 'not create a container: use compose_devices.';

function addSourceOf(item: AddInput['devices'][number], uuid?: string): DeviceSource {
  switch (item.kind) {
    case 'native': return { from: 'bitwig', uuid: uuid! };
    case 'bitwig': return { from: 'bitwig', uuid: item.id };
    case 'vst3': return { from: 'vst3', classUid: item.id };
    case 'clap': return { from: 'clap', id: item.id };
    case 'preset': return { from: 'file', path: item.path };
  }
}

export interface AddDevicesOptions {
  readonly catalogPath?: string;
}

async function addDevices(workspace: Workspace, args: AddInput, options: AddDevicesOptions = {}): Promise<unknown> {
  const started = performance.now();
  const target = { trackId: args.trackId, devices: args.devices.length };
  return guardedRun(ADD_DEVICES_SCHEMA, target, async (state) => {
    for (const [index, item] of args.devices.entries()) {
      if (item.kind !== 'preset') continue;
      const problem = !isAbsolute(item.path) ? 'must be absolute'
        : !item.path.toLowerCase().endsWith('.bwpreset') ? 'must end in .bwpreset'
          : !existsSync(item.path) ? 'names no file' : undefined;
      if (problem !== undefined) {
        throw new ToolFailure('invalid-input', 'input', `Preset path ${index} ${problem}. Nothing was written.`,
          { detail: { deviceIndex: index } });
      }
    }
    const nativeNames = args.devices.flatMap((item) => item.kind === 'native' ? [item.name] : []);
    let uuids = new Map<string, string>();
    if (nativeNames.length > 0) {
      state.stage = 'resolve';
      try {
        const catalog = JSON.parse(await readFile(options.catalogPath ?? NATIVE_CATALOG_PATH, 'utf8')) as NativeCatalog;
        uuids = new Map(resolveExactNativeDevices(catalog, nativeNames).map((item) => [item.name, item.uuid]));
      } catch (error) {
        if (error instanceof NativeNameResolutionError) {
          throw new ToolFailure('invalid-input', 'resolve', 'One or more exact native-device names did not resolve. '
            + 'Nothing was written.', { detail: { failedDeviceNames: error.failures } });
        }
        throw new ToolFailure('internal', 'resolve', 'The native-device catalog could not be read.', { cause: error });
      }
    }
    const track = trackAt(args.trackId);
    const added: Array<Record<string, unknown>> = [];
    let expected = args.expectedDeviceOrder;
    for (const [index, item] of args.devices.entries()) {
      state.stage = 'acquire';
      let names: string[];
      let enabled: boolean[];
      if (expected !== undefined) {
        names = expected.map((entry) => entry.name);
        enabled = expected.map((entry) => entry.enabled);
        expected = undefined;
      } else {
        const bank = await completeBank(workspace, track);
        if (bank.devices.length >= bank.bankSize) {
          throw new ToolFailure('outside-limit', 'acquire', 'The device bank has no position for another device.');
        }
        names = bank.devices.map((entry) => entry.name);
        enabled = [...bank.enabled];
      }
      state.stage = 'write';
      const deviceName = item.kind === 'native' ? item.name : undefined;
      const change = await workspace.apply([{
        op: 'device.insert', track, source: addSourceOf(item, deviceName === undefined ? undefined : uuids.get(deviceName)),
        ...(deviceName === undefined ? {} : { expectedDeviceName: deviceName }),
        expectedChain: names, expectedEnabledChain: enabled,
      }]);
      const minted = Object.values(change.take.receipt.minted)
        .filter((address): address is DeviceAddress => address.kind === 'device');
      requireProved(state, change, { trackId: args.trackId, deviceIndex: index },
        `Added device ${index}${deviceName === undefined ? '' : ` (${deviceName})`}.`);
      if (minted.length !== 1) {
        throw new ToolFailure('unavailable', 'readback', 'The insertion did not read back at one exact position.');
      }
      added.push({ deviceIndex: index, source: item.kind, devicePosition: minted[0]!.chainIndex,
        ...(deviceName === undefined ? {} : { name: deviceName }) });
    }
    state.stage = 'readback';
    const after = await workspace.devices(track);
    const result: WriteResult<unknown> = {
      schema: ADD_DEVICES_SCHEMA, applied: true, effects: state.effects,
      readback: {
        status: after.devicesComplete ? 'verified' : 'differs',
        added,
        topLevel: after.devices.map((entry) => ({ devicePosition: entry.index, name: entry.name, enabled: entry.enabled ?? null })),
      },
      next: { revert: { tool: 'revert_change', changeIds: state.effects.map((item) => item.changeId).reverse() } },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

// --- compose_devices -----------------------------------------------------------

const composeDevice = z.object({
  source: compositionSource,
  modulators: z.array(modulation).max(16).optional().describe(
    'Outer container or preset-local modulators with exact DirectParameter targets.',
  ),
  modulatorEdits: z.array(modulatorEdit).optional().describe(
    'Named template modulator edits. Only the offline Instrument Layer path accepts them.',
  ),
}).strict();

const composeInput = z.object({
  trackId,
  containerKind: z.enum(['Instrument Layer', 'FX Layer', 'Drum Machine']).describe(
    'Instrument Layer: parallel layer chains with the same MIDI input. FX Layer: parallel layer chains with the '
    + 'same audio input. Drum Machine: one pad for each MIDI note from 36 through 51.',
  ),
  containerPosition: z.number().int().min(0).max(LAYER_CHAIN_POSITIONS - 1).optional().describe(
    'Final top-level position of a layer container. Default: the end of the track, which must be position 2 or '
    + 'earlier.',
  ),
  expectedDeviceOrder: expectedDeviceOrder.optional(),
  layerChains: z.array(z.object({
    name: newLayerChainName,
    devices: z.array(composeDevice).min(1).max(4),
  }).strict()).min(1).max(5).optional().describe('One through five named layer chains (layer containers only).'),
  pads: z.array(drumPadAssignment).min(1).max(16).optional().describe('Drum Machine pads only.'),
}).strict().superRefine((input, context) => {
  if (input.containerKind === 'Drum Machine') {
    if (input.pads === undefined) context.addIssue({ code: 'custom', path: ['pads'], message: 'A Drum Machine needs pads.' });
    if (input.layerChains !== undefined || input.containerPosition !== undefined) {
      context.addIssue({ code: 'custom', path: ['layerChains'],
        message: 'A Drum Machine has pads, not layer chains, and appends at the end.' });
    }
    return;
  }
  if (input.layerChains === undefined) {
    context.addIssue({ code: 'custom', path: ['layerChains'], message: 'A layer container needs layerChains.' });
    return;
  }
  if (input.pads !== undefined) context.addIssue({ code: 'custom', path: ['pads'], message: 'Pads are for a Drum Machine.' });
  const names = input.layerChains.map((item) => item.name);
  if (new Set(names).size !== names.length) {
    context.addIssue({ code: 'custom', path: ['layerChains'], message: 'Each layer-chain name must be unique.' });
  }
});
type ComposeInput = z.infer<typeof composeInput>;

export type CompositionBackend = 'offline' | 'staged' | 'drum-machine';

/**
 * The private backend boundary (D18, E238). The offline preset backend builds an Instrument Layer of one through
 * four layer chains, each with one native device and optional named template edits, in one insertion at the end
 * of the track. The staged backend handles every other supported shape.
 */
export function compositionBackend(input: ComposeInput, deviceCount: number): CompositionBackend {
  if (input.containerKind === 'Drum Machine') return 'drum-machine';
  const chains = input.layerChains ?? [];
  const devices = chains.flatMap((item) => item.devices);
  const nativeNames = devices.flatMap((item) => item.source.kind === 'native' ? [item.source.name] : []);
  const offline = input.containerKind === 'Instrument Layer'
    && chains.length <= 4
    && chains.every((item) => item.devices.length === 1)
    && devices.every((item) => item.source.kind === 'native' && item.modulators === undefined)
    && new Set(nativeNames).size === nativeNames.length
    && (input.containerPosition === undefined || input.containerPosition === deviceCount)
    && deviceCount < LAYER_CHAIN_POSITIONS;
  return offline ? 'offline' : 'staged';
}

const COMPOSE_DESCRIPTION = `${PROFILE} Create one complete container with explicit sources: an Instrument Layer or `
  + 'FX Layer with one through five named layer chains of one through four devices each, or a Drum Machine with '
  + 'one through 16 pads. Instrument Layer chains run in parallel and receive the same MIDI input (no per-note '
  + 'routing); FX Layer chains receive the same audio input; a Drum Machine routes each MIDI note from 36 through '
  + '51 to one pad. Device sources: an exact native catalog name, a VST3 class UID, a CLAP id, an absolute preset '
  + 'path, or an existing top-level device (existing-move keeps the same instance; existing-copy makes a new '
  + 'one). modulators adds outer container or preset-local modulators with exact DirectParameter targets from '
  + 'read_device_controls and types from list_modulator_types.\n'
  + 'Ghostnote selects a private backend. An Instrument Layer of one through four layer chains with one native '
  + 'device each, appended at the end, is built offline from a validated preset in one insertion (modulatorEdits '
  + 'are only for this path); each layer chain is then renamed. Every other shape runs as guarded host stages: '
  + 'container insertion, layer-chain naming, and one insertion and one move for each device, each about 4 s. '
  + 'The final container position must be 0 through 2 (layer chains are not observable later). Every request is '
  + 'validated before the first write; a later failure returns the completed effects.\n'
  + 'Result: effects with change IDs, readback with the complete structure, and next.revert. revert_change with '
  + 'that change ID reverses the whole composition: it restores moved existing devices and removes only the owned '
  + 'container and owned sources while every guard holds.';

export interface ComposeDevicesOptions {
  /** Benchmarks only (E238): force one backend. A request that the offline backend cannot represent refuses. */
  readonly backend?: Exclude<CompositionBackend, 'drum-machine'>;
}

/** Compose one container through the selected backend. Exported for the backend benchmark. */
export async function composeDevices(
  workspace: Workspace, args: ComposeInput, options: ComposeDevicesOptions = {},
): Promise<unknown> {
  const started = performance.now();
  const target = { trackId: args.trackId, containerKind: args.containerKind };
  return guardedRun(COMPOSE_SCHEMA, target, async (state) => {
    state.stage = 'acquire';
    const track = trackAt(args.trackId);
    const bank = await completeBank(workspace, track);
    if (args.expectedDeviceOrder !== undefined && !(sameNames(bank.devices.map((item) => item.name),
      args.expectedDeviceOrder.map((item) => item.name))
        && bank.enabled.every((value, index) => value === args.expectedDeviceOrder![index]?.enabled))) {
      throw new ToolFailure('target-changed', 'acquire', 'The top-level device order differs from '
        + 'expectedDeviceOrder. Nothing was written.', { retryWhen: 'after a fresh read_devices' });
    }
    const selected = compositionBackend(args, bank.devices.length);
    const backend = options.backend ?? selected;
    if (backend === 'offline' && selected !== 'offline') {
      throw new ToolFailure('unsupported', 'input', 'The offline backend cannot represent this request.',
        { detail: { reason: 'backend', selected } });
    }
    const edits = (args.layerChains ?? []).some((item) => item.devices.some((device) => device.modulatorEdits !== undefined));
    if (edits && backend !== 'offline') {
      throw new ToolFailure('unsupported', 'input', 'modulatorEdits work only on the offline Instrument Layer path: '
        + 'one through four layer chains with one native device each, appended at the end.',
      { detail: { reason: 'offline-only-edits' } });
    }
    if (backend !== 'drum-machine' && args.containerPosition === undefined
        && bank.devices.length >= LAYER_CHAIN_POSITIONS) {
      throw new ToolFailure('outside-limit', 'input', 'The end of the track is after position 2, where layer '
        + 'chains are not observable. Give containerPosition 0 through 2.');
    }
    state.stage = 'write';
    if (backend === 'drum-machine') return composeDrumMachine(workspace, args, state, started, target);
    if (backend === 'offline') return composeOffline(workspace, args, state, started, target);
    return composeStaged(workspace, args, bank, state, started, target);
  });
}

/** Run the validator of the selected backend before any write. */
function validated<T>(validator: z.ZodType<T>, input: unknown): T {
  const parsed = validator.safeParse(input);
  if (!parsed.success) {
    throw new ToolFailure('invalid-input', 'input', 'The request does not pass the checks of the selected '
      + 'composition path. Nothing was written.', { detail: { issues: parsed.error.issues.map((issue) => ({
        path: issue.path, message: issue.message })) } });
  }
  return parsed.data;
}

/**
 * A backend result is a write only when its recorded change wrote. A change that the revision guard refused whole
 * wrote nothing: it is target-changed with no effect, never an insertion.
 */
function requireBackendWrite(
  state: RunState, workspace: Workspace, receipt: ReturnType<typeof receiptOf> | undefined,
  target: Readonly<Record<string, unknown>>, summary: string,
): void {
  let change: StashedChangeset | undefined;
  try {
    change = receipt === undefined ? undefined : workspace.changes.require(receipt.changeId);
  } catch {
    change = undefined;
  }
  if (change === undefined) {
    throw new ToolFailure('internal', 'write', 'The composition returned no recorded change.');
  }
  if (!takeAppliedAnything(change.take)) {
    throw new ToolFailure('target-changed', 'write', 'The device structure changed before the write. Nothing was '
      + 'written.', { retryWhen: 'after a fresh read_devices' });
  }
  state.effects.push({ changeId: change.take.id, target, summary, fidelity: change.take.fidelity });
}

function refusedComposition(result: Record<string, unknown>): never {
  const failed = result['failedDeviceNames'];
  throw new ToolFailure(failed === undefined ? 'unsupported' : 'invalid-input', 'plan',
    String(result['why'] ?? 'Nothing was written.'), {
      detail: { reason: 'composition-refused', ...(failed === undefined ? {} : { failedDeviceNames: failed }) } });
}

async function composeDrumMachine(
  workspace: Workspace, args: ComposeInput, state: RunState, started: number, target: Record<string, unknown>,
): Promise<unknown> {
  const result = await runDrumMachineComposition(workspace, validated(drumMachineCompositionInputValidator,
    { trackId: args.trackId, pads: args.pads! }));
  if (result['refused'] === true) refusedComposition(result);
  const change = result['change'] as ReturnType<typeof receiptOf>;
  requireBackendWrite(state, workspace, change, target, 'Inserted one Drum Machine with its pads.');
  const observed = result['observed'] as Record<string, unknown>;
  if (observed['verified'] !== true || typeof result['insertedDevicePosition'] !== 'number') {
    throw new ToolFailure('unavailable', 'readback', 'The Drum Machine did not read back with the complete requested '
      + 'pads. revert_change removes it.', { detail: { observed, revert: change.changeId } });
  }
  const outcome: WriteResult<unknown> = {
    schema: COMPOSE_SCHEMA, applied: true, effects: state.effects,
    readback: { status: 'verified', backend: 'drum-machine',
      containerPosition: result['insertedDevicePosition'], pads: observed['pads'] },
    next: { revert: { tool: 'revert_change', changeId: change.changeId } },
    warnings: [], timing: { totalMs: performance.now() - started },
  };
  return { ...outcome, target };
}

async function composeOffline(
  workspace: Workspace, args: ComposeInput, state: RunState, started: number, target: Record<string, unknown>,
): Promise<unknown> {
  const chains = args.layerChains!;
  const result = await runDeviceStructureComposition(workspace, validated(deviceStructureCompositionInputValidator, {
    trackId: args.trackId,
    entries: chains.map((item) => {
      const device = item.devices[0]!;
      return {
        deviceName: (device.source as { name: string }).name,
        ...(device.modulatorEdits === undefined ? {} : { modulators: device.modulatorEdits }),
      };
    }),
  }));
  if (result['refused'] === true) refusedComposition(result);
  const change = result['change'] as ReturnType<typeof receiptOf>;
  requireBackendWrite(state, workspace, change, target, `Inserted one Instrument Layer with ${chains.length} layer chains.`);
  const position = result['insertedDevicePosition'];
  const observed = result['observed'] as { verified: boolean; entries: { entryName: string }[] };
  const verification = result['verification'] as { verified: boolean; witnesses: unknown[] };
  if (!observed.verified || typeof position !== 'number') {
    throw new ToolFailure('unavailable', 'readback', 'The inserted container did not read back with the complete '
      + 'requested structure. revert_change removes it.', { detail: { observed, revert: change.changeId } });
  }
  state.stage = 'write';
  const address = deviceAt(trackAt(args.trackId), position);
  const renames: Op[] = chains.flatMap((item, index): Op[] => {
    const current = observed.entries[index]?.entryName;
    return current === undefined || current === item.name ? [] : [{ op: 'chain.rename', chain: chainAt(address, current), name: item.name }];
  });
  // A wanted name can equal another template name. Rename through unique temporary names first.
  const templateNames = new Set(observed.entries.map((item) => item.entryName));
  const clash = renames.some((op) => op.op === 'chain.rename' && templateNames.has(op.name));
  const staged: Op[] = clash
    ? [
      ...renames.map((op, index): Op => ({ ...(op as Extract<Op, { op: 'chain.rename' }>), name: `ghostnote pending ${index}` })),
      ...renames.map((op, index): Op => ({ op: 'chain.rename',
        chain: chainAt(address, `ghostnote pending ${index}`), name: (op as Extract<Op, { op: 'chain.rename' }>).name })),
    ]
    : renames;
  if (staged.length > 0) {
    const renamed = await workspace.apply(staged);
    requireProved(state, renamed, target, `Named ${renames.length} layer chain(s).`);
  }
  state.stage = 'readback';
  const after = await readContainer(workspace, args.trackId, position);
  const names = after.container.chains.map((item) => item.name);
  const outcome: WriteResult<unknown> = {
    schema: COMPOSE_SCHEMA, applied: true, effects: state.effects,
    readback: {
      status: verification.verified && sameNames(names, chains.map((item) => item.name)) ? 'verified' : 'differs',
      backend: 'offline', containerPosition: position, ...publicContainer(after.device),
      modulation: verification.witnesses,
    },
    next: { revert: { tool: 'revert_change', changeId: change.changeId } },
    warnings: [], timing: { totalMs: performance.now() - started },
  };
  return { ...outcome, target };
}

async function composeStaged(
  workspace: Workspace, args: ComposeInput, bank: ObservedDeviceBank & { readonly enabled: readonly boolean[] },
  state: RunState, started: number, target: Record<string, unknown>,
): Promise<unknown> {
  const result = await runGeneralDeviceComposition(workspace, validated(generalDeviceCompositionInputValidator, {
    trackId: args.trackId,
    expectedDeviceOrder: bank.devices.map((item, index) => ({ name: item.name, enabled: bank.enabled[index]! })),
    containerKind: args.containerKind as 'Instrument Layer' | 'FX Layer',
    containerPosition: args.containerPosition ?? bank.devices.length,
    entries: args.layerChains!.map((item) => ({
      entryName: item.name,
      devices: item.devices.map((device) => ({ source: device.source, modulators: device.modulators ?? [] })),
    })),
  }));
  if (result['refused'] === true) refusedComposition(result);
  const stages = (result['stages'] as { stage: string; entryIndex?: number; change: ReturnType<typeof receiptOf> }[]);
  for (const stage of stages) {
    state.effects.push({ changeId: stage.change.changeId,
      target: { ...target, ...(stage.entryIndex === undefined ? {} : { layerChain: args.layerChains![stage.entryIndex]?.name }) },
      summary: `Composition stage ${stage.stage}.`,
      fidelity: workspace.changes.require(stage.change.changeId).take.fidelity });
  }
  const checkpoint = result['reversalCheckpoint'] as { containerInsertChangeId?: string } | undefined;
  const changeId = checkpoint?.containerInsertChangeId ?? stages[0]?.change.changeId;
  if (result['complete'] !== true) {
    throw new ToolFailure('unavailable', 'write', String(result['why'] ?? 'The composition did not complete.')
      + ' revert_change with the composition change ID reverses the completed stages.', {
      detail: { failedStage: result['failedStage'] ?? null, compositionChangeId: changeId ?? null } });
  }
  const structure = result['structure'] as Record<string, unknown> | undefined;
  const outcome: WriteResult<unknown> = {
    schema: COMPOSE_SCHEMA, applied: true, effects: state.effects,
    readback: { status: 'verified', backend: 'staged', containerPosition: args.containerPosition ?? bank.devices.length,
      structure: structure ?? null, layerChains: result['entries'] },
    next: { revert: { tool: 'revert_change', changeId } },
    warnings: [], timing: { totalMs: performance.now() - started },
  };
  return { ...outcome, target };
}

// --- delete_device (in place) ---------------------------------------------------

const deleteInput = z.object({
  devices: z.array(z.object({
    trackId,
    devicePosition: z.number().int().min(0).describe('Top-level position from read_devices.'),
    layerChain: z.string().min(1).optional().describe(
      'A layer chain inside the container at devicePosition. Typed deletion of one layer chain is unavailable: this '
      + 'always refuses before a write.',
    ),
  }).strict()).min(1),
}).strict();
type DeleteInput = z.infer<typeof deleteInput>;

const DELETE_DESCRIPTION = `${PROFILE} Remove top-level devices by current position after a fresh complete read of `
  + 'the device order. Removing a container removes every layer chain and device in it: readback lists the layer '
  + 'chains that were inside each removed container. This cannot be undone here: presets, internal state, '
  + 'modulation, and plug-in state cannot be rebuilt. In one call the higher positions are removed first, so all '
  + 'positions refer to the same starting order. Across calls, read_devices again.\n'
  + 'Bitwig has no typed deletion of one layer chain. An entry with layerChain refuses before a write (code '
  + 'unsupported): remove the layer chain with computer control in Bitwig (confirm the focus and the target), then '
  + 'read_devices again. Ghostnote does not record or reverse that action.';

function deviceDeletionTool(stable: ToolSpec): ToolSpec {
  return {
    ...stable,
    description: DELETE_DESCRIPTION,
    inputSchema: deleteInput.shape,
    inputValidator: deleteInput,
    resultContract: {
      schema: DELETE_DEVICE_SCHEMA, profile: AGENT_NATIVE_TOOL_PROFILE, envelope: WRITE_FIELDS, failure: FAILURE_FIELDS,
      unsupported: 'layer-chain-delete: typed deletion of one layer chain is unavailable.',
    },
    run: (workspace, input) => deleteDevices(workspace, input as DeleteInput, stable),
  };
}

async function deleteDevices(workspace: Workspace, args: DeleteInput, stable: ToolSpec): Promise<unknown> {
  const started = performance.now();
  const target = { devices: args.devices.length };
  return guardedRun(DELETE_DEVICE_SCHEMA, target, async (state) => {
    const chainEntry = args.devices.find((item) => item.layerChain !== undefined);
    if (chainEntry !== undefined) {
      throw new ToolFailure('unsupported', 'input', 'Bitwig has no typed deletion of one layer chain. Nothing was '
        + 'written. Remove the layer chain with computer control in Bitwig: confirm the focus and the target, '
        + 'delete it, then read_devices again.', { detail: { reason: 'layer-chain-delete',
        trackId: chainEntry.trackId, devicePosition: chainEntry.devicePosition, layerChain: chainEntry.layerChain } });
    }
    state.stage = 'acquire';
    const inside: Array<Record<string, unknown>> = [];
    for (const [id, positions] of groupBy(args.devices)) {
      const scoped = positions.filter((position) => position < LAYER_CHAIN_POSITIONS);
      const read = await structureAt(workspace, trackAt(id), scoped);
      for (const [position, device] of read) {
        if (typeof device === 'object' && device.container !== undefined && device.container.chains.length > 0) {
          inside.push({ trackId: id, position, containerKind: device.name,
            layerChains: device.container.chains.map((item) => ({ name: item.name,
              devices: item.devices.map((nested) => nested.name) })) });
        }
      }
    }
    state.stage = 'write';
    const stableResult = await stable.run(workspace, { devices: args.devices.map((item) => ({
      trackId: item.trackId, position: item.devicePosition })) } as never) as Record<string, unknown>;
    // 8h4f: a refusal before any write keeps its error; the failure envelope classifies it.
    const cause = causeOf(stableResult);
    if (stableResult['refused'] === true && cause !== undefined) throw cause;
    const receipts = (stableResult['changes'] as ReturnType<typeof receiptOf>[] | undefined) ?? [];
    for (const receipt of receipts) {
      state.effects.push({ changeId: receipt.changeId, target, summary: 'Removed one top-level device.',
        fidelity: workspace.changes.require(receipt.changeId).take.fidelity });
    }
    if (stableResult['applied'] !== true) {
      throw new ToolFailure(receipts.length === 0 ? 'target-changed' : 'unavailable', receipts.length === 0 ? 'guard' : 'readback',
        typeof stableResult['why'] === 'string' ? stableResult['why'] : receipts.length === 0
          ? 'The device order changed. Nothing was written.'
          : 'A removal was not proved by readback. Read the device order again.',
        { detail: { removed: stableResult['removed'] ?? [] } });
    }
    const result: WriteResult<unknown> = {
      schema: DELETE_DEVICE_SCHEMA, applied: true, effects: state.effects,
      readback: { status: stableResult['verified'] === true ? 'verified' : 'differs', removed: stableResult['removed'],
        removedLayerChains: inside },
      warnings: [], timing: { totalMs: performance.now() - started },
    };
    return { ...result, target };
  });
}

function groupBy(devices: DeleteInput['devices']): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const item of devices) out.set(item.trackId, [...(out.get(item.trackId) ?? []), item.devicePosition]);
  return out;
}

// --- renamed control and modulation tools ---------------------------------------

const readControlsInput = z.object({
  device: deviceTarget,
  view: z.enum(['direct', 'remote-controls']).optional().describe(
    'DirectParameter inventory by default, or the complete visible remote-control page bank.',
  ),
}).strict();

const READ_CONTROLS_DESCRIPTION = `${PROFILE} Read the controls of one device: the complete stable DirectParameter `
  + 'inventory, or with view remote-controls the visible remote pages. Each DirectParameter id is the selector '
  + 'for set_device_controls on native, VST3, and CLAP devices. Values are normalized from 0 through 1 and do not '
  + 'share one physical unit. display is the host text for each value: it is part of the read (one more '
  + 'control-surface turn for a new device), and displayComplete is false when a text did not arrive in time; such '
  + 'a parameter has no display. Typed discrete values, origin, automation, and modulatedValue appear only when '
  + 'Bitwig observed them. An empty list on a plug-in is standing unavailable: the audio engine is off or the '
  + 'plug-in is not loaded. Turn the engine on for this project in Bitwig and read again. Remote controls use the '
  + 'returned page and control names and positions. The result distinguishes a missing target, an unreachable '
  + 'bank window, and an unstable host reading. route goes into named layer chains from read_devices or drum pads.';

const SET_CONTROLS_DESCRIPTION = `${PROFILE} Set DirectParameters by ids from read_device_controls, or set returned `
  + 'remote controls by their exact page and control names and positions. Normalized values range from 0 through '
  + '1 and do not share one physical unit. Display text is read-only and has no inverse conversion. API 25 has no '
  + 'exact semantic-value write: a semantic request returns an unsupported boundary before any project read or '
  + 'write. Do not substitute a guessed normalized value, do not search for a conversion, and do not use computer '
  + 'input for one. A host-proved discrete domain allows only its returned normalized values. One invalid value '
  + 'refuses its same-route cohort before the first write. Each DirectParameter write has complete inventory '
  + 'readback; on a CLAP plug-in the readback maps the host callback form to the listed id. An unrequested '
  + 'parameter change stops the cohort and stays unattributed, because the host does not identify its author. '
  + 'Modulation and automation warnings state when a static base value can differ from the value heard. A '
  + 'complete success groups change IDs and selectors under each device route; a failure or partial result keeps '
  + 'the full receipts. list_changes keeps the complete records; revert_change restores the base value while the '
  + 'device route is valid.';

function controlsTools(stable: { read: ToolSpec; set: ToolSpec }): ToolSpec[] {
  const setInput = z.object({ settings: z.array(parameterSetting).min(1) }).strict();
  return [
    {
      name: 'read_device_controls',
      kind: 'read',
      title: 'Read device controls',
      description: READ_CONTROLS_DESCRIPTION,
      inputSchema: readControlsInput.shape,
      inputValidator: readControlsInput,
      emits: [],
      resultContract: {
        ...(stable.read.resultContract as Record<string, unknown>),
        standing: 'stable, missing, unreachable, unstable, or unavailable (plug-in with no listed parameters).',
        displayComplete: 'True when each DirectParameter has display text from the current device.',
      },
      run: (workspace, input) => readDeviceControls(workspace, input as never, { display: true }),
    },
    {
      ...stable.set,
      name: 'set_device_controls',
      title: 'Set device controls',
      description: SET_CONTROLS_DESCRIPTION,
      inputSchema: setInput.shape,
      inputValidator: setInput,
      run: (workspace, input) => setDeviceControls(workspace, input as { settings: ParameterSetting[] }),
    },
  ];
}

function modulationTools(stable: { inspect: ToolSpec; author: ToolSpec; wrap: ToolSpec }): ToolSpec[] {
  const authoring = modulatorAuthoringSchemas({
    readControls: 'read_device_controls', readPresetModulation: 'read_preset_modulation' });
  const wrapping = existingDeviceModulationWrapperSchemas({
    readControls: 'read_device_controls', readDevices: 'read_devices' });
  return [
    {
      ...stable.inspect,
      name: 'read_preset_modulation',
      title: 'Read preset modulation',
      description: stable.inspect.description.replace('the later semantic write', 'edit_preset_modulation'),
      inputSchema: presetModulationInspectionInputSchema,
      inputValidator: presetModulationInspectionInputValidator,
      run: (_workspace, input) => runPresetModulationInspection(input as never),
    },
    {
      ...stable.author,
      name: 'edit_preset_modulation',
      title: 'Edit preset modulation',
      description: stable.author.description
        .replaceAll('inspect_preset_modulation', 'read_preset_modulation')
        .replaceAll('inspect_device_parameters', 'read_device_controls'),
      inputSchema: authoring.schema,
      inputValidator: authoring.validator,
      run: (workspace, input) => runModulatorAuthoring(workspace, input as never),
    },
    {
      ...stable.wrap,
      inputSchema: wrapping.schema,
      inputValidator: wrapping.validator,
    },
  ];
}

// --- the profile pieces -------------------------------------------------------------

/**
 * The stable tools that 8h4e removes from `agent-native-v1`, each with its replacement. The migration contract
 * has one row for each.
 */
export const AGENT_NATIVE_DEVICE_RETIRED: Readonly<Record<string, string>> = {
  inspect_devices: 'read_devices',
  inspect_device_alternates: 'read_devices',
  inspect_device_parameters: 'read_device_controls',
  set_parameter: 'set_device_controls',
  inspect_preset_modulation: 'read_preset_modulation',
  author_modulators: 'edit_preset_modulation',
  add_native_devices: 'add_devices',
  add_device: 'add_devices',
  compose_device_structure: 'compose_devices',
  compose_drum_machine: 'compose_devices',
  compose_device_sources: 'compose_devices',
  reverse_device_source_composition: 'revert_change with the compose_devices change ID',
  create_device_alternates: 'compose_devices or duplicate_layer_chain',
  fill_device_alternate: 'move_devices or copy_devices',
  switch_device_alternate: 'set_layer_chain_solo (mode exclusive)',
  remove_device_alternate: 'computer control in Bitwig (no typed deletion of one layer chain)',
  keep_device_alternate: 'the winner-collapse recipe: move_devices, delete_device, move_devices',
};

const spec = (
  name: string, kind: ToolSpec['kind'], title: string, description: string, input: z.ZodObject,
  schema: string, emits: ToolSpec['emits'], run: ToolSpec['run'], extra: Record<string, unknown> = {},
): ToolSpec => ({
  name, kind, title, description, inputSchema: input.shape, inputValidator: input, emits,
  resultContract: { schema, profile: AGENT_NATIVE_TOOL_PROFILE,
    envelope: kind === 'read' ? READ_FIELDS : WRITE_FIELDS, failure: FAILURE_FIELDS, ...extra },
  run,
});

/** Build the new and in-place device tools of `agent-native-v1` from the stable tools. */
export function agentNativeDeviceTools(stable: readonly ToolSpec[]): {
  readonly additions: readonly ToolSpec[];
  readonly replacements: ReadonlyMap<string, ToolSpec>;
} {
  const named = (name: string): ToolSpec => {
    const found = stable.find((item) => item.name === name);
    if (found === undefined) throw new Error(`stable tool is missing: ${name}`);
    return found;
  };
  const [readControls, setControls] = controlsTools({
    read: named('inspect_device_parameters'), set: named('set_parameter') });
  const [readPreset, editPreset, wrap] = modulationTools({
    inspect: named('inspect_preset_modulation'), author: named('author_modulators'),
    wrap: named('wrap_existing_device_modulation') });
  const additions: ToolSpec[] = [
    spec('read_devices', 'read', 'Read track devices and layer chains', READ_DESCRIPTION, readInput, DEVICES_SCHEMA, [],
      (workspace, input) => readDevices(workspace, input as ReadInput),
      { coverage: ['status', 'devicesComplete', 'bankSize', 'layerChainPositions'],
        layerChains: ['outside-limit', 'unavailable'] }),
    readControls!,
    setControls!,
    readPreset!,
    editPreset!,
    spec('add_devices', 'write', 'Add devices to a track', ADD_DESCRIPTION, addInput, ADD_DEVICES_SCHEMA,
      ['device.insert'], (workspace, input) => addDevices(workspace, input as AddInput)),
    spec('compose_devices', 'write', 'Compose a device container', COMPOSE_DESCRIPTION, composeInput, COMPOSE_SCHEMA,
      ['device.insert', 'device.relocate', 'chain.rename', 'chain.relocate', 'drumPad.insert'],
      (workspace, input) => composeDevices(workspace, input as ComposeInput),
      { backends: ['offline', 'staged', 'drum-machine'] }),
    spec('duplicate_layer_chain', 'write', 'Duplicate a layer chain', DUPLICATE_DESCRIPTION, duplicateInput,
      DUPLICATE_SCHEMA, ['chain.create'], (workspace, input) => duplicateLayerChain(workspace, input as DuplicateInput)),
    spec('rename_layer_chain', 'write', 'Rename a layer chain', RENAME_DESCRIPTION, renameInput, RENAME_SCHEMA,
      ['chain.rename'], (workspace, input) => renameLayerChain(workspace, input as RenameInput)),
    spec('move_devices', 'write', 'Move devices', MOVE_DESCRIPTION, moveInput, MOVE_SCHEMA,
      ['chain.relocate', 'device.relocate'], (workspace, input) => relocateDevices(workspace, input as MoveInput, 'move')),
    spec('copy_devices', 'write', 'Copy devices into a layer chain', COPY_DESCRIPTION, copyInput, COPY_SCHEMA,
      ['chain.relocate'], (workspace, input) => relocateDevices(workspace, input as CopyInput, 'copy')),
    spec('set_layer_chain_solo', 'write', 'Set layer-chain solo', SOLO_DESCRIPTION, soloInput, SOLO_SCHEMA,
      ['chain.activate', 'chain.solo'], (workspace, input) => setLayerChainSolo(workspace, input as SoloInput),
      { readback: ['verified', 'differs', 'already-set'] }),
  ];
  // 8h4f: set_device_enabled, revert_change, and check_revert moved to agent-native-retained.ts.
  const replacements = new Map<string, ToolSpec>([
    ['wrap_existing_device_modulation', wrap!],
    ['delete_device', deviceDeletionTool(named('delete_device'))],
  ]);
  return { additions, replacements };
}
