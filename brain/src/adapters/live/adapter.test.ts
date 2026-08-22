/**
 * `LiveAdapter.read`, driven offline against a transport that MODELS THE CURSOR.
 *
 * The live adapter has had no offline harness at all: `encoder.test.ts` checks
 * the frames an op produces and `pool.ts` is tested as an allocator, but nothing
 * has ever run `read` end to end without a DAW. That gap is exactly where a
 * mispoint hides, because a mispoint does not throw — it returns another clip's
 * music with a healthy status (E2), and every layer above takes it at face value.
 *
 * ⚠ So the stub below tracks WHERE EACH CURSOR IS POINTED and answers from
 * whatever clip that cursor is really on, which is what Bitwig does. A test whose
 * stub answered from the address the adapter *asked about* could not fail for the
 * bug this file exists to catch: it would be asserting the adapter's own belief
 * back at it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AddressUnresolvedError, CONTRACT_VERSION, InvalidOpError, addressKey, chain as chainAt, clip, device as deviceAt, deviceEnabled,
  deviceIn as deviceInAt,
  drumPad, notes as notesAt, param, remote, remotes, scene, slot, track,
  type ClipAddress, type RevisionMark, type TrackAddress,
} from '../../contract/index.js';
import { LiveAdapter } from './adapter.js';
import type { Transport } from './transport.js';
import { WIRE, type Frame } from './wiremap.js';

const CHANNEL_ID = 'e4a1c0de-0000-4000-8000-000000000001';
const TRACK: TrackAddress = track(CHANNEL_ID);
const CLIP = (sceneIndex: number): ClipAddress => clip(slot(TRACK, scene(sceneIndex, 1)));
const NAV_MARK: RevisionMark = {
  revision: 7,
  generation: 'nav-gen',
  project: 'nav-project',
  sceneEpoch: 1,
  contentEpoch: 3,
  window: {
    tracks: { count: 1, bankSize: 16 },
    scenes: { count: 8, bankSize: 8 },
  },
};

interface SlotModel {
  readonly lengthBeats: number;
  /** One note per clip, pitched so a mispoint is legible in the assertion. */
  readonly pitch: number;
  readonly startBeats?: number;
  /** Optional distinct pitch for each MIDI channel. */
  readonly channelPitches?: readonly number[];
}

/**
 * A Bitwig-shaped stub: slots hold music, cursors point at slots, and a read
 * through a cursor returns whatever that cursor is ON.
 */
class CursorModelTransport implements Transport {
  readonly frames: Frame[] = [];
  /** cursor ref -> the slot index it is currently pointed at. */
  private readonly cursorOn = new Map<string, number>();
  /** The cursor named by the last `cursor.pointTrack`, awaiting its `slot.select`. */
  private pending: string | undefined;
  /** Cursor ref -> whether it no longer follows launcher selection. */
  private readonly pinned = new Map<string, boolean>();
  /** Cursor ref -> whether its owning track no longer follows track selection. */
  private readonly trackPinned = new Map<string, boolean>();
  /** Pin writes that become visible only after the adapter settles. */
  private readonly pendingPins = new Map<string, number>();
  private readonly pendingTrackPins = new Map<string, number>();
  private readonly stepOffset = new Map<string, number>();
  /** Cursor ref -> current step size. */
  private readonly stepSize = new Map<string, number>();
  private observerGeneration = 0;
  private observerArmed = false;

  constructor(
    private readonly slots: ReadonlyMap<number, SlotModel>,
    private readonly selection = { trackIndex: -1, slotIndex: -1 },
    private readonly pinSettleCount = 0,
    private readonly failWriterPage?: number,
    private readonly noteReadSteps = 2048,
    private readonly noteObserver = false,
  ) {}

  settlePins(): void {
    for (const [cursor, remaining] of this.pendingPins) {
      if (remaining <= 1) {
        this.pinned.set(cursor, true);
        this.pendingPins.delete(cursor);
      } else {
        this.pendingPins.set(cursor, remaining - 1);
      }
    }
    for (const [cursor, remaining] of this.pendingTrackPins) {
      if (remaining <= 1) {
        this.trackPinned.set(cursor, true);
        this.pendingTrackPins.delete(cursor);
      } else {
        this.pendingTrackPins.set(cursor, remaining - 1);
      }
    }
  }

  /** Where a given cursor ended up — for asserting the point actually happened. */
  where(cursor: string): number | undefined {
    return this.cursorOn.get(cursor);
  }

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const params = (frame.params ?? {}) as Record<string, unknown>;

    switch (frame.method) {
      case WIRE.hello:
        return { contractVersion: CONTRACT_VERSION, extensionVersion: 'test', hostApiVersion: 18, methodsHash: 'test' };

      case WIRE.hostInfo:
        return { hostApiVersion: 18, hostProduct: 'Bitwig Studio', hostVersion: 'test' };

      case WIRE.rigInfo:
        return {
          gridSteps: 64,
          fineSteps: 512,
          noteReadSteps: this.noteReadSteps,
          cursorPool: 3,
          scenes: 8,
          deviceBank: 8,
        };

      case WIRE.trackList:
        return { tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }], count: 1, bankSize: 8, itemCount: 1 };

      case WIRE.revisionGet:
        // ⚠ The mark now carries both epochs and the generation nonce, because
        // the extension owns them (session 3). A stub that answers only
        // `revision` makes every scene-relative address read as stale, which is
        // the right failure — it is the adapter refusing an epoch it never saw.
        return { revision: 1, generation: 'stub-gen', sceneEpoch: 1, contentEpoch: 0, contentEvents: [] };

      case WIRE.selectionStatus:
        return this.selection;

      case WIRE.slotStatus:
        return { hasContent: this.slots.has(params['slotIndex'] as number) };

      // ⚠ The two frames that MOVE a cursor, paired exactly as the adapter emits
      // them. The trailing selection restore also sends `slot.select`, with no
      // `cursor.pointTrack` in front of it — so consuming `pending` is what keeps
      // the restore from being mistaken for a point.
      case WIRE.cursorPointTrack:
        this.pending = params['cursor'] as string;
        return {};

      case WIRE.slotSelect: {
        const slotIndex = params['slotIndex'] as number;
        // E36: every cursor whose pin has not settled still follows selection.
        for (const cursor of this.cursorOn.keys()) {
          if (this.pinned.get(cursor) !== true || this.trackPinned.get(cursor) !== true) {
            this.cursorOn.set(cursor, slotIndex);
          }
        }
        if (this.pending !== undefined) {
          this.cursorOn.set(this.pending, slotIndex);
          this.pending = undefined;
        } else {
          this.selection.trackIndex = params['trackIndex'] as number;
          this.selection.slotIndex = slotIndex;
        }
        return {};
      }

      case WIRE.cursorPin: {
        const cursor = params['cursor'] as string;
        const value = params['pinned'] === true;
        if (!value) {
          this.pendingPins.delete(cursor);
          this.pinned.set(cursor, false);
        } else if (this.pinSettleCount > 0) {
          this.pendingPins.set(cursor, this.pinSettleCount);
        } else {
          this.pinned.set(cursor, true);
        }
        return {};
      }

      case WIRE.cursorPinTrack: {
        const cursor = params['cursor'] as string;
        const value = params['pinned'] === true;
        if (!value) {
          this.pendingTrackPins.delete(cursor);
          this.trackPinned.set(cursor, false);
        } else if (this.pinSettleCount > 0) {
          this.pendingTrackPins.set(cursor, this.pinSettleCount);
        } else {
          this.trackPinned.set(cursor, true);
        }
        return {};
      }

      case WIRE.cursorStatus: {
        const cursor = params['cursor'] as string;
        const on = this.cursorOn.get(cursor);
        const model = on === undefined ? undefined : this.slots.get(on);
        return model === undefined ? {} : {
          loopLength: model.lengthBeats,
          trackPosition: 0,
          sceneIndex: this.failWriterPage !== undefined
            && this.stepOffset.get(cursor) === this.failWriterPage ? on! + 1 : on,
          isPinned: this.pinned.get(cursor) === true,
          cursorTrackPinned: this.trackPinned.get(cursor) === true,
        };
      }

      case WIRE.cursorClipMetadata: {
        const on = this.cursorOn.get(params['cursor'] as string);
        const model = on === undefined ? undefined : this.slots.get(on);
        return model === undefined ? {} : {
          name: '', colorRed: 87 / 255, colorGreen: 97 / 255, colorBlue: 198 / 255,
          playStart: 0, playStop: model.lengthBeats, loopEnabled: true,
          loopStart: 0, loopLength: model.lengthBeats,
        };
      }

      case WIRE.cursorGetNotesVerbose:
      case WIRE.cursorGetNotesVerboseAllChannels: {
        const cursor = params['cursor'] as string;
        const on = this.cursorOn.get(cursor);
        const model = on === undefined ? undefined : this.slots.get(on);
        const stepSize = this.stepSize.get(cursor) ?? 1;
        const offset = this.stepOffset.get(cursor) ?? 0;
        const absolute = Math.floor((model?.startBeats ?? 0) / stepSize + 1e-9);
        const maxX = params['maxX'] as number | undefined;
        const local = absolute - offset;
        const notesFor = (channel: number) =>
          model === undefined || local < 0 || (maxX !== undefined && local >= maxX)
            ? []
            : [{
              x: local,
              y: model.channelPitches?.[channel] ?? model.pitch,
              velocity: 100 / 127,
              duration: 1,
            }];
        const notes = notesFor((params['channel'] as number | undefined) ?? 0);
        if (frame.method === WIRE.cursorGetNotesVerbose) return { notes };
        return {
          channels: Array.from({ length: 16 }, (_, channel) => ({
            channel,
            notes: notesFor(channel),
            count: notesFor(channel).length,
          })),
          count: notes.length * 16,
          scanMicros: 1,
        };
      }

      case WIRE.cursorSetStepSize:
        this.stepSize.set(params['cursor'] as string, params['stepSize'] as number);
        return {};

      case WIRE.cursorScrollToStep:
        this.stepOffset.set(params['cursor'] as string, params['step'] as number);
        return {};

      case WIRE.noteObserverPrepare:
        if (!this.noteObserver) return {};
        this.observerArmed = false;
        return { generation: ++this.observerGeneration, afterSequence: 0 };

      case WIRE.noteObserverArm:
        if (!this.noteObserver) return {};
        this.observerArmed = true;
        return { afterSequence: 0 };

      case WIRE.noteObserverRead:
        if (!this.noteObserver) return {};
        return {
          dropped: 0,
          firstRetainedSequence: 1,
          events: this.observerArmed ? [{
            sequence: 1,
            generation: this.observerGeneration,
            armed: true,
            trackId: CHANNEL_ID,
            trackIndex: 0,
            slotIndex: 0,
          }] : [],
        };

      case WIRE.batchRun:
        return { applied: true, revision: 2, results: [] };

      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

/**
 * ⚠ `settle` is stubbed to nothing. Every budget here is a real `setTimeout`
 * (`SETTLE_MS`), and this file asserts POINTING, not timing — paying ~400ms of
 * genuine wall clock to re-measure numbers E1 and E15-D already own would make
 * the offline suite slower for no evidence. The frames are what is under test.
 */
class UntimedAdapter extends LiveAdapter {
  override async settle(): Promise<void> {}
}

class DelayedPinAdapter extends LiveAdapter {
  constructor(private readonly model: CursorModelTransport) {
    super({ transport: model, cursorPool: 2, sceneBankSize: 8 });
  }

  override async settle(): Promise<void> {
    this.model.settlePins();
  }
}

class ObserverAdapter extends LiveAdapter {
  override async settle(budget: import('../../contract/index.js').SettleBudget): Promise<void> {
    if (budget === 'noteWrite') return super.settle(budget);
  }
}

test('2h: the production fine cursor preserves a triplet start across exact readback', async () => {
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 8, pitch: 65, startBeats: 1 / 6 }],
  ]));
  const adapter = new UntimedAdapter({ transport });
  await adapter.hello();

  const snapshot = await adapter.read([notesAt(CLIP(0), 4)]);
  const value = snapshot.entries[addressKey(notesAt(CLIP(0), 4))]?.value;

  assert.equal(value?.of === 'notes' ? value.notes[0]?.startBeats : undefined, 1 / 6);
  assert.deepEqual(
    transport.frames
      .filter((frame) => frame.method === WIRE.cursorSetStepSize)
      .map((frame) => frame.params?.['stepSize']),
    [1 / 64, 1 / 48],
  );
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorGetNotesVerboseAllChannels).length,
    2,
    'one clip sends one bounded bulk request for each grid',
  );
  assert.equal(transport.where('fine'), 0);
});

test('2i: the exact reader pages through a clip longer than its fine window', async () => {
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 32, pitch: 67, startBeats: 24 }],
  ]), { trackIndex: -1, slotIndex: -1 }, 0, undefined, 512);
  const adapter = new UntimedAdapter({ transport });
  await adapter.hello();

  const snapshot = await adapter.read([notesAt(CLIP(0), 0)]);
  const value = snapshot.entries[addressKey(notesAt(CLIP(0), 0))]?.value;

  assert.equal(value?.of === 'notes' ? value.notes[0]?.startBeats : undefined, 24);
  assert.deepEqual(
    transport.frames
      .filter((frame) => frame.method === WIRE.cursorScrollToStep)
      .map((frame) => frame.params?.['step']),
    [0, 512, 1024, 1536, 0, 0, 512, 1024, 0],
  );
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorGetNotesVerboseAllChannels).length,
    7,
    'four binary pages and three triplet pages each use one bulk request',
  );
});

