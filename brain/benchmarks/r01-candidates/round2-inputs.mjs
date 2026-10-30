// R01 round 2 windows (development stage, R01-D8): N-note windows of works 4-6
// without the 16-quarter cap, so performed ladders can scale to 512 notes.
// Reads only the pool assets of those three works; no other work is opened.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSource } from './corpus.mjs';
import { canonical, normalize, spell } from './common.mjs';
import { decodeMetadata, lineageReview, poolAsset, reducedInventory, resolutionOf, workOrder } from './pilot-inputs.mjs';
import { RIGOROUS_WINDOWS_PATH, loadWindows, synthesizeVelocities } from './pilot-tasks.mjs';
import { DELETE_WINDOW, INSTANCES, LADDERS, ROUND2_SEEDS, WINDOW_SIZES, plantNearMisses, rangeEditTarget } from './round2-tasks.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');

export const ROUND2_WINDOW_RULES = Object.freeze({
  schema: 'r01-round2-window-rules-v1', stage: 'development', round: 2,
  works: 'Positions 4-6 of the seeded work order (the first rigorous round\'s works, R01-D8); every other work stays closed.',
  pool: 'transcript-muscriptor-large, program below 128, not drums, mapped or baked timing (as in round 1)',
  sizes: WINDOW_SIZES, instances: INSTANCES,
  window: 'N consecutive notes of one pool asset in decoded order (start tick, track, ID). The first note is the first at its start tick and the next note after the window, if any, starts later, so no chord is split. Onsets are relative to the first note; durations are complete. There is no quarter cap.',
  refusal: 'A window with a normalization collision (two notes sharing pitch and 1/512-normalized onset) is refused, as is one on which a target rule of a family using that size finds no case (range-edit at every size; selective-delete planting at 128 notes for each delete level).',
  assignment: 'Instance k at size N uses the ((k - 1) mod W + 1)-th of the W works with an admissible window at N, in seeded work order. Within a work, candidates of all its assets are ordered by seeded asset order, then start. The first use of a work takes the first admissible candidate; a later use takes the admissible candidate whose largest overlap (shared notes) with that work\'s earlier windows at N is smallest, then the smallest total overlap, then the earlier candidate; no window repeats an earlier instance.',
  velocities: `Admission checks use velocities from ${ROUND2_SEEDS.velocity}, as the tasks do.`,
});

/** Every no-split N-note window start of one decoded asset. */
export function windowStarts(decoded, size) {
  const ticks = decoded.notes.map(x => x.startTick), starts = [];
  for (let i = 0; i + size <= ticks.length; i++) {
    if (i > 0 && ticks[i - 1] === ticks[i]) continue;
    if (i + size < ticks.length && ticks[i + size - 1] === ticks[i + size]) continue;
    starts.push(i);
  }
  return starts;
}

/** The window of `size` notes from note index `start`: normalized notes, exact notes and collisions. */
export function noteWindow(decoded, start, size) {
  const { ppq } = decoded, selected = decoded.notes.slice(start, start + size), first = selected[0].startTick;
  const exact = selected.map(x => ({ id: x.id, pitch: x.pitch, at: spell(BigInt(x.startTick - first), BigInt(ppq)),
    duration: spell(BigInt(x.endTick - x.startTick), BigInt(ppq)), velocity: x.velocity }));
  const notes = exact.map(normalize), seen = new Map();
  for (const x of notes) seen.set(`${x.pitch}@${x.at}`, (seen.get(`${x.pitch}@${x.at}`) ?? 0) + 1);
  const next = decoded.notes[start + size]?.startTick ?? Math.max(...selected.map(x => x.endTick));
  return { start, startTick: first, endTickExclusive: next, notes, exact,
    collisions: [...seen].filter(([, c]) => c > 1).map(([a]) => a) };
}

