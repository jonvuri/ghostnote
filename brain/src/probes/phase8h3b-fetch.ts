// E230 and 8h3e removed the research wire that this live driver uses. Live use needs the earlier
// research build of its own session. Its retained artifacts and offline checks do not need a host.
/**
 * 8h3b replay fetch cost. Live driver. Each subcommand refuses the anchor project. Results stay ineligible.
 *
 *   config <entry.json>                         write the research rig config (records the original)
 *   restore <entry.json>                        restore the original rig config
 *   setup <state.json>                          owned tracks: park, then one track for each fetch fixture
 *   fixtures <state.json>                       write, decorate, and verify the fetch fixtures
 *   fetch <out.json.gz> <state.json> <fixture> [--n N]
 *                                               bind from park N times; fetch the close capture in every variant
 *   summary <dir> <summary.json>                recompute the summary from the raw fetch artifacts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import * as net from 'node:net';
import { pathToFileURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { ORIGINAL_CONFIG_SHA256 } from './phase8g5-consumers-lib.js';
import { ORACLE_MS, declaredNotes, decodeIssues, replayConfig, type Defaults, type FixturePlan, type Wire } from './phase8h2a-replay-lib.js';
import { armSelectedTarget, disconnectReplay, fixtures, guard, observe, parkFixture, parkReader, readJson, restore, save,
  setReplayMarker, setup, shadow, trackIndexOf, wait } from './phase8h2a-replay.js';
import { verdict } from './phase8h3a-dealbreakers-lib.js';
import { BASELINE, FETCH_FIXTURES, FETCH_MARKER, FORMATS, decodePage, fetchCost, rotation, rowsDigest, summarize,
  type PageRecord, type PingRecord, type Variant } from './phase8h3b-fetch-lib.js';

setReplayMarker(FETCH_MARKER, true);
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const hash = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
interface Target extends FixturePlan { trackId: string; row: number; written: boolean }

/**
 * A second and third bridge connection with raw byte timing. One request is in flight on each connection.
 * The bridge frame is one line; `chunks` counts the socket reads that carried it.
 */
class RawBridge {
  private socket = new net.Socket();
  private parts: Buffer[] = [];
  private current: { firstByteMs: number; chunks: number; resolve: (line: { text: string; firstByteMs: number; receivedMs: number; bytes: number; chunks: number }) => void } | null = null;
  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => { this.socket.once('error', reject); this.socket.connect(8686, '127.0.0.1', resolve); });
    this.socket.on('data', (chunk: Buffer) => {
      const now = performance.now(), waiter = this.current;
      assert(waiter, 'bridge sent data with no request in flight');
      if (waiter.chunks++ === 0) waiter.firstByteMs = now;
      const end = chunk.indexOf(10);
      if (end < 0) { this.parts.push(chunk); return; }
      assert.equal(end, chunk.length - 1, 'one line for each request');
      this.parts.push(chunk.subarray(0, end));
      const line = Buffer.concat(this.parts); this.parts = []; this.current = null;
      waiter.resolve({ text: line.toString('utf8'), firstByteMs: waiter.firstByteMs, receivedMs: now, bytes: line.length + 1, chunks: waiter.chunks });
    });
  }
  async request(id: string, method: string, params: Wire): Promise<{ sentMs: number; text: string; firstByteMs: number; receivedMs: number; bytes: number; chunks: number }> {
    assert.equal(this.current, null, 'one request in flight');
    const received = new Promise<{ text: string; firstByteMs: number; receivedMs: number; bytes: number; chunks: number }>(resolve => {
      this.current = { firstByteMs: 0, chunks: 0, resolve };
    });
    const sentMs = performance.now();
    this.socket.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return { sentMs, ...await received };
  }
  close(): void { this.socket.destroy(); }
}

let sequence = 0;
/** Ping on its own connection until stopped. Every ping is a controller task, so it waits behind a page task. */
function pinger(raw: RawBridge): { stop: () => Promise<PingRecord[]> } {
  const records: PingRecord[] = []; let running = true;
  const loop = (async () => {
    while (running) {
      const id = `p${++sequence}`, reply = await raw.request(id, 'ping', {});
      records.push({ id, sentMs: reply.sentMs, rttMs: reply.receivedMs - reply.sentMs });
      await wait(2);
    }
  })();
  return { stop: async () => { running = false; await loop; return records; } };
}

