export interface DeviceItem {
  readonly index: number;
  readonly name: string;
}

export interface DeviceRead {
  readonly devices: readonly DeviceItem[];
  readonly count: number;
  readonly itemCount: number;
  readonly trackChannelId: string;
  readonly trackPosition: number;
  readonly bankSize: number;
}

export interface StableDeviceRow extends DeviceRead {
  readonly attempts: number;
  readonly stable: boolean;
}

const signature = (read: DeviceRead): string => JSON.stringify({
  trackChannelId: read.trackChannelId,
  trackPosition: read.trackPosition,
  itemCount: read.itemCount,
  count: read.count,
  bankSize: read.bankSize,
  devices: read.devices,
});

/** Accept a cursor-bound bank read only after two equal consecutive replies. */
export async function stableDeviceRead(
  expectedChannelId: string,
  read: () => Promise<DeviceRead>,
  maxAttempts = 12,
): Promise<StableDeviceRow> {
  let previous = '';
  let last: DeviceRead | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await read();
    const current = signature(last);
    if (last.trackChannelId === expectedChannelId && current === previous) {
      return { ...last, attempts: attempt, stable: true };
    }
    previous = last.trackChannelId === expectedChannelId ? current : '';
  }
  return {
    ...(last ?? {
      devices: [], count: 0, itemCount: 0, trackChannelId: '',
      trackPosition: -1, bankSize: 0,
    }),
    attempts: maxAttempts,
    stable: false,
  };
}

export function percentile(samples: readonly number[], fraction: number): number {
  if (samples.length === 0) throw new Error('percentile needs at least one sample');
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))]!;
}

export function requireFullTrackWindow(itemCount: number, bankSize: number): void {
  if (itemCount > bankSize) {
    throw new Error(`project has ${itemCount} tracks but the measurement window has ${bankSize}`);
  }
}
