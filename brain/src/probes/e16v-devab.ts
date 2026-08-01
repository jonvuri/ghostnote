/**
 * E16 §3.4e + the DeviceLayer-mute lead — a DEVICE-SCOPED A/B, measured two ways.
 *
 * ⚠ **Why a device-scoped A/B matters at all, given the model is chosen.** The
 * track-native model buys lineage-level A/B by muting a group (E16m ●, sends and
 * all). It cannot reach the two places E16r showed leave the addressable set
 * FIRST — the **master and the FX returns** — because a return cannot be forked:
 * other tracks' sends still feed the original, so duplicating one isolates
 * nothing (§4.8). A device-scoped A/B is the only mechanism that reaches them,
 * and it costs no bank slot and no C5 duplication glitch.
 *
 * Two candidate mechanisms, and they are NOT equivalent:
 *
 *   CHAIN SELECTOR (§3.4e)  exclusive by construction — one chain is active.
 *                           `activeChainIndex()` is a SINGLE READABLE INTEGER,
 *                           which is exactly what §4.4 wants and what N mute
 *                           flags cannot be.
 *   LAYER MUTE (the lead)   chains run in PARALLEL and are muted individually.
 *                           Cheaper (the fixture exists) but it reproduces
 *                           E16m's problem one level down: the state lives in N
 *                           flags, and nothing single says which branch is live.
 *
 * ⚠ Both shells are HUMAN-BUILT and ship EMPTY. E16o established that no verb
 * seeds a chain — not insert, duplicate, copy, or the newly-working
 * `moveDevices` — so the chains come from a `.bwpreset` a person made, and this
 * probe fills them with `layer.insertDevice`, which E4c measured at ~143ms into
 * an existing chain.
 *
 * ⚠ **The E16o trap is designed around, not hoped past.** `rig.layerBank0`
 * FOLLOWS `cursorDevice0`, so every layer-scoped call has the device cursor as a
 * hidden argument. Aimed at a device with no layers it is a silent no-op that is
 * byte-identical to an API refusal — which is how `e16o` first published a false
 * negative. Every layer call here re-selects the container and asserts the
 * precondition separately from the question.
 *
 * ⚠ **The oracle is the MASTER, never the track's own meter** (trap 1: the VU tap
 * is pre-mute). The ear is a confirmation of the meter, not the primary
 * instrument — and its arms are FORCED to balance rather than coin-flipped,
 * because E16m's coin came up 5 real / 1 placebo and left that row's ear half
 * under-powered.
 *
 *   setup     build both tracks, fill the chains          (silent)
 *   meter     the programmatic half                        (⚠ ROLLS THE TRANSPORT)
 *   ab-run    blind A/B trials, forced 4 real / 4 placebo  (⚠ MAKES NOISE)
 *   ab-score  score answers against the hidden schedule
 *   cleanup   remove the two tracks
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
const STATE = join(tmpdir(), 'gn-e16v-devab.json');

/** ⚠ Absolute path + .bwpreset extension: both fail SILENTLY otherwise (E4h, rule 11). */
const PRESETS = join(homedir(), 'Documents', 'Bitwig Studio', 'Library', 'Presets');
const SELECTOR = join(PRESETS, 'Instrument Selector', 'gn_instrument_selector_2.bwpreset');
const LAYER = join(PRESETS, 'Instrument Layer', 'gn_instrument_layer_2.bwpreset');
const POLYSYNTH_UUID = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

const SEL_TRACK = 'gn-sel';
const LAY_TRACK = 'gn-lay';

