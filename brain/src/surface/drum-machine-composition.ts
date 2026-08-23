/** Public native Drum Machine composition and exact readback. */
import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { NATIVE_CATALOG_PATH } from '../composition/index.js';
import {
  drumPad as drumPadAt, track as trackAt,
  type DeviceAddress, type Op,
} from '../contract/index.js';
import type { NativeCatalog, NativeCatalogDevice } from '../native-catalog/catalog.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

const MIDI_NOTE_MIN = 36;
const MIDI_NOTE_MAX = 51;
const DRUM_MACHINE_NAME: 'Drum Machine' = 'Drum Machine';

const pad = z.object({
  midiNote: z.number().int().min(MIDI_NOTE_MIN).max(MIDI_NOTE_MAX).describe(
    'MIDI note from 36 (C1) through 51 (D-sharp 2). One note addresses one pad.',
  ),
  deviceName: z.string().min(1).describe('Exact native Bitwig drum-device catalog name.'),
}).strict();

export const drumMachineCompositionInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  pads: z.array(pad).min(1).max(16).describe(
    'One through 16 pad assignments. Each MIDI note must occur once.',
  ),
} as const;

export const drumMachineCompositionInputValidator = z.object(
  drumMachineCompositionInputSchema,
).strict().superRefine((input, context) => {
  const notes = new Set<number>();
  input.pads.forEach((item, index) => {
    if (notes.has(item.midiNote)) {
      context.addIssue({
        code: 'custom',
        path: ['pads', index, 'midiNote'],
        message: 'Each MIDI note must occur once in one request.',
      });
    }
    notes.add(item.midiNote);
  });
});

export type DrumMachineCompositionInput = z.infer<
  typeof drumMachineCompositionInputValidator
>;

