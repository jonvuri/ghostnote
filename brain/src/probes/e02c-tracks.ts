/**
 * E2c — Track creation/rename targeting diagnostic.
 * Suspicion: createInstrumentTrack(position) + setName(bankIndex) can
 * rename the WRONG track (explains orphaned "Inst N" tracks and drifting
 * fixture names). Creates and deletes only its own gn-T* tracks.
 */
import { client, check, note, failureCount, pollUntil } from './lib.js';

type TrackRow = { index: number; name: string; position: number; type: string };
const list = async () => (await client.request('track.list')) as { tracks: TrackRow[]; count: number };

await client.connect();
console.log('connected\n');

async function createAndTrace(position: number, newName: string) {
  const before = await list();
  note(`before: ${before.tracks.map((t) => `${t.index}:${t.name}`).join(' | ')}`);

  await client.request('track.create', { position });
  const grew = await pollUntil(async () => (await list()).count === before.count + 1);
  check(`create at position=${position} grew track count`, grew.ok, { ms: grew.ms });

  const after = await list();
  // diff: the index whose (name,position) pair wasn't there before
  const beforeNames = new Set(before.tracks.map((t) => `${t.position}:${t.name}`));
  const added = after.tracks.filter((t) => !beforeNames.has(`${t.position}:${t.name}`));
  note(`after:  ${after.tracks.map((t) => `${t.index}:${t.name}`).join(' | ')}`);
  note(`diff (changed rows): ${JSON.stringify(added)}`);

  // where did the new track actually land?
  const landed = added.length === 1 ? added[0] : added.find((t) => t.name.startsWith('Inst'));
  check(`new track location identified for position=${position}`, landed !== undefined, added);
  if (!landed) return null;
  note(`created track landed at index=${landed.index} (requested position=${position}) name="${landed.name}" type=${landed.type}`);

  // rename via the landed index and poll for visibility
  await client.request('track.setName', { trackIndex: landed.index, name: newName });
  const renamed = await pollUntil(async () =>
    (await list()).tracks.some((t) => t.index === landed.index && t.name === newName));
  check(`setName("${newName}") landed on index ${landed.index}`, renamed.ok, { ms: renamed.ms });

  // did anything ELSE get renamed?
  const finalList = await list();
  const collateral = finalList.tracks.filter((t) =>
    t.index !== landed.index && !before.tracks.some((b) => b.index === t.index && b.name === t.name)
      // allow index shifts from insertion: match by name presence instead
      && !before.tracks.some((b) => b.name === t.name));
  check('no collateral renames of other tracks', collateral.length === 0, collateral);

  return landed.index;
}

console.log('-- trial 1: create at END');
const c1 = await list();
const i1 = await createAndTrace(c1.count, 'gn-T1');

console.log('\n-- trial 2: create at position 0');
const i2 = await createAndTrace(0, 'gn-T2');

// ---- cleanup: delete only our verified temp tracks (by current name) ----
console.log('\n-- cleanup');
for (const name of ['gn-T1', 'gn-T2']) {
  const l = await list();
  const t = l.tracks.find((x) => x.name === name);
  if (!t) { note(`cleanup: ${name} not found (!)`); continue; }
  await client.request('track.delete', { trackIndex: t.index });
  const gone = await pollUntil(async () => !(await list()).tracks.some((x) => x.name === name));
  check(`deleted ${name}`, gone.ok);
}
const final = await list();
note(`final: ${final.tracks.map((t) => `${t.index}:${t.name}`).join(' | ')}`);

console.log(failureCount() === 0 ? '\nE2c: all checks passed' : `\nE2c: ${failureCount()} FAILURES`);
client.disconnect();
process.exit(failureCount() === 0 ? 0 : 1);
