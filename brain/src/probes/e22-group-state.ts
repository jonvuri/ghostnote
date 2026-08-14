/**
 * E22 — isolate the host/UI state that makes Editing action `Group` miss, then
 * measure how durable that state is.
 *
 * One invocation is one scored arm. Every arm creates its own disposable
 * fixtures, establishes the exact E16j/E16k selection recipe, invokes Group
 * once through the production guarded seam, diffs every structural level it can
 * read, and returns the project to its exact pre-arm baseline.
 *
 * CONTROL ROWS — the E22 originals, kept measurement-compatible.
 *
 *   npm run probe:e22 -- cold    fresh process/project, UI untouched  (was `a`)
 *   npm run probe:e22 -- prime   human clicks the disposable target's header (was `b`)
 *   npm run probe:e22 -- warm    no human action, new target, primed sitting
 *   npm run probe:e22 -- focus   focus_track_header_area, then re-point  (was `c`)
 *
 * DESTRUCTION ROWS — one intervening human focus move each, then the same fire.
 *
 *   npm run probe:e22 -- clip        prime, then click an EMPTY launcher slot on the target's row
 *   npm run probe:e22 -- clip-other  prime, then click an empty slot on a separate sacrificial track
 *   npm run probe:e22 -- device      prime, then click the target's disposable device header
 *   npm run probe:e22 -- chain       prime, then click a chain lane in the target's disposable container
 *   npm run probe:e22 -- tab         prime, then switch project tabs away and back
 *
 * ⚠ The destructor click is deliberately kept on the TARGET's own row wherever
 * the panel allows it, so the arm varies the focused AREA and nothing else. A
 * click on another track's header would re-prime whatever it destroyed, and a
 * device or chain lane belonging to another track is not even reachable without
 * one. `clip-other` is the paired second variable, run only after `clip`.
 *
 * ⚠ RELOAD is an operating procedure, not a mode: run `prime`, have the operator
 * reload `gn-scale-test` without clicking anything else, then run `cold`. A
 * reload regenerates chain ids (E18 §3.2) and would strand fixtures minted
 * before it, so no single process may straddle one.
 *
 * Flags: --label=<text> --deep --no-deep --seconds=<n>
 *
 * Helpers are named READ_* or WRITE_* because E17 established that a helper
 * which selects anything is a write even when its caller only wanted state.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

import { ask, check, client, failureCount, note, pollUntil, trackedRequest } from './lib.js';

const rawRequest = trackedRequest();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';
const FX_LAYER = 'a0913b7f-096b-4ac9-bddd-33c775314b42';

type TrackRow = {
  index: number;
  name: string;
  position: number;
  type: string;
  channelId: string;
};
type Listing = { tracks: TrackRow[]; count: number; itemCount: number; bankSize: number };
type Resolved = { found: boolean; index?: number; name?: string; type?: string };
type GroupState = { channelId: string; name: string; expanded: boolean };
type Selection = { trackIndex: number; slotIndex: number; mixerTrackIndex: number; changes: number };

/** Everything one arm can read without guessing. Devices/chains are cursor-bought. */
type Snapshot = {
  at: string;
  tracks: TrackRow[];
  sceneCount: number;
  /** `${channelId}#${slotIndex}` → hasContent. Bank-read, so cursor-free and safe. */
  clips: Record<string, boolean>;
  /** channelId → device names, in chain order. Only present on a deep snapshot. */
  devices?: Record<string, string>;
  /** channelId → chain inventory digest. Only present on a deep snapshot. */
  chains?: Record<string, string>;
};

// ---------------------------------------------------------------- row table

type Destructor = 'clip-on-target' | 'clip-on-sacrificial' | 'device-header' | 'chain-lane' | 'project-tab';

type Row = {
  /** Does a human click the disposable target's TRACK HEADER before the fire? */
  prime: boolean;
  /** The intervening human focus move under test, if any. */
  destructor?: Destructor;
  /** Fire `focus_track_header_area` from the controller instead of a human click. */
  focusAction?: boolean;
  /** What the matrix already knows. `unknown` rows are the measurement. */
  expect: 'wrap' | 'miss' | 'unknown';
  /** Read devices and chains too. Costs one UI selection change per track. */
  deep: boolean;
  fixtures: { clip?: boolean; device?: boolean; container?: boolean; sacrificial?: boolean };
  question: string;
};

const ROWS: Record<string, Row> = {
  cold: {
    prime: false, expect: 'miss', deep: false, fixtures: {},
    question: 'did the Bitwig lifecycle clear the latch?',
  },
  warm: {
    prime: false, expect: 'wrap', deep: false, fixtures: {},
    question: 'does the latch still hold on a new target with no new human action?',
  },
  prime: {
    prime: true, expect: 'wrap', deep: false, fixtures: {},
    question: 'can this sitting be primed (also the recovery control)?',
  },
  focus: {
    prime: false, focusAction: true, expect: 'miss', deep: false, fixtures: {},
    question: 'can the controller establish the latch itself?',
  },
  clip: {
    prime: true, destructor: 'clip-on-target', expect: 'unknown', deep: true,
    fixtures: { clip: true },
    question: 'does clip-launcher focus on the same track displace or redirect it?',
  },
  'clip-other': {
    prime: true, destructor: 'clip-on-sacrificial', expect: 'unknown', deep: true,
    fixtures: { sacrificial: true, clip: true },
    question: 'does a launcher click on a DIFFERENT track displace or redirect it?',
  },
  device: {
    prime: true, destructor: 'device-header', expect: 'unknown', deep: true,
    fixtures: { device: true },
    question: 'does device-panel focus displace or redirect it?',
  },
  chain: {
    prime: true, destructor: 'chain-lane', expect: 'unknown', deep: true,
    fixtures: { container: true },
    question: 'does chain focus displace or redirect it?',
  },
  tab: {
    prime: true, destructor: 'project-tab', expect: 'unknown', deep: true,
    fixtures: {},
    question: 'is the latch project-tab scoped?',
  },
  rescue: {
    prime: false, expect: 'unknown', deep: false, fixtures: {},
    question: 'remove a probe group a refused cleanup left behind '
      + '(--group=<channelId> --child=<channelId>)',
  },
};

