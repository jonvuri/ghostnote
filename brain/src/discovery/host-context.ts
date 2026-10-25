/**
 * The running Bitwig application and its effective settings directory (V14, E350).
 *
 * Discovery must read the configuration of the host that Ghostnote talks to, not the newest prefs file on disk
 * and not Ghostnote's own environment. On macOS the brain and Bitwig run on one machine (the bridge is loopback),
 * so the Bitwig process, its executable, and its environment are visible through `ps`. The settings root follows
 * `TL.EYR()` on 6.1.4: `BITWIG_USER_SETTINGS_DIR` selects a directory under `~/Library/Application Support/Bitwig/`,
 * otherwise `Bitwig Studio` there. The bundle version comes from the application's `Info.plist`, and the live
 * handshake version from the connected extension is cross-checked when it is known. Other platforms refuse.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { fingerprintJar, type JarFingerprint } from '../grid/admission.js';

const run = promisify(execFile);

export interface HostProcess {
  readonly pid: number;
  readonly ppid: number;
  readonly command: string;
}

/** The operating-system facts the context reads. Tests inject a fake; the product uses `ps` and `plutil`. */
export interface HostProbe {
  readonly platform: NodeJS.Platform;
  readonly home: string;
  listProcesses(): Promise<readonly HostProcess[]>;
  /** The `KEY=VALUE` environment text of one process, as `ps -E` prints it. */
  processEnvironment(pid: number): Promise<string>;
  bundleVersion(appRoot: string): Promise<string>;
}

export interface HostContext {
  readonly platform: 'macos';
  readonly appRoot: string;
  readonly pid: number;
  readonly version: string;
  /** The handshake version of the connected extension, or null when no handshake is cached. */
  readonly liveHostVersion: string | null;
  readonly settingsRoot: string;
  readonly settingsOverride: string | null;
  readonly home: string;
  readonly prefsPath: string;
  readonly indexDirectory: string;
  /** Bitwig's plug-in metadata caches under the host user's Caches folder. */
  readonly cacheDirectory: string;
  readonly deviceSettingsRoot: string;
  readonly jar: JarFingerprint | null;
  readonly jarProblem: string | null;
  /** The `Version name` of `last-run-info.txt` under the settings root, or null when unreadable. */
  readonly lastRunVersion: string | null;
}

export type HostContextFailure =
  | 'unsupported-platform' | 'no-running-host' | 'multiple-hosts' | 'process-unreadable' | 'version-unreadable'
  | 'host-version-mismatch' | 'settings-root-missing';

export type HostContextResult =
  | { readonly ok: true; readonly context: HostContext }
  | { readonly ok: false; readonly reason: HostContextFailure; readonly detail: string };

const APP_EXECUTABLE = /^(.*\.app)\/Contents\/MacOS\/BitwigStudio$/;

export function parseProcessList(text: string): HostProcess[] {
  return text.split('\n').flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    return match === null ? [] : [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3]! }];
  });
}

/** Extract one variable from `ps -E` text. A value runs to the next `NAME=` token; spaces inside a value survive. */
export function environmentVariable(text: string, name: string): string | undefined {
  const pattern = new RegExp(`(?:^|\\s)${name}=(.*?)(?=\\s+[A-Za-z_][A-Za-z0-9_]*=|\\s*$)`, 's');
  const match = pattern.exec(text);
  return match === null ? undefined : match[1];
}

