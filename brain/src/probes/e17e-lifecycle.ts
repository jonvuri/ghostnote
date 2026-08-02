/**
 * E17 rows 2b, 4 and 5 — the layer LIFECYCLE: duplicate, delete, rename.
 *
 * Three rows in one probe because they share a fixture discipline and because
 * row 4 destroys its subject, so it goes last and gets its own.
 *
 * ROW 4 — DELETE (`DeleteableObject.deleteObject()`), and ⚠ **this row alone is
 * the minimum viable unlock for the layer branching model.** Revert-by-delete is
 * what makes a branch exact regardless of what happened inside it — §4.2 calls
 * that the strongest argument for the whole track-native model, stronger than
 * the A/B argument — and this is that argument one level down. With `moveDevices`
 * ● (E16n) and `insertFile` ● (E4d route 4), delete is the last piece of a
 * create-by-rebuild loop: materialise N chains from a preset, trim to the shape
 * wanted, move the human's own device in. **E4d probed duplicate and never
 * probed delete.**
 *
 * ⚠ **Four chains, deleted in FOUR POSITIONS, and that is the method rather than
 * thoroughness.** E10d found the identical operation one level down IN THE FILE
 * FORMAT behaving differently by position — chains are trimmable, but the LAST
 * one is not, because it has no exact end. Worse, the probe bug that produced
 * that first read exactly like a capability ○, and *"testing the same operation
 * in several POSITIONS is what exposed it"*. If the API shows the same
 * removable-but-not-addable asymmetry as the file format, two independent layers
 * of the product agreeing is a finding in its own right.
 *
 * ⚠ **Name the survivors, never count them** (the e16t rule). A count of 3 after
 * deleting index 1 is also what deleting index 2 would produce. The E4g template
 * is [Phase-4, Polysynth, Organ, Sampler] — four DISTINCT devices, chosen here
 * precisely so every survivor is identifiable by name.
 *
 * ROW 2b — the third duplication mechanism, `ControllerHost.duplicateObjects()`,
 * which `duplicateObject()`'s own javadoc names. `e17b` re-ran E4d routes 1 and 2
 * with the precondition proved and both still no-op, so this is what is left.
 *
 * ROW 5 — RENAME. `DeviceChain.name()` is a `SettableStringValue`, so the write
 * is typed as possible; **the question is whether it STICKS.** E4c recorded that
 * a layer renames itself after its content. ⚠ This decides whether §1b's naming
 * scheme survives the move to layers: under the track model the lineage tag lives
 * in the track name and E16q proved the middle dot round-trips exactly. If layer
 * names are volatile the tag needs a different home — and `channelId` cannot be
 * it, because a tag has to be human-readable and human-editable BY DESIGN.
 * So the test is set-then-CHANGE-THE-CONTENTS-then-re-read, because a
 * set-then-read is the easy half and proves almost nothing.
 *
 * Silent: nothing is launched and the transport is never touched.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

const req = (m: string, p: Record<string, unknown> = {}) => client.request(m, p);

const POLYSYNTH = 'a9ffacb5-33e9-4fc7-8621-b1af31e410ef';

interface TrackRow { index: number; name: string; type: string; channelId: string }
const list = async () => ((await req('track.list')) as { tracks: TrackRow[] }).tracks;
interface LayerRow { index: number; name: string; channelId?: string | boolean; devices: { name: string }[] }
interface LayerList { layers: LayerRow[]; count: number; cursorDeviceName?: string }
const layers = async () => (await req('layer.list')) as LayerList;
const namesOf = (l: LayerList) => l.layers.map((x) => x.devices.map((d) => d.name).join('+') || '—');
const shapeOf = (l: LayerList) =>
  l.layers.map((x) => `${x.index}:${JSON.stringify(x.name)}[${x.devices.map((d) => d.name).join('+') || '—'}]`).join(' ')
  || '(no chains)';

/** Point at a container and REFUSE unless it landed — the e16o trap, centralised. */
async function selectContainer(trackIndex: number, expect = 'Instrument Layer'): Promise<void> {
  await req('cursor.pointTrack', { cursor: '0', trackIndex });
  await pollUntil(async () => {
    const s = (await req('cursor.status', { cursor: '0' })) as { trackPosition: number };
    return s.trackPosition === trackIndex;
  }, 4000, 150);
  await req('devcursor.selectAt', { deviceIndex: 0 });
  const ok = await pollUntil(async () => {
    const s = (await req('devcursor.status')) as { exists: boolean; name: string };
    return s.exists && s.name === expect;
  }, 6000, 150);
  if (!ok.ok) {
    console.log(`\nREFUSING: cursor is not on "${expect}" — ${JSON.stringify(await req('devcursor.status'))}`);
    console.log('Every layer call reaches its target through this cursor (the e16o trap): aimed');
    console.log('at a device with no layers, all of them are silent no-ops byte-identical to');
    console.log('API refusals. That is what put E4d\'s duplication ○ in doubt in the first place.');
    process.exit(1);
  }
}

