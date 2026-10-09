/** The public tool descriptions used for the first observation cohort. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ToolClass, ToolSpec } from './tools.js';

export const TOOL_DESCRIPTION_VERSION = 'ghostnote-description-v40';

export interface DescriptionCohortMember {
  readonly name: string;
  readonly kind: ToolClass;
  readonly reason: string;
}

/**
 * This list is the complete v1 cohort. It includes only the two support tools
 * whose wording is part of a required cohort procedure.
 */
export const DESCRIPTION_COHORT_V1: readonly DescriptionCohortMember[] = [
  {
    name: 'inspect_device_alternates', kind: 'read',
    reason: 'Reads the managed device-alternate object.',
  },
  {
    name: 'create_device_alternates', kind: 'write',
    reason: 'Creates the managed device-alternate object.',
  },
  {
    name: 'fill_device_alternate', kind: 'write',
    reason: 'Fills the managed device-alternate object.',
  },
  {
    name: 'switch_device_alternate', kind: 'write',
    reason: 'Switches the managed device-alternate object.',
  },
  {
    name: 'keep_device_alternate', kind: 'destructive',
    reason: 'Collapses the managed device-alternate object.',
  },
  {
    name: 'remove_device_alternate', kind: 'destructive',
    reason: 'Reduces the managed device-alternate object.',
  },
  {
    name: 'inspect_clip_block', kind: 'read',
    reason: 'Reads the managed clip-block object.',
  },
  {
    name: 'copy_clip_down', kind: 'write',
    reason: 'Creates the managed clip-block object.',
  },
  {
    name: 'set_clip_launch', kind: 'write',
    reason: 'Sets clip-block launch behavior.',
  },
  {
    name: 'launch_clip', kind: 'write',
    reason: 'Switches playback between launcher clips.',
  },
  {
    name: 'move_clip_block', kind: 'write',
    reason: 'Moves the managed clip-block object.',
  },
  {
    name: 'delete_clip', kind: 'destructive',
    reason: 'Reduces the managed clip-block object.',
  },
  {
    name: 'copy_track', kind: 'write',
    reason: 'Provides the ordinary coarse-copy comparison.',
  },
  {
    name: 'add_scenes', kind: 'write',
    reason: 'Provides the required missing-row procedure for clip blocks.',
  },
  {
    name: 'delete_track', kind: 'destructive',
    reason: 'Provides the directed cleanup seam for an ordinary track copy.',
  },
] as const;

/** v2 keeps the frozen v1 artifact and adds the musical path and its procedures. */
export const DESCRIPTION_COHORT_V2: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V1,
  {
    name: 'list_tracks', kind: 'read',
    reason: 'Provides durable target ids for both musical write tools.',
  },
  {
    name: 'read_clip', kind: 'read',
    reason: 'Reads musical inputs and verifies public musical outputs.',
  },
  {
    name: 'write_notes', kind: 'write',
    reason: 'Keeps exact low-level note writes beside the musical tools.',
  },
  {
    name: 'erase_notes', kind: 'write',
    reason: 'Keeps exact low-level clip-wide note removal separate.',
  },
  {
    name: 'add_clip', kind: 'write',
    reason: 'Keeps exact empty clip-container creation outside both musical tools.',
  },
  {
    name: 'generate_clip_music', kind: 'write',
    reason: 'Generates musical content through the shared patch planner.',
  },
  {
    name: 'transform_clip_music', kind: 'write',
    reason: 'Transforms musical content through the shared patch planner.',
  },
  {
    name: 'list_changes', kind: 'read',
    reason: 'Lists recorded changes used by the musical result procedures.',
  },
  {
    name: 'revert_change', kind: 'write',
    reason: 'Provides the bounded reversal procedure for musical changes.',
  },
  {
    name: 'show_changed_clip', kind: 'focus',
    reason: 'Opens one verified musical result in the clip editor.',
  },
  {
    name: 'record_observation', kind: 'write',
    reason: 'Links raw musical instructions and explicit operator responses.',
  },
  {
    name: 'read_observation_record', kind: 'read',
    reason: 'Preserves raw musical tool choice and usefulness evidence.',
  },
  {
    name: 'report_observations', kind: 'read',
    reason: 'Reports musical tool use beside explicit operator responses.',
  },
] as const;

