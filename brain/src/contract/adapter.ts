/**
 * `BitwigAdapter` — the versioned seam between the brain and *some* Bitwig.
 *
 * Eleven narrow methods; operation breadth lives in the `Op` and `Address` unions,
 * never in adapter method proliferation. That is the Beat Twin lesson (a
 * 57-tool surface, abandoned) applied at the one place it is cheap to apply.
 *
 * The two enumerators are deliberate exceptions: `tracks()` discovers durable
 * track addresses, while `devices(track)` proves a complete top-level signal
 * order. Neither fact can be represented as a read of addresses the caller
 * already holds.
 *
 * The structural proof that the JSON-RPC frame is an implementation detail: the
 * FAKE NEVER SEES A WIRE FRAME. If any type in `contract/` ever mentions a
 * `category.action` string, the boundary has leaked.
 *
 * The Phase-1 pipeline (§8b) is exactly:
 *
 *     resolve(write-set)          -> explicit, live-checked addresses
 *     read(write-set)             -> the stash
 *     apply(batch)                -> optimistic, staged
 *     read(write-set)             -> verify; report what didn't take
 *     (revert = apply the stash)
 */
import type { Address, ClipAddress } from './address.js';
import type { SettleBudget } from './budgets.js';
import type { ContentDelta } from './observers.js';
import type { ObservedDeviceBank, Op } from './ops.js';
import type { BatchReceipt, RevisionMark, Snapshot } from './snapshot.js';
import type { TrackState } from './state.js';
import type { AdapterInfo } from './version.js';

export interface ResolvedAddress {
  readonly address: Address;
  readonly found: boolean;
  /** The live bank index, when found. Valid only until the next structural op. */
  readonly index?: number;
  /**
   * Why not, when `found` is false — a tombstone reads differently from a blind
   * spot, and an address the adapter cannot inspect is neither one.
   *
   * ⚠⚠ `ambiguous` arrived with chain resolution (session 3f step 6b) and is the
   * only value here that reports a SURPLUS rather than a shortfall: the name
   * matched more than one chain, so the address identifies no single object.
   * It gets its own value rather than being folded into `absent` or
   * `unsupported` because all three would be lies about what was observed —
   * we looked, we could look, and we found too much. `ChainAddress` names the
   * refusal as an obligation on any resolver; this is where it lands.
   */
  readonly reason?: 'absent' | 'outside-bank-window' | 'stale-epoch' | 'unsupported' | 'ambiguous';
}

export interface ResolveResult {
  readonly at: RevisionMark;
  readonly resolved: readonly ResolvedAddress[];
}

export interface BatchRequest {
  readonly ops: readonly Op[];
  /**
   * Optimistic-concurrency guard. When set and stale, the batch is rejected
   * WHOLE — zero ops applied (E8-D). Acceptance claims the next revision
   * immediately, so a second batch against the old revision is rejected even
   * while a paced one is still draining.
   */
  readonly ifRevision?: number;
}

/** Result of one explicit request to focus Bitwig's editor on a launcher clip. */
export interface ClipNavigationResult {
  readonly navigated: boolean;
  readonly layoutRequested: 'EDIT';
  readonly layoutConfirmed: boolean;
  /** A current mismatch found after durable identity resolution. */
  readonly why?: string;
}

export interface BitwigAdapter {
  /**
   * Version handshake and capability report. Called once, before anything else;
   * throws `ContractVersionError` rather than proceeding on a mismatch.
   */
  hello(): Promise<AdapterInfo>;

  /**
   * Durable identity -> live handle. Refuses stale scene epochs (E3) and reports
   * bank-window blind spots distinctly from genuine absence (E5).
   */
  resolve(refs: readonly Address[]): Promise<ResolveResult>;

  /**
   * Every track the bank window can address, in bank order — where a caller's
   * FIRST `channelId` comes from.
   *
   * ⚠ It does NOT refuse an overflowing project, and that asymmetry is the same
   * one `read` has: standing rule 5 is about operating, not about looking, and
   * the call that tells you the window is too small must not be the call you
   * cannot make. How many tracks the window is missing rides on `RevisionMark`
   * (`window.tracks`), so a caller who wants the whole picture takes both.
   *
   * ⚠ Returns `TrackState`, the same value `read` produces for a `TrackAddress`,
   * rather than a listing type of its own — two shapes for one fact is how the
   * enumeration and the read end up disagreeing about what a track is.
   */
  tracks(): Promise<readonly TrackState[]>;

  /** Complete observable top-level device order for one durable track id. */
  devices(track: import('./address.js').TrackAddress): Promise<ObservedDeviceBank>;

  /**
   * Read exactly these addresses. This is both the §8b stash and the verify
   * primitive — one method, because they are the same operation at different
   * moments, which is also why the stash doubles as Phase 3's diff source (§8f).
   */
  read(sel: readonly Address[]): Promise<Snapshot>;

  /** The only write path. Resolves on COMPLETION, not acceptance — see stages.ts. */
  apply(batch: BatchRequest): Promise<BatchReceipt>;

  /**
   * Wait out a settle budget.
   *
   * On the interface because Bitwig writes are not visible to a read in the same
   * request, only the next one (E2) — so something must wait a turn, and if that
   * something is `sleep()` at the call site then the offline suite pays real
   * wall-clock and the fake can never be deterministic. Live waits out the
   * measured duration; the fake advances virtual ticks. One code path, and the
   * offline suite costs nothing.
   *
   * ⚠ Live does NOT poll here — most budgets have no observable to poll for. See
   * the header of `budgets.ts` for which mitigations use readback instead.
   */
  settle(budget: SettleBudget): Promise<void>;

  revision(): Promise<RevisionMark>;

  /**
   * What the clip launcher did since `since` — the PUSHED half of change
   * detection, and the one thing a client-side poll cannot reconstruct.
   *
   * ⚠ On the interface rather than inside the live adapter because the executor
   * and the stash both consume it, and because the offline suite has to be able
   * to prove the fail-closed cases (a dropped event, a restarted extension) that
   * a live DAW will not produce on demand. The fake models them; `observers.ts`
   * holds the slicing both adapters share so they cannot drift.
   *
   * ⚠ It answers *what moved*, never *who moved it*. The callback carries no
   * author, so an event naming a slot this session also wrote is evidence of
   * nothing — the stash's content fingerprint is what arbitrates there. This
   * method's unique reach is the slots we never touched.
   */
  contentSince(since: RevisionMark): Promise<ContentDelta>;

  /**
   * Focus one launcher clip in Bitwig's editor.
   *
   * The input keeps the durable track id. A live adapter resolves it at call
   * time and does not expose the temporary bank index to the product surface.
   * This changes UI focus only. It does not change project content or revision.
   */
  showClipInEditor(
    clip: ClipAddress,
    /** The state boundary that approved this positional clip address. */
    verifiedAt: RevisionMark,
  ): Promise<ClipNavigationResult>;

  close(): Promise<void>;
}