const ALIASES: Record<string, string> = { a: 'cold', b: 'prime', c: 'focus' };

// ------------------------------------------------------------------- CLI

const argv = process.argv.slice(2);
const positional = argv.filter((arg) => !arg.startsWith('--'));
const flag = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name: string) => argv.includes(`--${name}`);

const MODE = ALIASES[(positional[0] ?? '').toLowerCase()] ?? (positional[0] ?? '').toLowerCase();
const ROW = ROWS[MODE];
if (ROW === undefined) {
  console.log('usage: npm run probe:e22 -- <mode> [--label=text] [--deep|--no-deep] [--seconds=n]');
  for (const [name, row] of Object.entries(ROWS)) {
    console.log(`  ${name.padEnd(11)} expect ${row.expect.padEnd(7)} — ${row.question}`);
  }
  console.log('  (legacy aliases: a=cold, b=prime, c=focus)');
  console.log('\n  RELOAD is a procedure, not a mode: run `prime`, have the operator reload');
  console.log('  the project touching nothing else, then run `cold`.');
  process.exit(2);
}

const LABEL = flag('label') ?? MODE;
const DEEP = has('deep') ? true : has('no-deep') ? false : ROW.deep;
const SECONDS = Number(flag('seconds') ?? 20);
const INTERACTIVE = process.stdin.isTTY === true;
const TARGET_NAME = `gn-E22-${MODE}-target`;
const SACRIFICIAL_NAME = `gn-E22-${MODE}-sacrificial`;

// ------------------------------------------------------- transcript capture

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const logPath = resolvePath(process.cwd(), '.tmp', 'e22', `${stamp}-${MODE}.log`);
mkdirSync(dirname(logPath), { recursive: true });
const realLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  realLog(...args);
  try {
    appendFileSync(logPath, `${args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')}\n`);
  } catch {
    // A transcript is a convenience; never let it take the arm down.
  }
};

// --------------------------------------------------------- RPC bookkeeping

const startedAt = Date.now();
let callNumber = 0;
const calls: { n: number; atMs: number; kind: 'READ' | 'WRITE'; method: string; ms: number }[] = [];
/** Human steps are part of the ordered record; they are what the arm varies. */
const timeline: string[] = [];

async function request(
  kind: 'READ' | 'WRITE',
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const n = ++callNumber;
  const atMs = Date.now() - startedAt;
  const before = Date.now();
  const result = await rawRequest(method, params);
  const ms = Date.now() - before;
  calls.push({ n, atMs, kind, method, ms });
  note(`${String(n).padStart(3, '0')} +${String(atMs).padStart(6)}ms ${kind.padEnd(5)} ${method} (${ms}ms)`);
  return result;
}

/**
 * A contiguous sweep, collapsed on screen and kept call-for-call in the file.
 *
 * The clip sweep is one read per visible slot and would bury the short sequence
 * the arm is actually judged on. Nothing is dropped: every inner call still
 * enters `calls`, the transcript still carries the full ordered list, and the
 * screen gets the block's true first/last call numbers and elapsed time.
 */
const blocks: { fromN: number; toN: number; kind: 'READ' | 'WRITE'; label: string; ms: number }[] = [];

async function bulk<T>(kind: 'READ' | 'WRITE', label: string, body: () => Promise<T>): Promise<T> {
  const fromN = callNumber + 1;
  const started = Date.now();
  const quiet = console.log;
  console.log = () => {};
  let result: T;
  try {
    result = await body();
  } finally {
    console.log = quiet;
  }
  const ms = Date.now() - started;
  blocks.push({ fromN, toN: callNumber, kind, label, ms });
  note(`${String(fromN).padStart(3, '0')}-${String(callNumber).padStart(3, '0')} `
    + `${kind.padEnd(5)} ${label} — ${callNumber - fromN + 1} calls in ${ms}ms`);
  return result;
}

// ------------------------------------------------------------------ reads

const READ_list = async () => (await request('READ', 'track.list')) as Listing;
const READ_resolve = async (channelId: string) =>
  (await request('READ', 'track.resolveByChannelId', { channelId })) as Resolved;
const READ_selection = async () => (await request('READ', 'selection.status')) as Selection;
const READ_sceneCount = async () =>
  ((await request('READ', 'scene.count')) as { sceneCount: number }).sceneCount;
const ids = (tracks: TrackRow[]) => new Set(tracks.map((track) => track.channelId));
const layout = (tracks: TrackRow[]) => tracks
  .map((track) => `${track.position}:${track.name}${track.type === 'Group' ? '*' : ''}`)
  .join('  ');

let baseline: Snapshot | undefined;
let originalGroups: GroupState[] = [];
let targetId: string | undefined;
let sacrificialId: string | undefined;
let createdGroupId: string | undefined;
let collapseProved = false;
let cleanupRefused = false;
let refusalReason = '';

async function READ_groupState(track: TrackRow): Promise<GroupState> {
  const mixer = (await request('READ', 'branch.mixer', { trackIndex: track.index })) as {
    channelId: string;
    name: string;
    isGroupExpanded: boolean;
  };
  return { channelId: mixer.channelId, name: mixer.name, expanded: mixer.isGroupExpanded };
}

