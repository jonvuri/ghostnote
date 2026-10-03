/** Verify retained candidate reads and rehashed false graph reports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { verifyCandidateArtifact, type GroupOracle, type GroupArtifactRecord } from './phase8g5a-group-lib.js';

const directory = new URL('../../../context/evidence/data/phase8g5a-group/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('candidate-artifacts.json', directory), 'utf8')) as {
  oracleSha256: string; reports: Array<GroupArtifactRecord & { file: string; oracle: string; accepted: boolean }>;
};
const oracleBytes = await readFile(new URL('fixture-oracles.json', directory));
assert.equal(createHash('sha256').update(oracleBytes).digest('hex'), manifest.oracleSha256);
const { oracles } = JSON.parse(oracleBytes.toString()) as { oracles: Record<string, GroupOracle> };
let accepted = 0, refused = 0;
for (const record of manifest.reports) {
  assert.match(record.file, /^[a-z0-9-]+\.json$/);
  const bytes = await readFile(new URL(record.file, directory));
  const oracle = oracles[record.oracle]; assert(oracle);
  if (record.accepted) { verifyCandidateArtifact(bytes, record, oracle); accepted++; }
  else {
    // Establish the mutant's integrity before checking its graph refusal.
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.throws(() => verifyCandidateArtifact(bytes, record, oracle)); refused++;
  }
}
assert.equal(accepted, 5); assert.equal(refused, 4);
console.log(JSON.stringify({ directory: fileURLToPath(directory), candidateMatches: accepted,
  rehashedMutantsRefused: refused, complete: false, eligible: false }));
