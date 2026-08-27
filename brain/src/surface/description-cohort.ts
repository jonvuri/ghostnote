/** The public tool descriptions used for the first observation cohort. */
import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { ToolClass, ToolSpec } from './tools.js';

export const TOOL_DESCRIPTION_VERSION = 'ghostnote-description-v14';

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
export const DESCRIPTION_COHORT: readonly DescriptionCohortMember[] = [
  ...DESCRIPTION_COHORT_V13,
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
