/**
 * DirectParameter and Remote Control reads and writes (8h4e).
 *
 * `stable-v1` and `agent-native-v1` share these bodies. The two profiles use
 * different tool names in their schema text, so the schemas come from
 * `deviceControlSchemas`. The `stable-v1` text must not change: its description
 * fingerprints are frozen.
 */
import { z } from 'zod';

import {
  chain as chainAt, param as paramAt, remote as remoteAt, remotes as remotesAt,
  track as trackAt, device as deviceAt, deviceIn, drumPad as drumPadAt,
  addressKey, discreteNormalizedValues, hasMeaningfulBaseToModulatedDivergence,
  type DeviceAddress, type ObservedDeviceBank, type Op, type ParamState,
} from '../contract/index.js';
import { receiptOf, refusalOf } from './report.js';
import type { Workspace } from './workspace.js';

/** The tool names and the layer-chain route step that the schema text uses. */
export interface DeviceControlNames {
  /** The tool that returns DirectParameter IDs. */
  readonly readControls: string;
  /** The tool that returns the top-level device order. */
  readonly readDevices: string;
  /** The route step that goes into one named layer chain. */
  readonly layerStep: 'named-container-entry' | 'layer-chain';
  /** Schema text for the name of that step. */
  readonly layerStepName: string;
}

export const STABLE_DEVICE_CONTROL_NAMES: DeviceControlNames = {
  readControls: 'inspect_device_parameters',
  readDevices: 'inspect_devices',
  layerStep: 'named-container-entry',
  layerStepName: 'The exact named entry returned by container inspection.',
};

export type RouteStep =
  | { readonly through: 'named-container-entry' | 'layer-chain'; readonly name: string; readonly devicePosition: number }
  | { readonly through: 'drum-pad'; readonly channel: number };

export interface DeviceTargetInput {
  readonly trackId: string;
  readonly devicePosition: number;
  readonly route?: readonly RouteStep[];
}

interface DirectSelector { readonly kind: 'direct'; readonly device: DeviceTargetInput; readonly parameterId: string }
interface RemoteSelector {
  readonly kind: 'remote';
  readonly device: DeviceTargetInput;
  readonly pagePosition: number;
  readonly pageName: string;
  readonly controlPosition: number;
  readonly controlName: string;
}
interface NormalizedValue { readonly valueKind: 'normalized'; readonly normalizedValue: number }
interface SemanticValue { readonly valueKind: 'semantic'; readonly semanticValue: string }

export type ParameterSetting =
  | (DirectSelector & NormalizedValue)
  | (DirectSelector & SemanticValue)
  | (RemoteSelector & NormalizedValue)
  | (RemoteSelector & SemanticValue);
type NormalizedParameterSetting = Extract<ParameterSetting, { valueKind: 'normalized' }>;
type SemanticParameterSetting = Extract<ParameterSetting, { valueKind: 'semantic' }>;

