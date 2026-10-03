/**
 * 8g5b live occupancy controls. Each trial compares published occupancy with an
 * independent settled slot scan. Research only; nothing becomes eligible.
 *
 * Modes:
 *   config set|restore <entry.json>     write or restore the research config bytes
 *   scan <out.json>                     two settled independent scans
 *   arm <out.json> <label>              publish occupancy and compare it with a scan
 *   check <out.json> <arm.json> <declaration.json>
 *                                       after a native change: retirement, scan, declaration, and publication
 *   detours <out.json> <state.json> <reps>
 *                                       same-callback P→Q→P detours during and after publication
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import type { SlotSides } from './e222-slot-delivery-lib.js';
import { SLOT_WINDOW_MARKER, compareOccupancy, declaredOccupancy, publishedOccupancy, scanOccupancy } from './phase8g5b-slot-lib.js';

type Wire = Record<string, unknown>;
const PROTECTED_PROJECT = 'New 3';
const NEXT = 'Select Next Project', PREV = 'Select Previous Project';
const bridge = new BridgeClient();
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const request = async (method: string, params?: Wire): Promise<Wire> => await bridge.request(method, params, 30_000) as Wire;
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
async function save(path: string, value: Wire): Promise<void> { await writeFile(path, JSON.stringify(value, null, 1) + '\n', { flag: 'wx' }); }
const project = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;

export const RESEARCH_CONFIG = { recordChars: 0, stamp: '8g5b-slot-window', cacheLifecycleResearch: true, deliveryResearch: true,
  cacheShadowObservers: 2, cacheShadowSteps: 2048, fineSteps: 2048, contentFilter: 'ALL_CHANNELS' };

async function config(mode: string, entryPath: string): Promise<void> {
  const saved = await readJson(entryPath);
  const bytes = Buffer.from(String(saved.configBase64), 'base64'); assert.equal(hash(bytes), saved.configSha256);
  const research = Buffer.from(JSON.stringify(RESEARCH_CONFIG, null, 2) + '\n'), current = await readFile(configPath);
  if (mode === 'set') { assert.deepEqual(current, bytes); await writeFile(configPath, research); }
  else { assert.equal(mode, 'restore'); assert.deepEqual(current, research); await writeFile(configPath, bytes); }
  console.log(JSON.stringify({ config: mode, sha256: hash(await readFile(configPath)) }));
}

/** One full slot read through the stable handlers. It does not use the shadow inventory. */
async function scanOnce(): Promise<Wire> {
  const tracks = await request('track.list'), scenes = await request('scene.count');
  const groups = await shadow('trackGroups');
  assert.equal(groups.coherent, true, 'group flags are not coherent');
  const groupIds = (groups.tracks as Wire[]).filter(row => row.isGroup === true).map(row => String(row.channelId));
  const slots: Wire[] = [];
  for (const track of tracks.tracks as Wire[]) for (let row = 0; row < Number(scenes.sceneCount); row++) {
    const status = await request('slot.status', { trackIndex: track.index, slotIndex: row });
    slots.push({ trackId: track.channelId, row, exists: status.exists, hasContent: status.hasContent });
  }
  return { tracks, sceneCount: scenes.sceneCount, groupIds, slots };
}

/** Settled means two complete scans agree. Return the second scan. */
async function settledScan(): Promise<Wire> {
  const until = Date.now() + 15_000;
  let previous = await scanOnce();
  for (;;) {
    await wait(300);
    const current = await scanOnce();
    if (JSON.stringify(current) === JSON.stringify(previous)) return { first: previous, second: current };
    assert(Date.now() < until, 'slot scan did not settle'); previous = current;
  }
}

/** Run an explicit rebuild, then wait for the later-callback confirmation. */
async function publish(): Promise<Wire> {
  const begun = await shadow('rebuildBegin');
  let polled = await shadow('rebuildPoll'), polls = 1;
  const until = Date.now() + 10_000;
  while (polled.rebuildTerminal !== true && polled.registryPendingSlotConfirmation !== true && Date.now() < until) {
    polled = await shadow('rebuildPoll'); polls++;
  }
  let list = await shadow('inventoryList');
  while (list.reason === 'slot-window-pending' && Date.now() < until) { await wait(20); list = await shadow('inventoryList'); }
  return { begun: { reason: begun.reason, fallbackReason: begun.fallbackReason }, polls, polled, list };
}

