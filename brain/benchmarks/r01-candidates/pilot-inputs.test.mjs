import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SELECTION, workOrder, windowAt, nextStart, assetWindows, lineageReview, selectWindows, windowCandidates, densestWindow, selectDenseWindows } from './pilot-inputs.mjs';
import { pilotTasks, realTasks, syntheticTasks, editTarget, shiftRange, loadWindows, synthesizeVelocities, soundingTime,
  transposePitch, shiftTransposeRange, nearMiss, groupTimingTasks } from './pilot-tasks.mjs';
import { validateStructuredFixture } from './structured.mjs';
import { encodeNestedFields } from './nested-fields.mjs';
import { pilotPlan, pilotSelection, resolvePackage } from './cli-pilot-runner.mjs';
import { draftCells } from './pilot-draft.mjs';
import { add, canonical, cmp, numeric, rational } from './common.mjs';

const data = name => JSON.parse(readFileSync(new URL(`../../../context/evidence/data/${name}`, import.meta.url), 'utf8'));
const windows = loadWindows(), windowsV1 = data('r01-pilot-inputs/windows.json'), inventory = data('r01-pilot-inputs/inventory.json'), retained = data('r01-candidates/corpus-manifest.json');
const note = (id, pitch, startTick, endTick = startTick + 2) => ({ id, pitch, startTick, endTick, trackIndex: 1, channel: 1 });
// ppq 4: a 16-quarter window spans 64 ticks.
const decoded = notes => ({ ppq: 4, notes });

test('the retained inventory reproduces the seeded work and asset order for both input versions', () => {
  const assets = inventory.map(a => ({ ...a, kind: 'midi', midi: { isDrum: a.isDrum } }));
  const order = workOrder(assets, { groups: retained.groups });
  assert.equal(order.length, 11, 'every reserved MIDI work has a pitched large-transcription asset');
  for (const record of [windowsV1, windows]) {
    assert.equal(createHash('sha256').update(canonical(inventory)).digest('hex'), record.inventory.reducedSha256);
    assert.deepEqual(order.map(w => w.title), record.workOrder.map(w => w.title));
    assert(record.workOrder.slice(3).every(w => w.use === 'unused (rigorous stage)'));
    record.works.forEach((work, i) => { assert.equal(work.label, 'ABC'[i]); assert.equal(work.shardId, order[i].shardId); });
  }
  // Version 1 took each work's first asset and first window.
  windowsV1.works.forEach((work, i) => assert.equal(work.assetId, order[i].assetOrder[0]));
  // Version 2 scanned every pool asset and kept the largest admissible window.
  windows.works.forEach((work, i) => {
    const scanned = windows.attempts.filter(a => a.shardId === work.shardId && a.outcome === 'scanned');
    assert.deepEqual(scanned.map(a => a.assetId), order[i].assetOrder.filter(id => windows.attempts.some(a => a.assetId === id && a.outcome === 'scanned')));
    assert.equal(work.notes.length, Math.max(...scanned.map(a => a.noteCount)));
    assert(windows.attempts.every(a => a.shardId === undefined || order.slice(0, 3).some(w => w.shardId === a.shardId)), 'no later work is opened');
  });
  assert.deepEqual(windows.works.map(w => w.notes.length), [103, 72, 115]);
});

test('accepted windows satisfy the extraction rules and record timing provenance', () => {
  for (const work of windows.works) {
    assert(work.notes.length >= SELECTION.minNotes && work.notes.length <= SELECTION.maxNotes);
    assert.equal(work.window.endTickExclusive - work.window.startTick, 16 * work.timing.ticksPerQuarter);
    assert(work.sourceTicks.every(t => t.startTick >= work.window.startTick && t.startTick < work.window.endTickExclusive));
    assert.equal(new Set(work.notes.map(n => `${n.pitch}@${n.at}`)).size, work.notes.length, 'no normalization collision');
    assert(['mapped', 'baked'].includes(work.timing.mode));
    assert(work.notes.every(n => /^\d+(\/\d+)?$/.test(n.at) && 512 % Number(n.at.split('/')[1] ?? 1) === 0), 'onsets on the 1/512 grid');
  }
  assert.deepEqual(windows.works.map(w => w.timing.mode), ['baked', 'mapped', 'mapped']);
  assert.equal(windows.rules.schema, 'r01-pilot-selection-rules-v2');
});

