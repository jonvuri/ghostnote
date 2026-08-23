import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESCRIPTION_COHORT,
  DESCRIPTION_COHORT_V1,
  DESCRIPTION_COHORT_V2,
  DESCRIPTION_COHORT_V3,
  DESCRIPTION_COHORT_V4,
  DESCRIPTION_COHORT_V5,
  DESCRIPTION_COHORT_V6,
  DESCRIPTION_COHORT_V7,
  TOOL_DESCRIPTION_V1_SHA256,
  TOOL_DESCRIPTION_V2_SHA256,
  TOOL_DESCRIPTION_V3_SHA256,
  TOOL_DESCRIPTION_V4_SHA256,
  TOOL_DESCRIPTION_V5_SHA256,
  TOOL_DESCRIPTION_V6_SHA256,
  TOOL_DESCRIPTION_V7_SHA256,
  TOOL_DESCRIPTION_V8_SHA256,
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
  'list_tracks',
  'read_clip',
  'write_notes',
  'erase_notes',
  'add_clip',
  'generate_clip_music',
  'transform_clip_music',
  'list_changes',
  'revert_change',
  'show_changed_clip',
  'record_observation',
  'read_observation_record',
  'report_observations',
  'start_clip_music_operation',
  'inspect_clip_music_operation',
  'cancel_clip_music_operation',
  'inspect_devices',
  'inspect_device_parameters',
  'add_device',
  'set_parameter',
  'set_device_enabled',
  'delete_device',
  'author_modulators',
  'compose_device_structure',
] as const;

test('description v8 names one complete and explicit cohort', () => {
  assert.equal(TOOL_DESCRIPTION_VERSION, 'ghostnote-description-v8');
  assert.deepEqual(DESCRIPTION_COHORT.map((member) => member.name), EXPECTED_COHORT);
  assert.equal(new Set(EXPECTED_COHORT).size, EXPECTED_COHORT.length);
  for (const member of DESCRIPTION_COHORT) {
    assert.ok(member.reason.length > 20, `${member.name} needs an inclusion reason`);
    const spec = TOOLS.find((candidate) => candidate.name === member.name);
    assert.ok(spec !== undefined, `${member.name} must exist`);
    assert.equal(spec.kind, member.kind, `${member.name} changed privilege class`);
  }
});

test('description v1 stays frozen as its original 15-tool artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V1);
  assert.equal(artifact.length, 15);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V1_SHA256,
    'the frozen v1 public wording or schema changed',
  );
});

test('description v2 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V2);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V2_SHA256,
    'the frozen v2 public wording or schema changed',
  );
});

test('description v3 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V3);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V3_SHA256,
    'the frozen v3 public wording or schema changed',
  );
});

test('description v4 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V4);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V4_SHA256,
    'the frozen v4 public wording or schema changed',
  );
});

test('description v5 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V5);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V5_SHA256,
    'the frozen v5 public wording or schema changed',
  );
});

test('description v6 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V6);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V6_SHA256,
    'the frozen v6 public wording or schema changed',
  );
});

test('description v7 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS, DESCRIPTION_COHORT_V7);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V7_SHA256,
    'the frozen v7 public wording or schema changed',
  );
});

test('description v8 matches its frozen public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS);
  assert.deepEqual(artifact.map((member) => member.name), EXPECTED_COHORT);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V8_SHA256,
    'public wording or schema changed; assign a new description version before updating the golden',
  );
});
