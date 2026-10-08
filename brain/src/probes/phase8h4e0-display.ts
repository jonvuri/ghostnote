/**
 * 8h4e0 DirectParameter display probe (E244). Live driver, probe profile, owned unsaved project.
 *
 *   setup <state.json>          tracks poly1, poly2 (Polysynth), phase1, phase2 (Phase-4), clap (Stochas, CLAP), and
 *                               diva (u-he Diva, CLAP)
 *   probes <out> <state.json>   Q1-Q6: the display observer with the IDs of the settled target set
 *   diva <out> <state.json>     the largest case, Diva (281 IDs with the audio engine on): Q1, Q4, and the Q5 set cost
 *   clap-ids <out> <state.json> Q4 on each CLAP: a write at resolution 1 with the listed ID observed, then with the
 *                               callback ID form (CONTENTS/ROOT_GENERIC_MODULE/...) observed as well
 *   cleanup <out> <state.json>  delete every track that the entry list does not hold, and stop the observer
 *   verify-offline <dir>        check every E244 claim from the retained artifacts
 *
 * Log rows are [micros since the log restart, kind, id, detail]. Kinds: ids, name, value, display, mark.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { WireTransport } from './phase8h3c-promotion.js';
import type { Wire } from './phase8h3c2-rows-lib.js';

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const PHASE4 = '252723bf-68a6-4ee6-81f8-95ba4d0fb467';
const STOCHAS = 'org.surge-synth-team.stochas';
const DIVA = 'com.u-he.Diva';
export const KEYS = ['poly1', 'poly2', 'phase1', 'phase2', 'clap', 'diva'] as const;
type Key = typeof KEYS[number];
const INSTRUMENT: Record<Key, { kind: 'bitwig' | 'clap'; id: string; name?: string }> = {
  poly1: { kind: 'bitwig', id: POLYSYNTH, name: 'Polysynth' },
  poly2: { kind: 'bitwig', id: POLYSYNTH, name: 'Polysynth' },
  phase1: { kind: 'bitwig', id: PHASE4, name: 'Phase-4' },
  phase2: { kind: 'bitwig', id: PHASE4, name: 'Phase-4' },
  clap: { kind: 'clap', id: STOCHAS },
  diva: { kind: 'clap', id: DIVA },
};
/** How long a step waits for display callbacks before it records a negative. */
const DISPLAY_LIMIT = 5_000;

type Row = [number, string, string | null, string | number | null];

