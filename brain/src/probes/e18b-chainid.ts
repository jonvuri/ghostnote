/**
 * E18 §3.2 — is a chain's `channelId` a PROJECT key or an EXTENSION-SESSION handle?
 *
 * `e17ad` found 8/8 chain ids changed across a save + quit + reopen while every
 * name survived, under a structural-fingerprint gate with the `Track` id control
 * passing. ⚠ **The operator asked for it rebuilt anyway, and the reason is good:**
 *
 * > *"it is weird that channel identity is stable for tracks but not for chains
 * > when they share the same underlying object that channelId's name implies."*
 *
 * ⚠ **This probe is NOT a re-run of `e17ad`.** It is built fresh on a fresh
 * fixture per §3.2, and it adds the discriminator `e17ad` could not have had,
 * because `e17ad`'s reload restarted BOTH the project and the extension at once:
 *
 *     extension reload only   the project stays open; only our jar re-inits
 *     project reload          quit and reopen — restarts both
 *
 * | ids after an extension reload | ids after a project reload | reading |
 * |---|---|---|
 * | ⚠ **unchanged** | changed | ⚠ **the PROJECT FILE carries no persistent chain id** |
 * | ⚠ **changed** | changed | ⚠ **`channelId` is a per-EXTENSION-SESSION handle** — a
 * |  |  | proxy-instance number, and the E2f framing for tracks is what is odd |
 * | unchanged | unchanged | `e17ad` is overturned |
 *
 * Those are materially different products. Under the first, a take layer could be
 * re-identified by anything that survives in the file. Under the second, the id
 * means nothing outside one run of our own code, and the operator's "weird" is
 * resolved: the asymmetry is not project-level at all.
 *
 * ⚠ **The operator has already de-escalated what rides on this** — identity holds
 * within a live session, a mid-session reload can fall back to best-effort
 * identification, and a take layer can be treated as an ordinary layer. So this is
 * a CHARACTERISATION, not a blocker, and it is run here because the extension
 * reload for §3.1's wire is happening anyway and this arm is otherwise unobtainable.
 *
 * ### The controls, which are what make a ○ mean anything
 *
 * - ⚠ **The TRACK id control (E2f).** `gn-A`'s own `channelId` is captured in the
 *   same read. If chain ids change while the track id does not, a broken reader is
 *   ruled out. This is the control `e17n` lacked and `e17ad` added.
 * - ⚠ **A STRUCTURAL FINGERPRINT gate.** Container count on the track, chain count,
 *   chain names and the devices inside each chain are captured at both ends, and
 *   the verify **refuses to compare ids at all** unless the fingerprint matches. So
 *   *"we read a different container"* can never masquerade as *"the ids changed"* —
 *   which is precisely the artifact that made `e17n` untrustworthy, since a
 *   duplicate container has identical chain NAMES and different IDS.
 * - ⚠ **Explicit chain names.** E4c: a layer renames itself after its content, so a
 *   default name is not a stable fingerprint field. Row 5 measured that an
 *   explicitly set name is sticky across a content change AND a save + restart, so
 *   the fixture sets one per chain and the fingerprint uses those.
 *
 * Usage — the two halves straddle the reload:
 *
 *     npm run probe:e18b            build the fixture and SNAPSHOT   (before)
 *     npm run probe:e18b-verify     re-read and compare              (after)
 *
 * Typed-only: no named actions, no focus, no priming, no foreground, no human.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SNAP = join(tmpdir(), 'gn-e18b-chainid.json');
const TRACK = 'gn-A';
const PRESET = '/Users/jonvuri/Development/ghostnote/brain/fixtures/InstrumentLayer/gn_layer_4chain.bwpreset';
const CHAIN_TAG = 'gnid';

/**
 * `snapshot` builds a FRESH fixture and captures it.
 * ⚠ `resnap` captures the fixture that is ALREADY there, rebuilding nothing.
 * `verify`  re-reads and compares.
 *
 * ⚠⚠ **Why `resnap` exists.** The project-reload arm has to be measured on the SAME
 * chain ids the extension-reload arm used, or the two arms are not a matched pair —
 * they are two separate experiments on two fixtures, and the comparison that makes
 * the finding ("survives one reload type, dies on the other") evaporates.
 * `snapshot` clears the track and rebuilds, which MINTS NEW IDS and destroys exactly
 * that. `resnap` captures what is there and touches nothing.
 */
