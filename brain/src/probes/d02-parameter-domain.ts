/** D02 Session 7 live proof for DirectParameter domains and collateral integrity. */
import { LiveAdapter } from '../adapters/live/adapter.js';
import { track, type TrackAddress, type TrackState } from '../contract/index.js';
import { Executor } from '../engine/index.js';
import { FakeObservationStore } from '../observation/index.js';
import { Stash } from '../stash/index.js';
import { callTool } from '../surface/tools.js';
import { workspaceOf } from '../surface/workspace.js';
import { check, failureCount, note } from './lib.js';

const TRACK_NAME = 'gn-d02-s7-parameter-domain';
const TOLERANCE = 2e-3;

interface PublicParameter {
  readonly id: string;
  readonly name: string;
  readonly normalizedValue: number;
  readonly display?: string;
  readonly discreteValueCount?: number;
  readonly discreteValueNames?: readonly string[];
}

interface PublicInventory {
  readonly standing?: string;
  readonly deviceName?: string;
  readonly parameters?: readonly PublicParameter[];
}

const adapter = new LiveAdapter();
const stash = new Stash();
const workspace = workspaceOf({
  ready: async () => undefined,
  adapter,
  executor: new Executor(adapter),
  stash,
  observationStore: new FakeObservationStore(),
});
let ownedTrack: TrackAddress | undefined;
let entryTracks: readonly TrackState[] = [];

function sameTracks(left: readonly TrackState[], right: readonly TrackState[]): boolean {
  return JSON.stringify(left.map((item) => [item.channelId, item.name, item.position, item.type]))
    === JSON.stringify(right.map((item) => [item.channelId, item.name, item.position, item.type]));
}

async function inspect(devicePosition: number): Promise<PublicInventory> {
  return await callTool(workspace, 'inspect_device_parameters', {
    device: { trackId: ownedTrack!.channelId, devicePosition },
    view: 'direct',
  }) as PublicInventory;
}

function values(inventory: PublicInventory): Map<string, number> {
  return new Map((inventory.parameters ?? []).map((parameter) =>
    [parameter.id, parameter.normalizedValue]));
}

function sameValues(left: PublicInventory, right: PublicInventory): boolean {
  const a = values(left);
  const b = values(right);
  return a.size === b.size && [...a].every(([id, value]) =>
    Math.abs((b.get(id) ?? Number.NaN) - value) <= TOLERANCE);
}

const direct = (devicePosition: number, parameterId: string, normalizedValue: number) => ({
  kind: 'direct' as const,
  device: { trackId: ownedTrack!.channelId, devicePosition },
  parameterId,
  normalizedValue,
});

async function set(settings: readonly ReturnType<typeof direct>[]): Promise<Record<string, unknown>> {
  return await callTool(workspace, 'set_parameter', { settings }) as Record<string, unknown>;
}

async function reverse(changeIds: readonly string[]): Promise<boolean> {
  let exact = true;
  for (const changeId of [...changeIds].reverse()) {
    const result = await callTool(workspace, 'revert_change', { changeId }) as Record<string, unknown>;
    exact &&= result['applied'] === true
      && ((result['notRestored'] as readonly unknown[] | undefined)?.length ?? 0) === 0
      && ((result['caveats'] as readonly unknown[] | undefined)?.length ?? 0) === 0;
  }
  return exact;
}

function changeIds(result: Record<string, unknown>): string[] {
  return ((result['changes'] as readonly { readonly changeId: string }[] | undefined) ?? [])
    .map((change) => change.changeId);
}

