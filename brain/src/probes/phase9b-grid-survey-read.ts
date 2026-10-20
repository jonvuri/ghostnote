/** Bounded schema discovery and paired Grid captures. No fixture writes. */
import assert from 'node:assert/strict';

export type Wire = Record<string, any>;
export type Request = (method: string, params?: Wire) => Promise<Wire>;
export type Step = { parentClass: string; propertyId: number; propertyName: string; index: number };
export type Projection = Record<string, number[]>;
export const MAX_SCHEMAS = 64, MAX_CAPTURES = 34;

export function validateProjection(value: unknown): asserts value is Projection {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'projection-object-required');
  const entries = Object.entries(value);
  assert.ok(entries.length > 0 && entries.length <= 32, 'projection-class-limit');
  let total = 0;
  for (const [name, fields] of entries) {
    assert.ok(name.length > 0 && name.length <= 128 && Array.isArray(fields)
      && fields.length > 0 && fields.length <= 64, 'projection-field-limit');
    assert.ok(fields.every(id => Number.isInteger(id) && id >= 0 && id <= 0x7fffffff)
      && new Set(fields).size === fields.length, 'projection-field-id');
    total += fields.length;
  }
  assert.ok(total <= 1024, 'projection-total-limit');
}
export function childPath(path: Step[], parent: Wire, field: Wire, index: number): Step[] {
  return [...path, { parentClass: parent.className, propertyId: field.id, propertyName: field.name, index }];
}
export function nodePaths(graph: Wire, base: Step[]): Map<number, Step[]> {
  const paths = new Map<number, Step[]>([[graph.root, base]]);
  const nodes = new Map<number, Wire>(graph.nodes.map((n: Wire) => [n.id, n]));
  const pending = [graph.root];
  for (let i = 0; i < pending.length; i++) {
    const id = pending[i]!, n = nodes.get(id);
    if (!n) continue;
    for (const p of n.properties ?? []) (p.refs ?? []).forEach((ref: unknown, index: number) => {
      if (typeof ref === 'number' && !paths.has(ref)) {
        paths.set(ref, childPath(paths.get(id)!, n, p, index)); pending.push(ref);
      }
    });
  }
  return paths;
}
export function addProjection(projection: Projection, schema: Wire): number[] {
  assert.equal(schema.complete, true);
  const available = new Set<number>(schema.properties.map((p: Wire) => p.id));
  const old = projection[schema.className] ?? [];
  const fields = [...new Set<number>([...old.filter(id => available.has(id)),
    ...schema.properties.filter((p: Wire) => p.serializerIncluded).map((p: Wire) => p.id)])];
  assert.ok(fields.length > 0 && fields.length <= 64, 'schema-projection-field-limit');
  assert.ok(Object.keys(projection).length < 32 || projection[schema.className], 'schema-projection-class-limit');
  assert.ok(Object.values(projection).reduce((n, ids) => n + ids.length, 0) - old.length + fields.length <= 1024,
    'schema-projection-total-limit');
  projection[schema.className] = fields;
  return fields;
}
export function summarize(graph: Wire, mode: 'graph' | 'catalog' = 'graph'): Wire {
  if (!graph.complete) return { complete: false, errors: graph.errors, partialNodes: graph.nodes.length };
  const nodes = new Map<number, Wire>(graph.nodes.map((n: Wire) => [n.id, n]));
  const property = (n: Wire, id: number) => n.properties.find((p: Wire) => p.id === id);
  const root = nodes.get(graph.root)!;
  assert.equal(root.className, 'module_grid');
  const members = property(root, 6428).refs as number[];
  assert.equal(new Set(members).size, members.length, 'duplicate-module-member');
  const atoms = new Map<number, number>(), uuids = new Set<string>();
  const modules = members.map((id, index) => {
    const m = nodes.get(id)!; assert.equal(m.className, 'module');
    const uuid = property(m, 15).value.data; assert.ok(!uuids.has(uuid)); uuids.add(uuid);
    const contents = property(m, 406).refs; assert.equal(contents.length, 1);
    const body = nodes.get(contents[0])!; assert.equal(body.className, 'module_contents');
    for (const atom of mode === 'catalog' ? [] : property(body, 173).refs) {
      assert.ok(nodes.has(atom), 'absent-module-atom');
      assert.ok(!atoms.has(atom), 'shared-module-atom'); atoms.set(atom, index);
    }
    return { index, uuid, name: property(m, 404).value.data,
      typeUuid: property(body, 6369).value.data };
  });
  const cables: Wire[] = [];
  for (const n of graph.nodes) {
    for (const p of n.properties) {
      if (p.refs) assert.equal(p.count, p.refs.length, 'relationship-count-disagrees');
      for (const ref of p.refs ?? []) assert.ok(nodes.has(ref), 'dangling-graph-reference');
    }
    if (mode === 'catalog' || n.className !== 'audio_destination_atom') continue;
    for (const ref of property(n, 7125)?.refs ?? []) {
      assert.equal(nodes.get(ref)?.className, 'audio_source_atom');
      assert.ok(atoms.has(n.id) && atoms.has(ref), 'port-outside-module');
      cables.push({ sourceModule: atoms.get(ref), sourceNode: ref, destinationModule: atoms.get(n.id), destinationNode: n.id });
    }
  }
  return { complete: true, moduleCount: modules.length,
    projectedAudioCableCount: mode === 'catalog' ? null : cables.length, modules, cables,
    classes: [...new Set(graph.nodes.map((n: Wire) => n.className))].sort(),
    scope: mode === 'catalog' ? 'Module membership, names, and type UUIDs only. Cables and contents are not covered.'
      : 'Explicit projection. Omitted fields and outer-device modulators are not covered.' };
}
export function controlNodes(graph: Wire): Wire[] {
  const nodes = structuredClone(graph.nodes);
  for (const n of nodes) for (const p of n.properties ?? []) {
    if (p.id === 15 && n.className === 'module') p.value.data = '<instance-uuid>';
    if (p.id === 14) p.value.data = '<managed-id>';
  }
  return nodes;
}