/** v3 adds explicit completion and cancellation for long musical calls. */
export const DESCRIPTION_COHORT_V3: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V2,
  {
    name: 'start_clip_music_operation', kind: 'write',
    reason: 'Starts long musical work without holding one client request open.',
  },
  {
    name: 'inspect_clip_music_operation', kind: 'read',
    reason: 'Reports terminal completion or cancellation before recovery starts.',
  },
  {
    name: 'cancel_clip_music_operation', kind: 'write',
    reason: 'Requests an explicit stop and distinguishes it from a client timeout.',
  },
] as const;

/** v4 adds wall-clock timing to operation status results. */
export const DESCRIPTION_COHORT_V4: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V3,
] as const;

/** v5 adds the measured public device and parameter surface. */
export const DESCRIPTION_COHORT_V5: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V4,
  {
    name: 'inspect_devices', kind: 'read',
    reason: 'Reads complete positional device-chain state and bank coverage.',
  },
  {
    name: 'inspect_device_parameters', kind: 'read',
    reason: 'Discovers DirectParameter ids, typed metadata, and remote controls.',
  },
  {
    name: 'add_device', kind: 'write',
    reason: 'Inserts explicit native, VST3, CLAP, and preset sources.',
  },
  {
    name: 'set_parameter', kind: 'write',
    reason: 'Writes returned parameter selectors with exact readback.',
  },
  {
    name: 'set_device_enabled', kind: 'write',
    reason: 'Writes exact device enabled or bypass state.',
  },
  {
    name: 'delete_device', kind: 'destructive',
    reason: 'Keeps directed unreconstructable device removal separate.',
  },
] as const;

/** v6 adds public modulator authoring. */
export const DESCRIPTION_COHORT_V6: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V5,
  {
    name: 'author_modulators', kind: 'write',
    reason: 'Authors named preset modulator edits with exact live verification.',
  },
] as const;

/** v7 adds owned public device-structure composition. */
export const DESCRIPTION_COHORT_V7: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V6,
  {
    name: 'compose_device_structure', kind: 'write',
    reason: 'Creates one complete named native-device and modulation structure.',
  },
] as const;

/** v8 replaces recurrence tuples with host-compatible exact-length arrays. */
export const DESCRIPTION_COHORT_V8: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V7,
] as const;

/** v9 adds native per-note Drum Machine composition. */
export const DESCRIPTION_COHORT_V9: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V8,
  {
    name: 'compose_drum_machine', kind: 'write',
    reason: 'Creates one native Drum Machine with separate per-note pad routing.',
  },
] as const;

/** v10 states container execution, MIDI routing, and the writable note grid. */
export const DESCRIPTION_COHORT_V10: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V9,
] as const;

/** v11 adds exact-name top-level native insertion. */
export const DESCRIPTION_COHORT_V11: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V10,
  {
    name: 'add_native_devices', kind: 'write',
    reason: 'Appends ordered top-level native devices by exact catalog name.',
  },
] as const;

/** v12 adds discrete DirectParameter domains and complete integrity checks. */
export const DESCRIPTION_COHORT_V12: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V11,
] as const;

/** v13 adds explicit write-once enrichment and partial verdicts. */
export const DESCRIPTION_COHORT_V13: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V12,
] as const;

/** v14 replaces fixed modulation targets with exact DirectParameter identity. */
export const DESCRIPTION_COHORT_V14: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V13,
] as const;

/** v15 adds read-only semantic preset modulation inspection. */
export const DESCRIPTION_COHORT_V15: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V14,
  {
    name: 'inspect_preset_modulation', kind: 'read',
    reason: 'Binds preset modulator inventories to semantic device locations.',
  },
] as const;

/** v16 adds the manifest-backed modulator catalog. */
export const DESCRIPTION_COHORT_V16: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V15,
  {
    name: 'list_modulator_types', kind: 'read',
    reason: 'Publishes exact donor support, host inventory, tiers, and witness requirements.',
  },
] as const;

/** v17 publishes fingerprinted semantic authoring with all five editors. */
export const DESCRIPTION_COHORT_V17: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V16,
] as const;

/** v18 adds the existing-device modulation wrapper and its guarded reversal. */
export const DESCRIPTION_COHORT_V18: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V17,
  {
    name: 'wrap_existing_device_modulation', kind: 'write',
    reason: 'Moves one existing device into an owned modulated FX Layer.',
  },
  {
    name: 'reverse_existing_device_modulation_wrap', kind: 'write',
    reason: 'Restores that device and removes only its empty owned container.',
  },
] as const;

