/**
 * The bridge connection, and everything hung off it — what session 3 replaced
 * `ghostnoted` with.
 *
 * ## ⚠ There is no daemon, and this is not a small daemon
 *
 * D4 gave `ghostnoted` three jobs: own the bridge connection, host the take
 * store, and hold Bitwig observers. D4 rev deleted all three as reasons for a
 * process:
 *
 *   - **the store is gone.** The system is stateless and the PROJECT is the take
 *     log (D17 rev, D18). What survives is the STASH, which is per-session by
 *     construction — it records the batches *this* conversation ran — so the
 *     lifetime the daemon existed to provide is a lifetime nothing needs.
 *   - **the observers moved to the EXTENSION**, which is a strictly better home:
 *     it is alive whenever Bitwig is, so it cannot miss an edit made while no
 *     client was attached. A daemon spawned on demand by its first client
 *     provably can, and would have shipped a blind spot shaped exactly like the
 *     one it was built to close.
 *   - **one writer was never a constraint.** E16p measured the revision guard
 *     atomic across connections, so serialising through one process buys
 *     ordering that is already guaranteed.
 *
 * ⚠ What that leaves is standing rule 7's replacement, and it is about
 * COHERENCE, not topology: **ordered is not coherent.** The guard sequences
 * writes; it does not re-plan a batch whose world moved. Two chat sessions are
 * two MCP servers are two writers, and a rejected batch must be re-planned by
 * whoever sent it. *(A single-writer refusal in `Bridge.java` is available and
 * recorded UNADOPTED — it is not built here.)*
 *
 * ## ⚠ What a connection has to survive
 *
 * The old session doc called daemon lifecycle *"the classic time sink"* and
 * recommended treating a disconnect as fatal to session state and cheap to
 * rebuild — *"D6 already forbids trusting any held index across a structural op,
 * and a restart is the largest structural op there is."* That advice outlived the
 * daemon, and it is now enforceable rather than merely recommended: the
 * extension mints a GENERATION nonce per `init()`, so a reconnect that lands on a
 * different life of the extension is DETECTED instead of assumed. Everything
 * index-shaped is dropped when it changes.
 */
import { LiveAdapter } from './adapters/live/adapter.js';
import { BridgeTransport } from './adapters/live/transport.js';
import { BridgeClient, type BridgeLike } from './client.js';
import { compareDeployment, deployedAtMs, StaleExtensionError } from './deploy.js';
import { Executor } from './engine/index.js';
import { Stash } from './stash/index.js';
import type { AdapterInfo, RevisionMark } from './contract/index.js';
import { WIRE } from './adapters/live/wiremap.js';

export interface SessionOptions {
  /**
   * The wire hash to demand, from `extension/methods.golden.json`.
   *
   * ⚠ Optional, and the omission is a real choice rather than laziness: the
   * probes deliberately run against a rig whose method table is ahead of the
   * golden, and forcing the check here would break them. A SHIPPING client
   * passes it.
   */
  readonly expectMethodsHash?: string;
  /** Substituted in tests; see `BridgeLike`. Defaults to a real TCP client. */
  readonly client?: BridgeLike;
  /**
   * When the deployed extension was last written, for the staleness check
   * (`deploy.ts`). Injected so the check is testable without a filesystem;
   * defaults to stat-ing the deployed jar. Return `undefined` to skip it.
   */
  readonly deployedAt?: () => number | undefined;
}

/** What a reconnect found on the other end. */
export interface Reconnection {
  readonly generation: string;
  /** ⚠ A DIFFERENT life of the extension: everything positional must be re-resolved. */
  readonly restarted: boolean;
  /**
   * ⚠ A DIFFERENT PROJECT, with the same extension still running — so `restarted`
   * is false and every `channelId` we hold is nonetheless meaningless. Reported
   * separately because the two have the same remedy and completely different
   * tells: a restart makes the epochs go backwards, a project change does not
   * disturb them at all.
   */
  readonly projectChanged: boolean;
  readonly project: string;
}

/**
 * One bridge connection, one adapter, one executor, one stash.
 *
 * ⚠ Instance state, never module state. PHASE-1-SESSION-1 §Risks names the
 * failure: a component that may be re-created when Bitwig restarts cannot keep
 * its state in a module, and this is precisely that component.
 */
export class Session {
  readonly client: BridgeLike;
  readonly stash = new Stash();

  private adapter: LiveAdapter;
  private executorCache: Executor;
  private info: AdapterInfo | undefined;
  private generation: string | undefined;
  private project: string | undefined;

