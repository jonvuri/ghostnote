/**
 * Contract versioning — PHASE-0 §Scope item 2.
 *
 * Three mechanisms, three jobs. They are deliberately separate because they fail
 * at different times and a single "version" field cannot do all three:
 *
 *   1. `CONTRACT_VERSION`  — compile-time truth for this checkout.
 *   2. `contract.hello`    — brain vs the DEPLOYED extension. A stale
 *                            `.bwextension` in ~/Documents is the single most
 *                            likely mismatch, and it must fail at connect with a
 *                            message naming the fix, not at the first odd write.
 *   3. `CONTRACT_TAG`      — stamped into every serialized artifact (Snapshot,
 *                            BatchReceipt, and Phase 1's takes), so a take
 *                            written by an older contract is REJECTED rather
 *                            than half-understood (INITIAL_PROMPT §7:
 *                            "version the serializer so future adapters reject
 *                            incompatible data instead of guessing").
 *
 * Comparison is EXACT EQUALITY. There is no range negotiation and no
 * back-compatibility shim: nobody ships two adapters at once, and range logic is
 * the classic over-engineering trap at this seam. PHASE-0 §Risks expects a v1 —
 * the answer to a v1 is to bump, not to negotiate.
 */

/** Must equal `Contract.VERSION` in the extension's handlers/Contract.java. */
export const CONTRACT_VERSION = 0;

/** Stamped on every serialized artifact. */
export const CONTRACT_TAG = `ghostnote/${CONTRACT_VERSION}` as const;

export type ContractTag = typeof CONTRACT_TAG;

/** What `hello()` reports. Both adapters answer; only the live one can mismatch. */
export interface AdapterInfo {
  readonly contract: ContractTag;
  readonly contractVersion: number;
  /** Which implementation answered — the one thing a caller may legitimately branch on. */
  readonly kind: 'live' | 'fake';
  /** Present only for `kind: 'live'`. */
  readonly host?: {
    readonly apiVersion: number;
    readonly product: string;
    readonly version: string;
    readonly extensionVersion: string;
  };
  /**
   * sha256 of the sorted wire method names, first 16 hex chars — see
   * extension/methods.golden.json. A drifted extension is caught here rather
   * than at the first failing write. Absent on the fake, which has no wire.
   */
  readonly methodsHash?: string;
  readonly limits: BankLimits;
  readonly capabilities: AdapterCapabilities;
}

/**
 * The bank window (E5). `trackCount > trackBankSize` means tracks are ABSENT
 * from our view, not merely slow to reach — see `BankWindowOverflowError`.
 */
export interface BankLimits {
  readonly trackBankSize: number;
  readonly sceneBankSize: number;
  /**
   * The project's true track count, if the host can report it.
   * ⚠ ◐ UNPROVEN whether Bitwig's `Bank.itemCount()` reports the project total or
   * just the window; probed in Phase 0. `undefined` means "cannot tell", which
   * must be treated as "cannot guarantee we are seeing everything".
   */
  readonly trackCount?: number;
}

/**
 * Flat booleans. Deliberately not a capability algebra — the conformance suite
 * gates cases on these with node:test's `{ skip }`, exactly as bwmod's
 * oracle.test.ts gates on `havePython`, and nothing more expressive is needed.
 */
export interface AdapterCapabilities {
  /** Real Bitwig behind it: silent-no-op traps and true settle durations are observable. */
  readonly hasRealBitwig: boolean;
  /** Virtual time: tick counts are assertable and settling is instant. */
  readonly hasDeterministicClock: boolean;
  /** The bank window can be shrunk on demand to prove overflow refusal. */
  readonly canOverflowBank: boolean;
  /** A competing writer can be injected mid-batch to prove the revision guard. */
  readonly canInjectInterference: boolean;
  /** Devices and parameters are modelled at all (thin, in v0). */
  readonly hasDeviceModel: boolean;
}
