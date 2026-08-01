/**
 * E16 §3.4j — does `track.setName` round-trip NON-ASCII?
 *
 * ⚠ **The entire lineage-naming scheme rests on one character surviving a write
 * and a read.** §1b of the model puts the branch tag in the track name:
 *
 *     B· Bass different-line
 *     │  │    └── human gist, addressable in natural language
 *     │  └── the original track name
 *     └── lineage tag: uppercase letter + MIDDLE DOT (U+00B7)
 *
 * The middle dot was chosen *because* a human will essentially never type it by
 * accident — which is exactly the property that makes it suspicious as wire
 * data. If it round-trips as `?`, or as a normalised look-alike, or is stripped,
 * then every tag collides with every other and the reaping guard ("refuse to
 * delete an untagged track") silently protects nothing.
 *
 * The handoff calls this cheap and *"an embarrassing thing to discover late"*.
 * It is both, so it is measured before anything is built on it.
 *
 * ⚠ **Testing the middle dot ALONE would be a bad experiment.** If it fails we
 * need to know whether non-ASCII fails wholesale or that one codepoint is
 * special, because those imply completely different fallbacks. So the probe
 * sweeps a set of candidate separators plus a few structural cases, and reports
 * the whole table rather than one bit.
 *
 * Three things beyond the codepoint, each of which would break the scheme in a
 * different way:
 *   - **length** — `Track.addNameObserver` takes a `maxChars` and truncates.
 *     Does `name().get()`? A truncated name loses the gist, and a *long* real
 *     track name plus a tag plus a gist is not a rare case.
 *   - **round-trip through a re-read**, not just the write's own acknowledgement
 *     (standing rule 1: readback is the only truth).
 *   - **exactness by CODEPOINT**, not by eye. `·` (U+00B7) and `∙` (U+2219) and
 *     `•` (U+2022) are visually near-identical at UI sizes, and a silent
 *     substitution would pass any human check.
 *
 * Silent. Creates one throwaway track and deletes it. Safe on a non-TTY.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };

const indexOf = async (channelId: string): Promise<number> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!r.found || r.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return r.index;
};
const nameOf = async (channelId: string): Promise<string | undefined> =>
  (await list()).tracks.find((t) => t.channelId === channelId)?.name;

/** Codepoints, so a look-alike substitution cannot pass as success. */
const codepoints = (s: string) => [...s].map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'));

await client.connect();
console.log('connected\n');

// ---- a throwaway subject -------------------------------------------------
const before = await list();
const beforeIds = new Set(before.tracks.map((t) => t.channelId));
await req('track.create', { position: before.count });
const appeared = await pollUntil(async () => (await list()).count === before.count + 1, 10000, 100);
if (!appeared.ok) {
  console.log('REFUSING: could not create a throwaway track to rename.');
  process.exit(1);
}
const subject = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))!;
const SUBJECT = subject.channelId;
note(`throwaway subject: ${SUBJECT} (created at index ${subject.index}); deleted at the end`);

// ==========================================================================
// the sweep
// ==========================================================================
interface Row { label: string; wrote: string; read: string | undefined; exact: boolean }
const rows: Row[] = [];

const CASES: { label: string; value: string }[] = [
  // ⚠ THE one that matters — the model's actual scheme.
  { label: 'MIDDLE DOT U+00B7 (the scheme)', value: 'B· Bass different-line' },
  // If the middle dot fails, these say whether non-ASCII fails wholesale or
  // whether that codepoint is special — a completely different fallback each.
  { label: 'BULLET OPERATOR U+2219', value: 'B∙ Bass' },
  { label: 'BULLET U+2022', value: 'B• Bass' },
  { label: 'BLACK RIGHT TRIANGLE U+25B8', value: 'B▸ Bass' },
  { label: 'EN DASH U+2013', value: 'B– Bass' },
  { label: 'accented latin U+00E9', value: 'Café Bass' },
  { label: 'CJK U+97F3', value: '音 Bass' },
  { label: 'emoji U+1F3B9 (astral, surrogate pair)', value: '🎹 Bass' },
  // Structural cases that break the scheme differently.
  { label: 'ASCII control: the scheme without the dot', value: 'B. Bass different-line' },
  { label: 'long name (96 chars)', value: 'B· ' + 'Bass'.repeat(23) + 'X' },
  { label: 'leading/trailing spaces', value: '  B· Bass  ' },
  { label: 'empty string', value: '' },
];

