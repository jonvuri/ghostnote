/**
 * 8i7 mixer unit gate. Live driver, probe profile, owned unsaved project.
 *
 *   units <out.json>          create one instrument track, sweep the normalized and raw volume and pan setters, read
 *                             the normalized value, the raw value, and the display after each write, then delete the
 *                             track.
 *   automation <channelId>    read the volume and pan automation flags of an operator track, try one raw volume
 *                             write, read it back, and restore the prior raw value.
 *
 * The API leaves the raw range undefined (E98). This driver measures it; it does not assume a conversion.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { client } from './lib.js';

type Wire = Record<string, any>;
const request = async (method: string, params?: Wire): Promise<Wire> =>
  await client.request(method, params) as Wire;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const say = (value: unknown): void => console.log(JSON.stringify(value));

async function indexOf(channelId: string): Promise<number> {
  const found = await request('track.resolveByChannelId', { channelId });
  assert(found.found === true, `track ${channelId} does not resolve`);
  return found.index as number;
}
const mixer = async (channelId: string): Promise<Wire> =>
  await request('branch.mixer', { trackIndex: await indexOf(channelId) });
const facts = (row: Wire): Wire => ({
  volume: row.volume, volumeRaw: row.volumeRaw, volumeDisplayed: row.volumeDisplayed,
  pan: row.pan, panRaw: row.panRaw, panDisplayed: row.panDisplayed,
  volumeHasAutomation: row.volumeHasAutomation, panHasAutomation: row.panHasAutomation,
});

/** Write, then poll until the named field moves to `want` or 2 s pass. Report the settle time and wire polls. */
async function write(channelId: string, params: Wire, field: string, want: number | null): Promise<Wire> {
  const before = facts(await mixer(channelId));
  const index = await indexOf(channelId);
  const started = performance.now();
  await request('branch.setMixer', { trackIndex: index, ...params });
  let polls = 0;
  let row = before;
  for (; polls < 80; polls++) {
    row = facts(await mixer(channelId));
    if (want === null ? row[field] !== before[field] : Math.abs(row[field] - want) < 1e-9) break;
    await sleep(25);
  }
  return { params, before: before[field], after: row, landed: polls < 80, polls,
    settleMs: Math.round(performance.now() - started) };
}

async function units(out: string): Promise<void> {
  const rig = await request('rig.info');
  assert(rig.runtimeProfile === 'phase-8-probe-v1', `probe profile required: ${rig.runtimeProfile}`);
  const before = (await request('track.list')).tracks as Wire[];
  await request('track.create', { position: before.filter((row) => row.type !== 'Effect' && row.type !== 'Master').length, kind: 'instrument' });
  let created: Wire | undefined;
  for (let tries = 0; tries < 80 && created === undefined; tries++) {
    await sleep(25);
    const now = (await request('track.list')).tracks as Wire[];
    created = now.find((row) => !before.some((old) => old.channelId === row.channelId));
  }
  assert(created !== undefined, 'the gate track did not appear');
  const id = created.channelId as string;
  await request('track.setName', { trackIndex: await indexOf(id), name: 'gn-8i7-gate' });
  const report: Wire = { project: (await request('selection.status')).project, track: id, fresh: facts(await mixer(id)) };
  try {
    // The plain setter, measured again (E16: it did not land).
    report.plainSet = await write(id, { volumeSet: 0.3 }, 'volume', 0.3);
    report.normalized = [];
    for (const value of [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95, 1]) {
      report.normalized.push(await write(id, { volume: value }, 'volume', value));
    }
    report.raw = [];
    const dbs = [-120, -60, -40, -24, -18, -12, -6, -3, -1, 0, 1, 3, 6, 6.0206];
    for (const db of dbs) {
      const raw = 10 ** (db / 20);
      report.raw.push({ db, ...(await write(id, { volumeRaw: raw }, 'volumeRaw', raw)) });
    }
    // Silence and out-of-range raw values: zero, negative, and above the maximum.
    for (const raw of [0, -0.5, 2.5, 10]) report.raw.push({ db: null, ...(await write(id, { volumeRaw: raw }, 'volumeRaw', null)) });
    report.pan = [];
    for (const value of [0, 0.25, 0.5, 0.75, 1]) report.pan.push(await write(id, { pan: value }, 'pan', value));
    for (const raw of [-1, -0.5, 0, 0.5, 1, 2]) report.pan.push(await write(id, { panRaw: raw }, 'panRaw', null));
    // Repeat a fixed write three times for a settle-time sample.
    report.settle = [];
    for (const raw of [10 ** (-18 / 20), 10 ** (-12 / 20), 1]) {
      report.settle.push(await write(id, { volumeRaw: raw }, 'volumeRaw', raw));
    }
  } finally {
    await request('track.delete', { trackIndex: await indexOf(id) });
  }
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  for (const row of report.normalized) say({ n: row.params.volume, raw: row.after.volumeRaw, d: row.after.volumeDisplayed });
  for (const row of report.raw) say({ db: row.db, set: row.params.volumeRaw, landed: row.landed, ms: row.settleMs,
    n: row.after.volume, raw: row.after.volumeRaw, d: row.after.volumeDisplayed });
  for (const row of report.pan) say({ set: row.params, n: row.after.pan, raw: row.after.panRaw, d: row.after.panDisplayed });
  say({ plainSet: report.plainSet.landed, settle: report.settle.map((row: Wire) => row.settleMs) });
}

async function automation(channelId: string): Promise<void> {
  const prior = facts(await mixer(channelId));
  say({ prior });
  const target = Math.abs(prior.volumeRaw - 0.5) < 0.01 ? 0.25 : 0.5;
  const result = await write(channelId, { volumeRaw: target }, 'volumeRaw', target);
  say({ write: result });
  await sleep(1000);
  say({ afterOneSecond: facts(await mixer(channelId)) });
  const restore = await write(channelId, { volumeRaw: prior.volumeRaw }, 'volumeRaw', prior.volumeRaw);
  say({ restore: restore.after, landed: restore.landed });
}

const [mode, arg] = process.argv.slice(2);
if (mode === 'units' && arg) await units(arg);
else if (mode === 'automation' && arg) await automation(arg);
else throw new Error('usage: phase8i7-mixer-gate.ts units <out.json> | automation <channelId>');
process.exit(0);
