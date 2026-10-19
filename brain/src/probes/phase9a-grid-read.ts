/** 9a probe. Usage: state | capture|attachment|schema|project|value|cable|delete|factory <project> <preset> <new output> [query.json] [50|60|sine|amplify|none]. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { BridgeClient } from '../client.js';
import { compareDeployment, deployedAtMs } from '../deploy.js';

type Wire = Record<string, any>;
const [mode, projectPath, presetPath, output, queryPath, targetPercent] = process.argv.slice(2);
assert.ok(['state', 'capture', 'attachment', 'schema', 'project', 'value', 'cable', 'delete', 'factory'].includes(mode!), 'Use state, capture, attachment, schema, project, value, cable, delete, or factory');
if (mode === 'value') assert.ok(['50', '60'].includes(targetPercent!), 'Value mode requires target 50 or 60');
if (mode === 'cable') assert.ok(['sine', 'amplify', 'none'].includes(targetPercent!), 'Cable mode requires sine, amplify, or none');
const writing = mode === 'value' || mode === 'cable' || mode === 'delete' || mode === 'factory';
const client = new BridgeClient();
const calls: Wire[] = [];
let epoch: string | undefined;
let failed = false;
let createdOutput = false;
let succeeded = false;
function save(name: string, value: unknown) {
  if (createdOutput) writeFileSync(join(output!, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
function fingerprint(path: string) {
  assert.ok(isAbsolute(path), 'Fixture paths must be absolute');
  const stat = lstatSync(path);
  assert.ok(stat.isFile() && stat.size <= 32 * 1024 * 1024, 'Use a regular fixture file of at most 32 MiB');
  const data = readFileSync(path);
  return { path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}
async function request(method: string, params: Wire = {}): Promise<Wire> {
  const start = performance.now();
  try {
    const result = await client.request(method, params) as Wire;
    calls.push({ method, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) });
    return result;
  } catch (error) {
    failed = true;
    calls.push({ method, ms: performance.now() - start, error: String(error) });
    throw error;
  }
}

try {
  let files: Wire | undefined;
  let query: Wire = {};
  if (mode === 'schema' || mode === 'project' || writing) {
    assert.ok(queryPath && isAbsolute(queryPath), 'Schema/project needs an absolute query.json path');
    assert.ok(lstatSync(queryPath).isFile() && lstatSync(queryPath).size <= 128 * 1024, 'Query file limit');
    const parsed = JSON.parse(readFileSync(queryPath, 'utf8'));
    assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Query must be an object');
    assert.ok(Object.keys(parsed).every(key => ['path', 'projection'].includes(key)), 'Unknown query field');
    query = parsed;
    if (mode === 'project' || writing) assert.ok(query.projection, 'A projection is required');
  }
  if (mode !== 'state') {
    assert.ok(projectPath && presetPath && output, 'Capture needs project, preset, and new output directory paths');
    assert.ok(isAbsolute(output), 'Use an absolute output directory');
    files = { project: fingerprint(projectPath), preset: fingerprint(presetPath) };
    if (mode === 'factory') {
      assert.equal(files.project.sha256, 'af24056e72e9722eacaa80bf01daa02e7fba0c72103f7fd1655f689448da1b4f');
      assert.equal(files.preset.sha256, '1e8f90fc3875dbeb1f38ed88bec59ee783f39bb00fb366194c79504e063c0cc9');
    }
    mkdirSync(output);
    createdOutput = true;
    save('files', files);
    save('query', { mode, ...query });
  }
  const hello = await request('contract.hello');
  const rig = await request('rig.info');
  const stats = await request('rig.stats');
  const host = await request('host.info');
  const mark = await request('revision.get');
  const selection = await request('selection.status');
  const tracks = await request('track.list');
  const entry = { at: new Date().toISOString(), hello, rig, stats, host, mark, selection, tracks };
  save('entry', entry);
  if (mode === 'state') console.log(JSON.stringify(entry, null, 2));
  else {
    assert.equal(hello.runtimeProfile, 'phase-8-probe-v1');
    assert.equal(hello.methodCount, 118);
    assert.equal(hello.methodsHash, '2e939035ea90b8b0');
    assert.equal(rig.gridReadProbe, '9a-grid-audio-v13');
    assert.equal(compareDeployment(deployedAtMs(), stats.initEpochMs ?? -1).state, 'fresh');
    assert.equal(mark.project, 'gn-grid-spike');
    const matches = tracks.tracks.filter((track: Wire) => track.name === 'grid-probe');
    assert.equal(matches.length, 1, 'Need one grid-probe track');
    const track = matches[0];
    assert.ok(!track.hidden, 'Use a top-level fixture track');
    await request('cursor.pointTrack', { cursor: '0', trackIndex: track.index });
    let settled = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const cursor = await request('devcursor.status');
      if (cursor.trackChannelId === track.channelId) { settled = true; break; }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(settled, 'The owned track cursor did not settle');
    await new Promise(resolve => setTimeout(resolve, 150));
    const devices = await request('device.list', { cursor: 0 });
    save('devices', devices);
    assert.equal(devices.itemCount, devices.count, 'The device bank is incomplete');
    const grids = devices.devices.filter((device: Wire) => device.name === 'Poly Grid');
    assert.equal(grids.length, 1, 'Need one top-level Poly Grid');
    const target = { project: mark.project, trackId: track.channelId, trackName: track.name,
      deviceIndex: grids[0].index, deviceName: 'Poly Grid' };
    const bound = await request('probe.gridRead', { operation: 'bind', ...target });
    save('binding', bound);
    epoch = bound.epoch;
    let prior: Wire | undefined;
    for (let run = 0; run < 2; run++) {
      const result = await request('probe.gridRead', { ...query, operation: mode === 'schema' ? 'schema' : mode === 'attachment' ? 'attachmentRead' : 'read', epoch, ...target });
      save(`capture-${run}`, result);
      if (mode === 'schema') {
        assert.equal(result.schema.complete, true);
        if (prior) {
          const { work: ignoredBefore, ...before } = prior.schema;
          const { work: ignoredAfter, ...after } = result.schema;
          assert.deepEqual(after, before, 'Settled schemas differ');
        }
      } else {
        assert.equal(result.graph.complete, true, `Incomplete capture ${run}; inspect the saved errors before further live work`);
        if (mode === 'capture') {
          const root = result.graph.nodes.find((node: Wire) => node.id === result.graph.root);
          const contents = root?.properties.find((property: Wire) => property.id === 406);
          assert.equal(contents?.inclusion, 'explicit-root-bridge', 'The device contents bridge is missing');
          assert.equal(contents?.count, 1, 'Need one device contents object');
        }
        if (prior) assert.deepEqual(result.graph.nodes, prior.graph.nodes, 'Settled graphs differ');
        if (mode === 'attachment') {
          assert.ok(result.witness, 'The native attachment witness is absent');
          if (prior) assert.deepEqual(result.witness, prior.witness, 'Settled native witnesses differ');
        }
      }
      prior = result;
    }
    if (writing) {
      const nodes = prior!.graph.nodes as Wire[];
      const node = (id: number) => { const found = nodes.find(n => n.id === id); assert.ok(found); return found; };
      const property = (n: Wire, id: number) => { const found = n.properties.find((p: Wire) => p.id === id); assert.ok(found); return found; };
      const modules = property(node(prior!.graph.root), 6428).refs as number[];
      assert.equal(modules.length, 4);
      const module = node(modules[3]!);
      const contents = node(property(module, 406).refs[0]);
      const atoms = property(contents, 173).refs;
      let expected = structuredClone(nodes);
      let method: string, params: Wire;
      if (mode === 'factory') {
        method = 'probe.gridModuleFactory';
        params = { moduleUuids: modules.map(id => property(node(id), 15).value.data) };
      } else if (mode === 'value') {
        const baseline = 0.7937005259840998, changed = 0.8434326653017492;
        const before = targetPercent === '60' ? baseline : changed;
        const after = targetPercent === '60' ? changed : baseline;
        const value = node(atoms[1]);
        assert.equal(property(value, 712).value.data, before);
        assert.equal(property(value, 949).value.data, before);
        for (const id of [712, 949]) property(expected.find(n => n.id === value.id)!, id).value.data = after;
        method = 'probe.gridValue';
        params = { moduleUuid: property(module, 15).value.data, before, after };
      } else {
        const sineContents = node(property(node(modules[0]!), 406).refs[0]);
        const amplifierContents = node(property(node(modules[1]!), 406).refs[0]);
        const sources: Record<string, number[]> = { none: [], sine: [property(sineContents, 173).refs[2]],
          amplify: [property(amplifierContents, 173).refs[0]] };
        const destination = node(atoms[3]);
        const actual = property(destination, 7125).refs;
        const before = Object.keys(sources).find(key => JSON.stringify(sources[key]) === JSON.stringify(actual));
        assert.ok(before, 'The spare input has an unsupported source');
        if (mode !== 'delete') assert.notEqual(before, targetPercent, 'The requested source is already connected');
        const connection = property(expected.find(n => n.id === destination.id)!, 7125);
        params = { moduleUuids: modules.map(id => property(node(id), 15).value.data), before };
        if (mode === 'delete') {
          const removed = new Set<number>([module.id, contents.id, ...atoms]);
          assert.equal(removed.size, 8, 'Need the complete spare Amplify subgraph');
          expected = expected.filter(n => !removed.has(n.id));
          const membership = property(expected.find(n => n.id === prior!.graph.root)!, 6428);
          membership.refs = modules.slice(0, 3);
          membership.count = 3;
          method = 'probe.gridModuleDelete';
        } else {
          connection.refs = sources[targetPercent!];
          connection.count = connection.refs.length;
          method = 'probe.gridCable';
          params.after = targetPercent;
        }
      }
      const command = await request(method, { ...target, epoch, ...params, expectedNodes: nodes });
      save(`${mode}-command`, command);
      assert.deepEqual(command.graph.nodes, nodes, 'The command guard differs from the paired before reads');
      assert.equal(command.writeStatus, mode === 'factory'
        ? 'detached-disposed; fresh fixture read required' : 'command-returned; fresh read required');
      if (mode === 'factory') {
        const lifecycle = command.lifecycle;
        assert.equal(lifecycle.stage, 'complete');
        for (const key of ['factoryAttempted', 'factoryReturned', 'ownershipProved',
          'initializationHelpersPresent', 'disposeAttempted', 'disposalVerified']) assert.equal(lifecycle[key], true, key);
        assert.ok(lifecycle.ownedObjects >= 8 && lifecycle.ownedObjects <= 256);
        assert.deepEqual(lifecycle.capture0.nodes, lifecycle.capture1.nodes);
        for (const capture of [lifecycle.capture0, lifecycle.capture1]) {
          assert.equal(capture.complete, true); assert.equal(capture.errorCount, 0);
          assert.equal(capture.nodes.length, 8);
          const detached = capture.nodes.find((n: Wire) => n.id === capture.root);
          assert.ok(!params.moduleUuids.includes(property(detached, 15).value.data));
        }
      }
      for (let run = 0; run < 2; run++) {
        const result = await request('probe.gridRead', { ...query, operation: 'read', epoch, ...target });
        save(`${mode}-readback-${run}`, result);
        assert.equal(result.graph.complete, true, 'Write readback is incomplete; inspect before another write');
        assert.deepEqual(result.graph.nodes, expected, 'Write readback or unrelated graph state disagrees');
      }
    }
    assert.deepEqual(fingerprint(projectPath!), files!.project, 'The saved project changed during capture');
    assert.deepEqual(fingerprint(presetPath!), files!.preset, 'The saved preset changed during capture');
    if (mode === 'factory') save('files-after', { project: fingerprint(projectPath!), preset: fingerprint(presetPath!) });
    const finalSelection = await request('selection.status');
    save('selection-after', finalSelection);
    if (writing || mode === 'attachment') assert.deepEqual(finalSelection, selection, 'Selection changed during the fixture write');
    console.log(JSON.stringify({ status: writing ? `${mode}-readback-agrees` : 'raw-captures-agree', mode, output,
      semanticGate: 'evaluate with read_semantics.py; UI witness required for writes',
      selectionUnchanged: JSON.stringify(selection) === JSON.stringify(finalSelection) }));
    succeeded = true;
  }
} finally {
  if (epoch && !failed) {
    try { await request('probe.gridRead', { operation: 'release', epoch }); }
    catch (error) { console.error(`Epoch release failed: ${error}`); }
  }
  if (createdOutput && !succeeded && !failed) {
    try {
      save('failure-exit', { selection: await request('selection.status'),
        project: fingerprint(projectPath!), preset: fingerprint(presetPath!) });
    } catch (error) { console.error(`Failure exit read failed: ${error}`); }
  }
  save('calls', { calls, sequentialWireCalls: calls.length,
    note: 'Async document and completion tasks add host scheduling beyond the wire-call count.' });
  client.disconnect();
}