export const defaultHostProbe: HostProbe = {
  platform: process.platform,
  home: process.env['HOME'] ?? '',
  async listProcesses() {
    const { stdout } = await run('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { maxBuffer: 16 * 1024 * 1024 });
    return parseProcessList(stdout);
  },
  async processEnvironment(pid) {
    const { stdout } = await run('/bin/ps', ['-E', '-o', 'command=', '-p', String(pid)], { maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  },
  async bundleVersion(appRoot) {
    const { stdout } = await run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(appRoot, 'Contents', 'Info.plist')]);
    const plist = JSON.parse(stdout) as Record<string, unknown>;
    const version = plist['CFBundleShortVersionString'];
    if (typeof version !== 'string' || version.length === 0) throw new Error('CFBundleShortVersionString is missing');
    return version;
  },
};

function lastRunVersion(settingsRoot: string): string | null {
  try {
    const text = readFileSync(join(settingsRoot, 'last-run-info.txt'), 'utf8');
    const match = /^Version name:\s*(.+?)\s*$/m.exec(text);
    return match === null ? null : match[1]!;
  } catch {
    return null;
  }
}

/** Identify the running Bitwig application and resolve its settings root. */
export async function discoverHostContext(
  probe: HostProbe = defaultHostProbe, liveHostVersion: string | null = null,
): Promise<HostContextResult> {
  if (probe.platform !== 'darwin') {
    return { ok: false, reason: 'unsupported-platform', detail: `host discovery is implemented for macOS only; this is ${probe.platform}` };
  }
  let processes: readonly HostProcess[];
  try {
    processes = await probe.listProcesses();
  } catch (error) {
    return { ok: false, reason: 'process-unreadable', detail: `the process list could not be read: ${String(error)}` };
  }
  const hosts = processes.flatMap((item) => {
    const match = APP_EXECUTABLE.exec(item.command);
    return match === null ? [] : [{ ...item, appRoot: match[1]! }];
  });
  if (hosts.length === 0) return { ok: false, reason: 'no-running-host', detail: 'no BitwigStudio process is running' };
  const roots = [...new Set(hosts.map((item) => item.appRoot))];
  if (roots.length > 1) {
    return { ok: false, reason: 'multiple-hosts', detail: `more than one Bitwig application is running: ${roots.join(', ')}` };
  }
  // The launcher re-executes itself; the process whose parent is not another host is the application.
  const pids = new Set(hosts.map((item) => item.pid));
  const main = hosts.find((item) => !pids.has(item.ppid)) ?? hosts[0]!;
  let environment: string;
  try {
    environment = await probe.processEnvironment(main.pid);
  } catch (error) {
    return { ok: false, reason: 'process-unreadable', detail: `the Bitwig process environment could not be read: ${String(error)}` };
  }
  const home = environmentVariable(environment, 'HOME') ?? probe.home;
  const override = environmentVariable(environment, 'BITWIG_USER_SETTINGS_DIR');
  const settingsOverride = override === undefined || override.length === 0 ? null : override;
  const settingsRoot = settingsOverride === null
    ? join(home, 'Library', 'Application Support', 'Bitwig', 'Bitwig Studio')
    : join(home, 'Library', 'Application Support', 'Bitwig', settingsOverride);
  let version: string;
  try {
    version = await probe.bundleVersion(main.appRoot);
  } catch (error) {
    return { ok: false, reason: 'version-unreadable', detail: `the application version could not be read: ${String(error)}` };
  }
  if (liveHostVersion !== null && liveHostVersion !== version) {
    return { ok: false, reason: 'host-version-mismatch',
      detail: `the connected extension reports Bitwig ${liveHostVersion}, but the running application at ${main.appRoot} is ${version}` };
  }
  if (!existsSync(settingsRoot)) {
    return { ok: false, reason: 'settings-root-missing', detail: `the settings directory does not exist: ${settingsRoot}` };
  }
  const jarPath = join(main.appRoot, 'Contents', 'Java', 'bitwig.jar');
  let jar: JarFingerprint | null = null;
  let jarProblem: string | null = null;
  try {
    jar = fingerprintJar(jarPath);
  } catch (error) {
    jarProblem = `the application jar could not be fingerprinted: ${error instanceof Error ? error.message : String(error)}`;
  }
  return {
    ok: true,
    context: {
      platform: 'macos', appRoot: main.appRoot, pid: main.pid, version, liveHostVersion, settingsRoot, settingsOverride, home,
      prefsPath: join(settingsRoot, 'prefs', `${version}.prefs`),
      indexDirectory: join(settingsRoot, 'index'),
      cacheDirectory: join(home, 'Library', 'Caches', 'Bitwig'),
      deviceSettingsRoot: join(main.appRoot, 'Contents', 'Resources', 'Library', 'device-settings'),
      jar, jarProblem, lastRunVersion: lastRunVersion(settingsRoot),
    },
  };
}
