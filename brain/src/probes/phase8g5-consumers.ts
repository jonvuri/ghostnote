/**
 * 8g5 consumer workflows on the final shadow build. Research only; every cache result stays
 * `complete:false` and `eligible:false`. Stable E131 tools keep write authority.
 *
 * Modes:
 *   config <entry.json>              pin the original rig config, then write the research config
 *   restore-config <entry.json>      write the exact original config bytes
 *   prepare <state.json>             write the owned target and canary clips in P (E216 state)
 *   run-a <state.json> <out.json>    read-only, warm, public patch, stale proposal, and field-only cases
 *   run-b <state.json> <out.json>    after the operator deletes the declared note: native and fallback cases
 *   verify <out.json>                recompute every retained case
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BridgeClient } from '../client.js';
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { NOTE_INVARIANTS_SCHEMA, NOTE_PROPOSAL_SCHEMA, type ExactNoteSource } from '../musical/index.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { parseSignature } from './e216-delivery-coherence-lib.js';
import { CANARY_FIXTURE, CANARY_NAME, CANARY_ROW, CONSUMER_SCHEMA, FALLBACK_WRITE, FIELD_EDIT, FINAL_MARKER, METADATA,
  NATIVE_DELETE, ORIGINAL_CONFIG_SHA256, PATCH, PROTECTED_PROJECT, TARGET_FIXTURE, TARGET_NAME, TARGET_ROW,
  applyChange, caseIssues, consumerConfig, declaredIssues, exactIssues, hostWork, liveAdmission, liveDecision,
  pureControls, rawNotesOf, writerEffects, refusalIssues, stableSourceIssues, verifyConsumerReport, type Change, type DeclaredNote,
  type Wire } from './phase8g5-consumers-lib.js';
import type { ShadowNote } from './phase8g-shadow-cache-lib.js';

const GRID = 1 / 512;
const configPath = join(homedir(), '.ghostnote', 'rig.json');
const bridge = new BridgeClient();
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });
const workspace = workspaceOf({ ready: async () => undefined, adapter,
  executor: new Executor(adapter), stash: new Stash(), observationStore: new FakeObservationStore() });
let bridgeCalls = 0, bridgeBytes = 0;
const wait = async (ms: number): Promise<void> => await new Promise(resolve => setTimeout(resolve, ms));
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
async function request(method: string, params?: Wire): Promise<Wire> {
  const value = await bridge.request(method, params, 30_000) as Wire;
  bridgeCalls++; bridgeBytes += Buffer.byteLength(JSON.stringify(value)); return value;
}
const shadow = async (operation: string, params: Wire = {}): Promise<Wire> => await request('cache.shadow', { operation, ...params });
const readJson = async (path: string): Promise<Wire> => JSON.parse(await readFile(path, 'utf8')) as Wire;
const save = async (path: string, value: Wire): Promise<void> => await writeFile(path, JSON.stringify(value, null, 1) + '\n');
const shown = async (): Promise<string> => parseSignature(String((await shadow('deliveryStatus')).signature)).name;
async function until(next: () => Promise<Wire>, done: (value: Wire) => boolean, limit = 45_000): Promise<Wire> {
  const started = performance.now();
  for (;;) { const value = await next(); if (done(value)) return value;
    assert(performance.now() - started < limit, `live read did not settle: ${JSON.stringify(value).slice(0, 400)}`); await wait(30); }
}

async function config(entryPath: string): Promise<void> {
  const bytes = await readFile(configPath); assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256, 'unexpected original config');
  await writeFile(entryPath, JSON.stringify({ schema: 'phase8g5-config-entry-v1', captured: new Date().toISOString(),
    originalSha256: hash(bytes), originalBase64: bytes.toString('base64'), research: consumerConfig() }, null, 1) + '\n', { flag: 'wx' });
  await writeFile(configPath, JSON.stringify(consumerConfig()) + '\n');
  console.log(JSON.stringify({ researchConfigSha256: hash(await readFile(configPath)), originalSha256: ORIGINAL_CONFIG_SHA256 }));
}
async function restoreConfig(entryPath: string): Promise<void> {
  const entry = await readJson(entryPath), bytes = Buffer.from(String(entry.originalBase64), 'base64');
  assert.equal(hash(bytes), ORIGINAL_CONFIG_SHA256); await writeFile(configPath, bytes);
  assert.equal(hash(await readFile(configPath)), ORIGINAL_CONFIG_SHA256);
  console.log(JSON.stringify({ restoredSha256: ORIGINAL_CONFIG_SHA256 }));
}

/** Check the research runtime, deliberate marker, config, and the owned project. */
async function research(state: Wire): Promise<Wire> {
  const hello = await request('contract.hello');
  assert.equal(hello.runtimeProfile, 'phase-8-probe-v1'); assert.equal(hello.methodCount, 97); assert.equal(hello.methodsHash, 'f03f19414f40e3d3');
  const info = await shadow('info'); assert.equal(info.instrumentationRevision, FINAL_MARKER);
  assert.deepEqual(JSON.parse((await readFile(configPath)).toString('utf8')), consumerConfig());
  const name = await shown(); assert.notEqual(name, PROTECTED_PROJECT); assert.equal(name, (state.P as Wire).name, 'show P');
  return { hello, info, stats: await request('rig.stats'), configSha256: hash(await readFile(configPath)) };
}
/** Bind the fine cursor writer to one owned row. The shadow adapter uses separate handles. */
async function writer(row: number): Promise<void> {
  await request('cursor.pin', { cursor: 'fine', pinned: false }); await request('cursor.pinTrack', { cursor: 'fine', pinned: false });
  await request('cursor.pointTrack', { cursor: 'fine', trackIndex: 0 });
  await request('slot.select', { trackIndex: 0, slotIndex: row, mechanism: 'track' });
  await until(() => request('cursor.status', { cursor: 'fine' }), value => value.slotExists === true && value.sceneIndex === row && value.trackPosition === 0);
  await request('cursor.pinTrack', { cursor: 'fine', pinned: true }); await request('cursor.pin', { cursor: 'fine', pinned: true });
  await request('cursor.setStepSize', { cursor: 'fine', stepSize: GRID }); await request('cursor.scrollToStep', { cursor: 'fine', step: 0 });
  await wait(200);
}
async function rawRead(): Promise<{ raw: Wire; metadata: Wire }> {
  return { raw: await request('cursor.getNotesVerboseAllChannels', { cursor: 'fine', maxX: 2048 }), metadata: await request('cursor.clipMetadata', { cursor: 'fine' }) };
}
async function writeFixture(row: number, name: string, notes: readonly DeclaredNote[], color: number[]): Promise<{ raw: Wire; metadata: Wire }> {
  const slot = await request('slot.status', { trackIndex: 0, slotIndex: row });
  assert.notEqual(slot.hasContent, true, `row ${row} must start empty`);
  await request('clip.create', { trackIndex: 0, slotIndex: row, lengthBeats: 4 }); await wait(500);
  await writer(row);
  await request('cursor.setClipMetadata', { cursor: 'fine', trackIndex: 0, slotIndex: row, name, colorBytes: color, ...METADATA }); await wait(200);
  for (let channel = 0; channel < 16; channel++) {
    const rows = notes.filter(note => note.channel === channel); if (rows.length === 0) continue;
    const reply = await request('cursor.setNotes', { cursor: 'fine', channel, notes: rows.map(note => [note.cell, note.pitch, note.velocity, note.durationCells * GRID]) });
    assert.equal(reply.written, rows.length); await wait(80);
  }
  for (const note of notes) if (note.props) {
    await request('cursor.setNoteProps', { cursor: 'fine', channel: note.channel, x: note.cell, y: note.pitch, props: note.props }); await wait(60);
  }
  await wait(400); return await rawRead();
}
async function prepare(statePath: string): Promise<void> {
  const state = await readJson(statePath); const entry = await research(state);
  const tracks = (await request('track.list')).tracks as Wire[]; const track = tracks[0]!;
  assert.equal(track.type, 'Instrument'); assert.equal(track.channelId, (state.P as Wire).cursor, 'P track 0 must be the E216 owned track');
  const target = await writeFixture(TARGET_ROW, TARGET_NAME, TARGET_FIXTURE, [200, 80, 40]);
  const canary = await writeFixture(CANARY_ROW, CANARY_NAME, CANARY_FIXTURE, [40, 120, 200]);
  assert.deepEqual(declaredIssues(target.raw, TARGET_FIXTURE), []); assert.deepEqual(declaredIssues(canary.raw, CANARY_FIXTURE), []);
  state.consumer = { prepared: new Date().toISOString(), trackId: track.channelId, trackName: track.name, entry,
    raw: target.raw, metadata: target.metadata, canaryRaw: canary.raw, canaryMetadata: canary.metadata, tracks };
  await save(statePath, state);
  console.log(JSON.stringify({ prepared: TARGET_NAME, notes: TARGET_FIXTURE.length, canary: CANARY_NAME }));
}