/** Build the device-target, parameter-setting, and device-order schemas with the names of one profile. */
export function deviceControlSchemas(trackId: z.ZodType<string>, names: DeviceControlNames) {
  const nestedDeviceStep = z.discriminatedUnion('through', [
    z.object({
      through: z.literal(names.layerStep),
      name: z.string().min(1).describe(names.layerStepName),
      devicePosition: z.number().int().min(0).describe(
        names.layerStep === 'layer-chain'
          ? 'Device position inside the named layer chain, from 0.'
          : 'Device position inside the named container entry, from 0.',
      ),
    }),
    z.object({
      through: z.literal('drum-pad'),
      channel: z.number().int().min(0).max(15).describe(
        'Drum-pad channel, from 0 through 15. The route reaches its first device.',
      ),
    }),
  ]);

  const deviceTarget = z.object({
    trackId,
    devicePosition: z.number().int().min(0).describe(
      'Top-level device position, from 0. This is positional and changes after a device-order edit.',
    ),
    route: z.array(nestedDeviceStep).max(2).optional().describe(
      names.layerStep === 'layer-chain'
        ? 'Optional measured route through named layer chains or drum-pad channels. Read the names again '
          + `with ${names.readDevices} after a structural edit. Two descents are supported.`
        : 'Optional measured route through named container entries or drum-pad channels. Read names again after '
          + 'a structural edit. Two descents are supported.',
    ),
  });

  const parameterId = () => z.string().min(1).describe(
    `Exact DirectParameter id returned by ${names.readControls}.`,
  );
  const semanticValue = () => z.string().min(1).describe(
    'Requested value with its unit, such as "1.5 measures". API 25 cannot convert this to a scalar.',
  );

  const parameterSetting = z.union([
    z.object({
      kind: z.literal('direct'),
      device: deviceTarget,
      parameterId: parameterId(),
      valueKind: z.literal('normalized').default('normalized'),
      normalizedValue: z.number().min(0).max(1),
    }).strict(),
    z.object({
      kind: z.literal('direct'),
      device: deviceTarget,
      parameterId: parameterId(),
      valueKind: z.literal('semantic'),
      semanticValue: semanticValue(),
    }).strict(),
    z.object({
      kind: z.literal('remote'),
      device: deviceTarget,
      pagePosition: z.number().int().min(0),
      pageName: z.string().min(1),
      controlPosition: z.number().int().min(0),
      controlName: z.string().min(1),
      valueKind: z.literal('normalized').default('normalized'),
      normalizedValue: z.number().min(0).max(1),
    }).strict(),
    z.object({
      kind: z.literal('remote'),
      device: deviceTarget,
      pagePosition: z.number().int().min(0),
      pageName: z.string().min(1),
      controlPosition: z.number().int().min(0),
      controlName: z.string().min(1),
      valueKind: z.literal('semantic'),
      semanticValue: semanticValue(),
    }).strict(),
  ]);

  const expectedDeviceOrder = z.array(z.object({
    name: z.string(),
    enabled: z.boolean(),
  })).describe(
    `Optional exact complete order from the latest ${names.readDevices} result. The write refuses if it changed.`,
  );

  return { deviceTarget, parameterSetting, expectedDeviceOrder };
}

function isSemanticParameterSetting(setting: ParameterSetting): setting is SemanticParameterSetting {
  return setting.valueKind === 'semantic';
}

export const parameterValueCapabilities = {
  normalized: { readable: true, writable: true, minimum: 0, maximum: 1 },
  displayed: {
    readable: 'when-observed', writable: false, invertible: false,
    meaning: 'Opaque host-formatted text for the current normalized value.',
  },
  discrete: {
    readable: 'when-host-proved', writable: 'returned-normalized-values-only',
  },
  semantic: {
    readable: false, writable: false,
    reason: 'API 25 has no text parser or exact displayed-value inverse conversion.',
  },
} as const;

export function addressedDevice(target: DeviceTargetInput): DeviceAddress {
  let current = deviceAt(trackAt(target.trackId), target.devicePosition);
  for (const step of target.route ?? []) {
    current = step.through !== 'drum-pad'
      ? deviceIn(chainAt(current, step.name), step.devicePosition)
      : deviceIn(drumPadAt(current, step.channel), 0);
  }
  return current;
}

export function completeDeviceBank(bank: ObservedDeviceBank): bank is ObservedDeviceBank & {
  readonly devicesComplete: true;
  readonly bankSize: number;
} {
  return bank.devicesComplete && bank.bankSize !== undefined;
}

export function enabledFingerprint(bank: ObservedDeviceBank): readonly boolean[] | undefined {
  const values = bank.devices.map((item) => item.enabled);
  return values.every((value): value is boolean => typeof value === 'boolean') ? values : undefined;
}

function publicParameter(parameter: ParamState): Record<string, unknown> {
  return {
    id: parameter.id,
    name: parameter.name,
    normalizedValue: parameter.value,
    ...(parameter.index === undefined ? {} : { typedIndex: parameter.index }),
    ...(parameter.display === undefined ? {} : { display: parameter.display }),
    ...(parameter.modulatedValue === undefined
      ? {} : { modulatedValue: parameter.modulatedValue }),
    ...(parameter.hasAutomation === undefined
      ? {} : { hasAutomation: parameter.hasAutomation }),
    ...(parameter.origin === undefined ? {} : { origin: parameter.origin }),
    ...(parameter.discreteValueCount === undefined || parameter.discreteValueCount < 0
      ? {} : { discreteValueCount: parameter.discreteValueCount }),
    ...(parameter.discreteValueCount === undefined || parameter.discreteValueCount < 0
      ? {} : { discreteNormalizedValues: discreteNormalizedValues(parameter.discreteValueCount) }),
    ...(parameter.discreteValueNames === undefined || parameter.discreteValueNames.length === 0
      ? {} : { discreteValueNames: parameter.discreteValueNames }),
  };
}

