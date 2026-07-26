/**
 * The conformance suite, run against REAL Bitwig.
 *
 *   npm run probe:conformance
 *
 * Requires Bitwig running with the ghostnote extension loaded. This is the live
 * half of the answer to PHASE-0's named risk — "the fake diverges from live
 * Bitwig and starts certifying wrong behaviour". The cases are literally the same
 * ones `npm test` runs offline; if the fake has drifted, one of them fails here
 * and nowhere else.
 *
 * ⚠ The filename ends `.live.ts`, NOT `.test.ts`, on purpose: `npm test` globs
 * `src/**\/*.test.ts`, so this can never be picked up by the offline suite and try
 * to open a socket in CI.
 *
 * ⚠ It creates fixture tracks (`gn-conf-A` / `gn-conf-B`) and clips in the open
 * project. Run it against a scratch project.
 */
import { after } from 'node:test';

import { LiveAdapter } from '../adapters/live/adapter.js';
import { runConformance, type AdapterHarness } from '../contract/conformance/suite.js';
import { track, type BitwigAdapter, type TrackAddress } from '../contract/index.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { BridgeClient } from '../client.js';

const FIXTURE_A = 'gn-conf-A';
const FIXTURE_B = 'gn-conf-B';

/** Names the suite itself generates — safe to delete, never something a human typed. */
const MINTED = /^(gn-renamed|gn-done|gn-conf|Inst \d+)$/;

type FixtureRow = { index: number; name: string; type: string; channelId: string };

/** Resolved once per process and reused; see `create()`. */
let fixtures: [TrackAddress, TrackAddress] | undefined;

/**
 * Find or create the two fixture tracks.
 *
 * E2c's lessons are why this is not a one-liner: `createInstrumentTrack` does not
 * honour the requested position, default names auto-renumber, and the flat bank
 * carries FX and Master rows at the tail. So: match by name AND type, create when
 * absent, then locate the new row empirically.
 */
async function ensureFixtures(client: BridgeClient): Promise<[TrackAddress, TrackAddress]> {
  const list = async () =>
    (await client.request('track.list')) as {
      tracks: { index: number; name: string; type: string; channelId: string }[];
    };

  const found = (rows: Awaited<ReturnType<typeof list>>['tracks'], name: string) =>
    rows.find((t) => t.name === name && t.type === 'Instrument');

  for (const name of [FIXTURE_A, FIXTURE_B]) {
    if (found((await list()).tracks, name)) continue;
    const before = (await list()).tracks.length;
    await client.request('track.create', { position: before });
    for (let i = 0; i < 40 && (await list()).tracks.length === before; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const rows = (await list()).tracks.filter((t) => t.type === 'Instrument');
    const target = rows[rows.length - 1];
    if (!target) throw new Error(`created track for ${name} not found among Instrument rows`);
    await client.request('track.setName', { trackIndex: target.index, name });
    await new Promise((r) => setTimeout(r, 200));
  }

  const rows = (await list()).tracks;
  const a = found(rows, FIXTURE_A);
  const b = found(rows, FIXTURE_B);
  if (!a || !b) throw new Error('fixture tracks did not materialise');
  return [track(a.channelId), track(b.channelId)];
}

const client = new BridgeClient();

const liveHarness: AdapterHarness = {
  name: 'live',
  capabilities: {
    hasRealBitwig: true,
    // Real time: tick counts are not assertable and every settle costs wall-clock.
    hasDeterministicClock: false,
    // Manufacturing an overflowing project inside a real session is not something
    // a test run may do. The live evidence is banked in probe e05b.
    canOverflowBank: false,
    // ● `revision.bump` is the very counter E8 measured, and bumping it is
    // exactly what a human editing between our stash and our apply does to it —
    // without touching a single note in the user's project.
    canInjectInterference: true,
    hasDeviceModel: true,
  },

  async create() {
    // ⚠ Resolve the fixtures ONCE and cache them by channelId. Looking them up
    // by name on every case is what made an early version of this harness litter
    // the project: C-stage renames trackA, so the next name lookup missed and
    // created another track — 11 of them in one run, until the project exceeded
    // the bank window and rule 5 (correctly) refused to work at all.
    if (fixtures === undefined) fixtures = await ensureFixtures(client);
    const [trackA, trackB] = fixtures;
    const adapter = new LiveAdapter({ transport: new BridgeTransport(client) });
    await adapter.hello();
    return { adapter, trackA, trackB };
  },

  async bumpRevision(_adapter: BitwigAdapter) {
    await client.request('revision.bump');
  },

  async dispose(_adapter: BitwigAdapter) {
    // Leave the project as we found it. Cases legitimately rename the fixtures
    // (C-stage) and mint new tracks (C-minted), so undoing that is part of the
    // run rather than an afterthought — see probe:conformance-cleanup for the
    // standalone version.
    if (fixtures === undefined) return;
    const rows = (await client.request('track.list')) as { tracks: FixtureRow[] };
    const keep = new Set(fixtures.map((f) => f.channelId));

    for (const [i, name] of [FIXTURE_A, FIXTURE_B].entries()) {
      const row = rows.tracks.find((t) => t.channelId === fixtures![i]!.channelId);
      if (row && row.name !== name) await client.request('track.setName', { trackIndex: row.index, name });
    }

    for (const row of rows.tracks) {
      if (row.type !== 'Instrument' || keep.has(row.channelId) || !MINTED.test(row.name)) continue;
      // Re-resolve before each delete: deleting re-indexes the bank (E3).
      const live = ((await client.request('track.list')) as { tracks: FixtureRow[] })
        .tracks.find((t) => t.channelId === row.channelId);
      if (live) await client.request('track.delete', { trackIndex: live.index });
    }
  },
};

runConformance(liveHarness);

// ⚠ The shared BridgeClient holds an open TCP socket, which keeps the event loop
// alive — so `beforeExit` never fires and the test runner hangs forever after the
// last assertion. node:test's `after` hook is the one that runs while the process
// is still willing to exit.
after(() => {
  client.disconnect();
});