test('window refusals: note bounds and normalization collisions advance by the next-window rule', () => {
  const many = decoded(Array.from({ length: 129 }, (_, i) => note(`n${i}`, 40 + (i % 40), Math.floor(i / 3))));
  assert.equal(windowAt(many, 0).refusal, 'more-than-128-notes');
  const few = decoded(Array.from({ length: 15 }, (_, i) => note(`f${i}`, 60, i * 4)));
  assert.equal(windowAt(few, 0).refusal, 'fewer-than-16-notes');
  // 1/8-tick offsets at ppq 4096 normalize to the same 1/512 cell.
  const close = { ppq: 4096, notes: [{ ...note('a', 60, 0), endTick: 100 }, { ...note('b', 60, 1), endTick: 100 },
    ...Array.from({ length: 16 }, (_, i) => ({ ...note(`c${i}`, 70 + i, 4096 * i), endTick: 4096 * i + 50 }))] };
  const collided = windowAt(close, 0);
  assert.equal(collided.refusal, 'normalization-collision');
  assert.deepEqual(collided.collisions[0].ids, ['a', 'b']);
  const later = decoded([note('x', 60, 0), ...Array.from({ length: 16 }, (_, i) => note(`y${i}`, 50 + i, 70 + i))]);
  assert.equal(nextStart(later, 0), 70, 'first onset at or after the refused start + 16 quarters');
  const attempts = [];
  const accepted = assetWindows(later, attempts, { assetId: 'test' });
  assert.equal(accepted.startTick, 70);
  assert.deepEqual(attempts.map(a => [a.windowIndex, a.outcome, a.reason]), [[0, 'refused', 'fewer-than-16-notes'], [1, 'accepted', null]]);
});

test('an asset stops after eight refused windows or when no onset remains', () => {
  const sparse = decoded(Array.from({ length: 10 }, (_, i) => note(`s${i}`, 60, i * 64)));
  const attempts = [];
  assert.equal(assetWindows(sparse, attempts, {}), null);
  assert.equal(attempts.filter(a => a.outcome === 'refused').length, 8);
  assert.deepEqual(attempts.at(-1), { outcome: 'asset-exhausted', reason: 'window limit reached' });
  const short = [];
  assetWindows(decoded([note('only', 60, 0)]), short, {});
  assert.deepEqual(short.at(-1), { outcome: 'asset-exhausted', reason: 'no further onset for a next window' });
});

test('selection refuses unresolved timing and decode failures, then moves on without opening other works', () => {
  const asset = (id, timing) => ({ assetId: id, shardId: 's', kind: 'midi', path: `shards/w/x/${id}.mid`, contentHash: 'h',
    transcription: { resolution: { timing } }, midi: { ticksPerQuarter: 4, noteCount: 1, endTick: 1, tempoMap: [] } });
  const opened = [];
  const { works, attempts } = selectWindows([asset('legacy', 'legacy'), asset('broken', 'mapped')],
    [{ shardId: 's', title: 'w', assetOrder: ['legacy', 'broken'] }], '/library', path => { opened.push(path); return Buffer.from('x'); });
  assert.equal(works.length, 0);
  assert.deepEqual(attempts.map(a => [a.assetId ?? null, a.outcome, a.reason]), [['legacy', 'asset-refused', 'invalid-or-unresolved-timing-metadata'],
    ['broken', 'asset-refused', 'source-decode-refused'], [null, 'work-exhausted', 'no accepted window in any pool asset']]);
  assert.deepEqual(opened, ['/library/shards/w/x/broken.mid'], 'the refused-metadata asset is never opened');
});

test('densest-window scan: counts match brute force; over-128 and collided windows are skipped', () => {
  const notes = [0, 1, 2, 3, 30, 31, 32, 33, 34, 70].map((t, i) => note(`d${i}`, 40 + i, t));
  const candidates = windowCandidates(decoded(notes));
  for (const c of candidates) assert.equal(c.count, notes.filter(n => n.startTick >= c.startTick && n.startTick < c.startTick + 64).length);
  assert.deepEqual(candidates.slice(0, 2), [{ startTick: 0, count: 9 }, { startTick: 1, count: 8 }], 'largest first, then earliest');
  // ppq 16: a window spans 256 ticks. Starts 0-11 hold more than 128 notes; start 12 holds exactly 128.
  const dense = { ppq: 16, notes: Array.from({ length: 140 }, (_, i) => note(`e${i}`, i % 128, i)) };
  const { window, stats } = densestWindow(dense);
  assert.deepEqual([window.startTick, window.noteCount, stats.over128], [12, 128, 12]);
  const collided = { ppq: 4096, notes: [{ ...note('a', 60, 0), endTick: 100 }, { ...note('b', 60, 1), endTick: 100 },
    ...Array.from({ length: 20 }, (_, i) => ({ ...note(`c${i}`, 70 + i, 2 + 3000 * i), endTick: 3000 * i + 50 }))] };
  const result = densestWindow(collided);
  assert(result.stats.collisionsSkipped >= 1);
  assert(!result.window.notes.some(n => n.id === 'a') || !result.window.notes.some(n => n.id === 'b'));
});

