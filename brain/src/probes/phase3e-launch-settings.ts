/**
 * Phase 1 session 3e, arm 1 — per-clip launch settings.
 *
 * This probe answers two questions separately:
 *
 *   1. Are launchQuantization, launchMode and Q-to-loop readable and writable?
 *      The write is verified through a SECOND pinned cursor, never through the
 *      handle that performed it.
 *   2. Does a HUMAN launcher click honour those values? The human arm compares
 *      `from_start` with `continue_or_synced`; the former is the control.
 *
 *     npm run probe:3e-settings          autonomous read/write arm
 *     npm run probe:3e-settings-human    human-click control and experiment
 *
 * The human arm rolls the transport. Every normal and failure exit stops it.
 * It never deletes or replaces content: rows 4 and 5 must be empty or already
 * contain clips at least four bars long.
 */
import {
  ask, check, client, ensureFixtureTracks, failureCount, note, pollUntil,
} from './lib.js';

const req = (method: string, params: Record<string, unknown> = {}) =>
  client.request(method, params);

interface LaunchSettings {
  exists: boolean;
  sceneIndex: number;
  launchQuantization: string;
  launchMode: string;
  useLoopStartAsQuantizationReference: boolean;
}

interface CursorPlay {
  playingStep: number;
  loopLength: number;
  sceneIndex: number;
}

interface SlotPlay {
  isPlaying: boolean;
  isPlaybackQueued: boolean;
  playPosition: number;
}

const settings = async (cursor: string): Promise<LaunchSettings> =>
  (await req('cursor.launchSettings', { cursor })) as LaunchSettings;
const play = async (cursor: string): Promise<CursorPlay> =>
  (await req('cursor.playState', { cursor })) as CursorPlay;

async function pinAt(cursor: string, trackIndex: number, row: number): Promise<boolean> {
  // A cursor left pinned by an earlier probe does not necessarily expose the
  // unpin in the very next request. Issuing pointTrack immediately can therefore
  // be accepted while the cursor still declines to follow it. Verify every
  // transition; otherwise this arm scores a launch setting against the wrong
  // clip, which is worse than refusing.
  await req('cursor.pin', { cursor, pinned: false });
  const unpinned = await pollUntil(async () => {
    const state = (await req('cursor.status', { cursor })) as { isPinned?: boolean };
    return state.isPinned === false;
  });
  if (!unpinned.ok) return false;

  await req('cursor.pointTrack', { cursor, trackIndex });
  await req('slot.select', { trackIndex, slotIndex: row, mechanism: 'track' });
  const landed = await pollUntil(async () => {
    const state = (await req('cursor.status', { cursor })) as {
      exists: boolean; sceneIndex: number; trackPosition: number;
    };
    return state.exists && state.sceneIndex === row && state.trackPosition === trackIndex;
  });
  if (!landed.ok) return false;

  await req('cursor.pin', { cursor, pinned: true });
  return (await pollUntil(async () => {
    const state = (await req('cursor.status', { cursor })) as { isPinned?: boolean };
    return state.isPinned === true;
  })).ok;
}

const same = (actual: LaunchSettings, wanted: Pick<LaunchSettings,
  'launchQuantization' | 'launchMode' | 'useLoopStartAsQuantizationReference'>): boolean =>
  actual.launchQuantization === wanted.launchQuantization
  && actual.launchMode === wanted.launchMode
  && actual.useLoopStartAsQuantizationReference === wanted.useLoopStartAsQuantizationReference;

const mode = process.argv[2] ?? 'write';
if (mode !== 'write' && mode !== 'human') {
  console.log('usage: phase3e-launch-settings.ts [write|human]');
  process.exit(2);
}

await client.connect();
const { trackA } = await ensureFixtureTracks();
const createdRows = new Set<number>();
let cleanupContentEpoch: number | undefined;

