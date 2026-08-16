/**
 * E20d — how much JSON will `getDocumentState()` actually hold?
 *
 * RETIRED for the product extension. Session 3g-b removed the `recordChars`
 * sweep knob and assigned the setting to the production observation record.
 * This probe refuses before a record read or write when that knob is absent.
 *
 * ⚠⚠ **D18d's branch-event record lands there, and the capacity has never been
 * measured.** E14 proved document settings PERSIST — String and Enum settings
 * survive a save and a full Bitwig restart, scoped per project (A3/A4) — and said
 * nothing whatsoever about SIZE. E16-TRACK-NATIVE §4e's fallback depends on it
 * too. This is the measurement both have been carrying as an assumption.
 *
 * ⚠ **THREE CEILINGS, MEASURED SEPARATELY AND NEVER CONFLATED.** They fail
 * differently and only one of them is the one the design cares about:
 *
 *   1. **the wire** — newline-delimited JSON over TCP, a `BufferedReader` in
 *      `Bridge.java` and a string accumulator in `client.ts`. Neither documents a
 *      cap. Measured FIRST, through `echo`, because a setting limit read through a
 *      truncating wire is a wrong number rather than a smaller one.
 *   2. **the setting's declared `numChars`** — `getStringSetting(label, category,
 *      numChars, initial)` takes a size whose enforcement nothing documents. It
 *      may truncate, refuse, or be advisory.
 *   3. **the project document** — whether the value comes back off DISK. E14-A3's
 *      strong form: a full application restart, not a project reopen.
 *
 *     npm run probe:e20d           ceilings 1 and 2
 *     npm run probe:e20d-verify    ceiling 3, after a save + restart
 *
 * ⚠ **Nothing is ever written past the setting's declared size** (operator's
 * call, 2026-08-09). An over-length write is the E14-A1 hazard class — Bitwig
 * rejecting a value on its own thread, uncatchably — and the design consequence
 * of not measuring it is simply that the record must self-limit, which is a
 * defensible thing to decide rather than discover.
 *
 * ⚠⚠ **`ui.set` is ASYNCHRONOUS.** A readback issued immediately after a write can
 * return the previous value — measured, and it faked a capacity ceiling once (see
 * `writeAndSettle`). Every write here is polled until it lands, and the settle
 * time is reported.
 *
 * ⚠ **The setting is init-only** (standing rule 13, measured at E14-C2), so its
 * size is a `~/.ghostnote/rig.json` knob and the sweep is: edit `recordChars`,
 * reload the controller, re-run. No rebuild — the same loop E5 used for bank
 * sizes and E14 row C used for panel slots.
 *
 * Touches no clips, no tracks and no transport.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { client, check, note, failureCount } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}, timeoutMs?: number) =>
  client.request(m, p, timeoutMs);

const STATE = join(tmpdir(), 'gn-e20d-docstate.json');

/** Wire sizes, in characters. The top one is far past anything D18d would need. */
const WIRE_SIZES = [1_024, 8_192, 65_536, 262_144, 1_048_576];

/**
 * A payload shaped like what will actually live there — D18d's record is one row
 * per branch event — and deterministic, so `verify` can rebuild the exact string
 * after a restart instead of trusting a copy of it.
 *
 * ⚠ It deliberately contains the characters a naive round trip loses: a QUOTE and
 * a BACKSLASH (JSON escaping, twice over — once for the bridge frame and once for
 * the payload itself), a NEWLINE (⚠ the bridge is newline-DELIMITED, so an
 * unescaped one would split a frame and desynchronise the protocol), and a
 * non-ASCII character (the wire is UTF-8 on both sides and a setting may not be).
 * A capacity measured with `'a'.repeat(n)` would pass while the real record
 * corrupted.
 */
