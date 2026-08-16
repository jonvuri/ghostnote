/**
 * What a tool is allowed to reach — and, just as much, what it is not.
 *
 * ## ⚠⚠ Why this is an interface and not just `Session`
 *
 * Session 3's B3 is *"record every take"*, and the reason it was still owed is
 * that nothing in production called the engine at all. Wiring it by hand — every
 * tool calling `executor.run` and then remembering `stash.record` — would satisfy
 * the letter of B3 on the day it was written and fail it the first time somebody
 * adds a tool in a hurry. So the recording is not a step a tool performs; it is
 * inside the only route a tool has to a write:
 *
 *     apply(ops) → executor.run(ops) → stash.record(take)
 *
 * one expression, no branch between them. A batch that applied cannot fail to be
 * recorded because there is no code path where it could, and `surface.test.ts`
 * asserts both halves: the record exists after every write tool, and no tool can
 * see an executor to go around it.
 *
 * ⚠ The same reasoning bans the OTHER half of the stash. `changes` is a
 * `StashLog` — the read half (D17g) — so `record` and `forget` are unreachable
 * from a tool. `forget` is the sharp one: the record of what we replaced is the
 * only "before" an unbranched write has, and dropping it does not lose a log, it
 * loses the ability to put the music back (rule 8, `STASH_MUTATORS`).
 *
 * ## ⚠⚠ The launcher window is passed HERE, not by the caller
 *
 * `planReversal` takes an optional window of what the clip launcher did since a
 * change ran. Omit it and the boundary silently degrades to comparing CONTENT —
 * which cannot see a clip dragged out and an identical one dragged back in, the
 * one case a fingerprint structurally cannot catch (E16s). *"Passing it is not
 * optional in production"* (session 3d), so no tool is in a position to forget:
 * the read that produces it and the plan that consumes it are the same function.
 *
 * ## ⚠ Everything is re-read from the session, never captured
 *
 * `Session.rebuild()` throws the adapter and the executor away when it finds
 * itself talking to a different life of the extension, and a workspace holding
 * the old ones would keep writing through a handle whose every index names a
 * track that is no longer there. The dependencies are therefore getters.
 */
import type {
  Address, BitwigAdapter, ClipAddress, ClipNavigationResult, ContentDelta, ObservedDeviceBank, Op, RevisionMark, Snapshot, TrackAddress, TrackState,
} from '../contract/index.js';
import type { Executor, RunOptions } from '../engine/index.js';
import type { ReversalPlan, Slice, Stash, StashLog, StashedChangeset } from '../stash/index.js';
import { ObservationCapture, type ObservationCaptureOptions, type ObservationStore } from '../observation/index.js';
import { ProductStatus, type StatusSink } from './status.js';

export interface WorkspaceDeps {
  /** Connected, handshaken, and talking to the extension we think we are. */
  ready(): Promise<void>;
  /** ⚠ Getters: see the header. A captured adapter outlives its own validity. */
  readonly adapter: BitwigAdapter;
  readonly executor: Executor;
  readonly stash: Stash;
  readonly observationStore: ObservationStore;
  readonly observationCaptureOptions?: ObservationCaptureOptions;
  readonly statusSink?: StatusSink;
}