test('4b: one bulk page reply preserves all 16 verbose MIDI channels', async () => {
  const channelPitches = Array.from({ length: 16 }, (_, channel) => 48 + channel);
  const phases: string[] = [];
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 48, channelPitches }],
  ]));
  const adapter = new UntimedAdapter({
    transport,
    onTiming: (event) => phases.push(event.phase),
  });
  await adapter.hello();

  const addresses = channelPitches.map((_, channel) => notesAt(CLIP(0), channel));
  const snapshot = await adapter.read(addresses);

  assert.deepEqual(addresses.map((address) => {
    const value = snapshot.entries[addressKey(address)]?.value;
    return value?.of === 'notes' ? value.notes[0]?.pitch : undefined;
  }), channelPitches);
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorGetNotesVerboseAllChannels).length,
    2,
    'the snapshot reuses one binary and one triplet bulk reply for all channels',
  );
  assert.deepEqual(new Set(phases), new Set([
    'targetAcquisition', 'metadata', 'gridSettlement', 'pageTurn',
    'bulkPageRead', 'reconciliation', 'selectionRestoration',
  ]));
  assert.equal(phases.filter((phase) => phase === 'gridSettlement').length, 2,
    'each grid and page-zero transition uses one full settlement');
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorScrollToStep).length,
    2,
    'each grid sets page zero before one complete settlement',
  );
});

test('4b: an incomplete bulk page refuses instead of hiding one MIDI channel', async () => {
  const inner = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
  ]));
  const transport: Transport = {
    send: async (frame) => {
      const result = await inner.send(frame);
      if (frame.method !== WIRE.cursorGetNotesVerboseAllChannels) return result;
      const bulk = result as { readonly channels: readonly unknown[] };
      return { ...bulk, channels: bulk.channels.slice(0, 15) };
    },
    close: () => inner.close(),
  };
  const adapter = new UntimedAdapter({ transport });
  await adapter.hello();

  await assert.rejects(
    adapter.read([notesAt(CLIP(0), 0)]),
    /did not return all 16 MIDI channels/,
  );
});

test('5g repair: two delayed pins settle before either cursor hold is reused', async () => {
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
    [1, { lengthBeats: 4, pitch: 67 }],
  ]), { trackIndex: 3, slotIndex: 2 }, 1);
  const adapter = new DelayedPinAdapter(transport);

  const snapshot = await adapter.read([notesAt(CLIP(0)), notesAt(CLIP(1))]);
  const first = snapshot.entries[addressKey(notesAt(CLIP(0)))]?.value;
  const second = snapshot.entries[addressKey(notesAt(CLIP(1)))]?.value;

  assert.equal(first?.of === 'notes' ? first.notes[0]?.pitch : undefined, 60);
  assert.equal(second?.of === 'notes' ? second.notes[0]?.pitch : undefined, 67);
  assert.equal(transport.where('0'), 0, 'the first cursor stays on clip A');
  assert.equal(transport.where('1'), 1, 'the second cursor reaches clip B');
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorStatus).length,
    4,
    'each clip gets target and pin status readings',
  );
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorClipMetadata).length,
    2,
    'each clip gets one complete metadata reading',
  );
});

test('5g revert repair: slow pins are polled without restarting the confirmed point', async () => {
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    { trackIndex: 3, slotIndex: 2 },
    3,
  );
  const adapter = new DelayedPinAdapter(transport);

  const snapshot = await adapter.read([notesAt(CLIP(0))]);
  const value = snapshot.entries[addressKey(notesAt(CLIP(0)))]?.value;

  assert.equal(value?.of === 'notes' ? value.notes[0]?.pitch : undefined, 60);
  assert.equal(transport.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length, 1);
  assert.equal(transport.frames.filter((frame) =>
    frame.method === WIRE.cursorPin && frame.params?.['pinned'] === true).length, 1);
  assert.equal(transport.frames.filter((frame) =>
    frame.method === WIRE.cursorPinTrack && frame.params?.['pinned'] === true).length, 1);
});

test('5g revert repair: pins that never settle refuse within eight attempts', async () => {
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    { trackIndex: 3, slotIndex: 2 },
    Number.POSITIVE_INFINITY,
  );
  const adapter = new DelayedPinAdapter(transport);

  await assert.rejects(
    adapter.read([notesAt(CLIP(0))]),
    /target track 0, row 0 confirmed, but clip pin false and track pin false did not both confirm after 8 attempts/,
  );
  assert.equal(transport.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length, 1);
  assert.equal(transport.frames.filter((frame) => frame.method === WIRE.cursorStatus).length, 9);
});

test('5g repair: a direct read does not reuse a hold after an out-of-band point', async () => {
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
    [1, { lengthBeats: 4, pitch: 67 }],
  ]), { trackIndex: 3, slotIndex: 2 });
  const adapter = new UntimedAdapter({ transport, cursorPool: 1, sceneBankSize: 8 });

  await adapter.read([notesAt(CLIP(0))]);
  await transport.send({ method: WIRE.cursorPin, params: { cursor: '0', pinned: false } });
  await transport.send({ method: WIRE.cursorPinTrack, params: { cursor: '0', pinned: false } });
  await transport.send({ method: WIRE.cursorPointTrack, params: { cursor: '0', trackIndex: 0 } });
  await transport.send({
    method: WIRE.slotSelect,
    params: { trackIndex: 0, slotIndex: 1, mechanism: 'track' },
  });

  const snapshot = await adapter.read([notesAt(CLIP(0))]);
  const value = snapshot.entries[addressKey(notesAt(CLIP(0)))]?.value;

  assert.equal(value?.of === 'notes' ? value.notes[0]?.pitch : undefined, 60);
  assert.equal(transport.where('0'), 0, 'the second call re-points to clip A');
  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length,
    3,
    'both adapter calls point, with one out-of-band point between them',
  );
});

test('B4: one selection scope covers repeated live reads and restores once', async () => {
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    { trackIndex: 3, slotIndex: 2 },
  );
  const adapter = new UntimedAdapter({ transport, cursorPool: 2, sceneBankSize: 8 });

  await assert.rejects(
    adapter.preserveSelection(async () => {
      await adapter.read([notesAt(CLIP(0))]);
      await adapter.read([notesAt(CLIP(0))]);
      throw new Error('pipeline failed after pointing');
    }),
    /pipeline failed/,
  );

  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.selectionStatus).length,
    2,
    'the full pipeline captures once and confirms the final restore once',
  );
  const selects = transport.frames.filter((frame) => frame.method === WIRE.slotSelect);
  assert.equal(selects.length, 2, 'one verified cursor point and one final restore are sent');
  assert.deepEqual(selects.at(-1)?.params, {
    trackIndex: 3,
    slotIndex: 2,
    mechanism: 'track',
  });
});

test('5d repair: a pipeline captures selection eagerly but does not restore without a borrow', async () => {
  const transport = new CursorModelTransport(new Map());
  const adapter = new UntimedAdapter({ transport, cursorPool: 2, sceneBankSize: 8 });

  await adapter.preserveSelection(async () => {});

  assert.equal(transport.frames.filter((frame) => frame.method === WIRE.selectionStatus).length, 1);
  assert.equal(transport.frames.some((frame) => frame.method === WIRE.slotSelect), false);
});

test('5d repair: entry selection wins over a change before the first cursor borrow', async () => {
  const selected = { trackIndex: 3, slotIndex: 2 };
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    selected,
  );
  const adapter = new UntimedAdapter({ transport, cursorPool: 2, sceneBankSize: 8 });

  await adapter.preserveSelection(async () => {
    selected.trackIndex = 6;
    selected.slotIndex = 5;
    await adapter.read([notesAt(CLIP(0))]);
  });

  assert.deepEqual(selected, { trackIndex: 3, slotIndex: 2 });
  const restores = transport.frames.filter((frame) =>
    frame.method === WIRE.slotSelect && frame.params?.['mechanism'] === 'track');
  assert.deepEqual(restores.at(-1)?.params, {
    trackIndex: 3,
    slotIndex: 2,
    mechanism: 'track',
  });
});

test('5d repair: selection changes do not re-point a verified held clip between stages', async () => {
  const selected = { trackIndex: 3, slotIndex: 2 };
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    selected,
  );
  const adapter = new UntimedAdapter({ transport, cursorPool: 1, sceneBankSize: 8 });

  await adapter.preserveSelection(async () => {
    await adapter.read([notesAt(CLIP(0))]);
    selected.trackIndex = 7;
    selected.slotIndex = 4;
    await adapter.apply({
      ops: [
        { op: 'note.write', clip: CLIP(0), notes: [{
          startBeats: 0, pitch: 64, velocity: 100, durationBeats: 1, pan: 0.25,
        }] },
        { op: 'note.write', clip: CLIP(0), notes: [{
          startBeats: 1, pitch: 65, velocity: 100, durationBeats: 1, pan: -0.25,
        }] },
      ],
    });
    await adapter.read([notesAt(CLIP(0))]);
  });

  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length,
    1,
    'the stash point remains held through every nonstructural write and verify stage',
  );
  assert.deepEqual(selected, { trackIndex: 3, slotIndex: 2 });
});

test('5d repair: a structural stage invalidates the verified held clip', async () => {
  const transport = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
    [1, { lengthBeats: 4, pitch: 62 }],
  ]));
  const adapter = new UntimedAdapter({ transport, cursorPool: 1, sceneBankSize: 8 });

  await adapter.read([notesAt(CLIP(0))]);
  await adapter.apply({ ops: [{ op: 'clip.delete', slot: CLIP(1).slot }] });
  await adapter.read([notesAt(CLIP(0))]);

  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length,
    2,
    'the next read must re-point after a structural operation',
  );
});

test('B4: overlapping pipelines share one capture and restore after both finish', async () => {
  const transport = new CursorModelTransport(
    new Map([[0, { lengthBeats: 4, pitch: 60 }]]),
    { trackIndex: 3, slotIndex: 2 },
  );
  const adapter = new UntimedAdapter({ transport, cursorPool: 2, sceneBankSize: 8 });
  let releaseFirst!: () => void;
  let firstPointed!: () => void;
  const release = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const pointed = new Promise<void>((resolve) => { firstPointed = resolve; });

  const first = adapter.preserveSelection(async () => {
    await adapter.read([notesAt(CLIP(0))]);
    firstPointed();
    await release;
  });
  await pointed;
  await adapter.preserveSelection(async () => {
    await adapter.read([notesAt(CLIP(0))]);
  });

  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.selectionStatus).length,
    1,
    'the second pipeline must not capture the first pipeline target',
  );
  releaseFirst();
  await first;

  assert.equal(
    transport.frames.filter((frame) => frame.method === WIRE.selectionStatus).length,
    2,
    'the final call is the one restore confirmation',
  );
  const selects = transport.frames.filter((frame) => frame.method === WIRE.slotSelect);
  assert.deepEqual(selects.at(-1)?.params, {
    trackIndex: 3,
    slotIndex: 2,
    mechanism: 'track',
  });
});

test('4b: live navigation resolves the durable track id before the UI-only frame', async () => {
  const frames: Frame[] = [];
  const transport: Transport = {
    async send(frame) {
      frames.push(frame);
      if (frame.method === WIRE.revisionGet) {
        return {
          revision: 7, generation: 'nav-gen', project: 'nav-project', sceneEpoch: 1,
          contentEpoch: 3, sceneCount: 8, contentEvents: [],
        };
      }
      if (frame.method === WIRE.trackList) {
        return {
          tracks: [{ index: 5, channelId: CHANNEL_ID, name: 'moved track', position: 5, type: 'Instrument' }],
          count: 1, itemCount: 1, bankSize: 16,
        };
      }
      if (frame.method === WIRE.showChangedClip) {
        return { navigated: true, layout: 'EDIT' };
      }
      return {};
    },
    async close() {},
  };
  const adapter = new UntimedAdapter({ transport, cursorPool: 3, sceneBankSize: 8 });

  const result = await adapter.showClipInEditor(CLIP(2), NAV_MARK);

  assert.deepEqual(result, { navigated: true, layoutRequested: 'EDIT', layoutConfirmed: true });
  const navigation = frames.find((frame) => frame.method === WIRE.showChangedClip);
  assert.deepEqual(navigation?.params, {
    trackIndex: 5,
    expectedChannelId: CHANNEL_ID,
    slotIndex: 2,
    expectedRevision: 7,
    expectedGeneration: 'nav-gen',
    expectedProject: 'nav-project',
    expectedSceneEpoch: 1,
    expectedContentEpoch: 3,
  });
  assert.ok(frames.findIndex((frame) => frame.method === WIRE.trackList)
    < frames.findIndex((frame) => frame.method === WIRE.showChangedClip));
});

