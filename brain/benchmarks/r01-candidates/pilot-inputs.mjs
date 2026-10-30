// R01 pilot inputs (development stage): refreshed inventory and lineage check,
// seeded work and asset selection, and 16-quarter window extraction under the
// pilot draft's refusal and next-window rules. Reads only the MIDI files of
// the works it selects, in seeded order, until three windows are accepted.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSource, validateSplits } from './corpus.mjs';
import { shuffled } from './cli-trial-plan.mjs';
import { canonical, normalize, spell } from './common.mjs';
import { RIGOROUS_SEEDS, WINDOWS_PATH, loadWindows, synthesizeVelocities, targetRuleFailure } from './pilot-tasks.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
import { DATA } from './pilot-tasks.mjs';
export { DATA };
const sha = value => createHash('sha256').update(value).digest('hex');

export const SELECTION = Object.freeze({
  schema: 'r01-pilot-selection-rules-v1', stage: 'development', seed: 'r01-pilot-selection-v1', works: 3,
  pool: 'transcript-muscriptor-large', windowQuarters: 16, minNotes: 16, maxNotes: 128, maxWindowsPerAsset: 8,
});

// Version 2 replaces the first-window rule, which favoured sparse openings
// (E366), with the densest admissible window across the work's pool assets.
export const SELECTION_V2 = Object.freeze({ ...SELECTION, schema: 'r01-pilot-selection-rules-v2',
  rule: 'densest admissible window: for every pool asset of the work and every distinct note onset as a start, count onsets in the 16-quarter half-open window; admit 16-128 notes without a normalization collision; take the largest count, then the earlier asset in seeded order, then the earlier start' });

export const resolutionOf = asset => asset.transcription?.resolution ?? asset.provenance?.exporter?.report?.resolution ?? null;

/** Identity, lineage and timing metadata for MIDI assets; no tempo maps or analysis payloads. */
export function reducedInventory(assets) {
  return assets.filter(a => a.kind === 'midi').map(a => ({ shardId: a.shardId, shardTitle: a.shardTitle, assetId: a.assetId,
    contentHash: a.contentHash, path: a.path, signalId: a.signalId ?? null, origin: a.origin, model: a.model ?? null,
    runId: a.runId ?? null, derivedFrom: a.derivedFrom ?? [], timing: resolutionOf(a)?.timing ?? null,
    program: a.midi?.program ?? null, isDrum: a.midi?.isDrum ?? null, ticksPerQuarter: a.midi?.ticksPerQuarter ?? null,
    noteCount: a.midi?.noteCount ?? null })).sort((a, b) => a.assetId.localeCompare(b.assetId));
}

/** Rebuild the retained manifest's shard groups: assets, signal IDs and self/derivedFrom references. */
export function inventoryGroups(assets) {
  const shards = new Map();
  for (const a of assets) {
    const g = shards.get(a.shardId) ?? { shardId: a.shardId, title: a.shardTitle, signalIds: new Set(), refs: new Map(), assets: [] };
    if (a.signalId) g.signalIds.add(a.signalId);
    for (const ref of [{ assetId: a.assetId, contentHash: a.contentHash }, ...(a.derivedFrom ?? [])]) g.refs.set(ref.assetId, ref);
    if (a.kind === 'midi') g.assets.push({ assetId: a.assetId, contentHash: a.contentHash, path: a.path, signalId: a.signalId });
    shards.set(a.shardId, g);
  }
  return [...shards.values()].map(g => ({ shardId: g.shardId, title: g.title, signalIds: [...g.signalIds].sort(),
    sourceRefs: [...g.refs.values()].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    assets: g.assets.sort((a, b) => a.assetId.localeCompare(b.assetId)) })).sort((a, b) => a.shardId.localeCompare(b.shardId));
}

/**
 * Compare the refreshed groups with the retained manifest, rerun the split
 * validator, and check that no two shards share a signal, asset or hash, so
 * the selected works are independent of each other as well as of development.
 */