function parameterWarnings(parameter: ParamState): string[] {
  return [
    ...(parameter.modulatedValue !== undefined
        && hasMeaningfulBaseToModulatedDivergence(parameter.value, parameter.modulatedValue)
      ? ['The modulated value differs from the stored base value. A static write is not the value heard.']
      : []),
    ...(parameter.hasAutomation === true
      ? ['Host automation can override the stored base value.']
      : []),
  ];
}

type ParameterWarningCode = 'base-modulated-divergence' | 'automation-can-override-base';

interface ParameterWarningOccurrence {
  readonly code: ParameterWarningCode;
  readonly message: string;
  readonly settingIndex: number;
  readonly selector: Record<string, unknown>;
}

function parameterSelector(setting: NormalizedParameterSetting): Record<string, unknown> {
  return setting.kind === 'direct'
    ? { kind: 'direct', parameterId: setting.parameterId }
    : {
      kind: 'remote',
      pagePosition: setting.pagePosition,
      pageName: setting.pageName,
      controlPosition: setting.controlPosition,
      controlName: setting.controlName,
    };
}

function parameterWarning(
  settingIndex: number,
  setting: NormalizedParameterSetting,
  message: string,
): ParameterWarningOccurrence {
  return {
    code: message.startsWith('Host automation')
      ? 'automation-can-override-base'
      : 'base-modulated-divergence',
    message,
    settingIndex,
    selector: parameterSelector(setting),
  };
}