const arg = process.argv[2];
const mode = arg === 'verify' ? 'verify' : arg === 'resnap' ? 'resnap' : 'snapshot';

interface TrackRow { index: number; name: string; type: string; channelId: string }
interface DevList { devices: { index: number; name: string }[]; count: number }
interface ChainRow { index: number; name: string; channelId: string; devices: { name: string }[] }
interface LayerList { layers: ChainRow[]; count: number; cursorDeviceName?: string }
interface UndoState { canUndo: boolean; canRedo: boolean }

interface Snapshot {
  takenAt: string;
  methodsHash: string;
  /**
   * ⚠ The re-init detector, and it must NOT be the `methodsHash`.
   *
   * A hash change proves NEW CODE loaded, which is a different claim from *the
   * extension re-ran `init()`* — and the arm this probe wants is a controller
   * toggle with the SAME jar, where the hash cannot move by construction.
   * `rig.stats.initEpochMs` is the wall-clock time `init()` ran, so it moves for
   * any re-init however it was caused. Scoring "the ids survived" against an
   * extension that never restarted would be the emptiest possible false ●.
   */
  initEpochMs: number;
  /**
   * ⚠ The PROJECT-reload detector, distinct from the extension one.
   *
   * `initEpochMs` and `methodsHash` both prove our JAR re-ran `init()` — they say
   * nothing about whether the DOCUMENT was re-parsed from disk. For the project arm
   * that gap matters: a controller reload would satisfy the extension proof and
   * measure the wrong thing entirely.
   *
   * Bitwig's undo history belongs to the PROJECT, not to us, so a controller reload
   * leaves it untouched while loading a project clears it. ⇒ `canUndo` going
   * **true → false** is positive evidence the document reloaded.
   *
   * ⚠ Reported, not enforced. Whether Bitwig clears undo history on load is an
   * assumption about a DAW behaviour nobody here has measured, and refusing a good
   * run on an untested assumption would be its own error. The id comparison is shown
   * either way, clearly labelled with which proof fired.
   */
  canUndo: boolean;
  trackName: string;
  /** ⚠ The E2f control: a track id is durable, so this must NOT move. */
  trackChannelId: string;
  /** The gate. Ids are not compared unless this matches exactly. */
  fingerprint: string;
  chains: { index: number; name: string; channelId: string }[];
}

const trackList = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;

async function resolveTrack(): Promise<TrackRow> {
  const hits = (await trackList()).filter((t) => t.name === TRACK);
  // ⚠ Guard #1 — a name is not an identity, not even for a fixture.
  if (hits.length !== 1) {
    console.log(`⚠⚠ REFUSING: ${hits.length} tracks named "${TRACK}".`);
    process.exit(1);
  }
  return hits[0]!;
}

async function pointAt(t: TrackRow): Promise<void> {
  const now = await trackList();
  const row = now.find((x) => x.channelId === t.channelId);
  if (!row) { console.log(`⚠⚠ REFUSING: "${TRACK}" (${t.channelId}) is gone.`); process.exit(1); }
  await req('cursor.pointTrack', { cursor: '0', trackIndex: row.index });
  await wait(700);
}

async function devs(): Promise<DevList> {
  let last = ' ';
  let out: DevList = { devices: [], count: 0 };
  await pollUntil(async () => {
    out = (await req('device.list', { cursor: '0' })) as DevList;
    const n = out.devices.map((d) => d.name).join(',');
    const stable = n === last; last = n; return stable;
  }, 5000, 200);
  return out;
}

