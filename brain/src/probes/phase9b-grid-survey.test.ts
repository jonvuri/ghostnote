import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addProjection, controlNodes, nodePaths, readSurvey, summarize, validateProjection, type Wire } from './phase9b-grid-survey-read.js';
import { presetList } from './phase9b-grid-survey.js';

const data = join(import.meta.dirname, '../../../context/evidence/data/phase9a-grid-read');
const baseline = JSON.parse(readFileSync(join(data, 'live-23-semantic-baseline/capture-0.json'), 'utf8')).graph;
const originalProjection = JSON.parse(readFileSync(join(data, 'semantic-query.json'), 'utf8')).projection;
const target = { project: 'Other project', trackId: 'scratch', trackName: 'Owned scratch',
  deviceIndex: 0, deviceName: 'Note Grid' };

function fake(mode = 'normal') {
  const calls: Wire[] = [], saved: Wire = {};
  const graph = structuredClone(baseline);
  if (mode === 'unknown') {
    const body = graph.nodes.find((n: Wire) => n.className === 'module_contents');
    const child = body.properties.find((p: Wire) => p.id === 173);
    child.refs.push(53); child.count++;
    graph.nodes.push({ id: 53, className: 'new_atom', runtimeClass: 'new', classId: 123,
      properties: [{ id: 999, name: 'stored', kind: 'value', value: { type: 'integer', data: '2' } }] });
  }
  let reads = 0;
  const request = async (method: string, p: Wire = {}): Promise<Wire> => {
    assert.equal(method, 'probe.gridRead'); calls.push(structuredClone(p));
    if (p.operation === 'bind') return { epoch: 'epoch' };
    if (p.operation === 'release') return { success: true };
    if (p.operation === 'status') return { locked: mode === 'timeout', busy: false, nativeUnfinished: mode === 'timeout' };
    if (p.operation === 'schema') {
      let s: Wire;
      if (p.path.length === 0) s = { className: 'native_device', properties: [
        { id: 406, name: 'device_contents', relationship: true, count: 1 }] };
      else if (p.path.length === 1) s = { className: 'device_contents', properties: [
        { id: 173, name: 'child_components', relationship: true, children: [
          { className: 'other', index: 0 }, { className: 'module_grid', index: 3 }] }] };
      else {
        assert.equal(p.path[1].index, 3, 'Discover the Grid instead of using index 7');
        let n = graph.nodes[0];
        for (const step of p.path.slice(2)) {
          const field = n.properties.find((v: Wire) => v.id === step.propertyId);
          n = graph.nodes.find((v: Wire) => v.id === field.refs[step.index]);
        }
        s = { className: n.className, runtimeClass: n.runtimeClass,
          properties: n.properties.map((v: Wire) => ({ id: v.id, name: v.name, serializerIncluded: true })) };
      }
      return { schema: { ...s, complete: true } };
    }
    assert.equal(p.operation, 'read'); reads++;
    if (mode === 'timeout') throw new Error('survey-timeout');
    const g = structuredClone(graph);
    if (mode === 'unknown' && !p.projection.new_atom) {
      g.complete = false; g.errors = ['node:53:unclassified-projection-class:new_atom'];
      g.nodes.at(-1).properties = [];
    }
    if (mode === 'missing' && p.projection.decimal_value_atom.includes(999)) {
      g.complete = false; g.errors = ['node:missing-projection-field:decimal_value_atom'];
      g.nodes.find((n: Wire) => n.className === 'decimal_value_atom').properties = [];
    }
    if (mode === 'cap') { g.complete = false; g.errors = ['schema-work-or-time-limit']; }
    if (mode === 'changed' && reads === 2) g.nodes[0].className = 'changed';
    return { graph: g, queryWork: 1606, documentTaskNanos: 1e6 };
  };
  return { calls, saved, request, save: (name: string, value: unknown) => { saved[name] = value; } };
}

