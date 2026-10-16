/**
 * Measure the bounded tempo report without connecting to Bitwig (8i20). For each MIDI file: the inline and file
 * result sizes, the tempo summary, and an export round trip of the notes, the tempo overlays, and the realized
 * timing. Only sizes, counts, hashes, and times leave the temporary directory.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { parse, type StateDocument } from '../document/index.js';
import { importMidi } from '../midi/conversion.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import type { Workspace } from '../surface/workspace.js';

type Wire = Record<string, any>;
const sources = process.argv.slice(2);
if (sources.length === 0 || !sources.every(isAbsolute)) throw new Error('Usage: phase8i20-tempo-report.ts <absolute MIDI file>...');
const offline = new Proxy({} as Workspace, { get(_target, key) { throw new Error(`Host access: ${String(key)}`); } });
const directory = await mkdtemp(join(tmpdir(), 'gn-tempo-report-'));
const call = async (name: string, args: Wire) => {
  const start = performance.now();
  const result = await callTool(offline, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure) throw new Error(JSON.stringify(result));
  return { result, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) };
};
const notes = (d: StateDocument) => d.events.map(({ id, clip, ...note }) => note);
const tempos = (d: StateDocument) => d.overlays.flatMap(o => o.type === 'tempo' ? [{ at: o.data.at, bpm: o.data.bpm }] : []);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const value = (spelled: string) => { const [n, d = '1'] = spelled.split('/'); return Number(n) / Number(d); };

try {
  const results = [];
  for (const [index, path] of sources.entries()) {
    const inline = await call('read_midi_file', { path });
    const filed = await call('read_midi_file', { path, documentOutputPath: join(directory, `${index}.gndoc`) });
    const output = join(directory, `${index}.mid`);
    await call('write_midi_file', { path: output, documentPath: join(directory, `${index}.gndoc`) });
    const original = parse(inline.result.data.document, 'fields') as StateDocument;
    const recovered = parse((await call('read_midi_file', { path: output })).result.data.document, 'fields') as StateDocument;
    // Realized timing: a 1000 BPM target-tempo import measures seconds in cells of 0.117 ms. The export differs from
    // the source only by the R07 normalization of the read (1/512 beat at the source tempo); a tempo-map change would
    // add to it.
    const [source, exported] = await Promise.all([readFile(path), readFile(output)]);
    const seconds = (bytes: Buffer) => importMidi(bytes, { targetBpm: 1000 }).document.events
      .map(e => [value(e.at) * 0.06, (value(e.at) + value(e.duration)) * 0.06]);
    const before = seconds(source), after = seconds(exported);
    if (before.length !== after.length) throw new Error('The export has another note count.');
    const maxOnsetDeviationMs = Math.max(0, ...before.map((t, i) => Math.abs(t[0]! - after[i]![0]!) * 1000));
    const maxEndDeviationMs = Math.max(0, ...before.map((t, i) => Math.abs(t[1]! - after[i]![1]!) * 1000));
    const roundTrip = { notes: same(notes(original), notes(recovered)), tempoOverlays: same(tempos(original), tempos(recovered)),
      maxOnsetDeviationMs, maxEndDeviationMs };
    if (!roundTrip.notes || !roundTrip.tempoOverlays) throw new Error(`Round trip failed: ${JSON.stringify(roundTrip)}`);
    results.push({ file: `${basename(dirname(dirname(path)))}/${basename(dirname(path))}/${basename(path)}`,
      sourceSha256: inline.result.source.sha256, notes: original.events.length, sourceTempo: inline.result.data.report.sourceTempo,
      tempoOverlays: tempos(original).length, inlineResultBytes: inline.bytes, fileResultBytes: filed.bytes,
      reportBytes: Buffer.byteLength(JSON.stringify(inline.result.data.report)), documentBytes: inline.result.data.documentBytes,
      inlineReadMs: inline.ms, fileReadMs: filed.ms, roundTrip });
  }
  console.log(JSON.stringify({ version: '8i20-tempo-report-v1', date: new Date().toISOString(), node: process.version,
    hostCalls: 0, results }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