function payload(length: number): string {
  const rows: string[] = [];
  let seed = 20_260_809;
  const next = (): number => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648);
  let out = '';
  for (let i = 0; rows.length === 0 || out.length < length; i++) {
    const row = JSON.stringify({
      seq: i,
      choice: ['fork', 'chain', 'block'][next() % 3],
      rationale: 'quote " backslash \\ newline \n arrow → end',
      writeSet: [`t${next() % 16}s${next() % 16}`],
    });
    rows.push(row);
    out = `[${rows.join(',')}]`;
  }
  // ⚠ Trimmed to EXACTLY the requested length. The comparison is character for
  // character, so "about this big" would make every verdict approximate.
  return out.slice(0, length);
}

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

interface Stats { config: { recordChars: number; stamp: string }; initMicros: number }
interface Got { kind: string; value?: string; length?: number; declaredChars?: number; error?: string }

const mode = process.argv[2] ?? 'sweep';
if (!['sweep', 'verify', 'hidden'].includes(mode)) {
  console.log('usage: e20d-docstate.ts [sweep|verify|hidden]');
  process.exit(2);
}

await client.connect();
const stats = (await req('rig.stats')) as Stats;
const declared = stats.config.recordChars;

if (!Number.isInteger(declared) || declared < 1) {
  console.error([
    'REFUSING: E20d is a retired capacity probe.',
    'The current extension owns the record setting as production observation data.',
    'Use `npm run probe:3g-persistence` for a preserving transport check.',
  ].join('\n'));
  process.exit(2);
}

