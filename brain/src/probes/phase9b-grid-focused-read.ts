/** Focused descriptor reads. Managed IDs are valid only in the bound session. */
import assert from 'node:assert/strict';
import { childPath, nodePaths, summarize, validateProjection,
  type Projection, type Request, type Step, type Wire } from './phase9b-grid-survey-read.js';

export const FOCUSED_LIMITS = { modules: 64, atoms: 256, schemas: 256, captures: 1024, summaryBytes: 4 * 1024 * 1024 };
const catalog: Projection = { module: [15, 404, 406], module_contents: [6369] };
const member: Projection = { module: [14, 15, 404, 406], module_contents: [14, 6369, 173] };
export const field = (n: Wire, id: number): Wire => {
  const p = n.properties.find((p: Wire) => p.id === id);
  assert.ok(p, `missing-field:${n.className}:${id}`); return p;
};
export function checkedNodes(graph: Wire): Map<number, Wire> {
  assert.equal(graph.complete, true, 'focused-capture-incomplete');
  const nodes = new Map<number, Wire>(graph.nodes.map((n: Wire) => [n.id, n]));
  assert.equal(nodes.size, graph.nodes.length, 'duplicate-node-id');
  assert.ok(nodes.has(graph.root), 'missing-root');
  for (const n of nodes.values()) for (const p of n.properties) if (p.kind === 'relationship') {
    assert.equal(p.count, p.refs.length, 'relationship-count-disagrees');
    for (const ref of p.refs) assert.ok(nodes.has(ref), 'dangling-reference');
  }
  return nodes;
}
export function moduleAtoms(graph: Wire, expected: Wire): Wire[] {
  const nodes = checkedNodes(graph), root = nodes.get(graph.root)!;
  assert.equal(root.className, 'module');
  assert.equal(field(root, 15).value.data, expected.uuid, 'module-identity-changed');
  assert.equal(field(root, 404).value.data, expected.name, 'module-name-changed');
  const contents = field(root, 406).refs;
  assert.equal(contents.length, 1);
  const body = nodes.get(contents[0])!;
  assert.equal(body.className, 'module_contents');
  assert.equal(field(body, 6369).value.data, expected.typeUuid, 'module-type-changed');
  const refs = field(body, 173).refs;
  assert.equal(new Set(refs).size, refs.length, 'duplicate-atom-member');
  assert.ok(refs.length <= FOCUSED_LIMITS.atoms, 'focused-atom-limit');
  const atoms = refs.map((ref: number, index: number) => {
    const n = nodes.get(ref)!, managedId = field(n, 14).value.data;
    assert.ok(/^[1-9][0-9]*$/.test(String(managedId)), 'invalid-managed-id');
    return { index, nodeId: ref, managedId, className: n.className, runtimeClass: n.runtimeClass };
  });
  assert.equal(new Set(atoms.map((a: Wire) => a.managedId)).size, atoms.length, 'duplicate-managed-id');
  return atoms;
}