/**
 * Read one track's device and chain topology, and PROVE the reading is that
 * track's before believing it.
 *
 * ⚠ `device.list` and `chain.inventory` both read banks bound to `cursorTracks[0]`,
 * and those banks rebind on the host's schedule, not on `cursor.pointTrack`'s
 * return. A read issued 25 ms after the move comes back holding the PREVIOUS
 * track's devices — which is how a bare new instrument track once reported the
 * `Instrument Selector | Filter+` belonging to the row above it, and how a
 * populated container read as empty. Both looked exactly like a structural
 * mutation and would have been written up as one.
 *
 * So the reading has to name itself: `chain.inventory` carries the cursor's own
 * `trackName`, and the values must additionally repeat unchanged across two
 * consecutive reads before being trusted. A track that never stabilises is
 * reported as unstable rather than recorded as a change (E18 guard 4 — an
 * impossible delta means you are reading the wrong object; do not score it).
 */
async function READ_deepAt(track: TrackRow): Promise<{ ok: boolean; devices: string; chains: string }> {
  let previousDevices: string | undefined;
  let previousChains: string | undefined;
  const started = Date.now();
  for (;;) {
    const listed = (await request('READ', 'device.list', { cursor: 0 })) as {
      devices: { index: number; name: string }[];
    };
    const devices = listed.devices.map((device) => `${device.index}:${device.name}`).join(' | ');
    const inventory = (await request('READ', 'chain.inventory')) as {
      scopes?: unknown[]; trackName?: string;
    };
    const chains = JSON.stringify(inventory.scopes ?? []);
    if (inventory.trackName === track.name && devices === previousDevices && chains === previousChains) {
      return { ok: true, devices, chains };
    }
    if (Date.now() - started > 4000) return { ok: false, devices, chains };
    previousDevices = devices;
    previousChains = chains;
    await wait(60);
  }
}

/**
 * Snapshot every level this rig can read.
 *
 * ⚠ `deep` costs one `cursor.pointTrack` per visible track, and that call is
 * `CursorTrack.selectChannel()` — a UI selection change (E17 method guard).
 * A deep snapshot is therefore only ever taken BEFORE the human prime click and
 * AFTER the fire, never between them.
 */
async function READ_snapshot(at: string, deep: boolean): Promise<Snapshot> {
  const listing = await READ_list();
  const sceneCount = await READ_sceneCount();
  const clips: Record<string, boolean> = {};
  await bulk('READ', `slot.status sweep (${at})`, async () => {
    for (const track of listing.tracks) {
      for (let slotIndex = 0; slotIndex < sceneCount; slotIndex++) {
        const slot = (await request('READ', 'slot.status', {
          trackIndex: track.index, slotIndex,
        })) as { hasContent: boolean };
        clips[`${track.channelId}#${slotIndex}`] = slot.hasContent;
      }
    }
  });
  if (!deep) return { at, tracks: listing.tracks, sceneCount, clips };

  const devices: Record<string, string> = {};
  const chains: Record<string, string> = {};
  const unstable: string[] = [];
  await bulk('WRITE', `device+chain sweep (${at}) — moves the track cursor`, async () => {
    await request('WRITE', 'cursor.pinTrack', { cursor: 0, pinned: false });
    for (const track of listing.tracks) {
      await request('WRITE', 'cursor.pointTrack', { cursor: '0', trackIndex: track.index });
      const settled = await READ_deepAt(track);
      if (settled.ok) {
        devices[track.channelId] = settled.devices;
        chains[track.channelId] = settled.chains;
      } else {
        unstable.push(track.name);
      }
    }
  });
  // An unstable row is simply absent from this level, and `diffSnapshots` skips
  // any key it cannot find on both sides. A reading we could not attribute must
  // never become evidence of a change.
  if (unstable.length > 0) {
    check(`snapshot (${at}): every visible row's device/chain reading named its own track`,
      false, { unstable });
  }
  return { at, tracks: listing.tracks, sceneCount, clips, devices, chains };
}

// ------------------------------------------------------------------ diffs

type Diff = { violations: string[]; redirects: string[] };

/**
 * Diff two snapshots at every level.
 *
 * `violations` are changes to identities the probe did not create — the stop
 * condition. `redirects` are changes to probe-owned fixtures other than the one
 * expected track group: a `Group` that grouped DEVICES instead of the track
 * lands here, and that is the misdispatch hazard the matrix exists to find.
 */
function diffSnapshots(before: Snapshot, after: Snapshot, probeOwned: Set<string>): Diff {
  const violations: string[] = [];
  const redirects: string[] = [];

  const beforeIds = ids(before.tracks);
  const afterById = new Map(after.tracks.map((track) => [track.channelId, track]));

  for (const track of before.tracks) {
    const now = afterById.get(track.channelId);
    const owned = probeOwned.has(track.channelId);
    if (now === undefined) {
      (owned ? redirects : violations).push(`track vanished: ${track.name} (${track.channelId})`);
      continue;
    }
    if (now.name !== track.name) {
      (owned ? redirects : violations).push(`track renamed: ${track.name} → ${now.name}`);
    }
    if (now.type !== track.type) {
      (owned ? redirects : violations).push(`track type changed: ${track.name} ${track.type} → ${now.type}`);
    }
  }

  // Relative order of surviving pre-existing rows. Absolute positions shift when
  // a group is inserted, so only the ORDER is evidence of something moving.
  const orderBefore = before.tracks
    .filter((track) => !probeOwned.has(track.channelId) && afterById.has(track.channelId))
    .map((track) => track.channelId);
  const orderAfter = after.tracks
    .filter((track) => !probeOwned.has(track.channelId) && beforeIds.has(track.channelId))
    .map((track) => track.channelId);
  if (orderBefore.join(',') !== orderAfter.join(',')) {
    violations.push(`pre-existing track order changed: ${orderBefore.join(',')} → ${orderAfter.join(',')}`);
  }

  if (after.sceneCount !== before.sceneCount) {
    violations.push(`scene count ${before.sceneCount} → ${after.sceneCount}`);
  }

  for (const [key, had] of Object.entries(before.clips)) {
    const channelId = key.split('#')[0] ?? '';
    const owned = probeOwned.has(channelId);
    if (!(key in after.clips)) {
      if (afterById.has(channelId)) {
        (owned ? redirects : violations).push(`clip slot disappeared: ${key}`);
      }
      continue;
    }
    if (after.clips[key] !== had) {
      (owned ? redirects : violations).push(`clip content ${had} → ${after.clips[key]} at ${key}`);
    }
  }

  for (const level of ['devices', 'chains'] as const) {
    const beforeLevel = before[level];
    const afterLevel = after[level];
    if (beforeLevel === undefined || afterLevel === undefined) continue;
    for (const [channelId, was] of Object.entries(beforeLevel)) {
      if (!afterById.has(channelId)) continue;
      const now = afterLevel[channelId];
      if (now === undefined) continue;
      if (now !== was) {
        const owned = probeOwned.has(channelId);
        const where = afterById.get(channelId)?.name ?? channelId;
        (owned ? redirects : violations).push(`${level} changed on ${where}: ${was} → ${now}`);
      }
    }
  }

  return { violations, redirects };
}