async function scan(out: string): Promise<void> {
  const settled = await settledScan();
  await save(out, { schema: 'phase8g5b-scan-v1', project: await project(), complete: false, eligible: false,
    captured: new Date().toISOString(), ...settled, occupancy: scanOccupancy(settled.second as Wire) });
  console.log(JSON.stringify({ scan: out, occupancy: scanOccupancy(settled.second as Wire) }));
}

async function arm(out: string, label: string): Promise<void> {
  const name = await project(); assert.notEqual(name, PROTECTED_PROJECT, 'never arm the protected project');
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, SLOT_WINDOW_MARKER);
  const report: Wire = { schema: 'phase8g5b-arm-v1', label, project: name, complete: false, eligible: false, captured: new Date().toISOString() };
  try {
    report.before = await settledScan();
    report.topology = await shadow('trackTopology');
    report.publication = await publish();
    report.after = await settledScan();
    const before = scanOccupancy((report.before as Wire).second as Wire), after = scanOccupancy((report.after as Wire).second as Wire);
    assert.deepEqual(before, after, 'occupancy changed during the arm');
    report.scanOccupancy = after;
    report.published = publishedOccupancy((report.publication as Wire).list as Wire);
    report.comparison = compareOccupancy(report.published as string[], after.clips);
    assert.equal((report.comparison as Wire).matches, true, 'published occupancy differs from the scan');
  } catch (error) { report.error = String(error); throw error; }
  finally { report.info = await shadow('info'); await save(out, report); }
  console.log(JSON.stringify({ arm: out, project: name, comparison: report.comparison }));
}

/** After a declared native change: retirement first, then a settled scan, the declaration, and a fresh publication. */
async function check(out: string, armPath: string, declarationPath: string): Promise<void> {
  const armed = await readJson(armPath), declaration = await readJson(declarationPath);
  const name = await project();
  const report: Wire = { schema: 'phase8g5b-check-v1', armPath, declarationPath, declaration, project: name,
    complete: false, eligible: false, captured: new Date().toISOString() };
  try {
    assert.notEqual(name, PROTECTED_PROJECT);
    if (declaration.expectedProject) assert.equal(name, declaration.expectedProject, 'unexpected project after the change');
    report.retained = await shadow('inventoryList');
    report.retainedRefused = (report.retained as Wire).occupancyAdmitted !== true;
    report.settled = await settledScan();
    const current = scanOccupancy((report.settled as Wire).second as Wire);
    const prior = declaration.baseline === 'replace' ? [] : (armed.scanOccupancy as Wire).clips as string[];
    report.declared = declaredOccupancy(prior, declaration.operations as Wire[]);
    report.topology = await shadow('trackTopology');
    report.publication = await publish();
    report.after = await settledScan();
    assert.deepEqual(scanOccupancy((report.after as Wire).second as Wire), current, 'occupancy changed during the check');
    report.scanOccupancy = current;
    report.published = publishedOccupancy((report.publication as Wire).list as Wire);
    report.comparison = compareOccupancy(report.published as string[], current.clips, report.declared as string[]);
    assert.equal(report.retainedRefused, true, 'the native change did not retire the retained occupancy');
    assert.equal((report.comparison as Wire).matches, true, 'published occupancy, scan, and declaration disagree');
  } catch (error) { report.error = String(error); throw error; }
  finally { report.info = await shadow('info'); await save(out, report); }
  console.log(JSON.stringify({ check: out, retainedReason: (report.retained as Wire).reason, comparison: report.comparison }));
}