/**
 * Scope the layer bank onto the track's ONLY container, and refuse if there is
 * not exactly one.
 *
 * ⚠ This is the `e17n` artifact closed by construction rather than by argument.
 * `e17n` read chains through `devcursor.selectAt(deviceIndex: 0)` and never
 * asserted how many containers the track carried; during the `e17k`→`e17p` window
 * `gn-lay4` carried stacked duplicates, so index 0 could hold a different
 * container at snapshot than at verify — and a duplicate container has identical
 * chain NAMES with different IDS, which predicts the exact table `e17n` recorded.
 */
async function scopeSoleContainer(): Promise<DevList> {
  const d = await devs();
  const containers = d.devices.filter((x) => /Layer|Selector/.test(x.name));
  if (containers.length !== 1) {
    console.log(`⚠⚠ REFUSING: ${TRACK} carries ${containers.length} containers `
      + `[${d.devices.map((x) => x.name).join(', ')}] — the id comparison needs exactly one, `
      + 'or "we read a different container" can masquerade as "the ids changed" (the e17n artifact).');
    process.exit(1);
  }
  await req('devcursor.selectAt', { deviceIndex: containers[0]!.index });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && /Layer|Selector/.test(s.name);
  }, 6000, 150);
  if (!ok.ok) { console.log('⚠⚠ REFUSING: the device cursor never landed on the container.'); process.exit(1); }
  return d;
}

/** Structural fingerprint: containers, chain count, chain NAMES, devices per chain. */
const fingerprintOf = (d: DevList, l: LayerList) =>
  `devices=[${d.devices.map((x) => x.name).join('+')}] chains=${l.count} `
  + l.layers.map((c) => `${c.name}{${c.devices.map((x) => x.name).join('+') || '—'}}`).join(' ');

async function read(): Promise<{ track: TrackRow; fingerprint: string; chains: ChainRow[] }> {
  const track = await resolveTrack();
  await pointAt(track);
  const d = await scopeSoleContainer();
  const l = (await req('layer.list')) as LayerList;
  return { track, fingerprint: fingerprintOf(d, l), chains: l.layers };
}

// ==========================================================================
console.log('');
console.log('='.repeat(78));
// ⚠ The reload KIND is not known until verify measures it, so the title must not
// assert one. The first project-arm run printed "across an EXTENSION reload" over a
// transcript proving the opposite — a header contradicting its own body.
console.log(` E18 §3.2 — chain channelId across a RELOAD (kind measured, not assumed)   [${mode.toUpperCase()}]`);
console.log('='.repeat(78));

await client.connect();
const hello = (await req('contract.hello')) as { methodsHash: string; methodCount: number };
note(`wire: ${hello.methodCount} methods, methodsHash ${hello.methodsHash}`);