export interface DrumMachineCompositionOptions {
  readonly catalogPath?: string;
  readonly readbackAttempts?: number;
  readonly readbackRetryMs?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

function exactNative(catalog: NativeCatalog, name: string): NativeCatalogDevice {
  if (catalog.schemaVersion !== 1) throw new Error('the native-device catalog schema is unsupported');
  const matches = catalog.devices.filter((device) => device.name === name);
  if (matches.length === 0) throw new Error(`native device ${JSON.stringify(name)} is unknown`);
  if (matches.length !== 1) {
    throw new Error(`native device ${JSON.stringify(name)} is ambiguous (${matches.length} exact matches)`);
  }
  return matches[0]!;
}

function refusal(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : String(error);
  const why = /unknown/.test(message)
    ? 'The exact native-device name is not in the current catalog.'
    : /ambiguous/.test(message)
      ? 'The exact native-device name matched more than one catalog entry.'
      : /catalog/.test(message)
        ? 'The native-device catalog could not be validated.'
        : 'Drum Machine composition stopped before the project write completed.';
  return { refused: true, nothingWasWritten: true, why: `Nothing was written. ${why}` };
}

/** Create one new Drum Machine and fill its requested reachable pads. */
export async function runDrumMachineComposition(
  workspace: Workspace,
  input: DrumMachineCompositionInput,
  options: DrumMachineCompositionOptions = {},
): Promise<Record<string, unknown>> {
  const priorChangeIds = new Set(workspace.changes.list().map((change) => change.id));
  let applyStarted = false;
  try {
    const catalog = JSON.parse(await readFile(
      options.catalogPath ?? NATIVE_CATALOG_PATH,
      'utf8',
    )) as NativeCatalog;
    const containerSource = exactNative(catalog, DRUM_MACHINE_NAME);
    const resolved = input.pads.map((item) => ({
      ...item,
      padChannel: item.midiNote - MIDI_NOTE_MIN,
      device: exactNative(catalog, item.deviceName),
    }));

    const track = trackAt(input.trackId);
    const before = await workspace.devices(track);
    const priorEnabled = before.devices.map((device) => device.enabled);
    if (!before.devicesComplete || priorEnabled.some((value) => value === undefined)) {
      return {
        refused: true,
        nothingWasWritten: true,
        why: 'Nothing was written. The complete current device order and enabled state are required.',
      };
    }
    const priorNames = before.devices.map((device) => device.name);
    const containerPosition = priorNames.length;
    const container: DeviceAddress = {
      kind: 'device', track, chainIndex: containerPosition,
    };
    const expectedChain = [...priorNames, DRUM_MACHINE_NAME];
    const expectedEnabledChain = [...priorEnabled as boolean[], true];
    const ops: Op[] = [{
      op: 'device.insert',
      track,
      source: { from: 'bitwig', uuid: containerSource.uuid },
      expectedChain: priorNames,
      expectedEnabledChain: priorEnabled as boolean[],
    }, ...resolved.map((item) => ({
      op: 'drumPad.insert' as const,
      pad: drumPadAt(container, item.padChannel),
      source: { from: 'bitwig' as const, uuid: item.device.uuid },
      expectedDeviceName: item.device.name,
      expectedContainerName: DRUM_MACHINE_NAME,
      expectedChain,
      expectedEnabledChain,
    }))];

    applyStarted = true;
    const recorded = await workspace.apply(ops);
    const minted = recorded.take.receipt.minted[0];
    const inserted = minted?.kind === 'device' ? minted : undefined;
    const pause = options.wait ?? ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
    const attempts = options.readbackAttempts ?? 6;
    const retryMs = options.readbackRetryMs ?? 200;
    let witnesses: Record<string, unknown>[] = [];
    let observedContainerKind: string | null = null;
    let verified = false;
    let why = inserted === undefined
      ? 'The top-level insertion position was not proved.'
      : 'The complete reachable pad structure did not read back.';

    for (let attempt = 0; inserted !== undefined && attempt < attempts; attempt++) {
      let bank: Awaited<ReturnType<Workspace['drumPads']>>;
      try {
        bank = await workspace.drumPads(inserted);
      } catch {
        why = 'The post-write structure could not be read completely.';
        break;
      }
      observedContainerKind = bank.containerName;
      witnesses = resolved.map((item) => {
        const observedPad = bank.pads.find((candidate) => candidate.channel === item.padChannel);
        const observedName = observedPad?.devices[0]?.name;
        return {
          midiNote: item.midiNote,
          padChannel: item.padChannel,
          requestedDeviceName: item.deviceName,
          observedDeviceName: observedName ?? null,
          observedDeviceCount: observedPad?.devices.length ?? 0,
          verified: observedPad?.devicesComplete === true
            && observedPad.devices.length === 1
            && observedPad.devices[0]?.index === 0
            && observedName === item.deviceName,
        };
      });
      const topVerified = bank.topLevel.devicesComplete
        && bank.topLevel.devices.length === expectedChain.length
        && bank.topLevel.devices.every((device, index) => device.name === expectedChain[index]
          && device.enabled === expectedEnabledChain[index]);
      const requestedChannels = new Set(resolved.map((item) => item.padChannel));
      const exactOccupiedPads = bank.padsComplete
        && bank.pads.length === requestedChannels.size
        && bank.pads.every((item) => requestedChannels.has(item.channel));
      verified = topVerified
        && observedContainerKind === DRUM_MACHINE_NAME
        && exactOccupiedPads
        && witnesses.length === resolved.length
        && witnesses.every((item) => item['verified'] === true);
      if (verified) break;
      why = !topVerified
        ? 'The complete top-level device order or enabled state changed.'
        : !bank.padsComplete
          ? 'The complete reachable pad bank was unavailable.'
          : 'The occupied pad set or one nested device chain was different.';
      if (attempt + 1 < attempts && retryMs > 0) await pause(retryMs);
    }

    return {
      applied: receiptOf(recorded).applied,
      containerKind: observedContainerKind,
      routing: 'Each MIDI note addresses one separate Drum Machine pad and its nested device.',
      requested: resolved.map((item) => ({
        midiNote: item.midiNote,
        padChannel: item.padChannel,
        deviceName: item.deviceName,
      })),
      observed: {
        verified,
        containerKind: observedContainerKind,
        pads: witnesses,
        ...(verified ? {} : { why }),
      },
      verification: { verified },
      insertedDevicePosition: inserted?.chainIndex,
      change: receiptOf(recorded),
      reversal:
        'revert_change removes only this complete Drum Machine while its last proved order, enabled state, and pad structure remain valid.',
    };
  } catch (error) {
    if (workspace.changes.list().some((change) => !priorChangeIds.has(change.id))) throw error;
    if (applyStarted) {
      return {
        refused: true,
        completionUnknown: true,
        why: 'The write did not return a recorded receipt. Inspect the track before another write.',
      };
    }
    return refusal(error);
  }
}