const transport = new WireTransport();
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await transport.sendRecorded({ method, ...(params ? { params } : {}) }) as Wire;
const pause = async (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const load = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8'));
const save = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 1) + '\n');
};
const artifact = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, gzipSync(JSON.stringify(value) + '\n'));
};
const gz = async (path: string): Promise<Wire> => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const failure = (error: unknown): string => error instanceof Error ? `${error.name}: ${error.message}` : String(error);
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 30_000): Promise<Wire> {
  const started = performance.now();
  for (;;) {
    const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live state did not settle: ${JSON.stringify(value).slice(0, 400)}`);
    await pause(25);
  }
}
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] ?? NaN;
};

async function guard(profile: 'phase-8-probe-v1' | undefined): Promise<Wire> {
  const hello = await request('contract.hello');
  if (profile) assert.equal(hello.runtimeProfile, profile);
  const mark = await request('revision.get');
  assert(/^New \d+$/.test(mark.project), `use an owned unsaved project, got ${mark.project}`);
  return { hello, mark, rig: await request('rig.info') };
}
const tracks = async (): Promise<Wire[]> => (await request('track.list')).tracks as Wire[];
async function rowOf(id: string): Promise<Wire> {
  const found = (await tracks()).find(row => row.channelId === id);
  assert(found, `track ${id} is absent`); return found;
}
async function createTrack(name: string): Promise<string> {
  const before = new Set((await tracks()).map(row => row.channelId));
  await request('track.create', { position: 0 });
  const after = await until(() => request('track.list'),
    value => (value.tracks as Wire[]).some(row => row.index === 0 && !before.has(row.channelId)));
  const id = String((after.tracks as Wire[]).find(row => row.index === 0)!.channelId);
  await request('track.setName', { trackIndex: 0, name }); return id;
}

async function setup(statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1');
  const state: Wire = { schema: 'phase8h4e0-state-v1', entry, entryTracks: await tracks(), tracks: {}, names: {} };
  // Created at position 0 in reverse, so the bank order is the order of KEYS.
  for (const key of [...KEYS].reverse()) {
    const id = await createTrack(`gn-8h4e0-${key}`);
    const index = Number((await rowOf(id)).index), instrument = INSTRUMENT[key];
    await request('cursor.pinTrack', { cursor: '0', pinned: false });
    await request('cursor.pointTrack', { cursor: '0', trackIndex: index });
    await pause(100);
    if (instrument.kind === 'bitwig') await request('device.insertBitwig', { cursor: '0', uuid: instrument.id });
    else await request('device.insertClap', { cursor: 0, clapId: instrument.id });
    const listed = await until(() => request('device.list', { cursor: '0' }),
      value => value.trackChannelId === id && typeof (value.devices as Wire[] | undefined)?.[0]?.name === 'string'
        && (instrument.name === undefined || (value.devices as Wire[])[0]!.name === instrument.name), 15_000);
    state.tracks[key] = id; state.names[key] = (listed.devices as Wire[])[0]!.name;
    await save(statePath, state);
  }
  console.log(JSON.stringify({ tracks: state.tracks, names: state.names }));
}

// ------------------------------------------------------------------ probe primitives

let state: Wire;
const nameOf = (key: Key): string => String(state.names[key]);

/** Point cursor 0 at device 0 of a track, as the adapter does, and wait for the device name. */
async function pointDevice(key: Key): Promise<number> {
  const id = String(state.tracks[key]), started = performance.now();
  const index = Number((await rowOf(id)).index);
  await request('cursor.pinTrack', { cursor: '0', pinned: false });
  await request('cursor.pointTrack', { cursor: '0', trackIndex: index });
  await request('devcursor.selectAt', { deviceIndex: 0 });
  await until(() => request('directparam.callbacks'), v => v.trackChannelId === id && v.deviceName === nameOf(key), 5_000);
  return Math.round(performance.now() - started);
}

/** Begin a DirectParameter generation and poll until it settles. Returns the settle and the full ID list. */
async function settleParams(limit = 5_000): Promise<Wire> {
  const started = performance.now();
  const begun = await request('directparam.list', { begin: true });
  let observed: Wire = begun;
  while (performance.now() - started < limit) {
    observed = await request('directparam.list', {});
    if (observed.idsGeneration === begun.generation && observed.count > 0
        && (observed.params as Wire[]).every(p => typeof p.value === 'number' && typeof p.name === 'string')) break;
    await pause(25);
  }
  const params = observed.params as Wire[];
  return { settled: observed.idsGeneration === begun.generation && observed.count > 0, settledBy: observed.settledBy,
    ms: Math.round(performance.now() - started), count: observed.count, deviceName: observed.deviceName,
    ids: params.map(p => p.id), values: params.map(p => p.value), names: params.map(p => p.name),
    displayed: params.map(p => p.displayed ?? null) };
}

const observe = async (ids: readonly string[] | null, page?: number): Promise<Wire> =>
  await request('directparam.observeDisplay', { ids, ...(page === undefined ? {} : { page }) });
const readLog = async (params: Wire = {}): Promise<Wire> => await request('directparam.log', params);

/** The callbacks of one log: counts, first and last times (ms), and the display text for each ID. */
export function summarize(rows: readonly Row[], ids: readonly string[] = []): Wire {
  const counts: Record<string, number> = {}, first: Record<string, number> = {}, last: Record<string, number> = {};
  const displays: Record<string, string> = {}, displayCount: Record<string, number> = {};
  for (const [micros, kind, id, detail] of rows) {
    counts[kind] = (counts[kind] ?? 0) + 1;
    first[kind] ??= micros / 1000; last[kind] = micros / 1000;
    if (kind === 'display' && id !== null) {
      displays[id] = String(detail); displayCount[id] = (displayCount[id] ?? 0) + 1;
    }
  }
  const want = new Set(ids);
  const covered = ids.filter(id => displays[id] !== undefined).length;
  let coveredAt: number | null = null;
  if (ids.length > 0 && covered === ids.length) {
    const seen = new Set<string>();
    for (const [micros, kind, id] of rows) {
      if (kind !== 'display' || id === null || !want.has(id)) continue;
      seen.add(id); if (seen.size === want.size) { coveredAt = micros / 1000; break; }
    }
  }
  return { counts, first, last, covered, coveredAt, outside: Object.keys(displays).filter(id => !want.has(id)).length,
    displays, repeats: Object.values(displayCount).filter(n => n > 1).length };
}

/** Poll the log until each ID has a display callback (and `also` holds), or for `limit` ms. */
async function waitDisplays(ids: readonly string[], limit = DISPLAY_LIMIT,
  also: (rows: Row[]) => boolean = () => true): Promise<Wire> {
  const started = performance.now();
  let log = await readLog();
  while (performance.now() - started < limit) {
    const rows = log.events as Row[];
    const shown = new Set(rows.filter(r => r[1] === 'display').map(r => r[2]));
    if (ids.every(id => shown.has(id)) && also(rows)) break;
    await pause(25);
    log = await readLog();
  }
  await pause(150);
  log = await readLog();
  return { waitedMs: Math.round(performance.now() - started), dropped: log.dropped, rows: log.events,
    summary: summarize(log.events as Row[], ids) };
}

const covers = (rows: Row[], kind: string, ids: readonly string[]): boolean => {
  const seen = new Set(rows.filter(r => r[1] === kind).map(r => r[2]));
  return ids.every(id => seen.has(id));
};

async function step(record: Wire[], label: Wire, run: () => Promise<Wire>): Promise<Wire | undefined> {
  const started = performance.now();
  try {
    const value = await run();
    record.push({ ...label, ok: true, ms: Math.round(performance.now() - started), ...value });
  } catch (error) {
    record.push({ ...label, ok: false, ms: Math.round(performance.now() - started), error: failure(error) });
  }
  const last = record.at(-1)!;
  console.log(JSON.stringify({ ...label, ok: last.ok, ...(last.ok ? {} : { error: last.error }),
    ...(last.summary ? { counts: last.summary.counts, covered: last.summary.covered, coveredAt: last.summary.coveredAt } : {}) }));
  return last.ok ? last : undefined;
}

/** Point at a device, settle, and return its ID list. The observer is stopped first. */
async function target(key: Key): Promise<Wire> {
  await observe(null);
  const pointedMs = await pointDevice(key);
  const settle = await settleParams();
  assert(settle.settled, `${key}: the parameters did not settle`);
  return { pointedMs, ...settle };
}

/** A parameter with a continuous-looking value, for writes. */
const writable = (settle: Wire): number => {
  const index = (settle.values as number[]).findIndex(v => v > 0.1 && v < 0.9);
  return index >= 0 ? index : 0;
};

// ------------------------------------------------------------------ Q1-Q6

async function q1(report: Wire, key: Key): Promise<Wire | undefined> {
  return await step(report.steps, { q: 'Q1', key }, async () => {
    const settle = await target(key);
    const set = await observe(settle.ids);
    const shown = await waitDisplays(settle.ids);
    const list = await request('directparam.list', {});
    const typed = key.startsWith('poly') ? await request('param.list') : undefined;
    const comparison = typed === undefined ? undefined : (typed.params as Wire[])
      .filter(p => p.exists === true && typeof p.displayed === 'string')
      .map(p => ({ id: p.id, typed: p.displayed, direct: shown.summary.displays[`CONTENTS/${p.id}`] ?? null }));
    return { settle, set, ...shown, listDisplayed: (list.params as Wire[]).filter(p => typeof p.displayed === 'string').length,
      comparison };
  });
}

/** A device whose settle can report no IDs: record the list as it is. */
async function idList(report: Wire, key: Key): Promise<void> {
  await step(report.steps, { q: 'Q1', key, part: 'ids' }, async () => {
    await observe(null);
    const pointedMs = await pointDevice(key);
    await pause(1_500);
    const settle = await settleParams();
    return { pointedMs, settle: { ...settle, ids: undefined, values: undefined, names: undefined, displayed: undefined },
      callbacks: await request('directparam.callbacks') };
  });
}

async function q6(report: Wire, key: Key): Promise<void> {
  const settle = await target(key);
  for (const page of [0, 1, 2]) {
    await step(report.steps, { q: 'Q6', key, page }, async () => {
      await observe(settle.ids, page);
      return await waitDisplays(settle.ids, 3_000);
    });
  }
  await observe(null);
}

/** Q2 and Q3: the callbacks of one switch, with the observer set on the earlier target. */
async function switchStep(report: Wire, label: Wire, to: Key, ids: readonly string[]): Promise<Wire | undefined> {
  return await step(report.steps, label, async () => {
    await readLog({ restart: true });
    await readLog({ mark: `point ${to}` });
    const pointedMs = await pointDevice(to);
    const shown = await waitDisplays(ids, DISPLAY_LIMIT, rows => covers(rows, 'value', ids) && covers(rows, 'name', ids));
    const settle = await settleParams();
    return { to, pointedMs, ...shown, settle: { settled: settle.settled, settledBy: settle.settledBy, ms: settle.ms,
      count: settle.count, displayed: (settle.displayed as unknown[]).filter(d => d !== null).length } };
  });
}

/** Write one parameter of the current target and time its value and display callbacks. */
async function writeStep(report: Wire, label: Wire, id: string, value: number): Promise<Wire | undefined> {
  return await step(report.steps, label, async () => {
    await readLog({ restart: true });
    // The product encoder sends resolution 1; the handler default (128) divides the value.
    const set = await request('directparam.set', { id, value, resolution: 1 });
    const started = performance.now();
    let rows: Row[] = [];
    while (performance.now() - started < 3_000) {
      rows = (await readLog()).events as Row[];
      if (rows.some(r => r[1] === 'value' && r[2] === id) && rows.some(r => r[1] === 'display' && r[2] === id)) break;
      await pause(10);
    }
    const valueAt = rows.find(r => r[1] === 'value' && r[2] === id)?.[0];
    const displayAt = rows.find(r => r[1] === 'display' && r[2] === id)?.[0];
    return { id, value, set, rows, valueMs: valueAt === undefined ? null : valueAt / 1000,
      displayMs: displayAt === undefined ? null : displayAt / 1000,
      lagMs: valueAt === undefined || displayAt === undefined ? null : (displayAt - valueAt) / 1000,
      texts: rows.filter(r => r[1] === 'display' && r[2] === id).map(r => r[3]),
      values: rows.filter(r => r[1] === 'value' && r[2] === id).map(r => r[3]),
      otherDisplays: rows.filter(r => r[1] === 'display' && r[2] !== id).length };
  });
}

/** Q5: switches inside one same-type pair with the first `n` IDs observed. */
async function costRun(report: Wire, pair: [Key, Key], ids: readonly string[], n: number): Promise<void> {
  const observed = n === 0 ? null : ids.slice(0, n);
  await target(pair[0]);
  await observe(observed);
  if (observed) await waitDisplays(observed);
  for (let round = 0; round < 4; round++) {
    const to = pair[(round + 1) % 2]!;
    await step(report.steps, { q: 'Q5', pair: pair.join('-'), n, round }, async () => {
      const c0 = await request('directparam.callbacks');
      await readLog({ restart: true });
      const started = performance.now();
      const pointedMs = await pointDevice(to);
      const settle = await settleParams();
      const settleMs = Math.round(performance.now() - started);
      const setAt = performance.now();
      if (observed) await observe(observed);
      const shown = observed ? await waitDisplays(observed) : undefined;
      const c1 = await request('directparam.callbacks');
      const pings: number[] = [];
      for (let i = 0; i < 5; i++) { const t = performance.now(); await request('ping'); pings.push(performance.now() - t); }
      const log = await readLog();
      return { to, pointedMs, settleMs, settled: settle.settled, settledBy: settle.settledBy,
        callbacks: Object.fromEntries(['ids', 'names', 'values', 'displays'].map(k => [k, Number(c1[k]) - Number(c0[k])])),
        setToTextMs: observed ? Math.round(performance.now() - setAt) : null,
        displayCoveredAt: shown?.summary.coveredAt ?? null, displayCovered: shown?.summary.covered ?? 0,
        logSize: log.size, pingMedianMs: Math.round(median(pings) * 10) / 10 };
    });
  }
  await observe(null);
}

async function probes(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1');
  state = await load(statePath);
  const report: Wire = { schema: 'phase8h4e0-probes-v1', entry, state, tracks: await tracks(), steps: [] };
  try {
    // Q1 and, for a device with no display text, Q6.
    const ids: Partial<Record<Key, string[]>> = {};
    for (const key of ['poly1', 'phase1', 'clap'] as const) {
      const result = await q1(report, key);
      if (result) ids[key] = result.settle.ids;
      if (result && result.summary.covered === 0) await q6(report, key);
    }
    await idList(report, 'diva');
    await observe(null);
    const poly = ids.poly1!, phase = ids.phase1!, clap = ids.clap;

    // Q2: a second set of the same IDs on the same target, and a set of a subset.
    await target('poly1');
    await observe(poly);
    await waitDisplays(poly);
    await step(report.steps, { q: 'Q2', case: 'same-set-again', key: 'poly1' }, async () => {
      await observe(poly); return await waitDisplays(poly);
    });
    await step(report.steps, { q: 'Q2', case: 'subset', key: 'poly1' }, async () => {
      await observe(poly.slice(0, 8)); return await waitDisplays(poly.slice(0, 8), 1_000);
    });

    // Q2 and Q3 on the Polysynth pair: equal values, then unequal values, then another type and back.
    await target('poly1');
    await observe(poly);
    await step(report.steps, { q: 'Q2', case: 'initial-set', key: 'poly1' }, async () => await waitDisplays(poly));
    await switchStep(report, { q: 'Q3', case: 'same-type-equal', from: 'poly1' }, 'poly2', poly);
    {
      // No new set after the switch: does a write on the new target report its text? Then a set of the same IDs.
      const now = await settleParams();
      const i = writable(now), id = String(now.ids[i]), v0 = Number(now.values[i]);
      await writeStep(report, { q: 'Q3', case: 'write-after-switch', key: 'poly2' }, id, v0 < 0.5 ? v0 + 0.2 : v0 - 0.2);
      await writeStep(report, { q: 'Q3', case: 'write-after-switch-restore', key: 'poly2' }, id, v0);
      await step(report.steps, { q: 'Q3', case: 'set-after-switch', key: 'poly2' }, async () => {
        await observe(poly); return await waitDisplays(poly);
      });
    }
    // Make one value of poly2 differ. Its display text must differ from poly1 after the next switch.
    const poly2 = await settleParams();
    const index = writable(poly2), changedId = String(poly2.ids[index]), base = Number(poly2.values[index]);
    const changed = base < 0.5 ? base + 0.3 : base - 0.3;
    await writeStep(report, { q: 'Q3', case: 'change-poly2' }, changedId, changed);
    await switchStep(report, { q: 'Q3', case: 'back-to-poly1' }, 'poly1', poly);
    await switchStep(report, { q: 'Q3', case: 'same-type-unequal', from: 'poly1', changedId, base, changed }, 'poly2', poly);
    await switchStep(report, { q: 'Q3', case: 'other-type', from: 'poly2' }, 'phase1', poly);
    await switchStep(report, { q: 'Q3', case: 'other-type-back', from: 'phase1' }, 'poly2', poly);
    if (clap) await switchStep(report, { q: 'Q3', case: 'to-clap', from: 'poly2' }, 'clap', poly);
    await switchStep(report, { q: 'Q3', case: 'clap-back', from: 'clap' }, 'poly2', poly);
    await writeStep(report, { q: 'Q3', case: 'restore-poly2' }, changedId, base);

    // Q2 on the Phase-4 pair.
    await target('phase1');
    await observe(phase);
    await step(report.steps, { q: 'Q2', case: 'initial-set', key: 'phase1' }, async () => await waitDisplays(phase));
    await switchStep(report, { q: 'Q3', case: 'same-type-equal', from: 'phase1' }, 'phase2', phase);

    // Q4: writes, three set and restore rounds on each type, after a fresh set.
    for (const key of ['poly1', 'phase1', 'clap'] as const) {
      if (!ids[key]) continue;
      const settle = await target(key);
      await observe(settle.ids);
      await waitDisplays(settle.ids);
      const i = writable(settle), id = String(settle.ids[i]), v0 = Number(settle.values[i]);
      for (let round = 0; round < 3; round++) {
        await writeStep(report, { q: 'Q4', key, round, part: 'set' }, id, v0 < 0.5 ? v0 + 0.2 + 0.05 * round : v0 - 0.2 - 0.05 * round);
        await writeStep(report, { q: 'Q4', key, round, part: 'restore' }, id, v0);
      }
    }
    await observe(null);

    // Q5: cost with 0, 8, and all IDs.
    for (const n of [0, 8, poly.length]) await costRun(report, ['poly1', 'poly2'], poly, n);
    for (const n of [0, 8, phase.length]) await costRun(report, ['phase1', 'phase2'], phase, n);
    if (clap) {
      // One CLAP device only: the cost of the ID set itself, with all IDs.
      for (let round = 0; round < 3; round++) {
        await step(report.steps, { q: 'Q5', pair: 'clap-set', n: clap.length, round }, async () => {
          await target('clap');
          const started = performance.now();
          await observe(clap);
          const shown = await waitDisplays(clap);
          return { setMs: Math.round(performance.now() - started), coveredAt: shown.summary.coveredAt,
            covered: shown.summary.covered, counts: shown.summary.counts };
        });
      }
    }
    await observe(null);
    report.final = { callbacks: await request('directparam.callbacks'), log: (await readLog()).observedDisplayIds };
  } finally { await artifact(out, report); }
}

async function diva(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1');
  state = await load(statePath);
  const report: Wire = { schema: 'phase8h4e0-diva-v1', entry, state, steps: [] };
  try {
    const q = await q1(report, 'diva');
    assert(q, 'diva: Q1 failed');
    const ids = q.settle.ids as string[];
    const i = writable(q.settle), id = String(ids[i]), v0 = Number(q.settle.values[i]);
    for (let round = 0; round < 3; round++) {
      await writeStep(report, { q: 'Q4', key: 'diva', round, part: 'set' }, id, v0 < 0.5 ? v0 + 0.2 + 0.05 * round : v0 - 0.2 - 0.05 * round);
      await writeStep(report, { q: 'Q4', key: 'diva', round, part: 'restore' }, id, v0);
    }
    for (const n of [8, ids.length]) {
      for (let round = 0; round < 3; round++) {
        await step(report.steps, { q: 'Q5', pair: 'diva-set', n, round }, async () => {
          await target('diva');
          const started = performance.now();
          await observe(ids.slice(0, n));
          const shown = await waitDisplays(ids.slice(0, n));
          const pings: number[] = [];
          for (let k = 0; k < 5; k++) { const t = performance.now(); await request('ping'); pings.push(performance.now() - t); }
          return { setMs: Math.round(performance.now() - started), coveredAt: shown.summary.coveredAt,
            covered: shown.summary.covered, counts: shown.summary.counts, pingMedianMs: Math.round(median(pings) * 10) / 10 };
        });
      }
    }
    await observe(null);
  } finally { await artifact(out, report); }
}

/** The ID form of a CLAP value callback after a write (8h4e0 finding). */
export const callbackForm = (id: string): string => id.replace(/^CONTENTS\//, 'CONTENTS/ROOT_GENERIC_MODULE/');

async function clapIds(out: string, statePath: string): Promise<void> {
  const entry = await guard('phase-8-probe-v1');
  state = await load(statePath);
  const report: Wire = { schema: 'phase8h4e0-clap-ids-v1', entry, state, steps: [] };
  try {
    for (const key of ['clap', 'diva'] as const) {
      const settle = await target(key);
      const i = writable(settle), id = String(settle.ids[i]), v0 = Number(settle.values[i]);
      const v1 = v0 < 0.5 ? v0 + 0.25 : v0 - 0.25;
      for (const observed of [[id], [id, callbackForm(id)]]) {
        await step(report.steps, { q: 'Q4', case: 'clap-id', key, observed }, async () => {
          await observe(observed);
          await waitDisplays([id], 1_000);
          await readLog({ restart: true });
          await request('directparam.set', { id, value: v1, resolution: 1 });
          await pause(1_500);
          const written = await readLog({ restart: true });
          const list = await request('directparam.list', {});
          const completion = await request('directparam.completion');
          await request('directparam.set', { id, value: v0, resolution: 1 });
          await pause(1_000);
          const restored = await readLog();
          return { id, v0, v1, written: written.events, restored: restored.events,
            listValue: (list.params as Wire[]).find(p => p.id === id)?.value ?? null,
            completionObserved: completion.observedGeneration === completion.generation };
        });
      }
    }
    await observe(null);
  } finally { await artifact(out, report); }
}

async function cleanup(out: string, statePath: string): Promise<void> {
  const entry = await guard(undefined); state = await load(statePath);
  if (entry.hello.runtimeProfile === 'phase-8-probe-v1') await observe(null);
  const entryIds = (state.entryTracks as Wire[]).map(row => row.channelId);
  const deleted: string[] = [];
  for (;;) {
    const extra = (await tracks()).find(row => !entryIds.includes(row.channelId));
    if (!extra) break;
    await request('track.delete', { trackIndex: extra.index });
    await until(() => request('track.list'), value => !(value.tracks as Wire[]).some(row => row.channelId === extra.channelId));
    deleted.push(String(extra.channelId));
  }
  const final = await tracks();
  assert.deepEqual(final.map(row => row.channelId), entryIds, 'the owned project does not match its entry tracks');
  await artifact(out, { schema: 'phase8h4e0-cleanup-v1', entry, deleted, tracks: final, entryTracks: state.entryTracks });
  console.log(JSON.stringify({ deleted: deleted.length, tracks: final.length }));
}

const by = (steps: Wire[], label: Wire): Wire[] =>
  steps.filter(s => Object.entries(label).every(([k, v]) => s[k] === v));
const one = (steps: Wire[], label: Wire): Wire => {
  const found = by(steps, label); assert.equal(found.length, 1, JSON.stringify(label)); return found[0]!;
};
const range = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];

/** Check every E244 claim from the retained artifacts. */
export async function verifyOffline(dir: string): Promise<Wire> {
  const summary: Wire = {};
  const hello = await readFile(`${dir}/probe-hello.log`, 'utf8');
  assert.match(hello, /ALL PASS/);
  assert.match(hello, /"runtimeProfile":"phase-8-probe-v1".*"methodCount":105,"methodsHash":"513b2d6b4647bbbe"/);

  const report = await gz(`${dir}/probes.json.gz`), steps = report.steps as Wire[];
  assert.equal(report.schema, 'phase8h4e0-probes-v1');
  assert.equal(report.entry.hello.runtimeProfile, 'phase-8-probe-v1');
  assert(steps.every(s => s.ok), 'every step of the engine-on run passed');

  // Q1: a set of the settled IDs reports text for each ID, one turn later, and for no other ID.
  const q1: Wire = {};
  const diva = await gz(`${dir}/diva.json.gz`);
  const counts: Record<string, number> = { poly1: 55, phase1: 103, clap: 55, diva: 281 };
  for (const [key, n] of Object.entries(counts)) {
    const s = one(key === 'diva' ? diva.steps : steps, { q: 'Q1', key, part: undefined });
    assert.equal(s.settle.count, n, `${key}: ID count`);
    assert.equal(s.summary.covered, n, `${key}: text for each ID`);
    assert.deepEqual(s.summary.counts, { display: n }, `${key}: one display callback for each ID, nothing else`);
    assert.equal(s.summary.outside, 0);
    assert.equal(s.listDisplayed, n, `${key}: the rig map holds the text`);
    assert(s.summary.coveredAt < 50, `${key}: within two turns`);
    q1[key] = { ids: n, coveredMs: s.summary.coveredAt };
  }
  const poly = one(steps, { q: 'Q1', key: 'poly1' });
  const compared = (poly.comparison as Wire[]).filter(c => c.direct !== null);
  const differ = compared.filter(c => c.typed !== c.direct);
  assert.deepEqual(differ.map(c => [c.id, c.typed, c.direct]),
    [['OSC1_UNISON_VOICES', '1', '1v'], ['OSC2_UNISON_VOICES', '1', '1v']], 'Q1: typed displayedValue() comparison');
  assert.equal(compared.length, 64, 'Q1: 64 typed rows (55 IDs)');
  assert.equal(one(steps, { q: 'Q1', key: 'phase1' }).summary.displays['CONTENTS/AEG_DECAY'], '2.72 s');
  q1.typedComparison = { compared: compared.length, differ: differ.length };
  summary.q1 = q1;

  // Engine off: a CLAP device lists no IDs; the Bitwig devices are unchanged.
  const off = await gz(`${dir}/probes-engine-off.json.gz`), offSteps = off.steps as Wire[];
  assert.match(one(offSteps, { q: 'Q1', key: 'clap' }).error, /did not settle/);
  assert.equal(one(offSteps, { q: 'Q1', key: 'diva', part: 'ids' }).settle.count, 0);
  assert.equal(one(offSteps, { q: 'Q1', key: 'poly1' }).summary.covered, 55);
  assert.equal(one(offSteps, { q: 'Q1', key: 'phase1' }).summary.covered, 103);
  assert.equal(one(steps, { q: 'Q1', key: 'diva', part: 'ids' }).settle.count, 281, 'engine on: Diva lists 281 IDs');

  // Q2: each set reports all observed IDs again, in one turn; a subset reports only the subset.
  const again = one(steps, { q: 'Q2', case: 'same-set-again' });
  assert.equal(again.summary.covered, 55); assert(again.summary.coveredAt < 50);
  const subset = one(steps, { q: 'Q2', case: 'subset' });
  assert.deepEqual(subset.summary.counts, { display: 8 }); assert.equal(subset.summary.outside, 0);

  // Q3: no switch reports text, of the same or another type; the set stays active (a write reports text).
  const switches = by(steps, { q: 'Q3' }).filter(s => s.to !== undefined);
  assert.equal(switches.length, 8);
  for (const s of switches) {
    assert.equal(s.summary.counts.display, undefined, `Q3 ${s.case}: no display callback after a switch`);
    assert(s.summary.counts.name > 0 && s.summary.counts.value === s.summary.counts.name, `Q3 ${s.case}`);
    assert(s.summary.first.name > s.summary.first.mark, `Q3 ${s.case}: names after the point`);
    assert(s.settle.settled, `Q3 ${s.case}: settled`);
  }
  assert.deepEqual(switches.map(s => [s.case, s.summary.counts.ids ?? 0, s.summary.counts.name]), [
    ['same-type-equal', 0, 55], ['back-to-poly1', 0, 55], ['same-type-unequal', 0, 55], ['other-type', 1, 103],
    ['other-type-back', 1, 55], ['to-clap', 1, 55], ['clap-back', 1, 55], ['same-type-equal', 0, 103]]);
  const after = one(steps, { q: 'Q3', case: 'write-after-switch' });
  assert.deepEqual([after.texts, after.values], [['30.0 %'], [0.3000000000000001]], 'Q3: the kept set reports a write');
  assert.equal(one(steps, { q: 'Q3', case: 'set-after-switch' }).summary.covered, 55);
  summary.q3 = { switches: switches.length, displaysAfterSwitch: 0,
    switchNamesMs: range(switches.map(s => s.summary.last.value - s.summary.first.mark)) };

  // Q4: on Bitwig devices a write reports the value and then the text in the same turn.
  const writes = by(steps, { q: 'Q4' }).filter(s => s.key !== 'clap');
  assert.equal(writes.length, 12);
  for (const s of writes) {
    assert(s.lagMs !== null && s.lagMs >= 0 && s.lagMs < 1, `Q4 ${s.key}: text after value, same turn`);
    assert.equal(s.texts.length, 1); assert.equal(s.otherDisplays, 0);
  }
  assert.deepEqual(writes.filter(s => s.key === 'phase1').map(s => s.texts[0]), ['-4.80', '0.00', '-6.00', '0.00', '-7.20', '0.00']);
  for (const s of by(steps, { q: 'Q4', key: 'clap' })) assert.deepEqual([s.values, s.texts], [[], []], 'Q4: no listed-ID callback on a CLAP');
  for (const s of by(diva.steps, { q: 'Q4' })) assert.deepEqual([s.values, s.texts], [[], []]);
  summary.q4 = { lagMs: range(writes.map(s => s.lagMs)), valueMs: range(writes.map(s => s.valueMs)) };
  // The first run sent the handler default resolution 128: Bitwig reads the value as a step of 127.
  const first = (await gz(`${dir}/probes-first.json.gz`)).steps as Wire[];
  for (const s of by(first, { q: 'Q4' })) assert(Math.abs(s.values[0] * 127 - s.value) < 1e-9, 'resolution 128 reads a step of 127');

  // CLAP callback ID form.
  const clap = (await gz(`${dir}/clap-ids.json.gz`)).steps as Wire[];
  assert.equal(clap.length, 4);
  for (const s of clap) {
    const form = callbackForm(s.id);
    assert(s.written.length > 0 && s.written.every((r: Row) => r[2] === form), `${s.key}: callbacks use ${form}`);
    assert.equal(s.written.find((r: Row) => r[1] === 'value')[3], s.v1, `${s.key}: the write took`);
    assert.equal(s.completionObserved, false, `${s.key}: the completion never matches`);
    assert.equal(s.listValue, s.v0, `${s.key}: the listed value stays stale`);
    assert.equal(s.written.some((r: Row) => r[1] === 'display'), s.observed.length === 2, `${s.key}: text only for the observed form`);
  }

  // Q5: the switch settle does not depend on the observed count; a set of any count gives text in one turn.
  const cost: Wire = {};
  for (const pair of ['poly1-poly2', 'phase1-phase2']) {
    const runs = by(steps, { q: 'Q5', pair });
    const ns = [...new Set(runs.map(s => s.n))];
    assert.equal(ns.length, 3);
    for (const s of runs) {
      assert.equal(s.settledBy, 'switch');
      assert.equal(s.callbacks.displays, s.n, `Q5 ${pair} ${s.n}: one text for each observed ID, after the new set`);
      if (s.n > 0) assert(s.displayCoveredAt < 50, `Q5 ${pair} ${s.n}`);
    }
    cost[pair] = Object.fromEntries(ns.map(n => {
      const r = runs.filter(s => s.n === n);
      return [n, { settleMs: range(r.map(s => s.settleMs)), textMs: n === 0 ? null : range(r.map(s => s.displayCoveredAt)),
        pingMs: range(r.map(s => s.pingMedianMs)) }];
    }));
    const settles = ns.map(n => median(runs.filter(s => s.n === n).map(s => s.settleMs)));
    assert(Math.max(...settles) - Math.min(...settles) <= 10, `Q5 ${pair}: settle independent of n`);
  }
  for (const n of [8, 281]) {
    const r = by(diva.steps, { q: 'Q5', n });
    assert.equal(r.length, 3);
    for (const s of r) { assert.equal(s.covered, n); assert(s.coveredAt < 50); assert(s.pingMedianMs < 30); }
    cost[`diva-${n}`] = { textMs: range(r.map(s => s.coveredAt)), pingMs: range(r.map(s => s.pingMedianMs)) };
  }
  summary.q5 = cost;

  // The normal profile is unchanged and loaded again.
  const normal = await readFile(`${dir}/normal-hello-final.log`, 'utf8');
  assert.match(normal, /ALL PASS/);
  assert.match(normal, /"runtimeProfile":"normal-v1".*"methodCount":88,"methodsHash":"68d457c4c4d1d7b3"/);

  // Cleanup.
  for (const name of ['cleanup-first.json.gz', 'cleanup.json.gz']) {
    const c = await gz(`${dir}/${name}`);
    assert.deepEqual((c.tracks as Wire[]).map(t => t.channelId), (c.entryTracks as Wire[]).map(t => t.channelId));
  }
  return summary;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'setup') await setup(args[0]!);
    else if (command === 'probes') await probes(args[0]!, args[1]!);
    else if (command === 'diva') await diva(args[0]!, args[1]!);
    else if (command === 'clap-ids') await clapIds(args[0]!, args[1]!);
    else if (command === 'cleanup') await cleanup(args[0]!, args[1]!);
    else if (command === 'verify-offline') console.log(JSON.stringify(await verifyOffline(args[0]!), null, 1));
    else throw new Error(`unknown command ${command}`);
  } finally { await transport.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]!).href) await main();