export async function readSurvey(request: Request, target: Wire, projection: Projection,
  save: (name: string, value: unknown) => void, control?: Wire,
  mode: 'graph' | 'catalog' = 'graph'): Promise<Wire> {
  let epoch: string | undefined;
  let schemas = 0, captures = 0, finished = false;
  const additions: Wire[] = [], inspected = new Set<string>();
  const query = async (operation: string, extra: Wire = {}): Promise<Wire> =>
    request('probe.gridRead', { operation, ...target, epoch, ...extra });
  const schema = async (path: Step[], fields: number[] = []): Promise<Wire> => {
    assert.ok(schemas < MAX_SCHEMAS, 'survey-schema-limit');
    const result = await query('schema', { path, schemaHeaders: { fields, limit: 256 } });
    save(`schema-${schemas++}`, { path, ...result });
    assert.equal(result.schema.complete, true); return result.schema;
  };
  try {
    const bound = await query('bind'); epoch = bound.epoch; save('binding', bound);
    const outer = await schema([], [406]);
    const contentsField = outer.properties.find((p: Wire) => p.id === 406 && p.name === 'device_contents');
    assert.ok(contentsField?.relationship && contentsField.count === 1 && contentsField.childrenComplete,
      'native-device-contents-route');
    const contentsPath = childPath([], outer, contentsField, 0);
    const contents = await schema(contentsPath, [173]);
    const children = contents.properties.find((p: Wire) => p.id === 173 && p.name === 'child_components');
    assert.ok(children?.relationship && children.childrenComplete, 'device-child-components-route');
    const grids = children.children.filter((c: Wire) => c.className === 'module_grid');
    assert.equal(grids.length, 1, 'need-one-module-grid-child');
    const path = childPath(contentsPath, contents, children, grids[0].index);
    for (;;) {
      assert.ok(captures < MAX_CAPTURES - 1, 'survey-capture-limit');
      const first = await query('read', { path, projection });
      save(`capture-${captures++}`, { path, projection: structuredClone(projection), ...first });
      const graph = first.graph;
      const missingFields = graph.errors.some((error: string) => error.includes('missing-projection-field'));
      const unknown = graph.nodes.filter((n: Wire) => !projection[n.className]
        || missingFields && n.properties.length === 0);
      if (!graph.complete && unknown.length > 0) {
        const paths = nodePaths(graph, path);
        let extended = false;
        for (const n of unknown) {
          const key = `${n.className}:${n.runtimeClass}`;
          if (inspected.has(key)) continue;
          inspected.add(key);
          const nodePath = paths.get(n.id);
          if (!nodePath) continue;
          const s = await schema(nodePath);
          assert.equal(s.className, n.className);
          try {
            const old = projection[s.className] ?? [];
            const fields = addProjection(projection, s);
            additions.push({ className: s.className, runtimeClass: s.runtimeClass, fields,
              removedAbsentFields: old.filter(id => !fields.includes(id)) }); extended = true;
          } catch (error) { additions.push({ className: s.className, refused: String(error) }); }
        }
        if (extended) continue;
      }
      const second = await query('read', { path, projection });
      save(`capture-${captures++}`, { path, projection: structuredClone(projection), ...second });
      // Compare the representation, not timing and heap counters.
      const paired = JSON.stringify(graph.nodes) === JSON.stringify(second.graph.nodes)
        && graph.complete === second.graph.complete
        && JSON.stringify(graph.errors) === JSON.stringify(second.graph.errors);
      if (graph.complete) assert.ok(paired, 'paired-grid-captures-differ');
      const summary = summarize(graph, mode);
      if (control) {
        assert.equal(graph.complete, true, 'control-must-be-complete');
        if (mode === 'catalog') {
          const identities = (g: Wire) => summarize(g, 'catalog').modules.map(
            (m: Wire) => ({ index: m.index, name: m.name, typeUuid: m.typeUuid }));
          assert.deepEqual(identities(graph), identities(control), 'baseline-control-disagrees');
        } else assert.deepEqual(controlNodes(graph), controlNodes(control), 'baseline-control-disagrees');
      }
      // Inventory fields on observed classes without silently widening known projections.
      const paths = nodePaths(graph, path);
      for (const n of mode === 'catalog' ? [] : graph.nodes) {
        const key = `${n.className}:${n.runtimeClass}`;
        if (inspected.has(key) || schemas >= MAX_SCHEMAS) continue;
        inspected.add(key);
        const nodePath = paths.get(n.id); if (nodePath) await schema(nodePath);
      }
      const result = { ...summary, paired, additions, schemas, captures, path,
        measurements: [first, second].map(r => ({ queryWork: r.queryWork, graphWork: r.graph.work,
          bytes: r.graph.encodedBytes, documentMs: r.documentTaskNanos / 1e6,
          heapUsedBefore: r.heapUsedBefore, heapUsedAfter: r.heapUsedAfter })),
        verdict: graph.complete ? 'projected-read-agrees' : 'incomplete-read-recorded' };
      save('summary', result); finished = true; return result;
    }
  } finally {
    if (epoch) {
      const status = await request('probe.gridRead', { operation: 'status' });
      save('status-before-release', status);
      if (!status.locked && !status.busy && !status.nativeUnfinished) {
        await request('probe.gridRead', { operation: 'release', epoch });
      } else if (finished) throw new Error('survey-session-not-released');
    }
  }
}