export function lineageReview(assets, retained) {
  const fresh = inventoryGroups(assets);
  // Compared fields only. The retained manifest writes absent signal IDs as
  // null; its extra audit fields (extraction refs, ancestor hashes) are not
  // derivable from discovery metadata and are carried forward below.
  const identity = g => ({ shardId: g.shardId, title: g.title, signalIds: [...g.signalIds].sort(),
    sourceRefs: [...g.sourceRefs].sort((a, b) => a.assetId.localeCompare(b.assetId)),
    assets: g.assets.map(({ assetId, contentHash, path, signalId }) => ({ assetId, contentHash, path, ...(signalId ? { signalId } : {}) }))
      .sort((a, b) => a.assetId.localeCompare(b.assetId)) });
  const old = new Map(retained.groups.map(g => [g.shardId, g]));
  const changedShards = fresh.filter(g => !old.has(g.shardId) || canonical(identity(g)) !== canonical(identity(old.get(g.shardId)))).map(g => g.title);
  const removedShards = [...old.keys()].filter(id => !fresh.some(g => g.shardId === id));
  const groups = fresh.map(g => {
    const prior = old.get(g.shardId);
    return { ...g, split: prior?.split ?? 'unreviewed',
      ...Object.fromEntries(['extractionSourceRefs', 'ancestorContentHashes'].filter(k => prior?.[k]).map(k => [k, prior[k]])) };
  });
  validateSplits({ groups, sources: retained.sources });
  const owner = new Map(), shared = [];
  for (const g of groups) for (const token of new Set([...g.signalIds.map(id => `signal:${id}`),
    ...[...g.sourceRefs, ...(g.extractionSourceRefs ?? [])].flatMap(r => [`asset:${r.assetId}`, `hash:${r.contentHash}`]),
    ...(g.ancestorContentHashes ?? []).map(h => `hash:${h}`)])) {
    if (owner.has(token) && owner.get(token) !== g.shardId) shared.push({ token, shards: [owner.get(token), g.shardId] });
    owner.set(token, g.shardId);
  }
  return { groups, changedShards, removedShards, unreviewedShards: groups.filter(g => g.split === 'unreviewed').map(g => g.title),
    crossShardSharedTokens: shared, pass: !changedShards.length && !removedShards.length && !shared.length
      && groups.every(g => g.split !== 'unreviewed') };
}

export const poolAsset = a => a.kind === 'midi' && a.path.split('/')[2] === SELECTION.pool
  && Number(a.path.split('/').at(-1).slice(0, 3)) < 128 && a.midi?.isDrum !== true;

/** Every eligible reserved work in seeded order, each with its seeded asset order. Metadata only. */
export function workOrder(assets, review, seed = SELECTION.seed) {
  const eligible = review.groups.filter(g => g.split === 'reserved')
    .map(g => ({ shardId: g.shardId, title: g.title, pool: assets.filter(a => a.shardId === g.shardId && poolAsset(a)) }))
    .filter(w => w.pool.length);
  const ids = eligible.map(w => w.shardId).sort();
  return shuffled(ids, [seed, 'works']).map(id => {
    const work = eligible.find(w => w.shardId === id);
    return { shardId: id, title: work.title,
      assetOrder: shuffled(work.pool.map(a => a.assetId).sort(), [seed, 'assets', id]) };
  });
}

/** One candidate window: notes whose onset lies in [start, start + 16 quarters), with complete durations. */
export function windowAt(decoded, startTick) {
  const { ppq } = decoded, endTick = startTick + SELECTION.windowQuarters * ppq;
  const selected = decoded.notes.filter(n => n.startTick >= startTick && n.startTick < endTick);
  const exact = selected.map(n => ({ id: n.id, pitch: n.pitch, at: spell(BigInt(n.startTick - startTick), BigInt(ppq)),
    duration: spell(BigInt(n.endTick - n.startTick), BigInt(ppq)), velocity: n.velocity }));
  const notes = exact.map(normalize);
  const addresses = new Map();
  for (const n of notes) addresses.set(`${n.pitch}@${n.at}`, [...(addresses.get(`${n.pitch}@${n.at}`) ?? []), n.id]);
  const collisions = [...addresses].filter(([, ids]) => ids.length > 1).map(([address, ids]) => ({ address, ids }));
  const refusal = selected.length > SELECTION.maxNotes ? 'more-than-128-notes'
    : selected.length < SELECTION.minNotes ? 'fewer-than-16-notes'
    : collisions.length ? 'normalization-collision' : null;
  return { startTick, endTickExclusive: endTick, noteCount: selected.length, refusal, collisions,
    notes, exact, ticks: selected.map(n => ({ id: n.id, trackIndex: n.trackIndex, channel: n.channel, startTick: n.startTick, endTick: n.endTick })) };
}