test('dense selection keeps the earlier asset on a tie, prefers a strictly larger window and records every asset', () => {
  const asset = id => ({ assetId: id, shardId: 's', kind: 'midi', path: `shards/w/x/${id}.mid`, contentHash: 'h',
    transcription: { resolution: { timing: 'mapped' } }, midi: { ticksPerQuarter: 4, noteCount: 1, endTick: 1, tempoMap: [] } });
  const sizes = { first: 20, second: 20, third: 30 };
  const decode = (bytes, meta) => decoded(Array.from({ length: sizes[meta.assetId] }, (_, i) => note(`${meta.assetId}${i}`, 40 + i, i)));
  const run = ids => selectDenseWindows(ids.map(asset), [{ shardId: 's', title: 'w', assetOrder: ids }], '/library', () => Buffer.from('x'), decode);
  assert.equal(run(['first', 'second']).works[0].assetId, 'first', 'a tie keeps the earlier asset');
  const { works, attempts } = run(['first', 'second', 'third']);
  assert.deepEqual([works[0].assetId, works[0].notes.length], ['third', 30]);
  assert.deepEqual(attempts.map(a => a.outcome), ['scanned', 'scanned', 'scanned', 'selected']);
});

test('synthetic velocities are seeded, bounded, varied and shared by instances of one window', () => {
  const tasks = realTasks(undefined, 3), input = id => tasks.find(t => t.id.startsWith(id)).input.notes;
  assert.deepEqual(realTasks(undefined, 3), tasks);
  assert.deepEqual(input('p01'), input('p08'));
  assert.deepEqual(input('p05'), input('p09'));
  assert.deepEqual(input('p06'), input('p11'));
  for (const [i, id] of ['p01', 'p05', 'p06'].entries()) {
    const velocities = input(id).map(n => n.velocity);
    assert(velocities.every(v => Number.isInteger(v) && v >= 20 && v <= 120));
    assert(new Set(velocities).size >= 15, 'not a placeholder');
    assert.deepEqual(input(id).map(({ velocity, ...rest }) => rest),
      windows.works[i].notes.map(({ id: noteId, pitch, at, duration }) => ({ id: noteId, pitch, at, duration })), 'only velocity is synthesized');
  }
  const accented = synthesizeVelocities([{ id: 'x', pitch: 60, at: '4', duration: '1' }], 'w')[0].velocity;
  const plain = synthesizeVelocities([{ id: 'x', pitch: 60, at: '17/4', duration: '1' }], 'w')[0].velocity;
  assert.notEqual(accented, plain);
});

test('instances sharing a window edit different notes', () => {
  const tasks = realTasks(undefined, 3), changed = id => {
    const t = tasks.find(x => x.id.startsWith(id));
    return t.input.notes.find(n => !t.expected.notes.some(e => e.id === n.id && e.pitch === n.pitch && e.velocity === n.velocity && e.at === n.at));
  };
  assert.notEqual(changed('p05').id, changed('p09').id);
  assert.equal(editTarget(tasks.find(t => t.id.startsWith('p09')).input.notes, x => x, new Set([changed('p05').id])).id, changed('p09').id);
});

test('lineage review detects changed shards and tokens shared between works', () => {
  const asset = (shardId, assetId, contentHash, signalId) => ({ shardId, shardTitle: shardId, assetId, contentHash, signalId, kind: 'midi', path: `shards/${shardId}/${assetId}.mid` });
  const group = (shardId, split, assets) => ({ shardId, title: shardId, split, signalIds: [...new Set(assets.map(a => a.signalId))],
    sourceRefs: assets.map(({ assetId, contentHash }) => ({ assetId, contentHash })),
    assets: assets.map(({ assetId, contentHash, path, signalId }) => ({ assetId, contentHash, path, signalId })) });
  const a = [asset('w1', 'a1', 'h1', 's1')], b = [asset('w2', 'b1', 'h2', 's2')];
  const manifest = { groups: [group('w1', 'reserved', a), group('w2', 'reserved', b)], sources: [] };
  assert.equal(lineageReview([...a, ...b], manifest).pass, true);
  const shared = [...a, { ...b[0], signalId: 's1' }];
  const review = lineageReview(shared, manifest);
  assert.equal(review.pass, false);
  assert.deepEqual(review.changedShards, ['w2']);
  assert.equal(review.crossShardSharedTokens[0].token, 'signal:s1');
});

