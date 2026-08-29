import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DESCRIPTION_COHORT,
  DESCRIPTION_COHORT_V1,
  TOOL_DESCRIPTION_V17_SHA256,
  TOOL_DESCRIPTION_V16_SHA256,
  TOOL_DESCRIPTION_V15_SHA256,
  TOOL_DESCRIPTION_V14_SHA256,
  TOOL_DESCRIPTION_V13_SHA256,
  TOOL_DESCRIPTION_V12_SHA256,
  TOOL_DESCRIPTION_V11_SHA256,
  TOOL_DESCRIPTION_V10_SHA256,
  TOOL_DESCRIPTION_V1_SHA256,
  TOOL_DESCRIPTION_V2_SHA256,
  TOOL_DESCRIPTION_V3_SHA256,
  TOOL_DESCRIPTION_V4_SHA256,
  TOOL_DESCRIPTION_V5_SHA256,
  TOOL_DESCRIPTION_V6_SHA256,
  TOOL_DESCRIPTION_V7_SHA256,
  TOOL_DESCRIPTION_V8_SHA256,
  TOOL_DESCRIPTION_V9_SHA256,
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
  'compose_drum_machine',
  'add_native_devices',
  'inspect_preset_modulation',
  'list_modulator_types',
] as const;

test('description v17 names one complete and explicit cohort', () => {
  assert.equal(TOOL_DESCRIPTION_VERSION, 'ghostnote-description-v17');
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
  assert.equal(DESCRIPTION_COHORT_V1.length, 15);
  assert.equal(
    TOOL_DESCRIPTION_V1_SHA256,
    '9c4951a4f290c679cc9ae7222b8b4d12c6a581ed140936a1d625eafe2c562a39',
  );
});

test('description v17 matches its public artifact', () => {
  const artifact = descriptionCohortArtifact(TOOLS, ANNOTATIONS);
  assert.equal(
    fingerprintDescriptionCohort(artifact),
    TOOL_DESCRIPTION_V17_SHA256,
    'the v17 public wording or schema changed',
  );
});

test('description v16 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V16_SHA256,
    '6007b05597f401b487b12a67091610b797b1534d2ae7a9cdd6aac14e3e774b66',
  );
});

test('description v15 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V15_SHA256,
    'c9bc6a2a64b5b458fefd7be183d53bb4ba8b4a9e895f16930bab28e6fbe660ab',
  );
});

test('description v2 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V2_SHA256,
    '64573f3c3426524fe30088c881918edb79823ad22e27dd0b37c4384c08bbdaf0',
  );
});

test('description v3 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V3_SHA256,
    '85e419b5f81c489f08a468c6f2084689326aeb9f2ff6306eaa6de0891796ece5',
  );
});

test('description v4 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V4_SHA256,
    '85e419b5f81c489f08a468c6f2084689326aeb9f2ff6306eaa6de0891796ece5',
  );
});

test('description v5 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V5_SHA256,
    '7d18c3b93ab6a64b69e86cc9e8411f7b180810939cb5f47bbe0e5a45b4b504d6',
  );
});

test('description v6 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V6_SHA256,
    '79cc3c02a8aa84b4f7958a3fbf95ffa7c5710822e13211706b4e58d37b284c7a',
  );
});

test('description v7 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V7_SHA256,
    '04ac284118582b65327889abcde5922e2fe96fd0ace41cbb2f3115e83c5deffd',
  );
});

test('description v8 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V8_SHA256,
    '04ac284118582b65327889abcde5922e2fe96fd0ace41cbb2f3115e83c5deffd',
  );
});

test('description v9 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V9_SHA256,
    '5d1a069356fee5c4a83499ce39aabc7e20f4235d6f3fbfacbc48aa5c88bcc9bb',
  );
});

test('description v10 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V10_SHA256,
    '5d1a069356fee5c4a83499ce39aabc7e20f4235d6f3fbfacbc48aa5c88bcc9bb',
  );
});

test('description v11 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V11_SHA256,
    '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b',
  );
});

test('description v12 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V12_SHA256,
    '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b',
  );
});

test('description v13 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V13_SHA256,
    '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b',
  );
});

test('description v14 keeps its frozen fingerprint', () => {
  assert.equal(
    TOOL_DESCRIPTION_V14_SHA256,
    '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b',
  );
});

test('description v10 distinguishes the three public container writers by MIDI routing', () => {
  const descriptions = Object.fromEntries(TOOLS
    .filter((tool) => [
      'compose_device_structure', 'create_device_alternates', 'compose_drum_machine',
    ].includes(tool.name))
    .map((tool) => [tool.name, tool.description]));

  assert.match(descriptions['compose_device_structure'] ?? '', /Instrument Layer/);
  assert.match(descriptions['compose_device_structure'] ?? '', /parallel/);
  assert.match(descriptions['compose_device_structure'] ?? '', /same MIDI input/);
  assert.match(descriptions['compose_device_structure'] ?? '', /does not route MIDI notes/);

  assert.match(descriptions['create_device_alternates'] ?? '', /Instrument Layer, not an Instrument Selector/);
  assert.match(descriptions['create_device_alternates'] ?? '', /Exclusive solo auditions one entry/);
  assert.match(descriptions['create_device_alternates'] ?? '', /does not map MIDI notes/);

  assert.match(descriptions['compose_drum_machine'] ?? '', /per-MIDI-note routing/);
  assert.match(descriptions['compose_drum_machine'] ?? '', /one note reaches one separate pad device/);
});
