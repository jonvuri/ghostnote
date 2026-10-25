/**
 * The effective content and plug-in roots of one host configuration (E350).
 *
 * My Library and the package directory resolve to their platform defaults when the preference is empty. The
 * configured plug-in list is used as it stands: Bitwig materializes the standard locations into that list and
 * records explicit removals separately, so a standard location that the person removed is never re-added here.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';

import type { HostContext } from './host-context.js';
import { packageRoot, type PrefsLocations } from './prefs.js';

export type RootKind = 'native' | 'my-library' | 'packages' | 'sound-content' | 'music' | 'plug-ins';

export interface DiscoveredRoot {
  readonly kind: RootKind;
  readonly path: string;
  readonly origin: 'installation' | 'default' | 'configured';
  readonly automaticUpdate?: boolean;
  /** True when the path is a readable directory at discovery time. */
  readonly available: boolean;
  readonly problem?: string;
}

function availability(path: string): { available: boolean; problem?: string } {
  try {
    const stat = statSync(path);
    return stat.isDirectory() ? { available: true } : { available: false, problem: 'not a directory' };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { available: false, problem: code === 'ENOENT' ? 'does not exist' : code === 'EACCES' ? 'permission denied' : String(code ?? error) };
  }
}

const root = (kind: RootKind, path: string, origin: DiscoveredRoot['origin'], automaticUpdate?: boolean): DiscoveredRoot => ({
  kind, path, origin, ...(automaticUpdate === undefined ? {} : { automaticUpdate }), ...availability(path),
});

/** The default macOS My Library (`TL.BBT()` / `tJi()` on 6.1.4). */
export const defaultMyLibrary = (home: string): string => join(home, 'Documents', 'Bitwig Studio', 'Library');

export function discoverRoots(context: HostContext, prefs: PrefsLocations | null): DiscoveredRoot[] {
  const roots: DiscoveredRoot[] = [root('native', context.deviceSettingsRoot, 'installation')];
  if (prefs === null) return roots;
  roots.push(prefs.myLibrary.length === 0
    ? root('my-library', defaultMyLibrary(context.home), 'default')
    : root('my-library', prefs.myLibrary, 'configured'));
  const packages = packageRoot(prefs.packageInstallationDirectory, context.settingsRoot);
  roots.push(root('packages', packages, prefs.packageInstallationDirectory.length === 0 ? 'default' : 'configured'));
  for (const item of prefs.soundContent) roots.push(root('sound-content', item.path, 'configured', item.automaticUpdate));
  for (const item of prefs.music) roots.push(root('music', item.path, 'configured', item.automaticUpdate));
  for (const item of prefs.plugins) roots.push(root('plug-ins', item.path, 'configured', item.automaticUpdate));
  return roots;
}

export const PRESET_ROOT_KINDS: readonly RootKind[] = ['my-library', 'packages', 'sound-content', 'music'];