test('4b review: a project switch after verification refuses before the UI frame', async () => {
  const frames: Frame[] = [];
  const transport: Transport = {
    async send(frame) {
      frames.push(frame);
      if (frame.method === WIRE.revisionGet) {
        return {
          revision: 7, generation: 'nav-gen', project: 'other-project', sceneEpoch: 1,
          contentEpoch: 3, sceneCount: 8, contentEvents: [],
        };
      }
      if (frame.method === WIRE.trackList) {
        return {
          tracks: [{ index: 5, channelId: CHANNEL_ID, name: 'same-id clone', position: 5, type: 'Instrument' }],
          count: 1, itemCount: 1, bankSize: 16,
        };
      }
      return {};
    },
    async close() {},
  };
  const adapter = new UntimedAdapter({ transport, cursorPool: 3, sceneBankSize: 8 });

  const result = await adapter.showClipInEditor(CLIP(2), NAV_MARK);

  assert.equal(result.navigated, false);
  assert.match(result.why ?? '', /changed after/);
  assert.equal(frames.some((frame) => frame.method === WIRE.showChangedClip), false);
});

test('4b review: an occupied replacement after verification refuses before the UI frame', async () => {
  const frames: Frame[] = [];
  const transport: Transport = {
    async send(frame) {
      frames.push(frame);
      if (frame.method === WIRE.revisionGet) {
        return {
          revision: 7, generation: 'nav-gen', project: 'nav-project', sceneEpoch: 1,
          contentEpoch: 5, sceneCount: 8, contentEvents: [
            { seq: 4, channelId: CHANNEL_ID, trackIndex: 5, slotIndex: 2, filled: false },
            { seq: 5, channelId: CHANNEL_ID, trackIndex: 5, slotIndex: 2, filled: true },
          ],
        };
      }
      if (frame.method === WIRE.trackList) {
        return {
          tracks: [{ index: 5, channelId: CHANNEL_ID, name: 'same slot', position: 5, type: 'Instrument' }],
          count: 1, itemCount: 1, bankSize: 16,
        };
      }
      return {};
    },
    async close() {},
  };
  const adapter = new UntimedAdapter({ transport, cursorPool: 3, sceneBankSize: 8 });

  const result = await adapter.showClipInEditor(CLIP(2), NAV_MARK);

  assert.equal(result.navigated, false);
  assert.match(result.why ?? '', /changed after/);
  assert.equal(frames.some((frame) => frame.method === WIRE.showChangedClip), false);
});

test('L-read: a clip revisited after its cursor was EVICTED is re-pointed, not assumed (E2)', async () => {
  // Four clips, a pool of three. The fourth read evicts the first clip's cursor,
  // so when the write-set comes back to that clip it is handed a DIFFERENT cursor
  // — one still sitting on somebody else's music.
  const wire = new CursorModelTransport(new Map([
    [0, { lengthBeats: 4, pitch: 60 }],
    [1, { lengthBeats: 8, pitch: 62 }],
    [2, { lengthBeats: 4, pitch: 64 }],
    [3, { lengthBeats: 4, pitch: 65 }],
  ]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // ⚠ The shape a real write-set produces, not a contrived one: `note.write` and
  // `note.props` carry a `channel`, so one clip yields two distinct `notes`
  // addresses — and `writeSetOf` orders targets by FIRST MENTION, which puts the
  // other clips in between.
  const snapshot = await adapter.read([
    notesAt(CLIP(0), 0),
    clip(CLIP(1).slot),
    clip(CLIP(2).slot),
    clip(CLIP(3).slot),
    notesAt(CLIP(0), 1),
  ]);

  const revisited = snapshot.entries[addressKey(notesAt(CLIP(0), 1))];
  assert.equal(revisited?.value.of === 'notes' ? revisited.value.notes[0]?.pitch : undefined, 60,
    'the revisited clip must report ITS OWN notes — 62 here would be clip 1\'s, read through a ' +
    'cursor that was never re-pointed');

  // And the same failure the other way round: the length that came back is the
  // revisited clip's, not the evicting clip's.
  const first = snapshot.entries[addressKey(notesAt(CLIP(0), 0))];
  assert.equal(first?.value.of === 'notes' ? first.value.notes[0]?.pitch : undefined, 60);
});

test('L-read: a clip and its notes side by side still cost ONE point', async () => {
  // The other half, and the reason the memo exists at all: the common write-set
  // shape must not pay two point/settle round trips for one clip.
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.read([clip(CLIP(0).slot), notesAt(CLIP(0), 0)]);

  const points = wire.frames.filter((f) => f.method === WIRE.cursorPointTrack);
  assert.equal(points.length, 1, 'one clip, one point — the memo is still doing its job');
});

test('5d cursor repair: a lagging clip cursor retries the complete point', async () => {
  class LaggingCursorTransport extends CursorModelTransport {
    private statusReads = 0;

    override async send(frame: Frame): Promise<unknown> {
      const reply = await super.send(frame);
      if (frame.method !== WIRE.cursorStatus) return reply;
      this.statusReads += 1;
      return this.statusReads < 3
        ? { ...(reply as Record<string, unknown>), trackPosition: 9, sceneIndex: 7 }
        : reply;
    }
  }

  const wire = new LaggingCursorTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 1 });

  const snapshot = await adapter.read([notesAt(CLIP(0))]);
  const value = snapshot.entries[addressKey(notesAt(CLIP(0)))]?.value;

  assert.equal(value?.of === 'notes' ? value.notes[0]?.pitch : undefined, 60);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length, 3);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 3);
  assert.deepEqual(
    wire.frames.filter((frame) => frame.method === WIRE.cursorPin).map((frame) => frame.params),
    [
      { cursor: '0', pinned: false },
      { cursor: '0', pinned: false },
      { cursor: '0', pinned: false },
      { cursor: '0', pinned: true },
    ],
  );
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.cursorStatus).length, 4);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.cursorClipMetadata).length, 1);
});

test('5d cursor repair: a clip cursor that never arrives refuses after eight attempts', async () => {
  class StuckCursorTransport extends CursorModelTransport {
    override async send(frame: Frame): Promise<unknown> {
      const reply = await super.send(frame);
      return frame.method === WIRE.cursorStatus
        ? { ...(reply as Record<string, unknown>), trackPosition: 9, sceneIndex: 7 }
        : reply;
    }
  }

  const wire = new StuckCursorTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 1 });

  await assert.rejects(adapter.read([notesAt(CLIP(0))]), AddressUnresolvedError);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.cursorPointTrack).length, 8);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 8);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.cursorStatus).length, 8);
  assert.equal(wire.frames.filter((frame) =>
    frame.method === WIRE.cursorPin && frame.params?.['pinned'] === false).length, 8);
  assert.equal(wire.frames.some((frame) =>
    frame.method === WIRE.cursorPin && frame.params?.['pinned'] === true), false);
});

test('L-read: an EMPTY slot is never pointed at, and is exact (E2, D16d)', async () => {
  // E2's original finding, guarded here because the clip-length capture added a
  // second caller to `pointAtClip` and absence must stay free.
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const snapshot = await adapter.read([clip(CLIP(5).slot)]);

  assert.deepEqual(wire.frames.filter((f) => f.method === WIRE.cursorPointTrack), []);
  const entry = snapshot.entries[addressKey(clip(CLIP(5).slot))];
  assert.equal(entry?.value.of === 'clip' ? entry.value.exists : true, false);
  assert.equal(entry?.fidelity, 'exact');
});

test('2h: a structural stage releases every physical writer cursor', async () => {
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  await adapter.read([clip(CLIP(0).slot)]);
  const beforeApply = wire.frames.length;

  await adapter.apply({ ops: [{
      op: 'clip.duplicate',
      source: CLIP(0),
      destination: CLIP(1).slot,
    }],
  });

  const after = wire.frames.slice(beforeApply);
  const batchAt = after.findIndex((frame) => frame.method === WIRE.batchRun);
  assert.ok(batchAt >= 0);
  assert.deepEqual(
    after.slice(batchAt + 1)
      .filter((frame) => frame.method === WIRE.cursorPin)
      .map((frame) => frame.params),
    [
      { cursor: '0', pinned: false },
      { cursor: '1', pinned: false },
      { cursor: '2', pinned: false },
    ],
  );
  assert.deepEqual(
    after.slice(batchAt + 1)
      .filter((frame) => frame.method === WIRE.cursorPinTrack)
      .map((frame) => frame.params),
    [
      { cursor: '0', pinned: false },
      { cursor: '1', pinned: false },
      { cursor: '2', pinned: false },
    ],
  );
});

test('2h: a clip-wide reconstruction verifies its cursor before the write turn', async () => {
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 4, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.apply({ ops: [
    { op: 'note.clear', clip: CLIP(0) },
    {
      op: 'note.write', clip: CLIP(0), channel: 8,
      notes: [{ startBeats: 0, pitch: 67, velocity: 90, durationBeats: 1 }],
    },
  ] });

  const batchAt = wire.frames.findIndex((frame) => frame.method === WIRE.batchRun);
  assert.ok(batchAt > 0);
  assert.equal(wire.frames.slice(0, batchAt)
    .filter((frame) => frame.method === WIRE.cursorStatus).length, 3);
  const batch = wire.frames[batchAt]!.params as {
    ops: { method: string }[];
  };
  assert.deepEqual(batch.ops.map((frame) => frame.method), [
    WIRE.cursorClearNotes,
    WIRE.cursorSetStepSize,
    WIRE.cursorScrollToStep,
    WIRE.cursorSetNotes,
    WIRE.cursorScrollToStep,
  ]);
});

