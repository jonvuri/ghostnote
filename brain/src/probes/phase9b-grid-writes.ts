/** Fixed 9b.3 cases. Commands and independent descriptor reads use separate requests. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSurvey } from './phase9b-grid-survey.js';
import type { Request, Wire } from './phase9b-grid-survey-read.js';

export const MARKER = '9b-grid-writes-v18';
const GATES = '8d644ad7-8d77-4f05-a36e-04a57f719635';
export const CASES = {
  boolean: { method: 'probe.gridValue', actions: ['boolean-enable', 'boolean-restore'] },
  mapping: { method: 'probe.gridCable', actions: ['mapping-remove', 'mapping-restore'] },
  factory: { method: 'probe.gridModuleFactory', actions: ['factory-create', 'factory-dispose'] },
} as const;
export type Case = keyof typeof CASES;
const atom = (fixture: Wire, module: number, index: number): Wire => fixture.modules[module].atoms[index];
function gates(module: Wire) {
  assert.equal(module.type, GATES); assert.equal(module.atoms.length, 17);
  const data = module.atoms[5].fields, phase = module.atoms[7];
  assert.equal(data['6613'], 64); assert.equal(data['6609'].length, 64);
  assert.ok(data['6609'].every((value: unknown) => typeof value === 'number' && Number.isFinite(value)));
  assert.equal(phase.class, 'boolean_value_atom'); assert.equal(phase.runtimeClass, 'QY');
  assert.equal(phase.fields['701'], 'DEVICE_PHASE'); assert.equal(typeof phase.fields['210'], 'boolean');
  for (const index of [4, 7, 9, 10]) assert.ok(Object.keys(module.atoms[index].fields).length >= 4);
}
export function selectedMapping(fixture: Wire): string | undefined {
  assert.equal(fixture.modules[13].type, '098ad9c6-b4c9-4ec1-887f-eaf588611056');
  assert.equal(fixture.modules[24].type, '2ddd3d4f-04b9-4ad5-a6f7-08e01df14c0f');
  const source = atom(fixture, 13, 1), target = atom(fixture, 24, 0);
  assert.equal(source.class, 'modulation_source_atom');
  assert.equal(source.runtimeClass, 'com.bitwig.flt.document.core.master.device.NDn');
  assert.equal(target.class, 'decimal_value_atom');
  const matches = Object.entries(fixture.mappings).filter(([, value]) => {
    const m = value as Wire;
    assert.equal(m.reference['65'].length, 1);
    return m.source === source.id && m.reference['65'][0] === target.id;
  });
  assert.ok(matches.length <= 1, 'ambiguous-selected-mapping');
  assert.deepEqual(source.fields['11497'], []);
  assert.equal(source.input.ports.length, 1);
  assert.deepEqual(source.input.ports[0]['248'], [atom(fixture, 13, 2).id]);
  assert.equal(source.input.ports[0]['249'], 0);
  if (!matches.length) return undefined;
  const [id, raw] = matches[0]!, m = raw as Wire;
  assert.equal(source.fields['3616'].filter((v: string) => v === id).length, 1);
  assert.equal(target.fields['3615'].filter((v: string) => v === id).length, 1);
  assert.equal(m['3611'], 129); assert.equal(m['11481'], true); assert.equal(m['11338'], 'LINEAR');
  assert.equal(m['3638'], true); assert.equal(m['11509'], false); assert.equal(m['11913'], false);
  assert.deepEqual(m['11503'], []);
  return id;
}
export function transformMapping(fixture: Wire, id: string, normalize: boolean): Wire {
  const next = structuredClone(fixture), mapping = next.mappings[id];
  assert.ok(mapping); delete next.mappings[id];
  for (const m of next.modules) for (const a of m.atoms ?? []) {
    for (const field of ['3615', '3616', '11497']) {
      const values = a.fields[field] as string[] | undefined;
      if (values?.includes(id)) {
        a.fields[field] = values.filter(v => v !== id);
        if (normalize) a.fields[field].push('$selected-mapping');
      }
    }
  }
  if (normalize) {
    mapping.reference.id = '$selected-reference'; next.mappings['$selected-mapping'] = mapping;
  }
  return next;
}
function identities(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string') result.add(value);
  else if (Array.isArray(value)) value.forEach(v => identities(v, result));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) {
    result.add(k); identities(v, result);
  }
  return result;
}
export function validateSnapshot(initial: Wire, actual: Wire, kind: Case, stage: number) {
  assert.equal(actual.witness.editIdle, true); assert.equal(actual.witness.parentsVerified, true);
  assert.deepEqual(actual.witness, initial.witness);
  const base = initial.fixture, next = actual.fixture;
  assert.ok(base.modules.length <= 64 && new Set(base.modules.map((m: Wire) => m.uuid)).size === base.modules.length);
  if (kind === 'mapping') {
    const oldId = selectedMapping(base); assert.ok(oldId);
    if (stage === 1) {
      assert.equal(selectedMapping(next), undefined);
      assert.deepEqual(next, transformMapping(base, oldId, false));
    } else if (stage === 2) {
      const newId = selectedMapping(next); assert.ok(newId);
      const ref = next.mappings[newId].reference.id, prior = identities(base);
      assert.ok(!prior.has(newId) && !prior.has(ref) && newId !== ref, 'restored-identities-must-be-new');
      assert.deepEqual(transformMapping(next, newId, true), transformMapping(base, oldId, true));
    } else assert.deepEqual(next, base);
  } else {
    gates(base.modules[9]); assert.equal(atom(base, 9, 7).fields['210'], false);
    const expected = structuredClone(base);
    if (kind === 'boolean') atom(expected, 9, 7).fields['210'] = stage === 1;
    assert.deepEqual(next, expected, 'fixture-readback-differs');
  }
  if (kind === 'factory' && stage === 1) {
    const detached = actual.detached; gates(detached.module);
    assert.ok(!base.modules.some((m: Wire) => m.uuid === detached.module.uuid));
    assert.ok(Number.isInteger(detached.ownedObjects) && detached.ownedObjects > 0 && detached.ownedObjects <= 256);
    assert.deepEqual(detached.mappings, {});
    for (const a of detached.module.atoms) if ('7125' in a.fields) assert.deepEqual(a.fields['7125'], []);
    assert.equal(actual.disposed, undefined);
  } else {
    assert.equal(actual.detached, undefined);
    assert.equal(actual.disposed, kind === 'factory' && stage === 2 ? true : undefined);
  }
}
export async function runBreadth(request: Request, target: Wire, candidate: Wire,
  save: (name: string, value: unknown) => void): Promise<Wire> {
  assert.ok(Object.hasOwn(CASES, candidate.case), 'unsupported-write-case');
  const kind = candidate.case as Case, plan = CASES[kind];
  assert.equal(target.deviceName, 'Poly Grid');
  const status = await request('probe.gridRead', { operation: 'breadthStatus' });
  assert.equal(status.marker, MARKER);
  assert.ok(!status.bound && !status.busy && !status.locked && !status.timeoutLocked
    && !status.nativeUnfinished && !status.foreignOwner);
  let session: string | undefined, initial: Wire | undefined, attempted = false, calls = 0;
  const call = async (method: string, params: Wire) => {
    const result = await request(method, params); calls++;
    save(`breadth-${calls}-${params.operation}`, result);
    assert.ok(!result.status?.locked && !result.status?.finished, 'writer-locked');
    return result;
  };
  try {
    const selection = await request('selection.status');
    const bound = await call('probe.gridRead', { ...target, operation: 'breadthBind',
      case: kind, selectionRevision: selection.revision });
    assert.equal(bound.marker, MARKER);
    assert.equal(typeof bound.session, 'string'); session = bound.session;
    for (let stage = 0; stage <= 2; stage++) {
      let pair: Wire | undefined;
      for (let i = 0; i < 2; i++) {
        const result = await call('probe.gridRead', { operation: 'breadthRead', session });
        assert.equal(result.marker, MARKER); assert.equal(result.session, session);
        const snapshot = result.snapshot;
        initial ??= structuredClone(snapshot);
        validateSnapshot(initial!, snapshot, kind, stage);
        if (pair) assert.deepEqual(snapshot, pair, 'independent-pair-disagrees');
        pair = snapshot;
      }
      if (stage < 2) {
        attempted = true;
        const result = await call(plan.method, { operation: 'breadthCommand', session, action: plan.actions[stage] });
        assert.equal(result.receipt.commandReturned, true);
        assert.equal(result.receipt.readback, 'pending-independent-pair');
      }
    }
    await call('probe.gridRead', { operation: 'breadthRelease', session });
    const released = await request('probe.gridRead', { operation: 'breadthStatus' }); save('breadth-released', released);
    assert.ok(!released.bound && !released.busy && !released.locked && !released.timeoutLocked && !released.nativeUnfinished);
    return { case: kind, verdict: 'passed', protocolCalls: calls,
      ...(kind === 'factory' ? { attachment: 'refused: Amplify-specific lifecycle guards do not admit Gates' } : {}) };
  } catch (error) {
    save('breadth-failure', { error: String(error), session, attempted, protocolCalls: calls });
    const state = await request('probe.gridRead', { operation: 'breadthStatus' }); save('breadth-failure-status', state);
    // Inspection cannot clear the lock or authorize another command.
    if (session && state.locked && !state.busy && !state.nativeUnfinished) {
      for (let i = 0; i < 2; i++) {
        try { save(`breadth-inspection-${i}`, await request('probe.gridRead', { operation: 'breadthInspect', session })); }
        catch (inspection) { save(`breadth-inspection-error-${i}`, { error: String(inspection) }); break; }
      }
    }
    const noNativeCommand = state.commands === 0 || (!attempted && !session && !state.bound);
    if (noNativeCommand && !state.busy && !state.nativeUnfinished && !state.timeoutLocked) {
      if (session) await request('probe.gridRead', { operation: 'breadthRelease', session, cancel: true });
      else assert.ok(!state.bound, 'unknown-binding-retained');
      const released = await request('probe.gridRead', { operation: 'breadthStatus' });
      assert.ok(!released.bound && !released.busy && !released.locked && !released.timeoutLocked && !released.nativeUnfinished);
      return { case: kind, verdict: 'refused-before-command', error: String(error), protocolCalls: calls };
    }
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [project, output, scope] = process.argv.slice(2);
  assert.ok(scope === undefined || scope === 'factory-only', 'Unknown write scope');
  assert.ok(process.argv.length <= 5, 'Unexpected write arguments');
  assert.equal(project, 'gn-grid-spike', 'Use the agreed project');
  const plan = join(import.meta.dirname, '../../../context/evidence/data/phase9b-writes',
    scope === 'factory-only' ? 'factory-only-plan.json' : 'write-plan.json');
  const list = JSON.parse(readFileSync(plan, 'utf8'));
  assert.deepEqual(list.candidates.map((c: Wire) => c.case),
    scope === 'factory-only' ? ['factory'] : ['boolean', 'mapping', 'factory']);
  await runSurvey([project, output!, plan], { run: runBreadth });
}