/** Attach the controller-thread phases of each request from the bridge timing ring. */
async function attachTimings(pages: PageRecord[], pings: PingRecord[]): Promise<void> {
  const ids = [...pages.map(p => p.id), ...pings.map(p => p.id)];
  const rows = (await shadow('replayTimings', { ids })).rows as [string, string, number, number, number, number, number][];
  const byId = new Map(rows.map(row => [row[0], row]));
  for (const page of pages) {
    const row = byId.get(page.id); assert(row, `no bridge timing for ${page.id}`);
    page.bridge = { queuedMs: row[2], dispatchMs: row[3], serializeMs: row[4], writeMs: row[5], chars: row[6] };
  }
  for (const ping of pings) { const row = byId.get(ping.id); if (row) ping.queuedMs = row[2]; }
}

async function fetchVariant(raw: RawBridge, epoch: number, variant: Variant): Promise<{ pages: PageRecord[]; rows: ReturnType<typeof decodePage>; page0: Wire }> {
  const pages: PageRecord[] = [], rows: ReturnType<typeof decodePage> = [];
  let page0: Wire = {};
  for (let from = 0; ;) {
    const id = `f${++sequence}`;
    const params = variant.prepared ? { operation: 'replayPrepared', epoch, format: variant.format }
      : { operation: 'replayFetch', epoch, format: variant.format, from, limit: variant.limit };
    const reply = await raw.request(id, 'cache.shadow', params);
    const parseStart = performance.now(), message = JSON.parse(reply.text) as Wire, parseMs = performance.now() - parseStart;
    assert.equal(message.error, undefined, `fetch failed: ${JSON.stringify(message.error)}`);
    const page = message.result as Wire;
    assert.equal(page.epoch, epoch); assert.equal(page.format, variant.format);
    if (variant.prepared) assert.equal(page.ready, true, 'prepared payload is not ready');
    const decodeStart = performance.now(), decoded = decodePage(page), decodeMs = performance.now() - decodeStart;
    for (const row of decoded) rows.push(row);
    pages.push({ id, sentMs: reply.sentMs, firstByteMs: reply.firstByteMs, receivedMs: reply.receivedMs, bytes: reply.bytes,
      chunks: reply.chunks, parseMs, decodeMs, encodeMs: Number(page.encodeMs ?? 0), size: Number(page.size) });
    if (pages.length === 1) page0 = { prepareMs: page.prepareMs, prepareStartMs: page.prepareStartMs, omitted: page.omitted,
      sections: page.sections, tables: page.tables === undefined ? undefined : Object.fromEntries(Object.entries(page.tables as Wire).map(([k, v]) => [k, (v as number[]).length])) };
    if (Number(page.next) < 0) break;
    from = Number(page.next);
  }
  return { pages, rows, page0 };
}

async function artifact(path: string, report: Wire): Promise<void> {
  const data = JSON.stringify(report) + '\n';
  await writeFile(path, path.endsWith('.gz') ? gzipSync(data) : data);
}

async function fetchTrials(out: string, statePath: string, name: string, n: number): Promise<void> {
  const entry = await guard(), state = await readJson(statePath), target = (state.fixtures as Record<string, Target>)[name];
  assert(target?.written === true, `fixture ${name} is not written`);
  const defaults = state.defaults as Defaults, declared = declaredNotes(target, defaults);
  const report: Wire = { schema: 'phase8h3b-fetch-v1', marker: FETCH_MARKER, complete: false, eligible: false,
    captured: new Date().toISOString(), fixture: target, defaults, oracleMs: ORACLE_MS, ...entry, trials: [] };
  const data = new RawBridge(), ping = new RawBridge();
  await data.connect(); await ping.connect();
  try {
    await parkFixture(state);
    const track = await trackIndexOf(target.trackId);
    // Idle ping, for a reference with no fetch in progress.
    const idle = pinger(ping); await wait(500);
    const idlePings = await idle.stop(); await attachTimings([], idlePings); report.idlePings = idlePings;
    for (let trial = 0; trial < n; trial++) {
      await parkReader(state);
      const act = await armSelectedTarget(track, target.row, { prepare: [...FORMATS] });
      const epoch = Number(act.epoch), status = await observe(epoch, ORACLE_MS), e = status.epoch as Wire;
      assert(Number(e.closeMs) >= 0, 'D30 close did not arrive');
      for (let tries = 0; ((await shadow('replayStatus')).prepared as string[]).length < FORMATS.length; tries++) {
        assert(tries < 600, 'prepared formats did not finish'); await wait(50);
      }
      const fetches: Wire[] = [], digests = new Map<string, string>();
      let baselineRows: ReturnType<typeof decodePage> = [];
      for (const variant of rotation(trial)) {
        const pings = pinger(ping);
        const fetched = await fetchVariant(data, epoch, variant);
        const pingRecords = await pings.stop();
        await attachTimings(fetched.pages, pingRecords);
        const digest = rowsDigest(fetched.rows); digests.set(variant.name, digest);
        if (variant.name === BASELINE) baselineRows = fetched.rows;
        fetches.push({ variant: variant.name, format: variant.format, limit: variant.limit, prepared: variant.prepared, digest,
          ...fetched.page0, pages: fetched.pages, pings: pingRecords, cost: fetchCost(fetched.pages, pingRecords) });
      }
      const baseline = digests.get(BASELINE)!;
      for (const fetch of fetches) fetch.exact = fetch.digest === baseline;
      const closeTrial: Wire = { target, status: e, rows: baselineRows, cursor: status };
      const check = verdict(closeTrial, defaults);
      const issues = decodeIssues(baselineRows, declared);
      const row: Wire = { fixture: name, trial, epoch, closeMs: e.closeMs, closeCopyMs: e.closeCopyMs, callbacks: e.callbacks,
        verdict: { ...check, issues: undefined }, baselineIssues: issues, fetches };
      (report.trials as Wire[]).push(row); await artifact(out, report);
      console.log(JSON.stringify({ name, trial, pass: check.pass, exact: fetches.every(f => f.exact), closeMs: e.closeMs,
        walls: Object.fromEntries(fetches.map(f => [f.variant, Math.round(Number((f.cost as Wire).wallMs))])) }));
      assert.equal(check.pass, true, 'D30 close verdict failed: stop and report');
      assert.deepEqual(issues, [], 'baseline decode is not exact');
      assert(fetches.every(f => f.exact), 'a fetch variant differs from the baseline rows');
    }
    report.summary = summarize(report.trials as Wire[]);
  } catch (error) { report.error = String(error); throw error; }
  finally {
    data.close(); ping.close(); await artifact(out, report);
    try { await parkReader(state); } catch (error) { console.error(`park failed: ${String(error)}`); }
  }
}