/** Same-callback detours during publication and after it. Every admitted list must equal the P scan. */
async function detours(out: string, statePath: string, reps: number): Promise<void> {
  const state = await readJson(statePath), sides = { P: state.P, Q: state.Q } as SlotSides;
  assert.equal(await project(), sides.P.name, 'detours must start on P');
  const script = [{ op: 'invoke', id: NEXT }, { op: 'invoke', id: PREV, delayMs: -1 }];
  const report: Wire = { schema: 'phase8g5b-detours-v1', sides, complete: false, eligible: false, hostFenceProved: false,
    started: new Date().toISOString(), reps, trials: [] };
  const persist = async (): Promise<void> => await writeFile(out, JSON.stringify(report, null, 1) + '\n');
  const reference = await settledScan();
  report.reference = reference; report.referenceOccupancy = scanOccupancy(reference.second as Wire);
  const expected = (report.referenceOccupancy as Wire).clips as string[];
  await persist();
  const runDetour = async (): Promise<void> => {
    await shadow('deliveryRun', { script });
    const until = Date.now() + 10_000;
    while (Number((await shadow('deliveryStatus')).runRemaining) > 0) { assert(Date.now() < until); await wait(10); }
  };
  for (let rep = 0; rep < reps; rep++) {
    for (const phase of ['during', 'after'] as const) {
      const trial: Wire = { rep, phase };
      if (phase === 'during') {
        await shadow('rebuildBegin'); await runDetour();
        let list = await shadow('inventoryList'); const until = Date.now() + 5_000;
        while (list.reason === 'slot-window-pending' && Date.now() < until) { await shadow('rebuildPoll'); await wait(10); list = await shadow('inventoryList'); }
        if (list.occupancyAdmitted !== true) { await shadow('rebuildPoll'); list = await shadow('inventoryList'); }
        while (list.reason === 'slot-window-pending' && Date.now() < until) { await wait(10); list = await shadow('inventoryList'); }
        trial.list = list;
      } else {
        const published = await publish(); trial.preList = published.list;
        await runDetour(); await wait(100);
        trial.list = await shadow('inventoryList');
      }
      const list = trial.list as Wire;
      trial.admitted = list.occupancyAdmitted === true; trial.reason = list.reason ?? null;
      trial.slotWindowValue = list.slotWindowValue; trial.lastSlotWindowRefusal = list.lastSlotWindowRefusal;
      await wait(400);
      trial.endpoint = await project();
      trial.scan = scanOccupancy((await settledScan()).second as Wire);
      if (trial.admitted) trial.comparison = compareOccupancy(publishedOccupancy(list), expected);
      (report.trials as Wire[]).push(trial); await persist();
      assert.equal(trial.endpoint, sides.P.name, `rep ${rep} ${phase} did not end on P`);
      assert.deepEqual((trial.scan as Wire).clips, expected, `rep ${rep} ${phase} scan differs from P`);
      if (trial.admitted) assert.equal((trial.comparison as Wire).matches, true, `rep ${rep} ${phase} admitted foreign occupancy`);
    }
  }
  const trials = report.trials as Wire[];
  report.summary = { trials: trials.length, admitted: trials.filter(t => t.admitted).length,
    refused: trials.filter(t => !t.admitted).length,
    refusalReasons: Object.fromEntries([...new Set(trials.filter(t => !t.admitted).map(t => String(t.reason)))]
      .map(reason => [reason, trials.filter(t => !t.admitted && String(t.reason) === reason).length])),
    admittedMismatches: trials.filter(t => t.admitted && (t.comparison as Wire).matches !== true).length,
    foreignSlots: trials.reduce((n, t) => n + (t.admitted ? ((t.comparison as Wire).foreignSlots as string[]).length : 0), 0) };
  report.ended = new Date().toISOString(); await persist();
  console.log(JSON.stringify(report.summary));
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  await bridge.connect();
  if (mode === 'config') { assert(args[0] && args[1]); await config(args[0], args[1]); }
  else if (mode === 'scan') { assert(args[0]); await scan(args[0]); }
  else if (mode === 'arm') { assert(args[0] && args[1]); await arm(args[0], args[1]); }
  else if (mode === 'check') { assert(args[0] && args[1] && args[2]); await check(args[0], args[1], args[2]); }
  else if (mode === 'detours') { assert(args[0] && args[1]); await detours(args[0], args[1], Number(args[2] ?? 20)); }
  else throw new Error('usage: config|scan|arm|check|detours');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
