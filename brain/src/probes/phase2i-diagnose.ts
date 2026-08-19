/** Read-only comparison of direct launcher occupancy and public clip reads. */
import { BridgeClient } from '../client.js';

const bridge = new BridgeClient();
const mode = process.argv[2] ?? 'read';
const emptyObservation = '{"entries":[],"format":"ghostnote-observation-record","schemaVersion":2}';

try {
  await bridge.connect();
  if (mode === 'reset-observation') {
    const replaced = await bridge.request('observation.replace', { value: emptyObservation });
    const read = await bridge.request('observation.read');
    console.log(JSON.stringify({ replaced, read }, null, 2));
    process.exitCode = 0;
  } else if (mode !== 'read') {
    throw new Error(`unknown mode ${mode}`);
  } else {
  const revision = await bridge.request('revision.get');
  const listed = await bridge.request('track.list') as {
    tracks: readonly { index: number; name: string; channelId: string }[];
  };
  const scene = await bridge.request('scene.count') as { sceneCount: number };
  const targets = listed.tracks.filter((track) =>
    track.name === 'Lead' || track.name === 'Harmony');
  const slots = [];
  for (const track of targets) {
    for (let row = 0; row < scene.sceneCount; row += 1) {
      slots.push({
        track: track.name,
        trackId: track.channelId,
        row,
        status: await bridge.request('slot.status', {
          trackIndex: track.index,
          slotIndex: row,
        }),
      });
    }
  }
  const cursors = [];
  for (const cursor of ['0', '1', '2', 'fine']) {
    cursors.push({ cursor, status: await bridge.request('cursor.status', { cursor }) });
  }
  console.log(JSON.stringify({ revision, scenes: scene.sceneCount, slots, cursors }, null, 2));
  }
} finally {
  bridge.disconnect();
}
