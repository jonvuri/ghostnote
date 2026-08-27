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