test('edit targets are unique, collision-free addresses from the median onward', () => {
  const n = (id, pitch, at) => ({ id, pitch, at, duration: '1/4', velocity: 64 });
  const notes = [n('a', 60, '0'), n('b', 62, '1'), n('c', 60, '1'), n('d', 60, '1'), n('e', 64, '2')];
  // Sorted a, c, d, b, e: the median d shares 60@1 with c, so b is next.
  assert.equal(editTarget(notes, x => x).id, 'b', 'duplicate address at the median is skipped');
  // Sorted a, b, c, e, d: c + 2 would land on e at 64@1, so e is next.
  const transposed = [n('a', 60, '0'), n('b', 60, '1'), n('c', 62, '1'), n('d', 50, '2'), n('e', 64, '1')];
  assert.equal(editTarget(transposed, x => ({ ...x, pitch: x.pitch + 2 })).id, 'e', 'a collision with pitch + 2 is skipped');
  assert.throws(() => editTarget([n('z', 127, '0')], x => ({ ...x, pitch: x.pitch + 2 })), /no eligible/);
  // Shifting [4,6) would move p onto r at 6, so the next range is used.
  const range = shiftRange([n('p', 60, '47/8'), n('q', 61, '5'), n('r', 60, '6'), n('s', 62, '13/2')]);
  assert.deepEqual([range.from, range.to, range.after.map(x => x.at)], ['6', '8', ['47/8', '5', '49/8', '53/8']]);
});