// ---------------------------------------------------------- human gating

function banner(lines: string[]): void {
  console.log('\n' + '='.repeat(76));
  for (const line of lines) console.log(` ${line}`);
  console.log('='.repeat(76));
}

/**
 * Hand the arm to the operator and wait.
 *
 * With a TTY the operator says when they are done and reports what they clicked,
 * which is the only witness some of these rows have (nothing observes device
 * selection). Without one the arm falls back to a countdown and records the step
 * as UNWITNESSED rather than inventing a confirmation — an empty pipe is not a
 * human report (see `ask` in lib.ts).
 */
async function humanStep(instruction: string[], confirm: string): Promise<string> {
  banner(instruction);
  if (INTERACTIVE) {
    await ask('press Enter when that click is done');
    const said = await ask(confirm);
    const answer = said.length > 0 ? said : '(no answer given)';
    timeline.push(`HUMAN +${Date.now() - startedAt}ms — ${instruction[0]} — operator: ${answer}`);
    return answer;
  }
  console.log(`   no TTY: falling back to a ${SECONDS}s countdown. This step will be UNWITNESSED.`);
  for (let seconds = SECONDS; seconds > 0; seconds--) {
    process.stdout.write(`\r   continuing in ${String(seconds).padStart(2)}s … `);
    await wait(1000);
  }
  console.log('\r   continuing.                    ');
  timeline.push(`HUMAN +${Date.now() - startedAt}ms — ${instruction[0]} — UNWITNESSED (countdown)`);
  return 'UNWITNESSED (countdown mode)';
}

// ---------------------------------------------------------------- writes

async function WRITE_setGroupExpanded(channelId: string, expanded: boolean): Promise<boolean> {
  const at = await READ_resolve(channelId);
  if (!at.found || at.index === undefined) return false;
  await request('WRITE', 'branch.setMixer', { trackIndex: at.index, groupExpanded: expanded });
  return (await pollUntil(async () => {
    const current = await READ_resolve(channelId);
    if (!current.found || current.index === undefined) return false;
    const mixer = (await request('READ', 'branch.mixer', { trackIndex: current.index })) as {
      isGroupExpanded: boolean;
    };
    return mixer.isGroupExpanded === expanded;
  }, 4000, 100)).ok;
}

async function WRITE_delete(channelId: string): Promise<boolean> {
  const at = await READ_resolve(channelId);
  if (!at.found || at.index === undefined) return true;
  await request('WRITE', 'track.delete', { trackIndex: at.index });
  return (await pollUntil(async () => !(await READ_resolve(channelId)).found, 6000, 150)).ok;
}

/**
 * Park the selection on one known row and wait for the observer to say so.
 *
 * ⚠ The deep sweep points the track cursor at every visible row in turn and its
 * last stop is whatever sits at the end of the bank — Master, in `gn-scale-test`.
 * `addIsSelectedInMixerObserver` reports on the host's own schedule, so a flush
 * from the sweep can still be in flight when the measured sequence reads back,
 * and the arm then sees the sweep's last row where its target should be. That is
 * a drained-queue problem, not a selection problem: this call ends the sweep on a
 * deliberate, neutral row and blocks until the observer has caught up, so the
 * human step and the fire both start from a settled state.
 */
async function WRITE_settleOn(trackIndex: number, why: string): Promise<void> {
  await request('WRITE', 'cursor.pinTrack', { cursor: 0, pinned: false });
  await request('WRITE', 'cursor.pointTrack', { cursor: '0', trackIndex });
  const settled = await pollUntil(async () =>
    (await READ_selection()).mixerTrackIndex === trackIndex, 4000, 100);
  check(`setup: the selection observer drained onto row ${trackIndex} after ${why}`,
    settled.ok, { trackIndex, ms: settled.ms });
  if (!settled.ok) throw new Error(`the selection observer never settled on row ${trackIndex}`);
}

/** Mint one disposable top-level instrument and prove the delta was exactly it. */
async function WRITE_mintTrack(name: string): Promise<string> {
  const before = await READ_list();
  if (before.tracks.some((track) => track.name === name)) {
    throw new Error(`REFUSING: a track named ${name} already exists; clean it up first`);
  }
  await request('WRITE', 'track.create', { position: before.count });
  const minted = await pollUntil(async () => {
    const current = await READ_list();
    return current.tracks.some((track) => !ids(before.tracks).has(track.channelId));
  }, 6000, 100);
  if (!minted.ok) throw new Error(`the disposable track ${name} did not become visible`);
  const after = await READ_list();
  const fresh = after.tracks.filter((track) => !ids(before.tracks).has(track.channelId));
  const first = fresh[0];
  if (fresh.length !== 1 || first === undefined || first.type !== 'Instrument') {
    throw new Error(`mint was not an exact one-instrument delta: ${JSON.stringify(fresh)}`);
  }
  await request('WRITE', 'track.setName', { trackIndex: first.index, name });
  const renamed = await pollUntil(async () => {
    const at = await READ_resolve(first.channelId);
    return at.found && at.name === name && at.type === 'Instrument';
  }, 4000, 100);
  if (!renamed.ok) throw new Error(`rename of ${name} did not verify by durable id`);
  note(`fixture ${name} = ${first.channelId}`);
  return first.channelId;
}

