/**
 * Phase 1 session 3f-g — does winner collapse disturb the rebuilt track itself?
 *
 * E18h measured a different track while rebuilding gn-B, so its clean MOVE result
 * was project-wide engine evidence only. This probe copies the known-audible
 * `gn-lay` fixture, makes one named alternate exclusive, launches the copied
 * track's own clip, and collapses that same track through the production tool.
 * Placebo arms catch expectation; a proved transport-stop gap followed by
 * relaunch proves the listener and rig can hear a dropout in this exact signal.
 *
 * Accepted 2026-08-15 result: two blind sets each heard collapse 2/2 and placebo
 * 0/2. Their original control implementations were invalidated rather than
 * counted: track mute read back but did not silence Master, and VU `now`/`hold`
 * remained latched after transport stopped. A subsequent randomized two-arm
 * gate heard the 1200ms stop/relaunch control and not its placebo; stopped
 * transport and resumed Master peak 62 were proved programmatically. Combined
 * result: own-track collapse audible 4/4 versus placebo 0/4. The initial run
 * that accidentally muted Master and a later distracted gate were voided.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { askYesNo, check, client as bridge, failureCount, note, pollUntil, waitForEnter } from './lib.js';

const SOURCE = 'gn-lay';
const TRIAL_FLOOR_MS = 12_000;
const CONTROL_CHECK = process.argv[2] === 'control-check';
const GATE_CHECK = process.argv[2] === 'gate';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const req = (method: string, params: Record<string, unknown> = {}) => bridge.request(method, params);

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', 'src/mcp-server.ts'],
});
const mcp = new Client({ name: 'phase3f-collapse-audio', version: '0.0.1' });

const parse = (result: unknown): Record<string, unknown> => {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return JSON.parse(content.find((part) => part.type === 'text')?.text ?? '{}') as Record<string, unknown>;
};
const call = async (name: string, args: Record<string, unknown> = {}) =>
  parse(await mcp.callTool({ name, arguments: args }));

interface TrackRow { index: number; name: string; channelId: string; type: string }
interface DeviceRow { index: number; name: string }
type Arm = 'COLLAPSE' | 'PLACEBO' | 'CONTROL';

const tracks = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
const resolveIndex = async (channelId: string): Promise<number> => {
  const found = (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
  if (!found.found || found.index === undefined) throw new Error(`track ${channelId} no longer resolves`);
  return found.index;
};
const devices = async (channelId: string): Promise<DeviceRow[]> => {
  await req('cursor.pointTrack', { cursor: '0', trackIndex: await resolveIndex(channelId) });
  await wait(500);
  return ((await req('device.list', { cursor: '0' })) as { devices: DeviceRow[] }).devices;
};

if (!process.stdin.isTTY) {
  console.log('REFUSING: this probe is decided by a human listener. Run `npm run probe:3f-collapse-audio`.');
  process.exit(1);
}

let activeCopy: string | undefined;
let priorMutes: { channelId: string; mute: boolean }[] = [];
const results: { arm: Arm; heard: boolean; detail: unknown }[] = [];

try {
  await bridge.connect();
  await mcp.connect(transport);
  await req('transport.stop');

  const initial = await tracks();
  const sourceHits = initial.filter((track) => track.name === SOURCE);
  check('audio fixture is uniquely addressable', sourceHits.length === 1, { sourceHits });
  if (sourceHits.length !== 1) throw new Error(`expected one track named ${SOURCE}`);
  const source = sourceHits[0]!;

  // Silence ordinary source tracks, retaining exact prior mute state by durable
  // id. Group/routing, FX and Master rows remain open: muting them can silence
  // the copied subject downstream even while its own pre-mute meter still moves.
  // Each copied subject is explicitly unmuted after copying.
  for (const track of initial) {
    const mixer = (await req('branch.mixer', { trackIndex: track.index })) as { mute: boolean };
    priorMutes.push({ channelId: track.channelId, mute: mixer.mute });
    const ordinarySource = track.type === 'Instrument' || track.type === 'Hybrid';
    if (ordinarySource && !mixer.mute) {
      await req('branch.setMixer', { trackIndex: track.index, mute: true });
    }
  }

  console.log(CONTROL_CHECK
    ? '\nProgrammatic stop/relaunch control check; no listening verdict will be requested.'
    : GATE_CHECK
      ? '\nTwo blind validity-gate trials: one proved stop/relaunch control and one placebo.'
      : '\nFive blind trials: two collapse, two placebo, one guaranteed dropout control.');
  if (!CONTROL_CHECK) {
    console.log('Listen for a click, dropout, stutter or crackle—not a screen cue.');
    await waitForEnter('Ready');
  }

  const plan: Arm[] = CONTROL_CHECK
    ? ['CONTROL']
    : GATE_CHECK
      ? ['CONTROL', 'PLACEBO']
      : ['COLLAPSE', 'COLLAPSE', 'PLACEBO', 'PLACEBO', 'CONTROL'];
  if (!CONTROL_CHECK) {
    for (let i = plan.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [plan[i], plan[j]] = [plan[j]!, plan[i]!];
    }
  }

  for (let trial = 0; trial < plan.length; trial += 1) {
    const arm = plan[trial]!;
    const copyName = `gn-3f-audio-${process.pid}-${trial}`;
    const copied = await call('copy_track', { trackId: source.channelId, name: copyName }) as {
      applied?: boolean; copied?: { trackId?: string } | null;
    };
    activeCopy = copied.copied?.trackId;
    if (copied.applied !== true || activeCopy === undefined) throw new Error('fixture copy was not proved');
    await req('branch.setMixer', { trackIndex: await resolveIndex(activeCopy), mute: false });

    const top = await devices(activeCopy);
    const container = top.find((item) => /Layer/i.test(item.name));
    if (container === undefined) throw new Error('copied fixture has no observable layer container');
    const inspected = await call('inspect_device_alternates', {
      trackId: activeCopy, containerPosition: container.index,
    }) as { complete?: boolean; alternates?: { name: string; devices?: unknown[] }[] };
    const winner = inspected.alternates?.find((item) => (item.devices?.length ?? 0) > 0);
    if (inspected.complete !== true || winner === undefined) {
      throw new Error('copied fixture has no complete, populated named alternate');
    }
    const switched = await call('switch_device_alternate', {
      trackId: activeCopy, containerPosition: container.index, alternateName: winner.name,
    });
    if (switched['applied'] !== true || switched['exclusiveStateConfirmed'] !== true) {
      throw new Error('the winner could not be made exclusive before listening');
    }

    const launched = await call('launch_clip', {
      trackId: activeCopy, row: 0, quantization: 'none', mode: 'from_start',
    });
    if (launched['applied'] !== true) throw new Error('the copied fixture clip did not launch');
    await req('branch.vu', { reset: true });
    await wait(2500);
    const vu = (await req('branch.vu')) as { tracks: { name: string; hold: number }[] };
    const peak = vu.tracks.find((item) => item.name === copyName)?.hold ?? 0;
    const masterPeak = vu.tracks.find((item) => item.name === 'Master')?.hold ?? 0;
    if (peak < 20 || masterPeak < 20) {
      throw new Error(`the collapsing signal is not audible at both meters (track ${peak}, Master ${masterPeak})`);
    }

    console.log(`\nTrial ${trial + 1}/${plan.length}: the copied track is sounding.`);
    if (!CONTROL_CHECK) await waitForEnter('Listening? Press Enter to fire the hidden arm');
    const started = Date.now();
    let detail: unknown = 'nothing';
    if (arm === 'COLLAPSE') {
      detail = await call('keep_device_alternate', {
        trackId: activeCopy, containerPosition: container.index, alternateName: winner.name,
      });
      const outcome = detail as Record<string, unknown>;
      if (outcome['applied'] !== true || outcome['finalPositionConfirmed'] !== true) {
        throw new Error(`collapse did not complete: ${JSON.stringify(outcome)}`);
      }
    } else if (arm === 'CONTROL') {
      await req('transport.stop');
      const stopped = await pollUntil(async () =>
        !((await req('transport.status')) as { isPlaying: boolean }).isPlaying,
      5000, 100);
      if (!stopped.ok) throw new Error('positive-control transport stop did not read back');
      await req('branch.vu', { reset: true });
      await wait(1200);
      const silentRows = (await req('branch.vu')) as { tracks: { name: string; now: number }[] };
      const silentNow = silentRows.tracks.find((item) => item.name === 'Master')?.now ?? 100;
      // VU `now` remains latched at its last callback value while transport is
      // stopped, so it cannot prove silence. Keep the observed value in the
      // evidence, but gate on stopped transport plus resumed Master signal.
      const relaunched = await call('launch_clip', {
        trackId: activeCopy, row: 0, quantization: 'none', mode: 'from_start',
      });
      if (relaunched['applied'] !== true) throw new Error('positive-control relaunch did not apply');
      await req('branch.vu', { reset: true });
      await wait(1200);
      const resumedRows = (await req('branch.vu')) as { tracks: { name: string; hold: number }[] };
      const resumedPeak = resumedRows.tracks.find((item) => item.name === 'Master')?.hold ?? 0;
      if (resumedPeak < 20) {
        throw new Error(`positive-control signal did not resume at Master (peak ${resumedPeak})`);
      }
      detail = { forcedStopMs: 1200, stoppedReadBack: true, silentNow, resumedPeak };
    }
    const elapsed = Date.now() - started;
    if (elapsed < TRIAL_FLOOR_MS) await wait(TRIAL_FLOOR_MS - elapsed);
    results.push({
      arm,
      heard: CONTROL_CHECK ? false : await askYesNo('Did you hear a click, dropout, stutter or crackle?'),
      detail,
    });

    await req('transport.stop');
    const removed = await call('delete_track', { trackIds: [activeCopy] });
    if (removed['applied'] !== true) throw new Error('trial copy cleanup was not confirmed');
    activeCopy = undefined;
  }
} catch (error) {
  check('collapse audio run completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try { await req('transport.stop'); } catch { /* already reported */ }
  if (activeCopy !== undefined) {
    try { await call('delete_track', { trackIds: [activeCopy] }); } catch { /* reported below by residue */ }
  }
  for (const prior of priorMutes) {
    try {
      await req('branch.setMixer', { trackIndex: await resolveIndex(prior.channelId), mute: prior.mute });
    } catch { /* a human may have removed a baseline track */ }
  }
  try { await mcp.close(); } catch { /* child may already be closed */ }
  bridge.disconnect();
}

if (results.length > 0) {
  console.log('\nReveal:');
  results.forEach((row, index) => console.log(
    `  ${index + 1}: ${row.arm.padEnd(8)} heard=${row.heard ? 'yes' : 'no'} ${JSON.stringify(row.detail)}`));
  if (CONTROL_CHECK) {
    check('the stop/relaunch control was proved at transport and Master',
      results.length === 1 && typeof results[0]?.detail === 'object', results[0]);
  } else {
    const collapse = results.filter((row) => row.arm === 'COLLAPSE');
    const placebo = results.filter((row) => row.arm === 'PLACEBO');
    const control = results.filter((row) => row.arm === 'CONTROL');
    check('placebo arms were clean', placebo.length === (GATE_CHECK ? 1 : 2)
      && placebo.every((row) => !row.heard), { placebo });
    check('the proved own-track stop/relaunch dropout was heard',
      control.length === 1 && control[0]?.heard === true, { control });
    if (!GATE_CHECK) {
      note(`own-track collapse: ${collapse.filter((row) => row.heard).length}/${collapse.length} audible`);
      note('Cross-device modulation was not exercised and remains outside this claim.');
    }
  }
}

process.exit(failureCount() === 0 ? 0 : 1);
