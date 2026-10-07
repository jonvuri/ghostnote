/** The public tool descriptions used for the first observation cohort. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ToolClass, ToolSpec } from './tools.js';

export const TOOL_DESCRIPTION_VERSION = 'ghostnote-description-v30';

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
export const DESCRIPTION_COHORT: readonly DescriptionCohortMember[] = [
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

/**
 * v30 (8h4d): the musical and clip surface migration of agent-native-v1. Changing
 * this fingerprint requires a new description version.
 */
export const TOOL_DESCRIPTION_V30_SHA256 =
  '6a8752b90fed22060450e5021b4343cfe643daf59be9611b9135eb637f2e6ccc';