test('survey discovers a different Grid child, verifies control, reads twice, and releases', async () => {
  const f = fake();
  const result = await readSurvey(f.request, target, structuredClone(originalProjection), f.save, baseline);
  assert.equal(result.moduleCount, 4); assert.equal(result.projectedAudioCableCount, 2);
  assert.equal(result.paired, true); assert.equal(result.captures, 2);
  assert.equal(f.calls.at(-1)?.operation, 'release');
});
test('catalog reads validate membership without claiming cable coverage or scanning atom schemas', async () => {
  const graph = structuredClone(baseline);
  graph.nodes = graph.nodes.filter((n: Wire) => ['module_grid', 'module', 'module_contents'].includes(n.className));
  for (const n of graph.nodes) n.properties = n.properties.filter((p: Wire) =>
    (n.className === 'module_grid' ? [6428] : n.className === 'module' ? [15, 404, 406] : [6369]).includes(p.id));
  const f = fake();
  const request = async (method: string, params: Wire = {}) => {
    const result = await f.request(method, params);
    return params.operation === 'read' ? { ...result, graph } : result;
  };
  const result = await readSurvey(request, target,
    { module_grid: [6428], module: [15, 404, 406], module_contents: [6369] }, f.save, baseline, 'catalog');
  assert.equal(result.moduleCount, 4);
  assert.equal(result.projectedAudioCableCount, null);
  assert.equal(result.schemas, 2);
  assert.equal(result.paired, true);
  assert.equal(f.calls.at(-1)?.operation, 'release');
});
test('unknown classes get one schema and an explicit projection before paired reads', async () => {
  const f = fake('unknown'), projection = structuredClone(originalProjection);
  const result = await readSurvey(f.request, target, projection, f.save);
  assert.equal(result.complete, true); assert.equal(result.captures, 3);
  assert.deepEqual(projection.new_atom, [999]);
  assert.equal(result.additions.length, 1);
  assert.equal(Object.values(f.saved).filter((s: any) => s.schema?.className === 'new_atom').length, 1);
});
test('a paired cap refusal is recorded and the session is released', async () => {
  const f = fake('cap');
  const result = await readSurvey(f.request, target, structuredClone(originalProjection), f.save);
  assert.equal(result.verdict, 'incomplete-read-recorded'); assert.equal(result.paired, true);
  assert.equal(f.calls.at(-1)?.operation, 'release');
});
test('an absent projected field is reconciled once and its removal is recorded', async () => {
  const f = fake('missing'), projection = structuredClone(originalProjection);
  projection.decimal_value_atom.push(999);
  const result = await readSurvey(f.request, target, projection, f.save);
  assert.equal(result.complete, true);
  assert.deepEqual(result.additions[0].removedAbsentFields, [999]);
  assert.equal(result.captures, 3);
});
test('a changing graph stops; a timeout does not retry or release unfinished native work', async () => {
  const changing = fake('changed');
  await assert.rejects(readSurvey(changing.request, target, structuredClone(originalProjection), changing.save),
    /paired-grid-captures-differ/);
  assert.equal(changing.calls.at(-1)?.operation, 'release');
  const timeout = fake('timeout');
  await assert.rejects(readSurvey(timeout.request, target, structuredClone(originalProjection), timeout.save), /survey-timeout/);
  assert.equal(timeout.calls.filter(c => c.operation === 'read').length, 1);
  assert.equal(timeout.calls.at(-1)?.operation, 'status');
});
test('graph checks reject dangling cables and duplicate module identities', () => {
  const graph = structuredClone(baseline);
  const input = graph.nodes.find((n: Wire) => n.className === 'audio_destination_atom');
  input.properties.find((p: Wire) => p.id === 7125).refs = [9000];
  assert.throws(() => summarize(graph));
  const duplicate = structuredClone(baseline), modules = duplicate.nodes.filter((n: Wire) => n.className === 'module');
  modules[1].properties.find((p: Wire) => p.id === 15).value.data =
    modules[0].properties.find((p: Wire) => p.id === 15).value.data;
  assert.throws(() => summarize(duplicate));
  assert.deepEqual(controlNodes(baseline), controlNodes(structuredClone(baseline)));
  assert.equal(nodePaths(baseline, []).size, 53);
});
test('input and projection limits fail before a host call', () => {
  validateProjection(originalProjection);
  for (const invalid of [undefined, [], {}, { a: [] }, { a: [-1] }, { a: [1, 1] }, { a: [0.5] }])
    assert.throws(() => validateProjection(invalid));
  assert.throws(() => presetList([])); assert.throws(() => presetList(['relative.bwpreset']));
  assert.throws(() => presetList(Array(33).fill('/tmp/anything.bwpreset')));
  const projection = Object.fromEntries(Array.from({ length: 32 }, (_, i) => [`c${i}`, [1]]));
  assert.throws(() => addProjection(projection, { complete: true, className: 'extra',
    properties: [{ id: 1, serializerIncluded: true }] }), /class-limit/);
});