type TrackRow = { index: number; name: string; channelId: string; type: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const findTrack = async (name: string) => (await list()).tracks.find((t) => t.name === name);
const indexOf = async (channelId: string): Promise<number | undefined> => {
  const r = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  return r.found ? r.index : undefined;
};

interface LayerRow { index: number; name: string; mute?: boolean | string;
  channelId?: boolean | string; devices: { index: number; name: string }[] }
const layers = async () => (await req('layer.list')) as
  { layers: LayerRow[]; count: number; hasLayers: boolean | string; layerMixerStatus: string };

interface VuRow { index: number; name: string; now: number; hold: number; stale?: boolean }
const vu = async (reset = false) => {
  const r = (await req('branch.vu', { reset })) as { tracks: VuRow[] };
  return r.tracks;
};
const masterVu = async (): Promise<VuRow | undefined> =>
  (await vu()).find((t) => t.name === 'Master');
const fxVu = async (): Promise<VuRow | undefined> =>
  (await vu()).find((t) => t.name === 'FX 1');

/** Arm the peak-hold, wait, and report the peak that accumulated. ⚠ Rows D–G
 *  measured that 800ms of tail clearance is NOT enough before arming. */
async function peakOver(ms: number): Promise<{ master: number; fx: number }> {
  await vu(true);
  await new Promise((r) => setTimeout(r, ms));
  const rows = await vu();
  return {
    master: rows.find((t) => t.name === 'Master')?.hold ?? -1,
    fx: rows.find((t) => t.name === 'FX 1')?.hold ?? -1,
  };
}

/**
 * Point the device cursor at a track's device 0 and PROVE the container is
 * selected before any layer call. Returns the layer count actually seen.
 */
async function selectContainer(trackIndex: number, expectName: string): Promise<number> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const settled = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name.includes(expectName);
  }, 6000, 100);
  const s = (await req('devcursor.status')) as { exists: boolean; name: string };
  const l = await layers();
  note(`  device cursor -> "${s.name}" exists=${s.exists} (${settled.ms}ms), `
    + `layers=${l.count} hasLayers=${l.hasLayers}`);
  if (!settled.ok) {
    console.log(`\nREFUSING: the device cursor is not on the ${expectName}. Every layer call`);
    console.log('reaches its target through this cursor, so proceeding would produce silent');
    console.log('no-ops that are byte-identical to API refusals (the e16o trap).');
    process.exit(1);
  }
  return l.count;
}

const mode = process.argv[2] ?? 'setup';

