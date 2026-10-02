/** E216 pure analysis. These summaries describe delivered controller state. They are not host fences. */
import assert from 'node:assert/strict';

type Wire = Record<string, unknown>;
export const E216_MARKER = 'e216-delivery-coherence-v1';
export type Side = 'P' | 'Q';
export interface SideIdentity { name: string; root: string; cursor: string }
export interface Identities { P: SideIdentity; Q: SideIdentity }
export interface Signature { name: string; root: string; cursor: string; clip: boolean; wP: string; wQ: string; mute: boolean; scratch: string }

export function parseSignature(value: string): Signature {
  const parts = value.split('|'); assert.equal(parts.length, 8, `bad signature: ${value}`);
  const [name, root, cursor, clip, wP, wQ, mute, scratch] = parts as [string, string, string, string, string, string, string, string];
  return { name, root, cursor, clip: clip === 'C', wP, wQ, mute: mute === 'M', scratch };
}
function sideBy(identities: Identities, key: keyof SideIdentity, value: string): Side | 'other' {
  return identities.P[key] === value ? 'P' : identities.Q[key] === value ? 'Q' : 'other';
}
export function witnessClass(sig: Signature): Side | 'empty' | 'mixed' {
  if (sig.wP === 'NNNN' && sig.wQ === '....') return 'P';
  if (sig.wP === '....' && sig.wQ === 'NNNN') return 'Q';
  return sig.wP === '....' && sig.wQ === '....' ? 'empty' : 'mixed';
}
/** Classify one tick. Foreign content means a delivered identity with the other side's notes. */
export interface TickClass { byName: string; byRoot: string; byCursor: string; witness: string; project: string; foreignContent: boolean; coherent: boolean }
export function classifyTick(sig: Signature, identities: Identities): TickClass {
  const byName = sideBy(identities, 'name', sig.name), byRoot = sideBy(identities, 'root', sig.root);
  const byCursor = sideBy(identities, 'cursor', sig.cursor), witness = sig.clip ? witnessClass(sig) : 'no-clip';
  const project = byName === byRoot ? byName : 'split';
  const foreignContent = (project === 'P' || project === 'Q') && (witness === 'P' || witness === 'Q') && witness !== project;
  const coherent = project !== 'split' && project !== 'other' && byCursor === project && witness === project;
  return { byName, byRoot, byCursor, witness, project, foreignContent, coherent };
}

function sorted(trace: Wire): Wire[] {
  const all = [...trace.events as Wire[], ...trace.ticks as Wire[], ...trace.commands as Wire[]];
  return all.sort((a, b) => Number(a.seq) - Number(b.seq));
}

/** Summarize one P→Q→P detour. `unseen` requires a P endpoint and no delivered Q value. */
export function summarizeDetour(trace: Wire, identities: Identities, finalSignature: string): Wire {
  assert.equal(trace.marker, E216_MARKER);
  const records = sorted(trace), invokes = records.filter(r => r.kind === 'command' && r.op === 'invoked');
  assert(invokes.length >= 2, 'detour needs two invocations');
  const firstUs = Number(invokes[0]!.us), lastUs = Number(invokes.at(-1)!.us);
  const after = records.filter(r => Number(r.seq) > Number(invokes[0]!.seq));
  const values = after.filter(r => r.kind === 'value');
  const qName = values.filter(r => r.name === 'projectName' && r.value === identities.Q.name);
  const qRoot = values.filter(r => r.name === 'rootChannelId' && r.value === identities.Q.root);
  const qCursor = values.filter(r => r.name === 'cursorChannelId' && r.value === identities.Q.cursor);
  const tickClasses = after.filter(r => r.kind === 'tick').map(r => ({ seq: r.seq, us: r.us, end: r.end !== undefined,
    ...classifyTick(parseSignature(String(r.start)), identities) }));
  const qTicks = tickClasses.filter(t => t.project === 'Q');
  const final = classifyTick(parseSignature(finalSignature), identities);
  const errors = records.filter(r => r.kind === 'command' && r.op === 'error');
  const firstQ = [...qName, ...qRoot].sort((a, b) => Number(a.us) - Number(b.us))[0];
  const deliveredQ = qName.length + qRoot.length > 0;
  const outcome = errors.length ? 'command-error' : final.project !== 'P' ? 'endpoint-not-P' : deliveredQ ? 'seen' : 'unseen-endpoint-P';
  return {
    outcome, invocations: invokes.length, invokeSpanUs: lastUs - firstUs,
    qProjectNameEvents: qName.length, qRootEvents: qRoot.length, qCursorEvents: qCursor.length, qTicks: qTicks.length,
    firstQDeliveryAfterInvokeUs: firstQ ? Number(firstQ.us) - firstUs : null,
    projectNameEvents: values.filter(r => r.name === 'projectName').length,
    stepEvents: after.filter(r => r.kind === 'stepData').length,
    qWitnessOnStepEvents: after.filter(r => r.kind === 'stepData' && r.y === 12 && Number(r.x) >= 8 && Number(r.x) < 12 && r.state === 2).length,
    rootEvents: values.filter(r => r.name === 'rootChannelId').length,
    ticks: tickClasses.length, inTickChanges: tickClasses.filter(t => t.end).length,
    splitIdentityTicks: tickClasses.filter(t => t.project === 'split').length,
    foreignContentTicks: tickClasses.filter(t => t.foreignContent).length,
    incoherentKnownTicks: tickClasses.filter(t => !t.coherent && t.project !== 'other').length,
    finalProject: final.project, finalCoherent: final.coherent,
    eventsDropped: trace.eventsDropped, ticksDropped: trace.ticksDropped, hostFenceProved: false,
  };
}

