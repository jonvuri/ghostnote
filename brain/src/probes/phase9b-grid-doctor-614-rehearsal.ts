/**
 * 9b.6i rehearsal of the read paths on the installed build before any doctor consent (E339 retrospective).
 * Usage: <new absolute output directory>.
 * The shared scratch survey makes one muted scratch track per doctor fixture in sequence, inserts the
 * preset, reads it with the survey reader, and deletes the track with readback. The control read runs
 * before and after. There is no doctor bind, no breadth bind, and no native command. The operator must
 * save first and allow the scratch tracks.
 */
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runSurvey } from './phase9b-grid-survey.js';
import { readSurvey, validateProjection, type Projection, type Request, type Wire } from './phase9b-grid-survey-read.js';
import { MARKER, DATA, E339_SAMPLE } from './phase9b-grid-doctor-614.js';

const ROOT = join(import.meta.dirname, '../../..');
const load = (path: string): Wire => {
  assert.ok(statSync(path).size <= 2 * 1024 * 1024, 'JSON input exceeds 2 MiB');
  return JSON.parse(readFileSync(path, 'utf8'));
};
/** Module counts of the fixed fixtures: the E339 attempt-6 doctor reads and the E276 control (the core preset). */
export function expectedModules(sample = E339_SAMPLE): Record<string, number> {
  const modules = (name: string) => load(join(sample, name)).snapshot.fixture.modules.length;
  return { boolean: modules('preset-0-stage-0-read-0.json'), mapping: modules('preset-1-stage-0-read-0.json'), core: 4 };
}
/** The survey's own read caps. E302 recorded a schema-child cap for SEMtex in catalog mode; a cap is data, not a refusal. */
export const CAP_PATTERN = /work-or-time-limit|byte-limit|schema-(child|property)-limit|path-(limit|index-limit)|survey-(schema|capture)-limit/;
/**
 * One survey read of a scratch fixture. Every outcome is returned as a verdict so that the shared survey
 * removes the scratch track: `passed`, `cap-refusal`, `survey-read-disagrees`, or `refused` with the error.
 */
export async function rehearseFixture(request: Request, target: Wire, candidate: Wire,
  save: (name: string, value: unknown) => void, projection: Projection, expected: Record<string, number>): Promise<Wire> {
  assert.ok(Object.hasOwn(expected, candidate.case), 'unknown-fixture-case');
  try {
    const result = await readSurvey(request, target, structuredClone(projection), save);
    const agrees = result.verdict === 'projected-read-agrees' && result.paired === true
      && result.moduleCount === expected[candidate.case];
    return { case: candidate.case, verdict: agrees ? 'passed' : 'survey-read-disagrees', surveyVerdict: result.verdict,
      paired: result.paired, moduleCount: result.moduleCount, expectedModules: expected[candidate.case],
      projectedAudioCableCount: result.projectedAudioCableCount, schemas: result.schemas, captures: result.captures,
      additions: result.additions };
  } catch (error) {
    const text = String(error);
    return { case: candidate.case, verdict: CAP_PATTERN.test(text) ? 'cap-refusal' : 'refused', error: text,
      expectedModules: expected[candidate.case] };
  }
}
export async function runRehearsal(output: string) {
  assert.ok(output && isAbsolute(output), 'Use a new absolute output directory');
  const query = load(join(ROOT, 'context/evidence/data/phase9a-grid-read/semantic-query.json'));
  const projection: Projection = structuredClone(query.projection); validateProjection(projection);
  const expected = expectedModules();
  await runSurvey(['gn-grid-spike', output, join(DATA, 'plan.json')], {
    // Every fixture is rehearsed; a verdict other than `passed` is recorded, not a stop.
    marker: MARKER, stopOnRefusal: false, budget: { calls: 600, milliseconds: 600_000, bytes: 32 * 1024 * 1024 },
    run: (request, target, candidate, save) => rehearseFixture(request, target, candidate, save, projection, expected),
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 3, 'argv: <output>');
  await runRehearsal(process.argv[2]!);
}