async function ping(): Promise<number> {
  const samples: number[] = [];
  for (let n = 0; n < 20; n++) { const start = performance.now(); await request('ping'); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b); const p95 = samples[Math.ceil(samples.length * .95) - 1]!;
  await shadow('ping', { p95Ms: p95 }); return p95;
}
async function acquire(): Promise<Wire> {
  const acquired = await shadow('acquire', { trackIndex: 0, row: TARGET_ROW, canaryTrackIndex: 0, canaryRow: CANARY_ROW });
  assert(['warm', 'reserved'].includes(String(acquired.poolDecision)), JSON.stringify(acquired).slice(0, 400));
  const index = Number(acquired.index);
  const settled = await until(() => shadow('poll', { index }), value => value.phase === 'retired'
    || ((value.phase === 'settled' || value.phase === 'complete') && value.canaryPhase === 'target'));
  assert.notEqual(settled.phase, 'retired', 'binding retired before settlement');
  return { acquired, settled, index };
}
async function compare(index: number): Promise<Wire> {
  await until(() => shadow('reconcile', { index }), value => value.physicalPendingHints === 0 && value.pendingCoordinates === 0);
  let value = await shadow('compareStart', { index });
  value = await until(async () => value.comparison === 'pending' && value.terminal !== true ? (value = await shadow('comparePoll')) : value,
    next => next.comparison !== 'pending' || next.terminal === true);
  return value;
}
interface Run { report: Wire; state: Wire; out: string; expected: ShadowNote[]; index?: number }
async function persist(run: Run): Promise<void> {
  run.report.bridgeCalls = bridgeCalls; run.report.bridgeResponseBytes = bridgeBytes; await save(run.out, run.report);
}
/** Persist the terminal row before any oracle assertion. */
async function record(run: Run, row: Wire, check: () => string[]): Promise<void> {
  (run.report.cases as Wire[]).push(row); await persist(run);
  const issues = check();
  if (issues.length > 0) { row.issues = issues; run.report.stoppedReason = `${String(row.label)}: ${issues.join(', ')}`; await persist(run);
    throw new Error(String(run.report.stoppedReason)); }
}
/** One shadow read case: optional acquisition, comparison, independent raw read, and decisions. */
async function shadowCase(run: Run, label: string, options: { fresh?: boolean; workflow?: 'read-only' | 'sparse-patch'; extra?: Wire } = {}): Promise<Wire> {
  const started = performance.now(), callsBefore = bridgeCalls, bytesBefore = bridgeBytes;
  const infoBefore = await shadow('info'), row: Wire = { label, workflow: options.workflow ?? 'read-only', ...options.extra };
  if (options.fresh || run.index === undefined) {
    if (run.index !== undefined) row.retire = await shadow('retire', { index: run.index });
    const bound = await acquire(); run.index = Number(bound.index); row.acquire = bound;
  }
  const pingP95Ms = await ping();
  row.comparison = await compare(run.index);
  row.infoAfter = await shadow('info'); row.infoBefore = infoBefore;
  row.hostWork = hostWork(infoBefore, row.infoAfter as Wire);
  await writer(TARGET_ROW); Object.assign(row, await rawRead().then(value => ({ raw: value.raw, rawMetadata: value.metadata })));
  row.wallMs = performance.now() - started; row.bridgeCalls = bridgeCalls - callsBefore; row.bridgeResponseBytes = bytesBefore === bridgeBytes ? 0 : bridgeBytes - bytesBefore;
  if ((row.comparison as Wire).comparison === 'match') {
    row.liveDecision = liveDecision(row.comparison as Wire, row.workflow as 'read-only' | 'sparse-patch');
    row.admission = liveAdmission(row.comparison as Wire, row.infoAfter as Wire, pingP95Ms);
  }
  return row;
}
const address = (run: Run): Wire => ({ trackId: (run.state.consumer as Wire).trackId, row: TARGET_ROW });
const matchCheck = (run: Run, row: Wire) => (): string[] =>
  caseIssues(row.comparison as Wire, row.raw as Wire, row.rawMetadata as Wire, run.expected, address(run), TARGET_NAME);
