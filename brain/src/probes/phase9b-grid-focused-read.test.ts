import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkedNodes, moduleAtoms, readFocused } from './phase9b-grid-focused-read.js';
import { type Wire } from './phase9b-grid-survey-read.js';

const value = (id: number, data: unknown): Wire => ({ id, name: `field_${id}`, kind: 'value',
  value: { type: typeof data, data } });
const refs = (id: number, name: string, refs: number[]) => ({ id, name, kind: 'relationship', refs, count: refs.length });
const node = (id: number, className: string, properties: Wire[]) =>
  ({ id, className, runtimeClass: className, properties: [value(14, String(id + 100)), ...properties] });
const fixture = [
  node(0, 'module_grid', [refs(6428, 'auxiliary_devices', [1, 5])]),
  node(1, 'module', [value(15, 'uuid-a'), value(404, 'Gates'), refs(406, 'device_contents', [2])]),
  node(2, 'module_contents', [value(6369, 'type-a'), refs(173, 'child_components', [3, 4])]),
  node(3, 'data_array_component', [value(6613, '2'), value(6609, [{ data: 0 }, { data: 1 }])]),
  node(4, 'audio_destination_atom', [refs(7125, 'source', [7])]),
  node(5, 'module', [value(15, 'uuid-b'), value(404, 'Source'), refs(406, 'device_contents', [6])]),
  node(6, 'module_contents', [value(6369, 'type-b'), refs(173, 'child_components', [7])]),
  node(7, 'audio_source_atom', [value(3640, 'Out')]),
];
const projection = { data_array_component: [14, 6613, 6609], audio_destination_atom: [14, 7125] };

function fake(mode = '', tree = fixture) {
  const calls: Wire[] = [], saved: Record<string, any> = {};
  let reads = 0, lastGraph = '';
  const request = async (_: string, p: Wire = {}): Promise<Wire> => {
    calls.push(structuredClone(p));
    if (p.operation === 'bind') return { epoch: 'bound-session' };
    if (p.operation === 'release') return {};
    if (p.operation === 'status') return { locked: mode === 'timeout', busy: false, nativeUnfinished: mode === 'timeout' };
    if (p.operation === 'schema' && p.path.length < 2) {
      const outer = p.path.length === 0;
      assert.deepEqual(p.schemaHeaders.fields, outer ? [406] : [173]);
      return { schema: { complete: mode !== 'truncated', className: outer ? 'native_device' : 'device_contents',
        properties: [{ id: outer ? 406 : 173, name: outer ? 'device_contents' : 'child_components',
          relationship: true, count: 1, childrenComplete: mode !== 'truncated',
          children: [{ className: outer ? 'device_contents' : 'module_grid', index: 0 }] }] } };
    }
    let root = tree[0]!;
    for (const part of p.path.slice(2)) {
      assert.equal(part.parentClass, root.className);
      const property = root.properties.find(v => v.id === part.propertyId)!;
      assert.equal(part.propertyName, property.name);
      root = tree.find(n => n.id === property.refs[part.index])!;
    }
    if (p.operation === 'schema') return { schema: { complete: true, className: root.className,
      properties: root.properties.map(f => ({ ...f, relationship: !!f.refs, childrenComplete: true,
        children: (f.refs ?? []).map((ref: number, index: number) => ({
          className: tree.find(n => n.id === ref)!.className, index })) })) } };
    assert.equal(p.operation, 'read');
    if (mode === 'timeout') throw new Error('survey-timeout');
    reads++;
    const nodes: Wire[] = [], errors: string[] = [], seen = new Set<number>();
    const visit = (n: Wire) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      const projected: Wire = { ...n, properties: [] }; nodes.push(projected);
      if (!p.projection[n.className]) { errors.push('unclassified-projection-class'); return; }
      for (const id of p.projection[n.className]) {
        const f = n.properties.find((f: Wire) => f.id === id);
        assert.ok(f, 'fake fixture has every requested field');
        projected.properties.push(structuredClone(f));
        for (const ref of f.refs ?? []) visit(tree.find(n => n.id === ref)!);
      }
    };
    visit(root);
    if (mode === 'cap' && root.className === 'data_array_component') errors.push('work-or-time-limit');
    const graph = { root: root.id, nodes, errors, complete: errors.length === 0 };
    const signature = JSON.stringify(graph);
    if (mode === 'changed' && lastGraph === signature) graph.nodes[0]!.className = 'changed';
    lastGraph = signature;
    return { graph };
  };
  return { request, calls, saved, save: (name: string, data: unknown) => { saved[name] = data; }, reads: () => reads };
}

