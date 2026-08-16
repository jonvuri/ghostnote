import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESCRIPTION_COHORT,
  TOOL_DESCRIPTION_V1_SHA256,
  TOOL_DESCRIPTION_VERSION,
  descriptionCohortArtifact,
  fingerprintDescriptionCohort,
} from './description-cohort.js';
import { ANNOTATIONS, TOOLS } from './tools.js';

const EXPECTED_COHORT = [
  'inspect_device_alternates',
  'create_device_alternates',
  'fill_device_alternate',
  'switch_device_alternate',
  'keep_device_alternate',
  'remove_device_alternate',
  'inspect_clip_block',
  'copy_clip_down',
  'set_clip_launch',
  'launch_clip',
  'move_clip_block',
  'delete_clip',
  'copy_track',
  'add_scenes',
  'delete_track',
] as const;

test('description v1 names one complete and explicit cohort', () => {
  assert.equal(TOOL_DESCRIPTION_VERSION, 'ghostnote-description-v1');
  assert.deepEqual(DESCRIPTION_COHORT.map((member) => member.name), EXPECTED_COHORT);
  assert.equal(new Set(EXPECTED_COHORT).size, EXPECTED_COHORT.length);
  for (const member of DESCRIPTION_COHORT) {
    assert.ok(member.reason.length > 20, `${member.name} needs an inclusion reason`);
    const spec = TOOLS.find((candidate) => candidate.name === member.name);
    assert.ok(spec !== undefined, `${member.name} must exist`);
    assert.equal(spec.kind, member.kind, `${member.name} changed privilege class`);
  }
});

test('description v1 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS);
  assert.deepEqual(artifact.map((member) => member.name), EXPECTED_COHORT);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V1_SHA256,
    'public wording or schema changed; assign a new description version before updating the golden',
  );
});