await client.connect();
const tracks = await list();
const lay = tracks.find((t) => t.name === 'gn-lay');
const lay4 = tracks.find((t) => t.name === 'gn-lay4');
if (!lay || !lay4) { console.log('REFUSING: run e17-setup first.'); process.exit(1); }

// ==========================================================================
console.log('\n======== ROW 2b — duplicate a layer via ControllerHost.duplicateObjects()');
await selectContainer(lay.index);
const d0 = await layers();
note(`gn-lay BEFORE: count=${d0.count}  ${shapeOf(d0)}`);
check('PRECONDITION: the container is selected and reports 2 chains',
  d0.count === 2 && d0.cursorDeviceName === 'Instrument Layer',
  { count: d0.count, cursorDeviceName: d0.cursorDeviceName });
await req('layer.duplicateViaHost', { layerIndex: 0 });
const dGrew = await pollUntil(async () => {
  await selectContainer(lay.index);
  return (await layers()).count > d0.count;
}, 4000, 250);
await selectContainer(lay.index);
const d1 = await layers();
note(`gn-lay AFTER:  count=${d1.count}  ${shapeOf(d1)}   (${dGrew.ms} ms)`);
const row2b = dGrew.ok;
check('⚠ ROW 2b: `host.duplicateObjects` duplicates a layer where the direct verbs do not',
  row2b, { before: d0.count, after: d1.count });

// ==========================================================================
console.log('\n======== ROW 5 — rename a layer, then CHANGE ITS CONTENTS and re-read');
// ⚠ The middle dot is §1b's actual lineage tag and E16q proved it round-trips
// through `track.setName`. Testing with "foo" would answer a question nobody
// asked; testing with the real tag is what decides whether the scheme survives.
const TAG = 'A·take';
await selectContainer(lay.index);
const before5 = await layers();
const originalName = before5.layers[0]!.name;
note(`chain 0 is called ${JSON.stringify(originalName)} (content-derived, E4c)`);
await req('layer.setName', { layerIndex: 0, name: TAG });
const took = await pollUntil(async () => {
  await selectContainer(lay.index);
  return (await layers()).layers[0]?.name === TAG;
}, 4000, 250);
await selectContainer(lay.index);
const named = await layers();
note(`after setName: ${shapeOf(named)}   (${took.ms} ms)`);
const setSticks = named.layers[0]?.name === TAG;
check('ROW 5a: the name WRITE lands, and the middle dot round-trips (E16q\'s scheme)',
  setSticks, { requested: TAG, readBack: named.layers[0]?.name });

// ⚠ The case that actually bites. E4c: a layer renames itself after its content.
note('now CHANGING chain 0\'s contents — this is the case E4c says overwrites the name');
await selectContainer(lay.index);
await req('layer.insertDevice', { layerIndex: 0, uuid: POLYSYNTH });
await pollUntil(async () => {
  await selectContainer(lay.index);
  const c = await layers();
  return (c.layers[0]?.devices.length ?? 0) > (named.layers[0]?.devices.length ?? 0);
}, 8000, 250);
await new Promise((r) => setTimeout(r, 1200));
await selectContainer(lay.index);
const after5 = await layers();
note(`after a content change: ${shapeOf(after5)}`);
const survivedContentChange = after5.layers[0]?.name === TAG;
check('⚠ ROW 5b: the name SURVIVES a change to the chain\'s contents — so a human-editable'
  + ' lineage tag can live in a layer name',
  survivedContentChange, { tag: TAG, afterContentChange: after5.layers[0]?.name });

// ==========================================================================
console.log('\n======== ROW 4 — DELETE a layer, in four POSITIONS (gn-lay4)');
note('⚠ The minimum viable unlock. Revert-by-delete is what makes a branch exact');
note('regardless of contents (§4.2), and E4d never probed delete at all.');
await selectContainer(lay4.index);
const start = await layers();
note(`gn-lay4: ${shapeOf(start)}`);
check('PRECONDITION: four chains, each holding a DISTINCT device, so every survivor'
  + ' can be named rather than counted (the e16t rule)',
  start.count === 4 && new Set(namesOf(start)).size === 4, { shape: namesOf(start) });
if (start.count !== 4) { console.log('REFUSING: gn-lay4 is not the 4-chain fixture.'); process.exit(1); }

interface DeleteResult { pos: string; before: string[]; after: string[]; worked: boolean; ms: number }
const deletions: DeleteResult[] = [];