/** Summarize a toggle arm. Equal endpoints with zero delivered changes indicate coalescing. */
export function summarizeToggle(trace: Wire, kind: 'mute' | 'scratchStep', initial: Signature, finalSignature: string): Wire {
  assert.equal(trace.marker, E216_MARKER);
  const records = sorted(trace), issued = records.filter(r => r.kind === 'command' && r.op === kind);
  const errors = records.filter(r => r.kind === 'command' && r.op === 'error');
  const first = issued[0]; assert(first || errors.length, 'toggle arm issued no command');
  const after = first ? records.filter(r => Number(r.seq) > Number(first.seq)) : [];
  const delivered = kind === 'mute'
    ? after.filter(r => r.kind === 'value' && r.name === 'cursorMute')
    : after.filter(r => r.kind === 'stepData' && r.x === 15 && r.y === 6);
  const final = parseSignature(finalSignature);
  const toggles = issued.reduce((sum, r) => sum + Number((r.step as Wire).count), 0);
  return { kind, outcome: errors.length ? 'command-error' : 'measured', issuedCallbacks: issued.length, toggles,
    deliveredChanges: delivered.length, deliveredValues: delivered.map(r => kind === 'mute' ? r.value : r.state),
    endpointRestored: kind === 'mute' ? final.mute === initial.mute : final.scratch === initial.scratch,
    coalesced: toggles > 0 && delivered.length < toggles, hostFenceProved: false };
}

/** Summarize a spin arm: did delivered state change inside one held callback? */
export function summarizeSpin(trace: Wire): Wire {
  assert.equal(trace.marker, E216_MARKER);
  const spins = (trace.commands as Wire[]).filter(r => r.op === 'spin');
  return { spins: spins.length, reads: spins.map(s => s.reads), changesInsideCallback: spins.reduce((n, s) => n + (s.changes as Wire[]).length, 0),
    eventsDuringSpin: spins.reduce((n, s) => n + Number(s.eventsDuringSpin), 0), hostFenceProved: false };
}

/** A command that never yields a delivered change is not a callback loss unless the endpoint proves it happened. */
export function aggregateDetours(rows: Wire[]): Wire {
  const byDwell = new Map<string, Wire[]>();
  for (const row of rows) { const key = String(row.dwell); byDwell.set(key, [...(byDwell.get(key) ?? []), row]); }
  const table = [...byDwell.entries()].map(([dwell, items]) => {
    const count = (o: string) => items.filter(i => (i.summary as Wire).outcome === o).length;
    return { dwell, trials: items.length, seen: count('seen'), unseenEndpointP: count('unseen-endpoint-P'),
      endpointNotP: count('endpoint-not-P'), commandError: count('command-error'),
      foreignContentTicks: items.reduce((n, i) => n + Number((i.summary as Wire).foreignContentTicks), 0),
      inTickChanges: items.reduce((n, i) => n + Number((i.summary as Wire).inTickChanges), 0) };
  });
  return { table, unseenTotal: table.reduce((n, r) => n + r.unseenEndpointP, 0),
    foreignContentTotal: table.reduce((n, r) => n + r.foreignContentTicks, 0), hostFenceProved: false };
}