/** Recompute exactness and the summary from the raw artifacts. */
async function summary(dir: string, out: string): Promise<void> {
  const trials: Wire[] = [];
  for (const file of (await readdir(dir)).filter(f => f.startsWith('fetch-') && f.endsWith('.json.gz')).sort()) {
    const report = JSON.parse(gunzipSync(await readFile(join(dir, file))).toString()) as Wire;
    assert.equal(report.marker, FETCH_MARKER); assert.equal(report.complete, false); assert.equal(report.eligible, false);
    assert.equal(report.error, undefined, `${file} ended with an error`);
    for (const trial of report.trials as Wire[]) {
      const fetches = trial.fetches as Wire[], baseline = fetches.find(f => f.variant === BASELINE)!;
      for (const fetch of fetches) {
        assert.equal(fetch.exact, fetch.digest === baseline.digest, `${file} exact flag`);
        assert.deepEqual(fetch.cost, fetchCost(fetch.pages as PageRecord[], fetch.pings as PingRecord[]), `${file} cost`);
      }
      assert.equal((trial.verdict as Wire).pass, true); assert.deepEqual(trial.baselineIssues, []);
      trials.push(trial);
    }
  }
  await save(out, { schema: 'phase8h3b-summary-v1', marker: FETCH_MARKER, complete: false, eligible: false,
    trials: trials.length, summary: summarize(trials) });
  console.log(JSON.stringify({ trials: trials.length }));
}

async function config(path: string): Promise<void> {
  const bytes = await readFile(configPath); assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256);
  const research = { ...replayConfig(), stamp: '8h3b-fetch' };
  await save(path, { schema: 'phase8h3b-config-entry-v1', originalBase64: bytes.toString('base64'), originalSha256: hash(bytes), research }, true);
  await writeFile(configPath, JSON.stringify(research) + '\n');
  console.log(JSON.stringify({ research, sha256: hash(await readFile(configPath)) }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...args] = process.argv.slice(2);
  const flag = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at < 0 ? undefined : args[at + 1]; };
  const live = !['config', 'restore', 'summary'].includes(String(command));
  const lockPath = join(tmpdir(), 'ghostnote-phase8h2a-live.lock');
  const lock = live ? await open(lockPath, 'wx') : undefined;
  await lock?.writeFile(JSON.stringify({ pid: process.pid, command, started: new Date().toISOString() }) + '\n');
  try {
    if (command === 'config') await config(args[0]!);
    else if (command === 'restore') await restore(args[0]!);
    else if (command === 'setup') await setup(args[0]!, FETCH_FIXTURES);
    else if (command === 'fixtures') await fixtures(args[0]!, FETCH_FIXTURES);
    else if (command === 'fetch') await fetchTrials(args[0]!, args[1]!, args[2]!, Number(flag('n') ?? 10));
    else if (command === 'summary') await summary(args[0]!, args[1]!);
    else throw new Error(`unknown command ${String(command)}`);
  } finally { disconnectReplay(); if (lock) { await lock.close(); await unlink(lockPath); } }
}