if (mode === 'resnap') {
  // ⚠ Capture what is ALREADY on the track. No clear, no insert, no rename — the
  // whole point is that the ids must be the ones the previous arm measured.
  const now = await read();
  console.log('');
  note(`track  ${now.track.name}  channelId ${now.track.channelId}   ⚠ E2f control`);
  note(`gate   ${now.fingerprint}`);
  for (const c of now.chains) note(`chain  ${String(c.index)}  ${c.name.padEnd(10)} ${c.channelId}`);

  check('the existing fixture has chains to capture', now.chains.length > 0,
    { chains: now.chains.length });
  if (now.chains.length === 0) {
    console.log('\n⚠⚠ REFUSING: nothing to re-snapshot. Run `npm run probe:e18b` to build a fixture.');
    process.exit(1);
  }

  // ⚠ If a previous snapshot exists, say whether these are the SAME ids. That is
  // what makes the next arm a matched pair rather than a fresh experiment.
  if (existsSync(SNAP)) {
    const prev = JSON.parse(readFileSync(SNAP, 'utf8')) as Snapshot;
    const same = prev.chains.filter((w) =>
      now.chains.some((c) => c.name === w.name && c.channelId === w.channelId)).length;
    note(`⚠ ${same}/${prev.chains.length} ids are UNCHANGED from the snapshot of ${prev.takenAt}`);
    if (same === prev.chains.length) {
      note('  ⇒ this re-snapshot is a MATCHED PAIR with the extension-reload arm: the very');
      note('    same ids, about to be put through a different kind of reload.');
    } else {
      note('  ⚠ the ids have MOVED since that snapshot. Whatever changed them is unrecorded —');
      note('    find out what before treating the next arm as a matched pair.');
    }
  }

  const stats = (await req('rig.stats')) as { initEpochMs: number };
  const undo = (await req('app.undoState')) as UndoState;
  const snap: Snapshot = {
    takenAt: new Date().toISOString(),
    methodsHash: hello.methodsHash,
    initEpochMs: stats.initEpochMs,
    canUndo: undo.canUndo,
    trackName: now.track.name,
    trackChannelId: now.track.channelId,
    fingerprint: now.fingerprint,
    chains: now.chains.map((c) => ({ index: c.index, name: c.name, channelId: c.channelId })),
  };
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log(`\n  snapshot written to ${SNAP}`);
  note(`undo history present: ${undo.canUndo} — a PROJECT reload should clear it`);
  console.log('');
  console.log('  ⚠ NEXT, in this order:');
  console.log('   1. SAVE the project (this fixture must survive the quit).');
  console.log('   2. QUIT Bitwig completely and reopen the project.');
  console.log('   3. npm run probe:e18b-verify');
  console.log('  ⚠ A controller reload is NOT enough this time — the DOCUMENT has to reload.');
} else if (mode === 'snapshot') {
  const track = await resolveTrack();
  await pointAt(track);

  // ------------------------------------------------------------------ fixture
  console.log('\n-- building a FRESH fixture (§3.2: do not reuse e17ad\'s)');
  let d = await devs();
  for (let guard = 0; guard < 12 && d.count > 0; guard++) {
    await req('device.delete', { cursor: '0', deviceIndex: d.devices[0]!.index });
    await pollUntil(async () => (await devs()).count < d.count, 6000, 200);
    d = await devs();
  }
  check(`${TRACK} cleared before building`, d.count === 0, { devices: d.devices.map((x) => x.name) });

  await req('device.insertFile', { cursor: '0', path: PRESET });
  const landed = await pollUntil(async () => (await devs()).count === 1, 12000, 200);
  check('the 4-chain container landed', landed.ok, { ms: landed.ms });
  await wait(400);

  await scopeSoleContainer();
  const fresh = (await req('layer.list')) as LayerList;
  check('the fresh container reports 4 chains', fresh.count === 4, { count: fresh.count });

  // ⚠ Explicit names, because E4c: a DEFAULT layer name tracks its content, so it
  // is not a stable fingerprint field. An explicitly set one is sticky (row 5 ●●).
  for (let i = 0; i < fresh.count; i++) {
    await req('layer.setName', { layerIndex: fresh.layers[i]!.index, name: `${CHAIN_TAG}·${i}` });
    await wait(200);
  }
  await wait(400);

  const now = await read();
  console.log('');
  note(`track  ${now.track.name}  channelId ${now.track.channelId}   ⚠ E2f control — must NOT move`);
  note(`gate   ${now.fingerprint}`);
  for (const c of now.chains) note(`chain  ${String(c.index)}  ${c.name.padEnd(10)} ${c.channelId}`);

  check('every chain carries its explicit name', now.chains.every((c) => c.name.startsWith(CHAIN_TAG)),
    { names: now.chains.map((c) => c.name) });
  check('every chain reports a distinct channelId',
    new Set(now.chains.map((c) => c.channelId)).size === now.chains.length,
    { ids: now.chains.map((c) => c.channelId) });

  /**
   * ⚠ PHASE 1 of `e17ad`, re-asked because it is what makes the reload question
   * meaningful: is `channelId` even stable WITHIN a session? Had it been a
   * per-read handle, "does not survive a reload" would be true for a much stronger
   * reason and the framing would be wrong.
   */
  console.log('\n-- is it stable WITHIN this session? (four reads, one round trip)');
  const reads: string[] = [now.chains.map((c) => c.channelId).join(' ')];
  for (const what of ['back-to-back', 'after re-scoping the container', 'after a track-cursor round trip']) {
    if (what.includes('re-scoping')) await scopeSoleContainer();
    if (what.includes('round trip')) {
      const others = (await trackList()).filter((t) => t.channelId !== now.track.channelId);
      await req('cursor.pointTrack', { cursor: '0', trackIndex: others[0]!.index });
      await wait(600);
      await pointAt(now.track);
      await scopeSoleContainer();
    }
    await wait(300);
    const again = (await req('layer.list')) as LayerList;
    reads.push(again.layers.map((c) => c.channelId).join(' '));
    note(`${what.padEnd(34)} ${again.layers.map((c) => c.channelId.slice(0, 8)).join(' ')}`);
  }
  check('⚠ channelId is STABLE within a session (a real identity, not a per-read handle)',
    new Set(reads).size === 1, { distinct: new Set(reads).size });

  const stats = (await req('rig.stats')) as { initEpochMs: number };
  const undoNow = (await req('app.undoState')) as UndoState;
  const snap: Snapshot = {
    takenAt: new Date().toISOString(),
    methodsHash: hello.methodsHash,
    initEpochMs: stats.initEpochMs,
    canUndo: undoNow.canUndo,
    trackName: now.track.name,
    trackChannelId: now.track.channelId,
    fingerprint: now.fingerprint,
    chains: now.chains.map((c) => ({ index: c.index, name: c.name, channelId: c.channelId })),
  };
  writeFileSync(SNAP, JSON.stringify(snap, null, 2));
  console.log(`\n  snapshot written to ${SNAP}`);
  console.log('  ⚠ NEXT: reload the extension, then `npm run probe:e18b-verify`.');
  console.log('  ⚠ Do NOT reload the PROJECT in between — that would restart both at once and');
  console.log('     collapse the discriminator this probe exists for.');
} else {
  // ------------------------------------------------------------------ verify
  if (!existsSync(SNAP)) {
    console.log(`⚠⚠ REFUSING: no snapshot at ${SNAP}. Run the snapshot half first.`);
    process.exit(1);
  }
  const snap = JSON.parse(readFileSync(SNAP, 'utf8')) as Snapshot;
  note(`snapshot from ${snap.takenAt}, wire ${snap.methodsHash}`);
  const stats = (await req('rig.stats')) as { initEpochMs: number; upMs: number };

  /**
   * ⚠ THE PRECONDITION, and it takes EITHER of two independent proofs.
   *
   * Without one, the probe would happily report "the ids survived" against an
   * extension that never restarted — the emptiest false ● available here.
   *
   *   newCode  the live `methodsHash` differs from the snapshot's. ⚠ This is the
   *            STRONGER proof, not a fallback: different code cannot be the same
   *            session, where a timestamp only says a clock moved.
   *   newInit  `rig.stats.initEpochMs` moved. This is the one that covers the arm
   *            `methodsHash` structurally cannot — a controller toggle on the SAME
   *            jar, where the hash is identical by construction.
   *
   * ⚠ `initEpochMs` is absent from snapshots taken before it was added, and an
   * `undefined` comparison silently yields false. Treated as UNKNOWN rather than as
   * "did not re-init", so a missing field cannot masquerade as a failed precondition
   * — which is exactly what it did on this probe's first run.
   */
  const newCode = hello.methodsHash !== snap.methodsHash;
  const knownInit = typeof snap.initEpochMs === 'number';
  const newInit = knownInit && stats.initEpochMs > snap.initEpochMs;
  const proof = newCode ? 'the WIRE changed — different code cannot be the same session'
    : newInit ? 'initEpochMs moved — a re-init on the same jar, project untouched'
    : null;
  check('⚠ PRECONDITION: the extension really did re-run init()', proof !== null,
    { proof, newCode, initBefore: knownInit ? snap.initEpochMs : 'not recorded',
      initAfter: stats.initEpochMs, upMs: stats.upMs });
  if (proof === null) {
    console.log('\n⚠⚠ REFUSING: nothing proves this is a different extension session.');
    console.log('   Reload the controller (or restart Bitwig) first — comparing ids across no');
    console.log('   restart at all would score a ● that means nothing.');
    process.exit(1);
  }
  note(`re-init proven by: ${proof}`);

  /**
   * ⚠⚠ WHICH KIND of reload was this? The whole finding turns on it.
   *
   * The extension proofs above say our jar re-ran `init()`. They cannot tell a
   * controller reload from a full project reload — and those two arms are the entire
   * experiment. Bitwig's undo history belongs to the PROJECT, so a controller reload
   * leaves it alone while loading a project clears it.
   */
  const undoNow = (await req('app.undoState')) as UndoState;
  const undoCleared = snap.canUndo === true && undoNow.canUndo === false;
  const kind = undoCleared ? 'PROJECT' : 'UNPROVEN';
  note(`undo history: ${snap.canUndo} → ${undoNow.canUndo}`
    + (undoCleared ? '  ⇒ CLEARED, so the DOCUMENT reloaded' : ''));
  if (undoCleared) {
    note('⚠⚠ THIS IS THE PROJECT-RELOAD ARM: the undo stack was cleared, which a controller');
    note('   reload does not do. The document was re-parsed from disk.');
  } else if (snap.canUndo !== true) {
    note('⚠ The snapshot recorded no undo history, so this detector cannot fire either way.');
    note('  ⇒ the RELOAD KIND IS UNPROVEN. Read the id result below as "after a reload of');
    note('    unknown kind", and do not file it as the project arm on this evidence alone.');
  } else {
    note('⚠⚠ THE UNDO STACK SURVIVED, so the document does NOT look reloaded — this reads like');
    note('   a CONTROLLER reload, not a project one. ⚠ If you did quit and reopen Bitwig, then');
    note('   Bitwig preserves undo history across loads and this detector is simply wrong;');
    note('   say so rather than trusting it. Either way the reload KIND is unproven here.');
  }

  const now = await read();
  console.log('');
  note(`gate before  ${snap.fingerprint}`);
  note(`gate after   ${now.fingerprint}`);

  // ⚠ THE GATE. Nothing below runs unless the structure is identical, so
  // "we read a different container" cannot be scored as "the ids changed".
  if (now.fingerprint !== snap.fingerprint) {
    console.log('\n⚠⚠ REFUSING TO COMPARE IDS: the structural fingerprint changed, so the two reads');
    console.log('   are not provably of the same object. That is the `e17n` artifact, and this');
    console.log('   probe refuses rather than recording an id difference it cannot attribute.');
    process.exit(1);
  }
  check('⚠ the STRUCTURAL FINGERPRINT gate passes — the same object at both ends', true, {});

  // ⚠ The E2f control, read in the SAME pass as the chains.
  check('⚠ CONTROL: the TRACK channelId is unchanged (E2f) — so the reader is not broken',
    now.track.channelId === snap.trackChannelId,
    { before: snap.trackChannelId, after: now.track.channelId });

  console.log('');
  console.log(`  ${'chain'.padEnd(10)} ${'before'.padEnd(38)} ${'after'.padEnd(38)} `);
  let moved = 0;
  for (const was of snap.chains) {
    const is = now.chains.find((c) => c.name === was.name);
    const same = is !== undefined && is.channelId === was.channelId;
    if (!same) moved++;
    console.log(`  ${was.name.padEnd(10)} ${was.channelId.padEnd(38)} ${(is?.channelId ?? 'GONE').padEnd(38)} ${same ? '● same' : '⚠ CHANGED'}`);
  }
  check(`every chain NAME survived the ${kind} reload`,
    snap.chains.every((w) => now.chains.some((c) => c.name === w.name)),
    { names: now.chains.map((c) => c.name) });

  console.log('');
  console.log('='.repeat(78));
  if (moved === 0) {
    console.log(`  ⇒ ●● ALL ${snap.chains.length} CHAIN IDS SURVIVED A ${kind} RELOAD.`);
    console.log('='.repeat(78));
    if (kind === 'PROJECT') {
      note('⚠⚠⚠ THIS CONTRADICTS `e17ad`, which measured 8/8 chain ids CHANGING across a save');
      note('    + quit + reopen under the same structural-fingerprint gate.');
      note('    ⚠ Do NOT quietly overwrite that finding. Two measurements disagree and the');
      note('    difference has to be found: e17ad rebuilt its fixture per run, this one reused');
      note('    a fixture that had already survived two extension reloads. ⚠ If chain ids are');
      note('    durable after all, §3.2 flips entirely and the layer model GAINS durable');
      note('    identity — the single biggest change available to the pending decision.');
    } else {
      note('⚠⚠ So `channelId` is NOT a per-extension-session handle. It survives our jar');
      note('   re-initialising, and `e17ad` measured it changing across a PROJECT reload — ⇒ the');
      note('   id lives in the running PROJECT and is regenerated when the project is loaded.');
      note('   ⚠ That resolves the operator\'s "weird": the asymmetry with tracks is about what');
      note('   the project FILE persists, not about what our proxies hand out.');
      note('   ⚠ Still owed: the PROJECT-reload arm, on THIS fixture, to close it end to end.');
    }
  } else if (moved === snap.chains.length) {
    console.log(`  ⇒ ⚠⚠ ALL ${moved} CHAIN IDS CHANGED ON A ${kind} RELOAD.`);
    console.log('='.repeat(78));
    if (kind === 'PROJECT') {
      note('⚠⚠ §3.2 IS CLOSED, and as a MATCHED PAIR on one fixture:');
      note('     extension reload → 4/4 ids SURVIVED   (e18b, and replicated over a 2nd reload)');
      note('     project reload   → all ids REGENERATED (this run)');
      note('   ⇒ a chain `channelId` lives in the RUNNING PROJECT and is minted by the project');
      note('     LOADER. `e17ad` is confirmed on a fresh fixture, and the operator\'s "weird" is');
      note('     answered: the asymmetry with tracks is about what the project FILE persists —');
      note('     a track id is written to disk, a chain id is created at load.');
      note('   ⚠ CONSEQUENCE: no care on our side can recover it. Addressing a take layer');
      note('     across sessions must rest on the NAME, which E17 row 5 proved sticky.');
    } else {
      note('⚠⚠ The project never closed, so nothing about the DOCUMENT changed — only our jar');
      note('   re-initialised. ⇒ a chain `channelId` is a PER-EXTENSION-SESSION handle, not a');
      note('   project key, and `e17ad`\'s "does not survive a restart" was reading this rather');
      note('   than anything about the file.');
      note('   ⚠ This makes the id useless for identity across ANY discontinuity, including a');
      note('   controller reload the user never notices — a stronger negative than §3.2 assumed.');
    }
  } else {
    console.log(`  ⇒ ⚠⚠ MIXED: ${moved} of ${snap.chains.length} changed. Do not summarise this.`);
    console.log('='.repeat(78));
    note('⚠ A partial change is not consistent with either mechanism and is the one outcome');
    note('  neither hypothesis predicts. Isolate before recording anything.');
  }
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read individually`);
process.exit(0);