/** v19 adds general device-source composition and guarded reversal. */
export const DESCRIPTION_COHORT_V19: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V18,
  {
    name: 'compose_device_sources', kind: 'write',
    reason: 'Composes named native, plug-in, preset, and existing device sources.',
  },
  {
    name: 'reverse_device_source_composition', kind: 'write',
    reason: 'Restores existing sources and removes only owned composition devices.',
  },
] as const;

/** v20 publishes bounded container shapes and capacities. */
export const DESCRIPTION_COHORT_V20: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V19,
] as const;

/** v21 publishes explicit parameter value capabilities and semantic refusal. */
export const DESCRIPTION_COHORT_V21: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V20,
] as const;

/** v22 publishes the measured fine note timing family. */
export const DESCRIPTION_COHORT_V22: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V21,
] as const;

/** v23 through v25 keep this stable cohort. Their artifacts use the stable tool list. */
export const DESCRIPTION_COHORT_V25: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V22,
] as const;

/**
 * v26 (8h4b) adds the agent-native-v1 document read and its check. Build the
 * v26 artifact from the agent-native-v1 tool list; the stable members are
 * unchanged. v27 (8h4b2) keeps this cohort. It changes the read wording (the
 * loss block, the uncovered fields, and gain at -inf dB) and the model
 * reference revision 2 (release velocity default 100/127, gain 0..8).
 */
export const DESCRIPTION_COHORT_V27: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V25,
  {
    name: 'read_launcher_clip', kind: 'read',
    reason: 'Reads one Launcher clip as a Document 1.0 snapshot with a base ref.',
  },
  {
    name: 'check_launcher_clips', kind: 'read',
    reason: 'Checks base refs with the D32 verdict and the identity registry.',
  },
] as const;

/**
 * v28 (8h4c) adds the guarded document edit limb. The read wording adds the
 * stored overlays and envelope. v29 (8h4c2) keeps this cohort.
 */
export const DESCRIPTION_COHORT_V29: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V27,
  {
    name: 'edit_launcher_clip', kind: 'write',
    reason: 'Edits one Launcher clip with a guarded Document 1.0 patch or desired document.',
  },
] as const;

/** The v29 members that 8h4d retired from agent-native-v1. */
const RETIRED_IN_V30 = new Set([
  'inspect_clip_block', 'copy_clip_down', 'set_clip_launch', 'move_clip_block', 'delete_clip', 'read_clip',
  'write_notes', 'erase_notes', 'add_clip', 'generate_clip_music', 'transform_clip_music', 'show_changed_clip',
  'record_observation', 'read_observation_record', 'report_observations', 'start_clip_music_operation',
  'inspect_clip_music_operation', 'cancel_clip_music_operation',
]);

/**
 * v30 (8h4d): agent-native-v1 retires the old musical tools and the observation workflow, renames the Launcher
 * clip tools, moves launch_clip, add_scenes, and delete_scene to the shared result module, and adds the generic
 * operation handle. edit_launcher_clip gains background.
 */
export const DESCRIPTION_COHORT_V30: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V29.filter((member) => !RETIRED_IN_V30.has(member.name)),
  {
    name: 'add_launcher_clip', kind: 'write',
    reason: 'Creates one Launcher clip from a desired Document 1.0 through the edit limb.',
  },
  {
    name: 'copy_launcher_clips', kind: 'write',
    reason: 'Copies Launcher clips with occupancy guards; replaces copy_clip_down and inspect_clip_block.',
  },
  {
    name: 'move_launcher_clips', kind: 'write',
    reason: 'Moves a range of Launcher clips with occupancy guards; replaces move_clip_block.',
  },
  {
    name: 'set_launcher_clip_launch_settings', kind: 'write',
    reason: 'Sets Launcher clip launch settings; replaces set_clip_launch.',
  },
  {
    name: 'set_launcher_clip_properties', kind: 'write',
    reason: 'Sets Launcher clip properties through the writer of edit_launcher_clip.',
  },
  {
    name: 'delete_launcher_clip', kind: 'destructive',
    reason: 'Deletes Launcher clips under a separate destructive name.',
  },
  {
    name: 'show_launcher_clip_in_detail_editor', kind: 'focus',
    reason: 'Opens one Launcher clip in the detail editor; replaces show_changed_clip.',
  },
  {
    name: 'inspect_operation', kind: 'read',
    reason: 'Reads a background operation of a long edit or add.',
  },
  {
    name: 'cancel_operation', kind: 'write',
    reason: 'Cancels a background operation before its next project write.',
  },
] as const;

