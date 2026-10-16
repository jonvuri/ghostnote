/**
 * Measure document files without connecting to Bitwig (8i19). Compare the inline and file results of one MIDI file
 * and of a generated 16,384-note case. Only sizes, hashes, and times leave the temporary directory.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parse, type StateDocument } from '../document/index.js';
import { exportMidi } from '../midi/conversion.js';
import { midiDocument } from '../midi/fixtures.js';
import { publishDocumentFile, readDocumentFile } from '../surface/document-files.js';
import { AGENT_NATIVE_TOOL_PROFILE, callTool } from '../surface/tools.js';
import type { Workspace } from '../surface/workspace.js';

type Wire = Record<string, any>;
const [source] = process.argv.slice(2);
if (!source || !isAbsolute(source)) throw new Error('Usage: phase8i19-document-files.ts <absolute MIDI file>');
const offline = new Proxy({} as Workspace, { get(_target, key) { throw new Error(`Host access: ${String(key)}`); } });
const directory = await mkdtemp(join(tmpdir(), 'gn-document-files-'));
const call = async (name: string, args: Wire) => {
  const start = performance.now();
  const result = await callTool(offline, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure) throw new Error(JSON.stringify(result));
  return { result, ms: performance.now() - start, bytes: Buffer.byteLength(JSON.stringify(result)) };
};
const notes = (d: StateDocument) => d.events.map(({ id, clip, ...note }) => note);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

async function measure(name: string, path: string, index: number) {
  const inline = await call('read_midi_file', { path });
  const documentPath = join(directory, `${index}.gndoc`);
  const filed = await call('read_midi_file', { path, documentOutputPath: documentPath });
  if (await readFile(documentPath, 'utf8') !== inline.result.data.document) throw new Error('File and inline documents differ.');
  const output = join(directory, `${index}.mid`);
  const write = await call('write_midi_file', { path: output, documentPath });
  const recovered = parse((await call('read_midi_file', { path: output })).result.data.document, 'fields') as StateDocument;
  const original = parse(inline.result.data.document, 'fields') as StateDocument;
  if (JSON.stringify(notes(original)) !== JSON.stringify(notes(recovered))) throw new Error('Notes did not round-trip.');
  // The file stages alone, repeated: the added cost of a file input or output on a live path.
  const reads: number[] = [], publishes: number[] = [];
  for (let k = 0; k < 5; k += 1) {
    let start = performance.now(); await readDocumentFile(documentPath); reads.push(performance.now() - start);
    start = performance.now();
    await publishDocumentFile('measure', join(directory, `${index}-${k}.gndoc`), inline.result.data.document, 'fields');
    publishes.push(performance.now() - start);
  }
  return { case: name, notes: original.events.length, sourceSha256: inline.result.source.sha256,
    documentBytes: inline.result.data.documentBytes, documentSha256: inline.result.authority.documentSha256,
    inlineResultBytes: inline.bytes, fileResultBytes: filed.bytes, inlineReadMs: inline.ms, fileReadMs: filed.ms,
    fileReadback: filed.result.data.documentFile.readback.status, writeFromFileMs: write.ms,
    writeResultBytes: write.bytes, writeReadback: write.result.readback.status, noteRoundTrip: true,
    documentFileReadMedianMs: median(reads), documentFilePublishMedianMs: median(publishes) };
}

try {
  await writeFile(join(directory, 'maximum.mid'), exportMidi(midiDocument(16384)).bytes);
  const results = [await measure('source', source, 0), await measure('generated-16384-notes', join(directory, 'maximum.mid'), 1)];
  console.log(JSON.stringify({ version: '8i19-document-files-v1', date: new Date().toISOString(), node: process.version,
    hostCalls: 0, results }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
