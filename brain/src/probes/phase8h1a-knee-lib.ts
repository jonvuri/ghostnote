/**
 * 8h1a cache limit knee sweep: pure helpers. One research allocation per controller load. The active
 * scale changes through `cache.configure`. Every live result stays `complete:false` and `eligible:false`.
 */
import assert from 'node:assert/strict';

export type Wire = Record<string, unknown>;

export const KNEE_MARKER = '8h1a-knee-sweep-v7';
/**
 * Builds whose arm results are retained. v4 fixed the quadratic enrichment census; earlier arms are diagnostics.
 * v5 added the fixture duration cap, v6 bounded the reconcile and canary copies, v7 the cursor slot setting.
 */
export const RETAINED_MARKERS = ['8h1a-knee-sweep-v4', '8h1a-knee-sweep-v5', '8h1a-knee-sweep-v6', KNEE_MARKER] as const;
export const KNEE_PROFILE = 'phase-8-probe-v1';
export const KNEE_METHOD_COUNT = 98;
export const KNEE_METHODS_HASH = 'd89cee6bf21c1f96';
export const FIXTURE_SPEC = '8h1a-even-spread-v1';
export const GRID = 1 / 512;

/** Allocation sizes, smallest first. `max` is the plan maximum. */
export const ALLOCATIONS = {
  current: { observers: 512, width: 131_072, tracks: 512, scenes: 128 },
  middle: { observers: 2_048, width: 1_048_576, tracks: 1_024, scenes: 256 },
  max: { observers: 4_096, width: 4_194_304, tracks: 2_048, scenes: 512 },
} as const;
export type AllocationName = keyof typeof ALLOCATIONS;

/**
 * 8h1a width isolation. Only the shadow width changes. Two shadow observers, the authority, and the fixture
 * cursor use that width. The flat bank and topology stay at 16 tracks by 16 scenes.
 */
export const WIDTH_STEPS = [131_072, 524_288, 1_048_576, 2_097_152, 4_194_304] as const;
export function widthConfig(width: number): Wire {
  assert(WIDTH_STEPS.includes(width as typeof WIDTH_STEPS[number]), 'width is not on the isolation axis');
  return { recordChars: 0, stamp: `8h1a-width-${width}`, tracks: 16, scenes: 16, cacheTopologyCounted: true,
    cacheTopologyTracks: 16, cacheLifecycleResearch: true, cacheKneeResearch: true, cacheShadowObservers: 2,
    cacheShadowSteps: width, contentFilter: 'ALL_CHANNELS' };
}

/** 8h1a observer isolation. Only the shadow observer allocation changes. */
export const OBSERVER_STEPS = [512, 1_024, 2_048, 4_096] as const;
export function observerConfig(observers: number, cursorScenes?: number): Wire {
  assert(OBSERVER_STEPS.includes(observers as typeof OBSERVER_STEPS[number]), 'count is not on the observer axis');
  const config: Wire = { ...widthConfig(131_072), stamp: `8h1a-observers-${observers}`, cacheShadowObservers: observers };
  // A cursor track with fewer launcher slots tests whether the per-observer slot bank is needed.
  if (cursorScenes !== undefined) { config.cacheShadowCursorScenes = cursorScenes; config.stamp += `-cursor${cursorScenes}`; }
  return config;
}
/** Fixed allocation shape for an isolation config name. */
export function isolationShape(name: string): { width: number; tracks: number; scenes: number; observers: number } | undefined {
  if (name.startsWith('width-')) return { width: Number(name.slice(6)), tracks: 16, scenes: 16, observers: 2 };
  if (name.startsWith('observers-')) return { width: 131_072, tracks: 16, scenes: 16, observers: Number(name.slice(10).split('-')[0]) };
  return undefined;
}

/** Live heap stop. A class histogram forces a full collection, so its total is the live set. */
export const HEAP_STOP_BYTES = 2 * 1024 ** 3;

