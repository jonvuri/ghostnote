/**
 * The tool surface — what an agent can actually do, and under which privilege.
 *
 * ## ⚠⚠ The partition is the permission model (D20, as MEASURED by E20c)
 *
 * D20 put destructive verbs on their own annotated tool surface and rested the
 * stop-and-ask on the host's permission flow. E20c measured what the host really
 * does: Claude Code prompts **identically** for every tool, annotated or not —
 * there is no sign the annotations are read at all — and the grain it *does* gate
 * on is the tool **NAME**, per project: *"Yes, and don't ask again for this tool
 * in this project."*
 *
 * Three consequences, and every one of them is built into this file:
 *
 *   1. **The names ARE the partition.** Reading, writing and destroying live on
 *      separately-named tools because a name is what an allow-list keys on.
 *   2. ⚠⚠ **"Don't ask again for this tool" is a blanket grant for that name.**
 *      So a destructive verb must never share a name with a benign one, and must
 *      never be widened later to cover a benign case — the operator may already
 *      have granted it. Widening is a NEW name. `surface.test.ts` asserts the
 *      partition rather than trusting this paragraph.
 *   3. **Annotations stay on and nothing relies on them.** They are correct, they
 *      cost nothing, and a host that starts honouring them makes the seam sharper
 *      rather than different. They are derived from the class below rather than
 *      written per tool, so a tool cannot carry the wrong one.
 *
 * ⚠ Where the line falls, and why it is where it is. **Destroying is removing a
 * container** — a clip, a track, a row, a device — because what is inside it goes
 * too and no record here can rebuild it. **Editing what is inside a clip** is
 * ordinary, because the state it replaces is read and recorded first, and the
 * engine refuses outright when it cannot be. The one crossing is `revert_change`,
 * which may remove a clip it created: putting our own work back is not
 * destruction (D19), it is bounded to what this session wrote and still owns, and
 * a place a person has edited since is reported rather than overwritten.
 *
 * ## ⚠⚠ No mechanism is named here, because none is offered
 *
 * D18c's one-way door: a description that maps the shape of a change onto a
 * mechanism contaminates every branch event recorded afterwards, irrecoverably.
 * This surface has no branch verbs at all, so there is nothing to map onto — which
 * is exactly why it was built before them (session 3d) rather than beside them.
 * `naming.ts` holds the ban as a list something can check.
 *
 * ## ⚠ What the descriptions carry
 *
 * D18c: complete mechanical knowledge — capabilities, costs, traps and correct
 * procedures, as prescriptive as correctness requires — and zero choice-mapping.
 * D18d: lean, with no worked examples, no heuristics and no "typically /
 * recommended" language. Every trap named below is a measured one.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import {
  clip as clipAt, clipLaunch as launchAt, clipPlay as playAt, notes as notesAt,
  param as paramAt, scene as sceneAt, slot as slotAt, track as trackAt, device as deviceAt,
  addressKey, blindCount, blindSpotError, LAUNCH_MODES, LAUNCH_QUANTIZATIONS,
  AddressUnresolvedError, SlotOccupiedError,
  type Address, type ClipAddress, type DeviceSource, type NoteRecord, type Op, type OpKind,
  type RevisionMark,
} from '../contract/index.js';
import { branchProtected, directedDestruction } from '../engine/index.js';
import { selectClip, selectTrack, type Slice } from '../stash/index.js';
import { describeAddress, receiptOf, refusalOf, reversalReport } from './report.js';
import type { Workspace } from './workspace.js';

// --- the shape of a tool -----------------------------------------------------

/**
 * ⚠ The privilege class, and the ONLY thing that decides a tool's annotations.
 * Read tools change nothing; write tools change something they recorded first;
 * destructive tools remove something.
 */
export type ToolClass = 'read' | 'write' | 'destructive';

export interface ToolSpec {
  readonly name: string;
  readonly kind: ToolClass;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodRawShape;
  /**
   * Which kinds of edit this tool can put on the wire — declared as data so the
   * partition can be ASSERTED against what tools actually emit, rather than
   * described in a comment. Empty for a read tool.
   */
  readonly emits: readonly OpKind[];
  run(workspace: Workspace, args: never): Promise<unknown>;
}

/**
 * ⚠ Derived from the class, never written per tool.
 *
 * `idempotentHint` is true only where calling twice really is calling once:
 * reading. A second write is a second change, and a second delete of a clip that
 * is already gone is a refusal, not a no-op.
 */
export const ANNOTATIONS: Readonly<Record<ToolClass, {
  readonly readOnlyHint: boolean;
  readonly destructiveHint: boolean;
  readonly idempotentHint: boolean;
}>> = {
  read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  write: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  destructive: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
};

/**
 * ⚠ The edits that REMOVE something — the line the destructive surface is drawn
 * along, as a set something can check rather than a paragraph someone can forget.
 */
export const REMOVAL_OPS: ReadonlySet<OpKind> = new Set<OpKind>([
  'clip.delete', 'track.delete', 'scene.delete', 'device.delete',
]);

/**
 * ⚠⚠ The ONE crossing, named the way `WIRE_METHODS_BANNED` names its exceptions:
 * a tool on the ordinary write surface that may nonetheless remove something.
 *
 * Adding an entry here is the reviewable act. It should be very hard to justify a
 * second one, because every entry is a name an operator might have granted
 * blanket while believing it could not delete.
 */
export const WRITE_TOOLS_THAT_MAY_REMOVE: Readonly<Record<string, string>> = {
  revert_change:
    'D19: putting our own work back rides the ordinary write surface and is not destruction — '
    + 'and it has to, or a change that removed something could never be undone at all. What '
    + 'makes that safe is structural rather than stated: it can only undo changes THIS session '
    + 'made, and only in places that still hold exactly what that change left, so a clip it '
    + 'removes is one it created and nobody has touched since. Anything else is reported and '
    + 'left alone.',
};