/** Admission for one size: null, or the first failing rule (velocities as the tasks use them). */
export function admitWindow(size, notes, shardId) {
  const stage = synthesizeVelocities(notes.map(({ id, pitch, at, duration }) => ({ id, pitch, at, duration })), shardId, ROUND2_SEEDS.velocity);
  const rules = [['range-edit', () => rangeEditTarget(stage)]];
  if (size === DELETE_WINDOW) for (const K of LADDERS['selective-delete'].levels)
    rules.push([`selective-delete-${K}`, () => plantNearMisses(stage, K, ['admission', K])]);
  for (const [rule, check] of rules) {
    try { check(); } catch (error) { if (/^no eligible/.test(error.message)) return rule; throw error; }
  }
  return null;
}

/**
 * Select every size's instances from `works` (each { shardId, title, position,
 * assets: [{ asset, decoded }] } in seeded asset order). Pure apart from `admit`.
 */
export function selectRound2Windows(works, { sizes = WINDOW_SIZES, instances = INSTANCES, admit = admitWindow } = {}) {
  const windows = [], attempts = [];
  for (const size of sizes) {
    const candidates = works.map(work => ({ work, list: work.assets.flatMap(({ asset, decoded }, assetIndex) =>
      windowStarts(decoded, size).map(start => ({ asset, decoded, assetIndex, start }))) }));
    const admitted = new Map(), check = (work, c) => {
      const key = `${c.asset.assetId}:${c.start}`;
      if (!admitted.has(key)) {
        const w = noteWindow(c.decoded, c.start, size);
        const rule = w.collisions.length ? null : admit(size, w.notes, work.shardId);
        admitted.set(key, { w, reason: w.collisions.length ? 'normalization-collision' : rule ? 'no-task-target' : null, rule });
      }
      return admitted.get(key);
    };
    const eligible = candidates.filter(({ work, list }) => list.some(c => !check(work, c).reason));
    for (const { work, list } of candidates) attempts.push({ size, work: work.title, shardId: work.shardId,
      candidates: list.length, admissible: list.filter(c => !check(work, c).reason).length,
      refused: Object.entries(list.reduce((r, c) => { const x = check(work, c); if (x.reason) r[x.rule ?? x.reason] = (r[x.rule ?? x.reason] ?? 0) + 1; return r; }, {})) });
    assert(eligible.length, `no work has an admissible ${size}-note window`);
    for (let k = 1; k <= instances; k++) {
      const { work, list } = eligible[(k - 1) % eligible.length];
      const earlier = windows.filter(x => x.size === size && x.shardId === work.shardId);
      const overlaps = c => earlier.filter(x => x.assetId === c.asset.assetId)
        .map(x => Math.max(0, Math.min(x.startIndex + size, c.start + size) - Math.max(x.startIndex, c.start)));
      const ranked = list.filter(c => !check(work, c).reason).map((c, order) => {
        const o = overlaps(c);
        return { c, order, largest: Math.max(0, ...o), total: o.reduce((s, v) => s + v, 0) };
      }).sort((x, y) => x.largest - y.largest || x.total - y.total || x.order - y.order);
      const { c, largest, total: shared } = ranked[0], { w } = check(work, c);
      assert(largest < size, `${size}-note instance ${k} would repeat an earlier window`);
      const resolution = resolutionOf(c.asset), ppq = c.decoded.ppq;
      windows.push({ size, instance: k, work: work.title, shardId: work.shardId, position: work.position,
        assetId: c.asset.assetId, path: c.asset.path, contentHash: c.asset.contentHash, timing: resolution.timing, ticksPerQuarter: ppq,
        startIndex: c.start, startTick: w.startTick, endTickExclusive: w.endTickExclusive,
        startQuarter: spell(BigInt(w.startTick), BigInt(ppq)), spanQuarters: spell(BigInt(w.endTickExclusive - w.startTick), BigInt(ppq)),
        noteCount: size, sharedNotesWithEarlierInstances: shared, largestOverlapWithAnEarlierInstance: largest,
        offGridOnsets: w.exact.filter((x, i) => x.at !== w.notes[i].at).length,
        offGridDurations: w.exact.filter((x, i) => x.duration !== w.notes[i].duration).length,
        notes: w.notes, sourceNotes: w.exact });
    }
  }
  return { windows, attempts };
}