test('2i: an additive note write verifies and pins its exact clip before the write turn', async () => {
  const wire = new CursorModelTransport(new Map([[2, { lengthBeats: 32, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.apply({ ops: [{
    op: 'note.write', clip: CLIP(2), channel: 0,
    notes: [{ startBeats: 12, pitch: 64, velocity: 90, durationBeats: 2 }],
  }] });

  const batchAt = wire.frames.findIndex((frame) => frame.method === WIRE.batchRun);
  assert.ok(batchAt > 0);
  assert.equal(wire.where('0'), 2);
  assert.equal(wire.frames.slice(0, batchAt)
    .filter((frame) => frame.method === WIRE.cursorStatus).length, 3);
  const batch = wire.frames[batchAt]!.params as { ops: { method: string }[] };
  assert.deepEqual(batch.ops.map((frame) => frame.method), [
    WIRE.cursorSetStepSize,
    WIRE.cursorScrollToStep,
    WIRE.cursorSetNotes,
    WIRE.cursorScrollToStep,
  ]);
});

test('4b settlement: an eligible note event wakes but does not replace verification', async () => {
  const phases: string[] = [];
  const wire = new CursorModelTransport(
    new Map([[0, { lengthBeats: 32, pitch: 60 }]]),
    { trackIndex: -1, slotIndex: -1 },
    0,
    undefined,
    2048,
    true,
  );
  const adapter = new ObserverAdapter({
    transport: wire,
    cursorPool: 3,
    onTiming: (event) => phases.push(event.phase),
  });
  await adapter.hello();
  await adapter.apply({ ops: [{
    op: 'note.write', clip: CLIP(0),
    notes: [{ startBeats: 0, pitch: 64, velocity: 90, durationBeats: 1 }],
  }] });
  await adapter.settle('noteWrite');

  assert.ok(wire.frames.some((frame) => frame.method === WIRE.noteObserverArm));
  assert.ok(wire.frames.some((frame) => frame.method === WIRE.noteObserverRead));
  assert.ok(phases.includes('observerArm'));
  assert.ok(phases.includes('firstCallback'));
  assert.equal(
    wire.frames.some((frame) => frame.method === WIRE.cursorGetNotesVerboseAllChannels),
    false,
    'the wake does not claim success or perform the executor exact read',
  );
});

test('2i follow-up: clip metadata verifies the occupied exact target before the write turn', async () => {
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 32, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.apply({ ops: [{
    op: 'clip.update', clip: CLIP(0),
    metadata: {
      name: 'four phrases', color: { red: 31, green: 159, blue: 223 },
      lengthBeats: 128, playStartBeats: 0, loopEnabled: true,
      loopStartBeats: 0, loopEndBeats: 128,
    },
  }] });

  const batchAt = wire.frames.findIndex((frame) => frame.method === WIRE.batchRun);
  assert.ok(batchAt > 0);
  assert.equal(wire.frames.slice(0, batchAt)
    .filter((frame) => frame.method === WIRE.slotStatus).length, 1);
  assert.equal(wire.frames.slice(0, batchAt)
    .filter((frame) => frame.method === WIRE.cursorStatus).length, 2);
  const batch = wire.frames[batchAt]!.params as { ops: { method: string }[] };
  assert.deepEqual(batch.ops.map((frame) => frame.method), [WIRE.cursorSetClipMetadata]);
});

test('2i follow-up: metadata targets wider than the cursor pool refuse before mutation', async () => {
  const wire = new CursorModelTransport(new Map(Array.from(
    { length: 4 }, (_, row) => [row, { lengthBeats: 32, pitch: 60 + row }] as const,
  )));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(adapter.apply({ ops: Array.from({ length: 4 }, (_, row) => ({
    op: 'clip.update' as const, clip: CLIP(row),
    metadata: {
      name: `clip ${row}`, color: { red: 31, green: 159, blue: 223 },
      lengthBeats: 128, playStartBeats: 0, loopEnabled: true,
      loopStartBeats: 0, loopEndBeats: 128,
    },
  })) }), InvalidOpError);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

test('2i: one note stage wider than the verified cursor pool is refused before mutation', async () => {
  const wire = new CursorModelTransport(new Map(Array.from(
    { length: 4 }, (_, row) => [row, { lengthBeats: 4, pitch: 60 + row }] as const,
  )));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(adapter.apply({ ops: Array.from({ length: 4 }, (_, row) => ({
    op: 'note.write' as const,
    clip: CLIP(row),
    notes: [{ startBeats: 0, pitch: 72 + row, velocity: 90, durationBeats: 1 }],
  })) }), InvalidOpError);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

test('2i follow-up: a note beyond the first writer page uses a local step and restores page zero', async () => {
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 32, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  await adapter.hello();

  await adapter.apply({ ops: [{
    op: 'note.write', clip: CLIP(0),
    notes: [{ startBeats: 9, pitch: 72, velocity: 90, durationBeats: 1 / 64 }],
  }] });

  const batch = wire.frames.find((frame) => frame.method === WIRE.batchRun);
  assert.ok(batch !== undefined);
  const ops = batch.params?.['ops'] as { method: string; params: Record<string, unknown> }[];
  assert.deepEqual(ops.map((frame) => frame.method), [
    WIRE.cursorSetStepSize,
    WIRE.cursorScrollToStep,
    WIRE.cursorSetNotes,
    WIRE.cursorScrollToStep,
  ]);
  assert.equal(ops[1]?.params['step'], 512);
  assert.deepEqual(ops[2]?.params['notes'], [[64, 72, 90, 1 / 64]]);
  assert.equal(ops[3]?.params['step'], 0);
  assert.equal(
    wire.frames.filter((frame) => frame.method === WIRE.cursorScrollToStep).at(-1)?.params?.['step'],
    0,
  );
});

test('2i follow-up: property reads use separate settled page turns', async () => {
  const wire = new CursorModelTransport(new Map([[0, { lengthBeats: 32, pitch: 60 }]]));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  await adapter.hello();

  await adapter.apply({ ops: [{
    op: 'note.write', clip: CLIP(0),
    notes: [
      { startBeats: 1, pitch: 67, velocity: 90, durationBeats: 1 / 64, pan: 0.25 },
      { startBeats: 9, pitch: 72, velocity: 90, durationBeats: 1 / 64, pan: -0.25 },
    ],
  }] });

  const batchIndices = wire.frames.flatMap((frame, index) =>
    frame.method === WIRE.batchRun ? [index] : []);
  assert.equal(batchIndices.length, 3, 'one identity turn and one settled turn per property page');
  const propertyPages = batchIndices.slice(1).map((batchIndex) => {
    const priorScroll = wire.frames.slice(0, batchIndex)
      .filter((frame) => frame.method === WIRE.cursorScrollToStep).at(-1);
    const batch = wire.frames[batchIndex]!.params?.['ops'] as {
      method: string;
      params: Record<string, unknown>;
    }[];
    return {
      page: priorScroll?.params?.['step'],
      methods: batch.map((frame) => frame.method),
      x: batch.find((frame) => frame.method === WIRE.cursorSetNoteProps)?.params['x'],
    };
  });
  assert.deepEqual(propertyPages, [
    { page: 0, methods: [WIRE.cursorSetStepSize, WIRE.cursorSetNoteProps], x: 64 },
    { page: 512, methods: [WIRE.cursorSetStepSize, WIRE.cursorSetNoteProps], x: 64 },
  ]);
  assert.equal(
    wire.frames.filter((frame) => frame.method === WIRE.cursorScrollToStep).at(-1)?.params?.['step'],
    0,
  );
});

test('2i follow-up: a failed later page target check causes no partial write', async () => {
  const wire = new CursorModelTransport(
    new Map([[0, { lengthBeats: 32, pitch: 60 }]]),
    { trackIndex: -1, slotIndex: -1 },
    0,
    512,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  await adapter.hello();

  await assert.rejects(adapter.apply({ ops: [{
    op: 'note.write', clip: CLIP(0),
    notes: [
      { startBeats: 1, pitch: 67, velocity: 90, durationBeats: 1 / 64 },
      { startBeats: 9, pitch: 72, velocity: 90, durationBeats: 1 / 64 },
    ],
  }] }), AddressUnresolvedError);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
  assert.equal(
    wire.frames.filter((frame) => frame.method === WIRE.cursorScrollToStep).at(-1)?.params?.['step'],
    0,
  );
});

test('2i follow-up: a later staged page failure leaves no earlier expressive write', async () => {
  const wire = new CursorModelTransport(
    new Map([
      [0, { lengthBeats: 32, pitch: 60 }],
      [1, { lengthBeats: 32, pitch: 67 }],
    ]),
    { trackIndex: -1, slotIndex: -1 },
    0,
    512,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  await adapter.hello();

  await assert.rejects(adapter.apply({ ops: [
    {
      op: 'note.write', clip: CLIP(0),
      notes: [{ startBeats: 1, pitch: 72, velocity: 90, durationBeats: 1 / 64, pan: 0.25 }],
    },
    {
      op: 'note.write', clip: CLIP(1),
      notes: [{ startBeats: 9, pitch: 74, velocity: 90, durationBeats: 1 / 64, pan: -0.25 }],
    },
  ] }), AddressUnresolvedError);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

// --- the device mint (D16 amendment 2, live half) ----------------------------

/**
 * A device chain that a cursor has to be POINTED at to see, which is the fact the
 * whole mint rests on: `device.list` reads `rig.cursorDeviceBanks[cursor]`, so it
 * reports the chain of whatever track that cursor is on, not the track anyone
 * named. A stub that ignored the point would certify an adapter that never made
 * one.
 */
class DeviceChainTransport implements Transport {
  readonly frames: Frame[] = [];
  /** cursor ref -> the track index it is pointed at. */
  private readonly cursorOn = new Map<string, number>();
  /** track index -> device names, in chain order. */
  readonly chains = new Map<number, string[]>([[0, ['Polysynth']]]);
  private revision = 1;

  /**
   * What the insert does to the chain. The default appends, which is what
   * `endOfDeviceChainInsertionPoint()` does; the cases below pass stranger ones
   * to prove the diff refuses them rather than picking an index.
   */
  constructor(
    private readonly onInsert: (chain: string[], name: string) => void = (c, n) => c.push(n),
    private readonly itemCountOf: (chain: string[]) => number = (c) => c.length,
  ) {}

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.dispatch(frame.method, (frame.params ?? {}) as Record<string, unknown>);
  }

  private dispatch(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case WIRE.trackList:
        return { tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }], count: 1, bankSize: 8, itemCount: 1 };

      case WIRE.revisionGet:
        return {
          revision: this.revision,
          generation: 'stub-gen',
          sceneEpoch: 1,
          contentEpoch: 0,
          contentEvents: [],
        };

      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };

      case WIRE.cursorPointTrack:
        this.cursorOn.set(params['cursor'] as string, params['trackIndex'] as number);
        return {};

      case WIRE.deviceList: {
        const chain = this.chainOf(params['cursor'] as string);
        return {
          devices: chain.map((name, index) => ({ index, name, enabled: true })),
          count: chain.length,
          itemCount: this.itemCountOf(chain),
          trackChannelId: CHANNEL_ID,
          bankSize: 8,
        };
      }

      case WIRE.deviceInsertBitwig: {
        this.onInsert(this.chainOf(params['cursor'] as string), params['uuid'] as string);
        this.revision++;
        return {};
      }

      case WIRE.deviceInsertVst3: {
        this.onInsert(this.chainOf(params['cursor'] as string), params['vst3Id'] as string);
        this.revision++;
        return {};
      }

      case WIRE.deviceInsertClap: {
        this.onInsert(this.chainOf(params['cursor'] as string), params['clapId'] as string);
        this.revision++;
        return {};
      }

      case WIRE.deviceDelete: {
        this.chainOf(params['cursor'] as string).splice(params['deviceIndex'] as number, 1);
        this.revision++;
        return {};
      }

      case WIRE.deviceMoveTo: {
        const chain = this.chainOf(params['cursor'] as string);
        const source = chain[params['deviceIndex'] as number];
        const anchor = chain[params['anchorIndex'] as number];
        if (source === undefined || anchor === undefined) throw new Error('device move target is absent');
        chain.splice(chain.indexOf(source), 1);
        chain.splice(chain.indexOf(anchor), 0, source);
        this.revision++;
        return {};
      }

      // One request carrying a stage's frames, exactly as `encodeStage` builds it.
      case WIRE.batchRun: {
        const ops = (params['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
        for (const op of ops) this.dispatch(op.method, op.params);
        return {
          applied: true,
          revision: this.revision,
          results: ops.map((o) => ({ method: o.method, ok: true })),
        };
      }

      default:
        return {};
    }
  }

  async close(): Promise<void> {}

  /** ⚠ The chain the CURSOR is on — an unpointed cursor sees nothing. */
  private chainOf(cursor: string): string[] {
    const on = this.cursorOn.get(cursor);
    if (on === undefined) return [];
    let chain = this.chains.get(on);
    if (chain === undefined) {
      chain = [];
      this.chains.set(on, chain);
    }
    return chain;
  }
}

/** A device chain that also models the user's current clip selection. */
class SelectedDeviceChainTransport extends DeviceChainTransport {
  readonly selection = { trackIndex: 3, slotIndex: 2 };
  failDeviceList = false;

  override async send(frame: Frame): Promise<unknown> {
    const params = (frame.params ?? {}) as Record<string, unknown>;
    if (frame.method === WIRE.selectionStatus) {
      this.frames.push(frame);
      return { ...this.selection };
    }
    if (frame.method === WIRE.slotSelect) {
      this.frames.push(frame);
      this.selection.trackIndex = params['trackIndex'] as number;
      this.selection.slotIndex = params['slotIndex'] as number;
      return {};
    }
    if (frame.method === WIRE.cursorPointTrack) {
      this.selection.trackIndex = params['trackIndex'] as number;
      this.selection.slotIndex = -1;
    }
    if (frame.method === WIRE.deviceList && this.failDeviceList) {
      this.frames.push(frame);
      throw new Error('device list failed');
    }
    return super.send(frame);
  }
}

test('4g-device-selection: public chain reads and resolution restore selection', async () => {
  const wire = new SelectedDeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = deviceEnabled(deviceAt(TRACK, 0));

  await adapter.devices(TRACK);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  const snapshot = await adapter.read([address]);
  assert.equal(snapshot.entries[addressKey(address)]?.value.of, 'deviceEnabled');
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  const resolved = await adapter.resolve([address]);
  assert.equal(resolved.resolved[0]?.found, true);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });

  const restores = wire.frames.filter((frame) => frame.method === WIRE.slotSelect);
  assert.equal(restores.length, 3);
  assert.ok(restores.every((frame) => frame.params?.['trackIndex'] === 3
    && frame.params?.['slotIndex'] === 2));
});

test('4g-device-selection: a failed public chain read restores selection', async () => {
  const wire = new SelectedDeviceChainTransport();
  wire.failDeviceList = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(adapter.devices(TRACK), /device list failed/);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 1);
});

test('4g-device-selection: direct insert preflight and apply both restore selection', async () => {
  const wire = new SelectedDeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({ ops: [{
    op: 'device.insert',
    track: TRACK,
    source: { from: 'bitwig', uuid: 'Phaser' },
    expectedChain: ['Polysynth'],
    expectedEnabledChain: [true],
  }] });

  assert.deepEqual(receipt.minted[0], deviceAt(TRACK, 1));
  assert.deepEqual(wire.chains.get(0), ['Polysynth', 'Phaser']);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 2);
});

test('4g-device-selection: a failed direct insert proof restores selection', async () => {
  const wire = new SelectedDeviceChainTransport((chain, name) => chain.unshift(name));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({ ops: [{
    op: 'device.insert',
    track: TRACK,
    source: { from: 'bitwig', uuid: 'Phaser' },
    expectedChain: ['Polysynth'],
    expectedEnabledChain: [true],
  }] });

  assert.equal(receipt.stages.flatMap((stage) => stage.ops).every((op) => op.ok), false);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 2);
});

test('4g-device-selection: direct relocation preflight and apply both restore selection', async () => {
  const wire = new SelectedDeviceChainTransport();
  wire.chains.set(0, ['Polysynth', 'Phaser']);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({ ops: [{
    op: 'device.relocate',
    track: TRACK,
    sourceFromEnd: 0,
    expectedName: 'Phaser',
    before: deviceAt(TRACK, 0),
    expectedChain: ['Polysynth', 'Phaser'],
    expectedEnabledChain: [true, true],
  }] });

  assert.equal(receipt.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  assert.deepEqual(wire.chains.get(0), ['Phaser', 'Polysynth']);
  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 2);
});

test('4g-device-selection: a failed direct relocation guard restores selection', async () => {
  const wire = new SelectedDeviceChainTransport();
  wire.chains.set(0, ['Polysynth', 'Phaser']);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(adapter.apply({ ops: [{
    op: 'device.relocate',
    track: TRACK,
    sourceFromEnd: 0,
    expectedName: 'Phaser',
    before: deviceAt(TRACK, 0),
    expectedChain: ['Wrong device', 'Phaser'],
    expectedEnabledChain: [true, true],
  }] }), /top-level device chain changed/);

  assert.deepEqual(wire.selection, { trackIndex: 3, slotIndex: 2 });
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.slotSelect).length, 2);
});

/** One top-level device with an independently observed enabled flag. */
class DeviceEnabledTransport implements Transport {
  readonly frames: Frame[] = [];
  enabled = true;
  otherEnabled = true;
  takeWrites = true;
  private readonly cursorOn = new Map<string, number>();
  private revision = 1;

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.dispatch(frame.method, (frame.params ?? {}) as Record<string, unknown>);
  }

  private dispatch(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case WIRE.trackList:
        return {
          tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }],
          count: 1,
          bankSize: 8,
          itemCount: 1,
        };
      case WIRE.revisionGet:
        return {
          revision: this.revision,
          generation: 'enabled-gen',
          sceneEpoch: 1,
          contentEpoch: 0,
          contentEvents: [],
        };
      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };
      case WIRE.cursorPointTrack:
        this.cursorOn.set(params['cursor'] as string, params['trackIndex'] as number);
        return {};
      case WIRE.deviceList: {
        const visible = this.cursorOn.get(params['cursor'] as string) === 0;
        const devices = visible
          ? [
            { index: 0, name: 'Tool', enabled: this.enabled },
            { index: 1, name: 'Delay+', enabled: this.otherEnabled },
          ]
          : [];
        return {
          devices,
          count: devices.length,
          itemCount: devices.length,
          trackChannelId: visible ? CHANNEL_ID : undefined,
          bankSize: 8,
        };
      }
      case WIRE.deviceSetEnabled: {
        assert.equal(params['expectedTrackChannelId'], CHANNEL_ID);
        const names = ['Tool', 'Delay+'];
        const enabled = [this.enabled, this.otherEnabled];
        if (params['expectedDeviceNames'] !== undefined) {
          assert.deepEqual(params['expectedDeviceNames'], names);
        }
        if (params['expectedDeviceEnabled'] !== undefined
            && JSON.stringify(params['expectedDeviceEnabled']) !== JSON.stringify(enabled)) {
          throw new Error('device.setEnabled device enabled chain changed');
        }
        const index = params['deviceIndex'] as number;
        assert.equal(params['expectedName'], names[index]);
        if (params['expectedEnabled'] !== enabled[index]) {
          throw new Error(`device.setEnabled state changed from ${String(params['expectedEnabled'])} to ${String(enabled[index])}`);
        }
        if (this.takeWrites) {
          if (index === 0) this.enabled = params['enabled'] as boolean;
          else this.otherEnabled = params['enabled'] as boolean;
        }
        this.revision++;
        return {};
      }
      case WIRE.batchRun: {
        const ops = (params['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
        for (const op of ops) this.dispatch(op.method, op.params);
        return {
          applied: true,
          revision: this.revision,
          results: ops.map((op) => ({ method: op.method, ok: true })),
        };
      }
      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

test('4g-device-enabled: live write uses independent readback and restores the base', async () => {
  const wire = new DeviceEnabledTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const target = deviceAt(TRACK, 0);
  const address = deviceEnabled(target);

  const before = await adapter.read([address]);
  const beforeEntry = before.entries[addressKey(address)];
  assert.equal(beforeEntry?.value.of === 'deviceEnabled' ? beforeEntry.value.enabled : undefined, true);

  const changed = await adapter.apply({ ops: [{
    op: 'device.setEnabled', device: target, enabled: false, expectedName: 'Tool',
  }] });
  assert.equal(changed.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const after = await adapter.read([address]);
  const afterEntry = after.entries[addressKey(address)];
  assert.equal(afterEntry?.value.of === 'deviceEnabled' ? afterEntry.value.enabled : undefined, false);

  const restored = await adapter.apply({ ops: [{
    op: 'device.setEnabled', device: target, enabled: true, expectedName: 'Tool',
  }] });
  assert.equal(restored.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const final = await adapter.read([address]);
  const finalEntry = final.entries[addressKey(address)];
  assert.equal(finalEntry?.value.of === 'deviceEnabled' ? finalEntry.value.enabled : undefined, true);
  assert.ok(wire.frames.filter((frame) => frame.method === WIRE.deviceList).length >= 5,
    'each write uses a fresh before and after observation');
});

test('4g-device-enabled: a silent live no-op fails independent readback', async () => {
  const wire = new DeviceEnabledTransport();
  wire.takeWrites = false;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const receipt = await adapter.apply({ ops: [{
    op: 'device.setEnabled', device: deviceAt(TRACK, 0), enabled: false, expectedName: 'Tool',
  }] });

  const failed = receipt.stages.flatMap((stage) => stage.ops).find((op) => !op.ok);
  assert.match(failed?.error ?? '', /readback disagreed/);
  const address = deviceEnabled(deviceAt(TRACK, 0));
  const unchanged = await adapter.read([address]);
  const unchangedEntry = unchanged.entries[addressKey(address)];
  assert.equal(unchangedEntry?.value.of === 'deviceEnabled'
    ? unchangedEntry.value.enabled : undefined, true);
});

test('4g-device-enabled: caller-owned prior state reaches the immediate wire guard', async () => {
  const wire = new DeviceEnabledTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  wire.enabled = false;

  await assert.rejects(
    adapter.apply({ ops: [{
      op: 'device.setEnabled',
      device: deviceAt(TRACK, 0),
      enabled: true,
      expectedName: 'Tool',
      expectedEnabled: true,
      expectedChain: ['Tool', 'Delay+'],
    }] }),
    /device\.setEnabled state changed from true to false/,
  );
  assert.equal(wire.enabled, false);
  const batch = wire.frames.find((frame) => frame.method === WIRE.batchRun);
  const ops = (batch?.params?.['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
  const frame = ops.find((op) => op.method === WIRE.deviceSetEnabled);
  assert.equal(frame?.params['expectedEnabled'], true);
});

test('4g-device-enabled: a raw unrelated toggle fails the full enabled fingerprint', async () => {
  const wire = new DeviceEnabledTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  wire.otherEnabled = false;

  await assert.rejects(
    adapter.apply({ ops: [{
      op: 'device.setEnabled',
      device: deviceAt(TRACK, 0),
      enabled: false,
      expectedName: 'Tool',
      expectedEnabled: true,
      expectedChain: ['Tool', 'Delay+'],
      expectedEnabledChain: [true, true],
    }] }),
    /top-level device enabled chain changed/,
  );
  assert.equal(wire.enabled, true);
  assert.equal(wire.otherEnabled, false);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

test('L-mint: an insert reports the chain index it OBSERVED, and the delete undoes it', async () => {
  const wire = new DeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  // The fixture chain already held one device, so the insert landed at 1 — read
  // off the chain, not counted from the request.
  assert.deepEqual(receipt.minted[0], { kind: 'device', track: TRACK, chainIndex: 1 });
  assert.deepEqual(wire.chains.get(0), ['Polysynth', 'Phaser']);

  // ⚠ And the inverse actually reaches that chain, which is the half the old
  // encoding got wrong: `device.delete` addressed a bank row as a pool cursor.
  await adapter.apply({ ops: [{ op: 'device.delete', device: { kind: 'device', track: TRACK, chainIndex: 1 } }] });
  assert.deepEqual(wire.chains.get(0), ['Polysynth'], 'the chain is back where it started');
});

test('L-mint: a chain that did not change the way an append changes it mints NOTHING', async () => {
  // ⚠ Failing CLOSED is the whole design. The index a mint reports is the index a
  // revert DELETES, so an unexplained chain is reported as un-undoable rather
  // than guessed at (D20, E2c). Here the insert lands at the FRONT, which no
  // handler does today — the diff cannot tell which of the two entries is new,
  // and says so by declining.
  const wire = new DeviceChainTransport((chain, name) => chain.unshift(name));
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  assert.deepEqual(receipt.minted, {}, 'the prefix moved, so the observation is not an append');
  assert.equal(receipt.stages.flatMap((stage) => stage.ops)
    .find((op) => op.op === WIRE.deviceInsertBitwig)?.ok, false);
  assert.deepEqual(wire.chains.get(0), ['Phaser', 'Polysynth'], 'the device is really there');
});

test('L-mint: a chain longer than the device bank window mints NOTHING (E5, one level down)', async () => {
  // Looking is allowed; concluding from a half-view is not. `deviceList` walks
  // `rig.config.deviceBank` slots while `itemCount` is the chain's true length, so
  // a diff over a partial view cannot tell an insert from something scrolling in.
  const wire = new DeviceChainTransport(undefined, (chain) => chain.length + 4);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  }), /complete top-level device chain/);
  assert.deepEqual(wire.chains.get(0), ['Polysynth'], 'the refusal happens before insertion');
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

test('4e-mint: a missing plugin has no mint and a failed insertion receipt', async () => {
  const wire = new DeviceChainTransport(() => {});
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{
      op: 'device.insert', track: TRACK,
      source: { from: 'clap', id: 'com.ghostnote.missing' },
    }],
  });

  assert.deepEqual(receipt.minted, {});
  const insert = receipt.stages.flatMap((stage) => stage.ops)
    .find((op) => op.op === WIRE.deviceInsertClap);
  assert.equal(insert?.ok, false);
  assert.match(insert?.error ?? '', /not proved by structural readback/);
});

test('L-mint: the insert is addressed to a POINTED cursor, not to a bank row', async () => {
  // The defect underneath the missing mint. Every device handler resolves
  // `rig.cursorTrack(ref)` by POOL index, so an op that names a bank row reaches
  // whichever cursor shares that number — and reports `ok` while doing it.
  const wire = new DeviceChainTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await adapter.apply({
    ops: [{ op: 'device.insert', track: TRACK, source: { from: 'bitwig', uuid: 'Phaser' } }],
  });

  // The stage's frames travel INSIDE one `batch.run`, which is where "point, then
  // act, in the same request" has to be true — a point in an earlier request is a
  // different turn and proves nothing about what the insert reached.
  const batch = wire.frames.find((f) => f.method === WIRE.batchRun);
  const ops = ((batch?.params as Record<string, unknown> | undefined)?.['ops'] ?? []) as
    { method: string; params: Record<string, unknown> }[];

  const insertAt = ops.findIndex((o) => o.method === WIRE.deviceInsertBitwig);
  const cursor = ops[insertAt]?.params['cursor'];
  assert.equal(typeof cursor, 'string', 'the insert names a CURSOR, never a trackIndex');
  assert.equal(ops[insertAt]?.params['trackIndex'], undefined, 'and carries no trackIndex to be mistaken for one');

  const point = ops[insertAt - 1];
  assert.equal(point?.method, WIRE.cursorPointTrack, 'the point is immediately in front of the op');
  assert.equal(point?.params['cursor'], cursor);
  assert.equal(point?.params['trackIndex'], 0, 'pointed at the track the op NAMED');
});

// --- chain observation: the wire mapping, and what it refuses ------------------

/**
 * A `chain.inventory`-shaped stub, and — like `CursorModelTransport` — it answers
 * from the track CURSOR 0 IS ON rather than from the track the adapter asked
 * about. A stub that echoed the request back could not fail for the bug the
 * identity guard exists to catch: an inventory of somebody else's container,
 * reported under this address, with every field looking healthy.
 */
class InventoryTransport implements Transport {
  readonly frames: Frame[] = [];
  /** Which track cursor 0 is pointed at, by bank index. Nothing points it at first. */
  private pointed: number | undefined;
  private selectedDevice = 0;
  private directGeneration = 0;
  private devicePinned = false;
  private trackPinned = false;

  constructor(
    /** bank index -> that track's channelId. */
    private readonly tracks: ReadonlyMap<number, string>,
    /** channelId -> scopes, exactly as the extension would report them. */
    private readonly inventory: ReadonlyMap<string, unknown[]>,
    /** ⚠ An extension too old to send the identity and the bank sizes. */
    private readonly stale = false,
    /**
     * ⚠ A cursor that DOES NOT MOVE when pointed — the failure the identity
     * guard exists for. It is not hypothetical: `cursor.pointTrack` is
     * `CursorTrack.selectChannel`, and a bank row that is not what the adapter
     * thinks it is (a re-index, a stale scan) points it somewhere else while
     * every call still succeeds.
     */
    private readonly stuckOn?: number,
  ) {
    this.pointed = stuckOn;
  }

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const params = (frame.params ?? {}) as Record<string, unknown>;
    switch (frame.method) {
      case WIRE.trackList:
        return {
          tracks: [...this.tracks].map(([index, channelId]) => ({ index, channelId, name: `t${index}` })),
          count: this.tracks.size, bankSize: 8, itemCount: this.tracks.size,
        };
      case WIRE.revisionGet:
        return { revision: 1, generation: 'stub-gen', sceneEpoch: 1, contentEpoch: 0, contentEvents: [] };
      case WIRE.cursorPointTrack:
        if (params['cursor'] === '0' && this.stuckOn === undefined) {
          this.pointed = params['trackIndex'] as number;
        }
        return {};
      case WIRE.cursorPinTrack:
        this.trackPinned = params['pinned'] === true;
        return {};
      case WIRE.deviceCursorPin:
        this.devicePinned = params['pinned'] === true;
        return {};
      case WIRE.deviceCursorSelectAt:
        this.selectedDevice = params['deviceIndex'] as number;
        return {};
      case WIRE.deviceList: {
        const on = this.pointed === undefined ? undefined : this.tracks.get(this.pointed);
        const scopes = (on === undefined ? undefined : this.inventory.get(on)) ?? [];
        const devices = (scopes as { slot: number; deviceExists?: boolean; deviceName?: string }[])
          .filter((scope) => scope.deviceExists === true)
          .map((scope) => ({ index: scope.slot, name: scope.deviceName ?? '' }));
        return { devices, count: devices.length, itemCount: devices.length, trackChannelId: on };
      }
      case WIRE.deviceCursorStatus: {
        const on = this.pointed === undefined ? undefined : this.tracks.get(this.pointed);
        const scopes = (on === undefined ? undefined : this.inventory.get(on)) ?? [];
        const scope = (scopes as { slot: number; deviceExists?: boolean; deviceName?: string }[])
          .find((item) => item.slot === this.selectedDevice);
        return {
          exists: scope?.deviceExists === true,
          name: scope?.deviceName,
          isPinned: this.devicePinned,
          deviceIndex: this.selectedDevice,
          trackChannelId: on,
          trackPosition: this.pointed,
          cursorTrackPinned: this.trackPinned,
        };
      }
      case WIRE.directParamList: {
        if (params['begin'] === true) this.directGeneration++;
        const on = this.pointed === undefined ? undefined : this.tracks.get(this.pointed);
        const scopes = (on === undefined ? undefined : this.inventory.get(on)) ?? [];
        const scope = (scopes as { slot: number; deviceExists?: boolean; deviceName?: string }[])
          .find((item) => item.slot === this.selectedDevice);
        return {
          params: [],
          count: 0,
          generation: this.directGeneration,
          idsGeneration: this.directGeneration,
          deviceExists: scope?.deviceExists === true,
          deviceName: scope?.deviceName,
          deviceIndex: this.selectedDevice,
          trackChannelId: on,
          trackPosition: this.pointed,
          observedTrackChannelId: on,
          observedDeviceName: scope?.deviceName,
          observedDeviceIndex: this.selectedDevice,
        };
      }
      case WIRE.paramList:
        return { params: [] };
      case WIRE.chainInventory: {
        const on = this.pointed === undefined ? undefined : this.tracks.get(this.pointed);
        const scopes = (on === undefined ? undefined : this.inventory.get(on)) ?? [];
        const stripped = this.stale
          ? (scopes as Record<string, unknown>[]).map(({ chainBankSize, deviceBankSize, ...rest }) => rest)
          : scopes;
        return this.stale
          ? { scopes: stripped, trackName: 'whoever' }
          : { scopes: stripped, trackName: 'whoever', trackChannelId: on };
      }
      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

/** A two-device DirectParameter model with one serialized cursor. */
class ParameterTransport implements Transport {
  readonly frames: Frame[] = [];
  readonly devices: { name: string; params: Map<string, { name: string; value: number }> }[] = [
    {
      name: 'Polysynth',
      params: new Map(Array.from({ length: 12 }, (_, index) =>
        [`P${index + 1}`, { name: `Poly ${index + 1}`, value: index / 12 }] as const)),
    },
    {
      name: 'Polymer',
      params: new Map(Array.from({ length: 10 }, (_, index) =>
        [`M${index + 1}`, { name: `Polymer ${index + 1}`, value: (index + 1) / 12 }] as const)),
    },
  ];
  takeWrites = true;
  neverSettles = false;
  changeSelectionBeforeWrite = false;
  layerWindowOverflow = false;
  remoteNeverCurrent = false;
  malformedRemoteControl = false;
  private selected = 0;
  private depth = 0;
  private padSelected = false;
  private readonly deepParams = new Map([['DP1', { name: 'Deep parameter', value: 0.2 }]]);
  private readonly padParams = new Map([['PAD1', { name: 'Pad parameter', value: 0.35 }]]);
  private selectedRemotePage = 0;
  private readonly remotePages = [
    { name: 'Filter', controls: [{ name: 'Cutoff', value: 0.25, modulatedValue: 0.4 }] },
    { name: 'Mod', controls: [{ name: 'Amount', value: 0.5, modulatedValue: 0.5 }] },
  ];
  private generation = 0;
  private remoteGeneration = 0;
  private devicePinned = false;
  private trackPinned = false;
  private revision = 1;

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    const params = (frame.params ?? {}) as Record<string, unknown>;
    switch (frame.method) {
      case WIRE.trackList:
        return { tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }], count: 1,
          bankSize: 8, itemCount: 1 };
      case WIRE.revisionGet:
        return { revision: this.revision, generation: 'param-gen', project: 'param-project',
          sceneEpoch: 1, contentEpoch: 0, sceneCount: 8, contentEvents: [] };
      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };
      case WIRE.slotSelect:
      case WIRE.cursorPointTrack:
        return {};
      case WIRE.cursorPinTrack:
        this.trackPinned = params['pinned'] === true;
        return {};
      case WIRE.deviceCursorPin:
        this.devicePinned = params['pinned'] === true;
        return {};
      case WIRE.deviceCursorSelectAt:
        this.selected = params['deviceIndex'] as number;
        this.depth = 0;
        this.padSelected = false;
        return {};
      case WIRE.deviceCursorSelectInLayer:
        this.depth++;
        this.padSelected = false;
        return {};
      case WIRE.deviceCursorSelectFirstInPad:
        this.depth = 1;
        this.padSelected = true;
        return {};
      case WIRE.deviceList:
        return {
          devices: this.devices.map((device, index) => ({ index, name: device.name, enabled: true })),
          count: this.devices.length,
          itemCount: this.devices.length,
          trackChannelId: CHANNEL_ID,
          bankSize: 16,
        };
      case WIRE.deviceCursorStatus:
        if (this.depth > 0) {
          return {
            exists: true,
            name: this.padSelected ? 'Pad synth'
              : this.depth === 1 ? 'Inner container' : 'Deep synth',
            isPinned: this.devicePinned,
            deviceIndex: 0,
            trackChannelId: CHANNEL_ID,
            trackPosition: 0,
            cursorTrackPinned: this.trackPinned,
            isNested: true,
          };
        }
        return {
          exists: this.devices[this.selected] !== undefined,
          name: this.devices[this.selected]?.name,
          isPinned: this.devicePinned,
          deviceIndex: this.selected,
          trackChannelId: CHANNEL_ID,
          trackPosition: 0,
          cursorTrackPinned: this.trackPinned,
          isNested: false,
        };
      case WIRE.layerList: {
        const result = this.depth === 0
          ? {
            layers: [{
              index: 0, name: 'Outer', deviceCount: 1,
              devices: [{ index: 0, name: 'Inner container' }],
            }],
            itemCount: 1, bankSize: 8, deviceBankSize: 4, hasLayers: true,
          }
          : this.depth === 1
            ? {
              layers: [{
                index: 0, name: 'Inner', deviceCount: 1,
                devices: [{ index: 0, name: 'Deep synth' }],
              }],
              itemCount: 1, bankSize: 8, deviceBankSize: 4, hasLayers: true,
            }
            : { layers: [], itemCount: 0, bankSize: 8, deviceBankSize: 4, hasLayers: false };
        return this.layerWindowOverflow && this.depth === 0
          ? { ...result, itemCount: 9, bankSize: 8 }
          : result;
      }
      case WIRE.drumPadList:
        return {
          pads: [{ index: 3, name: 'Pad 4' }], itemCount: 1, bankSize: 16, hasDrumPads: true,
        };
      case WIRE.directParamList: {
        if (params['begin'] === true) this.generation++;
        const device = this.padSelected
          ? { name: 'Pad synth', params: this.padParams }
          : this.depth === 2
          ? { name: 'Deep synth', params: this.deepParams }
          : this.devices[this.selected];
        return {
          params: [...(device?.params ?? [])].map(([id, state]) => ({ id, ...state })),
          count: device?.params.size ?? 0,
          generation: this.generation,
          idsGeneration: this.neverSettles ? this.generation - 1 : this.generation,
          deviceExists: device !== undefined,
          deviceName: device?.name,
          deviceIndex: this.depth === 0 ? this.selected : -1,
          trackChannelId: CHANNEL_ID,
          trackPosition: 0,
          observedTrackChannelId: CHANNEL_ID,
          observedDeviceName: device?.name,
          observedDeviceIndex: this.depth === 0 ? this.selected : -1,
        };
      }
      case WIRE.paramList:
        return { params: [] };
      case WIRE.directParamSet: {
        const target = (this.padSelected ? this.padParams
          : this.depth === 2 ? this.deepParams : this.devices[this.selected]?.params)
          ?.get(params['id'] as string);
        if (target !== undefined && this.takeWrites) target.value = params['value'] as number;
        return {};
      }
      case WIRE.remoteSelectPage:
        this.selectedRemotePage = params['index'] as number;
        return {};
      case WIRE.remoteList: {
        if (params['begin'] === true) this.remoteGeneration++;
        const page = this.remotePages[this.selectedRemotePage];
        const deviceName = this.depth === 1 ? 'Inner container'
          : this.depth === 2 ? 'Deep synth' : this.devices[this.selected]?.name;
        return {
          remotes: Array.from({ length: 8 }, (_, index) => {
            const control = page?.controls[index];
            return control === undefined
              ? { index, exists: false }
              : {
                index, exists: true,
                ...(this.malformedRemoteControl ? {} : { name: control.name }),
                value: control.value,
                modulatedValue: control.modulatedValue, isBeingMapped: false,
                hasAutomation: false,
              };
          }),
          existing: page?.controls.length ?? 0,
          bankSize: 8,
          pageCount: this.remotePages.length,
          selectedPageIndex: this.selectedRemotePage,
          selectedPageName: page?.name,
          pageNames: this.remotePages.map((item) => item.name),
          deviceExists: true,
          deviceName,
          isNested: this.depth > 0,
          generation: this.remoteGeneration,
          observedGeneration: this.remoteNeverCurrent
            ? this.remoteGeneration - 1 : this.remoteGeneration,
          observedTrackChannelId: CHANNEL_ID,
          observedDeviceName: deviceName,
          observedDeviceIndex: this.depth === 0 ? this.selected : 0,
        };
      }
      case WIRE.remoteSet: {
        const control = this.remotePages[this.selectedRemotePage]?.controls[params['index'] as number];
        if (control !== undefined && this.takeWrites) control.value = params['value'] as number;
        return {};
      }
      case WIRE.batchRun: {
        const ops = (params['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
        if (this.changeSelectionBeforeWrite && (!this.devicePinned || !this.trackPinned)) {
          this.selected = 1;
          this.depth = 0;
          this.padSelected = false;
        }
        for (const op of ops) await this.send({ method: op.method, params: op.params });
        this.revision++;
        return { applied: true, revision: this.revision,
          results: ops.map((op) => ({ method: op.method, ok: true })) };
      }
      case WIRE.chainInventory:
        return { trackChannelId: CHANNEL_ID, scopes: [] };
      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

const CONTAINER_SCOPE = (chains: { index: number; name: string; devices?: { index: number; name: string }[] }[]) => ({
  slot: 0,
  status: 'held',
  deviceExists: true,
  deviceName: 'FX Layer',
  chains: chains.map((c) => ({ ...c, devices: c.devices ?? [] })),
  chainCount: chains.length,
  chainBankSize: 4,
  deviceBankSize: 4,
});

const OTHER_ID = 'e4a1c0de-0000-4000-8000-000000000002';

test('L-direct-param: stable inventories do not retain the prior device values', async () => {
  const wire = new ParameterTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const first = deviceAt(TRACK, 0);
  const second = deviceAt(TRACK, 1);
  const snapshot = await adapter.read([first, second]);
  const one = snapshot.entries[addressKey(first)];
  const two = snapshot.entries[addressKey(second)];
  const oneParams = one?.value.of === 'device' ? one.value.device.params : undefined;
  const twoParams = two?.value.of === 'device' ? two.value.device.params : undefined;
  assert.equal(oneParams?.length, 12);
  assert.equal(twoParams?.length, 10);
  assert.equal(twoParams?.some((item) => item.id.startsWith('P')), false);
  assert.equal(oneParams?.every((item) => item.observed.modulatedValue === false), true);
});

test('L-direct-param: a write reads back independently and exact reversal restores the base', async () => {
  const wire = new ParameterTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = param(deviceAt(TRACK, 0), 'P1');
  const before = await adapter.read([address]);
  const captured = before.entries[addressKey(address)];
  assert.equal(captured?.value.of === 'param' ? captured.value.param.value : undefined, 0);

  const changed = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.75 }] });
  assert.equal(changed.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const restored = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0 }] });
  assert.equal(restored.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const after = await adapter.read([address]);
  const afterEntry = after.entries[addressKey(address)];
  assert.equal(afterEntry?.value.of === 'param' ? afterEntry.value.param.value : undefined, 0);
});

test('4g parameter guard refuses a raw positional shift before the wire write', async () => {
  const wire = new ParameterTransport();
  const expectedChain = wire.devices.map((item) => item.name);
  wire.devices.unshift({
    name: 'Human replacement',
    params: new Map([['P1', { name: 'Wrong P1', value: 0.4 }]]),
  });
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = param(deviceAt(TRACK, 0), 'P1');

  await assert.rejects(adapter.apply({ ops: [{
    op: 'param.set',
    param: address,
    value: 0.75,
    expectedName: 'Polysynth',
    expectedChain,
  }] }), /top-level device chain changed/);
  assert.equal(wire.devices[0]!.params.get('P1')!.value, 0.4);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.batchRun), false);
});

