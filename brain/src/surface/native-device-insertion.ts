/** Public exact-name insertion for top-level native devices. */
import { readFile } from 'node:fs/promises';

import { z } from 'zod';

import { NATIVE_CATALOG_PATH } from '../composition/index.js';
import { track as trackAt, type DeviceAddress, type ObservedDeviceBank } from '../contract/index.js';
import {
  NativeNameResolutionError, resolveExactNativeDevices, type NativeCatalog,
} from '../native-catalog/catalog.js';
import { receiptOf } from './report.js';
import type { Workspace } from './workspace.js';

export const nativeDeviceInsertionInputSchema = {
  trackId: z.string().min(1).describe('Durable track id from list_tracks.'),
  deviceNames: z.array(z.string().min(1).describe(
    'Exact native-device catalog name.',
  )).min(1).max(16).describe(
    'One through 16 native devices. The tool appends them in this order.',
  ),
} as const;

export const nativeDeviceInsertionInputValidator = z.object(
  nativeDeviceInsertionInputSchema,
).strict();

export type NativeDeviceInsertionInput = z.infer<
  typeof nativeDeviceInsertionInputValidator
>;

export interface NativeDeviceInsertionOptions {
  readonly catalogPath?: string;
}

function completeEnabled(bank: ObservedDeviceBank): readonly boolean[] | undefined {
  if (!bank.devicesComplete || bank.bankSize === undefined) return undefined;
  const enabled = bank.devices.map((device) => device.enabled);
  return enabled.every((value): value is boolean => typeof value === 'boolean')
    ? enabled
    : undefined;
}

function catalogRefusal(error: unknown): Record<string, unknown> {
  if (error instanceof NativeNameResolutionError) {
    return {
      refused: true,
      nothingWasWritten: true,
      why: 'Nothing was written. One or more exact native-device names did not resolve.',
      failedDeviceNames: error.failures,
    };
  }
  return {
    refused: true,
    nothingWasWritten: true,
    why: 'Nothing was written. The native-device catalog could not be validated.',
  };
}

const reversal = {
  insertedDevice: 'delete-last-proved-current-position',
  existingDeviceDelete: 'none',
};

/** Resolve all names, then append and verify each native device in order. */
export async function runNativeDeviceInsertion(
  workspace: Workspace,
  input: NativeDeviceInsertionInput,
  options: NativeDeviceInsertionOptions = {},
): Promise<Record<string, unknown>> {
  let resolved;
  try {
    const catalog = JSON.parse(await readFile(
      options.catalogPath ?? NATIVE_CATALOG_PATH,
      'utf8',
    )) as NativeCatalog;
    resolved = resolveExactNativeDevices(catalog, input.deviceNames);
  } catch (error) {
    return catalogRefusal(error);
  }

  const track = trackAt(input.trackId);
  const added: Array<Record<string, unknown>> = [];
  const changes: ReturnType<typeof receiptOf>[] = [];
  const failed = (why: string): Record<string, unknown> => ({
    applied: false,
    partialSuccess: added.length > 0,
    why,
    requestedDeviceNames: input.deviceNames,
    changes,
    added,
    reversal,
  });

  for (const [requestIndex, device] of resolved.entries()) {
    try {
      const before = await workspace.devices(track);
      const enabled = completeEnabled(before);
      if (enabled === undefined) {
        return failed('The complete top-level device names and enabled states are not visible.');
      }
      if (before.devices.length >= before.bankSize!) {
        return failed('The device bank has no addressable position for another device.');
      }
      const names = before.devices.map((item) => item.name);
      const expectedNames = [...names, device.name];
      const expectedEnabled = [...enabled, true];
      const change = await workspace.apply([{
        op: 'device.insert',
        track,
        source: { from: 'bitwig', uuid: device.uuid },
        expectedDeviceName: device.name,
        expectedChain: names,
        expectedEnabledChain: enabled,
      }]);
      const receipt = receiptOf(change);
      changes.push(receipt);
      const minted = Object.values(change.take.receipt.minted)
        .filter((address): address is DeviceAddress => address.kind === 'device');
      if (!receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
          || receipt.notReadBack !== undefined || minted.length !== 1) {
        return failed('Insertion did not finish with one exact positional readback.');
      }

      const after = await workspace.devices(track);
      const afterEnabled = completeEnabled(after);
      const exact = afterEnabled !== undefined
        && after.devices.length === expectedNames.length
        && after.devices.every((item, index) =>
          item.name === expectedNames[index] && afterEnabled[index] === expectedEnabled[index]);
      if (!exact || minted[0]!.chainIndex !== expectedNames.length - 1) {
        return failed('The complete top-level device order or enabled state did not read back exactly.');
      }
      added.push({
        requestIndex,
        deviceName: device.name,
        position: minted[0]!.chainIndex,
        devicePosition: minted[0]!.chainIndex,
        verified: true,
        change: receipt,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return failed(`Insertion stopped before the next device was proved: ${detail}`);
    }
  }

  return {
    applied: true,
    partialSuccess: false,
    verified: true,
    requestedDeviceNames: input.deviceNames,
    changes,
    added,
    reversal,
  };
}