async function runA(statePath: string, out: string): Promise<void> {
  const state = await readJson(statePath), consumer = state.consumer as Wire; assert(consumer, 'prepare first');
  const entry = await research(state); await adapter.hello();
  const trackId = String(consumer.trackId);
  const report: Wire = { schema: CONSUMER_SCHEMA, researchOnly: true, complete: false, eligible: false, stableWriteAuthorityGranted: false,
    started: new Date().toISOString(), project: (state.P as Wire).name, trackId, marker: FINAL_MARKER, hello: entry.hello, entry,
    fixture: { raw: consumer.raw, metadata: consumer.metadata, canaryRaw: consumer.canaryRaw, canaryMetadata: consumer.canaryMetadata },
    namedAssumptions: ['D26 complete step-data delivery for covered cells', 'D27 later-callback ordering rule', 'D28 slot occupancy delivery'],
    cases: [], pending: 'run-b' };
  const run: Run = { report, state, out, expected: rawNotesOf(consumer.raw as Wire) };
  await save(out, report);
  const source = async (): Promise<{ source: ExactNoteSource; wallMs: number }> => {
    const started = performance.now();
    const value = await callTool(workspace, 'acquire_clip_note_source', { trackId, row: TARGET_ROW }, EXPERIMENTAL_7B_TOOL_PROFILE);
    return { source: (value as { exactSource: ExactNoteSource }).exactSource, wallMs: performance.now() - started };
  };
  try {
    // Cold read-only: a new binding, then the actual public read-only route.
    const cold = await shadowCase(run, 'cold-read-only', { fresh: true });
    const stable = await source(); cold.stableSource = stable.source; cold.publicToolCalls = 1; cold.agentVisibleDelayMs = stable.wallMs;
    await record(run, cold, () => [...matchCheck(run, cold)(), ...stableSourceIssues(cold.stableSource as Wire, run.expected)]);
    const warm = await shadowCase(run, 'warm-read-only');
    await record(run, warm, matchCheck(run, warm));
    // Public sparse patch through stable authority, then a stale proposal from the old observation.
    const before = await source();
    const id = before.source.eventMap.find(entry => entry.channel === PATCH.channel && entry.pitch === PATCH.pitch && Math.abs(entry.startBeats - PATCH.cell * GRID) < 1e-9)?.id;
    assert(id, 'patch source note absent');
    const input = { mode: 'agent-note-proposal-v0', source: before.source,
      proposal: { schema: NOTE_PROPOSAL_SCHEMA, base_sha256: before.source.digest.value, ops: [{ op: 'transpose', note_ids: [id], semitones: PATCH.semitones }] },
      invariants: { schema: NOTE_INVARIANTS_SCHEMA, preserveUnmentionedFields: true, samePitchOverlap: 'refuse',
        allowedOperations: ['transpose'], allowedTrackAliases: before.source.aliases.map(alias => alias.alias),
        noteCount: { min: TARGET_FIXTURE.length, max: TARGET_FIXTURE.length } } };
    const started = performance.now();
    const preview = await callTool(workspace, 'transform_clip_music', { ...input, action: 'preview' }, EXPERIMENTAL_7B_TOOL_PROFILE) as { preview?: { previewDigest?: { value: string } } };
    assert(preview.preview?.previewDigest?.value, JSON.stringify(preview).slice(0, 400));
    const accepted = preview.preview.previewDigest.value;
    const application = await callTool(workspace, 'transform_clip_music', { ...input, action: 'apply', acceptedPreviewSha256: accepted }, EXPERIMENTAL_7B_TOOL_PROFILE) as Wire;
    const patchWallMs = performance.now() - started;
    let stale: Wire;
    try { stale = await callTool(workspace, 'transform_clip_music', { ...input, action: 'apply', acceptedPreviewSha256: accepted }, EXPERIMENTAL_7B_TOOL_PROFILE) as Wire; }
    catch (error) { stale = { applied: false, error: String(error) }; }
    await wait(300);
    const change: Change = { kind: 'transpose', ...PATCH };
    const patchRow = await shadowCase(run, 'public-patch', { workflow: 'sparse-patch',
      extra: { stableSource: before.source, application, staleApply: stale, publicToolCalls: 4, agentVisibleDelayMs: before.wallMs + patchWallMs, change } });
    const priorExpected = run.expected, declared = applyChange(run.expected, change);
    const effects = writerEffects(declared, patchRow.raw as Wire);
    patchRow.writerEffects = effects.effects; patchRow.writerEffectIssues = effects.issues;
    run.expected = effects.issues.length === 0 ? rawNotesOf(patchRow.raw as Wire) : declared;
    await record(run, patchRow, () => [...effects.issues, ...(application.applied === true ? [] : ['patch-not-applied']), ...(stale.applied === true ? ['stale-applied'] : []),
      ...stableSourceIssues(before.source as unknown as Wire, priorExpected), ...matchCheck(run, patchRow)()]);
    // Field-only edit through the bridge writer; the warm resident reconciles its dirty coordinate.
    await writer(TARGET_ROW);
    await request('cursor.setNoteProps', { cursor: 'fine', channel: FIELD_EDIT.channel, x: FIELD_EDIT.cell, y: FIELD_EDIT.pitch, props: FIELD_EDIT.props });
    await wait(300);
    const fieldChange: Change = { kind: 'props', channel: FIELD_EDIT.channel, cell: FIELD_EDIT.cell, pitch: FIELD_EDIT.pitch, props: { ...FIELD_EDIT.props } };
    const field = await shadowCase(run, 'field-only', { extra: { change: fieldChange } });
    run.expected = applyChange(run.expected, fieldChange);
    await record(run, field, matchCheck(run, field));
    report.residentIndex = run.index; report.retainedBeforeNative = await shadow('status', { index: run.index });
    assert((report.retainedBeforeNative as Wire).historicalSnapshot, 'retained output absent before the native edit');
    report.expectedAfterA = run.expected; report.pausedForNative = new Date().toISOString(); await persist(run);
    console.log(JSON.stringify({ runA: 'passed', cases: (report.cases as Wire[]).length, residentIndex: run.index,
      operator: `delete the note at channel ${NATIVE_DELETE.channel + 1}, pitch ${NATIVE_DELETE.pitch}, beat ${NATIVE_DELETE.cell * GRID + 1} in ${TARGET_NAME}` }));
  } catch (error) { report.error = String(error); await persist(run); throw error; }
}