// ==========================================================================
if (mode === 'setup') {
  await client.connect();
  const rolling = (await req('transport.status')) as { isPlaying: boolean };
  if (rolling.isPlaying) {
    console.log('REFUSING: the transport is rolling; setup inserts devices. Stop it first.');
    process.exit(1);
  }
  for (const [label, path] of [['selector', SELECTOR], ['layer', LAYER]] as const) {
    if (!existsSync(path)) {
      console.log(`REFUSING: no ${label} preset at ${path}`);
      console.log('⚠ insertFile needs an ABSOLUTE path and a .bwpreset extension; both fail');
      console.log('  silently (E4h), so this is checked here rather than discovered as a no-op.');
      process.exit(1);
    }
  }

  const built: Record<string, { channelId: string; chains: number }> = {};
  for (const [name, path, expect] of [
    [SEL_TRACK, SELECTOR, 'Selector'], [LAY_TRACK, LAYER, 'Layer'],
  ] as const) {
    console.log(`\n-- building ${name}`);
    let track = await findTrack(name);
    if (!track) {
      const before = await list();
      const beforeIds = new Set(before.tracks.map((t) => t.channelId));
      await req('track.create', { position: before.count });
      await pollUntil(async () => (await list()).count === before.count + 1, 10000, 100);
      const fresh = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))!;
      await req('track.setName', { trackIndex: fresh.index, name });
      await pollUntil(async () => (await findTrack(name)) !== undefined, 6000, 100);
      track = await findTrack(name);
    }
    const trackIndex = track!.index;
    note(`  track ${name} at bank ${trackIndex}`);

    const devs = async () => {
      await req('cursor.pointTrack', { cursor: '0', trackIndex });
      return (await req('device.list', { cursor: '0' })) as { devices: { name: string }[] };
    };
    if ((await devs()).devices.length === 0) {
      await req('cursor.pointTrack', { cursor: '0', trackIndex });
      await req('device.insertFile', { cursor: '0', path });
      const landed = await pollUntil(async () => (await devs()).devices.length > 0, 15000, 200);
      check(`${name}: the ${expect} preset landed`, landed.ok,
        { devices: (await devs()).devices.map((d) => d.name), ms: landed.ms });
    }

    const chains = await selectContainer(trackIndex, expect);
    check(`${name}: the container reports 2 chains (human-built, since no verb seeds one)`,
      chains === 2, { chains });

    // Fill each chain, re-selecting the container before every call.
    for (let c = 0; c < chains; c++) {
      const l = await layers();
      if ((l.layers.find((x) => x.index === c)?.devices.length ?? 0) > 0) continue;
      await selectContainer(trackIndex, expect);
      await req('layer.insertDevice', { layerIndex: c, uuid: POLYSYNTH_UUID });
      const filled = await pollUntil(async () => {
        await selectContainer(trackIndex, expect);
        return ((await layers()).layers.find((x) => x.index === c)?.devices.length ?? 0) > 0;
      }, 15000, 300);
      check(`${name}: chain ${c} now holds a device`, filled.ok, { ms: filled.ms });
    }

    // ⚠ Make the two chains audibly DIFFERENT. A/B between two identical sounds
    // is not an A/B — the ear would have nothing to discriminate and a placebo
    // arm would be indistinguishable from a real one for the right reason,
    // which is the worst possible way to pass.
    await selectContainer(trackIndex, expect);
    await req('devcursor.selectFirstInLayer', { layerIndex: 1 });
    // ⚠ The descent needs a settle poll, not a bare read. `param.set` reaches
    // `polysynthParams0`, which are bound to cursorDevice0 through
    // createSpecificBitwigDevice — so they resolve ONLY while the cursor is
    // actually on a Polysynth. Reading the name too early gives the container's,
    // and setting a param then would silently address the wrong device.
    const descended = await pollUntil(async () => {
      const s = (await req('devcursor.status')) as { exists: boolean; name: string };
      return s.exists && /poly/i.test(s.name);
    }, 6000, 100);
    const nested = (await req('devcursor.status')) as { exists: boolean; name: string };
    note(`  chain 1's device: "${nested.name}" exists=${nested.exists} (descended in ${descended.ms}ms)`);
    if (descended.ok) {
      const f1Of = async () => {
        const read = (await req('param.list')) as
          { params: { id: string; value?: number; exists: boolean; displayed?: string }[] };
        return read.params?.find((p) => p.id === 'F1FREQ');
      };
      await req('param.set', { id: 'F1FREQ', value: 0.08 }); // dark
      // ⚠ Poll rather than read once. `setImmediately` is immediate at Bitwig's
      // end, not at ours — the value comes back through an observer, and reading
      // in the same breath returns the pre-set value and looks like a refusal.
      const landed = await pollUntil(async () => ((await f1Of())?.value ?? 1) < 0.2, 5000, 100);
      const f1 = await f1Of();
      note(`  chain 1 F1FREQ -> ${f1?.value?.toFixed(3)} (${f1?.displayed}) in ${landed.ms}ms`);
      check(`${name}: chain 1 is audibly DIFFERENT from chain 0`, landed.ok, { f1 });
    } else {
      note('  ⚠ could not reach chain 1\'s device to differentiate it. The A/B will be');
      note('    between two IDENTICAL sounds, which the ear cannot decide — say so rather');
      note('    than running trials that are guaranteed to look like chance.');
    }

    // A clip to play. Notes chosen to ring rather than click.
    await selectContainer(trackIndex, expect);
    const has = async () =>
      ((await req('slot.status', { trackIndex, slotIndex: 0 })) as { hasContent: boolean }).hasContent;
    if (!(await has())) {
      await req('clip.create', { trackIndex, slotIndex: 0, lengthBeats: 4 });
      await pollUntil(has, 8000, 100);
    }
    await req('cursor.pointTrack', { cursor: '0', trackIndex });
    await req('slot.select', { trackIndex, slotIndex: 0, mechanism: 'track' });
    await pollUntil(async () => {
      const s = (await req('cursor.status', { cursor: '0' })) as { exists: boolean; sceneIndex: number };
      return s.exists && s.sceneIndex === 0;
    }, 6000, 100);
    await req('cursor.setNotes', { cursor: '0', notes: [[0, 48, 100, 4], [0, 55, 100, 4]] });

    built[name] = { channelId: track!.channelId, chains };
  }

  writeFileSync(STATE, JSON.stringify(built, null, 2));
  console.log('\nSETUP COMPLETE — nothing has made a sound yet.');
  note('⚠ next step ROLLS THE TRANSPORT. Ask before running `meter`.');
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'meter') {
  await client.connect();
  const built = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, { channelId: string }>;

  for (const [name, kind] of [[LAY_TRACK, 'layer'], [SEL_TRACK, 'selector']] as const) {
    const trackIndex = await indexOf(built[name]!.channelId);
    if (trackIndex === undefined) { note(`${name} no longer resolves — skipping`); continue; }
    console.log(`\n======== ${kind} on ${name} (bank ${trackIndex}) ========`);
    await selectContainer(trackIndex, kind === 'layer' ? 'Layer' : 'Selector');

    // Open state, both chains available.
    if (kind === 'layer') {
      for (const c of [0, 1]) {
        await selectContainer(trackIndex, 'Layer');
        await req('layer.setMixer', { layerIndex: c, mute: false });
      }
    } else {
      await req('chainselector.set', { index: 0 });
    }

    await req('slot.launch', { trackIndex, slotIndex: 0 });
    await req('transport.play');
    await new Promise((r) => setTimeout(r, 2500)); // settle + tail clearance
    const open = await peakOver(2500);
    note(`open: master ${open.master}, FX ${open.fx}`);
    check(`${kind}: the clip is audible at the master before anything is changed`,
      open.master > 5, open);

    if (kind === 'layer') {
      await selectContainer(trackIndex, 'Layer');
      await req('layer.setMixer', { layerIndex: 0, mute: true });
      await selectContainer(trackIndex, 'Layer');
      await req('layer.setMixer', { layerIndex: 1, mute: true });
      await new Promise((r) => setTimeout(r, 1200));
      const bothMuted = await peakOver(2500);
      note(`both chains muted: master ${bothMuted.master}, FX ${bothMuted.fx}`);

      await selectContainer(trackIndex, 'Layer');
      const flags = (await layers()).layers.map((l) => `chain${l.index}.mute=${l.mute}`);
      note(`flags read back: ${flags.join(', ')}`);
      note(`layer channelIds: ${(await layers()).layers.map((l) => `${l.index}:${l.channelId}`).join(', ')}`);

      check('⚠ THE LEAD: muting a DeviceLayer chain silences it',
        bothMuted.master < open.master / 2, { open: open.master, muted: bothMuted.master });
      check('and the mute FLAG reads back as set (the API accepted it)',
        flags.every((f) => f.endsWith('=true')), { flags });

      // Restore, and prove the silence was the mute rather than the clip ending.
      for (const c of [0, 1]) {
        await selectContainer(trackIndex, 'Layer');
        await req('layer.setMixer', { layerIndex: c, mute: false });
      }
      await new Promise((r) => setTimeout(r, 1200));
      const restored = await peakOver(2500);
      note(`unmuted again: master ${restored.master}, FX ${restored.fx}`);
      check('CONTROL: sound returns when unmuted, so the silence was the mute and not the clip',
        restored.master > open.master / 2, { open: open.master, restored: restored.master });
    } else {
      const st0 = (await req('chainselector.status')) as
        { exists: boolean; chainCount: number; activeChainIndex: number };
      note(`selector: exists=${st0.exists} chains=${st0.chainCount} active=${st0.activeChainIndex}`);
      check('§3.4e: the chain selector is addressable and reports 2 chains',
        st0.chainCount === 2, st0);

      const t0 = Date.now();
      await req('chainselector.set', { index: 1 });
      const switched = await pollUntil(async () =>
        ((await req('chainselector.status')) as { activeChainIndex: number }).activeChainIndex === 1,
        4000, 20);
      note(`⚠ switch latency to activeChainIndex==1: ${switched.ms}ms (round trip ${Date.now() - t0}ms)`);
      check('§3.4e: switching chains lands', switched.ok, { ms: switched.ms });

      await new Promise((r) => setTimeout(r, 1200));
      const onB = await peakOver(2500);
      note(`chain 1 active: master ${onB.master}, FX ${onB.fx}`);
      check('⚠ §3.4e: the other chain is audible too — switching does not silence the track',
        onB.master > 5, { chain0: open.master, chain1: onB.master });
      check('⚠ §3.4e: switching does NOT cut the track\'s sends — the FX return still gets signal',
        onB.fx > 0 || open.fx <= 0,
        { fxOnChain0: open.fx, fxOnChain1: onB.fx });
      note('⚠ the send question is not the same one mute answers. A track mute cuts sends');
      note('  (E2); a chain switch happens INSIDE the instrument, upstream of the send tap,');
      note('  so sends should keep flowing and carry whichever chain is active. That is the');
      note('  property that makes a selector usable on an FX RETURN, which no fork reaches.');

      await req('chainselector.set', { index: 0 });
    }

    await req('transport.stop');
    await new Promise((r) => setTimeout(r, 900));
  }
  console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'ab-run') {
  await client.connect();
  const built = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, { channelId: string }>;
  const which = (process.argv[3] ?? 'layer') as 'layer' | 'selector';
  const name = which === 'layer' ? LAY_TRACK : SEL_TRACK;
  const trackIndex = await indexOf(built[name]!.channelId);
  if (trackIndex === undefined) { console.log(`REFUSING: ${name} does not resolve.`); process.exit(1); }

  /**
   * ⚠ FORCED BALANCE, not a coin. E16m flipped per trial and came up 5 real / 1
   * placebo, leaving its ear half at 0/1 on the arm that matters — consistent,
   * and far thinner than C5's 0/3. A fixed multiset shuffled is the same blind
   * to the listener and cannot produce a degenerate split.
   */
  const TRIALS = 8;
  const arms = [...Array(TRIALS / 2).fill(true), ...Array(TRIALS / 2).fill(false)] as boolean[];
  for (let i = arms.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arms[i], arms[j]] = [arms[j]!, arms[i]!];
  }

  /**
   * ⚠ Clear the room before an EAR trial, which the meter phase did not need.
   *
   * `e16v-diag` §0 found Group 7, gn-E16, gn-sel and gn-lay all sounding at
   * 54–58 with nothing of ours launched. A meter can attribute a change to one
   * track through that; a listener cannot. A glitch is a small transient, and
   * asking someone to hear one under a project playing at 58 would produce a
   * chance-level score for a reason that has nothing to do with the question.
   */
  for (const t of (await list()).tracks) {
    if (t.type === 'Master') continue;
    await req('branch.setMixer', { trackIndex: t.index, mute: t.index !== trackIndex });
  }
  note(`room cleared: only ${name} is unmuted`);

  await selectContainer(trackIndex, which === 'layer' ? 'Layer' : 'Selector');
  if (which === 'layer') {
    for (const c of [0, 1]) {
      await selectContainer(trackIndex, 'Layer');
      await req('layer.setMixer', { layerIndex: c, mute: false });
    }
  } else {
    await req('chainselector.set', { index: 0 });
  }
  // ⚠ `slot.launch` alone — NO `transport.play`. Launching a launcher clip starts
  // the transport itself and the clip loops; the explicit play/stop cycle this
  // used to do tore down the playback it had just started (measured in
  // e16w-lead, where attempt 1 caught a decay tail of 5 and attempts 2 and 3
  // read 0 — the retry loop destroying the thing it was retrying).
  await req('slot.launch', { trackIndex, slotIndex: 0 });
  await new Promise((r) => setTimeout(r, 2500));
  const armed = (await vu()).find((t) => t.name === (which === 'layer' ? LAY_TRACK : SEL_TRACK));
  note(`subject peaks at ${armed?.hold ?? 0} before the trials begin`);
  if ((armed?.hold ?? 0) < 20) {
    console.log('\nREFUSING: the subject is not audible, so every trial would be a placebo');
    console.log('by accident and the listener would be scoring silence against silence.');
    process.exit(1);
  }

  /**
   * ⚠ The two rows ask DIFFERENT questions of the ear, and asking the wrong one
   * would make a clean result unreadable.
   *
   * layer     the chains differ (chain 1's filter is at 19.4 Hz), so a mute of
   *           chain 0 is a large timbre/level change. The question is "did it
   *           change".
   * selector  ⚠ both chains hold the SAME default Polysynth, because the device
   *           cursor cannot descend into a Selector chain to differentiate them
   *           (measured above: `selectFirstInLayer` times out on a Selector and
   *           lands in 141ms on a Layer). That is not a degraded experiment — it
   *           is a BETTER one for §3.4e's actual question. With both chains
   *           identical the switch should be inaudible, so ANYTHING heard at the
   *           switch point IS the glitch, uncontaminated by a timbre change.
   *           C5 measured duplication's glitch the same way.
   */
  const QUESTION = which === 'layer'
    ? 'did the sound CHANGE? (y = changed, n = stayed the same)'
    : 'did you hear a CLICK, GLITCH or DROPOUT? (y = heard one, n = clean)';
  console.log(`\n${TRIALS} trials, ~5s each. Listen and note for EACH:`);
  console.log(`  ${QUESTION}\n`);
  const meters: number[] = [];
  for (let t = 0; t < TRIALS; t++) {
    console.log(`  trial ${t + 1} ...`);
    if (arms[t]) {
      if (which === 'layer') {
        await selectContainer(trackIndex, 'Layer');
        await req('layer.setMixer', { layerIndex: 0, mute: true });
      } else {
        await req('chainselector.set', { index: 1 });
      }
    }
    const p = await peakOver(2200);
    meters.push(p.master);
    // Restore between trials so each starts from the same state.
    if (arms[t]) {
      if (which === 'layer') {
        await selectContainer(trackIndex, 'Layer');
        await req('layer.setMixer', { layerIndex: 0, mute: false });
      } else {
        await req('chainselector.set', { index: 0 });
      }
    }
    await new Promise((r) => setTimeout(r, 2200));
  }
  await req('transport.stop');

  writeFileSync(STATE.replace('.json', `-ab-${which}.json`),
    JSON.stringify({ which, arms, meters }, null, 2));
  console.log('\nTRIALS DONE — transport stopped.');
  note(`meter per trial: ${meters.join(', ')}`);
  note('⚠ the schedule is written to disk and deliberately NOT printed. Report what you');
  note(`  heard as 8 letters (e.g. ynynnyny), then run: ab-score ${which} <answers>`);
  process.exit(0);
}

