/**
 * The fake harness — the offline half of the conformance suite.
 *
 * Nothing here reaches for `TrapControl` on behalf of a conformance case; the
 * two hooks it does expose (`forceOverflow`, `hideTrack`) exist because the
 * suite's assertions are portable but the way you CREATE an overflowing project
 * is not. On a real DAW that hook would raise a different condition, or the
 * capability would simply be false.
 */
import { FakeAdapter } from '../../adapters/fake/adapter.js';
import { control } from '../../adapters/fake/control.js';
import { track, type BitwigAdapter, type TrackAddress } from '../index.js';
import type { AdapterHarness } from './suite.js';

export function fakeHarness(): AdapterHarness {
  return {
    name: 'fake',
    capabilities: {
      hasRealBitwig: false,
      hasDeterministicClock: true,
      canOverflowBank: true,
      canInjectInterference: true,
      hasDeviceModel: true,
    },

    async create() {
      const adapter = new FakeAdapter({ tracks: ['gn-A', 'gn-B'], scenes: 8 });
      const [a, b] = adapter.model.visibleTracks();
      return {
        adapter,
        trackA: track(a!.channelId) as TrackAddress,
        trackB: track(b!.channelId) as TrackAddress,
      };
    },

    async dispose(adapter: BitwigAdapter) {
      await adapter.close();
    },

    forceOverflow(adapter: BitwigAdapter) {
      const c = control(adapter as FakeAdapter);
      c.setBankWindow(2);
      c.addTracksBeyondWindow(4);
    },

    hideTrack(adapter: BitwigAdapter, _track: TrackAddress) {
      // trackB is the second visible track, so a one-track window hides it while
      // leaving trackA reachable.
      control(adapter as FakeAdapter).setBankWindow(1);
    },

    async bumpRevision(adapter: BitwigAdapter) {
      // A competing writer — the user nudging a clip by hand mid-batch. Live
      // does the same thing through `revision.bump`, which is the very counter
      // E8 measured; the assertion that uses this is identical for both.
      control(adapter as FakeAdapter).bumpRevision();
    },
  };
}