try {
  const hello = await adapter.hello();
  const entry = await adapter.revision();
  note(`Bitwig ${hello.host?.version ?? 'unknown'}; project ${entry.project}; revision ${entry.revision}`);
  entryTracks = await adapter.tracks();
  const created = await adapter.apply({ ops: [{ op: 'track.create', name: TRACK_NAME }] });
  await adapter.settle('trackStruct');
  const mint = created.minted[0];
  if (mint?.kind !== 'track') throw new Error('the scratch track returned no durable id');
  ownedTrack = track(mint.channelId);

  const added = await callTool(workspace, 'add_native_devices', {
    trackId: ownedTrack.channelId,
    deviceNames: ['v1 Kick', 'Polysynth'],
  }) as Record<string, unknown>;
  check('d02-s7-L1: the scratch track has one v1 Kick and one Polysynth',
    added['verified'] === true && (added['added'] as readonly unknown[] | undefined)?.length === 2,
    added);

  const initialKick = await inspect(0);
  const attack = initialKick.parameters?.find((parameter) =>
    parameter.id === 'CONTENTS/ATTACK_CLICK');
  check('d02-s7-L2: Attack Click exposes a binary host-proved domain',
    attack?.discreteValueCount === 2
      && attack.discreteValueNames?.length === 2,
    attack);

  const zero = await set([direct(0, 'CONTENTS/ATTACK_CLICK', 0)]);
  const atZero = (await inspect(0)).parameters?.find((parameter) =>
    parameter.id === 'CONTENTS/ATTACK_CLICK');
  const beforeRefusal = await inspect(0);
  const refused = await set([
    direct(0, 'CONTENTS/DECAY', 0.42),
    direct(0, 'CONTENTS/ATTACK_CLICK', 0.28),
  ]);
  const afterRefusal = await inspect(0);
  check('d02-s7-L3: 0.28 refuses before the earlier kick scalar writes',
    refused['refused'] === true
      && refused['nothingWasWritten'] === true
      && JSON.stringify((refused['allowedParameterDomain'] as Record<string, unknown>)
        ?.['normalizedValues']) === JSON.stringify([0, 1])
      && sameValues(beforeRefusal, afterRefusal),
    { refused, atZero });

  const one = await set([direct(0, 'CONTENTS/ATTACK_CLICK', 1)]);
  const atOne = (await inspect(0)).parameters?.find((parameter) =>
    parameter.id === 'CONTENTS/ATTACK_CLICK');
  const attackReversed = await reverse([...changeIds(zero), ...changeIds(one)]);
  const restoredAttack = (await inspect(0)).parameters?.find((parameter) =>
    parameter.id === 'CONTENTS/ATTACK_CLICK');
  check('d02-s7-L4: binary endpoints have exact display and reversal',
    atZero?.normalizedValue === 0
      && atOne?.normalizedValue === 1
      && typeof atZero.display === 'string'
      && typeof atOne.display === 'string'
      && attackReversed
      && restoredAttack?.normalizedValue === attack?.normalizedValue,
    { atZero, atOne, restoredAttack });

  const seed = await set([
    direct(1, 'CONTENTS/R', 0.01),
    direct(1, 'CONTENTS/NOISE', 0.1),
    direct(1, 'CONTENTS/OSC2OCT', 0.6),
    direct(1, 'CONTENTS/OSC2PITCH', 0.5025),
    direct(1, 'CONTENTS/OSC1_SHAPE', 0.18),
    direct(1, 'CONTENTS/OSC2_SHAPE', 0.82),
    direct(1, 'CONTENTS/OSC1_UNISON_VOICES', 1 / 15),
    direct(1, 'CONTENTS/OSC2_UNISON_VOICES', 1 / 15),
    direct(1, 'CONTENTS/OSC1_UNISON_SPREAD', 0.14),
    direct(1, 'CONTENTS/OSC2_UNISON_SPREAD', 0.1),
    direct(1, 'CONTENTS/OSCMIX', 0.52),
    direct(1, 'CONTENTS/FILTER_TYPE', 2 / 7),
    direct(1, 'CONTENTS/F1FREQ', 0.79),
    direct(1, 'CONTENTS/F1RESO', 0.61),
    direct(1, 'CONTENTS/FEGDEPTH', 0.59),
    direct(1, 'CONTENTS/F1D', 0.2),
    direct(1, 'CONTENTS/D', 0.16),
    direct(1, 'CONTENTS/HPF_TYPE', 0.5),
    direct(1, 'CONTENTS/GAIN', 0.82),
    direct(1, 'CONTENTS/OUTPUT', 0.62),
  ]);
  check('d02-s7-L5: the exact pre-revision parameter state is seeded',
    seed['verified'] === true,
    seed);
  const tonalBefore = await inspect(1);

  const first = await set([
    direct(1, 'CONTENTS/NOISE', 0),
    direct(1, 'CONTENTS/OSC2OCT', 0.4),
    direct(1, 'CONTENTS/OSC2PITCH', 0.5005),
    direct(1, 'CONTENTS/OSC1_SHAPE', 0.48),
    direct(1, 'CONTENTS/OSC2_SHAPE', 0.54),
    direct(1, 'CONTENTS/OSC1_UNISON_VOICES', 0),
    direct(1, 'CONTENTS/OSC2_UNISON_VOICES', 0),
    direct(1, 'CONTENTS/OSC1_UNISON_SPREAD', 0.03),
    direct(1, 'CONTENTS/OSC2_UNISON_SPREAD', 0.03),
    direct(1, 'CONTENTS/OSCMIX', 0.46),
  ]);
  const afterFirst = await inspect(1);
  const second = await set([
    direct(1, 'CONTENTS/FILTER_TYPE', 0),
    direct(1, 'CONTENTS/F1FREQ', 0.61),
    direct(1, 'CONTENTS/F1RESO', 0.24),
    direct(1, 'CONTENTS/FEGDEPTH', 0.54),
    direct(1, 'CONTENTS/F1D', 0.26),
    direct(1, 'CONTENTS/D', 0.23),
    direct(1, 'CONTENTS/HPF_TYPE', 0),
    direct(1, 'CONTENTS/GAIN', 0.9),
    direct(1, 'CONTENTS/OUTPUT', 0.65),
  ]);
  const afterSecond = await inspect(1);
  const releases = [tonalBefore, afterFirst, afterSecond].map((inventory) =>
    values(inventory).get('CONTENTS/R'));
  check('d02-s7-L6: both exact tonal cohorts verify without release drift',
    first['verified'] === true
      && second['verified'] === true
      && releases.every((value) => Math.abs((value ?? Number.NaN) - 0.01) <= TOLERANCE),
    { releases, firstElapsedMs: first['elapsedMs'], secondElapsedMs: second['elapsedMs'] });

  const tonalReversed = await reverse([...changeIds(first), ...changeIds(second)]);
  const tonalRestored = await inspect(1);
  check('d02-s7-L7: all 19 tonal scalars reverse to the exact measured state',
    tonalReversed && sameValues(tonalRestored, tonalBefore),
    { tonalReversed });
} catch (error) {
  check('d02-s7-LX: the focused public proof completed without an unexpected failure', false,
    error instanceof Error ? `${error.name}: ${error.message}` : String(error));
} finally {
  if (ownedTrack !== undefined) {
    try {
      await adapter.apply({ ops: [{ op: 'track.delete', track: ownedTrack }] });
      await adapter.settle('trackStruct');
    } catch (error) {
      check('d02-s7-cleanup: the owned scratch track was removed', false,
        error instanceof Error ? error.message : String(error));
    }
  }
  try {
    const finalTracks = await adapter.tracks();
    check('d02-s7-cleanup: the exact entry track list is restored',
      sameTracks(finalTracks, entryTracks),
      { entry: entryTracks, final: finalTracks });
  } catch (error) {
    check('d02-s7-cleanup: final inventory completed', false,
      error instanceof Error ? error.message : String(error));
  }
  await adapter.close();
}

console.log(failureCount() === 0
  ? '\nD02 Session 7: ALL PASS'
  : `\nD02 Session 7: ${failureCount()} FAILURE(S)`);
process.exit(failureCount() === 0 ? 0 : 1);