interface RevisionContent {
  readonly contentEpoch: number;
  readonly contentEvents?: readonly {
    seq: number;
    trackIndex: number;
    slotIndex: number;
    filled: boolean;
  }[];
}

async function cleanupOwnedClips(): Promise<void> {
  if (createdRows.size === 0) return;
  const now = (await req('revision.get')) as RevisionContent;
  const events = now.contentEvents ?? [];
  const oldest = events[0]?.seq ?? now.contentEpoch + 1;
  const windowIntact = cleanupContentEpoch === undefined
    || oldest <= cleanupContentEpoch + 1;
  const changed = cleanupContentEpoch === undefined ? [] : events.filter((event) =>
    event.seq > cleanupContentEpoch!
    && event.trackIndex === trackA
    && createdRows.has(event.slotIndex));
  if (!windowIntact || changed.length > 0) {
    note('CLEANUP REFUSED: a probe-created clip may have moved or been replaced; positional clips '
      + 'have no identity, so the probe will not guess at deletion.');
    return;
  }
  for (const row of [...createdRows].sort((a, b) => b - a)) {
    const status = (await req('slot.status', {
      trackIndex: trackA, slotIndex: row,
    })) as { hasContent: boolean };
    if (!status.hasContent) continue;
    await req('slot.delete', { trackIndex: trackA, slotIndex: row });
    await pollUntil(async () => {
      const after = (await req('slot.status', {
        trackIndex: trackA, slotIndex: row,
      })) as { hasContent: boolean };
      return !after.hasContent;
    });
  }
}

async function stopAndExit(code: number): Promise<never> {
  try { await req('transport.stop'); } catch { /* bridge loss is already the failure */ }
  try { await cleanupOwnedClips(); } catch { /* a failed cleanup must never broaden deletion */ }
  process.exit(code);
}