export interface HeapRow { instances: number; bytes: number; name: string }
/** Parse `jcmd <pid> GC.class_histogram`. The total row is required. */
export function parseHistogram(text: string, top = 25): { totalBytes: number; totalInstances: number; top: HeapRow[] } {
  const rows: HeapRow[] = [];
  let total: { instances: number; bytes: number } | undefined;
  for (const line of text.split('\n')) {
    const row = line.match(/^\s*\d+:\s+(\d+)\s+(\d+)\s+(.+?)\s*$/);
    if (row) { rows.push({ instances: Number(row[1]), bytes: Number(row[2]), name: row[3]! }); continue; }
    const sum = line.match(/^Total\s+(\d+)\s+(\d+)/);
    if (sum) total = { instances: Number(sum[1]), bytes: Number(sum[2]) };
  }
  assert(total !== undefined && rows.length > 0, 'class histogram has no total');
  return { totalBytes: total.bytes, totalInstances: total.instances, top: rows.slice(0, top) };
}

/** The research rig config for one allocation. The shadow observers are one fewer than the plan count only if the host refuses. */
export function kneeConfig(name: AllocationName, observers?: number): Wire {
  const size = ALLOCATIONS[name];
  return { recordChars: 0, stamp: `8h1a-knee-${name}`, tracks: size.tracks, scenes: size.scenes,
    cacheTopologyCounted: true, cacheTopologyTracks: size.tracks, cacheLifecycleResearch: true, cacheKneeResearch: true,
    cacheShadowObservers: observers ?? size.observers, cacheShadowSteps: size.width, contentFilter: 'ALL_CHANNELS' };
}

/**
 * Software limits for a sweep arm. Each estimate gate is open, so a host or speed knee appears first.
 * The per-batch host-work limit and the ping signal stay in force.
 */
export function openLimits(overrides: Wire = {}): Wire {
  // `open` turns a gate off. The extension then computes no estimate for it.
  return { occupied: 2 ** 30, pending: 'open', recorderBytes: 'open', snapshotBytes: 'open', combinedBytes: 'open',
    registryBytes: 'open', replayDeadlineMs: 600_000, enrichmentDeadlineMs: 600_000, rebuildDeadlineMs: 3_600_000,
    constructionBudgetMs: 60_000, pingBudgetMs: 50, ...overrides };
}

/** Mirror of ShadowKneeFixture. The Java test checks the same golden values. */
export function fixtureCell(index: number, count: number, width: number): number {
  checkSpec(index, count, width);
  return count === 1 ? width - 1 : Math.floor(index * (width - 1) / (count - 1));
}
export const fixtureChannel = (index: number): number => index % 16;
export const fixturePitch = (index: number): number => 24 + (index * 7) % 80;
export const fixtureVelocity = (index: number): number => 1 + (index * 37) % 127;
/** The cap sets the sustained cells per note. The host keeps one step per sounding cell. */
export function fixtureDurationCells(index: number, count: number, width: number, cap = 64): number {
  assert(cap >= 1, 'invalid duration cap');
  const next = index + 1 < count ? fixtureCell(index + 1, count, width) : width;
  return Math.max(1, Math.min(cap, next - fixtureCell(index, count, width)));
}
/** Total sounding cells of one fixture: the sum of note durations at 1/512 beat. */
export function fixtureSoundingCells(count: number, width: number, cap = 64): number {
  let total = 0;
  for (let index = 0; index < count; index++) total += fixtureDurationCells(index, count, width, cap);
  return total;
}
function checkSpec(index: number, count: number, width: number): void {
  assert(Number.isSafeInteger(index * (width - 1)), 'fixture spec exceeds exact integer range');
  assert(count >= 1 && count <= width && index >= 0 && index < count, 'invalid fixture spec');
}

export interface FixtureNote { channel: number; cell: number; pitch: number; velocity: number; durationCells: number }
export function fixtureNote(index: number, count: number, width: number, semitones = 0, cap = 64): FixtureNote {
  return { channel: fixtureChannel(index), cell: fixtureCell(index, count, width), pitch: fixturePitch(index) + semitones,
    velocity: fixtureVelocity(index), durationCells: fixtureDurationCells(index, count, width, cap) };
}

/** Host velocity is a 0..1 ratio of the 0..127 write value. */
const velocityMatches = (actual: number, written: number): boolean => Math.abs(actual * 127 - written) < 0.51;

/**
 * Compare compact promoted rows `[channel, cell, pitch, velocity, durationCells]` with the declared fixture.
 * Return issue text; an empty list is an exact match.
 */
