/** Replay the MIDI trial snapshots offline. Store only hashes, counts, and cost. */
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, isAbsolute, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { serialize, BINDING, type StateDocument } from '../document/index.js';
import { midiDocument } from '../midi/fixtures.js';
import { writeMidiFile } from '../surface/midi-files.js';

type Wire = Record<string, any>;
const [path] = process.argv.slice(2);
if (!path || !isAbsolute(path)) throw new Error('Usage: phase8i18-midi-snapshot.ts <absolute rollout.jsonl>');
const unwrap = (input: Wire): Wire | undefined => {
  let value: any = input;
  try {
    for (let i = 0; i < 5; i++) {
      if (typeof value === 'string') value = JSON.parse(value);
      else if (value.content) value = value.content[0].text;
      else return value;
    }
  } catch { return undefined; } // Large source reads can be truncated in the rollout copy.
  return undefined;
};
const rows = (await readFile(path, 'utf8')).trim().split('\n').map(line => JSON.parse(line) as Wire);
const calls = rows.map((row, index) => ({ line: index + 1, item: row.payload?.item }))
  .filter(row => row.item?.type === 'McpToolCall' && row.item.server === 'ghostnote');
const reads = calls.filter(row => row.item.tool === 'read_launcher_clip')
  .map(row => ({ ...row, result: unwrap(row.item.result) })).filter(row => row.result?.data?.document);
const writes = calls.filter(row => row.item.tool === 'write_midi_file')
  .map(row => ({ ...row, result: unwrap(row.item.result) })).filter(row => row.result?.applied);
const directory = await mkdtemp(join(tmpdir(), 'gn-midi-snapshot-'));
const results: Wire[] = [];
const clipId = (text: string) => JSON.parse(text.split('\n').find(line => line.startsWith('CLIP '))!.slice(5)).id;
try {
  for (const write of writes) {
    const read = reads.find(row => row.line < write.line && clipId(row.result!.data.document) === clipId(write.item.arguments.document));
    if (!read) throw new Error('Missing source snapshot.');
    const before = process.memoryUsage(), start = performance.now();
    const result = await writeMidiFile({ path: join(directory, `${write.line}.mid`),
      document: read.result!.data.document, bpm: write.item.arguments.bpm, acceptLoss: true }) as Wire;
    if (!result.applied || result.readback.status !== 'verified') throw new Error(JSON.stringify(result));
    if (result.file.sha256 !== write.result!.file.sha256) throw new Error('Replay bytes differ from the trial export.');
    results.push({ readLine: read.line, writeLine: write.line, file: basename(write.item.arguments.path),
      notes: result.report.notes, sha256: result.file.sha256, matchesTrialBytes: true, readback: result.readback.status,
      writeMs: performance.now() - start, heapBefore: before.heapUsed, heapAfter: process.memoryUsage().heapUsed });
  }
  if (results.length !== 3) throw new Error('Expected the three trial exports.');
  const generated: StateDocument = midiDocument(16384); generated.kind = 'snapshot';
  generated.coverage[0]!.fields = [...BINDING, 'releaseVelocity'];
  const text = serialize(generated, 'fields'); global.gc?.();
  const before = process.memoryUsage(), start = performance.now();
  const maximum = await writeMidiFile({ path: join(directory, 'maximum.mid'), document: text }) as Wire;
  if (!maximum.applied || maximum.readback.status !== 'verified' || maximum.report.notes !== 16384) throw new Error(JSON.stringify(maximum));
  results.push({ file: 'generated-16384-note-snapshot', notes: maximum.report.notes, sha256: maximum.file.sha256,
    readback: maximum.readback.status, writeMs: performance.now() - start, heapBefore: before.heapUsed,
    heapAfter: process.memoryUsage().heapUsed, rssAfter: process.memoryUsage().rss });
  console.log(JSON.stringify({ version: '8i18-snapshot-replay-v1', date: new Date().toISOString(), node: process.version,
    source: basename(path), sourceSha256: createHash('sha256').update(await readFile(path)).digest('hex'), hostCalls: 0, results }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