export interface Workspace {
  /** Where the world is now. Every row address the surface mints is minted here. */
  mark(): Promise<RevisionMark>;
  /** Where a caller's first durable track id comes from. */
  tracks(): Promise<readonly TrackState[]>;
  /** Complete observable top-level device order on one track. */
  devices(track: TrackAddress): Promise<ObservedDeviceBank>;
  read(addresses: readonly Address[]): Promise<Snapshot>;
  /**
   * ⚠ The ONLY write, and it records what it did. See the header for why that is
   * one function rather than two calls.
   */
  apply(ops: readonly Op[], options?: RunOptions): Promise<StashedChangeset>;
  /** The read half of the session's record. No `record`, no `forget`. */
  readonly changes: StashLog;
  /** Per-project observation capture. Tool execution wraps confirmed results. */
  readonly observations: ObservationCapture;
  /** One-way product status. It has no read or event path. */
  readonly status: ProductStatus;
  /**
   * ⚠ Plan putting one change back, ALWAYS against the launcher window. Shared by
   * the tool that previews a reversal and the tool that performs one, so the two
   * cannot disagree about what would happen — and so neither can skip the window.
   */
  planRevert(changeId: string, slice?: Slice): Promise<ReversalPlan>;
  /** What the launcher did since a mark — exposed for reporting, not for planning. */
  contentSince(since: RevisionMark): Promise<ContentDelta>;
  /** Explicit UI focus. This bypasses the project-write and stash path. */
  showClipInEditor(clip: ClipAddress, verifiedAt: RevisionMark): Promise<ClipNavigationResult>;
}

export interface CapturedWorkspaceResult<T> {
  readonly result: T;
  /** Exact changes recorded through this execution's scoped write seam. */
  readonly changes: readonly StashedChangeset[];
}

/** Run one tool against a workspace that records only that tool's changes. */
export async function captureWorkspaceChanges<T>(
  workspace: Workspace,
  run: (scoped: Workspace) => Promise<T>,
): Promise<CapturedWorkspaceResult<T>> {
  const changes: StashedChangeset[] = [];
  const scoped = Object.freeze<Workspace>({
    ...workspace,
    async apply(ops: readonly Op[], options?: RunOptions): Promise<StashedChangeset> {
      const change = await workspace.apply(ops, options);
      changes.push(change);
      return change;
    },
  });
  return { result: await run(scoped), changes };
}

export function workspaceOf(deps: WorkspaceDeps): Workspace {
  const workspace: Workspace = {
    changes: deps.stash.log,
    observations: new ObservationCapture(deps.observationStore, deps.observationCaptureOptions),
    status: new ProductStatus(deps.statusSink),

    async mark(): Promise<RevisionMark> {
      await deps.ready();
      return deps.adapter.revision();
    },

    async tracks(): Promise<readonly TrackState[]> {
      await deps.ready();
      return deps.adapter.tracks();
    },

    async devices(trackRef: TrackAddress): Promise<ObservedDeviceBank> {
      await deps.ready();
      return deps.adapter.devices(trackRef);
    },

    async read(addresses: readonly Address[]): Promise<Snapshot> {
      await deps.ready();
      return deps.adapter.read(addresses);
    },

    async contentSince(since: RevisionMark): Promise<ContentDelta> {
      await deps.ready();
      return deps.adapter.contentSince(since);
    },

    async showClipInEditor(
      clip: ClipAddress,
      verifiedAt: RevisionMark,
    ): Promise<ClipNavigationResult> {
      await deps.ready();
      return deps.adapter.showClipInEditor(clip, verifiedAt);
    },

    async apply(ops: readonly Op[], options: RunOptions = {}): Promise<StashedChangeset> {
      await deps.ready();
      // ⚠ ONE expression. `run` throws for every refusal — the ones that mean
      // nothing was written — so anything that returns is a batch that reached
      // Bitwig, including one the revision guard rejected whole (which applied
      // zero ops and is recorded anyway, because "someone else wrote first" is a
      // fact about the session worth being able to read back).
      return deps.stash.record(await deps.executor.run(ops, options));
    },

    async planRevert(changeId: string, slice?: Slice): Promise<ReversalPlan> {
      await deps.ready();
      // Throws if this session never made this change — D19's structural bound,
      // and the shape of the API rather than a rule to remember.
      const change = deps.stash.log.require(changeId);
      // §8b's own protocol, one more time: a known set of addresses, read now,
      // compared against what we left there.
      const current = await deps.adapter.read(deps.stash.log.readSetFor(changeId));
      const launcher = await deps.adapter.contentSince(change.take.at);
      return deps.stash.log.planReversal(changeId, current, {
        launcher,
        ...(slice === undefined ? {} : { slice }),
      });
    },
  };
  return Object.freeze(workspace);
}