/** Next-window rule: the first onset at or after the refused start + 16 quarters. */
export function nextStart(decoded, refusedStart) {
  const after = refusedStart + SELECTION.windowQuarters * decoded.ppq;
  return decoded.notes.find(n => n.startTick >= after)?.startTick ?? null;
}

/** Walk one asset's windows; return the accepted window or null, recording each refusal. */
export function assetWindows(decoded, attempts, base) {
  let start = decoded.notes[0]?.startTick ?? null;
  for (let index = 0; start !== null && index < SELECTION.maxWindowsPerAsset; index++) {
    const window = windowAt(decoded, start);
    attempts.push({ ...base, windowIndex: index, startTick: start, noteCount: window.noteCount,
      outcome: window.refusal ? 'refused' : 'accepted', reason: window.refusal,
      ...(window.collisions.length ? { collisions: window.collisions } : {}) });
    if (!window.refusal) return window;
    start = nextStart(decoded, start);
  }
  if (start === null) attempts.push({ ...base, outcome: 'asset-exhausted', reason: 'no further onset for a next window' });
  else attempts.push({ ...base, outcome: 'asset-exhausted', reason: 'window limit reached' });
  return null;
}

export const decodeMetadata = asset => ({ assetId: asset.assetId, contentHash: asset.contentHash, midi: {
  ticksPerQuarter: asset.midi.ticksPerQuarter, noteCount: asset.midi.noteCount, endTick: asset.midi.endTick,
  tempoMap: asset.midi.tempoMap, meterMap: asset.midi.meterMap ?? [], tempoIsImplicit: asset.midi.tempoIsImplicit ?? false } });

/** Every distinct-onset start with its note count, largest first, then earliest. Two-pointer scan. */
export function windowCandidates(decoded) {
  const starts = [...new Set(decoded.notes.map(n => n.startTick))], width = SELECTION.windowQuarters * decoded.ppq;
  const ticks = decoded.notes.map(n => n.startTick);
  const result = [];
  let lo = 0, hi = 0;
  for (const start of starts) {
    while (lo < ticks.length && ticks[lo] < start) lo++;
    while (hi < ticks.length && ticks[hi] < start + width) hi++;
    result.push({ startTick: start, count: hi - lo });
  }
  return result.sort((a, b) => b.count - a.count || a.startTick - b.startTick);
}

/** The densest admissible window of one decoded asset, with scan statistics. */
export function densestWindow(decoded) {
  const candidates = windowCandidates(decoded);
  const stats = { candidates: candidates.length, over128: candidates.filter(c => c.count > SELECTION.maxNotes).length,
    under16: candidates.filter(c => c.count < SELECTION.minNotes).length, collisionsSkipped: 0 };
  for (const candidate of candidates) {
    if (candidate.count > SELECTION.maxNotes) continue;
    if (candidate.count < SELECTION.minNotes) break;
    const window = windowAt(decoded, candidate.startTick);
    if (!window.refusal) return { window, stats };
    stats.collisionsSkipped++;
  }
  return { window: null, stats };
}

function acceptedRecord(label, work, asset, resolution, decoded, window) {
  return { label, shardId: work.shardId, work: work.title, assetId: asset.assetId, path: asset.path,
    contentHash: asset.contentHash, signalId: asset.signalId, origin: asset.origin, model: asset.model, runId: asset.runId,
    timing: { mode: resolution.timing, resolution: Object.fromEntries(Object.entries(resolution).filter(([k]) => k !== 'notes')),
      ticksPerQuarter: decoded.ppq, tempoIsImplicit: decoded.tempoIsImplicit },
    window: { startTick: window.startTick, endTickExclusive: window.endTickExclusive,
      startQuarter: spell(BigInt(window.startTick), BigInt(decoded.ppq)), noteCount: window.noteCount,
      offGridOnsets: window.exact.filter((n, i) => n.at !== window.notes[i].at).length,
      offGridDurations: window.exact.filter((n, i) => n.duration !== window.notes[i].duration).length },
    notes: window.notes, sourceNotes: window.exact, sourceTicks: window.ticks };
}

