/** Bounds and evidence rules for the normal-profile upgrade audit. */
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export type Bag = Record<string, any>;
export const LIMITS = Object.freeze({ tracks: 8, scenes: 8, notes: 256, deviceUnits: 4, controls: 16,
  calls: 6000, deadlineMs: 900_000, requestMs: 60_000, responseBytes: 2 * 1024 ** 2,
  evidenceBytes: 64 * 1024 ** 2, reserveBytes: 2 * 1024 ** 2 });
export const PROJECT = 'gn-upgrade-audit';
export const SWITCH_PROJECT = 'gn-upgrade-audit-switch';
export const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const canonical = (value: any): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)!;
export function equal(actual: unknown, expected: unknown, message: string): void {
  assert.equal(canonical(actual), canonical(expected), message);
}
export function assertVersion(version: unknown): asserts version is string {
  assert(typeof version === 'string' && /^6\.1(?:\.\d+)?$/.test(version), 'Select one exact stable 6.1.x version.');
}
/** Idle MCP servers do not own a bridge connection. Other probes still block entry. */
export function checkProcessEntry(processes: { pid: number; ppid: number; command: string }[],
  selfPid: number, sockets: string): { candidates: typeof processes; establishedPids: number[] } {
  const ancestors = new Set<number>([selfPid]);
  for (let pid = selfPid, depth = 0; depth < 32; depth++) {
    const row = processes.find(item => item.pid === pid);
    if (!row || row.ppid < 1 || ancestors.has(row.ppid)) break;
    ancestors.add(row.ppid); pid = row.ppid;
  }
  const candidates = processes.filter(row => /(?:tsx|node).*src\/(?:probes\/|mcp-server\.(?:ts|js))/.test(row.command));
  const competitors = candidates.filter(row => !ancestors.has(row.pid) && /src\/probes\//.test(row.command));
  assert.equal(competitors.length, 0, `Competing probe drivers: ${JSON.stringify(competitors)}`);
  const established = new Set<number>();
  let pid = 0;
  for (const field of sockets.split('\n')) {
    if (/^p\d+$/.test(field)) pid = Number(field.slice(1));
    if (field === 'TST=ESTABLISHED') {
      assert(pid > 0, 'Socket record has no process identity'); established.add(pid);
    }
  }
  assert(sockets.includes('TST=LISTEN'), 'Socket inventory has no bridge listener');
  assert.equal(established.size, 0, `Bridge already has a connected client: ${[...established]}`);
  return { candidates, establishedPids: [...established] };
}
export function assertOwned(owned: Bag[], rows: Bag[]): void {
  for (const item of owned) {
    const matches = rows.filter(row => row.channelId === item.id && row.name === item.name && row.type === item.type);
    assert.equal(matches.length, 1, `Owned identity changed: ${item.name}. Inspect; do not use a name match.`);
  }
}
export function assertMayRun(state: Bag, name: string): void {
  assert(!state.failure && !state.active, 'The prior chain failed or stopped. Inspect before a separate cleanup.');
  assert(!state.completed.includes(name), `Case ${name} already ran. Do not repeat it.`);
}
export function assertRefusal(reply: Bag, writes: number, codes: string[]): void {
  assert(codes.includes(reply.failure?.code), `Expected refusal: ${JSON.stringify(reply)}`);
  assert.equal(writes, 0, 'The refused call sent a write batch.');
  assert.equal(reply.failure?.effects?.length ?? 0, 0, 'The refusal reported an effect.');
}
/** Product tools use either a boolean verdict or a combined verdict object. */
export function assertVerification(reply: Bag, name: string): void {
  if (reply.verified !== undefined) assert.equal(typeof reply.verified === 'boolean'
    ? reply.verified : reply.verified?.passed, true, `${name}: verification failed`);
}
export function validateBounds(name: string, args: Bag): void {
  for (const key of ['row', 'firstRow', 'lastRow', 'destinationFirstRow']) {
    if (args[key] !== undefined) assert(Number.isInteger(args[key]) && args[key] >= 0 && args[key] < LIMITS.scenes, key);
  }
  if (args.settings) assert(args.settings.length <= LIMITS.controls, 'Control bound');
  if (name === 'add_tracks') assert(args.tracks.length <= LIMITS.tracks, 'Track bound');
  if (name === 'compose_devices') {
    const devices = (args.layerChains ?? []).flatMap((chain: Bag) => chain.devices);
    const units = devices.reduce((n: number, item: Bag) => n + (['clap', 'vst3'].includes(item.source.kind) ? 2 : 1)
      + ((item.modulators?.length ?? 0) > 0 ? 2 : 0), 0);
    assert(units <= LIMITS.deviceUnits, 'Composition unit bound');
  }
  if (typeof args.document === 'object') assert((args.document.events?.length ?? 0) <= LIMITS.notes, 'Note bound');
}

/** The audit owns this directory. Reserve space for a failure and inspection. */
export class Evidence {
  bytes = 0;
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    const size = (path: string): number => statSync(path).isDirectory()
      ? readdirSync(path).reduce((n, name) => n + size(join(path, name)), 0) : statSync(path).size;
    this.bytes = size(dir);
  }
  private account(bytes: number, emergency: boolean): void {
    assert(this.bytes + bytes <= LIMITS.evidenceBytes - (emergency ? 0 : LIMITS.reserveBytes), 'Evidence byte cap. Stop and inspect.');
    this.bytes += bytes;
  }
  save(name: string, value: unknown, emergency = false): void {
    assert(/^[a-zA-Z0-9_.-]+$/.test(name));
    const path = join(this.dir, name), text = JSON.stringify(value, null, 2) + '\n';
    const prior = existsSync(path) ? statSync(path).size : 0;
    this.account(Buffer.byteLength(text), emergency);
    writeFileSync(path + '.tmp', text);
    renameSync(path + '.tmp', path);
    this.bytes -= prior;
  }
  append(name: string, value: unknown): void {
    const line = JSON.stringify(value) + '\n';
    this.account(Buffer.byteLength(line), false);
    appendFileSync(join(this.dir, name), line);
  }
  load(name: string): Bag { return JSON.parse(readFileSync(join(this.dir, name), 'utf8')); }
}