function tool<S extends z.ZodRawShape>(spec: {
  name: string;
  kind: ToolClass;
  title: string;
  description: string;
  inputSchema: S;
  emits?: readonly OpKind[];
  run: (workspace: Workspace, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}): ToolSpec {
  return { emits: [], ...spec } as unknown as ToolSpec;
}

// --- shared input pieces -----------------------------------------------------

const trackId = z.string().describe(
  'The track\'s durable id, from list_tracks. It survives renaming and reordering; a position '
  + 'does not, and is never an address here.',
);

const row = z.number().int().min(0).describe(
  'Which launcher row, counting from 0. Bitwig displays the same scene row as this number plus 1. '
  + 'A row is a position, so adding or removing rows changes what it means — a call made against '
  + 'a stale row number is refused, never guessed at.',
);

const launchQuantization = z.enum(LAUNCH_QUANTIZATIONS).describe(
  'Launch grid: project default, none, or the named beat division.',
);

const launchMode = z.enum(LAUNCH_MODES).describe(
  'Where playback enters the clip. continue_or_synced follows the outgoing clip position on the grid.',
);

const channel = z.number().int().min(0).max(15).optional().describe(
  'MIDI channel within the clip, 0-15. Defaults to 0.',
);

/**
 * ⚠ Every property that can be written, and NOT the one that cannot.
 *
 * `pressure` is absent on purpose: the API accepts it and discards it — the value
 * reaches the writing handle and never the clip — so a caller who set it would
 * see it "work" on a read through the same handle and lose it for real. Leaving
 * it out of the schema is a refusal an agent can see before it calls.
 *
 * `surface.test.ts` checks this list against the property table, so a property
 * promoted to writable does not quietly stay off the surface, and an unwritable
 * one cannot quietly appear on it.
 */
const noteInput = z.object({
  startBeats: z.number().describe('Where the note starts, in beats from the clip start.'),
  pitch: z.number().int().min(0).max(127).describe('MIDI note number, 0-127.'),
  velocity: z.number().min(0).max(127).describe('0-127.'),
  durationBeats: z.number().positive().describe(
    'Length in beats. A note ends where the next note of the same pitch begins, so this can read '
    + 'back shorter than asked for.',
  ),
  releaseVelocity: z.number().min(0).max(1).optional(),
  velocitySpread: z.number().min(0).max(1).optional(),
  gain: z.number().optional().describe(
    'Reads back at twice the value written, and the reverse of that has never been measured — so '
    + 'it is reported as read and never corrected, and a clip holding it cannot be put back '
    + 'exactly.',
  ),
  pan: z.number().min(-1).max(1).optional(),
  timbre: z.number().min(-1).max(1).optional(),
  transpose: z.number().optional(),
  chance: z.number().min(0).max(1).optional(),
  isChanceEnabled: z.boolean().optional(),
  isMuted: z.boolean().optional(),
  isOccurrenceEnabled: z.boolean().optional(),
  occurrence: z.string().optional(),
  isRecurrenceEnabled: z.boolean().optional(),
  recurrence: z.tuple([z.number(), z.number()]).optional().describe(
    'Length and mask together; the API has no way to set one alone.',
  ),
  isRepeatEnabled: z.boolean().optional(),
  repeatCount: z.number().int().optional(),
  repeatCurve: z.number().optional(),
  repeatVelocityCurve: z.number().optional(),
  repeatVelocityEnd: z.number().optional(),
});

type NoteInput = z.infer<typeof noteInput>;

/** The surface's note shape IS the contract's, minus what cannot be written. */
const toNote = (note: NoteInput): NoteRecord => note as NoteRecord;

const scopeInput = z.object({
  trackId: z.string().describe('Restrict to one track.'),
  row: z.number().int().min(0).optional().describe('Restrict further to one clip in that track.'),
}).optional().describe(
  'Narrow this to part of what the change touched. Whatever is left out is untouched.',
);

// --- helpers -----------------------------------------------------------------

/**
 * ⚠ A row address is minted against a mark READ NOW, never remembered.
 *
 * A row created or deleted between two calls moves every row below it, and the
 * adapters refuse an address minted before that rather than resolving it — which
 * is what turns a silent wrong write into a refusal a caller can act on.
 */
const slotOf = (id: string, index: number, at: RevisionMark) =>
  slotAt(trackAt(id), sceneAt(index, at.sceneEpoch));

const clipOf = (id: string, index: number, at: RevisionMark): ClipAddress =>
  clipAt(slotOf(id, index, at));

/** Everything a write tool answers with, refusal or receipt, in one place. */
async function writing<T>(run: () => Promise<T>): Promise<T | ReturnType<typeof refusalOf>> {
  try {
    return await run();
  } catch (error) {
    return refusalOf(error);
  }
}

function sliceFor(
  workspace: Workspace,
  changeId: string,
  scope: { trackId: string; row?: number } | undefined,
): Slice | undefined {
  if (scope === undefined) return undefined;
  const change = workspace.changes.require(changeId);
  const at = change.take.at;
  const addresses = workspace.changes.readSetFor(changeId);
  return scope.row === undefined
    ? selectTrack(addresses, trackAt(scope.trackId))
    : selectClip(addresses, clipOf(scope.trackId, scope.row, at));
}

// --- the tools ---------------------------------------------------------------

export const TOOLS: readonly ToolSpec[] = [
  // ============================== read ======================================
  tool({
    name: 'check_connection',
    kind: 'read',
    title: 'Check the connection to Bitwig',
    description:
      'Confirm Bitwig is running with the ghostnote extension loaded, and report which project '
      + 'is open and how much of it this connection can address. Anything outside what it can '
      + 'address is invisible to every other tool here — not empty, invisible — so a project '
      + 'larger than that is refused rather than worked on half-blind.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => {
        const at = await workspace.mark();
        return {
          reachable: true,
          project: at.project === '' ? null : at.project,
          tracks: coverage(at.window.tracks),
          rows: coverage(at.window.scenes),
        };
      });
    },
  }),

  tool({
    name: 'list_tracks',
    kind: 'read',
    title: 'List the project\'s tracks',
    description:
      'Every track this connection can address, with the id the other tools name it by. The id '
      + 'survives renaming and reordering and is the only durable name a track has: a track that '
      + 'is deleted and made again is a different track with a new id. Tracks beyond what this '
      + 'connection can address are not listed at all, and how many were left out is reported '
      + 'separately — an incomplete list is never presented as a complete one.',
    inputSchema: {},
    async run(workspace) {
      return writing(async () => {
        const [tracks, at] = [await workspace.tracks(), await workspace.mark()];
        const missing = blindCount(at.window.tracks);
        return {
          tracks: tracks.map((t) => ({
            trackId: t.channelId,
            name: t.name,
            kind: t.type,
            position: t.position,
          })),
          rows: coverage(at.window.scenes),
          notListed: missing < 0 ? null : missing,
          notListedWhy: missing === 0
            ? undefined
            : 'these tracks exist and cannot be addressed through this connection. Raise '
              + '`tracks` in ~/.ghostnote/rig.json and reload the controller.',
        };
      });
    },
  }),

  tool({
    name: 'read_clip',
    kind: 'read',
    title: 'Read one clip',
    description:
      'What is in one launcher slot: whether a clip is there, how long it is in beats, and its '
      + 'notes. An empty clip and an absent clip are reported differently, because they are '
      + 'different facts and only one of them can be written into. Notes come back as they read '
      + 'back rather than as anything was asked for — lengths and gain in particular can differ; '
      + 'see write_notes.',
    inputSchema: {
      trackId,
      row,
      channel,
    },
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const clip = clipOf(args.trackId, args.row, at);
        const notesAddress = notesAt(clip, args.channel ?? 0);
        // ⚠ The TRACK is read alongside the slot, and not for symmetry. An id
        // that names nothing reads exactly like an empty slot from here — both
        // are simply absent from the answer — so without this, a mistyped id
        // would come back as the confident, wrong sentence "there is no clip
        // there".
        const trackAddress = trackAt(args.trackId);
        const launchAddress = launchAt(clip);
        const playAddress = playAt(clip);
        const snapshot = await workspace.read([
          trackAddress, clip, notesAddress, launchAddress, playAddress,
        ]);
        const clipEntry = snapshot.entries[addressKey(clip)];
        const notesEntry = snapshot.entries[addressKey(notesAddress)];
        const launchEntry = snapshot.entries[addressKey(launchAddress)];
        const playEntry = snapshot.entries[addressKey(playAddress)];
        const value = clipEntry?.value.of === 'clip' ? clipEntry.value : undefined;
        const where = describeAddress(clip);

        if (snapshot.unreachable.length > 0) {
          return {
            where,
            readable: false,
            why: 'this slot is outside what this connection can address, so it cannot be read. '
              + 'Invisible is not the same as empty, and nothing about it is reported as though '
              + 'it were.',
          };
        }
        if (snapshot.entries[addressKey(trackAddress)] === undefined) {
          return {
            where,
            readable: false,
            why: 'that id does not name a track this connection can see. `list_tracks` reports '
              + 'the ids that exist; a track that was deleted never resolves again.',
          };
        }
        return {
          where,
          readable: true,
          clipExists: value?.exists === true,
          lengthBeats: value?.lengthBeats ?? null,
          notes: notesEntry?.value.of === 'notes' ? notesEntry.value.notes : [],
          launch: launchEntry?.value.of === 'clipLaunch' ? launchEntry.value.launch : null,
          playback: playEntry?.value.of === 'clipPlay' ? playEntry.value.play : null,
        };
      });
    },
  }),

  tool({
    name: 'inspect_clip_block',
    kind: 'read',
    title: 'Inspect a contiguous clip block',
    description:
      'Check a range on one launcher track. Every row in the range is read, along with the slots '
      + 'immediately above and below it. The answer reports whether the range is contiguous and '
      + 'whether both boundaries are empty. A missing row is reported as missing, never empty. '
      + 'Tool rows count from 0; Bitwig scene rows count from 1.',
    inputSchema: {
      trackId,
      firstRow: row.describe('First row in the range, counting from 0.'),
      lastRow: row.describe('Last row in the range, inclusive and counting from 0.'),
    },
    async run(workspace, args) {
      return writing(async () => {
        if (args.firstRow > args.lastRow) {
          return {
            readable: false,
            why: 'firstRow must be less than or equal to lastRow. Nothing was read as a block.',
          };
        }
        const at = await workspace.mark();
        const count = at.window.scenes.count;
        if (count >= 0 && args.lastRow >= count) {
          return {
            readable: false,
            why: 'the range reaches a row that does not exist. Add launcher rows at the end, then '
              + 'inspect the range again.',
            rowsInProject: count,
          };
        }

        const firstRead = Math.max(0, args.firstRow - 1);
        const lastRead = Math.min(
          at.window.scenes.bankSize - 1,
          count < 0 ? args.lastRow + 1 : Math.min(count - 1, args.lastRow + 1),
        );
        const clips = Array.from(
          { length: Math.max(0, lastRead - firstRead + 1) },
          (_, offset) => clipOf(args.trackId, firstRead + offset, at),
        );
        const trackAddress = trackAt(args.trackId);
        const snapshot = await workspace.read([trackAddress, ...clips]);
        if (snapshot.entries[addressKey(trackAddress)] === undefined) {
          return {
            readable: false,
            why: 'that id does not name a track this connection can see. list_tracks reports the '
              + 'ids that exist.',
          };
        }
        if (snapshot.unreachable.length > 0) {
          return {
            readable: false,
            why: 'part of the range is outside the rows this connection can address. Invisible is '
              + 'not the same as empty.',
          };
        }

        const occupied = (index: number): boolean | undefined => {
          const address = clipOf(args.trackId, index, at);
          const entry = snapshot.entries[addressKey(address)];
          return entry?.value.of === 'clip' ? entry.value.exists : undefined;
        };
        const rows = Array.from(
          { length: args.lastRow - args.firstRow + 1 },
          (_, offset) => args.firstRow + offset,
        );
        const above = args.firstRow === 0
          ? 'project-edge'
          : occupied(args.firstRow - 1) === false ? 'empty' : 'occupied';
        const below = count >= 0 && args.lastRow + 1 >= count
          ? 'missing-row'
          : occupied(args.lastRow + 1) === false ? 'empty' : 'occupied';
        const contiguous = rows.every((index) => occupied(index) === true);
        return {
          readable: true,
          range: {
            firstRow: args.firstRow,
            lastRow: args.lastRow,
            firstBitwigSceneRow: args.firstRow + 1,
            lastBitwigSceneRow: args.lastRow + 1,
          },
          rows: rows.map((index) => ({
            row: index,
            bitwigSceneRow: index + 1,
            clipExists: occupied(index) === true,
          })),
          contiguous,
          boundaryAbove: above,
          boundaryBelow: below,
          boundedByEmptySlots: contiguous && above === 'empty' && below === 'empty',
        };
      });
    },
  }),

  tool({
    name: 'list_changes',
    kind: 'read',
    title: 'List what this session changed',
    description:
      'Everything written through this connection since it opened, newest first, with what each '
      + 'change can and cannot put back. This is the whole of what revert_change can undo: edits '
      + 'made before this connection opened, or by a person in Bitwig, are theirs to undo there.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).default(20).optional()
        .describe('How many of the most recent changes to report.'),
    },
    async run(workspace, args) {
      return writing(async () => {
        const summaries = workspace.changes.list().slice(0, args.limit ?? 20);
        return {
          changes: summaries.map((summary) => {
            const change = workspace.changes.get(summary.id);
            const receipt = change === undefined ? undefined : receiptOf(change);
            return {
              changeId: summary.id,
              order: summary.seq,
              applied: summary.applied,
              at: summary.createdAtMs,
              places: receipt?.places ?? [],
              canBeUndone: receipt?.canBeUndone ?? false,
              cannotBeUndone: receipt?.cannotBeUndone ?? [],
            };
          }),
        };
      });
    },
  }),

  tool({
    name: 'check_revert',
    kind: 'read',
    title: 'Check what undoing a change would do',
    description:
      'Report what putting one of this session\'s changes back would restore and what it would '
      + 'not, without altering anything. The answer is the same one revert_change acts on, worked '
      + 'out the same way: every place is compared against what that change left there, and any '
      + 'place a person has edited since — or that has had a clip moved into or out of it, even '
      + 'an identical one — is left alone and reported.',
    inputSchema: {
      changeId: z.string().describe('From list_changes.'),
      scope: scopeInput,
    },
    async run(workspace, args) {
      return writing(async () => {
        const slice = sliceFor(workspace, args.changeId, args.scope);
        const plan = await workspace.planRevert(args.changeId, slice);
        const change = workspace.changes.require(args.changeId);
        return {
          ...reversalReport(plan, change.take.targets),
          wouldWriteAnything: plan.ops.length > 0,
        };
      });
    },
  }),

  // ============================== write =====================================
  tool({
    name: 'copy_clip_down',
    kind: 'write',
    title: 'Copy a clip to the next row',
    description:
      'Copy one launcher clip into the immediately following row on the same track. The '
      + 'destination must already exist and is positively read as empty before the call; an '
      + 'occupied destination is refused because Bitwig would silently replace its clip without '
      + 'an occupancy event. Add rows only at the end with add_scenes when room is missing.\n'
      + 'The source is first set to the requested launch grid and mode, and those settings travel '
      + 'with the copied clip. A person clicking either clip in Bitwig then gets the same launch '
      + 'behaviour. continue_or_synced enters at the outgoing clip position on the grid; that '
      + 'position continuity requires the outgoing clip itself to be on the grid.\n'
      + 'Hands-off cycling is not configured here. Bitwig Next Actions cannot be set, read, or '
      + 'verified through this API. A person must configure them in the Inspector, and this '
      + 'system cannot distinguish configured from unconfigured. Tool row N is Bitwig scene row N+1.',
    inputSchema: {
      trackId,
      row: row.describe('Source row, counting from 0. The destination is row + 1.'),
      quantization: launchQuantization,
      mode: launchMode,
      useLoopStartAsQuantizationReference: z.boolean().default(false).optional().describe(
        'Whether the clip loop start, rather than the project grid, is the quantization reference.',
      ),
    },
    emits: ['clip.launchSettings', 'clip.duplicate'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const destinationRow = args.row + 1;
        if (at.window.scenes.count >= 0 && destinationRow >= at.window.scenes.count) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the destination row does not exist. Add one launcher row at the end with '
              + 'add_scenes, then repeat this call.',
            destination: { row: destinationRow, bitwigSceneRow: destinationRow + 1 },
          };
        }
        const source = clipOf(args.trackId, args.row, at);
        const destination = slotOf(args.trackId, destinationRow, at);
        const snapshot = await workspace.read([
          trackAt(args.trackId), source, clipAt(destination),
        ]);
        if (snapshot.unreachable.length > 0) {
          throw blindSpotError(snapshot.unreachable, at.window);
        }
        const sourceEntry = snapshot.entries[addressKey(source)];
        if (sourceEntry?.value.of !== 'clip' || !sourceEntry.value.exists) {
          throw new AddressUnresolvedError(source, 'the source slot does not contain a clip');
        }
        const destinationEntry = snapshot.entries[addressKey(clipAt(destination))];
        if (destinationEntry?.value.of !== 'clip' || destinationEntry.value.exists) {
          throw new SlotOccupiedError([clipAt(destination)], 'overwrite');
        }

        const quantizationReference = args.useLoopStartAsQuantizationReference ?? false;
        const change = await workspace.apply([
          {
            op: 'clip.launchSettings',
            clip: source,
            quantization: args.quantization,
            mode: args.mode,
            useLoopStartAsQuantizationReference: quantizationReference,
          },
          { op: 'clip.duplicate', source, destination },
          {
            op: 'clip.launchSettings',
            clip: clipAt(destination),
            quantization: args.quantization,
            mode: args.mode,
            useLoopStartAsQuantizationReference: quantizationReference,
          },
        ]);
        const copied = clipAt(destination);
        const verified = await workspace.read([launchAt(copied)]);
        const launchEntry = verified.entries[addressKey(launchAt(copied))];
        const launch = launchEntry?.value.of === 'clipLaunch' ? launchEntry.value.launch : null;
        return {
          ...receiptOf(change),
          copiedTo: {
            trackId: args.trackId,
            row: destinationRow,
            bitwigSceneRow: destinationRow + 1,
          },
          clickLaunch: launch,
          clickLaunchVerified: launch?.quantization === args.quantization
            && launch.mode === args.mode
            && launch.useLoopStartAsQuantizationReference === quantizationReference,
          handsOffCycling:
            'not configured. Next Actions require a person in Bitwig, and their state cannot be read here.',
        };
      });
    },
  }),

  tool({
    name: 'set_clip_launch',
    kind: 'write',
    title: 'Set how clips launch',
    description:
      'Set the per-clip launch grid and mode used by a person clicking clips in Bitwig. The prior '
      + 'values are read and recorded, so this change can be undone. continue_or_synced enters at '
      + 'the outgoing clip position on the grid; that position continuity requires the outgoing '
      + 'clip itself to be on the grid. This does not start playback and does not configure Next '
      + 'Actions.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        quantization: launchQuantization,
        mode: launchMode,
        useLoopStartAsQuantizationReference: z.boolean().default(false).optional(),
      })).min(1),
    },
    emits: ['clip.launchSettings'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((item) => ({
          op: 'clip.launchSettings',
          clip: clipOf(item.trackId, item.row, at),
          quantization: item.quantization,
          mode: item.mode,
          useLoopStartAsQuantizationReference:
            item.useLoopStartAsQuantizationReference ?? false,
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'launch_clip',
    kind: 'write',
    title: 'Launch one clip',
    description:
      'Launch a clip with a per-call grid and mode, then read whether it is queued or playing. '
      + 'This starts the transport. One call performs one switch; it does not keep cycling. '
      + 'continue_or_synced enters at the outgoing clip position on the grid, provided the '
      + 'outgoing clip itself is on that grid.',
    inputSchema: { trackId, row, quantization: launchQuantization, mode: launchMode },
    emits: ['clip.launch'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const clip = clipOf(args.trackId, args.row, at);
        const change = await workspace.apply([{
          op: 'clip.launch',
          clip,
          quantization: args.quantization,
          mode: args.mode,
        }]);
        const snapshot = await workspace.read([playAt(clip)]);
        const entry = snapshot.entries[addressKey(playAt(clip))];
        return {
          ...receiptOf(change),
          playback: entry?.value.of === 'clipPlay' ? entry.value.play : null,
          startsTransport: true,
          oneCallPerSwitch: true,
          positionContinuousOnlyIfOutgoingClipIsOnGrid: true,
        };
      });
    },
  }),

  tool({
    name: 'move_clip_block',
    kind: 'write',
    title: 'Move a contiguous clip block',
    description:
      'Move a contiguous range of clips intact on one track, including clip metadata and '
      + 'automation. Source rows must all hold clips. The destination range and the empty slots '
      + 'directly outside it must already exist unless the upper boundary is the project edge; '
      + 'destination rows outside the source range must be empty. Overlapping moves are ordered '
      + 'from the far edge inward so no clip is replaced.\n'
      + 'Clips have no durable identity, so revert_change does not move them back automatically. '
      + 'The answer supplies the exact reverse call. That reverse is safe only while the old '
      + 'source rows remain empty and the new rows still hold these clips. Tool rows count from '
      + '0; Bitwig scene rows count from 1.',
    inputSchema: {
      trackId,
      firstRow: row.describe('First source row, inclusive.'),
      lastRow: row.describe('Last source row, inclusive.'),
      destinationFirstRow: row.describe('Where the first source clip will land.'),
    },
    emits: ['clip.move'],
    async run(workspace, args) {
      return writing(async () => {
        if (args.firstRow > args.lastRow || args.destinationFirstRow === args.firstRow) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: args.firstRow > args.lastRow
              ? 'firstRow must be less than or equal to lastRow.'
              : 'the source and destination ranges are the same, so there is nothing to move.',
          };
        }
        const at = await workspace.mark();
        const length = args.lastRow - args.firstRow + 1;
        const destinationLastRow = args.destinationFirstRow + length - 1;
        const requiredLastRow = destinationLastRow + 1;
        if (at.window.scenes.count >= 0 && requiredLastRow >= at.window.scenes.count) {
          return {
            refused: true,
            nothingWasWritten: true,
            why: 'the destination range has no existing empty slot below it. Add launcher rows '
              + 'at the end, then inspect and repeat the move.',
            requiredRowsInProject: requiredLastRow + 1,
          };
        }

        const sourceRows = Array.from({ length }, (_, offset) => args.firstRow + offset);
        const destinationRows = Array.from(
          { length }, (_, offset) => args.destinationFirstRow + offset,
        );
        const rowsToRead = [...new Set([
          ...sourceRows,
          ...destinationRows,
          args.destinationFirstRow - 1,
          destinationLastRow + 1,
        ].filter((index) => index >= 0))];
        const clips = rowsToRead.map((index) => clipOf(args.trackId, index, at));
        const snapshot = await workspace.read([trackAt(args.trackId), ...clips]);
        if (snapshot.unreachable.length > 0) {
          throw blindSpotError(snapshot.unreachable, at.window);
        }
        const occupied = (index: number): boolean | undefined => {
          const entry = snapshot.entries[addressKey(clipOf(args.trackId, index, at))];
          return entry?.value.of === 'clip' ? entry.value.exists : undefined;
        };
        if (!sourceRows.every((index) => occupied(index) === true)) {
          const empty = sourceRows.find((index) => occupied(index) !== true)!;
          throw new AddressUnresolvedError(
            clipOf(args.trackId, empty, at),
            'every source row must contain a verified clip',
          );
        }
        const sourceSet = new Set(sourceRows);
        const blocked = destinationRows.filter(
          (index) => !sourceSet.has(index) && occupied(index) !== false,
        );
        const boundaries = [args.destinationFirstRow - 1, destinationLastRow + 1]
          .filter((index) => index >= 0 && !sourceSet.has(index));
        blocked.push(...boundaries.filter((index) => occupied(index) !== false));
        if (blocked.length > 0) {
          throw new SlotOccupiedError(
            [...new Set(blocked)].map((index) => clipOf(args.trackId, index, at)),
            'overwrite',
          );
        }

        const ordered = args.destinationFirstRow > args.firstRow
          ? [...sourceRows].reverse()
          : sourceRows;
        const ops: Op[] = ordered.map((sourceRow) => {
          const offset = sourceRow - args.firstRow;
          return {
            op: 'clip.move',
            source: clipOf(args.trackId, sourceRow, at),
            destination: slotOf(args.trackId, args.destinationFirstRow + offset, at),
          };
        });
        const change = await workspace.apply(ops, {
          clearance: branchProtected(
            `clip-move:${args.trackId}:${args.firstRow}-${args.lastRow}>${args.destinationFirstRow}`,
          ),
        });
        return {
          ...receiptOf(change),
          movedTo: {
            firstRow: args.destinationFirstRow,
            lastRow: destinationLastRow,
            firstBitwigSceneRow: args.destinationFirstRow + 1,
            lastBitwigSceneRow: destinationLastRow + 1,
          },
          reverse: {
            tool: 'move_clip_block',
            trackId: args.trackId,
            firstRow: args.destinationFirstRow,
            lastRow: destinationLastRow,
            destinationFirstRow: args.firstRow,
          },
        };
      });
    },
  }),

  tool({
    name: 'write_notes',
    kind: 'write',
    title: 'Write notes into clips',
    description:
      'Add notes to clips that already exist. Times and lengths are in beats. Several clips in '
      + 'one call are written as one batch, which is both faster and safer than several calls: '
      + 'the whole batch is refused if anything else writes to the project in the middle of it.\n'
      + 'Notes MERGE with what is already in the clip — to replace, erase_notes first.\n'
      + 'Measured behaviour to plan around: a note ends where the next note of the same pitch '
      + 'begins, so a length can come back shorter than asked; gain reads back doubled and is '
      + 'reported rather than corrected; pressure cannot be written through this API at all and '
      + 'is not accepted.\n'
      + 'Writing into a slot with no clip is refused rather than attempted, because pointing at '
      + 'an empty slot lands on a different clip and reports success. Create it with add_clip, '
      + 'which can carry the notes in the same call.\n'
      + 'A write that would replace something whose exact state cannot be recorded first is '
      + 'refused and nothing is written; what is in the way is named in the refusal.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        channel,
        notes: z.array(noteInput).min(1),
      })).min(1),
    },
    emits: ['note.write'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({
          op: 'note.write',
          clip: clipOf(c.trackId, c.row, at),
          ...(c.channel === undefined ? {} : { channel: c.channel }),
          notes: c.notes.map(toNote),
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'erase_notes',
    kind: 'write',
    title: 'Erase notes from clips',
    description:
      'Remove notes from clips that already exist — the whole clip, or a range of beats within '
      + 'it. The clip itself stays; delete_clip removes the clip.\n'
      + 'What was there is read and recorded first, so this can be undone with revert_change. If '
      + 'the notes carry something that cannot be recorded exactly — gain, or a pressure a person '
      + 'authored — the call is refused and nothing is erased, because it could not then be put '
      + 'back.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        channel,
        range: z.object({
          fromBeat: z.number(),
          toBeat: z.number(),
        }).optional().describe('Beats to clear. Absent clears the whole clip channel.'),
      })).min(1),
    },
    emits: ['note.clear'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({
          op: 'note.clear',
          clip: clipOf(c.trackId, c.row, at),
          ...(c.channel === undefined ? {} : { channel: c.channel }),
          ...(c.range === undefined
            ? {}
            : { range: { startBeats: c.range.fromBeat, endBeats: c.range.toBeat } }),
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_clip',
    kind: 'write',
    title: 'Create clips, optionally with notes',
    description:
      'Create a clip in an empty launcher slot, with its notes in the same call if wanted — one '
      + 'batch, and the clip is there before its notes are written.\n'
      + 'A slot that already holds a clip is refused. Bitwig neither refuses that nor overwrites: '
      + 'it appends a row at the end of the project and puts the new clip out there, past what '
      + 'anything can address, where it can be neither reached nor removed. Delete the clip first '
      + 'or name an empty slot.\n'
      + 'Creating a clip can be undone exactly, by removing it again.',
    inputSchema: {
      clips: z.array(z.object({
        trackId,
        row,
        lengthBeats: z.number().positive().describe('The clip\'s length in beats.'),
        notes: z.array(noteInput).optional(),
      })).min(1),
    },
    emits: ['clip.create', 'note.write'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const slots = args.clips.map((c) => slotOf(c.trackId, c.row, at));

        // ⚠ Asked HERE as well as inside the engine, and not out of distrust: the
        // engine reaches the occupancy rule second. A slot holding a clip is a
        // slot holding something that cannot be reproduced exactly — a clip's
        // name, colour and automation have no readback — so the refusal that
        // fires first is the general one about recording, which is true and tells
        // an agent nothing it can act on. This one names the slot.
        const occupied = await workspace.read(slots.map(clipAt));
        const taken = slots.filter((slot) => {
          const entry = occupied.entries[addressKey(clipAt(slot))];
          return entry?.value.of === 'clip' && entry.value.exists;
        });
        if (taken.length > 0) throw new SlotOccupiedError(taken.map(clipAt));

        const ops: Op[] = [];
        for (const [index, c] of args.clips.entries()) {
          const slot = slots[index]!;
          ops.push({ op: 'clip.create', slot, lengthBeats: c.lengthBeats });
          if (c.notes !== undefined && c.notes.length > 0) {
            ops.push({ op: 'note.write', clip: clipAt(slot), notes: c.notes.map(toNote) });
          }
        }
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_track',
    kind: 'write',
    title: 'Create instrument tracks',
    description:
      'Create instrument tracks by name. Where a track lands is not something the API honours, so '
      + 'no position is accepted: the id of each new track is read back after the fact and '
      + 'reported.\n'
      + 'Creating a track is not undone by revert_change. Nothing afterwards proves the track is '
      + 'still only ours, and somebody may have put work in it; removing one is delete_track, '
      + 'which is a separate tool and says what it removes along with the track.',
    inputSchema: {
      names: z.array(z.string().min(1)).min(1).describe('One new track per name.'),
    },
    emits: ['track.create'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.names.map((name) => ({ op: 'track.create', name }));
        const change = await workspace.apply(ops);
        return {
          ...receiptOf(change),
          created: Object.values(change.take.receipt.minted)
            .filter((a: Address) => a.kind === 'track')
            .map(describeAddress),
        };
      });
    },
  }),

  tool({
    name: 'rename_track',
    kind: 'write',
    title: 'Rename tracks',
    description:
      'Rename tracks. A track\'s id does not change with its name, so every address already '
      + 'worked out stays valid. The previous name is recorded and this can be undone.',
    inputSchema: {
      tracks: z.array(z.object({ trackId, name: z.string() })).min(1),
    },
    emits: ['track.rename'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.tracks.map((t) => ({
          op: 'track.rename', track: trackAt(t.trackId), name: t.name,
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'add_scenes',
    kind: 'write',
    title: 'Add launcher rows',
    description:
      'Add rows to the end of the launcher. Every track gains an empty slot in each new row.\n'
      + 'Adding rows moves nothing that already exists, so addresses stay valid — removing one '
      + 'is the direction that moves everything below it.\n'
      + 'Asking for more rows than this connection can address is refused before anything '
      + 'happens, counted over the whole call rather than one row at a time: a row past that '
      + 'point can be neither reached nor removed once it exists.\n'
      + 'Adding rows is not undone by revert_change — the arrangement of rows has no readback.',
    inputSchema: {
      count: z.number().int().min(1).describe('How many rows to add.'),
    },
    emits: ['scene.create'],
    async run(workspace, args) {
      return writing(async () => receiptOf(
        await workspace.apply([{ op: 'scene.create', count: args.count }]),
      ));
    },
  }),

  tool({
    name: 'add_device',
    kind: 'write',
    title: 'Add a device to a track',
    description:
      'Insert a device at the end of a track\'s device list. Three sources: a Bitwig device by '
      + 'id, a plugin by id, or a preset file.\n'
      + 'A preset path must be absolute and must end in `.bwpreset`. A relative path, another '
      + 'extension, or a file that is not there are all accepted by the API and silently do '
      + 'nothing, so all three are refused here before anything is sent.\n'
      + 'Where the device landed is read back rather than assumed. If that reading fails, the '
      + 'insertion is recorded as one that cannot be undone, because removing a counted position '
      + 'could remove a different device.',
    inputSchema: {
      devices: z.array(z.object({
        trackId,
        from: z.enum(['bitwig', 'plugin', 'preset']).describe(
          '`bitwig` and `plugin` name a device by id; `preset` loads a .bwpreset file.',
        ),
        id: z.string().optional().describe('Required for `bitwig` and `plugin`.'),
        path: z.string().optional().describe('Required for `preset`: an absolute .bwpreset path.'),
      })).min(1),
    },
    emits: ['device.insert'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.devices.map((d) => ({
          op: 'device.insert', track: trackAt(d.trackId), source: sourceOf(d),
        }));
        const change = await workspace.apply(ops);
        return {
          ...receiptOf(change),
          added: Object.values(change.take.receipt.minted)
            .filter((a: Address) => a.kind === 'device')
            .map(describeAddress),
        };
      });
    },
  }),

  tool({
    name: 'set_parameter',
    kind: 'write',
    title: 'Set device parameters',
    description:
      'Set a device parameter to a value. A device is named by its position in the track, '
      + 'counting from 0 — that is a position, not an id, and it shifts whenever devices are '
      + 'added or removed, so it is worth reading again after either.\n'
      + 'A parameter something is modulating will not hold a value written here; the reading '
      + 'reported back is what actually landed.',
    inputSchema: {
      settings: z.array(z.object({
        trackId,
        devicePosition: z.number().int().min(0).describe('Position in the track, from 0.'),
        index: z.number().int().min(0).describe('Which parameter of that device.'),
        id: z.string().optional().describe(
          'A plugin\'s own parameter id, where it has one. Required for CLAP plugins, which '
          + 'cannot be reached by index.',
        ),
        value: z.number().describe('Normalised 0..1 unless the device says otherwise.'),
      })).min(1),
    },
    emits: ['param.set'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.settings.map((s) => ({
          op: 'param.set',
          param: paramAt(deviceAt(trackAt(s.trackId), s.devicePosition), s.index, s.id),
          value: s.value,
        }));
        return receiptOf(await workspace.apply(ops));
      });
    },
  }),

  tool({
    name: 'revert_change',
    kind: 'write',
    title: 'Put back what one change replaced',
    description:
      'Undo one of this session\'s own changes, from what it recorded before it ran. Ask for this '
      + 'when the person asks for it.\n'
      + 'It is bounded twice, structurally. Only changes this session made are reversible at all — '
      + 'anything else has no record here. And within one change, only the places that still hold '
      + 'exactly what it left: a place a person edited since, or a slot that has had a clip moved '
      + 'into or out of it — even an identical one — is left untouched and reported. Nothing is '
      + 'overwritten to make an undo tidy.\n'
      + 'What it cannot put back is reported rather than approximated: a rebuilt clip comes back '
      + 'without its name, colour, loop points, launch settings or automation, and a value that '
      + 'cannot be written exactly is reported and left alone.\n'
      + 'check_revert answers the same question without writing.',
    inputSchema: {
      changeId: z.string().describe('From list_changes.'),
      scope: scopeInput,
    },
    // ⚠ It can REMOVE, on the ordinary surface. See this file's header: putting
    // our own work back is not destruction, and the boundary above is what makes
    // that true rather than merely claimed.
    emits: ['clip.create', 'clip.delete', 'note.clear', 'note.write', 'track.rename', 'param.set', 'device.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const slice = sliceFor(workspace, args.changeId, args.scope);
        const plan = await workspace.planRevert(args.changeId, slice);
        const change = workspace.changes.require(args.changeId);
        const report = reversalReport(plan, change.take.targets);
        if (plan.ops.length === 0) {
          return {
            ...report,
            applied: false,
            nothingToPutBack:
              'nothing was written. There is nothing here that is still ours to put back — see '
              + 'what each place says below.',
          };
        }
        // ⚠ The clearance travels with the plan, and must: putting our own work
        // back is the one write the engine's own refusal has to let through, or
        // the changes most worth undoing would be the ones that could not be.
        const applied = await workspace.apply(plan.ops, { clearance: plan.clearance });
        // ⚠ Spelled out rather than spread over the plan's report, because after
        // the fact the tenses differ and one of the two `changeId`s is not the one
        // a reader would assume: an undo is a change of its own, so the receipt
        // names the NEW one and `undoOf` names what it put back.
        const receipt = receiptOf(applied);
        return {
          ...receipt,
          undoOf: args.changeId,
          restored: report.wouldRestore,
          notRestored: report.wouldNotRestore,
          caveats: report.caveats,
        };
      });
    },
  }),

  // ============================ destructive =================================
  // ⚠⚠ Four names, one per thing that can be removed, rather than one `delete`
  // with a kind parameter. The host's "don't ask again for this tool" is a
  // blanket grant on a NAME, so the grain of the naming is the grain of the
  // permission: allowing clip deletion for a project must not also allow track
  // deletion in it.
  //
  // ⚠⚠ Each one carries `directedDestruction`, and that is not a way round the
  // engine's own refusal — it is the only reading of D18c and D20 together that
  // leaves the destructive surface able to run at all. The engine refuses any
  // batch whose prior state cannot be reproduced exactly, which is EVERY deletion
  // of anything that already existed; D20 says of exactly these calls that "the
  // boundary is host-mediated: nothing INSIDE our system gates a directed
  // destructive call", and the direction is the operator answering the host's
  // prompt for this tool name. What the clearance does not touch is the
  // REPORTING: every receipt below still says what it could not put back.
  tool({
    name: 'delete_clip',
    kind: 'destructive',
    title: 'Delete clips',
    description:
      'Remove clips from launcher slots. The slot is left empty; the row stays.\n'
      + 'Each clip\'s notes and length are read and recorded first, so this can be undone — but '
      + 'a clip put back is a new clip carrying the same notes. Its name, colour, loop start and '
      + 'end as distinct from its length, its launch settings and its automation are not '
      + 'recorded by anything here and do not come back.',
    inputSchema: {
      clips: z.array(z.object({ trackId, row })).min(1),
    },
    emits: ['clip.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        const ops: Op[] = args.clips.map((c) => ({ op: 'clip.delete', slot: slotOf(c.trackId, c.row, at) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_clip') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_track',
    kind: 'destructive',
    title: 'Delete tracks',
    description:
      'Remove tracks from the project, with everything on them: every clip, every device, every '
      + 'setting. A track that holds other tracks removes those too.\n'
      + 'This cannot be undone by anything here. A track made again gets a new id, so it is a '
      + 'different track and nothing recorded about the old one can be replayed onto it. What is '
      + 'removed is named back in the answer, by id, so the result can be checked against what '
      + 'was intended.',
    inputSchema: {
      trackIds: z.array(z.string()).min(1).describe('From list_tracks.'),
    },
    emits: ['track.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = args.trackIds.map((id) => ({ op: 'track.delete', track: trackAt(id) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_track') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_scene',
    kind: 'destructive',
    title: 'Delete launcher rows',
    description:
      'Remove launcher rows. Every clip in the row, on every track, goes with it.\n'
      + 'It also moves every row below the deleted one up by one, so every row number worked out '
      + 'before this means something else afterwards. Addresses minted earlier are refused rather '
      + 'than resolved against the new arrangement. Several rows in one call are removed highest '
      + 'first, so the numbers given all refer to the arrangement as it was before the call.\n'
      + 'This cannot be undone by anything here: the arrangement of rows has no readback, so '
      + 'there is nothing recorded to put back.',
    inputSchema: {
      rows: z.array(z.number().int().min(0)).min(1),
    },
    emits: ['scene.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const at = await workspace.mark();
        // ⚠ Highest first. Each removal moves everything below it up, so
        // removing a low row first would make every later number in the same
        // call point one row too far down.
        const rows = [...new Set(args.rows)].sort((a, b) => b - a);
        const ops: Op[] = rows.map((index) => ({ op: 'scene.delete', scene: sceneAt(index, at.sceneEpoch) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_scene') }),
        );
      });
    },
  }),

  tool({
    name: 'delete_device',
    kind: 'destructive',
    title: 'Remove devices from a track',
    description:
      'Remove devices from a track by position, counting from 0.\n'
      + 'This cannot be undone by anything here: a device\'s settings cannot be read back through '
      + 'this API, so nothing recorded could rebuild it.\n'
      + 'Removing a device moves everything after it up one position. Within a single call the '
      + 'higher positions are removed first so the numbers given all refer to the same starting '
      + 'arrangement; across calls, read the positions again.',
    inputSchema: {
      devices: z.array(z.object({
        trackId,
        position: z.number().int().min(0).describe('Position in the track, from 0.'),
      })).min(1),
    },
    emits: ['device.delete'],
    async run(workspace, args) {
      return writing(async () => {
        const ops: Op[] = [...args.devices]
          .sort((a, b) => b.position - a.position)
          .map((d) => ({ op: 'device.delete', device: deviceAt(trackAt(d.trackId), d.position) }));
        return receiptOf(
          await workspace.apply(ops, { clearance: directedDestruction('delete_device') }),
        );
      });
    },
  }),
];