export function compactIssues(rows: unknown, count: number, width: number, semitones = 0, limit = 20, cap = 64): string[] {
  const issues: string[] = [];
  if (!Array.isArray(rows)) return ['compact rows are absent'];
  if (rows.length !== count) issues.push(`note count ${rows.length} differs from ${count}`);
  const expected = new Map<string, FixtureNote>();
  for (let index = 0; index < count; index++) {
    const note = fixtureNote(index, count, width, semitones, cap);
    expected.set(`${note.channel}:${note.cell}:${note.pitch}`, note);
  }
  for (const row of rows) {
    if (issues.length >= limit) break;
    if (!Array.isArray(row) || row.length !== 5) { issues.push(`malformed row ${JSON.stringify(row)}`); continue; }
    const [channel, cell, pitch, velocity, duration] = row.map(Number) as [number, number, number, number, number];
    const note = expected.get(`${channel}:${cell}:${pitch}`);
    if (note === undefined) { issues.push(`foreign note ${channel}:${cell}:${pitch}`); continue; }
    expected.delete(`${channel}:${cell}:${pitch}`);
    if (!velocityMatches(velocity, note.velocity)) issues.push(`velocity ${velocity} at ${cell}:${pitch}`);
    if (duration !== note.durationCells) issues.push(`duration ${duration} at ${cell}:${pitch}`);
  }
  if (expected.size > 0 && issues.length < limit) issues.push(`${expected.size} declared notes are absent`);
  return issues;
}

/** Targeted oracle coordinates: first, last, final cell, and the first note of each MIDI channel. */
export function oracleIndexes(count: number): number[] {
  const indexes = new Set<number>([0, count - 1, Math.floor(count / 2)]);
  for (let channel = 0; channel < Math.min(16, count); channel++) indexes.add(channel);
  for (let channel = 0; channel < 16 && count - 1 - channel >= 0; channel++) indexes.add(count - 1 - channel);
  return [...indexes].sort((a, b) => a - b);
}

/** Check targeted host reads at declared coordinates. Each coordinate must hold exactly the declared note. */
export function targetedIssues(notes: unknown, indexes: readonly number[], count: number, width: number, semitones = 0, cap = 64): string[] {
  if (!Array.isArray(notes)) return ['targeted notes are absent'];
  const issues: string[] = [];
  const read = notes as Wire[];
  for (const index of indexes) {
    const note = fixtureNote(index, count, width, semitones, cap);
    const found = read.filter(row => row.cell === note.cell && row.pitch === note.pitch);
    if (found.length !== 1 || found[0]!.channel !== note.channel) {
      issues.push(`coordinate ${note.cell}:${note.pitch} holds ${found.length} notes`); continue;
    }
    if (!velocityMatches(Number(found[0]!.velocity), note.velocity)) issues.push(`velocity at ${note.cell}:${note.pitch}`);
    if (found[0]!.durationCells !== note.durationCells) issues.push(`duration at ${note.cell}:${note.pitch}`);
  }
  if (read.length !== indexes.length) issues.push(`targeted read returned ${read.length} notes for ${indexes.length} coordinates`);
  return issues;
}

/** Compare an E131 exact source with the declared fixture. Its times are beats; it reports 0..127 velocity. */
export function exactSourceIssues(source: Wire, count: number, width: number, semitones = 0, limit = 20): string[] {
  const events = (source.eventMap ?? source.events) as Wire[] | undefined;
  if (!Array.isArray(events)) return ['exact source has no event map'];
  const issues: string[] = [];
  if (events.length !== count) issues.push(`exact note count ${events.length} differs from ${count}`);
  const expected = new Set<string>();
  for (let index = 0; index < count; index++) {
    const note = fixtureNote(index, count, width, semitones);
    expected.add(`${note.channel}:${note.cell}:${note.pitch}`);
  }
  for (const event of events) {
    if (issues.length >= limit) break;
    const cell = Math.round(Number(event.startBeats) / GRID);
    const key = `${Number(event.channel)}:${cell}:${Number(event.pitch)}`;
    if (!expected.delete(key)) issues.push(`exact foreign note ${key}`);
  }
  if (expected.size > 0 && issues.length < limit) issues.push(`${expected.size} declared notes are absent from the exact source`);
  return issues;
}

export function percentile(values: readonly number[], fraction: number): number {
  assert(values.length > 0 && fraction > 0 && fraction <= 1);
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}
export const median = (values: readonly number[]): number => percentile(values, 0.5);