/** Version 2: scan every pool asset of works A-C (in seeded order) and keep each work's densest admissible window. */
export function selectDenseWindows(assets, order, libraryRoot, readFile = path => readFileSync(path), decode = decodeSource) {
  const byId = new Map(assets.map(a => [a.assetId, a])), attempts = [], works = [];
  for (const work of order) {
    if (works.length === SELECTION.works) break;
    let best = null;
    for (const assetId of work.assetOrder) {
      const asset = byId.get(assetId), base = { work: work.title, shardId: work.shardId, assetId, path: asset.path };
      const resolution = resolutionOf(asset);
      if (!['mapped', 'baked'].includes(resolution?.timing) || asset.midi?.tempoIsPlaceholder) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'invalid-or-unresolved-timing-metadata' }); continue;
      }
      const path = resolve(libraryRoot, asset.path), rel = relative(resolve(libraryRoot), path);
      assert(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'source path escapes library');
      let decoded;
      try { decoded = decode(readFile(path), decodeMetadata(asset)); } catch (error) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'source-decode-refused', message: error.message }); continue;
      }
      const { window, stats } = densestWindow(decoded);
      attempts.push({ ...base, outcome: window ? 'scanned' : 'no-admissible-window', ...stats,
        ...(window ? { startTick: window.startTick, noteCount: window.noteCount } : {}) });
      // Strictly larger only: ties keep the earlier asset in seeded order.
      if (window && (!best || window.noteCount > best.window.noteCount)) best = { asset, resolution, decoded, window };
    }
    if (best) {
      works.push(acceptedRecord('ABC'[works.length], work, best.asset, best.resolution, best.decoded, best.window));
      attempts.push({ work: work.title, shardId: work.shardId, outcome: 'selected', assetId: best.asset.assetId,
        startTick: best.window.startTick, noteCount: best.window.noteCount });
    } else attempts.push({ work: work.title, shardId: work.shardId, outcome: 'work-exhausted', reason: 'no admissible window in any pool asset' });
  }
  return { works, attempts };
}

// Rigorous stage (R01-D2, R01-D3): the v2 rule over the next unused works,
// where a window on which a role's target rule finds no case is refused.
export const SELECTION_RIGOROUS = Object.freeze({ ...SELECTION_V2, schema: 'r01-pilot-selection-rules-v3', stage: 'rigorous',
  works: 3, skip: 'works selected for the development stage (input v2 works A-C) are skipped; the next works in seeded order fill roles A, B and C',
  targetRefusal: 'R01-D3: a window on which any target rule of its role (A p08; B p05, p09; C p01, p06) finds no eligible case, after the stage velocities, is refused as no-task-target; the next candidate in the same order follows (note count descending, then earlier asset in seeded order, then earlier start); a work with no passing candidate is exhausted and the next work takes the role' });

/**
 * Rigorous selection: for each work not in `exclude`, rank every admissible-size
 * window of every decodable pool asset by note count, asset order and start,
 * and accept the first without a normalization collision whose role passes
 * `admit(role, notes, shardId)` (null, or the failing rule's name). Equals
 * selectDenseWindows when admit always passes.
 */