async function runB(statePath: string, out: string): Promise<void> {
  const state = await readJson(statePath), report = await readJson(out);
  assert.equal(report.pending, 'run-b'); await research(state); await adapter.hello();
  const run: Run = { report, state, out, expected: report.expectedAfterA as ShadowNote[], index: Number(report.residentIndex) };
  report.resumed = new Date().toISOString();
  try {
    const nativeChange: Change = { kind: 'delete', ...NATIVE_DELETE };
    const native: Wire = { label: 'native-delete', change: nativeChange, operatorDeclared: true,
      retainedAfterChange: await shadow('status', { index: run.index }) };
    await writer(TARGET_ROW); const read = await rawRead(); native.raw = read.raw; native.rawMetadata = read.metadata;
    run.expected = applyChange(run.expected, nativeChange);
    await record(run, native, () => [...((native.retainedAfterChange as Wire).historicalSnapshot === undefined ? [] : ['retained-survived']),
      ...(JSON.stringify(rawNotesOf(read.raw).map(n => `${n.channel}:${n.cell}:${n.pitch}`).sort()) === JSON.stringify(run.expected.map(n => `${n.channel}:${n.cell}:${n.pitch}`).sort()) ? [] : ['native-declaration'])]);
    const reacquire = await shadowCase(run, 'native-reacquire', { fresh: true });
    await record(run, reacquire, matchCheck(run, reacquire));
    // Unhealthy window: a write lands while the authority scan reads.
    let active = await shadow('compareStart', { index: run.index });
    active = await until(async () => active.terminal === true || Number(active.scanProgressCoordinates) > 0 ? active : (active = await shadow('comparePoll')),
      value => value.terminal === true || Number(value.scanProgressCoordinates) > 0);
    const progress = { stage: active.scanStage, coordinates: active.scanProgressCoordinates };
    await writer(TARGET_ROW);
    await request('cursor.setNotes', { cursor: 'fine', channel: FALLBACK_WRITE.channel, notes: [[FALLBACK_WRITE.cell, FALLBACK_WRITE.pitch, FALLBACK_WRITE.velocity, FALLBACK_WRITE.durationCells * GRID]] });
    let terminal = active;
    terminal = await until(async () => terminal.comparison === 'pending' && terminal.terminal !== true ? (terminal = await shadow('comparePoll')) : terminal,
      value => value.comparison !== 'pending' || value.terminal === true);
    await wait(300); const written = await rawRead();
    const added: ShadowNote = { channel: FALLBACK_WRITE.channel, cell: FALLBACK_WRITE.cell, pitch: FALLBACK_WRITE.pitch,
      fields: { velocity: FALLBACK_WRITE.velocity / 127, rawDuration: FALLBACK_WRITE.durationCells * GRID } };
    const window: Wire = { label: 'unhealthy-window', progressAtWrite: progress, comparison: terminal, raw: written.raw, rawMetadata: written.metadata,
      change: { kind: 'add', note: added }, allowedReasons: ['step-window-changed', 'window-changed'],
      statusAfter: await shadow('status', { index: run.index }) };
    const rawAdded = rawNotesOf(written.raw).find(n => n.channel === added.channel && n.cell === added.cell && n.pitch === added.pitch);
    assert(rawAdded, 'fallback write absent'); run.expected = applyChange(run.expected, { kind: 'add', note: rawAdded });
    await record(run, window, () => refusalIssues(terminal, ['step-window-changed', 'window-changed']));
    const exactStarted = performance.now(), infoBefore = await shadow('info');
    let exact = await shadow('exactStart', { trackIndex: 0, row: TARGET_ROW });
    exact = await until(async () => exact.terminal === true ? exact : (exact = await shadow('exactPoll')), value => value.terminal === true);
    const infoAfter = await shadow('info');
    const exactRow: Wire = { label: 'unhealthy-exact', exact, wallMs: performance.now() - exactStarted, infoBefore, infoAfter, hostWork: hostWork(infoBefore, infoAfter) };
    await record(run, exactRow, () => exactIssues(exact, run.expected, address(run)));
    // Restore the fixture note, then reacquire with a new reference.
    await writer(TARGET_ROW); await request('cursor.clearNote', { cursor: 'fine', channel: FALLBACK_WRITE.channel, x: FALLBACK_WRITE.cell, y: FALLBACK_WRITE.pitch });
    await wait(300);
    const removal: Change = { kind: 'delete', channel: FALLBACK_WRITE.channel, cell: FALLBACK_WRITE.cell, pitch: FALLBACK_WRITE.pitch };
    const restored = await shadowCase(run, 'restored-fallback-write', { fresh: true, extra: { change: removal } });
    run.expected = applyChange(run.expected, removal);
    await record(run, restored, matchCheck(run, restored));
    // Unavailable authority: requests outside the exact route refuse with no payload.
    const refusals: Wire[] = [];
    for (const coverage of [
      { startCell: 0, width: 2049, allChannels: true, fields: [], unsupportedFields: [], timingBasis: '1/512-beat' },
      { startCell: 0, width: 2048, allChannels: false, fields: [], unsupportedFields: [], timingBasis: '1/512-beat' },
      { startCell: 0, width: 2048, allChannels: true, fields: ['portableRepeat'], unsupportedFields: [], timingBasis: '1/512-beat' },
    ]) refusals.push(await shadow('exactStart', { trackIndex: 0, row: TARGET_ROW, coverage }));
    const unavailable: Wire = { label: 'unavailable-authority', exactRefusals: refusals };
    await record(run, unavailable, () => refusals.flatMap(value => [...refusalIssues(value, ['authority-coverage-unavailable']),
      ...(value.authorityAvailable === false && value.readMode === 'refuse' ? [] : ['route'])]));
    const matches = (report.cases as Wire[]).filter(row => (row.comparison as Wire | undefined)?.comparison === 'match');
    const earlier = matches.find(row => row.label === 'warm-read-only')!.comparison as Wire, later = matches.at(-1)!.comparison as Wire;
    report.pureControls = { scope: 'pure decisions over live snapshots labelled complete; not live eligibility', earlier, later, decisions: pureControls(earlier, later) };
    report.final = await shadow('info'); report.retire = await shadow('retire', { index: run.index });
    report.finalAfterRetire = await shadow('info'); delete report.pending; report.ended = new Date().toISOString(); await persist(run);
    console.log(JSON.stringify(verifyConsumerReport(report)));
  } catch (error) { report.error = String(error); await persist(run); throw error; }
  finally { await shadow('exactCancel', { reason: 'consumer-run-ended' }); }
}

async function main(): Promise<void> {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === 'verify') { assert(a); console.log(JSON.stringify(verifyConsumerReport(await readJson(a)))); return; }
  if (mode === 'config') { assert(a); await config(a); return; }
  if (mode === 'restore-config') { assert(a); await restoreConfig(a); return; }
  if (mode === 'prepare') { assert(a); await prepare(a); }
  else if (mode === 'run-a') { assert(a && b); await runA(a, b); }
  else if (mode === 'run-b') { assert(a && b); await runB(a, b); }
  else throw new Error('usage: config|restore-config|prepare|run-a|run-b|verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => bridge.disconnect());
