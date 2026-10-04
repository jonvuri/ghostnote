/**
 * E218 pure analysis: live acceptance of the 8g2b step-delta read window.
 * P witness notes use pitch 60. Q witness notes use pitch 72. Research only.
 */
import assert from 'node:assert/strict';

type Wire = Record<string, unknown>;
export const E218_MARKER = 'e218-step-delta-acceptance-v1';
export const SHADOW_MARKER = '8g2b-shadow-step-delta-v1';
export const ROOT_MARKER = '8g2b-root-step-delta-v1';
/** 8g5 reruns selected arms on the final 8g5c build. Its root marker is unchanged. */
export const FINAL_SHADOW_MARKER = '8g5c-combined-storage-v4';
export const P_PITCH = 60, Q_PITCH = 72;
export interface NoteKey { channel: number; cell: number; pitch: number }

export function noteKeys(notes: unknown): NoteKey[] {
  if (!Array.isArray(notes)) return [];
  return (notes as Wire[]).map(n => ({ channel: Number(n.channel), cell: Number(n.cell), pitch: Number(n.pitch) }))
    .sort((a, b) => a.cell - b.cell || a.pitch - b.pitch || a.channel - b.channel);
}

/** Every content output that a route exposed. A refusal exposes none. */
export function publishedOutputs(row: Wire): { route: string; notes: NoteKey[] }[] {
  const outputs: { route: string; notes: NoteKey[] }[] = [];
  const compare = row.compare as Wire | undefined, status = row.status as Wire | undefined, exact = row.exact as Wire | undefined;
  if (compare?.authorityNotes) outputs.push({ route: 'compare-authority', notes: noteKeys(compare.authorityNotes) });
  if (compare?.diagnosticSnapshot) outputs.push({ route: 'compare-snapshot', notes: noteKeys((compare.diagnosticSnapshot as Wire).notes) });
  if (status?.historicalSnapshot) outputs.push({ route: 'retained-snapshot', notes: noteKeys((status.historicalSnapshot as Wire).notes) });
  const after = row.statusAfter as Wire | undefined;
  if (after?.historicalSnapshot) outputs.push({ route: 'retained-after-detour', notes: noteKeys((after.historicalSnapshot as Wire).notes) });
  const exactAfter = row.exactAfter as Wire | undefined;
  if (exactAfter?.authorityNotes) outputs.push({ route: 'exact-retained-after-detour', notes: noteKeys(exactAfter.authorityNotes) });
  if (exact?.authorityNotes) outputs.push({ route: 'exact-authority', notes: noteKeys(exact.authorityNotes) });
  return outputs;
}

/**
 * Classify one trial. Foreign content is any Q-pitch note or any published set
 * that differs from the independent settled authority read after return to P.
 */
export function classifyTrial(row: Wire): Wire {
  const independent = noteKeys((row.independent as Wire | undefined)?.authorityNotes);
  const independentOk = (row.independent as Wire | undefined)?.authorityAvailable === true
    && independent.length > 0 && independent.every(n => n.pitch === P_PITCH);
  const outputs = publishedOutputs(row);
  const foreign = outputs.filter(o => o.notes.some(n => n.pitch === Q_PITCH));
  const differs = outputs.filter(o => JSON.stringify(o.notes) !== JSON.stringify(independent));
  const compare = row.compare as Wire | undefined, exact = row.exact as Wire | undefined;
  const refusal = row.refusal as string | undefined
    // A terminal comparison names its own refusal. Its reason field can be a generic status.
    ?? (compare && !compare.authorityNotes ? String(compare.comparison && compare.comparison !== 'pending' ? compare.comparison : compare.reason) : undefined)
    ?? (exact && !exact.authorityNotes ? String(exact.reason) : undefined);
  return { outputs: outputs.map(o => o.route), published: outputs.length, foreignOutputs: foreign.length,
    outputsDifferingFromAuthority: differs.length, independentOk, refusal: refusal ?? null,
    comparison: compare?.comparison ?? null, stepWindowConfirmed: compare?.stepWindowConfirmed === true,
    endpoint: row.endpoint ?? null, injected: row.injected === true, hostFenceProved: false };
}

export function aggregateArm(rows: Wire[]): Wire {
  const summaries = rows.map(r => r.summary as Wire);
  const refusals: Record<string, number> = {};
  for (const s of summaries) if (s.refusal) refusals[String(s.refusal)] = (refusals[String(s.refusal)] ?? 0) + 1;
  const count = (f: (s: Wire) => boolean): number => summaries.filter(f).length;
  return { trials: rows.length, injected: count(s => s.injected === true),
    published: count(s => Number(s.published) > 0), refused: count(s => s.refusal !== null),
    matches: count(s => s.comparison === 'match'), confirmedComparisons: count(s => s.stepWindowConfirmed === true),
    foreignOutputs: summaries.reduce((n, s) => n + Number(s.foreignOutputs), 0),
    outputsDifferingFromAuthority: summaries.reduce((n, s) => n + Number(s.outputsDifferingFromAuthority), 0),
    independentFailures: count(s => s.independentOk !== true), refusals, eligible: false, hostFenceProved: false };
}

export function checkReport(report: Wire): void {
  assert.equal(report.marker, E218_MARKER);
  assert([SHADOW_MARKER, FINAL_SHADOW_MARKER].includes(String(report.shadowMarker)), 'unknown shadow build');
  assert.equal(report.eligible, false); assert.equal(report.complete, false); assert.equal(report.hostFenceProved, false);
}