export function selectRigorousWindows(assets, order, libraryRoot, { exclude, admit, readFile = path => readFileSync(path), decode = decodeSource }) {
  assert(exclude instanceof Set && typeof admit === 'function', 'rigorous selection needs exclude and admit');
  const byId = new Map(assets.map(a => [a.assetId, a])), attempts = [], works = [];
  for (const work of order) {
    if (works.length === SELECTION_RIGOROUS.works) break;
    if (exclude.has(work.shardId)) { attempts.push({ work: work.title, shardId: work.shardId, outcome: 'development-work-skipped' }); continue; }
    const role = 'ABC'[works.length], decodedAssets = [];
    for (const assetId of work.assetOrder) {
      const asset = byId.get(assetId), base = { work: work.title, shardId: work.shardId, assetId, path: asset.path };
      const resolution = resolutionOf(asset);
      if (!['mapped', 'baked'].includes(resolution?.timing) || asset.midi?.tempoIsPlaceholder) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'invalid-or-unresolved-timing-metadata' }); continue;
      }
      const path = resolve(libraryRoot, asset.path), rel = relative(resolve(libraryRoot), path);
      assert(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'source path escapes library');
      let decoded;
      try { decoded = decode(readFile(path), decodeMetadata(asset)); } catch (error) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'source-decode-refused', message: error.message }); continue;
      }
      const candidates = windowCandidates(decoded);
      attempts.push({ ...base, outcome: 'scanned', candidates: candidates.length,
        over128: candidates.filter(c => c.count > SELECTION.maxNotes).length,
        under16: candidates.filter(c => c.count < SELECTION.minNotes).length });
      decodedAssets.push({ asset, resolution, decoded, candidates, index: decodedAssets.length });
    }
    const ranked = decodedAssets.flatMap(d => d.candidates
      .filter(c => c.count >= SELECTION.minNotes && c.count <= SELECTION.maxNotes).map(c => ({ ...c, source: d })))
      .sort((x, y) => y.count - x.count || x.source.index - y.source.index || x.startTick - y.startTick);
    let accepted = null, collisionsSkipped = 0;
    for (const candidate of ranked) {
      const window = windowAt(candidate.source.decoded, candidate.startTick);
      if (window.refusal) { collisionsSkipped++; continue; }
      const rule = admit(role, window.notes, work.shardId);
      if (rule) {
        attempts.push({ work: work.title, shardId: work.shardId, assetId: candidate.source.asset.assetId, role,
          startTick: window.startTick, noteCount: window.noteCount, outcome: 'refused', reason: 'no-task-target', rule });
        continue;
      }
      accepted = { ...candidate.source, window }; break;
    }
    if (accepted) {
      works.push(acceptedRecord(role, work, accepted.asset, accepted.resolution, accepted.decoded, accepted.window));
      attempts.push({ work: work.title, shardId: work.shardId, outcome: 'selected', role, assetId: accepted.asset.assetId,
        startTick: accepted.window.startTick, noteCount: accepted.window.noteCount, collisionsSkipped });
    } else attempts.push({ work: work.title, shardId: work.shardId, outcome: 'work-exhausted', role, collisionsSkipped,
      reason: 'no admissible window passes the role\'s target rules in any pool asset' });
  }
  return { works, attempts };
}

