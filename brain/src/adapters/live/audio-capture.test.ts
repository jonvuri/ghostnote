import assert from 'node:assert/strict';
import test from 'node:test';

import { LiveAdapter, MasterRecorderActiveError } from './adapter.js';
import { RecordingTransport, type Transport } from './transport.js';
import { WIRE, type Frame } from './wiremap.js';

test('7e-adapter: typed MasterRecorder calls emit only the promoted wire routes', async () => {
  const ownerToken = 'capture-owner';
  const transport = new RecordingTransport().willReturn(
    { isActive: false, durationMs: 0, sampledAtMs: 100, leaseState: 'none' },
    { started: true, isActive: true, durationMs: 0, sampledAtMs: 110, leaseState: 'owned' },
    { stopped: true, isActive: false, durationMs: 4_500, sampledAtMs: 4_620, leaseState: 'none' },
  );
  const adapter = new LiveAdapter({ transport });
  assert.equal((await adapter.masterRecorderStatus(ownerToken)).isActive, false);
  assert.equal((await adapter.startMasterRecorder(ownerToken)).isActive, true);
  assert.equal((await adapter.stopMasterRecorder(ownerToken)).durationMs, 4_500);
  assert.deepEqual(transport.methods, [
    'masterRecorder.status', 'masterRecorder.start', 'masterRecorder.stop',
  ]);
  assert.deepEqual(transport.frames.map((frame) => frame.params), [
    { ownerToken }, { ownerToken }, { ownerToken },
  ]);
});

test('7e-adapter: the atomic start refusal is distinct from delayed activation', async () => {
  const transport = new RecordingTransport().willReturn({
    started: false,
    refusal: 'master-recorder-already-active',
    isActive: true,
    durationMs: 900,
    sampledAtMs: 100,
    leaseState: 'other',
  });
  const adapter = new LiveAdapter({ transport });
  await assert.rejects(
    adapter.startMasterRecorder('losing-owner'),
    (error) => error instanceof MasterRecorderActiveError && error.status.durationMs === 900,
  );
  assert.deepEqual(transport.methods, ['masterRecorder.start']);
});

test('7e-adapter: malformed recorder status fails closed', async () => {
  const transport = new RecordingTransport().willReturn({ isActive: 'yes', durationMs: 0 });
  const adapter = new LiveAdapter({ transport });
  await assert.rejects(adapter.masterRecorderStatus('capture-owner'), /invalid status/);
});

test('7e-adapter: a late successful transport read still exceeds its bound', async () => {
  const transport: Transport = {
    async send(frame) {
      if (frame.method === WIRE.transportStatus) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        return { isPlaying: false, sampledAtMs: 120 };
      }
      return {};
    },
    async close() {},
  };
  const adapter = new LiveAdapter({ transport });
  await assert.rejects(adapter.stopTransportForCapture(100, 10), /exceeded its 100 ms bound/);
});

class CaptureRangeTransport implements Transport {
  readonly frames: Frame[] = [];
  private playRead = 0;
  private lastPlayIndex = 0;

  constructor(
    private readonly wrongIdentity = false,
    private readonly audioClip = false,
  ) {}

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    switch (frame.method) {
      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };
      case WIRE.revisionGet:
        return {
          generation: 'generation-7e', project: 'project-7e', revision: 7,
          sceneEpoch: 4, sceneCount: 1, contentEpoch: 11, contentEvents: [],
        };
      case WIRE.trackList:
        return {
          tracks: [{ index: 0, name: 'source', channelId: 'track-7e', position: 0, type: 'Instrument' }],
          count: 1, itemCount: 1, bankSize: 64,
        };
      case WIRE.slotStatus:
        return { exists: true, hasContent: true, isSelected: true };
      case WIRE.cursorStatus:
        return {
          trackPosition: 0, cursorTrackPosition: 0, sceneIndex: 0,
          isPinned: true, cursorTrackPinned: true,
        };
      case WIRE.slotLaunchWithOptions:
        return { guardAccepted: true };
      case WIRE.cursorPlayState: {
        const steps = [0, 28, 1];
        const index = this.playRead++;
        this.lastPlayIndex = index;
        return {
          isPlaying: true,
          playingStep: this.audioClip ? -1 : steps[index] ?? 1,
          sampledAtMs: 1_000 + index * 2_200,
          exists: true, loopLength: 8, sceneIndex: 0,
          trackPosition: this.wrongIdentity && index === 1 ? 1 : 0,
        };
      }
      case WIRE.slotPlayState: {
        const positions = this.audioClip ? [40, 47.8, 48.05] : [40, 47, 48];
        return {
          hasContent: true, isPlaying: true, isPlaybackQueued: false, isStopQueued: false,
          playPosition: positions[this.lastPlayIndex] ?? 48.05,
          sampledAtMs: 1_000 + this.lastPlayIndex * 2_200,
        };
      }
      case WIRE.transportStatus:
        return { isPlaying: false, sampledAtMs: 5_500 };
      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

test('7e-adapter: loop observation stays tied to the guarded launcher clip', async () => {
  const clip = {
    kind: 'clip',
    slot: {
      kind: 'slot',
      track: { kind: 'track', channelId: 'track-7e' },
      scene: { kind: 'scene', index: 0, epoch: 4 },
    },
  } as const;
  const guard = {
    generation: 'generation-7e', project: 'project-7e', revision: 7,
    sceneEpoch: 4, contentEpoch: 11,
  };
  const range = { startBeats: 0, endBeats: 8, stepSizeBeats: 0.25 } as const;
  const accepted = new CaptureRangeTransport();
  const observation = await new LiveAdapter({ transport: accepted, sceneBankSize: 32 })
    .playLauncherCaptureRange(clip, guard, range, 2_000, 100, 10);
  assert.equal(observation.observationBasis, 'playing-step-v0');
  assert.equal(observation.observationBasis === 'playing-step-v0'
    ? observation.terminalStep : undefined, 28);
  const launch = accepted.frames.find((frame) => frame.method === WIRE.slotLaunchWithOptions);
  assert.equal(launch?.params?.expectedChannelId, 'track-7e');

  const moved = new CaptureRangeTransport(true);
  await assert.rejects(
    new LiveAdapter({ transport: moved, sceneBankSize: 32 })
      .playLauncherCaptureRange(clip, guard, range, 2_000, 100, 10),
    /invalid playback observation/,
  );
});

test('7f-adapter: an audio clip proves one loop from slot state and transport beats', async () => {
  const clip = {
    kind: 'clip',
    slot: {
      kind: 'slot',
      track: { kind: 'track', channelId: 'track-7e' },
      scene: { kind: 'scene', index: 0, epoch: 4 },
    },
  } as const;
  const guard = {
    generation: 'generation-7e', project: 'project-7e', revision: 7,
    sceneEpoch: 4, contentEpoch: 11,
  };
  const range = { startBeats: 0.28698158264160156, endBeats: 8, stepSizeBeats: 0.25 } as const;
  const transport = new CaptureRangeTransport(false, true);
  const observation = await new LiveAdapter({ transport, sceneBankSize: 32 })
    .playLauncherCaptureRange(clip, guard, range, 2_000, 100, 10);
  assert.deepEqual(observation.observationBasis, 'slot-transport-beats-v0');
  if (observation.observationBasis !== 'slot-transport-beats-v0') {
    assert.fail('expected the transport-beat observation');
  }
  assert.equal(observation.requiredAdvanceBeats, 8);
  assert.ok(observation.observedAdvanceBeats >= 8);
  assert.ok(transport.frames.some((frame) => frame.method === WIRE.slotPlayState));
});