async function WRITE_insertDevice(channelId: string, uuid: string, expectName: RegExp): Promise<void> {
  const at = await READ_resolve(channelId);
  if (!at.found || at.index === undefined) throw new Error('fixture vanished before device insert');
  await request('WRITE', 'cursor.pinTrack', { cursor: 0, pinned: false });
  await request('WRITE', 'cursor.pointTrack', { cursor: '0', trackIndex: at.index });
  await request('WRITE', 'device.insertBitwig', { cursor: '0', uuid });
  const landed = await pollUntil(async () => {
    const listed = (await request('READ', 'device.list', { cursor: 0 })) as {
      devices: { name: string }[];
    };
    return listed.devices.some((device) => expectName.test(device.name));
  }, 8000, 150);
  if (!landed.ok) throw new Error(`device ${uuid} did not appear on ${channelId}`);
}

async function WRITE_makeClip(channelId: string, slotIndex: number): Promise<void> {
  const at = await READ_resolve(channelId);
  if (!at.found || at.index === undefined) throw new Error('fixture vanished before clip create');
  await request('WRITE', 'clip.create', { trackIndex: at.index, slotIndex, lengthBeats: 4 });
  const landed = await pollUntil(async () => {
    const current = await READ_resolve(channelId);
    if (!current.found || current.index === undefined) return false;
    const slot = (await request('READ', 'slot.status', {
      trackIndex: current.index, slotIndex,
    })) as { hasContent: boolean };
    return slot.hasContent;
  }, 6000, 150);
  if (!landed.ok) throw new Error(`witness clip did not appear on ${channelId} row ${slotIndex}`);
}

// --------------------------------------------------------------- cleanup

async function restoreOriginalGroupStates(): Promise<void> {
  for (const original of originalGroups) {
    const at = await READ_resolve(original.channelId);
    if (!at.found || at.index === undefined) {
      check(`cleanup: pre-existing group ${original.name} still resolves`, false, original);
      continue;
    }
    const now = (await request('READ', 'branch.mixer', { trackIndex: at.index })) as {
      isGroupExpanded: boolean;
    };
    if (now.isGroupExpanded !== original.expanded) {
      check(
        `cleanup: restore ${original.name} expanded=${original.expanded}`,
        await WRITE_setGroupExpanded(original.channelId, original.expanded),
      );
    }
  }
}

async function cleanup(): Promise<void> {
  console.log('\n-- cleanup');
  const transport = (await request('READ', 'transport.status')) as { isPlaying: boolean };
  if (transport.isPlaying) await request('WRITE', 'transport.stop');

  if (cleanupRefused) {
    check('cleanup: REFUSED — the arm touched something it does not own', true, { refusalReason });
  }

  if (!cleanupRefused && createdGroupId !== undefined && collapseProved) {
    check('cleanup: the collapse-proved probe group was removed by durable id',
      await WRITE_delete(createdGroupId), { createdGroupId });
  } else if (!cleanupRefused && createdGroupId !== undefined) {
    cleanupRefused = true;
    refusalReason ||= 'a new group appeared but the collapse oracle did not prove its child';
    check('cleanup: refused to delete an unproved group (group deletion cascades)', true,
      { createdGroupId });
  }

  if (!cleanupRefused) {
    for (const [what, channelId] of [['target', targetId], ['sacrificial', sacrificialId]] as const) {
      if (channelId === undefined) continue;
      if (!(await READ_resolve(channelId)).found) continue;
      check(`cleanup: the disposable ${what} was removed by durable id`,
        await WRITE_delete(channelId), { channelId });
    }
  }

  await restoreOriginalGroupStates();
  if (baseline !== undefined) {
    const final = await READ_list();
    const expected = ids(baseline.tracks);
    const actual = ids(final.tracks);
    const added = final.tracks.filter((track) => !expected.has(track.channelId));
    const missing = baseline.tracks.filter((track) => !actual.has(track.channelId));
    check('cleanup: visible project identities returned exactly to baseline',
      !cleanupRefused && added.length === 0 && missing.length === 0,
      { added, missing, final: layout(final.tracks) });
    const finalScenes = await READ_sceneCount();
    check('cleanup: scene count is unchanged', finalScenes === baseline.sceneCount,
      { before: baseline.sceneCount, after: finalScenes });
  }
}

// ------------------------------------------------------------------- arm

let outcome: 'WRAP' | 'MISS' | 'MISDISPATCH' | 'ABORTED' = 'ABORTED';

await client.connect();
console.log(`connected — E22 row ${MODE.toUpperCase()} (label: ${LABEL})`);
console.log(`question: ${ROW.question}`);
console.log(`expectation: ${ROW.expect}   deep diff: ${DEEP}   interactive: ${INTERACTIVE}`);
console.log(`transcript: ${logPath}\n`);

/**
 * Recover from a cleanup this harness deliberately refused.
 *
 * A refused cleanup is the correct outcome when the arm cannot account for what
 * moved, and it leaves a probe-made group standing on purpose. Removing it is
 * still a cascading delete, so the caller must name BOTH durable ids and the
 * oracle must re-prove, live and now, that the group holds exactly that one
 * child. A group that has acquired anything else is left alone for a human.
 */