/** The v30 members that 8h4e retired from agent-native-v1 (the device-alternate lifecycle and the old device names). */
const RETIRED_IN_V31 = new Set([
  'inspect_device_alternates', 'create_device_alternates', 'fill_device_alternate', 'switch_device_alternate',
  'keep_device_alternate', 'remove_device_alternate', 'inspect_devices', 'inspect_device_parameters', 'add_device',
  'set_parameter', 'author_modulators', 'compose_device_structure', 'compose_drum_machine', 'add_native_devices',
  'inspect_preset_modulation', 'compose_device_sources', 'reverse_device_source_composition',
]);

/**
 * v31 (8h4e): agent-native-v1 replaces the device-alternate lifecycle with read_devices and the generic layer-chain
 * limbs (D18), renames the device control and preset modulation tools, merges device insertion and composition,
 * and reports DirectParameter display text (E244). set_device_enabled, wrap_existing_device_modulation,
 * delete_device, revert_change, and check_revert change in place. Frozen in 8h4f.
 */
export const DESCRIPTION_COHORT_V31: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V30.filter((member) => !RETIRED_IN_V31.has(member.name)),
  {
    name: 'read_devices', kind: 'read',
    reason: 'Reads the top-level devices and the layer chains of containers; replaces inspect_devices and inspect_device_alternates.',
  },
  {
    name: 'read_device_controls', kind: 'read',
    reason: 'Reads DirectParameters with display text, or remote pages; replaces inspect_device_parameters.',
  },
  {
    name: 'set_device_controls', kind: 'write',
    reason: 'Writes DirectParameters and remote controls in verified cohorts; replaces set_parameter.',
  },
  {
    name: 'read_preset_modulation', kind: 'read',
    reason: 'Reads the modulators of one saved preset; replaces inspect_preset_modulation.',
  },
  {
    name: 'edit_preset_modulation', kind: 'write',
    reason: 'Inserts an edited copy of one saved preset; replaces author_modulators.',
  },
  {
    name: 'add_devices', kind: 'write',
    reason: 'Appends devices from explicit sources; merges add_device and add_native_devices.',
  },
  {
    name: 'compose_devices', kind: 'write',
    reason: 'Creates one complete container through a private offline or staged backend; merges three composers.',
  },
  {
    name: 'duplicate_layer_chain', kind: 'write',
    reason: 'Copies one layer chain to a new unique name: the A/B branch limb.',
  },
  {
    name: 'rename_layer_chain', kind: 'write',
    reason: 'Gives one layer chain a new durable name.',
  },
  {
    name: 'move_devices', kind: 'write',
    reason: 'Moves devices between the track and layer chains; the winner-collapse limb.',
  },
  {
    name: 'copy_devices', kind: 'write',
    reason: 'Copies devices into a layer chain as new instances.',
  },
  {
    name: 'set_layer_chain_solo', kind: 'write',
    reason: 'Sets exclusive, on, or off layer-chain solo: the A/B audition limb.',
  },
] as const;

/** The reasons of the v32 members that are not in v31 (8h4f). */
const ADDED_IN_V32: Readonly<Record<string, DescriptionCohortMember>> = {
  check_bitwig_connection: { name: 'check_bitwig_connection', kind: 'read',
    reason: 'Checks the extension build, the open project, and the address window before work; replaces check_connection.' },
  check_revert: { name: 'check_revert', kind: 'read',
    reason: 'Reads what a reversal would restore and what it would not, without a write.' },
  add_tracks: { name: 'add_tracks', kind: 'write',
    reason: 'Creates named instrument or audio tracks (E239); replaces add_track.' },
  duplicate_track: { name: 'duplicate_track', kind: 'write',
    reason: 'Duplicates one Instrument, Audio, or Hybrid track (E239); replaces copy_track.' },
  rename_track: { name: 'rename_track', kind: 'write',
    reason: 'Renames tracks; the trackId does not change.' },
  delete_scene: { name: 'delete_scene', kind: 'destructive',
    reason: 'Deletes scenes with every clip in them; a separate destructive name (D20).' },
};

