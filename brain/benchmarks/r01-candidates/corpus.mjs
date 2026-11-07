/** Read-only, pinned Ghostworks MIDI excerpt extraction. No host or library writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSmf, MIDI_LIMITS } from '../../src/midi/smf.ts';
import { fraction, spelling, normalizeTiming } from '../../src/document/rational.ts';

const dataDirectory = new URL('../../../context/evidence/data/r01-candidates/', import.meta.url);
export const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const beats = (tick, ppq) => spelling(fraction(BigInt(tick), BigInt(ppq)));
const fail = (ok, message) => { if (!ok) throw new Error(message); };

/** FIFO pairing preserves source multiplicity; overlapping note-ons are reported. */
export function decodeSource(bytes, source) {
  fail(hash(bytes) === source.contentHash, `Source hash mismatch: ${source.assetId}`);
  const midi = parseSmf(bytes), notes = [], tempos = [], meters = [], otherEvents = {};
  let overlappingNoteOns = 0;
  for (const [trackIndex, track] of midi.tracks.entries()) {
    const active = new Map(); let noteNumber = 0;
    for (const event of track.events) {
      const kind = event.status >> 4;
      if (kind === 8 || kind === 9) {
        const channel = (event.status & 15) + 1, pitch = event.data[0], key = `${channel}:${pitch}`;
        if (kind === 9 && event.data[1] > 0) {
          const queue = active.get(key) ?? [];
          if (queue.length) overlappingNoteOns++;
          queue.push({ id: `t${trackIndex}n${++noteNumber}`, trackIndex, channel, pitch, startTick: event.tick, velocity: event.data[1] });
          active.set(key, queue);
        } else {
          const queue = active.get(key), start = queue?.shift();
          fail(start, 'Unpaired MIDI note-off');
          fail(event.tick > start.startTick, 'Zero or negative MIDI duration');
          notes.push({ ...start, endTick: event.tick, noteOff: { status: event.status, dataVelocity: event.data[1] } });
          fail(notes.length <= MIDI_LIMITS.notes, 'Source exceeds bounded note count');
          if (!queue.length) active.delete(key);
        }
      } else if (event.meta === 0x51) {
        const microsecondsPerQuarter = event.data.readUIntBE(0, 3);
        fail(microsecondsPerQuarter > 0, 'Zero MIDI tempo');
        tempos.push({ tick: event.tick, microsecondsPerQuarter });
      } else if (event.meta === 0x58) {
        meters.push({ tick: event.tick, numerator: event.data[0], denominator: 2 ** event.data[1], clocksPerClick: event.data[2], thirtySecondsPerQuarter: event.data[3] });
      } else if (event.meta !== 0x2f) {
        const key = event.meta === undefined ? `status-${kind.toString(16)}` : `meta-${event.meta.toString(16)}`;
        otherEvents[key] = (otherEvents[key] ?? 0) + 1;
      }
    }
    fail(active.size === 0, 'MIDI contains unclosed notes');
  }
  const uniqueMap = (entries, name) => {
    const byTick = new Map();
    for (const entry of entries) {
      fail(!byTick.has(entry.tick) || JSON.stringify(byTick.get(entry.tick)) === JSON.stringify(entry), `Conflicting ${name} map`);
      byTick.set(entry.tick, entry);
    }
    return [...byTick.values()].sort((a, b) => a.tick - b.tick);
  };
  const tempoIsImplicit = !tempos.some(t => t.tick === 0);
  if (tempoIsImplicit) tempos.push({ tick: 0, microsecondsPerQuarter: 500000 });
  const tempoMap = uniqueMap(tempos, 'tempo'), meterMap = uniqueMap(meters, 'meter');
  assert.equal(midi.ppq, source.midi.ticksPerQuarter);
  assert.equal(notes.length, source.midi.noteCount);
  assert.equal(Math.max(...midi.tracks.map(t => t.endTick)), source.midi.endTick);
  assert.deepEqual(tempoMap, source.midi.tempoMap);
  assert.deepEqual(meterMap, source.midi.meterMap ?? []);
  assert.equal(tempoIsImplicit, source.midi.tempoIsImplicit ?? false);
  notes.sort((a, b) => a.startTick - b.startTick || a.trackIndex - b.trackIndex || a.id.localeCompare(b.id));
  return { ppq: midi.ppq, notes, tempoMap, meterMap, tempoIsImplicit, overlappingNoteOns, otherEvents };
}

function shiftedMap(map, startTick, endTick, ppq) {
  const active = map.filter(point => point.tick <= startTick).at(-1);
  return [...(active ? [{ ...active, at: '0', sourceTick: active.tick }] : []),
    ...map.filter(point => point.tick > startTick && point.tick <= endTick)
      .map(point => ({ ...point, at: beats(point.tick - startTick, ppq), sourceTick: point.tick }))]
    .map(({ tick: _, ...point }) => point);
}