test('L-direct-param: a silent no-op is reported as a readback disagreement', async () => {
  const wire = new ParameterTransport();
  wire.takeWrites = false;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = param(deviceAt(TRACK, 0), 'P1');
  const receipt = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.75 }] });
  const failed = receipt.stages.flatMap((stage) => stage.ops).find((op) => !op.ok);
  assert.match(failed?.error ?? '', /readback disagreed/);
});

test('L-direct-param: an observer generation that never settles is separate from missing', async () => {
  const wire = new ParameterTransport();
  wire.neverSettles = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const target = deviceAt(TRACK, 0);
  const deviceSnapshot = await adapter.read([target]);
  const deviceEntry = deviceSnapshot.entries[addressKey(target)];
  assert.equal(deviceEntry?.value.of === 'device' ? deviceEntry.value.device.name : undefined,
    'Polysynth');
  assert.equal(deviceEntry?.value.of === 'device' ? deviceEntry.value.device.params : undefined,
    undefined);
  assert.deepEqual(deviceSnapshot.unstable, []);

  const address = param(target, 'P1');
  const snapshot = await adapter.read([address]);
  assert.deepEqual(snapshot.unstable.map(addressKey), [addressKey(address)]);
  assert.deepEqual(snapshot.missing, []);
});

test('4f live route: depth-2 DirectParameter write uses two confirmed named descents', async () => {
  const wire = new ParameterTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const outer = chainAt(deviceAt(TRACK, 0), 'Outer');
  const inner = chainAt(deviceInAt(outer, 0), 'Inner');
  const address = param(deviceInAt(inner, 0), 'DP1');

  const before = await adapter.read([address.device, address]);
  const deviceEntry = before.entries[addressKey(address.device)];
  const beforeEntry = before.entries[addressKey(address)];
  assert.equal(deviceEntry?.value.of === 'device' ? deviceEntry.value.device.params?.length : undefined, 1);
  assert.equal(beforeEntry?.value.of === 'param' ? beforeEntry.value.param.value : undefined, 0.2);
  const receipt = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.8 }] });
  assert.equal(receipt.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const restored = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.2 }] });
  assert.equal(restored.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  assert.equal(wire.frames.filter((frame) => frame.method === WIRE.deviceCursorSelectInLayer).length >= 4, true);
  assert.equal(wire.frames.some((frame) => frame.method === 'devcursor.selectFirstInKeyPad'), false);
});

