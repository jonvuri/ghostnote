/** E131: live read-only proof for the experimental guarded clip acquisition tool. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { BridgeTransport } from '../adapters/live/transport.js';
import { Executor } from '../engine/index.js';
import { validateExactNoteSource, type ExactNoteSource } from '../musical/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { EXPERIMENTAL_7B_TOOL_PROFILE, callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, client as bridge, failureCount } from './lib.js';

interface Selection {
  readonly trackIndex: number;
  readonly slotIndex: number;
  readonly mixerTrackIndex?: number;
}

interface AcquisitionResult {
  readonly format: string;
  readonly authority: string;
  readonly target: { readonly trackId: string; readonly row: number };
  readonly coverage: { readonly complete: boolean; readonly channels: number; readonly notes: number };
  readonly timingPlane: { readonly unit: string; readonly ticksPerBeat: number };
  readonly guards: {
    readonly project: string;
    readonly generation: string;
    readonly sourceSha256: string;
  };
  readonly exactSource: ExactNoteSource;
  readonly timing: { readonly acquisitionMs: number; readonly normalizationMs: number; readonly totalMs: number };
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function restoreExactSelection(entry: Selection): Promise<Selection> {
  if (entry.mixerTrackIndex !== undefined) {
    await bridge.request('cursor.pin', { cursor: 'fine', pinned: false });
    await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: false });
    await bridge.request('cursor.pointTrack', {
      cursor: 'fine', trackIndex: entry.mixerTrackIndex,
    });
  }
  await bridge.request('slot.select', {
    trackIndex: entry.trackIndex, slotIndex: entry.slotIndex, mechanism: 'track',
  });
  await wait(150);
  if (entry.mixerTrackIndex !== undefined) {
    await bridge.request('cursor.pinTrack', { cursor: 'fine', pinned: true });
    await bridge.request('cursor.pin', { cursor: 'fine', pinned: true });
  }
  return await bridge.request('selection.status') as Selection;
}

await bridge.connect();
const selectionBefore = await bridge.request('selection.status') as Selection;
const adapter = new LiveAdapter({ transport: new BridgeTransport(bridge) });

try {
  const hello = await adapter.hello();
  const tracks = await adapter.tracks();
  const selected = tracks.find((item) => item.position === selectionBefore.trackIndex);
  if (selected === undefined) throw new Error('the selected launcher track is not visible');
  const workspace = workspaceOf({
    ready: async () => undefined,
    adapter,
    executor: new Executor(adapter),
    stash: new Stash(),
    observationStore: new FakeObservationStore(),
  });
  const result = await callTool(workspace, 'acquire_clip_note_source', {
    trackId: selected.channelId,
    row: selectionBefore.slotIndex,
  }, EXPERIMENTAL_7B_TOOL_PROFILE) as AcquisitionResult;
  validateExactNoteSource(result.exactSource);
  check('E131-A0: the live API 25 build serves the acquisition route',
    hello.host?.apiVersion === 25 && result.format === 'ghostnote-clip-acquisition',
    { hello, format: result.format });
  check('E131-A1: the result is explicit complete authority across 16 channels',
    result.authority === 'authoritative-complete-scan'
      && result.coverage.complete && result.coverage.channels === 16,
    { authority: result.authority, coverage: result.coverage });
  check('E131-A2: normalized timing and exact-source guards agree',
    result.timingPlane.unit === 'beat-tick'
      && result.timingPlane.ticksPerBeat === 512
      && result.guards.sourceSha256 === result.exactSource.digest.value
      && result.guards.project === result.exactSource.observedAt.project
      && result.guards.generation === result.exactSource.observedAt.generation,
    { timingPlane: result.timingPlane, guards: result.guards });
  const selectionAfter = await bridge.request('selection.status') as Selection;
  check('E131-A3: acquisition restores launcher selection',
    selectionAfter.trackIndex === selectionBefore.trackIndex
      && selectionAfter.slotIndex === selectionBefore.slotIndex,
    { before: selectionBefore, after: selectionAfter });
  console.log(`CLIP_ACQUISITION_MEASUREMENT ${JSON.stringify({
    target: result.target,
    notes: result.coverage.notes,
    timing: result.timing,
    sourceSha256: result.guards.sourceSha256,
  })}`);
} catch (error) {
  check('E131-AX: clip acquisition completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  try {
    const restored = await restoreExactSelection(selectionBefore);
    check('E131-A4: probe cleanup restores the exact entry selection',
      restored.trackIndex === selectionBefore.trackIndex
        && restored.slotIndex === selectionBefore.slotIndex
        && restored.mixerTrackIndex === selectionBefore.mixerTrackIndex,
      { before: selectionBefore, after: restored });
  } catch (error) {
    check('E131-A4: probe cleanup restores the exact entry selection', false,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  }
  await adapter.close();
}

console.log(`\n${failureCount() === 0 ? 'ALL PASS' : `${failureCount()} FAILURE(S)`}`);
process.exit(failureCount() === 0 ? 0 : 1);