/** Version 1 (E366): select works A-C in seeded order, opening only the files needed to accept one window per work. */
export function selectWindows(assets, order, libraryRoot, readFile = path => readFileSync(path)) {
  const byId = new Map(assets.map(a => [a.assetId, a])), attempts = [], works = [];
  for (const work of order) {
    if (works.length === SELECTION.works) break;
    let accepted = null;
    for (const assetId of work.assetOrder) {
      const asset = byId.get(assetId), base = { work: work.title, shardId: work.shardId, assetId, path: asset.path };
      const resolution = resolutionOf(asset);
      if (!['mapped', 'baked'].includes(resolution?.timing) || asset.midi?.tempoIsPlaceholder) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'invalid-or-unresolved-timing-metadata' }); continue;
      }
      const path = resolve(libraryRoot, asset.path), rel = relative(resolve(libraryRoot), path);
      assert(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'source path escapes library');
      let decoded;
      try { decoded = decodeSource(readFile(path), decodeMetadata(asset)); } catch (error) {
        attempts.push({ ...base, outcome: 'asset-refused', reason: 'source-decode-refused', message: error.message }); continue;
      }
      const window = assetWindows(decoded, attempts, base);
      if (!window) continue;
      accepted = { label: 'ABC'[works.length], shardId: work.shardId, work: work.title, assetId, path: asset.path,
        contentHash: asset.contentHash, signalId: asset.signalId, origin: asset.origin, model: asset.model, runId: asset.runId,
        timing: { mode: resolution.timing, resolution: Object.fromEntries(Object.entries(resolution).filter(([k]) => k !== 'notes')),
          ticksPerQuarter: decoded.ppq, tempoIsImplicit: decoded.tempoIsImplicit },
        window: { startTick: window.startTick, endTickExclusive: window.endTickExclusive,
          startQuarter: spell(BigInt(window.startTick), BigInt(decoded.ppq)), noteCount: window.noteCount,
          offGridOnsets: window.exact.filter((n, i) => n.at !== window.notes[i].at).length,
          offGridDurations: window.exact.filter((n, i) => n.duration !== window.notes[i].duration).length },
        notes: window.notes, sourceNotes: window.exact, sourceTicks: window.ticks };
      break;
    }
    if (accepted) works.push(accepted);
    else attempts.push({ work: work.title, shardId: work.shardId, outcome: 'work-exhausted', reason: 'no accepted window in any pool asset' });
  }
  return { works, attempts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [rawInventory, libraryRoot, output, inventoryPath, stage = 'development'] = process.argv.slice(2);
  assert(rawInventory && libraryRoot && output && inventoryPath && !existsSync(resolve(output)) && ['development', 'rigorous'].includes(stage),
    'usage: node --import tsx pilot-inputs.mjs RAW_INVENTORY_JSON LIBRARY_ROOT NEW_WINDOWS_JSON INVENTORY_JSON [development|rigorous]');
  const rawText = readFileSync(resolve(rawInventory));
  const raw = JSON.parse(rawText), assets = raw.reply.assets;
  const retained = JSON.parse(readFileSync(resolve(root, 'context/evidence/data/r01-candidates/corpus-manifest.json'), 'utf8'));
  const review = lineageReview(assets, retained);
  assert(review.pass, `lineage review failed: ${JSON.stringify({ ...review, groups: undefined })}`);
  const order = workOrder(assets, review);
  let works, attempts, development = new Set();
  if (stage === 'rigorous') {
    development = new Set(loadWindows(WINDOWS_PATH).works.map(w => w.shardId));
    assert.equal(development.size, SELECTION.works, 'development windows must name three works');
    const admit = (role, notes, shardId) => targetRuleFailure(role,
      synthesizeVelocities(notes.map(({ id, pitch, at, duration }) => ({ id, pitch, at, duration })), shardId, RIGOROUS_SEEDS.velocity));
    ({ works, attempts } = selectRigorousWindows(assets, order, libraryRoot, { exclude: development, admit }));
  } else ({ works, attempts } = selectDenseWindows(assets, order, libraryRoot));
  assert.equal(works.length, SELECTION.works, `fewer than three works supplied a window: ${JSON.stringify(attempts)}`);
  const inventory = reducedInventory(assets), inventoryText = JSON.stringify(inventory, null, 2) + '\n';
  // A shared reduced inventory is written once and must match thereafter.
  if (existsSync(resolve(inventoryPath))) assert.equal(readFileSync(resolve(inventoryPath), 'utf8'), inventoryText, 'reduced inventory differs');
  else writeFileSync(resolve(inventoryPath), inventoryText);
  const lastUsed = order.findIndex(x => x.shardId === works.at(-1).shardId);
  const selected = new Set(works.map(w => w.shardId));
  const use = (w, i) => development.has(w.shardId) ? 'development'
    : stage === 'rigorous' ? (selected.has(w.shardId) ? 'rigorous' : i <= lastUsed ? 'refused (rigorous stage)' : 'unused')
    : i <= lastUsed ? 'development' : 'unused (rigorous stage)';
  const record = { schema: stage === 'rigorous' ? 'r01-pilot-windows-rigorous-v1' : 'r01-pilot-windows-v2', stage,
    rules: stage === 'rigorous' ? SELECTION_RIGOROUS : SELECTION_V2,
    inventory: { capturedAt: raw.capturedAt, rawSha256: sha(rawText), reducedSha256: sha(canonical(inventory)),
      assets: assets.length, midiAssets: inventory.length, shards: review.groups.length },
    lineage: { changedShards: review.changedShards, removedShards: review.removedShards, unreviewedShards: review.unreviewedShards,
      crossShardSharedTokens: review.crossShardSharedTokens, splitValidator: 'pass', pass: review.pass },
    workOrder: order.map((w, i) => ({ position: i + 1, shardId: w.shardId, title: w.title, poolAssets: w.assetOrder.length, use: use(w, i) })),
    attempts, works };
  writeFileSync(resolve(output), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ works: works.map(w => ({ label: w.label, work: w.work, path: w.path, timing: w.timing.mode, ...w.window })),
    attempts: attempts.map(a => ({ work: a.work, file: a.path?.split('/').at(-1), outcome: a.outcome, reason: a.reason, rule: a.rule, best: a.noteCount, over128: a.over128, collisionsSkipped: a.collisionsSkipped })) }, null, 2));
}