function groupedParameterWarnings(warnings: readonly ParameterWarningOccurrence[]) {
  const groups: Array<{
    code: ParameterWarningCode;
    message: string;
    settings: Array<{ settingIndex: number; selector: Record<string, unknown> }>;
  }> = [];
  const byKey = new Map<string, (typeof groups)[number]>();
  for (const warning of warnings) {
    const key = `${warning.code}\u0000${warning.message}`;
    let group = byKey.get(key);
    if (group === undefined) {
      group = { code: warning.code, message: warning.message, settings: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.settings.push({ settingIndex: warning.settingIndex, selector: warning.selector });
  }
  return groups;
}

function compactParameterChanges(
  settings: readonly NormalizedParameterSetting[],
  receipts: readonly ReturnType<typeof receiptOf>[],
) {
  const routes: Array<{
    device: DeviceTargetInput;
    changes: Array<{
      settingIndex: number;
      selector: Record<string, unknown>;
      changeId: string;
    }>;
  }> = [];
  const byRoute = new Map<string, (typeof routes)[number]>();
  for (const [settingIndex, setting] of settings.entries()) {
    const receipt = receipts[settingIndex];
    if (receipt === undefined) throw new Error('the successful parameter result is missing a scalar receipt');
    const key = JSON.stringify(setting.device);
    let route = byRoute.get(key);
    if (route === undefined) {
      route = { device: setting.device, changes: [] };
      byRoute.set(key, route);
      routes.push(route);
    }
    route.changes.push({
      settingIndex,
      selector: parameterSelector(setting),
      changeId: receipt.changeId,
    });
  }
  return routes;
}


export interface ReadDeviceControlsOptions {
  /**
   * 8h4e (E244): report display completeness and an empty plug-in ID list. `stable-v1` leaves this off, so its
   * result shape does not change.
   */
  readonly display?: boolean;
}

/** Read one DirectParameter inventory or the remote-control pages of one device. */
export async function readDeviceControls(
  workspace: Workspace,
  args: { readonly device: DeviceTargetInput; readonly view?: 'direct' | 'remote-controls' | undefined },
  options: ReadDeviceControlsOptions = {},
): Promise<Record<string, unknown>> {
  const started = performance.now();
  const target = addressedDevice(args.device);
  const remoteInventory = remotesAt(target);
  const targetKey = addressKey(target);
  const remoteKey = addressKey(remoteInventory);
  if (args.view === 'remote-controls') {
    const snapshot = await workspace.read([remoteInventory]);
    const standing = snapshot.unreachable.some((item) => addressKey(item) === remoteKey)
      ? 'unreachable'
      : snapshot.unstable.some((item) => addressKey(item) === remoteKey)
        ? 'unstable'
        : snapshot.missing.some((item) => addressKey(item) === remoteKey)
          ? 'missing'
          : 'stable';
    const entry = snapshot.entries[remoteKey];
    if (standing !== 'stable' || entry?.value.of !== 'remotes') {
      return {
        device: args.device,
        view: 'remote-controls',
        standing: standing === 'stable' ? 'unstable' : standing,
        remotePages: [],
        valueCapabilities: parameterValueCapabilities,
        warnings: [],
        elapsedMs: Math.round(performance.now() - started),
      };
    }
    const pages = entry.value.remotes.pages.map((page) => ({
      position: page.index,
      name: page.name,
      controls: page.controls.map((control) => ({
        position: control.index,
        name: control.name,
        normalizedValue: control.value,
        ...(control.display === undefined ? {} : { display: control.display }),
        ...(control.origin === undefined ? {} : { origin: control.origin }),
        ...(control.discreteValueCount === undefined || control.discreteValueCount < 0
          ? {} : {
            discreteValueCount: control.discreteValueCount,
            discreteNormalizedValues: discreteNormalizedValues(control.discreteValueCount),
          }),
        ...(control.discreteValueNames === undefined || control.discreteValueNames.length === 0
          ? {} : { discreteValueNames: control.discreteValueNames }),
        modulatedValue: control.modulatedValue,
        isBeingMapped: control.isBeingMapped,
        ...(control.hasAutomation === undefined
          ? {} : { hasAutomation: control.hasAutomation }),
      })),
    }));
    return {
      device: args.device,
      view: 'remote-controls',
      standing: 'stable',
      remotePages: pages,
      valueCapabilities: parameterValueCapabilities,
      warnings: pages.flatMap((page) => page.controls.flatMap((control) => [
        ...(hasMeaningfulBaseToModulatedDivergence(
          control.normalizedValue,
          control.modulatedValue,
        )
          ? [{
            remote: { pagePosition: page.position, controlPosition: control.position },
            message: 'The modulated value differs from the stored base value.',
          }] : []),
        ...(control.hasAutomation === true
          ? [{
            remote: { pagePosition: page.position, controlPosition: control.position },
            message: 'Host automation can override the stored base value.',
          }] : []),
      ])),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  const snapshot = await workspace.read([target]);
  const standing = snapshot.unreachable.some((item) => addressKey(item) === targetKey)
    ? 'unreachable'
    : snapshot.unstable.some((item) => addressKey(item) === targetKey)
      ? 'unstable'
      : snapshot.missing.some((item) => addressKey(item) === targetKey)
        ? 'missing'
        : 'stable';
  const deviceEntry = snapshot.entries[targetKey];
  if (standing !== 'stable' || deviceEntry?.value.of !== 'device'
      || deviceEntry.value.device.params === undefined) {
    return {
      device: args.device,
      view: 'direct',
      standing: standing === 'stable' ? 'unstable' : standing,
      parameters: [],
      valueCapabilities: parameterValueCapabilities,
      warnings: [],
      elapsedMs: Math.round(performance.now() - started),
    };
  }
  const parameters = deviceEntry.value.device.params;
  if (options.display === true && parameters.length === 0 && deviceEntry.value.device.isPlugin === true) {
    // E244: with the audio engine off, a CLAP plug-in lists no IDs. That is not a plug-in with no parameters.
    return {
      device: args.device,
      view: 'direct',
      deviceName: deviceEntry.value.device.name,
      standing: 'unavailable',
      why: 'parameters unavailable (audio engine off or plug-in not loaded)',
      parameters: [],
      valueCapabilities: parameterValueCapabilities,
      warnings: [],
      elapsedMs: Math.round(performance.now() - started),
    };
  }
  const warnings = parameters.flatMap((parameter) =>
    parameterWarnings(parameter).map((message) => ({ parameterId: parameter.id, message })));
  return {
    device: args.device,
    view: 'direct',
    deviceName: deviceEntry.value.device.name,
    standing: 'stable',
    ...(options.display === true
      ? { displayComplete: deviceEntry.value.device.paramsDisplayComplete === true }
      : {}),
    parameters: parameters.map(publicParameter),
    valueCapabilities: parameterValueCapabilities,
    warnings,
    elapsedMs: Math.round(performance.now() - started),
  };
}

/** Write DirectParameters or remote controls in same-route cohorts, with readback for each scalar. */
export async function setDeviceControls(
  workspace: Workspace,
  args: { readonly settings: readonly ParameterSetting[] },
): Promise<unknown> {
  const started = performance.now();
  const changes: ReturnType<typeof receiptOf>[] = [];
  const warnings: ParameterWarningOccurrence[] = [];
  const unsupportedIndex = args.settings.findIndex(isSemanticParameterSetting);
  if (unsupportedIndex >= 0) {
    const setting = args.settings[unsupportedIndex] as SemanticParameterSetting;
    return {
      applied: false,
      partialSuccess: false,
      verified: false,
      refused: true,
      nothingWasWritten: true,
      why: 'API 25 cannot convert an exact semantic parameter value to a writable scalar.',
      unsupportedValue: {
        settingIndex: unsupportedIndex,
        valueKind: 'semantic',
        semanticValue: setting.semanticValue,
        reason: parameterValueCapabilities.semantic.reason,
      },
      valueCapabilities: parameterValueCapabilities,
      changes,
      warnings: groupedParameterWarnings(warnings),
      elapsedMs: Math.round(performance.now() - started),
    };
  }
  const normalizedSettings = args.settings as NormalizedParameterSetting[];
  try {
    let verified = true;
    const cohorts: Array<Array<{
      settingIndex: number;
      setting: NormalizedParameterSetting;
    }>> = [];
    for (const [settingIndex, setting] of normalizedSettings.entries()) {
      const prior = cohorts.at(-1);
      const routeKey = JSON.stringify({ kind: setting.kind, device: setting.device });
      const targetKey = setting.kind === 'direct'
        ? setting.parameterId
        : `${setting.pagePosition}:${setting.pageName}:${setting.controlPosition}:${setting.controlName}`;
      const priorRouteKey = prior === undefined ? undefined : JSON.stringify({
        kind: prior[0]!.setting.kind,
        device: prior[0]!.setting.device,
      });
      const repeatsTarget = prior?.some((item) => setting.kind === 'direct'
        ? item.setting.kind === 'direct' && item.setting.parameterId === targetKey
        : item.setting.kind === 'remote'
          && `${item.setting.pagePosition}:${item.setting.pageName}:`
            + `${item.setting.controlPosition}:${item.setting.controlName}` === targetKey) ?? false;
      if (prior === undefined || priorRouteKey !== routeKey || repeatsTarget) {
        cohorts.push([{ settingIndex, setting }]);
      } else {
        prior.push({ settingIndex, setting });
      }
    }

    for (const cohort of cohorts) {
      const first = cohort[0]!.setting;
      const target = addressedDevice(first.device);
      const bank = await workspace.devices(trackAt(first.device.trackId));
      const enabled = enabledFingerprint(bank);
      if (!completeDeviceBank(bank) || enabled === undefined) {
        throw new Error('the complete top-level device names and enabled states are not visible');
      }
      const expectedChain = bank.devices.map((item) => item.name);
      const top = bank.devices[first.device.devicePosition];
      if (top === undefined) throw new Error('the top-level device position is absent');

      const ops: Op[] = [];
      let preflight: Awaited<ReturnType<Workspace['read']>>;
      if (first.kind === 'direct') {
        const parameterAddresses = cohort.map((item) => {
          if (item.setting.kind !== 'direct') throw new Error('the parameter cohort view changed');
          return paramAt(target, item.setting.parameterId);
        });
        const snapshot = await workspace.read([target, ...parameterAddresses]);
        preflight = snapshot;
        const entry = snapshot.entries[addressKey(target)];
        if (snapshot.unreachable.length > 0) throw new Error('the parameter target is outside its bank window');
        if (snapshot.unstable.length > 0) throw new Error('the parameter observer inventory is unstable');
        if (entry?.value.of !== 'device' || entry.value.device.params === undefined) {
          throw new Error('the parameter target or its complete inventory is missing');
        }
        for (const item of cohort) {
          const setting = item.setting;
          if (setting.kind !== 'direct') throw new Error('the parameter cohort view changed');
          const matches = entry.value.device.params.filter(
            (parameter) => parameter.id === setting.parameterId,
          );
          if (matches.length !== 1) {
            throw new Error(`the DirectParameter id matched ${matches.length} parameters`);
          }
          warnings.push(...parameterWarnings(matches[0]!).map((message) =>
            parameterWarning(item.settingIndex, setting, message)));
          ops.push({
            op: 'param.set',
            param: paramAt(target, setting.parameterId),
            value: setting.normalizedValue,
            expectedName: entry.value.device.name,
            expectedChain,
            expectedEnabledChain: enabled,
          });
        }
      } else {
        const inventoryAddress = remotesAt(target);
        const remoteAddresses = cohort.map((item) => {
          const setting = item.setting;
          if (setting.kind !== 'remote') throw new Error('the parameter cohort view changed');
          return remoteAt(
            target,
            setting.pagePosition,
            setting.pageName,
            setting.controlPosition,
            setting.controlName,
          );
        });
        const snapshot = await workspace.read([inventoryAddress, ...remoteAddresses]);
        preflight = snapshot;
        const entry = snapshot.entries[addressKey(inventoryAddress)];
        if (snapshot.unreachable.length > 0) throw new Error('the remote target is outside its bank window');
        if (snapshot.unstable.length > 0) throw new Error('the remote observer inventory is unstable');
        if (entry?.value.of !== 'remotes') throw new Error('the remote inventory is missing');
        for (const item of cohort) {
          const setting = item.setting;
          if (setting.kind !== 'remote') throw new Error('the parameter cohort view changed');
          const page = entry.value.remotes.pages[setting.pagePosition];
          const control = page?.controls[setting.controlPosition];
          if (page?.name !== setting.pageName || control?.name !== setting.controlName) {
            throw new Error('the remote page or control does not match the fresh inventory');
          }
          if (hasMeaningfulBaseToModulatedDivergence(
            control.value,
            control.modulatedValue,
          )) {
            warnings.push(parameterWarning(
              item.settingIndex,
              setting,
              'The modulated value differs from the stored base value.',
            ));
          }
          if (control.hasAutomation === true) {
            warnings.push(parameterWarning(
              item.settingIndex,
              setting,
              'Host automation can override the stored base value.',
            ));
          }
          ops.push({
            op: 'remote.set',
            remote: remoteAt(
              target,
              setting.pagePosition,
              setting.pageName,
              setting.controlPosition,
              setting.controlName,
            ),
            value: setting.normalizedValue,
            expectedName: entry.value.remotes.deviceName,
            expectedChain,
            expectedEnabledChain: enabled,
          });
        }
      }
      const cohortChanges = await workspace.applyParameterCohort(ops, {
        parameterPreflight: preflight,
      });
      const receipts = cohortChanges.map(receiptOf);
      changes.push(...receipts);
      if (receipts.length !== ops.length || receipts.some((receipt) =>
        !receipt.applied || receipt.failed !== undefined || receipt.mismatches !== undefined
          || receipt.notReadBack !== undefined)) {
        verified = false;
        throw new Error('the parameter cohort did not complete and verify every scalar target');
      }
    }
    return {
      applied: changes.every((change) => change.applied),
      partialSuccess: false,
      verified,
      parameterChanges: compactParameterChanges(normalizedSettings, changes),
      valueCapabilities: parameterValueCapabilities,
      warnings: groupedParameterWarnings(warnings),
      reversal: 'exact-base-value-while-the-device-route-remains-valid',
      elapsedMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (changes.length === 0) return refusalOf(error);
    return {
      applied: false,
      partialSuccess: true,
      verified: false,
      why: 'A later setting did not finish after earlier writes completed.',
      changes,
      valueCapabilities: parameterValueCapabilities,
      warnings: groupedParameterWarnings(warnings),
      reversal: 'exact-base-value-while-the-device-route-remains-valid',
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}
