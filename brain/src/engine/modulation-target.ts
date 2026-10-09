/** Format-hidden conversion from a public DirectParameter target to one route. */

export interface ModulationTarget {
  /** Exact id returned by a stable DirectParameter inventory. */
  readonly parameterId: string;
  /** Exact name returned with the id in the same inventory. */
  readonly parameterName: string;
}

/** Resolved container coordinate. Semantic location resolution occurs elsewhere. */
export interface ResolvedModulationTargetLocation {
  readonly containerName: string;
  readonly deviceIndex: number;
}

/** Convert one exact DirectParameter id to the internal Ramona route. */
export function modulationRoute(
  target: ModulationTarget,
  location?: ResolvedModulationTargetLocation,
): string {
  if (target.parameterId.trim() === '') throw new Error('parameterId must not be empty');
  if (target.parameterName.trim() === '') throw new Error('parameterName must not be empty');
  const pluginParameter = /^CONTENTS\/(PID[0-9a-f]+)$/i.exec(target.parameterId)?.[1];
  const parameterRoute = pluginParameter === undefined
    ? target.parameterId
    : `CONTENTS/ROOT_GENERIC_MODULE/${pluginParameter}`;
  if (location === undefined) return parameterRoute;
  if (location.containerName.trim() === '') throw new Error('containerName must not be empty');
  if (!Number.isInteger(location.deviceIndex) || location.deviceIndex < 0) {
    throw new Error('deviceIndex is out of range');
  }
  return `CONTENTS/DEVICE_CHAIN/${location.containerName}/DEVICE_CHAIN/`
    + `${location.deviceIndex}:${parameterRoute}`;
}

/**
 * D46: the DirectParameter id forms whose derived route the modulation conformance suite proves live. A native id
 * is `CONTENTS/` and one segment; a plug-in id is `CONTENTS/PID` and a hex number. Another form (for example a
 * deeper module path) can load as a silent route (E10), so the live product refuses it before mutation.
 */
export const PROVED_ROUTE_FORMS = Object.freeze([
  { form: 'native', pattern: /^CONTENTS\/[^/]+$/ },
  { form: 'plug-in', pattern: /^CONTENTS\/PID[0-9a-f]+$/i },
] as const);

/** The proved route form of one DirectParameter id, or undefined. */
export function provedRouteForm(parameterId: string): 'native' | 'plug-in' | undefined {
  if (PROVED_ROUTE_FORMS[1].pattern.test(parameterId)) return 'plug-in';
  return PROVED_ROUTE_FORMS[0].pattern.test(parameterId) ? 'native' : undefined;
}

/** The targets whose id has no proved route form (D46). */
export function unprovedRouteTargets<T extends ModulationTarget>(targets: readonly T[]): T[] {
  return targets.filter((target) => provedRouteForm(target.parameterId) === undefined);
}