if (mode === 'write') {
  const landed0 = await pinAt('0', trackA, 0);
  const landed1 = await pinAt('1', trackA, 0);
  check('3e-LS0: two independent cursors point at the same existing clip', landed0 && landed1,
    { writer: landed0, reader: landed1 });
  if (!(landed0 && landed1)) process.exit(1);

  const before = await settings('1');
  const wanted = {
    launchQuantization: before.launchQuantization === '1' ? '8' : '1',
    launchMode: before.launchMode === 'continue_or_synced' ? 'from_start' : 'continue_or_synced',
    useLoopStartAsQuantizationReference: !before.useLoopStartAsQuantizationReference,
  } as const;

  await req('cursor.setLaunchSettings', { cursor: '0', ...wanted });
  const changed = await pollUntil(async () => same(await settings('1'), wanted));
  const readback = await settings('1');
  check('3e-LS1: all three settings are writable and readable through a second cursor',
    changed.ok && same(readback, wanted), { before, wanted, readback, ms: changed.ms });

  // Partial writes are important: setting launch mode must not silently reset a
  // clip's quantisation or Q-to-loop value to a caller-side default.
  const partialMode = wanted.launchMode === 'from_start' ? 'synced' : 'from_start';
  await req('cursor.setLaunchSettings', { cursor: '0', launchMode: partialMode });
  const partial = await pollUntil(async () => {
    const now = await settings('1');
    return now.launchMode === partialMode
      && now.launchQuantization === wanted.launchQuantization
      && now.useLoopStartAsQuantizationReference === wanted.useLoopStartAsQuantizationReference;
  });
  check('3e-LS2: a partial write changes only the named setting', partial.ok,
    await settings('1'));

  let invalidRefused = false;
  try {
    await req('cursor.setLaunchSettings', { cursor: '0', launchMode: 'not-a-launch-mode' });
  } catch (error) {
    invalidRefused = String(error).includes('not one of');
  }
  const bridgeAlive = (await settings('1')).exists;
  check('3e-LS3: an invalid free string is refused before Bitwig sees it',
    invalidRefused && bridgeAlive, { invalidRefused, bridgeAlive });

  // Give the clip back exactly as found. This is a probe, not a preference
  // setter, and these fields are durable project state.
  await req('cursor.setLaunchSettings', {
    cursor: '0',
    launchQuantization: before.launchQuantization,
    launchMode: before.launchMode,
    useLoopStartAsQuantizationReference: before.useLoopStartAsQuantizationReference,
  });
  const restored = await pollUntil(async () => same(await settings('1'), before));
  check('3e-LS4: the original settings are restored through independent readback',
    restored.ok, await settings('1'));

  console.log(`\nPhase 3e launch-settings write arm: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

// Human-click arm ------------------------------------------------------------

const TAKE_A = 4;
const TAKE_B = 5;
const MIN_BEATS = 16;

async function ensureLongClip(row: number): Promise<boolean> {
  const status = async () =>
    (await req('slot.status', { trackIndex: trackA, slotIndex: row })) as { hasContent: boolean };
  if (!(await status()).hasContent) {
    await req('clip.create', { trackIndex: trackA, slotIndex: row, lengthBeats: MIN_BEATS });
    createdRows.add(row);
    if (!(await pollUntil(async () => (await status()).hasContent)).ok) return false;
  }
  return true;
}

const existsA = await ensureLongClip(TAKE_A);
const existsB = await ensureLongClip(TAKE_B);
const pinnedA = existsA && await pinAt('0', trackA, TAKE_A);
const pinnedB = existsB && await pinAt('1', trackA, TAKE_B);
const stateA = pinnedA ? await play('0') : undefined;
const stateB = pinnedB ? await play('1') : undefined;
cleanupContentEpoch = ((await req('revision.get')) as RevisionContent).contentEpoch;
const usable = pinnedA && pinnedB
  && (stateA?.loopLength ?? 0) >= MIN_BEATS
  && (stateB?.loopLength ?? 0) >= MIN_BEATS;
check('3e-LH0: two four-bar takes are pinned for a distinguishable click test', usable,
  { takeA: stateA?.loopLength, takeB: stateB?.loopLength });
if (!usable) {
  note('REFUSING: an occupied row is never replaced. Empty rows are created; an existing short clip must be moved by the operator.');
  await stopAndExit(1);
}
if (!process.stdin.isTTY) {
  note('REFUSING: the human-click arm needs a person at the keyboard; run it directly in a terminal.');
  await stopAndExit(1);
}

const beforeB = await settings('1');

interface ClickResult {
  readonly previousStep: number;
  readonly incomingStep: number;
  readonly detected: boolean;
}

async function humanClickTrial(launchMode: 'from_start' | 'continue_or_synced'):
Promise<ClickResult> {
  await req('cursor.setLaunchSettings', {
    cursor: '1',
    launchQuantization: 'none',
    launchMode,
    useLoopStartAsQuantizationReference: false,
  });
  const armed = await pollUntil(async () => {
    const now = await settings('1');
    return now.launchQuantization === 'none' && now.launchMode === launchMode
      && now.useLoopStartAsQuantizationReference === false;
  });
  if (!armed.ok) return { previousStep: -1, incomingStep: -1, detected: false };

  await req('slot.launchWithOptions', {
    trackIndex: trackA, slotIndex: TAKE_A, quantization: 'none', launchMode: 'from_start',
  });
  const middle = await pollUntil(async () => {
    const p = await play('0');
    return p.playingStep >= 20 && p.playingStep <= 48;
  }, 20_000, 25);
  if (!middle.ok) return { previousStep: -1, incomingStep: -1, detected: false };

  let previousStep = (await play('0')).playingStep;
  const watcher = (async (): Promise<ClickResult> => {
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      const outgoing = await play('0');
      if (outgoing.playingStep >= 0) previousStep = outgoing.playingStep;
      const slot = (await req('slot.playState', {
        trackIndex: trackA, slotIndex: TAKE_B,
      })) as SlotPlay;
      if (slot.isPlaying) {
        return { previousStep, incomingStep: (await play('1')).playingStep, detected: true };
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return { previousStep, incomingStep: -1, detected: false };
  })();

  await ask(`In Bitwig, click the launcher clip on track gn-A, row ${TAKE_B + 1}. `
    + `This is the ${launchMode} arm. Then return here and press Enter.`);
  return watcher;
}

note('The control must restart near step 0; the experiment must enter near the outgoing step.');
const control = await humanClickTrial('from_start');
check('3e-LH1 control: a human click honours per-clip from_start',
  control.detected && control.incomingStep >= 0 && control.incomingStep <= 5, control);

const experiment = await humanClickTrial('continue_or_synced');
const distance = experiment.detected
  ? Math.abs(experiment.incomingStep - experiment.previousStep)
  : Number.POSITIVE_INFINITY;
check('3e-LH2 experiment: a human click honours per-clip continue_or_synced',
  experiment.detected && experiment.incomingStep > 5 && distance <= 6,
  { ...experiment, stepDistance: distance });

interface QuantizedClickResult {
  readonly detected: boolean;
  readonly queued: boolean;
  readonly playPosition: number;
}

async function humanQuantizedTrial(): Promise<QuantizedClickResult> {
  await req('cursor.setLaunchSettings', {
    cursor: '1',
    launchQuantization: '1',
    launchMode: 'continue_or_synced',
    useLoopStartAsQuantizationReference: false,
  });
  const armed = await pollUntil(async () => {
    const now = await settings('1');
    return now.launchQuantization === '1' && now.launchMode === 'continue_or_synced';
  });
  if (!armed.ok) return { detected: false, queued: false, playPosition: -1 };

  await req('slot.launchWithOptions', {
    trackIndex: trackA, slotIndex: TAKE_A, quantization: 'none', launchMode: 'from_start',
  });
  const awayFromBar = await pollUntil(async () => {
    const p = await play('0');
    return p.playingStep >= 5 && p.playingStep <= 11;
  }, 20_000, 25);
  if (!awayFromBar.ok) return { detected: false, queued: false, playPosition: -1 };

  const watcher = (async (): Promise<QuantizedClickResult> => {
    const started = Date.now();
    let queued = false;
    while (Date.now() - started < 120_000) {
      const state = (await req('slot.playState', {
        trackIndex: trackA, slotIndex: TAKE_B,
      })) as SlotPlay;
      queued ||= state.isPlaybackQueued;
      if (state.isPlaying) {
        return { detected: true, queued, playPosition: state.playPosition };
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return { detected: false, queued, playPosition: -1 };
  })();

  await ask(`In Bitwig, click the launcher clip on track gn-A, row ${TAKE_B + 1}. `
    + 'This arm has a one-bar per-clip launch grid. Then return here and press Enter.');
  return watcher;
}

const quantized = await humanQuantizedTrial();
const withinBar = quantized.detected
  ? Math.min(((quantized.playPosition % 4) + 4) % 4,
      4 - (((quantized.playPosition % 4) + 4) % 4))
  : Number.POSITIVE_INFINITY;
check('3e-LH3: a human click honours the per-clip one-bar quantization',
  quantized.detected && quantized.queued && withinBar <= 0.35,
  { ...quantized, beatsFromBar: withinBar });

await req('cursor.setLaunchSettings', {
  cursor: '1',
  launchQuantization: beforeB.launchQuantization,
  launchMode: beforeB.launchMode,
  useLoopStartAsQuantizationReference: beforeB.useLoopStartAsQuantizationReference,
});
const restored = await pollUntil(async () => same(await settings('1'), beforeB));
check('3e-LH4: take B launch settings are restored', restored.ok, await settings('1'));

console.log(`\nPhase 3e human-click arm: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
await stopAndExit(failureCount() === 0 ? 0 : 1);
