import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { decodeNoteFrame, type NoteFrame, type RawNoteFields } from '../adapters/live/clip-read.js';
import { decodeVerboseNote } from '../adapters/live/encoder.js';
import { verifyPaired, verifySmoke, verifyStoppedSmoke } from './phase8h3c-promotion.js';

test('E230 smoke verifier checks the wire, capture, declared cell, and byte counts', async () => {
  const golden = JSON.parse(await readFile(new URL('../../../extension/clip-read.frame.golden.json', import.meta.url), 'utf8')) as NoteFrame;
  const row = { ...decodeNoteFrame(golden, golden.size)[0]!, channel: 15, pitch: 127, cell: 512 };
  const frame = { ...golden, count: 1, from: 0, size: 1, next: -1, data: '', tables: {},
    constants: row, columns: golden.columns.map(([name]) => [name, 'const'] as const) };
  const result = { frame, parkMs: 20, batches: 1, afterClose: 0, closeRule: 'confirm-before-release-v1',
    releaseOn: 0, releaseSustain: 0, releaseEmpty: 128, releaseCallbacks: 128 };
  const reply = { jsonrpc: '2.0', id: '1', result }, wire = JSON.stringify(reply);
  const report = { result, rows: [row], bytes: Buffer.byteLength(wire + '\n'),
    calls: [{ method: 'clip.read', sent: 0, received: 1, bytes: Buffer.byteLength(wire + '\n'), reply, wire }] };
  const data = { schema: 'phase8h3c-smoke-v1', reports: [report, report, report] };
  const dir = await mkdtemp(join(tmpdir(), 'gn-e230-'));
  const path = join(dir, 'smoke.json.gz');
  try {
    await writeFile(path, gzipSync(JSON.stringify(data)));
    await verifySmoke(path);
    for (const corrupt of [
      { ...data, reports: data.reports.slice(1) },
      { ...data, reports: [{ ...report, bytes: 0 }, report, report] },
      { ...data, reports: [{ ...report, rows: [{ ...row, cell: 0 }] }, report, report] },
      { ...data, reports: [{ ...report, calls: [{ ...report.calls[0], wire: '{}' }] }, report, report] },
    ]) {
      await writeFile(path, gzipSync(JSON.stringify(corrupt)));
      await assert.rejects(verifySmoke(path));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('E230 paired verifier recomputes both raw grid scans and checks all eight fixtures', async () => {
  const golden = JSON.parse(await readFile(new URL('../../../extension/clip-read.frame.golden.json', import.meta.url), 'utf8')) as NoteFrame;
  const seed = decodeNoteFrame(golden, golden.size)[0]!;
  const call = (method: string, result: unknown, params?: unknown) => {
    const reply = { jsonrpc: '2.0', id: method, result }, wire = JSON.stringify(reply);
    return { method, params, sent: 0, received: 1, bytes: Buffer.byteLength(wire + '\n'), reply, wire };
  };
  const frameFor = (rows: RawNoteFields[]): NoteFrame => {
    const constants: Record<string, number | boolean | string> = {}, sections: Buffer[] = [];
    const columns = golden.columns.map(([name]) => {
      const values = rows.map(row => row[name]!);
      if (values.every(value => value === values[0])) {
        constants[name] = values[0]!;
        return [name, 'const'] as const;
      }
      const bytes = Buffer.alloc(rows.length * 8);
      values.forEach((value, i) => bytes.writeDoubleLE(Number(value), i * 8));
      sections.push(bytes); return [name, 'raw', 'f64'] as const;
    });
    return { format: 'notes-v1', count: rows.length, from: 0, size: rows.length, next: -1,
      columns, constants, tables: {}, data: Buffer.concat(sections).toString('base64') };
  };
  const reports = [];
  for (const bars of [1, 4, 16, 64]) for (const density of ['sparse', 'dense']) {
    const beats = bars * 4, spacing = density === 'sparse' ? 4 : 0.25;
    const rows = Array.from({ length: beats / spacing * 16 }, (_, i) => ({ ...seed,
      cell: Math.floor(i / 16) * spacing * 512, channel: i % 16, pitch: 48 + i % 16,
      velocity: 100 / 127, duration: 0.25 }));
    const result = { frame: frameFor(rows), readId: 1, closeRule: 'confirm-before-release-v1',
      afterClose: 0, duplicates: 0, releaseOn: 0, releaseSustain: 0, releaseEmpty: rows.length * 128,
      releaseCallbacks: rows.length * 128, parkMs: 18, selection: { restored: true },
      bound: { channelId: 'owned', row: 0 } };
    const read = call('clip.read', result, { trackIndex: 0, row: 0, channelId: 'owned' }), selection = { trackIndex: 0, slotIndex: 0, mixerTrackIndex: 0 };
    const cold = { result, rows, calls: [read], bytes: read.bytes, wallMs: 1, before: selection, after: selection };
    const calls = [], control: [number, unknown[]][] = [];
    for (const stepSize of [1 / 512, 1 / 768]) {
      calls.push(call('cursor.setStepSize', {}, { stepSize }));
      for (let page = 0; page < beats / stepSize; page += 2048) {
        calls.push(call('cursor.scrollToStep', {}, { step: page }));
        const channels = Array.from({ length: 16 }, (_, channel) => {
          const notes = rows.filter(row => row.channel === channel && row.cell / 512 / stepSize >= page
            && row.cell / 512 / stepSize < page + 2048).map(row => ({ ...row,
            x: row.cell / 512 / stepSize - page, y: row.pitch }));
          return { channel, notes, count: notes.length };
        });
        calls.push(call('cursor.getNotesVerboseAllChannels', { channels,
          count: channels.reduce((sum, channel) => sum + channel.count, 0), clipExists: true, scanMicros: 1 },
        { maxX: Math.min(2048, beats / stepSize - page) }));
      }
    }
    for (let channel = 0; channel < 16; channel++) control.push([channel, rows.filter(row => row.channel === channel)
      .map(row => decodeVerboseNote({ ...row, x: row.cell, y: row.pitch }, 1 / 512))]);
    reports.push({ bars, density, cold, control, calls, controlMs: 20,
      controlBytes: calls.reduce((sum, entry) => sum + entry.bytes, 0) });
  }
  const data = { schema: 'phase8h3c-paired-v1', state: { trackId: 'owned' }, reports };
  const dir = await mkdtemp(join(tmpdir(), 'gn-e230-paired-')), path = join(dir, 'paired.json.gz');
  try {
    await writeFile(path, gzipSync(JSON.stringify(data))); await verifyPaired(path);
    for (const corrupt of [
      { ...data, reports: reports.slice(1) },
      { ...data, reports: [{ ...reports[0], control: [] }, ...reports.slice(1)] },
      { ...data, reports: [{ ...reports[0], controlBytes: 0 }, ...reports.slice(1)] },
    ]) {
      await writeFile(path, gzipSync(JSON.stringify(corrupt))); await assert.rejects(verifyPaired(path));
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('E230 stopped smoke verifier retains failure and checks cleanup evidence', async () => {
  const call = (method: string, result: unknown, params?: unknown) => {
    const reply = { jsonrpc: '2.0', id: method, result }, wire = JSON.stringify(reply);
    return { method, params, sent: 0, received: 1, bytes: Buffer.byteLength(wire + '\n'), reply, wire };
  };
  const state = { trackId: 'owned', entryTracks: [{ channelId: 'original' }], entry: {
    mark: { project: 'New 5' }, hello: { runtimeProfile: 'normal-v1', methodCount: 87, methodsHash: 'ca139a3e62a55e68' },
    rig: { clipReader: { revision: 'clip-reader-v1' } } } };
  const result = { refused: 'step-delta', onsets: 1, batches: 1, afterClose: 128, parkMs: 18, bindMs: 44,
    selection: { restored: true }, bound: { channelId: 'owned', row: 0 } };
  const calls = [call('clip.read', result, { channelId: 'owned' })];
  const selection = { trackIndex: 0, slotIndex: 0, mixerTrackIndex: 0 };
  const report = { result, calls, rows: [], before: selection, after: selection, bytes: calls[0]!.bytes };
  const fixture = call('cursor.setNotes', {}, { cursor: 'fine', channel: 15, notes: [[4, 127, 100, 0.25]] });
  const data = { schema: 'phase8h3c-smoke-v1', state, reports: [report], calls: [fixture, ...calls] };
  const after = { tracks: state.entryTracks };
  const stats = { clipReader: { open: false, subscribed: false, writeGate: { readOpen: false, waiting: 0 } } };
  const cleanup = { schema: 'phase8h3c-cleanup-v1', state, after, stats,
    calls: [call('track.list', after), call('rig.stats', stats)] };
  const dir = await mkdtemp(join(tmpdir(), 'gn-e230-stopped-'));
  const path = join(dir, 'smoke.json.gz'), cleanupPath = join(dir, 'cleanup.json');
  try {
    await writeFile(cleanupPath, JSON.stringify(cleanup));
    await writeFile(path, gzipSync(JSON.stringify(data)));
    await verifyStoppedSmoke(path, cleanupPath);
    await assert.rejects(verifySmoke(path));
    for (const corrupt of [
      { ...data, reports: [report, report] },
      { ...data, reports: [{ ...report, bytes: 0 }] },
      { ...data, reports: [{ ...report, after: { ...selection, mixerTrackIndex: 1 } }] },
      { ...data, calls: [{ ...fixture, wire: '{}' }, ...calls] },
    ]) {
      await writeFile(path, gzipSync(JSON.stringify(corrupt)));
      await assert.rejects(verifyStoppedSmoke(path, cleanupPath));
    }
    await writeFile(path, gzipSync(JSON.stringify(data)));
    await writeFile(cleanupPath, JSON.stringify({ ...cleanup, stats: { clipReader: { open: true } } }));
    await assert.rejects(verifyStoppedSmoke(path, cleanupPath));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
