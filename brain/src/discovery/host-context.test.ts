/** Host discovery on an injected process probe. No real process list is read. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { discoverHostContext, environmentVariable, parseProcessList, type HostProbe, type HostProcess } from './host-context.js';

// A fake application root: no jar exists there, so the fingerprint stays null on every machine.
const APP = '/Volumes/Fake/Bitwig Studio.app';
const EXE = `${APP}/Contents/MacOS/BitwigStudio`;

function probe(over: Partial<HostProbe> & { processes?: readonly HostProcess[]; environment?: string; version?: string } = {}): HostProbe {
  return {
    platform: 'darwin', home: '/Users/person',
    listProcesses: async () => over.processes ?? [{ pid: 1, ppid: 0, command: '/sbin/launchd' }, { pid: 44, ppid: 1, command: EXE }, { pid: 46, ppid: 44, command: EXE }],
    processEnvironment: async () => over.environment ?? `${EXE} USER=person HOME=/Users/person SHELL=/bin/zsh`,
    bundleVersion: async () => over.version ?? '6.1.4',
    ...over,
  };
}

function settings(home: string, name = 'Bitwig Studio'): string {
  const root = join(home, 'Library', 'Application Support', 'Bitwig', name);
  mkdirSync(join(root, 'prefs'), { recursive: true });
  writeFileSync(join(root, 'last-run-info.txt'), 'Edition: studio\nVersion name: 6.1.4\nRevision id: x\n');
  return root;
}

test('host context: ps output parses and environment values keep their spaces', () => {
  assert.deepEqual(parseProcessList(`  44     1 ${EXE}\n 46    44 ${EXE}\n 1 0 /sbin/launchd\n`),
    [{ pid: 44, ppid: 1, command: EXE }, { pid: 46, ppid: 44, command: EXE }, { pid: 1, ppid: 0, command: '/sbin/launchd' }]);
  const text = `${EXE} USER=person BITWIG_USER_SETTINGS_DIR=Bitwig Studio Beta HOME=/Users/person XPC_FLAGS=1`;
  assert.equal(environmentVariable(text, 'BITWIG_USER_SETTINGS_DIR'), 'Bitwig Studio Beta');
  assert.equal(environmentVariable(text, 'HOME'), '/Users/person');
  assert.equal(environmentVariable(text, 'XPC_FLAGS'), '1');
  assert.equal(environmentVariable(text, 'MISSING'), undefined);
});

test('host context: the application, version, default settings root, prefs path, and index directory', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'gn-host-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = settings(home);
  const result = await discoverHostContext(probe({ environment: `${EXE} HOME=${home} USER=person` }), '6.1.4');
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.context.appRoot, APP);
  assert.equal(result.context.pid, 44);
  assert.equal(result.context.version, '6.1.4');
  assert.equal(result.context.settingsRoot, root);
  assert.equal(result.context.settingsOverride, null);
  assert.equal(result.context.prefsPath, join(root, 'prefs', '6.1.4.prefs'));
  assert.equal(result.context.indexDirectory, join(root, 'index'));
  assert.equal(result.context.deviceSettingsRoot, `${APP}/Contents/Resources/Library/device-settings`);
  assert.equal(result.context.lastRunVersion, '6.1.4');
  assert.equal(result.context.liveHostVersion, '6.1.4');
  assert.equal(result.context.jar, null);
  assert.match(result.context.jarProblem ?? '', /could not be fingerprinted/);
});

test('host context: BITWIG_USER_SETTINGS_DIR selects a directory under the Bitwig support folder of the host HOME', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'gn-host-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const root = settings(home, 'Bitwig Studio Beta');
  const result = await discoverHostContext(probe({ environment: `${EXE} BITWIG_USER_SETTINGS_DIR=Bitwig Studio Beta HOME=${home} USER=person` }));
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(result.context.settingsRoot, root);
  assert.equal(result.context.settingsOverride, 'Bitwig Studio Beta');
  assert.equal(result.context.liveHostVersion, null);
});

test('host context: refusals name the condition', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'gn-host-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  settings(home);
  const environment = `${EXE} HOME=${home}`;
  const cases: Array<[Parameters<typeof probe>[0], string | null, string]> = [
    [{ platform: 'linux' }, null, 'unsupported-platform'],
    [{ processes: [{ pid: 1, ppid: 0, command: '/sbin/launchd' }] }, null, 'no-running-host'],
    [{ processes: [{ pid: 44, ppid: 1, command: EXE }, { pid: 90, ppid: 1, command: '/Volumes/Other/Bitwig Studio.app/Contents/MacOS/BitwigStudio' }] }, null, 'multiple-hosts'],
    [{ listProcesses: async () => { throw new Error('ps failed'); } }, null, 'process-unreadable'],
    [{ processEnvironment: async () => { throw new Error('denied'); } }, null, 'process-unreadable'],
    [{ bundleVersion: async () => { throw new Error('no plist'); }, environment }, null, 'version-unreadable'],
    [{ version: '6.1.5', environment }, '6.1.4', 'host-version-mismatch'],
    [{ environment: `${EXE} HOME=${join(home, 'nowhere')}` }, null, 'settings-root-missing'],
  ];
  for (const [over, live, reason] of cases) {
    const result = await discoverHostContext(probe(over), live);
    assert.equal(result.ok, false, reason);
    if (!result.ok) assert.equal(result.reason, reason);
  }
});