if (mode === 'verify') {
  // --- ceiling 3: did it come back OFF DISK? ---------------------------------
  const armed = JSON.parse(readFileSync(STATE, 'utf8')) as
    { declaredChars: number; length: number; hash: string; wroteAt: string };
  const got = (await req('ui.get', { setting: 'record' })) as Got;
  note(`armed ${armed.wroteAt}: ${armed.length} chars, sha ${armed.hash}`);
  note(`now: ${got.length} chars, sha ${sha(got.value ?? '')}`);
  // ⚠ The declared size is checked FIRST. If the operator changed `recordChars`
  // between arming and verifying, the setting is a different object and a length
  // mismatch would be scored as data loss that never happened.
  check('E20d-C1: the setting still has the size it was armed at',
    got.declaredChars === armed.declaredChars,
    { armedAt: armed.declaredChars, now: got.declaredChars });
  check('E20d-C2: the payload survived a save and a full restart, byte for byte',
    got.length === armed.length && sha(got.value ?? '') === armed.hash,
    { expectedLength: armed.length, gotLength: got.length });
  console.log(failureCount() === 0 ? '\nE20d ceiling 3: PASS' : `\nE20d ceiling 3: ${failureCount()} FAILED`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

if (mode === 'hidden') {
  // --- ⚠⚠ THE HAZARD ARM: can the value exist WITHOUT being drawn? ------------
  //
  // ⚠⚠ **A 262144-char setting round-trips perfectly and HARD-LOCKS BITWIG when
  // the field is interacted with.** Measured 2026-08-09: the operator opened the
  // panel dropdown, it rendered on top of other windows after switching away, hung
  // with a busy cursor, and the process had to be force-quit. All three storage
  // ceilings had just passed. ⇒ The binding constraint on `getDocumentState()` is
  // not capacity at all — it is that the value is DRAWN, and drawing it is fatal.
  //
  // The operator's hypothesis: *"it might be fine as long as the state isn't
  // represented in a visible field (if that's possible at all)."* E14 row C1 says
  // it is possible — `Setting.hide()` is reachable through the undocumented
  // downcast, and the cast was verified genuine by reading `getLabel()` back
  // through it. This arm asks whether a HIDDEN setting still holds its value.
  //
  // ⚠ What this arm does NOT prove: the real fix is hiding at `init()`, because
  // `hide()` is a runtime call and a restart re-creates the setting VISIBLE. That
  // is a one-line change in `UiPanel` and it belongs to whoever owns D18d's record
  // (rule 10) — measuring first, so the decision is made against evidence.
  if (declared <= 0) {
    console.log('REFUSING: `recordChars` is 0, so there is no setting to hide.');
    process.exit(2);
  }
  const vis = (await req('ui.visibility', { setting: 'record', action: 'hide' })) as
    { castWorked?: boolean; success?: boolean; error?: string };
  // ⚠ The cast FIRST. `Setting` is an orphan interface — nothing in the published
  // API returns it or extends it — so `instanceof` failing here is a clean ○ about
  // the mechanism rather than a mysterious no-op (E14's `asSetting` guard).
  check('E20d-H1: the Setting downcast works, so hide() is reachable at all',
    vis.castWorked === true, vis);
  check('E20d-H2: hide() was accepted', vis.success === true, vis);

  const full = payload(declared);
  const landed = await writeAndSettle(full);
  // ⚠⚠ The question the design turns on: a value nobody can see is worthless if it
  // is also a value nobody can STORE.
  check('E20d-H3: a HIDDEN setting still holds its value, byte for byte',
    landed.ok,
    { declared, wrote: full.length, read: landed.got.length, settledMs: landed.settledMs });

  writeFileSync(STATE, JSON.stringify({
    declaredChars: declared,
    length: landed.got.length,
    hash: sha(landed.got.value ?? ''),
    wroteAt: new Date().toISOString(),
    hidden: true,
  }, null, 2));

  console.log(`
-- ⚠ NOW LOOK, AND DO NOT TOUCH ANYTHING LARGE.

   1. Open the ghostnote controller pane. The "Branch record" row under
      "Record" should be GONE — that is what hide() is for.
   2. ⚠ Confirm the pane is RESPONSIVE: open and close it, hover the other rows.
      Do NOT go looking for a large field to interact with; the point of this arm
      is that there should not be one.
   3. Save the project, quit Bitwig completely, reopen, reopen the project, then:
        npm run probe:e20d-verify

   ⚠⚠ EXPECT THE ROW TO COME BACK VISIBLE after the restart. \`hide()\` is a
   runtime call and \`init()\` re-creates the setting drawn. That is not a failure
   of this arm — it is the measurement that says the real fix has to happen AT
   INIT, which is a design change, not a probe. ⚠ So after the restart, run verify
   and then set \`recordChars\` back to 0 before touching the panel again.
`);
  console.log(failureCount() === 0 ? 'E20d hidden arm: PASS' : `E20d hidden arm: ${failureCount()} FAILED`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

// --- ceiling 1: the wire -----------------------------------------------------
//
// ⚠ First, and not optional. Every number below travels this path, so a wire that
// truncated at 64K would make the setting look like it truncated at 64K.
console.log('-- ceiling 1: the bridge itself');
// ⚠ The LARGEST size is attempted more than once, and that is not belt-and-braces.
// The first run of this arm reported 1048576 chars going out and 1048578 coming
// back — two characters MORE, which is neither truncation nor a capacity limit —
// and three subsequent attempts round-tripped byte-identically. A one-shot check
// would have recorded either "1 MB is the ceiling" or "1 MB is fine", and both
// would have been claims about an intermittent. Repeating only the top size keeps
// the arm cheap while making a flake visible AS a flake.
// ⚠ The TOP size is attempted THREE TIMES, and it is scored again.
//
// It was unscored for one day: 1 MB payloads intermittently came back TWO
// CHARACTERS LONGER, and a check that fails every run for a known unrelated
// reason is one people learn to skip past. ⇒ ⚠⚠ **DIAGNOSED AND FIXED** — it was
// never a bridge capacity limit, it was `BridgeClient` decoding every TCP chunk
// independently, so a multi-byte character straddling a chunk boundary became two
// replacement characters (FINDINGS E20e). The repeats stay, because they are what
// made an intermittent visible AS an intermittent rather than as a verdict.
const TOP = WIRE_SIZES[WIRE_SIZES.length - 1];
const TOP_ATTEMPTS = 3;
for (const size of WIRE_SIZES) {
  if (size === TOP) continue;
  const sent = payload(size);
  const start = Date.now();
  let back = '';
  let failure = '';
  try {
    // ⚠ A generous timeout: the default 10s is a latency guard, and a large
    // payload is a throughput question. A timeout scored as a capacity limit
    // would be the wrong finding entirely.
    back = ((await req('echo', { payload: sent }, 60_000)) as { payload: string }).payload;
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }
  const ms = Date.now() - start;
  // ⚠ Length AND hash. A payload that came back the right length with different
  // bytes is the failure mode a length check cannot see, and this payload carries
  // a quote, a backslash, an escaped newline and a non-ASCII character precisely
  // so that a re-encoding anywhere would show up here.
  check(`E20d-W${size}: ${size} chars round-trip the bridge unchanged`,
    failure === '' && back.length === sent.length && sha(back) === sha(sent),
    failure !== ''
      ? { failed: failure, ms }
      : { sentChars: sent.length, backChars: back.length, delta: back.length - sent.length, ms });
}

let topExact = 0;
const topDeltas: number[] = [];
for (let attempt = 1; attempt <= TOP_ATTEMPTS; attempt++) {
  const sent = payload(TOP);
  let back = '';
  try {
    back = ((await req('echo', { payload: sent }, 60_000)) as { payload: string }).payload;
  } catch { /* counted as a non-exact attempt below */ }
  if (back.length === sent.length && sha(back) === sha(sent)) topExact++;
  else topDeltas.push(back.length - sent.length);
}
check(`E20d-W${TOP}: ${TOP} chars round-trip the bridge unchanged, ${TOP_ATTEMPTS} times running`,
  topExact === TOP_ATTEMPTS,
  { exact: `${topExact}/${TOP_ATTEMPTS}`, deltas: topDeltas });

/**
 * Write the record setting and WAIT FOR IT TO LAND — then report how long it took.
 *
 * ⚠⚠ **`ui.set` is asynchronous, and reading straight back returns the PREVIOUS
 * value.** Measured the expensive way: a 4096-char write read back as exactly 1024
 * characters — the length of the value written immediately before it — while 8192
 * passed on either side of it. A one-shot readback recorded that as *"the setting
 * truncates at 1024"*, which is a capacity finding that would have been entirely
 * false; the tell was that a real 1024-char ceiling cannot then pass 8192.
 *
 * ⚠ Same family as E2's observer gotcha and E15-B/D's settle budget (120 ms
 * measured for the step grid, *"every property discarded in silence below that"*).
 * Standing rule 1 says readback is the only truth; it does not say the readback is
 * instantaneous, and this is the second time in this session that a probe believed
 * its own first sample.
 *
 * The settle time is REPORTED, not just waited out — how long after writing the
 * record a read can be trusted is a number D18d needs, not an implementation
 * detail of this probe.
 */
async function writeAndSettle(value: string): Promise<{
  ok: boolean; settledMs: number; firstReadLength: number; got: Got;
}> {
  await req('ui.set', { setting: 'record', value });
  const start = Date.now();
  const deadline = start + 5_000;
  let firstReadLength = -1;
  let got: Got = { kind: 'unread' };
  for (;;) {
    got = (await req('ui.get', { setting: 'record' })) as Got;
    if (firstReadLength < 0) firstReadLength = got.length ?? -1;
    if (got.length === value.length && sha(got.value ?? '') === sha(value)) {
      return { ok: true, settledMs: Date.now() - start, firstReadLength, got };
    }
    if (Date.now() > deadline) {
      return { ok: false, settledMs: Date.now() - start, firstReadLength, got };
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

// --- ceiling 2: the setting --------------------------------------------------
console.log('\n-- ceiling 2: the document-state setting');
note(`rig config stamp "${stats.config.stamp}", recordChars=${declared}, init ${stats.initMicros}µs`);

if (declared <= 0) {
  // ⚠ Not a failure — an unswept rig is the DEFAULT, deliberately, so that no
  // ordinary session carries a payload-sized text field in the human panel. The
  // sweep is an operator loop and this is where it is explained.
  console.log(`
REFUSING (not a failure): no record setting exists, because \`recordChars\` is 0.

Document settings are init-only (standing rule 13, measured at E14-C2), so the
size cannot be changed from here. The sweep loop, which needs no rebuild:

  1. edit ~/.ghostnote/rig.json  ->  { "recordChars": 1024, "stamp": "e20d-1k" }
  2. reload the ghostnote controller in Bitwig (Settings -> Controllers)
     ⚠ A deploy is not a reload, and \`build.gradle\`'s hot-reload comment is
       wrong about this — session 3 §Owed says so.
  3. npm run probe:e20d
  4. repeat for 8192, 65536, 262144 — the first size that fails is the ceiling

⚠ Keep every write at or below the declared size. Writing past it is deliberately
out of scope: an over-length value is the E14-A1 class (Bitwig rejecting on its
own thread, uncatchably), and the design answer if it is unmeasured is simply
that the record self-limits.
`);
  process.exit(0);
}

// ⚠ Three fractions of the declared size, never above it. A capacity that only
// works when the field is full — or only when it is nearly empty — is a different
// defect from one that does not work at all, and one sample cannot tell them apart.
let largestGood = 0;
for (const fraction of [8, 2, 1]) {
  const size = Math.floor(declared / fraction);
  if (size <= 0) continue;
  const sent = payload(size);
  const landed = await writeAndSettle(sent);
  if (landed.ok) largestGood = Math.max(largestGood, size);
  check(`E20d-S${size}: ${size} of ${declared} declared chars round-trip the SETTING unchanged`,
    landed.ok,
    { wrote: sent.length, read: landed.got.length, declared: landed.got.declaredChars,
      settledMs: landed.settledMs, firstReadLength: landed.firstReadLength });
  // ⚠ A first read that was already stale is worth printing even when the value
  // lands: it is the difference between "this needs a poll" and "this happened to
  // be fast", and only one of those is safe to design against.
  if (landed.firstReadLength !== sent.length) {
    note(`⚠ the FIRST read after writing ${sent.length} chars returned `
      + `${landed.firstReadLength} — settled after ${landed.settledMs}ms`);
  }
}

// ⚠ The truncation question asked directly, at the declared size. Bitwig may keep
// the whole value, keep a prefix, or keep nothing — and "kept a prefix" is the
// dangerous one, because a truncated JSON record still LOOKS like a record until
// something parses it.
const full = payload(declared);
const fullLanded = await writeAndSettle(full);
const atFull = fullLanded.got;
const kept = atFull.length ?? -1;
check('E20d-S-full: at exactly the declared size, nothing is silently trimmed',
  fullLanded.ok,
  { declared, wrote: full.length, read: kept, settledMs: fullLanded.settledMs,
    firstReadLength: fullLanded.firstReadLength });
if (kept > 0 && kept < full.length) {
  note(`⚠⚠ TRUNCATED to ${kept} chars and reported no error — a prefix of a JSON record is `
    + 'still shaped like one, which is the failure mode D18d must not inherit.');
}

writeFileSync(STATE, JSON.stringify({
  declaredChars: declared,
  length: atFull.length,
  hash: sha(atFull.value ?? ''),
  wroteAt: new Date().toISOString(),
}, null, 2));

console.log(`
-- ceiling 3: the project document. ⚠ Needs you.

   1. Save the project in Bitwig.
   2. Quit Bitwig completely and reopen it, then reopen the project.
      ⚠ A full application restart, not a project reopen — E14-A3 took it in the
        strong form so that what comes back is known to have come off DISK
        rather than out of a still-running extension.
   3. npm run probe:e20d-verify

   ⚠ While you are looking at the panel, record one thing no assertion can:
      IS IT STILL USABLE? A ${declared}-char text field in a human surface is a
      defect even when the value round-trips perfectly, and if the drawable
      ceiling is lower than the storable one, THAT is the number D18d has to
      design against — a pointer or a rolling window rather than the whole log.
`);
note(`largest size proven exact so far: ${largestGood} chars (declared ${declared})`);
console.log(failureCount() === 0 ? 'E20d ceilings 1-2: PASS' : `E20d ceilings 1-2: ${failureCount()} FAILED`);
process.exit(failureCount() === 0 ? 0 : 1);
