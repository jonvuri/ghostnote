import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareEngine, runEngine, restoreEngine, recoverEngine, expectedStage, checkWindow, halfRatio,
  ENGINE_BUDGET, ENGINE_MARKER, ENGINE_HASH, type Options, type Request } from './phase9a-grid-engine.js';

type Wire = Record<string, any>;
const saved = JSON.parse(readFileSync(new URL('../../../context/evidence/data/phase9a-grid-attachment/live-98-v11-repeat/attach-command.json', import.meta.url), 'utf8'));
function signal(name: string): Wire {
  const pulse = !name.startsWith('Q'), peak = ['Q0', 'Q1', 'B0', 'N0'].includes(name) ? 0 : name === 'N-half' ? 63 : 80;
  const samples = [[0, 100_000_000, 0, 0], ...(pulse ? [[1, 300_000_000, 2, 60]] : []),
    [0, 450_000_000, 1, 0], [0, 500_000_000, 0, peak], ...(pulse ? [[0, 900_000_000, 2, 0]] : []), [0, 1_100_000_000, 0, 0]];
  samples.forEach((row, i) => row[0] = i);
  return { name, available: true, failure: '', elapsedNanos: 1_250_000_000, samples, samplesCount: samples.length, peak,
    packets: [[10000, 11200], [10000, 11200]], noteOnAttempted: pulse, noteOffAttempted: pulse, noteOnObserved: pulse, noteOffObserved: pulse };
}
function fixture(fault = '') {
  let graph = structuredClone(saved.graph), witness = structuredClone(saved.witness), stage = 0, mode = '', mutated = false, time = 10000;
  let commands = 0, captures = 0, windows = 0, factories = 0, notes = 0;
  const calls: Wire[] = [], artifacts = new Map<string, unknown>();
  const request: Request = async (name, p = {}) => {
    calls.push({ name, ...p });
    switch (name) {
      case 'contract.hello': return { runtimeProfile: 'phase-8-probe-v1', methodCount: 118, methodsHash: ENGINE_HASH };
      case 'rig.info': return { gridReadProbe: fault === 'cohort' ? 'old' : ENGINE_MARKER };
      case 'rig.stats': return { initEpochMs: 2 };
      case 'host.info': return {};
      case 'revision.get': return { project: 'gn-grid-spike' };
      case 'selection.status': return {};
      case 'track.list': return { tracks: [{ name: 'grid-probe', index: 0, channelId: 'track', ...(fault === 'hidden' ? { hidden: true } : {}) }] };
      case 'cursor.pointTrack': return {};
      case 'devcursor.status': return { trackChannelId: fault === 'target' ? 'replacement' : 'track' };
      case 'device.list': return { itemCount: 1, count: 1, devices: [{ name: 'Poly Grid', index: 0 }] };
      case 'probe.gridEngine': break;
      default: throw new Error(name);
    }
    if (p.operation === 'bind') { mode = p.mode; stage = p.stage ?? 0; mutated = false; return { epoch: 'epoch' }; }
    if (p.operation === 'read' || p.operation === 'command') {
      captures++; const result = { marker: ENGINE_MARKER, graph: structuredClone(graph), witness: structuredClone(witness), lifecycle: saved.lifecycle,
        writeStatus: 'command-returned; paired readback required' };
      if (p.operation === 'command') {
        commands++; if (stage === 3) factories++;
        if (fault === `command-${stage}`) throw new Error('native timeout');
        graph.nodes = expectedStage(graph, stage, saved.lifecycle); mutated = true;
        if (stage === 3) { witness.moduleUuids.push(saved.lifecycle.attached.uuid); witness.rectangles.push(saved.lifecycle.attached.rectangle); }
        if (stage === 11) { witness.moduleUuids.pop(); witness.rectangles.pop(); }
      } else if (mode === 'stage' && mutated && fault === `read-${stage}`) result.graph.nodes[0].className = 'wrong';
      return result;
    }
    if (p.operation === 'windowBegin') { windows++; if (!p.name.startsWith('Q')) notes += 2; return { window: { name: p.name } }; }
    if (p.operation === 'windowCollect') {
      const w = signal(p.name);
      if (fault === `window-${p.name}`) w.available = false;
      return { window: w };
    }
    if (p.operation === 'sessionRelease') return { active: false, restored: true, nativeUnfinished: false, epochOpen: false };
    if (p.operation === 'status') return { next: 'complete', locked: false, nativeUnfinished: false };
    return {};
  };
  const options: Options = { save: (name, value) => artifacts.set(name, value), settle: async () => { time += 150; },
    wait: async ms => { time += ms; }, now: () => time, verifyFiles: () => {}, deployedAt: 1 };
  return { request, options, calls, artifacts, stats: () => ({ commands, captures, windows, factories, notes }), graph: () => graph };
}
test('engine protocol uses 252 calls, 59 captures, one factory, 11 edits, and 16 note writes', async () => {
  const f = fixture(); const ui = () => ({ observedAt: f.options.now(), isolationConfirmed: true });
  await prepareEngine(f.request, f.options, { ...ui(), engineInactive: true }); assert.equal(f.calls.length, 16);
  await runEngine(f.request, f.options, { ...ui(), engineActive: true }); assert.equal(f.calls.length, 236);
  await restoreEngine(f.request, f.options, { ...ui(), engineInactive: true, restorationConfirmed: true });
  assert.equal(f.calls.length, ENGINE_BUDGET.calls);
  assert.deepEqual(f.stats(), { commands: 11, captures: 59, windows: 10, factories: 1, notes: 16 });
  assert.deepEqual(f.graph().nodes, saved.graph.nodes);
  assert.equal(f.calls.filter(c => c.operation === 'windowCollect').length, 10);
  assert.equal(f.calls.filter(c => c.name === 'cursor.pointTrack').length, 13);
});
test('every graph failure stops without an inverse, retry, or diagnostic document request', async () => {
  for (let stage = 1; stage <= 11; stage++) for (const kind of ['command', 'read']) {
    const f = fixture(`${kind}-${stage}`);
    await assert.rejects(runEngine(f.request, f.options, { observedAt: f.options.now(), isolationConfirmed: true, engineActive: true }));
    assert.equal(f.stats().commands, stage); assert.deepEqual(f.calls.slice(-2).map(c => c.operation), ['abort', 'status']);
    assert.equal(f.calls.filter(c => c.operation === 'bind' && c.mode === 'recovery').length, 0);
  }
});
test('every signal refusal stops; calibration failures never reach construction', async () => {
  for (const name of ['Q0', 'B+', 'B0', 'B-return', 'N+', 'N0', 'N-half', 'N-return', 'R+', 'Q1']) {
    const f = fixture(`window-${name}`);
    await assert.rejects(runEngine(f.request, f.options, { observedAt: f.options.now(), isolationConfirmed: true, engineActive: true }));
    assert.deepEqual(f.calls.slice(-2).map(c => c.operation), ['abort', 'status']);
    if (['Q0', 'B+', 'B0', 'B-return'].includes(name)) assert.equal(f.stats().factories, 0);
  }
});
test('stale UI, wrong cohort, and replacement target refuse before graph writes', async () => {
  for (const fault of ['cohort', 'target', 'hidden']) {
    const f = fixture(fault);
    await assert.rejects(prepareEngine(f.request, f.options, { observedAt: f.options.now(), isolationConfirmed: true, engineInactive: true }));
    assert.equal(f.stats().commands, 0);
    assert.equal(f.calls.filter(c => c.operation === 'bind').length, 0);
  }
  const f = fixture();
  await assert.rejects(runEngine(f.request, f.options, { observedAt: -60000, isolationConfirmed: true, engineActive: true }));
  assert.equal(f.calls.length, 0);
});
test('window validation rejects missing data, master leak, clock order, stale packet, and foreign note', () => {
  for (const change of [
    (w: Wire) => { w.samples = []; w.samplesCount = 0; },
    (w: Wire) => { w.samples[2][3] = 2; },
    (w: Wire) => { w.samples[3][1] = 200_000_000; },
    (w: Wire) => { w.packets[0][1] = 10000; },
    (w: Wire) => { w.samples[1][3] = 61; },
    (w: Wire) => { w.noteOffObserved = false; },
    (w: Wire) => { w.elapsedNanos = 2_000_000_001; },
  ]) { const w = signal('B+'); change(w); assert.throws(() => checkWindow(w, 'B+')); }
  halfRatio(63, 80, 80); for (const h of [0, 40, 70, 80]) assert.throws(() => halfRatio(h, 80, 80));
});
test('recovery is four reads/control calls; a failed read is never retried', async () => {
  const calls: Wire[] = [];
  const request: Request = async (name, params = {}) => { calls.push({ name, ...params }); return { epoch: 'epoch' }; };
  await recoverEngine(request, { trackId: 'original' }, () => {});
  assert.equal(calls.length, ENGINE_BUDGET.recoveryCalls); assert.deepEqual(calls.map(c => c.operation), ['bind', 'read', 'read', 'release']);
  let n = 0;
  await assert.rejects(recoverEngine(async () => { if (++n === 2) throw new Error('timeout'); return { epoch: 'epoch' }; }, {}, () => {}));
  assert.equal(n, 2);
});
