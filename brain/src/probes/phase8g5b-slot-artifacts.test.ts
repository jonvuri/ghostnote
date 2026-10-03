import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { DATA, verifyArtifacts, verifyCheck } from './phase8g5b-slot-artifacts.js';

type Wire = Record<string, unknown>;
const json = async (name: string): Promise<Wire> => JSON.parse(await readFile(join(DATA, name), 'utf8')) as Wire;

test('retained 8g5b slot artifacts verify', async () => {
  const result = await verifyArtifacts();
  assert.equal(result.eligible, false); assert.equal((result.checks as Wire[]).length, 14);
  assert.deepEqual(result.recreateWitness, { runs: 10, identityChanged: 10, withoutRowCallback: 10,
    identityChangedWithoutRowCallback: 10, missedDeliveries: 0 });
});

test('check mutants are refused by semantic checks', async () => {
  const prior = await json('p-arm-0.json'), report = await json('native-1-create.json');
  assert.equal(verifyCheck('native-1-create', report, prior).retirement, 'slot-window-changed');
  const clone = (): Wire => JSON.parse(JSON.stringify(report)) as Wire;
  const foreign = clone(), list = ((foreign.publication as Wire).list as Wire);
  (list.occupancy as Wire[]).push({ trackId: 'foreign-track', row: 4, ref: 'foreign-ref' });
  assert.throws(() => verifyCheck('foreign', foreign, prior));
  const survived = clone(); (survived.retained as Wire).occupancyAdmitted = true;
  assert.throws(() => verifyCheck('survived', survived, prior), /survived/);
  const declared = clone(); ((declared.declaration as Wire).operations as Wire[])[0]!.row = 4;
  assert.throws(() => verifyCheck('declared', declared, prior));
  const identity = clone(); (((identity.publication as Wire).list as Wire)).clipIdentityClaimed = true;
  assert.throws(() => verifyCheck('identity', identity, prior));
});