export function excerptFrom(source, decoded) {
  fail(decoded.notes.length > 0, 'Empty development source');
  const { ppq } = decoded, startTick = decoded.notes[0].startTick;
  const endTick = startTick + source.selection.widthQuarterBeats * ppq;
  const selected = decoded.notes.filter(note => note.startTick >= startTick && note.startTick < endTick);
  fail(selected.length <= source.selection.maxNotes, `Excerpt exceeds ${source.selection.maxNotes} notes; do not truncate`);
  const fullTailEndTick = Math.max(...selected.map(note => note.endTick));
  const notes = selected.map(note => ({ id: note.id, pitch: note.pitch, at: beats(note.startTick - startTick, ppq), duration: beats(note.endTick - note.startTick, ppq), velocity: note.velocity, channel: note.channel }));
  const normalized = notes.map(note => ({ ...note, ...normalizeTiming(note.at, note.duration) }));
  const addressGroups = new Map();
  for (const note of normalized) {
    const key = `${note.channel}:${note.pitch}:${note.at}`;
    addressGroups.set(key, [...(addressGroups.get(key) ?? []), note.id]);
  }
  const collisions = [...addressGroups].filter(([, ids]) => ids.length > 1).map(([address, ids]) => ({ address, ids }));
  const meterMap = shiftedMap(decoded.meterMap, startTick, fullTailEndTick, ppq);
  const meter = meterMap[0] ?? { numerator: 4, denominator: 4 };
  return {
    id: source.id, family: source.family,
    source: { assetId: source.assetId, contentHash: source.contentHash, path: source.path, shardId: source.shardId, shardTitle: source.shardTitle, signalId: source.signalId, origin: source.origin, model: source.model, runId: source.runId, ticksPerQuarter: ppq, timeOrigin: source.midi.timeOrigin, timing: source.resolution.timing, sourceSecondsAtTickZero: source.resolution.sourceSecondsAtTickZero, velocityIsPlaceholder: true },
    meter: { numerator: meter.numerator, denominator: meter.denominator },
    meterBasis: decoded.meterMap.length ? 'source-MIDI-map; excerpt origin is not necessarily a bar boundary' : 'synthetic-4/4-display-coordinate; musical-meter-unresolved',
    extraction: { startTick, endTickExclusive: endTick, fullTailEndTick, shiftQuarterBeats: beats(startTick, ppq), policy: 'onsets-in-half-open-window; complete-note-tails; no-quantization', carryInNotes: 0 },
    timingContext: { tempoIsImplicit: decoded.tempoIsImplicit, tempoMap: shiftedMap(decoded.tempoMap, startTick, fullTailEndTick, ppq), meterMap, resolution: source.resolution },
    notes,
    sourceEventDetails: selected.map(note => ({ id: note.id, trackIndex: note.trackIndex, startTick: note.startTick, endTick: note.endTick, noteOff: note.noteOff })),
    metrics: { notes: notes.length, uniquePitches: new Set(notes.map(note => note.pitch)).size, sourceOverlappingNoteOns: decoded.overlappingNoteOns, off512Onsets: normalized.filter(note => note.atDelta !== '0').length, off512Durations: normalized.filter(note => note.durationDelta !== '0').length, minimumDurationPromotions: normalized.filter(note => note.minimumDurationPromotion).length, tailsBeyondWindow: selected.filter(note => note.endTick > endTick).length, normalizedAddressCollisions: collisions },
    limitations: { intent: 'unknown; instrument family is exporter metadata, not verified performance technique', dynamics: 'fixed velocity 64; does not establish original dynamics', nonNoteEvents: decoded.otherEvents, hostAdmission: collisions.length ? 'refused: duplicate normalized pitch/channel/onset addresses; retain all notes as representation witness' : 'no duplicate normalized pitch/channel/onset addresses; this is not a host-write verification' },
  };
}

export function validateSplits(manifest) {
  const identities = new Map();
  for (const group of manifest.groups) {
    const refs = [...group.sourceRefs, ...(group.extractionSourceRefs ?? [])];
    const tokens = [...group.signalIds.map(id => `signal:${id}`), ...refs.flatMap(ref => [`asset:${ref.assetId}`, `hash:${ref.contentHash}`]), ...(group.ancestorContentHashes ?? []).map(hash => `hash:${hash}`)];
    for (const token of tokens) {
      fail(!identities.has(token) || identities.get(token) === group.split, `Development/holdout lineage overlap: ${token}`);
      identities.set(token, group.split);
    }
  }
  for (const source of manifest.sources) {
    const group = manifest.groups.find(group => group.shardId === source.shardId);
    fail(group?.split === 'development', 'Attempt to open a reserved work');
    fail(group.assets.some(asset => asset.assetId === source.assetId && asset.contentHash === source.contentHash), 'Development source missing pinned inventory entry');
  }
}

export async function buildCorpus(manifest, libraryRoot) {
  validateSplits(manifest);
  const excerpts = [];
  for (const source of manifest.sources) {
    const path = resolve(libraryRoot, source.path), rel = relative(resolve(libraryRoot), path);
    fail(rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), 'Source path escapes library');
    const decoded = decodeSource(await readFile(path), source);
    excerpts.push(excerptFrom(source, decoded));
  }
  return { schema: 'r01-corpus-excerpts-v1', manifestHash: hash(JSON.stringify(manifest)), split: 'development', excerpts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, libraryRoot, ...extra] = process.argv.slice(2);
  fail(['--check', '--write'].includes(mode) && libraryRoot && !extra.length, 'Usage: node --import tsx benchmarks/r01-candidates/corpus.mjs (--check|--write) LIBRARY_ROOT');
  const manifest = JSON.parse(await readFile(new URL('corpus-manifest.json', dataDirectory), 'utf8'));
  const corpus = await buildCorpus(manifest, libraryRoot);
  const serialized = `${JSON.stringify(corpus, null, 2)}\n`;
  const target = new URL('corpus-excerpts.json', dataDirectory);
  if (mode === '--write') await writeFile(target, serialized);
  else assert.equal(await readFile(target, 'utf8'), serialized, 'Pinned corpus differs; inspect source and extraction changes');
  console.log(JSON.stringify({ mode, excerpts: corpus.excerpts.map(excerpt => ({ id: excerpt.id, ...excerpt.metrics })) }, null, 2));
}