test('4f live route: a selection change cannot retarget a pinned depth-2 write', async () => {
  const wire = new ParameterTransport();
  wire.changeSelectionBeforeWrite = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const outer = chainAt(deviceAt(TRACK, 0), 'Outer');
  const inner = chainAt(deviceInAt(outer, 0), 'Inner');
  const address = param(deviceInAt(inner, 0), 'DP1');

  const changed = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.7 }] });
  assert.equal(changed.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.cursorPinTrack
    && (frame.params as Record<string, unknown>)['pinned'] === true), true);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.deviceCursorPin
    && (frame.params as Record<string, unknown>)['pinned'] === true), true);
  const restored = await adapter.apply({ ops: [{ op: 'param.set', param: address, value: 0.2 }] });
  assert.equal(restored.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
});

test('4f live route: a matching name in an incomplete layer window stays unreachable', async () => {
  const wire = new ParameterTransport();
  wire.layerWindowOverflow = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const outer = chainAt(deviceAt(TRACK, 0), 'Outer');
  const address = param(deviceInAt(outer, 0), 'DP1');
  const snapshot = await adapter.read([address]);
  assert.deepEqual(snapshot.unreachable.map(addressKey), [addressKey(address)]);
  assert.deepEqual(snapshot.missing, []);
});

test('4f live route: remote pages settle twice and one control restores exactly', async () => {
  const wire = new ParameterTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const device = deviceAt(TRACK, 0);
  const inventoryAddress = remotes(device);
  const address = remote(device, 0, 'Filter', 0, 'Cutoff');
  const inventory = await adapter.read([inventoryAddress, address]);
  const pages = inventory.entries[addressKey(inventoryAddress)];
  assert.deepEqual(
    pages?.value.of === 'remotes' ? pages.value.remotes.pages.map((page) => page.name) : undefined,
    ['Filter', 'Mod'],
  );
  const changed = await adapter.apply({ ops: [{ op: 'remote.set', remote: address, value: 0.75 }] });
  assert.equal(changed.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const restored = await adapter.apply({ ops: [{ op: 'remote.set', remote: address, value: 0.25 }] });
  assert.equal(restored.stages.flatMap((stage) => stage.ops).every((op) => op.ok), true);
  const after = await adapter.read([address]);
  const afterEntry = after.entries[addressKey(address)];
  assert.equal(afterEntry?.value.of === 'remote' ? afterEntry.value.remote.value : undefined, 0.25);
});

test('4f repair: a remote inventory from an earlier target generation stays unstable', async () => {
  const wire = new ParameterTransport();
  wire.remoteNeverCurrent = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = remotes(deviceAt(TRACK, 0));

  const snapshot = await adapter.read([address]);

  assert.deepEqual(snapshot.unstable.map(addressKey), [addressKey(address)]);
  assert.equal(snapshot.entries[addressKey(address)], undefined);
});

test('4f repair: a malformed existing remote control cannot settle as complete', async () => {
  const wire = new ParameterTransport();
  wire.malformedRemoteControl = true;
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = remotes(deviceAt(TRACK, 0));

  const snapshot = await adapter.read([address]);

  assert.deepEqual(snapshot.unstable.map(addressKey), [addressKey(address)]);
  assert.equal(snapshot.entries[addressKey(address)], undefined);
});

test('4f live route: a drum-pad channel uses selectFirstInChannel semantics', async () => {
  const wire = new ParameterTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });
  const address = param(deviceInAt(drumPad(deviceAt(TRACK, 0), 3), 0), 'PAD1');
  const snapshot = await adapter.read([address]);
  const entry = snapshot.entries[addressKey(address)];
  assert.equal(entry?.value.of === 'param' ? entry.value.param.value : undefined, 0.35);
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.deviceCursorSelectFirstInPad), true);
  assert.equal(wire.frames.some((frame) => frame.method === 'devcursor.selectFirstInKeyPad'), false);
});

