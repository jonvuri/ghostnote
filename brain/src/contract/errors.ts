/**
 * Contract errors.
 *
 * Each of these exists because a specific spike finding said the alternative is a
 * SILENT wrong result. They are refusals, and refusing loudly is the whole design
 * posture: "detect and fail loud; never operate on a partially-visible project"
 * (standing rule 5), "readback is the only truth" (rule 1).
 */
import type { Address } from './address.js';

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The brain and the deployed extension disagree about the contract version.
 * Overwhelmingly the cause is a stale `.bwextension`, so the message says so.
 */
export class ContractVersionError extends ContractError {
  constructor(
    readonly expected: number,
    readonly actual: number,
  ) {
    super(
      `contract version mismatch: brain speaks v${expected}, the loaded extension speaks v${actual}. ` +
        'Rebuild and redeploy with `cd extension && ./gradlew copyExtension`, then reload the ' +
        'controller in Bitwig (Settings -> Controllers).',
    );
  }
}

/**
 * The extension's registered wire surface no longer matches
 * extension/methods.golden.json. Caught at connect rather than at the first
 * failing write.
 */
export class WireDriftError extends ContractError {
  constructor(
    readonly expected: string,
    readonly actual: string,
  ) {
    super(
      `wire method table drifted: expected methodsHash ${expected}, extension reports ${actual}. ` +
        'Either the extension is stale, or extension/methods.golden.json was not regenerated ' +
        'after adding or renaming a handler.',
    );
  }
}

/**
 * ⚠ E5, standing rule 5. With a 54-track project and a 32-track bank, 22 tracks
 * and 160 clips were simply INVISIBLE — not slow, absent — and `channelId`
 * resolves only inside the window. That makes an oversized project a CHECKPOINT
 * BLIND SPOT: a revert could silently miss state it never saw, which is far worse
 * than being slow. The bank size is not a tuning knob; overflow is a refusal.
 */
export class BankWindowOverflowError extends ContractError {
  constructor(
    readonly visible: number,
    readonly total: number,
    readonly bankSize: number,
  ) {
    super(
      `bank window overflow: the project holds ${total} tracks but the bank window shows only ` +
        `${visible} of ${bankSize}. Tracks outside the window are invisible and cannot be ` +
        'snapshotted, so no write is safe. Raise `tracks` in ~/.ghostnote/rig.json and reload ' +
        'the controller.',
    );
  }
}

/**
 * ⚠ E5, standing rule 5 — the same rule as `BankWindowOverflowError`, aimed at
 * specific addresses rather than at the project.
 *
 * The overflow error answers "may we operate on this project at all?"; this one
 * answers "did the state we were told to snapshot fall in the hole?". They are
 * separate because a caller can act on the second — the named addresses say
 * exactly which part of the write-set was invisible — and because collapsing
 * them would make the reachable case indistinguishable from the project-wide
 * one, which is how a blind spot becomes a silently empty snapshot.
 */
export class BlindSpotError extends ContractError {
  constructor(readonly addresses: readonly Address[]) {
    super(
      `${addresses.length} address(es) in the write-set are OUTSIDE the bank window: ` +
        'invisible, which is not the same as empty. Their prior state cannot be snapshotted, so ' +
        'no write touching them is safe and no revert could restore them (E5, standing rule 5). ' +
        'Raise `tracks` in ~/.ghostnote/rig.json and reload the controller.',
    );
  }
}

/**
 * ⚠ E3. An address minted before a scene create/delete carries a scene index that
 * compaction has since moved. A pinned cursor's `sceneIndex()` goes PERMANENTLY
 * stale in that situation while looking entirely healthy, so resolving it anyway
 * would write to the wrong row. Re-point after any structural op.
 */
export class StaleAddressError extends ContractError {
  constructor(
    readonly address: Address,
    readonly mintedEpoch: number,
    readonly currentEpoch: number,
  ) {
    super(
      `stale address: minted at scene epoch ${mintedEpoch}, current epoch is ${currentEpoch}. ` +
        'A scene was created or deleted since, which compacts rows and invalidates every ' +
        'scene-relative address. Re-resolve before writing.',
    );
  }
}

/** The durable key resolved to nothing. A deleted track is a tombstone, never an alias (E2f). */
export class AddressUnresolvedError extends ContractError {
  constructor(readonly address: Address, detail: string) {
    super(`address did not resolve: ${detail}`);
  }
}

/**
 * The op is well-typed but cannot be represented on the wire, and we refuse
 * BEFORE emitting a frame — because the underlying API would accept it and do
 * nothing (E4h: a relative path, a wrong extension and a missing file are all
 * silent no-ops).
 */
export class InvalidOpError extends ContractError {
  constructor(readonly op: string, detail: string) {
    super(`invalid ${op}: ${detail}`);
  }
}

/** A variant this adapter does not model — the fake's honest answer for device state. */
export class UnsupportedOpError extends ContractError {
  constructor(readonly op: string, readonly adapter: string) {
    super(`the ${adapter} adapter does not implement ${op}`);
  }
}