for (const c of CASES) {
  await req('track.setName', { trackIndex: await indexOf(SUBJECT), name: c.value });
  // ⚠ Poll rather than sleep, and re-read through `track.list` — a fresh read of
  // the bank, not the acknowledgement of the write (standing rule 1).
  await pollUntil(async () => (await nameOf(SUBJECT)) === c.value, 3000, 80);
  const read = await nameOf(SUBJECT);
  rows.push({ label: c.label, wrote: c.value, read, exact: read === c.value });
}

console.log('-- round-trip sweep\n');
console.log('  ' + 'case'.padEnd(38) + 'exact  read back');
for (const r of rows) {
  console.log('  ' + r.label.padEnd(38) + (r.exact ? ' ●    ' : ' ○    ')
    + JSON.stringify(r.read));
}

// ==========================================================================
// the verdict that matters
// ==========================================================================
console.log('');
const scheme = rows[0]!;
check('⚠ §3.4j: the MIDDLE DOT (U+00B7) survives a setName -> track.list round trip EXACTLY — '
  + 'the lineage-tag scheme is viable',
  scheme.exact,
  { wrote: scheme.wrote, read: scheme.read,
    wroteCodepoints: codepoints(scheme.wrote).slice(0, 3),
    readCodepoints: scheme.read ? codepoints(scheme.read).slice(0, 3) : undefined,
    why: 'compared by CODEPOINT — · U+00B7, ∙ U+2219 and • U+2022 are indistinguishable by eye' });

const nonAscii = rows.filter((r) => /[^\x00-\x7F]/.test(r.wrote));
const nonAsciiOk = nonAscii.filter((r) => r.exact).length;
note(`non-ASCII cases exact: ${nonAsciiOk}/${nonAscii.length}`);
check('non-ASCII is not special-cased away wholesale (the fallback question, answered '
  + 'whichever way the row above went)',
  nonAsciiOk > 0,
  { exact: nonAscii.filter((r) => r.exact).map((r) => r.label),
    failed: nonAscii.filter((r) => !r.exact).map((r) => r.label) });

const long = rows.find((r) => r.label.startsWith('long'))!;
check('a 96-character name is not truncated by `name().get()` — so a long original name '
  + 'plus a tag plus a gist survives',
  long.exact, { wroteLength: long.wrote.length, readLength: long.read?.length });

const spaces = rows.find((r) => r.label.startsWith('leading'))!;
if (!spaces.exact) {
  note(`⚠ leading/trailing spaces are NOT preserved (wrote ${JSON.stringify(spaces.wrote)}, `
    + `read ${JSON.stringify(spaces.read)}) — the tag parser must not rely on exact spacing`);
}
const empty = rows.find((r) => r.label === 'empty string')!;
note(`empty name reads back as ${JSON.stringify(empty.read)}`
  + (empty.exact ? '' : ' ⚠ — Bitwig substitutes something; an untagged track is not nameless'));

// ==========================================================================
// §3.4k — past Z·
// ==========================================================================
/**
 * ⚠ Nothing to measure here, and saying so is the finding. The letter is
 * assigned by ghostnote, so "what happens past Z" is entirely our policy — the
 * API has no opinion. What bounds it is the BANK WINDOW (§3.4a), not the
 * alphabet, and 26 forks of one lineage would exhaust that long first.
 *
 * ⇒ Recommendation (a proposal, rule 10): **refuse loudly at Z**, in standing
 * rule 5's shape, rather than wrapping to `AA·`. Two reasons beyond taste — a
 * two-character tag breaks the "typing `B` is a faster gesture than reading a
 * gist" property §1b chose the scheme for, and a lineage of 26 live tracks is a
 * bank-window and CPU problem (C3: ~0.6pp engine CPU per branch) that a naming
 * scheme should not quietly accommodate.
 */
console.log('\n-- §3.4k: past Z·');
note('nothing to probe: the letter is ours, so this is policy, not API behaviour.');
note('the real bound is the bank window (§3.4a), which 26 forks would hit long first.');
note('proposal (rule 10, yours): refuse loudly at Z rather than wrapping to AA·.');

// ---- cleanup --------------------------------------------------------------
console.log('\n-- cleanup');
await req('track.delete', { trackIndex: await indexOf(SUBJECT) });
const gone = await pollUntil(async () =>
  !((await req('track.resolveByChannelId', { channelId: SUBJECT })) as { found: boolean }).found,
  8000, 100);
check('the throwaway track was removed', gone.ok, { afterMs: gone.ms });
check('the project is back to the track count it started with',
  (await list()).count === before.count, { before: before.count, after: (await list()).count });

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