// Windows v3 (R01-D18): 128-note windows extended to eight instances for
// range-edit's fresh instances 5-8. Selection is sequential per instance, so
// instances 1-4 equal the v1 record's; other sizes are not selected.
export const ROUND2_WINDOW_RULES_V3 = Object.freeze({ ...ROUND2_WINDOW_RULES, schema: 'r01-round2-window-rules-v3', sizes: [128], instances: 8 });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [rawInventory, libraryRoot, output, version = '1'] = process.argv.slice(2);
  assert(rawInventory && libraryRoot && output && !existsSync(resolve(output)) && ['1', '3'].includes(version),
    'usage: node --import tsx round2-inputs.mjs RAW_INVENTORY_JSON LIBRARY_ROOT NEW_WINDOWS_JSON [VERSION=1|3]');
  const rules = version === '3' ? ROUND2_WINDOW_RULES_V3 : ROUND2_WINDOW_RULES;
  const rawText = readFileSync(resolve(rawInventory)), raw = JSON.parse(rawText), assets = raw.reply.assets;
  const inventory = reducedInventory(assets), inventoryText = JSON.stringify(inventory, null, 2) + '\n';
  assert.equal(inventoryText, readFileSync(resolve(root, 'context/evidence/data/r01-pilot-inputs/inventory.json'), 'utf8'), 'reduced inventory differs from the retained inventory');
  const retained = JSON.parse(readFileSync(resolve(root, 'context/evidence/data/r01-candidates/corpus-manifest.json'), 'utf8'));
  const review = lineageReview(assets, retained);
  assert(review.pass, 'lineage review failed');
  const order = workOrder(assets, review), chosen = order.slice(3, 6);
  // R01-D8: positions 4-6 are the first rigorous round's works.
  assert.deepEqual(chosen.map(w => w.shardId).sort(), loadWindows(RIGOROUS_WINDOWS_PATH).works.map(w => w.shardId).sort());
  const byId = new Map(assets.map(a => [a.assetId, a]));
  const works = chosen.map((w, i) => ({ shardId: w.shardId, title: w.title, position: i + 4, assets: w.assetOrder.map(id => byId.get(id))
    .filter(a => poolAsset(a) && ['mapped', 'baked'].includes(resolutionOf(a)?.timing) && !a.midi?.tempoIsPlaceholder)
    .map(asset => {
      const path = resolve(libraryRoot, asset.path), rel = relative(resolve(libraryRoot), path);
      assert(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'source path escapes library');
      return { asset, decoded: decodeSource(readFileSync(path), decodeMetadata(asset)) };
    }) }));
  const { windows, attempts } = selectRound2Windows(works, { sizes: rules.sizes, instances: rules.instances });
  const record = { schema: 'r01-round2-windows-v1', stage: 'development', round: 2, rules,
    inventory: { capturedAt: raw.capturedAt, rawSha256: sha(rawText), reducedSha256: sha(canonical(inventory)), assets: assets.length,
      midiAssets: inventory.length, shards: review.groups.length },
    works: works.map(w => ({ position: w.position, shardId: w.shardId, title: w.title,
      assets: w.assets.map(({ asset, decoded }) => ({ assetId: asset.assetId, path: asset.path, notes: decoded.notes.length })) })),
    attempts, windows };
  writeFileSync(resolve(output), JSON.stringify(record, null, 1) + '\n');
  console.log(JSON.stringify({ attempts, windows: windows.map(({ notes, sourceNotes, ...w }) => w) }, null, 1));
}