  constructor(private readonly options: SessionOptions = {}) {
    this.client = options.client ?? new BridgeClient();
    this.adapter = this.newAdapter();
    this.executorCache = new Executor(this.adapter);
  }

  private newAdapter(): LiveAdapter {
    return new LiveAdapter({
      transport: new BridgeTransport(this.client),
      ...(this.options.expectMethodsHash === undefined
        ? {}
        : { expectMethodsHash: this.options.expectMethodsHash }),
    });
  }

  /**
   * Make sure we are connected, handshaken, and talking to the life of the
   * extension we think we are.
   *
   * ⚠ LAZY, and deliberately so. An MCP server is a subprocess of a chat client
   * and starts before anyone has opened Bitwig; a constructor that connected
   * would make "the DAW is not running yet" indistinguishable from "the server
   * is broken", and the user would see neither. Connecting on first use makes
   * the failure arrive attached to the request that cared.
   *
   * ⚠ The handshake is re-run on every reconnect, not only the first. A
   * reconnect can land on a different BUILD of the extension — that is the
   * ordinary case during development — and a contract or wire mismatch that went
   * unchecked after a reconnect would be checked exactly when it could not
   * happen.
   */
  async ready(): Promise<Reconnection> {
    if (!this.client.connected) {
      await this.client.connect();
      this.info = undefined;
    }
    if (this.info === undefined) {
      this.info = await this.adapter.hello();
      // ⚠ Right after the handshake, because it closes the handshake's own blind
      // spot: `methodsHash` compares method NAMES, so a change that only adds
      // fields to an existing reply passes it green against a build Bitwig never
      // loaded. Refused rather than warned, for the same reason a contract
      // mismatch is: an extension that limps along on the wrong build produces
      // confusing wrong answers rather than an error.
      await this.assertFreshBuild();
    }

    const mark = await this.adapter.revision();
    const restarted = this.generation !== undefined && this.generation !== mark.generation;
    // ⚠ Same remedy as a restart, and for a stronger reason: the adapter's
    // channelId -> index map does not merely hold stale POSITIONS, it holds keys
    // for tracks that no longer exist. Nothing it remembers survives.
    const projectChanged = this.project !== undefined && this.project !== mark.project;
    if (restarted || projectChanged) this.rebuild();
    this.generation = mark.generation;
    this.project = mark.project;
    return { generation: mark.generation, restarted, projectChanged, project: mark.project };
  }

  /**
   * ⚠ Throw the adapter away rather than reconcile it.
   *
   * Everything it holds is index-shaped or epoch-shaped — the channelId→index
   * map, the cursor pool's assignments, the last mark, the rig's grid width —
   * and every one of them describes a Bitwig that no longer exists. D6 forbids
   * trusting a held index across a structural op; a restart is the largest
   * structural op there is, and it is also the one case where nothing observed
   * what happened in between.
   *
   * ⚠ The STASH is NOT thrown away, and that is not an oversight. It records
   * what THIS session did, which is still true after a restart — and D19's
   * reversal is bounded by it. What changes is that its positional addresses can
   * no longer be vouched for, and the boundary already says so on its own: a
   * changeset whose mark is from the previous generation reads `undecidable`
   * rather than `ours` (`stash/record.ts`).
   */
  private rebuild(): void {
    this.adapter = this.newAdapter();
    this.executorCache = new Executor(this.adapter);
    this.info = undefined;
  }

  /**
   * ⚠ Re-checked on every reconnect, not once. Redeploying mid-session is the
   * ordinary development case and is exactly when a stale instance appears.
   */
  private async assertFreshBuild(): Promise<void> {
    const stats = (await this.client.request(WIRE.rigStats)) as { initEpochMs?: number };
    const deployment = compareDeployment(
      (this.options.deployedAt ?? deployedAtMs)(),
      stats.initEpochMs ?? -1,
    );
    if (deployment.state === 'stale') throw new StaleExtensionError(deployment);
    this.deploymentState = deployment;
  }

  /** What the last freshness check concluded, for a caller that wants to report it. */
  deploymentState: ReturnType<typeof compareDeployment> | undefined;

  get bitwig(): LiveAdapter {
    return this.adapter;
  }

  get executor(): Executor {
    return this.executorCache;
  }

  /** The handshake result, once `ready()` has run. */
  get adapterInfo(): AdapterInfo | undefined {
    return this.info;
  }

  /** Where the world is, and the baseline every address in a reply is minted at. */
  async mark(): Promise<RevisionMark> {
    await this.ready();
    return this.adapter.revision();
  }

  async close(): Promise<void> {
    await this.adapter.close();
    this.client.disconnect();
  }
}