async function deleteChain(pos: string, layerIndex: number, method = 'layer.delete'): Promise<DeleteResult> {
  await selectContainer(lay4!.index);
  const b = await layers();
  const victim = b.layers.find((x) => x.index === layerIndex);
  note(`${pos}: deleting chain ${layerIndex} = ${JSON.stringify(victim?.name)}`
    + `[${victim?.devices.map((d) => d.name).join('+') || '—'}]  via ${method}`);
  await req(method, { layerIndex });
  const gone = await pollUntil(async () => {
    await selectContainer(lay4!.index);
    return (await layers()).count < b.count;
  }, 5000, 250);
  await selectContainer(lay4!.index);
  const a = await layers();
  note(`   ${b.count} -> ${a.count}   ${shapeOf(a)}   (${gone.ms} ms)`);
  const r = { pos, before: namesOf(b), after: namesOf(a), worked: gone.ok, ms: gone.ms };
  deletions.push(r);
  return r;
}

// MIDDLE first — the position E10d found trimmable in the file format.
const mid = await deleteChain('MIDDLE (index 1, Polysynth)', 1);
check('ROW 4a: a MIDDLE chain deletes, and the RIGHT one goes',
  mid.worked && !mid.after.includes('Polysynth') && mid.after.includes('Phase-4')
  && mid.after.includes('Organ') && mid.after.includes('Sampler'),
  { before: mid.before, after: mid.after });

if (mid.worked) {
  const first = await deleteChain('FIRST (index 0)', 0);
  check('ROW 4b: the FIRST chain deletes, and the right one goes',
    first.worked && !first.after.includes('Phase-4'), { before: first.before, after: first.after });

  const cur = await layers();
  const lastIdx = cur.layers[cur.layers.length - 1]!.index;
  // ⚠ E10d: in the FILE FORMAT the last chain specifically cannot be removed,
  // because it has no exact end. Does the API inherit the asymmetry?
  const last = await deleteChain(`LAST (index ${lastIdx})`, lastIdx);
  check('⚠ ROW 4c: the LAST chain deletes too — the file format\'s "last chain is not'
    + ' removable" asymmetry (E10d) does NOT reproduce in the API',
    last.worked, { before: last.before, after: last.after });

  const cur2 = await layers();
  if (cur2.count === 1) {
    const only = await deleteChain(`ONLY remaining (index ${cur2.layers[0]!.index})`, cur2.layers[0]!.index);
    check('⚠ ROW 4d: the SOLE remaining chain deletes, leaving a 0-chain container',
      only.worked, { before: only.before, after: only.after });
    // ⚠ This is the shape that would matter most: a container that can be
    // emptied but not refilled is E10c/E10d's removable-but-not-addable
    // asymmetry showing up in a SECOND, independent layer of the product.
    const end = await layers();
    if (end.count === 0) {
      note('⚠ the container is now EMPTY, and row 3 proved nothing can seed it again.');
      note('  That is the file format\'s removable-but-not-addable asymmetry (E10c/E10d)');
      note('  reproducing in the live API — two independent layers of the product agreeing.');
    }
  }
} else {
  // The direct verb failed — try the independent mechanism before recording a ○.
  note('⚠ `layer.delete` did not work; trying `host.deleteObjects` before recording a ○');
  const viaHost = await deleteChain('MIDDLE via host.deleteObjects', 1, 'layer.deleteViaHost');
  check('ROW 4 route 2: `host.deleteObjects` deletes a layer where `deleteObject` does not',
    viaHost.worked, { before: viaHost.before, after: viaHost.after });
}

// ==========================================================================
console.log('\n======== VERDICT');
console.log(`  ROW 2b  host.duplicateObjects on a layer   ${row2b ? '●' : '○'}`);
console.log(`  ROW 5a  name WRITE lands                  ${setSticks ? '●' : '○'}`);
console.log(`  ROW 5b  name survives a content change    ${survivedContentChange ? '●' : '○'}`);
for (const d of deletions) {
  console.log(`  ROW 4   delete ${d.pos.padEnd(34)} ${d.worked ? '●' : '○'}  ${d.ms} ms`);
}
const deleteWorks = deletions.length > 0 && deletions[0]!.worked;
if (deleteWorks) {
  note('⇒ ⚠ DELETE WORKS. That is the minimum viable unlock: revert-by-delete is exact');
  note('  regardless of a chain\'s contents, so a layer CAN be a branch that is thrown away');
  note('  cleanly — even though nothing can create one (row 3 ○).');
} else {
  note('⇒ ⚠ delete does NOT work, and with rows 1–3 also ○ that removes the last mechanism');
  note('  a layer-based branch model could have been built on.');
}
if (setSticks && !survivedContentChange) {
  note('⚠ ROW 5: a layer name is WRITABLE but VOLATILE. §1b\'s lineage tag cannot live in');
  note('  one, and `channelId` cannot replace it — a tag has to be human-editable by design.');
}

console.log(failureCount() === 0 ? '\nALL PASS' : `\n${failureCount()} checks reported a negative — read them individually`);
process.exit(0);