test('pilot tasks (revision 3): real-source oracles follow the windows and rules', () => {
  const tasks = pilotTasks(undefined, { revision: 3 }), byId = id => tasks.find(t => t.id.startsWith(id));
  assert.deepEqual(tasks.map(t => t.id.slice(0, 3)), ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10', 'p11', 'p12']);
  const [A, B, C] = windows.works.map(w => w.notes);
  assert.equal(byId('p01').answer.total, A.length);
  assert.equal(byId('p01').answer.before, A.filter(x => cmp(x.at, '8') < 0).length);
  assert.deepEqual(byId('p11').expected.notes, byId('p11').input.notes);
  assert.equal(byId('p09').expected.notes.length, B.length - 1);
  const p05 = byId('p05'), changed = p05.expected.notes.filter((x, i) => canonical(x) !== canonical(p05.input.notes[i]));
  assert.equal(changed.length, 1); assert.equal(changed[0].velocity, p05.input.notes.find(x => x.id === changed[0].id).velocity === 91 ? 37 : 91);
  const p06 = byId('p06'), moved = p06.expected.notes.filter((x, i) => x.pitch !== p06.input.notes[i].pitch);
  assert.equal(moved.length, 1);
  assert.equal(C.length, p06.input.notes.length);
  const p08 = byId('p08'), [, from, to] = p08.request.match(/at least (\d+) and less than (\d+)/);
  p08.input.notes.forEach((x, i) => assert.equal(p08.expected.notes[i].at,
    cmp(x.at, from) >= 0 && cmp(x.at, to) < 0 ? add(x.at, '1/8') : x.at));
  assert(tasks.filter(t => t.source.startsWith('reserved:')).every(t => t.cohort === 'performed'));
});

test('synthetic tasks (revision 3): seeded, deterministic, with consistent group equations and an ambiguous selector', () => {
  assert.deepEqual(syntheticTasks(3), syntheticTasks(3));
  const byId = id => syntheticTasks(3).find(t => t.id.startsWith(id));
  for (const fixture of [byId('p02').input, byId('p04').expected, byId('p07').input, byId('p07').expected]) {
    const group = fixture.groups[0];
    for (const id of group.members) assert.equal(fixture.notes.find(x => x.id === id).at, add(add(group.anchor, group.delay), group.spread[id]));
  }
  for (const value of Object.values(byId('p07').input.groups[0].spread)) {
    const cells = Number(add(value, '0').split('/')[0]) * 512 / Number(add(value, '0').split('/')[1] ?? 1);
    assert.equal(cells % 2, 0, 'even 1/512 cells');
  }
  assert.deepEqual(byId('p07').expected.groups[1], byId('p07').input.groups[1], 'timing-free group is protected');
  const matches = byId('p10').input.notes.filter(x => x.pitch === 64 && cmp(x.at, '2') >= 0 && cmp(x.at, '3') < 0);
  assert.equal(matches.length, 2); assert.notEqual(matches[0].at, matches[1].at);
  assert(byId('p12').input.notes.some(x => 512 % Number(x.at.split('/')[1] ?? 1) !== 0), 'non-grid timing');
  assert.equal(byId('p12').input.groups, undefined);
});

test('the retained pilot packages load; v2 regenerates and plans 201 initial attempts per cohort', () => {
  assert.equal(resolvePackage('pilot-development-v1').manifest.counts.eligibleCells, 67);
  const pkg = resolvePackage('pilot-development-v2');
  assert.equal(pkg.manifest.inputVersion, 2);
  assert.equal(pkg.manifest.schema, 'r01-pilot-package-v1');
  assert.equal(pkg.manifest.stage, 'development');
  const draft = new Map(draftCells().map(c => [`${c.instance}--${c.arm}`, c]));
  assert(pkg.manifest.cells.every(c => draft.get(c.id).eligible === c.eligible && draft.get(c.id).role === c.role));
  assert.deepEqual([pkg.manifest.counts.eligibleCells, pkg.manifest.counts.exclusions, pkg.manifest.counts.goldenPasses,
    pkg.manifest.counts.wrongResultsRejected], [67, 17, 67, 67]);
  const plan = pilotPlan(pkg.manifest, pilotSelection());
  for (const cohort of plan.cohorts) assert.equal(plan.runs.filter(r => r.configSha256 === cohort.configSha256).length, 201);
  assert.equal(plan.counts.maximumTaskAttempts, 1206);
});

test('package v3 revises wording and prompts only: same inputs, oracles and cells as v2 (E370)', () => {
  const v2 = resolvePackage('pilot-development-v2'), v3 = resolvePackage('pilot-development-v3');
  assert.deepEqual([v3.manifest.packageVersion, v3.manifest.taskRevision, v3.manifest.promptRevision, v3.manifest.inputVersion], [3, 3, 2, 2]);
  assert.deepEqual(v3.manifest.cells.map(c => [c.id, c.eligible, c.role]), v2.manifest.cells.map(c => [c.id, c.eligible, c.role]));
  const strip = t => { const { version, request, ...rest } = t; return rest; };
  assert.deepEqual(v3.tasks.map(strip), v2.tasks.map(strip), 'inputs and oracles unchanged');
  const v2Pairs = new Map(v2.pairs.map(p => [p.id, p]));
  for (const pair of v3.pairs) {
    assert.equal(pair.input, v2Pairs.get(pair.id).input);
    assert(!pair.prompt.includes('TASK SCOPE'));
    assert(!/the note at \S+ with pitch/.test(pair.prompt), `${pair.id}: positional-looking selector`);
    assert(!/reduced rational|rational spellings|values and spellings/.test(pair.prompt), `${pair.id}: spelling demand`);
    if (pair.arm === 'pp-barbeat') assert.match(pair.prompt, /n\/4d equals n3\/8/);
    if (v3.tasks.find(t => t.id === pair.task).cohort === 'source') assert.match(pair.prompt, /Preserve supplied per-note channels\./);
  }
  assert.deepEqual(v3.tasks.filter(t => t.version === 2).map(t => t.id.slice(0, 3)), ['p02', 'p04', 'p05', 'p06', 'p09', 'p12']);
  assert.match(v3.tasks.find(t => t.id.startsWith('p06')).request, /^Transpose only the note with onset 8 and pitch 56 /);
});

test('revision 4 rules: boundary read, multi-note transpose, onset-bounded two-step range and near miss (D61)', () => {
  const n = (id, pitch, at, duration = '1/4') => ({ id, pitch, at, duration, velocity: 64 });
  // T = 2: s starts there, e ends there and h is held across it; 1 is not an end time.
  const timing = soundingTime([n('h', 50, '1', '3'), n('e', 52, '3/2', '1/2'), n('s', 54, '2'), n('x', 56, '1', '1/4')]);
  assert.deepEqual([timing.at, timing.sounding.map(x => x.id)], ['2', ['h', 's']]);
  assert.throws(() => soundingTime([n('a', 60, '0', '1'), n('b', 61, '1')]), /no boundary time/);
  // Pitch 60 has five notes but 62@0 is occupied, so pitch 64 (also five) is chosen.
  const many = [...[0, 1, 2, 3, 4].map(i => n(`c${i}`, 60, String(i))), n('blocker', 62, '0'),
    ...[0, 1, 2, 3, 4].map(i => n(`e${i}`, 64, String(i))), n('rare', 70, '0')];
  assert.equal(transposePitch(many), 64);
  const range = shiftTransposeRange([n('a', 60, '4'), n('b', 61, '9/2'), n('c', 62, '5'), n('d', 63, '11/2'), n('t', 60, '6'), n('z', 64, '7')]);
  assert.deepEqual([range.from, range.to, range.count], ['4', '6', 4]);
  assert.deepEqual(range.after.map(x => [x.id, x.pitch, x.at]).slice(0, 5),
    [['a', 62, '33/8'], ['b', 63, '37/8'], ['c', 64, '41/8'], ['d', 65, '45/8'], ['t', 60, '6']]);
  // From the median: x at 9/2 with its same-pitch neighbour at 5 just outside [4, 5).
  const miss = nearMiss([n('p', 40, '1'), n('q', 41, '2'), n('x', 45, '9/2'), n('y', 45, '5'), n('r', 42, '6')]);
  assert.deepEqual([miss.target.id, miss.excluded.id, miss.from, miss.to], ['x', 'y', '4', '5']);
});

test('pilot tasks (revision 4): harder replacements over the same inputs; other tasks unchanged', () => {
  const v3 = pilotTasks(undefined, { revision: 3 }), v4 = pilotTasks(undefined, { revision: 4 }), byId = (tasks, id) => tasks.find(t => t.id.startsWith(id));
  assert.deepEqual(v4.map(t => t.id), ['p01-read-sounding-at', 'p02-read-group-timing', 'p03-author-constrained', 'p04-author-known-spread',
    'p05-edit-velocity-large', 'p06-transpose-every-pitch', 'p07-halve-spread-move-anchor', 'p08-shift-transpose-range',
    'p09-delete-near-miss', 'p10-refuse-ambiguous-pitch', 'p11-preserve-window', 'p12-preserve-exact-wider']);
  for (const id of ['p02', 'p03', 'p04', 'p05', 'p11', 'p12']) assert.deepEqual(byId(v4, id), byId(v3, id), `${id} unchanged`);
  const { conditionalRefusal, version, ...p10 } = byId(v4, 'p10');
  assert.deepEqual([conditionalRefusal, version, p10], [true, 2, (({ version: _, ...rest }) => rest)(byId(v3, 'p10'))]);
  const [A, B, C] = windows.works.map(w => w.notes), end = x => add(x.at, x.duration);
  // p01 reads work C at a time where notes start, end and are held.
  const p01 = byId(v4, 'p01'), [, t] = p01.request.match(/sounding at quarter (\S+):/);
  assert.equal(p01.input.notes.length, C.length);
  assert(C.some(x => cmp(x.at, t) === 0) && C.some(x => cmp(end(x), t) === 0) && C.some(x => cmp(x.at, t) < 0 && cmp(end(x), t) > 0));
  assert.deepEqual(p01.answer, { total: C.length, sounding: C.filter(x => cmp(x.at, t) <= 0 && cmp(end(x), t) > 0).length });
  // p06 moves every note of one pitch and nothing else.
  const p06 = byId(v4, 'p06'), pitch = Number(p06.request.match(/pitch (\d+) up/)[1]);
  const moved = p06.expected.notes.filter((x, i) => x.pitch !== p06.input.notes[i].pitch);
  assert(moved.length >= 5 && moved.length <= 10);
  assert.equal(moved.length, p06.input.notes.filter(x => x.pitch === pitch).length);
  assert(moved.every(x => x.pitch === pitch + 2));
  // p08 bounds are note onsets: the note at the lower bound moves, the note at the upper bound stays.
  const p08 = byId(v4, 'p08'), [, from, to] = p08.request.match(/at least (\S+) and less than (\S+),/);
  assert(A.some(x => x.at === from) && A.some(x => x.at === to));
  p08.input.notes.forEach((x, i) => {
    const inside = cmp(x.at, from) >= 0 && cmp(x.at, to) < 0, out = p08.expected.notes[i];
    assert.deepEqual([out.at, out.pitch], inside ? [add(x.at, '1/8'), x.pitch + 2] : [x.at, x.pitch]);
  });
  // p09: exactly one match in range and a same-pitch note exactly at the excluded bound.
  const p09 = byId(v4, 'p09'), [, p, lo, hi] = p09.request.match(/pitch (\d+) whose onset is at least (\S+) and less than (\S+)\./);
  const matches = B.filter(x => x.pitch === Number(p) && cmp(x.at, lo) >= 0 && cmp(x.at, hi) < 0);
  assert.equal(matches.length, 1);
  assert(B.some(x => x.pitch === Number(p) && cmp(x.at, hi) === 0));
  assert.deepEqual(p09.expected.notes.map(x => x.id), B.filter(x => x.id !== matches[0].id).map(x => x.id));
  assert.notEqual(matches[0].id, byId(v4, 'p05').input.notes.find((x, i) => x.velocity !== byId(v4, 'p05').expected.notes[i].velocity).id);
  assert.equal(p09.conditionalRefusal, true);
  assert.equal(p09.request.replace(/pitch \d+ whose onset is at least \S+ and less than \S+\./, ''),
    byId(v4, 'p10').request.replace(/pitch \d+ whose onset is at least \S+ and less than \S+\./, ''), 'p09 and p10 share wording');
  // p07: six members, odd spread cells, halves off the 1/512 grid, anchor moved and equations consistent.
  const p07 = byId(v4, 'p07'), [inputGroup, inner] = p07.input.groups, outGroup = p07.expected.groups[0];
  assert.equal(inputGroup.members.length, 6);
  assert(Object.values(inputGroup.spread).filter(v => Math.round(numeric(v) * 512) % 2 === 1).length >= 3, 'odd cells');
  assert(Object.values(outGroup.spread).some(v => !Number.isInteger(numeric(v) * 512)), 'off-grid halves');
  assert.notEqual(outGroup.anchor, inputGroup.anchor);
  for (const fixture of [p07.input, p07.expected]) {
    const group = fixture.groups[0];
    for (const id of group.members) assert.equal(fixture.notes.find(x => x.id === id).at, add(add(group.anchor, group.delay), group.spread[id]));
  }
  assert.deepEqual(p07.expected.groups[1], inner);
  assert(inner.members.every(id => inputGroup.members.includes(id)), 'protected group shares members');
});

test('package v4 changes only the five replaced tasks and the p09/p10 response line (D61)', () => {
  const v3 = resolvePackage('pilot-development-v3'), v4 = resolvePackage('pilot-development-v4');
  assert.deepEqual([v4.manifest.packageVersion, v4.manifest.taskRevision, v4.manifest.promptRevision, v4.manifest.inputVersion], [4, 4, 2, 2]);
  assert.equal(v4.manifest.taskRules.schema, 'r01-pilot-task-rules-v3');
  const shape = pkg => pkg.manifest.cells.map(c => [c.id.slice(0, 3), c.arm, c.eligible, c.role]);
  assert.deepEqual(shape(v4), shape(v3), 'same cell structure and eligibility');
  assert.deepEqual([v4.manifest.counts.eligibleCells, v4.manifest.counts.exclusions], [67, 17]);
  const v3Pairs = new Map(v3.pairs.map(p => [p.id, p]));
  const line = 'Return the complete native output surface, or only the specified REFUSE code when its condition holds.';
  for (const pair of v4.pairs) {
    const prefix = pair.task.slice(0, 3), old = v3Pairs.get(pair.id);
    if (['p09', 'p10'].includes(prefix)) assert(pair.prompt.includes(`\n${line}\n`), `${pair.id}: shared response line`);
    else assert(!pair.prompt.includes(line));
    if (['p02', 'p03', 'p04', 'p05', 'p11', 'p12'].includes(prefix)) assert.equal(pair.prompt, old.prompt, `${pair.id}: prompt unchanged`);
    if (prefix === 'p10') assert.equal(pair.prompt, old.prompt.replace('Return only the specified REFUSE code when its condition holds.', line));
  }
});

test('pilot tasks (revision 5): v4 plus four group-timing tasks with consistent equations (D63)', () => {
  const v4 = pilotTasks(undefined, { revision: 4 }), v5 = pilotTasks(), byId = id => v5.find(t => t.id.startsWith(id));
  assert.deepEqual(v5.slice(0, 12), v4, 'p01-p12 unchanged');
  assert.deepEqual(v5.slice(12).map(t => [t.id, t.version, t.cohort, t.diagnostics, t.source]), [
    ['p13-read-derived-window', 1, 'source', true, 'synthetic'], ['p14-group-existing-notes', 1, 'source', true, 'synthetic'],
    ['p15-move-member-between-groups', 1, 'source', true, 'synthetic'], ['p16-retime-two-groups', 1, 'source', true, 'synthetic']]);
  assert.deepEqual(v5.slice(12), groupTimingTasks().map(t => ({ version: 1, ...t })));
  const timed = g => Object.hasOwn(g, 'spread');
  for (const task of v5.slice(12)) for (const fixture of [task.input, task.expected].filter(Boolean)) {
    // Valid structure: one timing owner per note and every group equation holds.
    validateStructuredFixture(structuredClone(fixture));
    if (!task.id.startsWith('p14')) assert(fixture.groups.some(g => !timed(g)), `${task.id}: a timing-free group is present`);
    assert(fixture.notes.some(x => !fixture.groups.some(g => g.members.includes(x.id))), `${task.id}: a loose note is present`);
    // Note-array order equals C4 block traversal, so no order cells are needed.
    assert(!/FIELDS .*\border\b/.test(encodeNestedFields(fixture)), `${task.id}: no order cells`);
  }
  // p13: both bounds are derived onsets; omitting the delay moves a note across each.
  const p13 = byId('p13'), [, from, to] = p13.request.match(/at least (\S+) and less than (\S+),/);
  const owner = id => p13.input.groups.find(g => g.spread?.[id] !== undefined), at = id => p13.input.notes.find(x => x.id === id).at;
  const atFrom = p13.input.notes.find(x => x.at === from), atTo = p13.input.notes.find(x => x.at === to);
  assert(owner(atFrom.id) && owner(atTo.id));
  assert(cmp(add(owner(atFrom.id).anchor, owner(atFrom.id).spread[atFrom.id]), from) < 0);
  assert(cmp(add(owner(atTo.id).anchor, owner(atTo.id).spread[atTo.id]), to) < 0);
  const ids = p13.answer.ids;
  assert(ids.includes(atFrom.id) && !ids.includes(atTo.id));
  assert(ids.every(id => cmp(at(id), from) >= 0 && cmp(at(id), to) < 0));
  assert.equal(ids.length, p13.input.notes.filter(x => cmp(x.at, from) >= 0 && cmp(x.at, to) < 0).length);
  for (let i = 1; i < ids.length; i++) assert(cmp(at(ids[i - 1]), at(ids[i])) < 0 || (at(ids[i - 1]) === at(ids[i]) && ids[i - 1] < ids[i]));
  assert(ids.some((id, i) => i && at(id) === at(ids[i - 1])), 'an onset tie is in range');
  assert(ids.some(id => !p13.input.groups.some(g => g.members.includes(id))), 'a loose note is in range');
  assert(ids.some(id => !owner(id) && p13.input.groups.some(g => g.members.includes(id))), 'an untimed group member is in range');
  // p14: every onset is unchanged; the five loose notes become one appended timed group.
  const p14 = byId('p14'), made = p14.expected.groups.at(-1);
  assert.deepEqual(p14.expected.notes, p14.input.notes);
  assert.deepEqual(p14.expected.groups.slice(0, -1), p14.input.groups);
  assert.equal(made.members.length, 5);
  assert(made.members.every(id => !p14.input.groups.some(g => g.members.includes(id))));
  assert.notEqual(rational(made.delay)[1], 512n, 'delay and onsets use different denominators');
  // p15: one move, one timing owner, appended to the target, kept in the timing-free group.
  const p15 = byId('p15'), [toIn, fromIn, padIn] = p15.input.groups, [toOut, fromOut, padOut] = p15.expected.groups;
  const moved = toOut.members.at(-1);
  assert.deepEqual([fromIn.members[0], toOut.members.slice(0, -1), fromOut.members], [moved, toIn.members, fromIn.members.slice(1)]);
  assert.deepEqual(toOut.performanceOrder, [...toIn.performanceOrder, moved]);
  assert.equal(fromOut.spread[moved], undefined);
  assert.deepEqual(padOut, padIn); assert(padIn.members.includes(moved));
  assert.equal(p15.expected.notes.find(x => x.id === moved).at, add(add(toOut.anchor, toOut.delay), toOut.spread[moved]));
  p15.expected.notes.forEach((x, i) => { if (x.id !== moved) assert.deepEqual(x, p15.input.notes[i]); });
  // p16: the first group's anchor moves, the second group's spreads double; nothing else moves.
  const p16 = byId('p16'), [aIn, bIn, tieIn] = p16.input.groups, [aOut, bOut] = p16.expected.groups;
  const [, move] = p16.request.match(/later by (\S+),/);
  assert.equal(aOut.anchor, add(aIn.anchor, move));
  for (const id of bIn.members) assert.equal(bOut.spread[id], add(bIn.spread[id], bIn.spread[id]));
  assert(tieIn.members.some(id => aIn.members.includes(id)) && tieIn.members.some(id => bIn.members.includes(id)));
  p16.input.notes.forEach((x, i) => {
    const out = p16.expected.notes[i], member = aIn.members.includes(x.id) || bIn.members.includes(x.id);
    assert.equal(cmp(out.at, x.at) !== 0, member && (aIn.members.includes(x.id) || bIn.spread[x.id] !== '0'), x.id);
  });
});

test('package v5 adds p13-p16 and leaves every v4 prompt and cell unchanged (D63)', () => {
  const v4 = resolvePackage('pilot-development-v4'), v5 = resolvePackage('pilot-development-v5');
  assert.deepEqual([v5.manifest.packageVersion, v5.manifest.taskRevision, v5.manifest.promptRevision, v5.manifest.inputVersion], [5, 5, 2, 2]);
  assert.equal(v5.manifest.taskRules.schema, 'r01-pilot-task-rules-v4');
  const shape = pkg => pkg.manifest.cells.map(c => [c.id, c.arm, c.eligible, c.role]);
  assert.deepEqual(shape(v5).slice(0, v4.manifest.cells.length), shape(v4));
  assert.deepEqual([v5.manifest.counts.eligibleCells, v5.manifest.counts.exclusions], [87, 33]);
  const added = v5.manifest.cells.slice(v4.manifest.cells.length);
  assert.deepEqual(added.filter(c => c.eligible).map(c => c.arm), Array(4).fill(['c3-fields', 'c4-fields', 'c3-json', 'c4-json', 'c4-detached-fields']).flat());
  const v4Pairs = new Map(v4.pairs.map(p => [p.id, p.prompt]));
  for (const pair of v5.pairs) if (v4Pairs.has(pair.id)) assert.equal(pair.prompt, v4Pairs.get(pair.id), `${pair.id}: prompt unchanged`);
  assert.equal(v5.pairs.length - v4.pairs.length, 20);
  assert.deepEqual(v5.manifest.cards, v4.manifest.cards);
  const plan = pilotPlan(v5.manifest, pilotSelection());
  for (const cohort of plan.cohorts) assert.equal(plan.runs.filter(r => r.configSha256 === cohort.configSha256).length, 261);
});