/** The v32 tool list (8h4f), in profile order. */
const COHORT_V32_NAMES = [
  'list_modulator_types', 'check_bitwig_connection', 'list_tracks', 'list_changes', 'check_revert', 'launch_clip',
  'add_tracks', 'duplicate_track', 'rename_track', 'add_scenes', 'wrap_existing_device_modulation',
  'reverse_existing_device_modulation_wrap', 'set_device_enabled', 'revert_change', 'delete_track', 'delete_scene',
  'delete_device', 'read_launcher_clip', 'check_launcher_clips', 'edit_launcher_clip', 'add_launcher_clip',
  'copy_launcher_clips', 'move_launcher_clips', 'set_launcher_clip_launch_settings', 'set_launcher_clip_properties',
  'delete_launcher_clip', 'show_launcher_clip_in_detail_editor', 'inspect_operation', 'cancel_operation',
  'read_devices', 'read_device_controls', 'set_device_controls', 'read_preset_modulation', 'edit_preset_modulation',
  'add_devices', 'compose_devices', 'duplicate_layer_chain', 'rename_layer_chain', 'move_devices', 'copy_devices',
  'set_layer_chain_solo',
] as const;

/**
 * v32 (8h4f): agent-native-v1 is the default profile, and the cohort is its complete tool list in profile order.
 * Every retained tool is on the shared result module; check_connection, add_track, and copy_track take the names
 * check_bitwig_connection, add_tracks, and duplicate_track. Frozen in 8h4g.
 */
export const DESCRIPTION_COHORT_V32: readonly DescriptionCohortMember[] = COHORT_V32_NAMES.map((name) => {
  const member = DESCRIPTION_COHORT_V31.find((item) => item.name === name) ?? ADDED_IN_V32[name];
  if (member === undefined) throw new Error(`description v32 member has no reason: ${name}`);
  return member;
});

/** The v32 members that 8h4g retired from agent-native-v1: the background route ends (D39 amendment, E247). */
const RETIRED_IN_V33 = new Set(['inspect_operation', 'cancel_operation']);

/**
 * v33 (8h4g): edit_launcher_clip and add_launcher_clip have no background flag, and inspect_operation and
 * cancel_operation leave the list. The edit description states the measured worst case (about 7 s, E248).
 * v34 (8i0, D42) keeps this list. set_launcher_clip_properties and edit_launcher_clip accept any colour, write
 * only the changed properties, and have no clip-colour refusal. v35 (8i1, D43) keeps this list;
 * check_bitwig_connection refuses an unpinned Ghostnote cursor. v36 (8i3, D44) keeps this list; the long writes
 * state their measured costs and D44 limits, and the clip batch schemas have no maxItems (the limit refuses with
 * code outside-limit). wrap_existing_device_modulation has its own agent-native-v1 text. v37 (8i3 limit
 * follow-up) keeps this list; each bounded input states its D44 limit in its schema text. v38 (8i4, D45) keeps
 * this list; edit_launcher_clip computes the dependency basis of each claim that the call states. v39 (8i5, D46)
 * keeps this list; the modulation writers claim the authored route, not observed activity. v40 (8i5 review) keeps
 * this list; they check the target id and name after the write.
 */
export const DESCRIPTION_COHORT: readonly DescriptionCohortMember[] =
  DESCRIPTION_COHORT_V32.filter((member) => !RETIRED_IN_V33.has(member.name));

interface ToolAnnotations {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
}

export type DescriptionCohortArtifact = readonly {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly annotations: ToolAnnotations;
  readonly resultContract?: unknown;
}[];

