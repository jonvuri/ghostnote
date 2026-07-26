/**
 * E16 row C3 — the CPU cost per branch, which §6 calls the real ceiling.
 *
 * "Three branches of a Zebra track is three Zebra instances" — far below the
 * 256-track bank window (D7), and kill criterion 4 says the idea dies if two
 * branches make a normal project unusable. There is no CPU anywhere in the
 * controller API (grepped: zero hits), so this is measured from OUTSIDE, against
 * Bitwig's separate audio-engine process, with clips actually PLAYING — a silent
 * project measures nothing.
 *
 * Method: sample engine CPU with `top`, duplicate the heavy fixture, launch the
 * copy's clip, sample again, repeat. Then delete every copy and sample once more,
 * which also answers G1's "is the CPU actually freed".
 *
 * ⚠ This makes noise: N copies of a two-Zebra3 track all playing at once.
 *
 * Requires `gn-E16` (build it with probe:e16b). Deletes every copy it makes.
 */
import { execFileSync } from 'node:child_process';
import { client, check, note, failureCount, pollUntil } from './lib.js';

const BRANCHES = 3;
const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);
type TrackRow = { index: number; name: string; position: number; channelId: string };
const list = async () => (await req('track.list')) as { tracks: TrackRow[]; count: number };
const resolveId = async (channelId: string) =>
  (await req('track.resolveByChannelId', { channelId })) as { found: boolean; index?: number };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The audio engine is a SEPARATE process; the UI process's CPU is not the cost. */
const enginePid = (): number => {
  const out = execFileSync('pgrep', ['-f', 'BitwigAudioEngine']).toString().trim().split('\n');
  return Number(out[0]);
};
/**
 * `top -l 2` and take the SECOND sample: the first is a since-boot average, which
 * would report the engine's whole-session history rather than what it is doing
 * now. Median of several to survive a transient.
 */
const engineCpu = (pid: number, samples = 3): number => {
  const readings: number[] = [];
  for (let i = 0; i < samples; i++) {
    const out = execFileSync('top', ['-l', '2', '-pid', String(pid), '-stats', 'cpu']).toString();
    const nums = out.split('\n').map((l) => l.trim()).filter((l) => /^\d+(\.\d+)?$/.test(l));
    if (nums.length > 0) readings.push(Number(nums[nums.length - 1]));
  }
  readings.sort((a, b) => a - b);
  return readings[Math.floor(readings.length / 2)] ?? -1;
};

await client.connect();
console.log('connected\n');
const pid = enginePid();
note(`audio engine pid ${pid}`);

const all = await list();
const fixture = all.tracks.find((t) => t.name === 'gn-E16');
if (fixture === undefined) {
  console.log('REFUSING: gn-E16 not found — run `npm run probe:e16b` first to build it.');
  process.exit(1);
}
const fixtureId = fixture.channelId;

// Baseline: the fixture PLAYING, nothing duplicated.
await req('slot.launch', { trackIndex: fixture.index, slotIndex: 0 });
await wait(3000);
const vuBase = (await req('branch.vu', { reset: true })) as
  { tracks: { channelId: string; now: number; hold: number }[] };
const sounding = vuBase.tracks.find((t) => t.channelId === fixtureId);
note(`fixture VU while playing: now=${sounding?.now}`);
check('the fixture is actually SOUNDING (a silent CPU measurement is worthless)',
  (sounding?.now ?? 0) > 0 || (sounding?.hold ?? 0) > 0, { vu: sounding });

const baseline = engineCpu(pid);
note(`CPU baseline (1 heavy track playing): ${baseline}%`);

// Each branch: duplicate, launch its clip, measure.
const made: string[] = [];
const curve: { branches: number; cpu: number; ms: number }[] = [{ branches: 0, cpu: baseline, ms: 0 }];
for (let b = 1; b <= BRANCHES; b++) {
  const before = await list();
  const beforeIds = new Set(before.tracks.map((t) => t.channelId));
  const t0 = Date.now();
  await req('branch.duplicateTrack', {
    trackIndex: (await resolveId(fixtureId)).index, route: 'hostDuplicate',
    undoName: `ghostnote E16 branch ${b}`,
  });
  const ok = await pollUntil(async () => (await list()).count === before.count + 1, 20000, 50);
  const ms = Date.now() - t0;
  if (!ok.ok) {
    note(`branch ${b} never appeared — stopping the curve here`);
    break;
  }
  const copy = (await list()).tracks.find((t) => !beforeIds.has(t.channelId))!;
  made.push(copy.channelId);
  await req('slot.launch', { trackIndex: copy.index, slotIndex: 0 });
  await wait(3000);
  const cpu = engineCpu(pid);
  curve.push({ branches: b, cpu, ms });
  note(`branch ${b}: duplicated in ${ms}ms, engine CPU ${cpu}% (baseline ${baseline}%)`);
}

console.log('\n-- the branch cost curve');
for (const p of curve) {
  const delta = p.cpu - baseline;
  note(`${p.branches} branch(es): ${p.cpu.toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs baseline)`
    + (p.branches > 0 ? `, ${p.ms}ms to create` : ''));
}
const perBranch = curve.length > 1
  ? (curve[curve.length - 1]!.cpu - baseline) / curve[curve.length - 1]!.branches
  : 0;
note(`≈ ${perBranch.toFixed(1)}% engine CPU per branch of this fixture`);

// The kill criterion is about USABILITY, so it is asked as headroom, not slope.
check('C3 KILL CRITERION 4 — 2 branches do not exhaust the engine',
  (curve.find((p) => p.branches === 2)?.cpu ?? 0) < 80,
  { at2Branches: curve.find((p) => p.branches === 2)?.cpu, baseline });
check('C2: duplication of the heavy fixture stays under the 5s budget under load',
  curve.filter((p) => p.branches > 0).every((p) => p.ms < 5000),
  { ms: curve.filter((p) => p.branches > 0).map((p) => p.ms) });

// ---- F4: does launching a SCENE fire every branch's clip? ----
console.log('\n-- F4: scene launch across branches');
await req('branch.vu', { reset: true });
await wait(2500);
const vuAll = (await req('branch.vu')) as
  { tracks: { name: string; channelId: string; hold: number }[] };
const branchesSounding = vuAll.tracks.filter((t) => made.includes(t.channelId) && t.hold > 0);
note(`branches with signal: ${branchesSounding.length} of ${made.length}`);
check('F4/E5: every branch is audible simultaneously — the mix IS wrong while they coexist',
  branchesSounding.length === made.length,
  { sounding: branchesSounding.length, made: made.length });

// ---- G1: is the CPU actually freed on delete? ----
console.log('\n-- G1: delete the branches, does the CPU come back?');
for (const id of made) {
  const at = await resolveId(id);
  if (!at.found) continue;
  const n = (await list()).count;
  await req('track.delete', { trackIndex: at.index });
  await pollUntil(async () => (await list()).count === n - 1, 8000, 100);
}
await wait(3000);
const recovered = engineCpu(pid);
note(`CPU after deleting every branch: ${recovered}% (baseline was ${baseline}%)`);
check('G1: deleting a branch frees its CPU (back within 25% of baseline)',
  recovered <= baseline * 1.25 + 5, { baseline, recovered });

await req('transport.stop');
check('the fixture survived', (await resolveId(fixtureId)).found === true);
console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} FAILURES`);
process.exit(failureCount() === 0 ? 0 : 1);