/** One measured point on an axis. `pass` means exact, inside host health, and inside the speed rule. */
export interface ArmPoint {
  readonly value: number;
  readonly exact: boolean;
  readonly pingP95Ms: number;
  readonly warmReadMs?: number;
  readonly exactReadMs?: number;
  readonly hostWorkMaxBatchMs?: number;
  readonly refused?: string;
}

/** Host health: ping p95 stays inside the selected 50 ms signal and no batch exceeds the 50 ms host-work limit. */
export const HOST_PING_MS = 50, HOST_BATCH_MS = 50;
/** A warm read is clearly faster when it takes at most half the paired exact read. */
export const SPEED_RATIO = 0.5;

export function pointPasses(point: ArmPoint): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (point.refused !== undefined) reasons.push(`refused:${point.refused}`);
  if (!point.exact) reasons.push('inexact');
  if (!(point.pingP95Ms <= HOST_PING_MS)) reasons.push('ping-knee');
  if (point.hostWorkMaxBatchMs !== undefined && point.hostWorkMaxBatchMs > HOST_BATCH_MS) reasons.push('host-work-knee');
  if (point.warmReadMs !== undefined && point.exactReadMs !== undefined && point.warmReadMs > SPEED_RATIO * point.exactReadMs)
    reasons.push('speed-knee');
  return { pass: reasons.length === 0, reasons };
}

/**
 * Find the first knee on an ascending axis. Without a knee, select the largest passing value.
 * The selected limit is the last passing value below the knee, reduced by the stated margin.
 */
export function selectLimit(points: readonly ArmPoint[], margin = 1): Wire {
  assert(points.length > 0 && margin > 0 && margin <= 1);
  const ordered = [...points].sort((a, b) => a.value - b.value);
  for (let index = 1; index < ordered.length; index++) assert(ordered[index]!.value !== ordered[index - 1]!.value, 'duplicate axis value');
  let lastPass: ArmPoint | undefined;
  for (const point of ordered) {
    const verdict = pointPasses(point);
    if (!verdict.pass) {
      return { knee: point.value, kneeReasons: verdict.reasons, largestPassing: lastPass?.value ?? null,
        selected: lastPass === undefined ? null : Math.floor(lastPass.value * margin), source: 'first-knee' };
    }
    lastPass = point;
  }
  return { knee: null, kneeReasons: [], largestPassing: lastPass!.value, selected: Math.floor(lastPass!.value * margin),
    source: 'largest-passing' };
}

/** Recompute one arm summary from its raw samples. An artifact cannot claim a value that its samples do not support. */
export function verifyArm(arm: Wire): ArmPoint {
  assert.equal(arm.schema, 'phase8h1a-arm-v1'); assert.equal(arm.complete, false); assert.equal(arm.eligible, false);
  assert((RETAINED_MARKERS as readonly unknown[]).includes(arm.marker), `arm build ${String(arm.marker)} is not retained`);
  const warm = (arm.warmReads as Wire[] | undefined) ?? [];
  // A refused exact read is a recorded refusal. It is neither a timing sample nor a content check.
  const exact = ((arm.exactReads as Wire[] | undefined) ?? []).filter(row => row.refused === undefined);
  const pings = (arm.pingSamplesMs as number[] | undefined) ?? [];
  assert(pings.length >= 20, 'an arm needs at least 20 ping samples');
  const issues = [...warm, ...exact].flatMap(row => (row.issues as string[] | undefined) ?? ['issues absent']);
  const batches = warm.map(row => Number(row.maxBatchMs)).filter(Number.isFinite);
  const point: ArmPoint = {
    value: Number(arm.axisValue),
    exact: issues.length === 0 && arm.oracleIssues !== undefined && (arm.oracleIssues as string[]).length === 0,
    pingP95Ms: percentile(pings, 0.95),
    ...(warm.length > 0 ? { warmReadMs: median(warm.map(row => Number(row.wallMs))) } : {}),
    ...(exact.length > 0 ? { exactReadMs: median(exact.map(row => Number(row.wallMs))) } : {}),
    ...(batches.length > 0 ? { hostWorkMaxBatchMs: Math.max(...batches) } : {}),
    ...(typeof arm.refused === 'string' ? { refused: arm.refused } : {}),
  };
  const summary = arm.summary as Wire | undefined;
  if (summary !== undefined) assert.deepEqual(summary, point, 'arm summary differs from its samples');
  return point;
}
