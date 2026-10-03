/** Check native group controls against direct membership and independent note reads. */
import assert from 'node:assert/strict';
import { closed, independentNotes, NATIVE_MARKER, noPayload, verifyComparison, verifyTopology, type Wire } from './phase8g4-native-lib.js';
import { sceneRows } from './phase8g-ui-scene-controls.js';
export const GROUP_LABELS = ['plain', 'expanded', 'collapsed', 'nested', 'child-moved', 'restored'] as const;
export function verifyNativeTopologyReport(report: Wire): Wire {
  assert.equal(report.schema, 'phase8g4-native-topology-v1'); assert.equal(report.marker, NATIVE_MARKER);
  assert.equal(report.stage, 'finished'); assert.equal(report.researchOnly, true); closed(report);
  assert.equal(report.wrapperDeleted, false); assert.equal(report.fixtureRestored, true); assert.equal(report.error, undefined);
  const state = report.source as Wire; verifyComparison(report.baseline as Wire, state); verifyComparison(report.recovery as Wire, state);
  assert.equal((report.recovery as Wire).initDomain, (report.baseline as Wire).initDomain);
  const captures = report.captures as Wire[]; assert(Array.isArray(captures)); assert(captures.length >= 3);
  assert.equal(captures[0]!.label, 'plain'); assert.equal(captures.at(-1)!.label, 'restored');
  assert.equal(sceneRows(captures[0]!.scenes as Wire).length, 8);
  const original = ((state.tracks as Wire).tracks as Wire[]), roots = original.map(t => String(t.channelId));
  assert.equal(roots.length, 4); const [a, b, fx, master] = roots as [string, string, string, string];
  verifyTopology(captures[0]!.topology as Wire, { roots, children: {} });
  verifyTopology(captures.at(-1)!.topology as Wire, { roots, children: {} });
  assert.deepEqual(captures.at(-1)!.tracks, state.tracks); assert.deepEqual(report.finalTracks, state.tracks);
  assert.equal(report.finalScenes, 8);
  for (const capture of captures) {
    assert.equal(capture.project, state.project); closed(capture.info as Wire);
    assert.equal((capture.info as Wire).instrumentationRevision, NATIVE_MARKER);
    assert.equal((capture.info as Wire).initDomain, (report.baseline as Wire).initDomain);
    assert.deepEqual(independentNotes(capture.notes as Wire), independentNotes(state.notes as Wire));
    assert.deepEqual(capture.metadata, state.metadata); assert.deepEqual(sceneRows(capture.scenes as Wire), sceneRows(captures[0]!.scenes as Wire));
    const tracks = (capture.tracks as Wire).tracks as Wire[];
    assert.equal(capture.readerError, undefined);
    const flat = ((capture.topology as Wire).tree as Wire).flat as Wire[];
    assert.deepEqual(flat.map(t => [t.channelId, t.name, t.position]), tracks.map(t => [t.channelId, t.name, t.position]));
    assert.deepEqual(flat.map(t => t.isGroup), tracks.map(t => t.type === 'Group'));
    for (const id of [fx, master]) {
      const expected = original.find(t => t.channelId === id)!, actual = tracks.find(t => t.channelId === id)!; assert(actual);
      for (const field of ['channelId', 'name', 'type']) assert.equal(actual[field], expected[field], 'unrelated track changed');
    }
    if (!['plain', 'restored'].includes(String(capture.label))) {
      const status = capture.status as Wire; closed(status); noPayload(status); assert.equal(status.phase, 'retired');
    }
  }
  const commands = report.commands as Wire[]; assert(Array.isArray(commands));
  const operations = commands.map(command => {
    assert.equal(command.project, state.project); assert.equal(command.completed, true);
    assert.equal(typeof command.started, 'string'); assert.equal(typeof command.ended, 'string');
    assert(Date.parse(String(command.ended)) >= Date.parse(String(command.started))); return command.operation;
  });
  const diagnostics = (report.commandDiagnostics ?? []) as Wire[]; assert(Array.isArray(diagnostics));
  for (const command of diagnostics) {
    assert.equal(command.operation, 'ungroup-selected-track'); assert.equal(command.project, state.project);
    assert.equal(command.completed, true); assert.equal(command.effectObserved, false); assert.equal(typeof command.reason, 'string');
    assert(Number.isFinite(Date.parse(String(command.started)))); assert(Date.parse(String(command.ended)) >= Date.parse(String(command.started)));
  }
  if (report.membershipScope === 'unsupported') {
    assert.deepEqual(captures.map(c => c.label), ['plain', 'unsupported', 'restored']);
    const unsupported = captures[1]!.topology as Wire; closed(unsupported);
    assert.equal(unsupported.membershipComplete, false); assert.equal(unsupported.groupMembershipProved, false);
    assert.equal(unsupported.wrapperDeletionAllowed, false); assert.equal(typeof unsupported.readError, 'string');
    assert.equal(unsupported.coherent, false); assert.equal(unsupported.hostInputOrderingProved, false);
    const reader = captures[1]!.readerStatus as Wire;
    assert.equal(reader.trackName, original[0]!.name); assert.equal(reader.slotName, state.clipName);
    assert.equal(reader.slotExists, true); assert.equal(reader.sceneIndex, 0);
    const candidate: Wire = { ...unsupported, coherent: true, membershipComplete: true, groupMembershipProved: true };
    delete candidate.readError;
    assert.throws(() => verifyTopology(candidate), 'the reported graph must independently fail membership checks');
    assert.deepEqual(operations, ['group-selected-tracks', 'ungroup-selected-track']);
    return { supportedGroupCases: 0, unsupportedGroupCases: 1, reason: unsupported.reason, actions: 2,
      diagnosticCommandAttempts: diagnostics.length,
      expandedCollapsedNestedAndChildOrderProved: false, fixtureRestored: true, complete: false, eligible: false };
  }
  assert.equal(report.membershipScope, 'bounded-direct-banks'); assert.deepEqual(captures.map(c => c.label), [...GROUP_LABELS]);
  const outer = String(report.outerId), inner = String(report.innerId); assert(!roots.includes(outer) && !roots.includes(inner)); assert.notEqual(outer, inner);
  const expected = [
    { roots: [outer, fx, master], children: { [outer]: [a, b] } },
    { roots: [outer, fx, master], children: { [outer]: [a, b] } },
    { roots: [outer, fx, master], children: { [outer]: [inner, b], [inner]: [a] } },
    { roots: [outer, fx, master], children: { [outer]: [b, inner], [inner]: [a] } },
  ];
  for (let index = 0; index < expected.length; index++) verifyTopology(captures[index + 1]!.topology as Wire, expected[index]);
  const expanded = verifyTopology(captures[1]!.topology as Wire), collapsed = verifyTopology(captures[2]!.topology as Wire);
  assert.equal(expanded.flat.find(t => t.channelId === outer)!.expanded, true);
  assert.equal(collapsed.flat.find(t => t.channelId === outer)!.expanded, false);
  assert.deepEqual(operations, ['group-selected-tracks', 'collapse-group', 'group-selected-track', 'move-child-before-sibling',
    'restore-child-order', 'ungroup-selected-track', 'ungroup-selected-track']);
  return { supportedGroupCases: 4, unsupportedGroupCases: 0, actions: operations.length,
    diagnosticCommandAttempts: diagnostics.length,
    expandedCollapsedNestedAndChildOrderProved: true, fixtureRestored: true, complete: false, eligible: false };
}