// ==========================================================================
if (mode === 'ab-score') {
  const which = (process.argv[3] ?? 'layer') as 'layer' | 'selector';
  const answers = (process.argv[4] ?? '').toLowerCase().replace(/[^yn]/g, '');
  const rec = JSON.parse(readFileSync(STATE.replace('.json', `-ab-${which}.json`), 'utf8')) as
    { which: string; arms: boolean[]; meters: number[] };
  if (answers.length !== rec.arms.length) {
    console.log(`REFUSING: got ${answers.length} answers for ${rec.arms.length} trials.`);
    process.exit(2);
  }
  let realHeard = 0; let placeboHeard = 0;
  const realN = rec.arms.filter(Boolean).length;
  const placeboN = rec.arms.length - realN;
  console.log(`\n${which} A/B — ${realN} real / ${placeboN} placebo (forced balance)\n`);
  rec.arms.forEach((real, i) => {
    const heard = answers[i] === 'y';
    if (real && heard) realHeard++;
    if (!real && heard) placeboHeard++;
    console.log(`  trial ${i + 1}: ${real ? 'REAL   ' : 'placebo'} | heard=${heard ? 'yes' : 'no '}`
      + ` | master peak ${rec.meters[i]}`);
  });
  console.log('');
  note(`ear: ${realHeard}/${realN} real vs ${placeboHeard}/${placeboN} placebo`);
  check('⚠ both arms actually occurred, so the trial set can discriminate at all',
    realN > 0 && placeboN > 0, { real: realN, placebo: placeboN });

  /**
   * ⚠ **The two rows want OPPOSITE verdicts, and asserting the wrong one prints a
   * red X against a perfectly clean result.**
   *
   * layer     the arms should SEPARATE — muting a chain is supposed to be
   *           audible, so hearing it on the real arm and not the placebo is ●.
   * selector  ⚠ the arms should NOT separate. Both chains hold the same patch, so
   *           a correct switch is INAUDIBLE; the only thing a listener could hear
   *           is a glitch. "Heard nothing on either arm" is therefore the ● —
   *           and the discrimination assertion would fail on it.
   *
   * This is E16m's method note in a new costume: an earlier draft there asserted
   * `silences || separated` and would have printed a red X against a clean ○.
   * The first version of THIS check made exactly that mistake, and scored a clean
   * glitch-free result (0/4 vs 0/4) as a FAILURE.
   */
  if (which === 'layer') {
    check('the ear separates the real arm from the placebo arm',
      realHeard / realN > placeboHeard / Math.max(1, placeboN),
      { realRate: (realHeard / realN).toFixed(2), placeboRate: (placeboHeard / placeboN).toFixed(2) });
  } else {
    const glitchFree = realHeard === 0 && placeboHeard === 0;
    check('⚠ §3.4e: switching is GLITCH-FREE — nothing heard on either arm',
      glitchFree, { realHeard, placeboHeard });
    if (glitchFree) {
      note('⚠ ● no glitch. Compare C5, where a track DUPLICATION glitched 5/5 against');
      note('  0/3 placebo — so a device-scoped A/B is clean exactly where the fork is not.');
      note('⚠ THE WEAKNESS, stated rather than buried: a null ear result cannot tell "no');
      note('  glitch" from "this listener/rig could not have heard one anyway". The missing');
      note('  arm is a POSITIVE control — a trial where an artifact certainly occurs. The');
      note('  layer-mute A/B is exactly that control, and a run of it in the same sitting');
      note('  would close this. Until then the row rests on the null plus the meter.');
    } else if (realHeard > placeboHeard) {
      note('⚠ switching GLITCHES. That would put a chain selector in the same category as');
      note('  a fork (C5) and remove its main ergonomic advantage.');
    }
  }

  // ⚠ The meter is the independent instrument; a disagreement between it and the
  // ear is the genuinely alarming outcome and is what this fails on.
  const realMeters = rec.meters.filter((_, i) => rec.arms[i]);
  const placeboMeters = rec.meters.filter((_, i) => !rec.arms[i]);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  note(`meter: real avg ${avg(realMeters).toFixed(1)} vs placebo avg ${avg(placeboMeters).toFixed(1)}`);
  check('the ear AGREES with the meter',
    (avg(realMeters) < avg(placeboMeters)) === (realHeard / realN > placeboHeard / Math.max(1, placeboN))
    || avg(realMeters) === avg(placeboMeters),
    { realMeterAvg: avg(realMeters), placeboMeterAvg: avg(placeboMeters) });
  process.exit(failureCount() === 0 ? 0 : 1);
}

// ==========================================================================
if (mode === 'cleanup') {
  await client.connect();
  const built = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, { channelId: string }>;
  for (const [name, rec] of Object.entries(built)) {
    const idx = await indexOf(rec.channelId);
    if (idx === undefined) continue;
    await req('track.delete', { trackIndex: idx });
    await pollUntil(async () => (await indexOf(rec.channelId)) === undefined, 8000, 100);
    note(`removed ${name}`);
  }
  const after = await list();
  check('gn-E16 and Group 7 are untouched',
    after.tracks.some((t) => t.name === 'gn-E16') && after.tracks.some((t) => t.name === 'Group 7'),
    { names: after.tracks.map((t) => t.name) });
  process.exit(failureCount() === 0 ? 0 : 1);
}

console.log('usage: e16v-devab.ts setup|meter|ab-run <layer|selector>|ab-score <kind> <answers>|cleanup');
process.exit(2);