if (MODE === 'rescue') {
  const groupId = flag('group');
  const childId = flag('child');
  try {
    if (groupId === undefined || childId === undefined) {
      throw new Error('usage: npm run probe:e22 -- rescue --group=<channelId> --child=<channelId>');
    }
    const transport = (await request('READ', 'transport.status')) as { isPlaying: boolean };
    if (transport.isPlaying) throw new Error('REFUSING: transport is rolling');

    const at = await READ_resolve(groupId);
    check('rescue: the named id still resolves and is a Group', at.found && at.type === 'Group',
      { groupId, at });
    if (!at.found || at.type !== 'Group') throw new Error('the group id does not resolve to a Group');

    await WRITE_setGroupExpanded(groupId, true);
    const open = await READ_list();
    const openIds = ids(open.tracks);
    check('rescue: the named child is visible under the expanded group', openIds.has(childId),
      { childId, open: layout(open.tracks) });
    if (!openIds.has(childId)) throw new Error('the named child is not visible; refusing to delete');

    const collapsed = await WRITE_setGroupExpanded(groupId, false);
    const folded = await READ_list();
    const foldedIds = ids(folded.tracks);
    const hidden = [...openIds].filter((id) => id !== groupId && !foldedIds.has(id));
    const proved = collapsed && hidden.length === 1 && hidden[0] === childId;
    check('rescue: the collapse oracle proves the group holds exactly the named child', proved,
      { hidden, childId, folded: layout(folded.tracks) });
    if (!proved) throw new Error('the group does not hold exactly the named child; refusing to delete');
    await WRITE_setGroupExpanded(groupId, true);

    const before = await READ_list();
    const removed = await WRITE_delete(groupId);
    const after = await READ_list();
    const afterIds = ids(after.tracks);
    check('rescue: the group and its named child are both gone',
      removed && !afterIds.has(groupId) && !afterIds.has(childId), { groupId, childId });
    const collateral = before.tracks.filter((track) =>
      track.channelId !== groupId && track.channelId !== childId && !afterIds.has(track.channelId));
    check('rescue: the cascade took nothing else with it', collateral.length === 0, { collateral });
    note(`layout after rescue: ${layout(after.tracks)}`);
    note(`scenes: ${await READ_sceneCount()}`);
  } catch (error) {
    check('rescue completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  } finally {
    client.disconnect();
  }
  note(`E22 rescue: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
  note(`transcript written to ${logPath}`);
  process.exit(failureCount() === 0 ? 0 : 1);
}

try {
  console.log('-- preflight and untouched baseline');
  const transport = (await request('READ', 'transport.status')) as { isPlaying: boolean };
  if (transport.isPlaying) throw new Error('REFUSING: transport is rolling');

  const listing = await READ_list();
  if (listing.itemCount !== listing.count) {
    throw new Error(`REFUSING: partial track window (${listing.count}/${listing.itemCount})`);
  }
  const needed = 2 + (ROW.fixtures.sacrificial === true ? 1 : 0);
  if (listing.bankSize - listing.count < needed) {
    throw new Error(`REFUSING: this row needs ${needed} free bank slots; `
      + `only ${listing.bankSize - listing.count} remain`);
  }
  for (const name of [TARGET_NAME, SACRIFICIAL_NAME]) {
    const clashes = listing.tracks.filter((track) => track.name === name);
    if (clashes.length > 0) {
      throw new Error(`REFUSING: a track named ${name} is already in the project `
        + `(${JSON.stringify(clashes)}); a previous arm did not clean up`);
    }
  }

  originalGroups = await Promise.all(
    listing.tracks.filter((track) => track.type === 'Group').map(READ_groupState),
  );
  const initialSelection = await READ_selection();
  const initialLayout = await request('READ', 'ui.panelLayout');
  baseline = await READ_snapshot('baseline', DEEP);
  note(`baseline tracks: ${layout(baseline.tracks)}`);
  note(`baseline scenes=${baseline.sceneCount} selection=${JSON.stringify(initialSelection)}`);
  note(`baseline layout=${JSON.stringify(initialLayout)} groups=${JSON.stringify(originalGroups)}`);

  console.log('\n-- setup: disposable fixtures owned wholly by this arm');
  const target0 = await WRITE_mintTrack(TARGET_NAME);
  targetId = target0;
  if (ROW.fixtures.sacrificial === true) sacrificialId = await WRITE_mintTrack(SACRIFICIAL_NAME);
  /** Whichever fixture row the destructor click is aimed at. */
  const clickRow = ROW.destructor === 'clip-on-sacrificial' ? sacrificialId : target0;
  if (clickRow === undefined) throw new Error('the row needing a sacrificial fixture did not mint one');
  if (ROW.fixtures.device === true) {
    await WRITE_insertDevice(target0, POLYSYNTH, /Poly/i);
  }
  if (ROW.fixtures.container === true) {
    await WRITE_insertDevice(target0, FX_LAYER, /FX Layer/i);
    await WRITE_insertDevice(target0, POLYSYNTH, /Poly/i);
  }
  if (ROW.fixtures.clip === true) {
    // A witness clip the destructor click is NOT aimed at, so a redirect that
    // deletes or duplicates clip content has something probe-owned to land on.
    await WRITE_makeClip(clickRow, 1);
  }

  const probeOwned = new Set([target0, ...(sacrificialId === undefined ? [] : [sacrificialId])]);
  // ⚠ The pre-fire deep snapshot is taken HERE — before any human step — because
  // it moves the track cursor once per track and must never run between the
  // prime click and the fire (E17 method guard 5).
  const beforeArm = await READ_snapshot('after-fixtures', DEEP);

  if (DEEP) {
    // End the sweep somewhere deliberate and neutral: a pre-existing plain
    // instrument, never Master, never a group, never a fixture of this arm. The
    // prime click then has a real selection change to witness.
    const park = beforeArm.tracks.find((track) =>
      track.type === 'Instrument' && !probeOwned.has(track.channelId));
    if (park === undefined) throw new Error('no neutral pre-existing instrument row to park on');
    await WRITE_settleOn(park.index, 'the pre-arm device/chain sweep');
    note(`parked on ${park.name} (row ${park.index}) before any human step`);
  }

  if (ROW.prime) {
    await humanStep([
      `PRIME: click the TRACK HEADER named "${TARGET_NAME}" in Bitwig.`,
      '',
      'Click the header itself in the arranger or mixer — not a clip slot, not a',
      'device. Then come back here. Leave Bitwig frontmost afterwards.',
    ], 'what exactly did you click? (free text, recorded verbatim)');
    const afterPrime = await READ_selection();
    const targetAt = await READ_resolve(target0);
    check('witness: the prime click moved the selected mixer row onto the target',
      afterPrime.mixerTrackIndex === targetAt.index,
      { afterPrime, targetIndex: targetAt.index });
  }

  if (ROW.focusAction === true) {
    await request('WRITE', 'app.invokeAction', { id: 'focus_track_header_area' });
    await wait(500);
  }

  const beforeDestructor = ROW.destructor === undefined ? undefined : await READ_selection();
  if (ROW.destructor !== undefined) {
    const at = await READ_resolve(clickRow);
    const rowName = ROW.destructor === 'clip-on-sacrificial' ? SACRIFICIAL_NAME : TARGET_NAME;
    const instructions: Record<Destructor, string[]> = {
      'clip-on-target': [
        `DESTRUCTOR: click the EMPTY launcher slot in row 1 of "${rowName}".`,
        '',
        'That is the first (topmost) clip slot on the target track — it is empty.',
        'There is a witness clip in row 2; do not touch it. Click nothing else.',
      ],
      'clip-on-sacrificial': [
        `DESTRUCTOR: click the EMPTY launcher slot in row 1 of "${rowName}".`,
        '',
        `This is the separate sacrificial track, NOT "${TARGET_NAME}".`,
        'There is a witness clip in row 2; do not touch it. Click nothing else.',
      ],
      'device-header': [
        `DESTRUCTOR: click the Polysynth DEVICE HEADER in the device panel of "${rowName}".`,
        '',
        'The device panel should already be showing this track after the prime',
        'click. Click the device\'s title bar so the device becomes selected.',
        'Do not click any track header, and do not open a different track.',
      ],
      'chain-lane': [
        `DESTRUCTOR: click the CHAIN LANE inside the FX Layer on "${rowName}".`,
        '',
        'The FX Layer container is the first device on this track. Click inside',
        'its chain lane so the chain — not the container device — is selected.',
        'If the container is collapsed, say so in your answer below.',
      ],
      'project-tab': [
        'DESTRUCTOR: switch to another ALREADY-OPEN, safe project tab and back.',
        '',
        '⚠ Only do this if you already have a disposable second project open. Do',
        'not create, save, or close anything. Return to gn-scale-test afterwards',
        'and click NOTHING else in it.',
      ],
    };
    const answer = await humanStep(instructions[ROW.destructor],
      'what exactly did you click, and what did you see change?');
    const afterDestructor = await READ_selection();
    const witnessed = ROW.destructor === 'clip-on-target' || ROW.destructor === 'clip-on-sacrificial'
      ? afterDestructor.changes > (beforeDestructor?.changes ?? 0)
        && afterDestructor.trackIndex === at.index
        && afterDestructor.slotIndex === 0
      : undefined;
    if (witnessed === undefined) {
      note(`destructor has no controller-side observer; operator report is the witness: ${answer}`);
      note(`selection observers before/after: ${JSON.stringify(beforeDestructor)} → `
        + `${JSON.stringify(afterDestructor)}`);
    } else {
      check('witness: the launcher click landed on the intended empty slot', witnessed,
        { before: beforeDestructor, after: afterDestructor, expectedTrackIndex: at.index });
    }
  }

  console.log('\n-- measured sequence');
  const target = await READ_resolve(target0);
  if (!target.found || target.index === undefined) throw new Error('target disappeared before selection');
  const beforeGroup = await READ_list();
  const beforeGroupIds = ids(beforeGroup.tracks);

  // E16j/E16k recipe. These are WRITES: pointTrack calls selectChannel().
  await request('WRITE', 'cursor.pinTrack', { cursor: 0, pinned: false });
  await request('WRITE', 'cursor.pointTrack', { cursor: '0', trackIndex: target.index });

  // Selection-safe final external readback. branch.groupTrack repeats stronger
  // durable-id + cursor-id + selected-mixer-row checks in the same callback that
  // invokes Group. Nothing else is called between this read and that callback.
  // ⚠ A bounded poll, not a weakened check. The threshold is unchanged — the
  // observer must name this exact bank row — but a single shot also fails when
  // an EARLIER selection is still in flight, which is a stale reading rather
  // than a wrong selection. On an already-settled arm this makes exactly one
  // read and the fired sequence is byte-for-byte the cold/prime/warm one it has
  // to stay comparable with. The last call before the fire is still a single
  // cursor-free selection readback (E17 method guard 5).
  let selected = await READ_selection();
  let settleReads = 1;
  const settleStarted = Date.now();
  while (selected.mixerTrackIndex !== target.index && Date.now() - settleStarted < 4000) {
    await wait(100);
    selected = await READ_selection();
    settleReads++;
  }
  check('precondition: selected mixer row is the disposable target',
    selected.mixerTrackIndex === target.index,
    { selected, target, settleReads, settleMs: Date.now() - settleStarted });
  if (selected.mixerTrackIndex !== target.index) throw new Error('selection did not settle on target');

  // The only call from here to Group is the guarded top-level handler. It READS the
  // bank id, cursor id and selected-row observer, then WRITES Action.invoke().
  const groupResult = (await request('WRITE', 'branch.groupTrack', {
    trackIndex: target.index,
    expectedChannelId: target0,
    cursor: '0',
  })) as {
    applied?: boolean;
    rejected?: boolean;
    selectionVerified?: boolean;
    channelId?: string;
    action?: string;
  };
  note(`guarded Group result (not the success oracle): ${JSON.stringify(groupResult)}`);
  check('precondition: handler verified bank, cursor and mixer selection by durable target',
    groupResult.selectionVerified === true && groupResult.channelId === target0,
    groupResult);

  const appeared = await pollUntil(async () => {
    const current = await READ_list();
    return current.tracks.some((track) => !beforeGroupIds.has(track.channelId));
  }, 5000, 100);
  const afterGroup = await READ_list();
  const delta = afterGroup.tracks.filter((track) => !beforeGroupIds.has(track.channelId));
  const newGroups = delta.filter((track) => track.type === 'Group');
  note(`track-level diff after ${appeared.ms}ms: ${JSON.stringify(delta)}`);

  console.log('\n-- structural diff at every readable level');
  const afterArm = await READ_snapshot('after-fire', DEEP);
  const armDiff = diffSnapshots(beforeArm, afterArm, probeOwned);
  const created = newGroups[0];
  if (created !== undefined) createdGroupId = created.channelId;

  check('safety: the action touched no identity this arm did not create',
    armDiff.violations.length === 0, { violations: armDiff.violations });
  if (armDiff.violations.length > 0) {
    cleanupRefused = true;
    refusalReason = `pre-existing state changed: ${armDiff.violations.join('; ')}`;
  }
  if (armDiff.redirects.length > 0) {
    note(`probe-owned structural changes beyond the track level: ${JSON.stringify(armDiff.redirects)}`);
  }

  if (newGroups.length === 1 && created !== undefined) {
    // Ensure the handler's bounded expansion has made the target visible before
    // measuring what folding removes.
    await pollUntil(async () => (await READ_resolve(target0)).found, 4000, 100);
    const open = await READ_list();
    const openIds = ids(open.tracks);
    check('group and target are both visible before collapse oracle',
      openIds.has(created.channelId) && openIds.has(target0), { open: layout(open.tracks) });

    const collapsed = await WRITE_setGroupExpanded(created.channelId, false);
    const folded = await READ_list();
    const foldedIds = ids(folded.tracks);
    const hidden = [...openIds].filter((channelId) =>
      channelId !== created.channelId && !foldedIds.has(channelId));
    collapseProved = collapsed && hidden.length === 1 && hidden[0] === target0;
    check('collapse oracle: the new group wraps exactly the disposable target',
      collapseProved, { hidden, target0, folded: layout(folded.tracks) });

    if (collapseProved) {
      check('collapse oracle: re-expanding restores the same durable target id',
        await WRITE_setGroupExpanded(created.channelId, true)
          && (await READ_resolve(target0)).found,
        { target0 });
    }
    outcome = collapseProved && armDiff.violations.length === 0 && armDiff.redirects.length === 0
      ? 'WRAP'
      : 'MISDISPATCH';
  } else if (delta.length === 0 && armDiff.redirects.length === 0 && armDiff.violations.length === 0) {
    outcome = 'MISS';
  } else {
    outcome = 'MISDISPATCH';
    cleanupRefused ||= newGroups.length > 1;
    if (newGroups.length > 1) refusalReason ||= 'more than one new group appeared';
  }

  // A miss and a wrap are both legitimate results; only a row whose expectation
  // the matrix has already fixed is scored here. `unknown` rows ARE the question.
  if (ROW.expect !== 'unknown') {
    check(`row expectation: ${MODE} should ${ROW.expect}`,
      (ROW.expect === 'wrap' && outcome === 'WRAP') || (ROW.expect === 'miss' && outcome === 'MISS'),
      { outcome, appearedMs: appeared.ms, delta });
  }
  note(`ROW OUTCOME ${MODE.toUpperCase()} (${LABEL}): ${outcome} after ${appeared.ms}ms`);
} catch (error) {
  outcome = 'ABORTED';
  check('E22 row completed without an unexpected failure', false, {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
} finally {
  try {
    await cleanup();
  } catch (error) {
    check('cleanup completed without an unexpected failure', false, {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
  // On screen: the judged sequence, with sweeps collapsed to their call ranges.
  // In the file: every call, in order, unabridged.
  const collapsed = new Map(blocks.map((block) => [block.fromN, block]));
  const inside = (n: number) => blocks.some((block) => n > block.fromN && n <= block.toN);
  console.log('\n-- ordered RPC sequence (sweeps collapsed; full list in the transcript)');
  for (const call of calls) {
    const block = collapsed.get(call.n);
    if (block !== undefined) {
      console.log(`${String(block.fromN).padStart(3, '0')}-${String(block.toN).padStart(3, '0')} `
        + `+${String(call.atMs).padStart(6)}ms ${block.kind.padEnd(5)} ${block.label} `
        + `— ${block.toN - block.fromN + 1} calls ${block.ms}ms`);
      continue;
    }
    if (inside(call.n)) continue;
    console.log(`${String(call.n).padStart(3, '0')} +${String(call.atMs).padStart(6)}ms `
      + `${call.kind.padEnd(5)} ${call.method} ${call.ms}ms`);
  }
  try {
    appendFileSync(logPath, ['', '-- full ordered RPC sequence', ...calls.map((call) =>
      `${String(call.n).padStart(3, '0')} +${String(call.atMs).padStart(6)}ms `
      + `${call.kind.padEnd(5)} ${call.method} ${call.ms}ms`), ''].join('\n'));
  } catch {
    console.log('   (the full RPC list could not be written to the transcript)');
  }
  if (timeline.length > 0) {
    console.log('\n-- human steps, verbatim');
    for (const entry of timeline) console.log(`   ${entry}`);
  }
  client.disconnect();
}

console.log(`\nRESULT  row=${MODE} label=${LABEL} outcome=${outcome} `
  + `expected=${ROW.expect} failures=${failureCount()}`);
note(`E22 row ${MODE.toUpperCase()}: ${failureCount() === 0 ? 'PASS' : 'FAILED'}`);
note(`transcript written to ${logPath}`);
process.exit(failureCount() === 0 ? 0 : 1);