// --- plumbing ----------------------------------------------------------------

const coverage = (c: { count: number; bankSize: number }): {
  addressable: number; inProject: number | null;
} => ({ addressable: c.bankSize, inProject: c.count < 0 ? null : c.count });

function sourceOf(d: { from: string; id?: string; path?: string }): DeviceSource {
  if (d.from === 'preset') {
    if (d.path === undefined) throw new Error('a preset source needs `path`');
    return { from: 'file', path: d.path };
  }
  if (d.id === undefined) throw new Error(`a ${d.from} source needs \`id\``);
  return d.from === 'plugin' ? { from: 'clap', uuid: d.id } : { from: 'bitwig', uuid: d.id };
}

export const toolNamed = (name: string): ToolSpec | undefined => TOOLS.find((t) => t.name === name);

/**
 * Run one tool by name, validating its input first.
 *
 * ⚠ The same path the server uses, so a case that passes here is a case that
 * passes over the wire — the whole reason the tools are data rather than
 * registrations.
 */
export async function callTool(
  workspace: Workspace,
  name: string,
  args: unknown = {},
): Promise<unknown> {
  const spec = toolNamed(name);
  if (spec === undefined) throw new Error(`no such tool: ${name}`);
  const parsed = z.object(spec.inputSchema).parse(args);
  return spec.run(workspace, parsed as never);
}

/** Put every tool on an MCP server, with the annotations its class implies. */
export function registerTools(server: McpServer, workspace: Workspace): void {
  for (const spec of TOOLS) {
    server.registerTool(
      spec.name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: ANNOTATIONS[spec.kind],
      },
      async (args: unknown) => ({
        content: [{
          type: 'text' as const,
          text: JSON.stringify(await spec.run(workspace, args as never)),
        }],
      }),
    );
  }
}