test('focused reads pair membership and values, retain cross-module identities, and release', async () => {
  const f = fake(), result = await readFocused(f.request, { project: 'test' }, projection, f.save);
  assert.equal(result.moduleCount, 2);
  assert.equal(result.limits.length, 0);
  assert.equal(result.modules[0].reads[0].nodes[0].fields.find((p: Wire) => p.id === 6613).value.data, '2');
  const destination = result.modules[0].reads[1];
  assert.deepEqual(destination.nodes[0].fields.find((p: Wire) => p.id === 7125).refs, ['107']);
  assert.equal(destination.nodes[1].identityOnly, true);
  assert.equal(result.modules[1].atoms[0].managedId, '107');
  assert.equal(result.modules[1].identityOnlyAtoms.length, 1);
  const captures = Object.values(f.saved).filter(r => r.label?.startsWith('catalog'));
  assert.equal(captures.length, 8, 'Each module has two catalog captures before and after the focused work');
  assert.equal(f.calls.at(-1)?.operation, 'release');
});
test('focused cap results stay incomplete; changed pairs and truncated route headers stop', async () => {
  const cap = fake('cap'), result = await readFocused(cap.request, {}, projection, cap.save);
  assert.equal(result.modules[0].complete, false);
  assert.equal(result.limits.length, 1);
  for (const mode of ['changed', 'truncated']) {
    const f = fake(mode);
    await assert.rejects(readFocused(f.request, {}, projection, f.save), /paired-focused|schema-truncated/);
    assert.equal(f.calls.at(-1)?.operation, 'release');
  }
});
test('focused timeout makes no retry and does not release unfinished work', async () => {
  const f = fake('timeout');
  await assert.rejects(readFocused(f.request, {}, projection, f.save), /survey-timeout/);
  assert.equal(f.calls.filter(p => p.operation === 'read').length, 1);
  assert.equal(f.calls.at(-1)?.operation, 'status');
});
test('focused projections require managed identity before a host call', async () => {
  const f = fake();
  await assert.rejects(readFocused(f.request, {}, { data_array_component: [6609] }, f.save),
    /focused-needs-managed-identity/);
  assert.equal(f.calls.length, 0);
});
test('module selection limits detailed reads but keeps all membership checks', async () => {
  const f = fake(), result = await readFocused(f.request, {}, projection, f.save, undefined, [1]);
  assert.equal(result.modules[0].selected, false);
  assert.equal(result.modules[0].atoms.length, 2);
  assert.equal(result.modules[0].reads.length, 0);
  assert.equal(result.modules[1].selected, true);
  for (const indices of [[], [-1], [1, 1], [64], [0.5]]) {
    const invalid = fake();
    await assert.rejects(readFocused(invalid.request, {}, projection, invalid.save, undefined, indices),
      /invalid-focus-module-indices/);
    assert.equal(invalid.calls.length, 0);
  }
});
test('configured references expose their targets and leave source atoms as identities', async () => {
  const tree = structuredClone(fixture);
  tree[4]!.properties.push(refs(900, 'destination', [8]));
  tree.push(node(8, 'device_atom_reference', [refs(65, 'atom', [7])]));
  const f = fake('', tree);
  const result = await readFocused(f.request, {}, {
    audio_destination_atom: [14, 7125, 900], device_atom_reference: [14, 65],
  }, f.save);
  const nodes = result.modules[0].reads[0].nodes;
  const reference = nodes.find((n: Wire) => n.className === 'device_atom_reference');
  assert.deepEqual(reference.fields.find((p: Wire) => p.id === 65).refs, ['107']);
  assert.equal(nodes.find((n: Wire) => n.className === 'audio_source_atom').identityOnly, true);
});
test('membership and connection checks reject missing references and duplicate managed IDs', () => {
  const graph = { complete: true, root: 1, nodes: structuredClone(fixture.slice(1, 5)) };
  assert.throws(() => checkedNodes(graph), /dangling-reference/);
  graph.nodes[3]!.properties = [value(14, '103')];
  assert.throws(() => moduleAtoms(graph, { uuid: 'uuid-a', name: 'Gates', typeUuid: 'type-a' }),
    /duplicate-managed-id/);
});
test('prepared focus fields have managed identities and omit display and engine projections', () => {
  const query = JSON.parse(readFileSync(new URL(
    '../../../context/evidence/data/phase9b-focused/focused-query.json', import.meta.url), 'utf8'));
  for (const ids of Object.values(query.projection) as number[][]) assert.ok(ids.includes(14));
  assert.equal(query.projection.desktop_settings, undefined);
  assert.ok(query.projection.wavetable_oscillator_atom.includes(11161));
  assert.ok(query.projection.data_array_component.includes(6609));
  assert.ok(query.projection.modulation_source_atom.includes(11497));
});