test('L-chain: a chain resolves by name, at the bank position the container reported', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 2, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const target = chainAt(deviceAt(TRACK, 0), 'A take');
  const hit = (await adapter.resolve([target])).resolved[0];

  assert.equal(hit?.found, true);
  assert.equal(hit?.index, 2, 'the BANK position, not the position in the reply array');
  // ⚠ And it pointed cursor 0 specifically: the slot scopes were built from
  // `cursorDeviceBanks[0]` at init and follow that one cursor. A pool ref would
  // scope the read to whatever track that cursor happened to hold.
  const point = wire.frames.find((f) => f.method === WIRE.cursorPointTrack);
  assert.equal((point?.params as Record<string, unknown>)['cursor'], '0');
});

test('L-chain: an inventory of ANOTHER track is refused, not reported under this address', async () => {
  // ⚠⚠ The e16o trap, one level up, and the reason a name is not enough here.
  // The cursor stays on track 1, so the reply is about a DIFFERENT container —
  // well-formed, healthy, and describing somebody else's chains. Under this
  // address it would be a chain that resolves to the wrong object, which is the
  // whole failure class the nested seam exists to prevent.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID], [1, OTHER_ID]]),
    new Map([[OTHER_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    false,
    1,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  // ⚠ `unsupported`: nothing about the addressed container was observed at all.
  // `absent` would be a claim about a container we never looked into.
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: an extension too old to report the bank sizes never answers `absent`', async () => {
  // ⚠ `methodsHash` is over method NAMES, so a deployment that predates these
  // reply fields answers the completeness question with silence — and silence
  // must fail closed. Every zero-match becomes a window answer instead of a
  // tombstone, which is the difference between "we could not see it" and "it is
  // not there".
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    true,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'nope')])).resolved[0];
  // ⚠ `unsupported` and not `absent`: without `trackChannelId` the observation
  // cannot even be attributed to the right track, so it is refused whole.
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: a scope whose handle was never built is unsupported, never absent', async () => {
  // Standing rule 13, as instrumentation: "the handle does not exist" and "the
  // API declines" are indistinguishable in the outcome, and three false ○s in
  // E17 came from exactly that.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [{ ...CONTAINER_SCOPE([]), status: 'failed: NoSuchMethod' }]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'unsupported' });
});

test('L-chain: a duplicated NAME refuses as ambiguous rather than taking the first', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take' },
      { index: 1, name: 'A take' },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.deepEqual({ found: hit?.found, reason: hit?.reason }, { found: false, reason: 'ambiguous' });
});

test('L-chain: a container read carries the chains — the only way a name is ever learned', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take', devices: [{ index: 0, name: 'Polysynth' }] },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const snapshot = await adapter.read([deviceAt(TRACK, 0)]);
  const entry = snapshot.entries[addressKey(deviceAt(TRACK, 0))];
  assert.equal(entry?.value.of, 'device');
  const observed = entry?.value.of === 'device' ? entry.value.device : undefined;
  assert.equal(observed?.container?.chains[0]?.name, 'A take');
  assert.equal(observed?.container?.chains[0]?.devices[0]?.name, 'Polysynth');
  assert.deepEqual(observed?.params, [], 'the settled DirectParameter inventory is explicit');
});

