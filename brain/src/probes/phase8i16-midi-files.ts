/** Verify local MIDI conversion without connecting to Bitwig. Only aggregate results leave the temporary directory. */
import { mkdtemp, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { callTool, AGENT_NATIVE_TOOL_PROFILE } from '../surface/tools.js';
import type { Workspace } from '../surface/workspace.js';
import { parse, type StateDocument } from '../document/index.js';
import { exportMidi } from '../midi/conversion.js';
import { midiDocument } from '../midi/fixtures.js';

type Wire = Record<string, any>;
const [root] = process.argv.slice(2);
if (!root || !isAbsolute(root)) throw new Error('Usage: phase8i16-midi-files.ts <absolute MIDI directory>');
const offline = new Proxy({} as Workspace, { get(_target, key) { throw new Error(`Host access: ${String(key)}`); } });
const directory = await mkdtemp(join(tmpdir(), 'gn-midi-accept-'));
const results: Wire[] = [];
const call = async (name: string, args: Wire) => {
  const start = performance.now();
  const result = await callTool(offline, name, args, AGENT_NATIVE_TOOL_PROFILE) as Wire;
  if (result.failure) throw new Error(JSON.stringify(result));
  return { result, ms: performance.now() - start };
};
const notes = (d: StateDocument) => d.events.map(({ id, clip, ...note }) => note);
async function midiFiles(path: string, prefix = ''): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = [];
  for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(path, entry.name), name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await midiFiles(full, name + '/'));
    else if (entry.isFile() && /\.midi?$/i.test(entry.name)) files.push({ path: full, name });
  }
  return files;
}
try {
  const files = await midiFiles(root);
  await writeFile(join(directory, 'maximum.mid'), exportMidi(midiDocument(16384)).bytes);
  files.push({ path: join(directory, 'maximum.mid'), name: 'generated-16384-notes' });
  for (const file of files) {
    global.gc?.();
    const before = process.memoryUsage();
    const read = await call('read_midi_file', { path: file.path, targetBpm: 120 });
    const after = process.memoryUsage(), doc = parse(read.result.data.document, 'fields') as StateDocument;
    const output = join(directory, results.length + '.mid');
    const write = await call('write_midi_file', { path: output, document: read.result.data.document });
    const again = await call('read_midi_file', { path: output });
    const recovered = parse(again.result.data.document, 'fields') as StateDocument;
    const equal = JSON.stringify(notes(doc)) === JSON.stringify(notes(recovered));
    if (!equal) throw new Error('Normalized note values did not round-trip.');
    const repeated = await call('read_midi_file', { path: file.path, targetBpm: 120 });
    if (read.result.data.document !== repeated.result.data.document) throw new Error('Unstable document output.');
    results.push({ file: file.name, sourceSha256: read.result.source.sha256, sourceBytes: read.result.source.bytes,
      notes: doc.events.length, documentBytes: read.result.data.documentBytes,
      documentSha256: read.result.authority.documentSha256, responseBytes: Buffer.byteLength(JSON.stringify(read.result)),
      importMs: read.ms, repeatedImportMs: repeated.ms, writeMs: write.ms,
      exportBytes: write.result.file.bytes, exportSha256: write.result.file.sha256, readback: write.result.readback.status,
      noteRoundTrip: equal, normalization: read.result.data.report, exportReport: write.result.report,
      heapUsedBefore: before.heapUsed, heapUsedAfterImport: after.heapUsed, rssAfterImport: after.rss });
  }
  console.log(JSON.stringify({ version: '8i16-acceptance-v1', date: new Date().toISOString(), node: process.version,
    hostCalls: 0, results }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