export async function readFocused(request: Request, target: Wire, configured: Projection,
  save: (name: string, value: unknown) => void, control?: Wire, focusModuleIndices?: number[]): Promise<Wire> {
  validateProjection(configured);
  for (const fields of Object.values(configured)) assert.ok(fields.includes(14), 'focused-needs-managed-identity');
  validateFocusIndices(focusModuleIndices);
  let epoch: string | undefined, schemas = 0, captures = 0, summaryBytes = 0;
  const schemaKeys = new Set<string>(), limits: Wire[] = [], modules: Wire[] = [];
  const chargeSummary = (record: Wire) => {
    summaryBytes += Buffer.byteLength(JSON.stringify(record)) + 16;
    assert.ok(summaryBytes <= FOCUSED_LIMITS.summaryBytes, 'focused-summary-limit');
  };
  const query = (operation: string, extra: Wire = {}) =>
    request('probe.gridRead', { operation, ...target, epoch, ...extra });
  const schema = async (path: Step[], fields: number[] = []): Promise<Wire> => {
    assert.ok(schemas < FOCUSED_LIMITS.schemas, 'focused-schema-limit');
    const result = await query('schema', { path, schemaHeaders: { fields, limit: 256 } });
    save(`focused-schema-${schemas++}`, { path, ...result });
    assert.equal(result.schema.complete, true, 'focused-schema-truncated');
    return result.schema;
  };
  const capture = async (path: Step[], projection: Projection, label: string): Promise<Wire> => {
    assert.ok(captures < FOCUSED_LIMITS.captures, 'focused-capture-limit');
    validateProjection(projection);
    const result = await query('read', { path, projection });
    save(`focused-capture-${captures++}`, { label, path, projection: structuredClone(projection), ...result });
    return result.graph;
  };
  // Unknown classes get identity fields only. Their saved schemas guide later projections.
  const pair = async (path: Step[], seed: Projection, label: string): Promise<Wire> => {
    const projection = structuredClone(seed);
    for (let attempt = 0; attempt < 32; attempt++) {
      const first = await capture(path, projection, label);
      const unknown = first.nodes.filter((n: Wire) => !projection[n.className]);
      if (!first.complete && unknown.length) {
        const paths = nodePaths(first, path);
        for (const n of unknown) {
          if (projection[n.className]) continue;
          const key = `${n.className}:${n.runtimeClass}`;
          if (!schemaKeys.has(key)) {
            const s = await schema(paths.get(n.id)!);
            assert.equal(s.className, n.className);
            assert.ok(s.properties.some((p: Wire) => p.id === 14 && !p.relationship), 'no-managed-identity');
            schemaKeys.add(key);
          }
          projection[n.className] = [14];
          validateProjection(projection);
        }
        continue;
      }
      const second = await capture(path, projection, label);
      if (!first.complete || !second.complete) {
        const limit = { label, path, errors: [first.errors, second.errors] };
        chargeSummary(limit); limits.push(limit);
        return { complete: false };
      }
      assert.deepEqual(first.nodes, second.nodes, 'paired-focused-captures-differ');
      checkedNodes(first); return first;
    }
    throw new Error('focused-discovery-limit');
  };
  try {
    const binding = await query('bind'); epoch = binding.epoch; save('focused-binding', binding);
    const outer = await schema([], [406]), contentsField = outer.properties.find((p: Wire) => p.id === 406);
    assert.ok(contentsField?.relationship && contentsField.count === 1 && contentsField.childrenComplete);
    const contentsPath = childPath([], outer, contentsField, 0);
    const contents = await schema(contentsPath, [173]);
    const children = contents.properties.find((p: Wire) => p.id === 173);
    assert.ok(children?.relationship && children.childrenComplete);
    const grids = children.children.filter((c: Wire) => c.className === 'module_grid');
    assert.equal(grids.length, 1, 'need-one-module-grid-child');
    const path = childPath(contentsPath, contents, children, grids[0].index);
    const modulePath = (index: number) => [...path, { parentClass: 'module_grid', propertyId: 6428,
      propertyName: 'auxiliary_devices', index }];
    const inventory = async (label: string): Promise<Wire[]> => {
      const grid = await schema(path, [6428]), members = grid.properties.find((p: Wire) => p.id === 6428);
      assert.ok(members?.relationship && members.childrenComplete, 'focused-membership-headers-incomplete');
      assert.ok(members.count <= FOCUSED_LIMITS.modules, 'focused-module-limit');
      assert.ok(members.children.every((n: Wire, index: number) => n.className === 'module' && n.index === index));
      const records: Wire[] = [];
      for (let index = 0; index < members.count; index++) {
        const graph = await pair(modulePath(index), catalog, `${label}-${index}`);
        const nodes = checkedNodes(graph), root = nodes.get(graph.root)!;
        assert.equal(root.className, 'module');
        const contents = field(root, 406).refs;
        assert.equal(contents.length, 1);
        const body = nodes.get(contents[0])!;
        assert.equal(body.className, 'module_contents');
        records.push({ index, uuid: field(root, 15).value.data, name: field(root, 404).value.data,
          typeUuid: field(body, 6369).value.data });
      }
      assert.equal(new Set(records.map(r => r.uuid)).size, records.length, 'duplicate-module-uuid');
      const after = await schema(path, [6428]);
      assert.deepEqual(after.properties, grid.properties, 'catalog-membership-headers-changed');
      return records;
    };
    const catalogBefore = await inventory('catalog-before');
    if (focusModuleIndices) assert.ok(focusModuleIndices.every(index => index < catalogBefore.length),
      'focused-module-index-outside-catalog');
    if (control) assert.deepEqual(catalogBefore.map(({ index, name, typeUuid }: Wire) => ({ index, name, typeUuid })),
      summarize(control, 'catalog').modules.map(({ index, name, typeUuid }: Wire) => ({ index, name, typeUuid })),
      'baseline-catalog-disagrees');
    const owners = new Map<string, string>();
    for (const m of catalogBefore) {
      const currentPath = modulePath(m.index);
      const membership = await pair(currentPath, member, `module-${m.index}-members-before`);
      if (!membership.complete) {
        const record = { ...m, complete: false }; chargeSummary(record); modules.push(record); continue;
      }
      const atoms = moduleAtoms(membership, m), paths = nodePaths(membership, currentPath);
      const selected = !focusModuleIndices || focusModuleIndices.includes(m.index);
      const reads: Wire[] = [];
      for (const atom of atoms) {
        assert.ok(!owners.has(atom.managedId), 'atom-shared-between-modules');
        owners.set(atom.managedId, m.uuid);
        if (!selected || !configured[atom.className]) continue;
        const atomPath = paths.get(atom.nodeId)!;
        const key = `${atom.className}:${atom.runtimeClass}`;
        if (!schemaKeys.has(key)) { await schema(atomPath); schemaKeys.add(key); }
        // Only the root and its connection records expand. Other atoms are identity leaves.
        const projection: Projection = { [atom.className]: configured[atom.className]! };
        for (const name of Object.keys(configured).filter(n =>
          ['component_settings', 'inport_connection'].includes(n) || /mapping|resource|reference/.test(n)))
          if (configured[name]) projection[name] = configured[name]!;
        const graph = await pair(atomPath, projection, `module-${m.index}-atom-${atom.index}`);
        if (!graph.complete) {
          const record = { ...atom, complete: false }; chargeSummary(record); reads.push(record); continue;
        }
        const root = graph.nodes.find((n: Wire) => n.id === graph.root);
        assert.equal(field(root, 14).value.data, atom.managedId, 'focused-atom-identity-changed');
        // Keep compact scalar/reference evidence; full captures remain on disk.
        const nodes = checkedNodes(graph);
        const record = { ...atom, complete: true, nodes: graph.nodes.map((n: Wire) => ({
          className: n.className, managedId: field(n, 14).value.data,
          identityOnly: n.properties.length === 1 && n.properties[0].id === 14,
          fields: n.properties.map((p: Wire) => p.refs ? { id: p.id, name: p.name,
            refs: p.refs.map((ref: number) => field(nodes.get(ref)!, 14).value.data) }
            : { id: p.id, name: p.name, value: p.value }),
        })) };
        chargeSummary(record);
        reads.push(record);
      }
      const after = await pair(currentPath, member, `module-${m.index}-members-after`);
      assert.equal(after.complete, true, 'focused-membership-recheck-incomplete');
      assert.deepEqual(after.nodes, membership.nodes, 'module-atoms-changed');
      const record = { ...m, complete: reads.every(r => r.complete), atoms, selected,
        identityOnlyAtoms: atoms.filter((a: Wire) => !selected || !configured[a.className]) };
      chargeSummary(record); modules.push({ ...record, reads });
    }
    const after = await inventory('catalog-after');
    assert.deepEqual(after, catalogBefore, 'grid-membership-changed');
    const result = { verdict: 'focused-reads-recorded', moduleCount: catalogBefore.length, modules,
      schemas, captures, limits, path, scope: 'Paired configured fields and session-local identities. '
        + 'Unknown related classes have identity fields only. This is not a complete graph or a write admission.' };
    save('focused-summary', result); return result;
  } finally {
    if (epoch) {
      const status = await request('probe.gridRead', { operation: 'status' });
      save('focused-status-before-release', status);
      if (!status.locked && !status.busy && !status.nativeUnfinished)
        await request('probe.gridRead', { operation: 'release', epoch });
    }
  }
}

export function validateFocusIndices(indices: unknown): asserts indices is number[] | undefined {
  if (indices === undefined) return;
  assert.ok(Array.isArray(indices) && indices.length > 0 && indices.length <= FOCUSED_LIMITS.modules
    && new Set(indices).size === indices.length
    && indices.every(i => Number.isInteger(i) && i >= 0 && i < FOCUSED_LIMITS.modules),
  'invalid-focus-module-indices');
}