/** Build the versioned public fields that an MCP client receives. */
export function descriptionCohortArtifact(
  tools: readonly ToolSpec[],
  annotations: Readonly<Record<ToolClass, ToolAnnotations>>,
  cohort: readonly DescriptionCohortMember[] = DESCRIPTION_COHORT,
): DescriptionCohortArtifact {
  return cohort.map((member) => {
    const spec = tools.find((candidate) => candidate.name === member.name);
    if (spec === undefined) throw new Error(`description cohort tool is missing: ${member.name}`);
    if (spec.kind !== member.kind) {
      throw new Error(`description cohort privilege changed: ${member.name}`);
    }
    return {
      name: spec.name,
      title: spec.title,
      description: spec.description,
      inputSchema: z.toJSONSchema(spec.inputValidator ?? z.object(spec.inputSchema), {
        target: 'draft-7',
        io: 'input',
      }),
      annotations: annotations[spec.kind],
      ...(spec.resultContract === undefined ? {} : { resultContract: spec.resultContract }),
    };
  });
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

/** Encode an artifact with stable object-key order. Array order stays significant. */
export const encodeDescriptionCohort = (artifact: DescriptionCohortArtifact): string =>
  JSON.stringify(canonicalValue(artifact));

export const fingerprintDescriptionCohort = (artifact: DescriptionCohortArtifact): string =>
  createHash('sha256').update(encodeDescriptionCohort(artifact), 'utf8').digest('hex');

// V1 through V25 record shipped artifacts. Do not recompute them from current
// tool schemas. Only the current version follows the current public surface.

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V1_SHA256 =
  '9c4951a4f290c679cc9ae7222b8b4d12c6a581ed140936a1d625eafe2c562a39';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V2_SHA256 =
  '64573f3c3426524fe30088c881918edb79823ad22e27dd0b37c4384c08bbdaf0';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V3_SHA256 =
  '85e419b5f81c489f08a468c6f2084689326aeb9f2ff6306eaa6de0891796ece5';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V4_SHA256 =
  '85e419b5f81c489f08a468c6f2084689326aeb9f2ff6306eaa6de0891796ece5';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V5_SHA256 =
  '7d18c3b93ab6a64b69e86cc9e8411f7b180810939cb5f47bbe0e5a45b4b504d6';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V6_SHA256 =
  '79cc3c02a8aa84b4f7958a3fbf95ffa7c5710822e13211706b4e58d37b284c7a';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V7_SHA256 =
  '04ac284118582b65327889abcde5922e2fe96fd0ace41cbb2f3115e83c5deffd';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V8_SHA256 =
  '04ac284118582b65327889abcde5922e2fe96fd0ace41cbb2f3115e83c5deffd';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V9_SHA256 =
  '5d1a069356fee5c4a83499ce39aabc7e20f4235d6f3fbfacbc48aa5c88bcc9bb';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V10_SHA256 =
  '5d1a069356fee5c4a83499ce39aabc7e20f4235d6f3fbfacbc48aa5c88bcc9bb';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V11_SHA256 =
  '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V12_SHA256 =
  '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V13_SHA256 =
  '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V14_SHA256 =
  '5e814cce18db34f76fe975fa3ecf8df07b35d28c79f68553d06f6933bf160f2b';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V15_SHA256 =
  'c9bc6a2a64b5b458fefd7be183d53bb4ba8b4a9e895f16930bab28e6fbe660ab';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V16_SHA256 =
  '6007b05597f401b487b12a67091610b797b1534d2ae7a9cdd6aac14e3e774b66';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V17_SHA256 =
  '7bd3bc42aa7bbf6793e0b40dcef40967aa7381eeb99b867ea748ffd4283117fe';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V18_SHA256 =
  '56e8db1cb0ceb56579400b00e0011622054bd7a1ef9a042787937f4ed6dbd3ae';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V19_SHA256 =
  'b2c9a1c4f9e4dfd6e202821da94e5a25a4f4218fd46e3b4c0eef33c714a4fdd1';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V20_SHA256 =
  'bfa88cb58ebcf59058b570454623d3fa7d2a28d0923ac3d25320dc50587ec776';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V21_SHA256 =
  '368e3f50b8807f716e59a6b668c9352b22f9301041627a21c4918deae70b161a';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V22_SHA256 =
  '7d811a03db1f89b9eb48952eec7ad2262ff5f6e058ff444208019e77c007c6e7';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V23_SHA256 =
  '42ca40e9da079d22e8db3c969cad3f6742fcce36b023d245376f7e456027b703';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V24_SHA256 =
  'a7369426e25fb10b123209fb9b2bbe37c306daee1e7bc6557925436f47992c0e';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V25_SHA256 =
  '5743ab008ef486a8d597289ced0052c97aafcea5df84283bc7ffcc41cd8b4321';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V26_SHA256 =
  '9ef5f402e46c3127f911f10eed20a3bf1bde302f76aebeaef177f9973f5a39f6';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V27_SHA256 =
  '44c8e346ee9ef9d6905550c2fb62af4cbea3dff87abb154c96f979a68c930452';

/** Changing this fingerprint requires a new description version. */
export const TOOL_DESCRIPTION_V28_SHA256 =
  '46f4230b84944d354ca0f38e4b3a8f0c17b6e0c2c23a56f4cc525168a933063b';

/**
 * v29 (8h4c2): a new note keeps the host value for a default field, and the
 * read and edit descriptions name the reader sounding-cell limit. Frozen in 8h4d.
 */
export const TOOL_DESCRIPTION_V29_SHA256 =
  'bfaa24dbef2614da391aa9978dcab6eb155441b87ead37111f5fc7179a401740';

/** v30 (8h4d): the musical and clip surface migration of agent-native-v1. Frozen in 8h4e. */
export const TOOL_DESCRIPTION_V30_SHA256 =
  '6a8752b90fed22060450e5021b4343cfe643daf59be9611b9135eb637f2e6ccc';

/**
 * v31 (8h4e): the device structure migration of agent-native-v1. Changing this fingerprint requires a new
 * description version.
 */
export const TOOL_DESCRIPTION_V31_SHA256 =
  '4bb28d29ed289b3b10b58192d684ce9759fa2a0c9cc68102b5431ce2b0cf3781';

/** v32 (8h4f): the complete default agent-native-v1 list on the shared result module. Frozen in 8h4g. */
export const TOOL_DESCRIPTION_V32_SHA256 =
  'ab830bd293117fd58ac546c6f8748966ed18c51b3c604fe866fdec7860f5adbf';

/** v33 (8h4g): the default agent-native-v1 list without the background route. Frozen in 8i0. */
export const TOOL_DESCRIPTION_V33_SHA256 =
  '5c65c71e05feb2e4cdce54e65f04f87b71503e63d34e683e66d852dccc480213';

/** v34 (8i0, D42): any clip colour within one byte, and owned clip property writes. Frozen in 8i1. */
export const TOOL_DESCRIPTION_V34_SHA256 =
  '37d1f310b31f9d5c3ac9b4657d1f2fd9406f47c28d6f0280181fec75b011c702';

/**
 * v35 (8i1, D43): check_bitwig_connection reports an unpinned Ghostnote cursor as unhealthy. Changing this
 * fingerprint requires a new description version.
 */
export const TOOL_DESCRIPTION_V35_SHA256 =
  '257d1edead8799bd8c58f4ad5e3c9eb3410ad56e69a2df07e88ec5456224119d';

/** v36 (8i3, D44): the long writes state their measured costs and limits. Frozen in the 8i3 limit follow-up. */
export const TOOL_DESCRIPTION_V36_SHA256 =
  'c6cca5b30f68f9770e6a241dc1e85a1553c2a813e60930c45cb9eaf00983f158';

/**
 * v37 (8i3 limit follow-up, D44): set_device_controls admits 4 device routes and delete_device 10 devices; each
 * bounded input states its limit in its schema text; move_launcher_clips states its 8-row limit. Frozen in 8i4.
 */
export const TOOL_DESCRIPTION_V37_SHA256 =
  '1919de648c039ef1592ae3ec3f1510ea7f16793f36ecd2dbda9cee62f26b9a6e';

/**
 * v38 (8i4, D45): edit_launcher_clip is the dependency-basis utility. A current claim that the call states can omit
 * basis; a supplied basis that does not match refuses with the expected basis. Frozen in 8i5.
 */
export const TOOL_DESCRIPTION_V38_SHA256 =
  'e0b209ebc81b481b82f25c7dd2e387f430b688310430bebee263ec059d58d14b';

/**
 * v39 (8i5, D46): the three modulation writers run no behavior witness and refuse an unproved route form;
 * edit_preset_modulation and compose_devices have no behavior input; a remote control position is its host slot;
 * read_launcher_clip asks for Patch help on the first read before a patch edit. Frozen in the 8i5 review (the
 * fresh agent trial used it).
 */
export const TOOL_DESCRIPTION_V39_SHA256 =
  'ce0220421765f2ae41c6e27ee70b7b7a4884299dddf83313b846a61e4b2bccbd';

/**
 * v40 (8i5 review, D46): the modulation writers check the exact target id and name after the write; a missing or
 * renamed target fails at readback. Changing this fingerprint requires a new description version.
 */
export const TOOL_DESCRIPTION_V40_SHA256 =
  '4ed97c6716c4c6bb5ab9301010891ff93d11205ea4237a906bd92e3447566779';