test('L-chain: an inventory still naming the PREVIOUS track is retried, not reported as a miss', async () => {
  // ⚠⚠ Measured 2026-08-15: `chain.inventory` follows a re-pointed cursor at a
  // structural pace, not a cursor-point one — it named the track just pointed at
  // 0/6 immediately, 3/6 at the 25ms `cursorPoint` budget this read was
  // borrowing, and 6/6 only from 100ms. So the identity guard was firing on
  // containers that were perfectly observable a tick later, and `C-chain-switch`
  // failed two live runs in three on it. A mismatch is a staleness signal, never
  // an observation, so it is retried within a bound; every other miss still
  // answers at once because each of those IS an observation.
  class LaggingInventory extends InventoryTransport {
    private reads = 0;

    override async send(frame: Frame): Promise<unknown> {
      const reply = await super.send(frame);
      if (frame.method !== WIRE.chainInventory) return reply;
      this.reads += 1;
      // The first two reads still describe wherever the cursor used to be.
      return this.reads <= 2
        ? { ...(reply as Record<string, unknown>), trackChannelId: 'some-other-track' }
        : reply;
    }
  }
  const wire = new LaggingInventory(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const entry = (await adapter.read([deviceAt(TRACK, 0)]))
    .entries[addressKey(deviceAt(TRACK, 0))];
  const observed = entry?.value.of === 'device' ? entry.value.device : undefined;
  assert.equal(observed?.container?.chains[0]?.name, 'A take',
    'the lagging reply was waited out rather than answered as unobservable');
  // ⚠ And it re-POINTS each time rather than only re-reading: the cursor is what
  // the stale reply is stale about, so a bare re-read could wait forever.
  assert.equal(
    wire.frames.filter((f) => f.method === WIRE.cursorPointTrack).length,
    wire.frames.filter((f) => f.method === WIRE.chainInventory).length + 1,
  );
});

test('L-chain: a cursor that never arrives is still a refusal, not an endless wait', async () => {
  // The bound is what keeps the retry above from turning a real miss into a
  // hang. `stuckOn` models a point that succeeds and moves nothing.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID], [1, 'other-channel']]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
    false,
    1,
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const hit = (await adapter.resolve([chainAt(deviceAt(TRACK, 0), 'A take')])).resolved[0];
  assert.equal(hit?.found, false, 'another track\'s container is never reported under this address');
  assert.ok(wire.frames.filter((f) => f.method === WIRE.chainInventory).length <= 8);
});

test('L-chain: a device INSIDE a chain reads its own name, never the track chain\'s', async () => {
  // ⚠ The `C-nested-device` hazard, from the observation side: `chainIndex` 0
  // means two different devices depending on whether the address is nested, and
  // the track's own chain holds something at that position too.
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([
      { index: 0, name: 'A take', devices: [{ index: 0, name: 'inner-polysynth' }] },
    ])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const inner = deviceInAt(chainAt(deviceAt(TRACK, 0), 'A take'), 0);
  const snapshot = await adapter.read([inner]);
  const entry = snapshot.entries[addressKey(inner)];
  assert.equal(entry?.value.of === 'device' ? entry.value.device.name : undefined, 'inner-polysynth');
});

// --- chain creation: the first typed write inside a container ------------------

interface StubChain {
  name: string;
  channelId: string;
  solo: boolean;
}

/**
 * A container that can really be duplicated into — and, like every other stub in
 * this file, one that answers from what it ACTUALLY holds rather than from what
 * the adapter asked for.
 *
 * ⚠ Two behaviours are modelled because they are the two the create rests on,
 * and neither is a convenience:
 *
 *   - `duplicate` DOES NOTHING WITHOUT A SELECTION (`e17ak` arm A ○ against arm
 *     B ●●). A stub that copied unconditionally would pass a build that never
 *     sent `chain.select`, which is the single call the whole route turned on
 *     and which the whole spike missed for six sessions;
 *   - the copy carries the SOURCE'S NAME and a fresh `channelId`. That is what
 *     makes the container ambiguous in the middle of the verb, and it is why the
 *     rename has to be addressed by identity.
 */
class ChainCreateTransport implements Transport {
  readonly frames: Frame[] = [];
  readonly chains: StubChain[] = [{ name: 'gn-shipped', channelId: 'chain-id-1', solo: false }];
  private pointed: number | undefined;
  private selected: number | undefined;
  private revision = 1;
  private minted = 1;

  constructor(
    /** ⚠ `stale` drops the per-chain ids, as an extension too old to send them. */
    private readonly stale = false,
    /** ⚠ `deaf` accepts the duplicate and does nothing — the silent no-op class. */
    private readonly deaf = false,
    /**
     * ⚠ `refuseRename` throws from `chain.setName`, which the real extension
     * does — deliberately — when no chain in the scope carries the id, i.e.
     * when the bank re-indexed between the two readings.
     */
    private readonly refuseRename = false,
    /** Simulate an older/failed observer that cannot report exact solo state. */
    private readonly omitSolo = false,
  ) {}

  async send(frame: Frame): Promise<unknown> {
    this.frames.push(frame);
    return this.dispatch(frame.method, (frame.params ?? {}) as Record<string, unknown>);
  }

  private dispatch(method: string, params: Record<string, unknown>): unknown {
    switch (method) {
      case WIRE.trackList:
        return {
          tracks: [{ index: 0, channelId: CHANNEL_ID, name: 'gn-fixture' }],
          count: 1, bankSize: 8, itemCount: 1,
        };
      case WIRE.revisionGet:
        return {
          revision: this.revision, generation: 'stub-gen',
          sceneEpoch: 1, contentEpoch: 0, contentEvents: [],
        };
      case WIRE.selectionStatus:
        return { trackIndex: -1, slotIndex: -1 };
      case WIRE.cursorPointTrack:
        if (params['cursor'] === '0') this.pointed = params['trackIndex'] as number;
        return {};

      case WIRE.chainInventory: {
        // ⚠ Answers for the track cursor 0 is really ON, so a missing point
        // reads as a missing container rather than as the right one.
        if (this.pointed !== 0) return { scopes: [], trackName: 'nobody' };
        return {
          trackName: 'gn-fixture',
          trackChannelId: CHANNEL_ID,
          scopes: [{
            slot: 0,
            status: 'held',
            deviceExists: true,
            deviceName: 'FX Layer',
            chains: this.chains.map((c, index) => ({
              index,
              name: c.name,
              ...(this.stale ? {} : { channelId: c.channelId }),
              ...(this.omitSolo ? {} : { solo: c.solo }),
              devices: [],
            })),
            chainCount: this.chains.length,
            chainBankSize: 4,
            deviceBankSize: 4,
          }],
        };
      }

      case WIRE.chainSelect: {
        const at = params['layerIndex'] as number;
        const chain = this.chains[at];
        if (chain === undefined) throw new Error(`no chain at ${at}`);
        if (params['expectedName'] !== chain.name) throw new Error('stale position');
        this.selected = at;
        return {};
      }

      case WIRE.chainDuplicate: {
        const at = params['layerIndex'] as number;
        const source = this.chains[at];
        if (source === undefined) throw new Error(`no chain at ${at}`);
        // ⚠ `e17ak` arm A: with nothing selected this call returns cleanly and
        // does nothing at all.
        if (this.selected !== at || this.deaf) return {};
        this.chains.splice(at + 1, 0, {
          name: source.name,
          channelId: `chain-id-${++this.minted + 1}`,
          solo: source.solo,
        });
        this.revision++;
        return {};
      }

      case WIRE.chainSetName: {
        if (this.refuseRename) throw new Error('no chain in scope 0 has channelId ' + params['channelId']);
        const hit = this.chains.find((c) => c.channelId === params['channelId']);
        if (hit === undefined) throw new Error('no chain with that channelId');
        hit.name = params['name'] as string;
        this.revision++;
        return {};
      }

      case WIRE.chainActivate: {
        const at = params['layerIndex'] as number;
        const target = this.chains[at];
        if (target === undefined || target.name !== params['expectedName']) {
          throw new Error('stale activation position');
        }
        if (params['expectedTrackChannelId'] !== CHANNEL_ID) throw new Error('stale track');
        for (const [index, item] of this.chains.entries()) item.solo = index === at;
        this.revision++;
        return {};
      }

      case WIRE.batchRun: {
        const ops = (params['ops'] ?? []) as { method: string; params: Record<string, unknown> }[];
        for (const op of ops) this.dispatch(op.method, op.params);
        return {
          applied: true,
          revision: this.revision,
          results: ops.map((o) => ({ method: o.method, ok: true })),
        };
      }

      default:
        return {};
    }
  }

  async close(): Promise<void> {}
}

const SHIPPED = () => chainAt(deviceAt(TRACK, 0), 'gn-shipped');

test('L-chain-rename: the observed identity is renamed and independently resolved', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.rename', chain: SHIPPED(), name: 'gn-source' }],
  });

  assert.equal(receipt.stages[0]?.ops[0]?.ok, true);
  assert.deepEqual(wire.chains.map((item) => item.name), ['gn-source']);
  const rename = wire.frames.find((frame) => frame.method === WIRE.batchRun)
    ?.params as { ops?: { method: string; params: Record<string, unknown> }[] };
  const frame = rename.ops?.find((item) => item.method === WIRE.chainSetName);
  assert.equal(frame?.params['channelId'], 'chain-id-1');
  assert.equal(frame?.params['name'], 'gn-source');
});

test('L-chain-create: the copy is SELECTED first, then named by the id it was observed with', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  // ⚠ The mint is a NAME-shaped address, because a name is the only durable
  // thing a chain has (E17ad, E18b) — never the channelId the diff used.
  assert.deepEqual(receipt.minted[0], chainAt(deviceAt(TRACK, 0), 'gn-B'));
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-B'],
    'the source keeps its name and the copy got the new one');

  // ⚠⚠ The select is its OWN request, ahead of the batch — not a frame inside
  // it. Bundled into the duplicate's turn it would rest on a same-turn
  // visibility E2 says does not exist, and would fail as a silent no-op.
  const order = wire.frames.map((f) => f.method);
  const selectAt = order.indexOf(WIRE.chainSelect);
  const batchAt = order.findIndex((m, i) => m === WIRE.batchRun && i > selectAt);
  assert.ok(selectAt >= 0 && batchAt > selectAt, 'select comes before the batch that duplicates');
  const batch = wire.frames[batchAt]!.params as Record<string, unknown>;
  const inBatch = (batch['ops'] as { method: string }[]).map((o) => o.method);
  assert.deepEqual(inBatch, [WIRE.chainDuplicate], 'and is not repeated inside it');

  // ⚠ The rename names the CHAIN THAT WAS CREATED, by the identity the diff
  // returned — not the source, and not a position.
  const rename = wire.frames.find((f) => f.method === WIRE.chainSetName)
    ?.params as Record<string, unknown>;
  assert.equal(rename['name'], 'gn-B');
  assert.equal(rename['channelId'], wire.chains[1]!.channelId);
  assert.notEqual(rename['channelId'], 'chain-id-1', 'the SOURCE must never be the rename target');
});

test('L-chain-create: a duplicate that silently did nothing mints NOTHING and says so', async () => {
  // ⚠⚠ The failure that has to be loud. `chain.duplicate` acknowledges
  // identically whether or not anything happened (E6 blocker 4), so a receipt
  // that trusted it would report a create that produced no chain as a success.
  const wire = new ChainCreateTransport(false, true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {});
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped'], 'nothing was created');
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainSetName), false,
    'and nothing was renamed — a rename on an unidentified chain is how the source loses its name');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.equal(failed.length, 1, 'the op is reported failed even though the wire said ok');
  assert.match(failed[0]?.error ?? '', /exactly one more was expected/);
});

test('L-chain-create: an extension too old to report chain ids mints NOTHING', async () => {
  // Silence must fail closed: `methodsHash` is over method NAMES, so a
  // deployment that predates the per-chain `channelId` cannot be detected at the
  // handshake. Falling back to position would rename by guesswork.
  const wire = new ChainCreateTransport(true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {});
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-shipped'],
    '⚠ the copy is REAL and is wearing the source name — which is what the failure has to report');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.match(failed[0]?.error ?? '', /names two chains and neither resolves/);
});

test('L-chain-create: a rename the extension REFUSES is reported, never thrown', async () => {
  // ⚠⚠ The regression this row exists for. `chain.setName` refuses an id no
  // chain in the scope carries — that refusal is correct and deliberate — but by
  // the time it fires the COPY ALREADY EXISTS. An exception escaping `apply`
  // here would leave the caller with no receipt at all for a container that now
  // holds an unaddressable chain, and there is no typed delete to clean it up
  // with, so the sentence in the receipt is the entire remedy.
  const wire = new ChainCreateTransport(false, false, true);
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-B' }],
  });

  assert.deepEqual(receipt.minted, {}, 'nothing may be minted for a chain that was never named');
  const failed = receipt.stages.flatMap((s) => s.ops).filter((o) => !o.ok);
  assert.equal(failed.length, 1);
  // ⚠ The extension's own words are carried through verbatim: they are the only
  // thing that says WHY the rename was declined.
  assert.match(failed[0]?.error ?? '', /no chain in scope 0 has channelId/);
  assert.match(failed[0]?.error ?? '', /names two chains and neither resolves/);
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped', 'gn-shipped'],
    'and the copy really is there, wearing the source name — which is what the report is about');
});

test('L-chain-create: a name the container already holds is refused before any frame', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({ ops: [{ op: 'chain.create', source: SHIPPED(), name: 'gn-shipped' }] }),
    /leave two chains sharing one name/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainDuplicate), false);
  assert.deepEqual(wire.chains.map((c) => c.name), ['gn-shipped']);
});

test('L-chain-create: a source the container does not hold is refused before any frame', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.create', source: chainAt(deviceAt(TRACK, 0), 'nope'), name: 'gn-B' }],
    }),
    /source chain "nope" is absent/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainSelect), false);
});

test('L-chain-create: a container with no observable scope is refused, not written blind', async () => {
  const wire = new ChainCreateTransport();
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // Position 4 is past the scopes the stub reports, exactly as it would be past
  // `Rig.SLOT_SCOPES` live — and a chain created out there could be resolved by
  // nothing and removed by nothing.
  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.create', source: chainAt(deviceAt(TRACK, 4), 'gn-shipped'), name: 'gn-B' }],
    }),
    /no container scope covers device position 4/,
  );
  assert.equal(wire.frames.some((f) => f.method === WIRE.chainDuplicate), false);
});

test('L-chain-activate: exact independent readback proves one active sibling', async () => {
  const wire = new ChainCreateTransport();
  wire.chains[0]!.solo = true;
  wire.chains.push({ name: 'gn-B', channelId: 'chain-id-2', solo: false });
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  const receipt = await adapter.apply({
    ops: [{ op: 'chain.activate', chain: chainAt(deviceAt(TRACK, 0), 'gn-B') }],
  });
  assert.equal(receipt.stages[0]?.ops[0]?.ok, true);
  assert.deepEqual(wire.chains.map((item) => [item.name, item.solo]), [
    ['gn-shipped', false], ['gn-B', true],
  ]);
  const batch = wire.frames.find((frame) => frame.method === WIRE.batchRun);
  const ops = ((batch?.params as Record<string, unknown> | undefined)?.['ops'] ?? []) as
    { method: string }[];
  assert.equal(ops.some((frame) => frame.method === WIRE.chainActivate), true);
});

test('L-chain-activate: missing solo observation refuses before the write frame', async () => {
  const wire = new ChainCreateTransport(false, false, false, true);
  wire.chains.push({ name: 'gn-B', channelId: 'chain-id-2', solo: false });
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  await assert.rejects(
    adapter.apply({
      ops: [{ op: 'chain.activate', chain: chainAt(deviceAt(TRACK, 0), 'gn-B') }],
    }),
    /solo state was not observed exactly/,
  );
  assert.equal(wire.frames.some((frame) => frame.method === WIRE.chainActivate), false);
});

test('L-chain: a container position with no scope is UNREACHABLE on a read, not missing', async () => {
  const wire = new InventoryTransport(
    new Map([[0, CHANNEL_ID]]),
    new Map([[CHANNEL_ID, [CONTAINER_SCOPE([{ index: 0, name: 'A take' }])]]]),
  );
  const adapter = new UntimedAdapter({ transport: wire, cursorPool: 3 });

  // Position 4 is past the scopes the stub reports, exactly as it would be past
  // `Rig.SLOT_SCOPES` live.
  const far = chainAt(deviceAt(TRACK, 4), 'A take');
  const snapshot = await adapter.read([far]);
  assert.deepEqual(snapshot.unreachable.map(addressKey), [addressKey(far)]);
  assert.deepEqual(snapshot.missing, []);
});
