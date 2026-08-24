/**
 * Contract errors.
 *
 * Each of these exists because a specific spike finding said the alternative is a
 * SILENT wrong result. They are refusals, and refusing loudly is the whole design
 * posture: "detect and fail loud; never operate on a partially-visible project"
 * (standing rule 5), "readback is the only truth" (rule 1).
 */
import { addressScene, type Address, type ParamAddress } from './address.js';
import type { WindowCoverage } from './snapshot.js';

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A normalized DirectParameter value is outside its observed discrete domain. */
export class ParameterValueUnrepresentableError extends ContractError {
  constructor(
    readonly address: ParamAddress,
    readonly requested: number,
    readonly discreteValueCount: number,
    readonly normalizedValues: readonly number[],
    readonly discreteValueNames?: readonly string[],
  ) {
    super('the normalized DirectParameter value is outside its host-proved discrete domain');
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
 * ⚠ Which population a window refusal is about.
 *
 * ⚠⚠ It is a parameter rather than two error classes because rule 5 is ONE rule
 * with two populations, and the reason scenes were unguarded for a whole phase is
 * that the track path read as track-specific machinery instead of as the rule.
 * A caller catching `BankWindowOverflowError` catches both; the message and the
 * `dimension` field say which.
 */
export type BankDimension = 'tracks' | 'scenes';

/** The rig.json knob that sizes each window. Named in the refusal, since it is the only fix. */
const WINDOW_KNOB: Record<BankDimension, string> = { tracks: 'tracks', scenes: 'scenes' };

/**
 * ⚠ E5, standing rule 5. With a 54-track project and a 32-track bank, 22 tracks
 * and 160 clips were simply INVISIBLE — not slow, absent — and `channelId`
 * resolves only inside the window. That makes an oversized project a CHECKPOINT
 * BLIND SPOT: a revert could silently miss state it never saw, which is far worse
 * than being slow. The bank size is not a tuning knob; overflow is a refusal.
 *
 * ⚠⚠ It covers SCENES as of session 3c, and it is not a new decision — rule 5's
 * own words are *"a PRECONDITION on every structural create, never a post-hoc
 * check"*, and they cover scenes verbatim. `probe:e19` stranded a scene at project
 * index 99 of a 16-wide window, where nothing could address or delete it: rule 5's
 * named failure, one population down (`FINDINGS.md` E19, E21).
 *
 * ⚠ For a CREATE the numbers are what the call WOULD produce, not what exists —
 * a precondition that reported the current state would be describing the world it
 * was called to protect.
 *
 * ⚠ The message names what is impossible and how big the hole is, and stops
 * there. It never suggests deleting anything to make room (rule 5: *"never a
 * licence to reap"*) and never redirects to a different mechanism (D18c — that
 * leak arriving through an error message). Raising the window is the same
 * mechanism, so naming the knob is inside the line rather than across it.
 */
export class BankWindowOverflowError extends ContractError {
  constructor(
    readonly dimension: BankDimension,
    readonly visible: number,
    readonly total: number,
    readonly bankSize: number,
  ) {
    super(
      `bank window overflow: the project would hold ${total} ${dimension} and the bank window ` +
        `addresses only ${bankSize}, so ${Math.max(0, total - bankSize)} of them would be ` +
        `outside it (${visible} visible now). ` +
        `${dimension === 'tracks' ? 'Tracks' : 'Scene rows'} outside the window are invisible ` +
        'and cannot be snapshotted, so no write is safe and nothing could address or remove what ' +
        `lands out there. Raise \`${WINDOW_KNOB[dimension]}\` in ~/.ghostnote/rig.json and reload ` +
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
 *
 * ⚠ It takes the DIMENSION for the same reason the overflow error does: a
 * `SceneAddress` at a row past the scene window is the identical failure one
 * population down, and `encoder.ts` used to hand that row straight to
 * `sceneBank.getScene(i)` as a bank index — which throws from inside a real batch,
 * after whatever ran before it in that batch has already landed.
 */
export class BlindSpotError extends ContractError {
  constructor(
    readonly dimension: BankDimension,
    readonly addresses: readonly Address[],
    readonly bankSize: number,
  ) {
    super(
      `${addresses.length} address(es) in the write-set are OUTSIDE the ${dimension} bank window ` +
        `of ${bankSize}: invisible, which is not the same as empty. Their prior state cannot be ` +
        'snapshotted, so no write touching them is safe and no revert could restore them ' +
        `(E5, standing rule 5). Raise \`${WINDOW_KNOB[dimension]}\` in ~/.ghostnote/rig.json and ` +
        'reload the controller.',
    );
  }
}

/**
 * ⚠ The refusal for a set of unreachable addresses, naming the window each fell
 * out of.
 *
 * A caller holding `Snapshot.unreachable` knows the addresses are invisible and
 * NOT which of the two windows hid them — and the two have different fixes, so a
 * refusal that guessed would send someone to the wrong knob.
 *
 * ⚠ Scenes win when both apply, and that is the binding-constraint rule rather
 * than a preference: a row past the scene window is unaddressable however
 * reachable its track is, so raising `tracks` alone would change nothing. Naming
 * the constraint that is actually binding is what makes the refusal actionable.
 */
export function blindSpotError(
  addresses: readonly Address[],
  window: { readonly tracks: WindowCoverage; readonly scenes: WindowCoverage },
): BlindSpotError {
  const rowBlind = addresses.filter((a) => (addressScene(a)?.index ?? -1) >= window.scenes.bankSize);
  return rowBlind.length > 0
    ? new BlindSpotError('scenes', rowBlind, window.scenes.bankSize)
    : new BlindSpotError('tracks', addresses, window.tracks.bankSize);
}

/**
 * ⚠⚠ A `clip.create` was aimed at a slot that already holds a clip.
 *
 * MEASURED, E21: `Track.createNewLauncherClip(slotIndex, length)` on an OCCUPIED
 * slot does not fail, and does not overwrite. It **appends a scene to the
 * project** — one row, at the end, past the bank window on any project bigger
 * than it — and leaves the clip that was there alone. So the one op nobody
 * thought of as structural is a silent, unbudgeted `scene.create`, and it mints
 * exactly the row standing rule 5 exists to prevent: unaddressable,
 * un-deletable, invisible to `track.list` and to every observer.
 *
 * ⚠ It is how a project reaches 99 scenes without anyone creating one. `probe:e19`
 * tripped over such a project and attributed the stranding to its own
 * `scene.create`; the growth had already happened, one conformance case at a
 * time, through `clip.create`.
 *
 * ⚠ Refusing is right on its own terms, before any of that: a caller naming a
 * slot means THAT slot. "Create me a clip somewhere you choose" is not
 * expressible in the op union and is not what anyone asked for. This is the same
 * precondition E20b puts on `duplicateClip` — where an occupied destination is
 * worse still, because there the existing clip is DESTROYED and no occupancy
 * event fires (`FINDINGS.md` E20b).
 */
export type OccupiedSlotHazard = 'append-row' | 'overwrite';

export class SlotOccupiedError extends ContractError {
  constructor(
    readonly addresses: readonly Address[],
    readonly hazard: OccupiedSlotHazard = 'append-row',
  ) {
    super(hazard === 'overwrite'
      ? `${addresses.length} clip destination(s) already hold content. Bitwig would replace that `
        + 'content without an occupancy event, so the call was refused before it reached the wire.'
      : `${addresses.length} clip.create op(s) name a slot that already holds a clip. Bitwig does `
        + 'not refuse that and does not overwrite: it APPENDS A SCENE to the project and puts the '
        + 'new clip out there, past the bank window, where nothing can address or delete it (E21). '
        + 'Delete the clip first, or address an empty slot.');
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

/** Note timing is finer than every exact writable grid. */
export class NoteTimingUnrepresentableError extends InvalidOpError {
  constructor(readonly finestGridBeats: number, op: 'note.write' | 'note.props' = 'note.write') {
    super(
      op,
      `note timing is finer than the ${finestGridBeats}-beat writable grid`,
    );
  }
}

/** A variant this adapter does not model — the fake's honest answer for device state. */
export class UnsupportedOpError extends ContractError {
  constructor(readonly op: string, readonly adapter: string) {
    super(`the ${adapter} adapter does not implement ${op}`);
  }
}
