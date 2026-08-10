/**
 * Diagnostic: `clip.create` into an OCCUPIED slot grows the project.
 *
 * Found while proving session 3c. A live conformance run added ~24 scenes while
 * calling `scene.create` twice — and kept adding them after the project passed
 * the window, where both of those calls were being refused. Bisecting put +1 on
 * each `C-props` case and +0 on `C-notes`; replaying the frames by hand added
 * nothing; replaying `withClip` step by step put it all on ONE line:
 *
 *     apply clip.create @ row 0    168 -> 169
 *
 * The difference between the two bisect halves was never the properties. It was
 * that the hand replay deleted the clip first, so its `clip.create` landed on an
 * EMPTY slot.
 *
 * This characterises the behaviour: empty vs occupied, where the new row goes,
 * and what happens to the clip that was already there.
 *
 * ⚠ Costs one scene on the occupied arm, by construction.
 */
import { client } from './lib.js';

const count = async (): Promise<number> =>
  ((await client.request('rig.info')) as { sceneCount: number }).sceneCount;

const settle = () => new Promise((r) => setTimeout(r, 500));

await client.connect();

const list = (await client.request('track.list')) as {
  tracks: { index: number; name: string; type: string }[];
};
const row = list.tracks.find((t) => t.name === 'gn-conf-A')
  ?? list.tracks.find((t) => t.type === 'Instrument');
if (row === undefined) throw new Error('no instrument track to test against');
const trackIndex = row.index;

const has = async (slotIndex: number): Promise<boolean> =>
  ((await client.request('slot.status', { trackIndex, slotIndex })) as { hasContent: boolean })
    .hasContent;

console.log(`track ${trackIndex} (${row.name})\n`);

// --- ARM 1: an EMPTY slot -----------------------------------------------------
if (await has(0)) {
  await client.request('slot.delete', { trackIndex, slotIndex: 0 });
  await settle();
}
const emptyBefore = await count();
await client.request('clip.create', { trackIndex, slotIndex: 0, lengthBeats: 4 });
await settle();
const emptyAfter = await count();
console.log(`ARM 1  clip.create into an EMPTY slot     ${emptyBefore} -> ${emptyAfter}`
  + `   row 0 holds a clip: ${await has(0)}`);

// --- ARM 2: the SAME slot, now occupied ---------------------------------------
const occBefore = await count();
// ⚠ Only the rows the bank can address are observable, so the check below is
// bounded by the window rather than by the project — which is the finding this
// whole session is about, showing up in its own diagnostic.
const windowRows = ((await client.request('rig.info')) as { scenes: number }).scenes;
const filledBefore: number[] = [];
for (let i = 0; i < windowRows; i++) if (await has(i)) filledBefore.push(i);

await client.request('clip.create', { trackIndex, slotIndex: 0, lengthBeats: 4 });
await settle();
const occAfter = await count();

const filledAfter: number[] = [];
for (let i = 0; i < windowRows; i++) if (await has(i)) filledAfter.push(i);

console.log(`ARM 2  clip.create into an OCCUPIED slot  ${occBefore} -> ${occAfter}`);
console.log(`       filled rows inside the window: [${filledBefore}] -> [${filledAfter}]`);
console.log(`       row 0 still holds a clip: ${await has(0)}`);

// Where did the new row go? The count grew, so the project has a row at the old
// count index — outside the window if the project is bigger than it, which is
// the whole hazard.
console.log(`\n⚠ the new row is at project index ${occAfter - 1}, and the bank addresses `
  + `0..${windowRows - 1}`);

console.log(`\nfinal scene count: ${await count()}`);
client.disconnect();
