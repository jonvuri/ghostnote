/**
 * What the surface SAYS — every sentence an agent reads, written here and nowhere
 * else.
 *
 * ## ⚠⚠ Why nothing internal is forwarded verbatim
 *
 * The engine already explains itself well: the boundary verdicts, the fidelity
 * labels and the refusals all carry a sentence saying what happened and why. Every
 * one of those sentences is written in this project's own vocabulary and cites its
 * own evidence record, and D18c's fresh-language rule is that *none of that
 * crosses the surface*. So this module re-says them, from DATA rather than from
 * text:
 *
 *   - a boundary verdict is an enum, so it gets a sentence per value, with
 *     `assertNever` making a new verdict a COMPILE error rather than a silent
 *     fall-through to a vaguer sentence;
 *   - what a change cannot put back is derived from the recorded VALUE — which
 *     properties are in it, whether a clip's length was captured — using the same
 *     `NOTE_PROP_FIDELITY` table the engine derives its own wording from, so a
 *     property promoted to exact retires both at once;
 *   - a refusal is re-said from the error's structured fields (which addresses,
 *     which window, which limit), never from its message.
 *
 * ⚠ The one thing that is forwarded is an UNEXPECTED error's text, and it is
 * marked as what it is: a bug report, not a designed message. A surface that
 * swallowed the detail of a failure nobody anticipated would be harder to fix and
 * no safer — an unclassified crash cannot map a change onto a mechanism, which is
 * the thing the rule is protecting.
 *
 * ⚠ Two places knowingly re-derive something the engine also derives (the
 * known-readback notes below, and what a reversal cannot restore). That is the
 * price of the rule above. Both read the same source table rather than copying its
 * conclusions, which is what keeps them from drifting apart.
 */
import {
  NOTE_PROP_FIDELITY, UNVERIFIED_NOTE_PROPS, UNWRITABLE_NOTE_PROPS,
  addressKey, addressTrack, assertNever, chainPath,
  AddressUnresolvedError, BankWindowOverflowError, BlindSpotError, ContractVersionError,
  InvalidOpError, SlotOccupiedError, StaleAddressError, WireDriftError,
  type Address, type ChainAddress, type DeviceAddress, type NoteRecord, type StateValue,
} from '../contract/index.js';
import { StaleExtensionError } from '../deploy.js';
import {
  UnprotectedWriteError, isAtRisk, structuralRisk,
  type Disagreement, type StructuralRisk, type Take, type TakeValue, type Unrestored,
  type WriteTarget,
} from '../engine/index.js';
import {
  ChangesetNotFoundError, EmptySliceError,
  type BoundaryCheck, type BoundaryVerdict, type ReversalPlan, type StashedChangeset,
} from '../stash/index.js';

// --- where something is ------------------------------------------------------

/**
 * A place in the project, in the same words the tools accept.
 *
 * ⚠ Structured rather than a sentence, because the agent's next move is usually
 * to address it — and a location it has to parse out of English is a location it
 * will get wrong.
 */
export interface Where {
  readonly what: 'track' | 'row' | 'slot' | 'clip' | 'notes' | 'device' | 'parameter';
  readonly trackId?: string;
  readonly row?: number;
  readonly channel?: number;
  readonly fromBeat?: number;
  readonly toBeat?: number;
  readonly devicePosition?: number;
  readonly parameter?: number | string;
}

/**
 * ⚠ The position ON THE TRACK that a device address hangs off — the outermost
 * container when the address is nested, and the device itself when it is not.
 *
 * A nested `chainIndex` counts positions inside a device-layer chain, so
 * reporting it as `devicePosition` would tell an agent a number that means
 * something else on the surface it addresses with. This under-describes instead:
 * the top-level position is true at every depth. Describing the nesting itself
 * needs vocabulary the surface does not have yet — `naming.ts` holds both
 * candidate words as deliberately-closed entries — and nothing can produce a
 * nested address through this surface today, so the gap is nameable rather than
 * reachable.
 */
function trackLevelDevice(address: DeviceAddress | ChainAddress): DeviceAddress {
  const path = chainPath(address);
  return path[0]?.container ?? (address.kind === 'device' ? address : address.container);
}

export function describeAddress(address: Address): Where {
  switch (address.kind) {
    case 'track':
      return { what: 'track', trackId: address.channelId };
    case 'scene':
      return { what: 'row', row: address.index };
    case 'slot':
      return { what: 'slot', trackId: address.track.channelId, row: address.scene.index };
    case 'clip':
      return { what: 'clip', trackId: address.slot.track.channelId, row: address.slot.scene.index };
    case 'clipLaunch':
    case 'clipPlay':
      return { what: 'clip', trackId: address.clip.slot.track.channelId, row: address.clip.slot.scene.index };
    case 'notes':
      return {
        what: 'notes',
        trackId: address.clip.slot.track.channelId,
        row: address.clip.slot.scene.index,
        channel: address.channel,
        ...(address.range === undefined
          ? {}
          : { fromBeat: address.range.startBeats, toBeat: address.range.endBeats }),
      };
    case 'chain':
    case 'device':
      return {
        what: 'device',
        trackId: addressTrack(address)!.channelId,
        devicePosition: trackLevelDevice(address).chainIndex,
      };
    case 'param':
      return {
        what: 'parameter',
        trackId: address.device.track.channelId,
        devicePosition: trackLevelDevice(address.device).chainIndex,
        parameter: address.directId ?? address.index,
      };
  }
}

// --- what a change can and cannot put back -----------------------------------

const TRACK_GONE_FOR_GOOD =
  'a deleted track cannot be brought back. A newly created track gets a new id, so it is a '
  + 'different track and nothing recorded about the old one can be replayed onto it.';

const ROW_GONE_FOR_GOOD =
  'removing a row moves every row below it up one, and the arrangement of rows before that has '
  + 'no readback — so it cannot be rebuilt, and addresses that named the old rows are refused '
  + 'rather than guessed at.';

const DEVICE_GONE_FOR_GOOD =
  'a device carries settings that cannot be read back through this API, so nothing recorded here '
  + 'could rebuild it.';

// ⚠ The alternate-holding structure inside a device, in the only words this
// surface currently owns. `naming.ts` keeps both of the natural words closed as
// relaxation candidates, and the device-alternate tools are what will reopen one
// with a disambiguation — so this sentence describes the SHAPE rather than
// naming the mechanism, and stays honest either way. Nothing on this surface can
// produce such an address yet; the sentence exists so the record has words if
// one ever arrives, rather than falling through to a vaguer one.
const NESTED_HOLDER_GONE_FOR_GOOD =
  'this named a compartment inside a device that holds its own devices. Making one is only '
  + 'possible by copying a compartment that already exists, and removing one is not possible at '
  + 'all through this API, so what was recorded here is a record and not something that can be '
  + 'put back.';

const OUT_OF_VIEW =
  'this was outside the part of the project this connection can address when the change ran — '
  + 'invisible, which is not the same as empty — so nothing about it was recorded.';

const CLIP_LENGTH_MISSING =
  'this clip existed but its length was never read back, so it cannot be rebuilt: a clip put back '
  + 'at a guessed length is a musical value invented from nothing. Its notes are not replayed '
  + 'either, because writing into a slot with no clip lands somewhere else entirely.';

const CLIP_METADATA_LOST =
  'a clip that already existed comes back as a new clip of the same length carrying the same '
  + 'notes. Its name, its colour, its loop start and end as distinct from its length, its launch '
  + 'settings and its automation are not recorded by anything here and do not come back.';

const POSITION_MOVED =
  'this change also added or removed rows, which moves every row below the edit. The place this '
  + 'was recorded at is a position, so it may no longer point at the same music.';

const SOMETHING_UNRECORDABLE =
  'part of what was here cannot be reproduced exactly from what could be read back.';

const CREATED_TRACK_STAYS =
  'this created a track. Deleting it again is not offered: nothing proves the track is still only '
  + 'ours, and somebody may have put work in it since.';

const COPIED_TRACK_STAYS =
  'the copied track stays. Deleting it automatically is not offered: somebody may have edited it '
  + 'since it was made. A separately permissioned delete_track call is required for directed cleanup.';

const DEVICE_LANDING_UNSEEN =
  'where this device landed in the track was never read back, so there is no position to remove. '
  + 'Removing a counted position could remove a different device.';

const GAIN_NOT_REPLAYED =
  'note gain reads back at twice the value written and the reverse of that has never been '
  + 'measured, so it is reported rather than replayed — replaying it would double it again, and '
  + 'again on every further attempt.';

const PRESSURE_NOT_REPLAYED =
  'note pressure cannot be written through this API at all: the value reaches the writing handle '
  + 'and never the clip. What a person authored is kept in the record and cannot be put back.';

/**
 * ⚠ The default for a caller that has the labels but not the batch they came
 * from — a refusal, which happens before there is a batch. It can only ever
 * UNDER-report (a positional risk it cannot see), never over-report, which is the
 * safe direction for a sentence that says what is missing.
 */
const NO_RISK: StructuralRisk = { scenes: false, deviceChains: false };

/**
 * Why this recorded value cannot be reproduced exactly.
 *
 * ⚠ Derived from the value itself, in the same order of severity the engine
 * labels it: what kind of thing it is, whether we could see it, what is in it.
 * Empty for anything recorded exactly — including "there was nothing here", which
 * is a state that CAN be put back, by removing whatever the change created.
 */
export function lossReasons(value: TakeValue, risk: StructuralRisk = NO_RISK): string[] {
  if (value.fidelity === 'exact') return [];
  if (value.caveats.some((caveat) =>
    caveat.includes('clip relocation') || caveat.includes('destination is positional'))) {
    return [
      'the clip moved intact, but clips have no durable identity with which to prove that a '
      + 'later occupant is the same clip. This change is not reversed automatically; the '
      + 'reported reverse move remains safe only while its old rows stay empty and its new rows '
      + 'still hold these clips.',
    ];
  }
  const reasons: string[] = [];
  if (isAtRisk(value.address, risk)) reasons.push(POSITION_MOVED);

  switch (value.address.kind) {
    case 'track':
      reasons.push(TRACK_GONE_FOR_GOOD);
      break;
    case 'scene':
      reasons.push(ROW_GONE_FOR_GOOD);
      break;
    case 'device':
      reasons.push(DEVICE_GONE_FOR_GOOD);
      break;
    default:
      if (value.value === undefined) reasons.push(OUT_OF_VIEW);
      else reasons.push(...valueLosses(value.value));
      break;
  }
  return reasons.length > 0 ? reasons : [SOMETHING_UNRECORDABLE];
}

function valueLosses(value: StateValue): string[] {
  switch (value.of) {
    case 'clip':
      if (!value.exists) return [];
      return [value.lengthBeats === undefined ? CLIP_LENGTH_MISSING : CLIP_METADATA_LOST];
    case 'notes':
      return notePropertyLosses(value.notes);
    case 'device':
      return [DEVICE_GONE_FOR_GOOD];
    case 'chain':
      return [NESTED_HOLDER_GONE_FOR_GOOD];
    case 'track':
    case 'param':
    case 'clipLaunch':
    case 'clipPlay':
      return [];
  }
}

/**
 * ⚠ Read off `NOTE_PROP_FIDELITY` rather than naming gain and pressure, so a live
 * measurement that promotes one retires this sentence everywhere at once. That is
 * the same reason the engine derives its own wording the same way.
 */
function notePropertyLosses(notes: readonly NoteRecord[]): string[] {
  const present = (prop: string): boolean =>
    notes.some((n) => (n as unknown as Record<string, unknown>)[prop] !== undefined);
  const out: string[] = [];
  for (const prop of UNVERIFIED_NOTE_PROPS) {
    if (present(prop)) out.push(prop === 'gain' ? GAIN_NOT_REPLAYED : `${prop} cannot be replayed exactly.`);
  }
  for (const prop of UNWRITABLE_NOTE_PROPS) {
    if (present(prop)) {
      out.push(prop === 'pressure' ? PRESSURE_NOT_REPLAYED : `${prop} cannot be written through this API.`);
    }
  }
  return out;
}

// --- the boundary, in the caller's language ----------------------------------

/**
 * ⚠⚠ Why an address is not ours to put back — one sentence per verdict, and the
 * reason this is a switch rather than a lookup: a verdict added later must fail
 * to COMPILE here rather than fall through to whichever sentence was closest.
 *
 * `moved` is the one to read twice. It fires even when the contents compare
 * IDENTICAL, because a clip is addressed by where it sits and has no id of its
 * own — so a clip dragged away and an identical one dragged back is the same
 * notes in the same place and not the same clip.
 */
export function verdictSentence(verdict: BoundaryVerdict): string {
  switch (verdict) {
    case 'ours':
      return '';
    case 'superseded':
      return 'a later change of this session wrote here, so what is in this place now is our own '
        + 'newer work. Putting the older version back would discard it without saying so. Undo '
        + 'the later change first, or narrow this one to leave this place alone.';
    case 'changed':
      return 'what is here now is not what this change left, and nothing this session did '
        + 'explains the difference — so a person edited it. Overwriting it would destroy '
        + 'somebody else\'s work, which is never ours to decide.';
    case 'moved':
      return 'the clip launcher reports this slot emptying or filling since this change wrote '
        + 'it, and nothing this session did accounts for that. ⚠ Note what this does NOT depend '
        + 'on: the notes here may be identical and the place still not mean what it meant, '
        + 'because a clip is addressed by where it sits and has no id of its own. A clip dragged '
        + 'out and an identical one dragged in is exactly this. Read the slot again before '
        + 'writing to it.';
    case 'undecidable':
      return 'whether this slot moved since the change ran cannot be established — the record of '
        + 'launcher edits could not be compared across it. Contents matching is not enough to '
        + 'settle it, because a clip that moved can leave an identical-looking one behind. Read '
        + 'the slot again before writing to it.';
    case 'unverified':
      return 'the change that wrote here could not read it back afterwards, so there is no record '
        + 'of what it left — and therefore no way to tell our own work from a person\'s.';
    case 'unread':
      return 'this place was not read just now, so whether it still holds our work is '
        + 'unevaluated. An unchecked place is not an unchanged one.';
    case 'blind':
      return 'this is outside the part of the project this connection can address, so it is '
        + 'invisible rather than unchanged. Nothing can be concluded about it and nothing is '
        + 'written to it.';
    case 'unseen':
      return 'no change of this session has ever written here, so there is nothing of ours to '
        + 'compare the project against. That is an absence of evidence, not a clean bill of '
        + 'health.';
    default:
      return assertNever(verdict, 'verdictSentence');
  }
}

// --- receipts ----------------------------------------------------------------

const REJECTED =
  'nothing was written. Something else wrote to this project between the moment this change read '
  + 'the places it was going to touch and the moment it tried to write them, so the whole batch '
  + 'was refused rather than applied on top of a project that had moved. Read the places again '
  + 'and re-plan against what is there now.';

const OTHER_EDITS =
  'these launcher slots filled or emptied while this change ran, and this change never addressed '
  + 'them. A clip that moved invalidates addresses nothing else can check — including ones this '
  + 'session worked out earlier and has not looked up again.';

const OTHER_EDITS_UNKNOWN =
  'whether anything else changed alongside this could not be established, so the list of other '
  + 'edits is not evidence that there were none. Look up any place you addressed earlier before '
  + 'relying on it. (One record covers several ways this can happen — a project loaded, Bitwig '
  + 'restarted, more edits than the log holds, an edit that could not name its track — and the '
  + 'answer to all of them is the same: look it up again.)';

const NOT_READ_BACK =
  'this change altered the arrangement of rows, which moves every row below the edit, so the '
  + 'places it wrote could not be read back afterwards to confirm. The write may well have '
  + 'landed; claiming so from an address we can no longer trust would be a guess.';

export interface Receipt {
  readonly changeId: string;
  readonly applied: boolean;
  readonly places: readonly Where[];
  readonly canBeUndone: boolean;
  readonly cannotBeUndone: readonly { readonly where: Where; readonly why: readonly string[] }[];
  readonly refusedBecause?: string;
  readonly failed?: readonly { readonly op: string; readonly error?: string }[];
  readonly mismatches?: readonly Mismatch[];
  readonly notReadBack?: readonly Where[];
  readonly notReadBackWhy?: string;
  readonly otherEdits?: readonly OtherEdit[];
  readonly otherEditsWhy?: string;
  readonly otherEditsUnknown?: string;
}

interface Mismatch {
  readonly where: Where;
  readonly note: string;
  readonly property: string;
  readonly asked: unknown;
  readonly found: unknown;
  readonly knownBehaviour?: string;
}

interface OtherEdit {
  readonly trackId: string;
  readonly row: number;
  readonly nowHolds: 'a clip' | 'nothing';
}

/** Everything one write said about itself, in the surface's own words. */
export function receiptOf(change: StashedChangeset): Receipt {
  const take: Take = change.take;
  const report = take.report;
  const risk = structuralRisk(take.ops);
  const cannot = take.values
    .map((v) => ({ where: describeAddress(v.address), why: lossReasons(v, risk) }))
    .filter((v) => v.why.length > 0);

  return {
    changeId: take.id,
    applied: report.applied,
    // ⚠ `places`, not `changed`: a batch the guard rejected wrote nothing, and a
    // field called "changed" would be a claim about it that is false.
    places: take.targets.map((t) => describeAddress(t.address)),
    canBeUndone: cannot.length === 0 && take.unrevertable.length === 0,
    cannotBeUndone: cannot,
    ...(report.rejected === undefined ? {} : { refusedBecause: REJECTED }),
    ...(report.failed.length === 0
      ? {}
      : {
        failed: report.failed.map((f) => ({
          op: f.op,
          // The one text that is passed on as-is: it is Bitwig's own complaint
          // about our call, and re-saying it would be inventing a diagnosis.
          ...(f.error === undefined ? {} : { error: f.error }),
        })),
      }),
    ...(report.disagreements.length === 0 ? {} : { mismatches: report.disagreements.map(sayMismatch) }),
    ...(report.unverified.length === 0
      ? {}
      : {
        notReadBack: report.unverified.map((u) => describeAddress(u.address)),
        notReadBackWhy: NOT_READ_BACK,
      }),
    ...(report.concurrent.length === 0
      ? {}
      : {
        otherEdits: report.concurrent.map((c) => ({
          trackId: c.channelId,
          row: c.slotIndex,
          nowHolds: c.filled ? ('a clip' as const) : ('nothing' as const),
        })),
        otherEditsWhy: OTHER_EDITS,
      }),
    ...(report.undecidable === undefined ? {} : { otherEditsUnknown: OTHER_EDITS_UNKNOWN }),
  };
}

function sayMismatch(d: Disagreement): Mismatch {
  const known = knownBehaviour(d.field, d.requested, d.readback);
  return {
    where: describeAddress(d.address),
    note: d.at,
    property: d.field,
    asked: d.requested,
    found: d.readback,
    ...(known === undefined ? {} : { knownBehaviour: known }),
  };
}

/**
 * Is this difference between what was asked for and what came back a MEASURED
 * behaviour of the DAW rather than a surprise?
 *
 * ⚠ Keyed off the same property table the engine reads, so this cannot go on
 * excusing a property that a later measurement promotes.
 */
function knownBehaviour(field: string, asked: unknown, found: unknown): string | undefined {
  const prop = field === 'durationBeats' ? 'duration' : field;
  const fidelity = NOTE_PROP_FIDELITY[prop as keyof typeof NOTE_PROP_FIDELITY];
  if (fidelity === 'unverified') return GAIN_NOT_REPLAYED;
  if (fidelity === 'unwritable') return PRESSURE_NOT_REPLAYED;
  if (prop === 'duration' && typeof asked === 'number' && typeof found === 'number' && found < asked) {
    return 'a note ends where the next note of the same pitch begins, so a length can come back '
      + 'shorter than the one asked for. What came back is what is recorded, because recording '
      + 'the request would mean putting back a state that never existed.';
  }
  return undefined;
}

// --- reversals ---------------------------------------------------------------

const RECREATED_CLIP_CAVEAT = CLIP_METADATA_LOST;

const REMOVED_DEVICE_CAVEAT =
  'this removes a device at the position its insertion was seen to produce. A track\'s device '
  + 'list has no readback, so unlike every clip and note here the occupant of that position '
  + 'cannot be checked first — if the devices have been rearranged by hand since, the removal '
  + 'lands on whatever is there now.';

export interface ReversalReport {
  readonly changeId: string;
  readonly wouldRestore: readonly Where[];
  readonly wouldNotRestore: readonly {
    readonly where?: Where;
    readonly what: string;
    readonly why: string;
  }[];
  readonly fullyRestorable: boolean;
  readonly caveats: readonly string[];
}

/**
 * What putting one change back would do, and what it would not.
 *
 * ⚠ Both halves are answerable BEFORE anything runs, which is the whole point:
 * *"a revert never silently under-delivers"* is a promise about what a caller can
 * read in advance, not a report it gets afterwards.
 */
export function reversalReport(
  plan: ReversalPlan,
  /**
   * ⚠ The change's own write set, so a place can be named the way the tools name
   * places. The plan reports the places it would write as KEYS, and a key is an
   * internal encoding — parsing one back into an address would be inventing a
   * second, worse decoder for something the record already holds.
   */
  targets: readonly WriteTarget[],
): ReversalReport {
  const withheld = new Map(plan.withheld.map((w) => [w.key, w]));
  const byKey = new Map(targets.map((t) => [t.key, t.address]));
  const wouldNot = plan.unrestored.map((u) => sayUnrestored(u, withheld));
  return {
    changeId: plan.of,
    wouldRestore: plan.addresses
      .map((key) => byKey.get(key))
      .filter((a): a is Address => a !== undefined)
      .map(describeAddress),
    wouldNotRestore: wouldNot,
    fullyRestorable: wouldNot.length === 0 && plan.ops.length > 0,
    // ⚠ Derived from the ops the plan actually contains, not from the internal
    // caveat text. The two caveats that matter are both facts about an op:
    // rebuilding a clip loses everything about it that has no readback, and
    // removing a device lands on a position nothing can fingerprint first.
    caveats: [
      ...(plan.ops.some((o) => o.op === 'clip.create') ? [RECREATED_CLIP_CAVEAT] : []),
      ...(plan.ops.some((o) => o.op === 'device.delete') ? [REMOVED_DEVICE_CAVEAT] : []),
    ],
  };
}

function sayUnrestored(
  unrestored: Unrestored,
  withheld: ReadonlyMap<string, BoundaryCheck>,
): { where?: Where; what: string; why: string } {
  const key = unrestored.address === undefined ? undefined : addressKey(unrestored.address);
  const check = key === undefined ? undefined : withheld.get(key);
  const where = unrestored.address === undefined ? undefined : describeAddress(unrestored.address);
  // A place the boundary withheld says so in the boundary's own terms — which are
  // about who owns what is there now, not about what could be recorded.
  if (check !== undefined) {
    return { ...(where === undefined ? {} : { where }), what: unrestored.what, why: verdictSentence(check.verdict) };
  }
  return {
    ...(where === undefined ? {} : { where }),
    what: unrestored.what,
    why: unrestoredWhy(unrestored.what),
  };
}

/**
 * ⚠ Keyed on WHAT could not be put back rather than on the engine's sentence
 * about it. The values that reach here are property names, kinds of place, and
 * kinds of edit — a closed enough set to say something specific about, with a
 * truthful fallback for anything new.
 */
function unrestoredWhy(what: string): string {
  switch (what) {
    case 'gain':
      return GAIN_NOT_REPLAYED;
    case 'pressure':
      return PRESSURE_NOT_REPLAYED;
    case 'track':
      return TRACK_GONE_FOR_GOOD;
    case 'track.create':
      return CREATED_TRACK_STAYS;
    case 'copied track':
      return COPIED_TRACK_STAYS;
    case 'scene':
    case 'scene.create':
      return ROW_GONE_FOR_GOOD;
    case 'device':
      return DEVICE_GONE_FOR_GOOD;
    case 'device.insert':
      return DEVICE_LANDING_UNSEEN;
    case 'clip':
      return CLIP_LENGTH_MISSING;
    case 'notes':
      return SOMETHING_UNRECORDABLE;
    default:
      return SOMETHING_UNRECORDABLE;
  }
}

// --- refusals ----------------------------------------------------------------

export interface Refusal {
  readonly refused: true;
  readonly nothingWasWritten: true;
  readonly why: string;
  readonly where?: readonly Where[];
  readonly inTheWay?: readonly { readonly where: Where; readonly why: readonly string[] }[];
  /** ⚠ Present only for a failure nothing anticipated — a bug report, not a message. */
  readonly unexpected?: string;
}

/**
 * Every way a tool can refuse, re-said from the refusal's own structured fields.
 *
 * ⚠ Ordered from most specific to least, and the fallback is deliberately last
 * and deliberately loud: a failure nobody classified should read as one.
 */
export function refusalOf(error: unknown): Refusal {
  const refusal = (why: string, extra: Partial<Refusal> = {}): Refusal =>
    ({ refused: true, nothingWasWritten: true, why, ...extra });

  if (error instanceof UnprotectedWriteError) {
    const risk = { scenes: false, deviceChains: false };
    return refusal(
      'nothing was written. This would have replaced something whose exact state cannot be '
      + 'recorded first, so the project could not be put back the way it was afterwards. Narrow '
      + 'it until everything it touches can be recorded exactly, or leave what is in the way '
      + 'alone.',
      {
        inTheWay: error.blocked.map((v) => ({
          where: describeAddress(v.address),
          why: lossReasons(v, risk),
        })),
      },
    );
  }
  if (error instanceof SlotOccupiedError) {
    if (error.hazard === 'overwrite') {
      return refusal(
        'nothing was written. A destination slot already holds a clip. The requested copy or '
        + 'move would replace it without any occupancy event, so the call stopped before anything '
        + 'was sent. Empty the destination or name an empty destination.',
        { where: error.addresses.map(describeAddress) },
      );
    }
    return refusal(
      'nothing was written. A slot named here already holds a clip. Bitwig neither refuses that '
      + 'nor overwrites it: it appends a row at the end of the project and puts the new clip out '
      + 'there, past what this connection can address, where nothing can reach or remove it. '
      + 'Delete the clip first, or name an empty slot.',
      { where: error.addresses.map(describeAddress) },
    );
  }
  if (error instanceof BlindSpotError) {
    return refusal(
      `nothing was written. ${error.addresses.length} of the places named are outside the `
      + `${error.dimension === 'tracks' ? 'tracks' : 'rows'} this connection can address `
      + `(${error.bankSize}). They are invisible, which is not the same as empty: their state `
      + 'cannot be recorded, so no write touching them is safe and no undo could restore them. '
      + `Raise \`${error.dimension}\` in ~/.ghostnote/rig.json and reload the controller.`,
      { where: error.addresses.map(describeAddress) },
    );
  }
  if (error instanceof BankWindowOverflowError) {
    return refusal(
      `nothing was written. The project would hold ${error.total} ${error.dimension} and this `
      + `connection can address ${error.bankSize}, so ${Math.max(0, error.total - error.bankSize)} `
      + 'of them would sit outside it — invisible, unrecordable, and impossible to reach or '
      + `remove. Raise \`${error.dimension}\` in ~/.ghostnote/rig.json and reload the controller.`,
    );
  }
  if (error instanceof StaleAddressError) {
    return refusal(
      'nothing was written. A row was added or removed since the places in this call were worked '
      + 'out, which moves every row below the edit — so the addresses no longer mean what they '
      + 'meant. Look the places up again and repeat the call.',
      { where: [describeAddress(error.address)] },
    );
  }
  if (error instanceof AddressUnresolvedError) {
    // ⚠ Which of the two cases this is, read off the address rather than the
    // message: a note address that did not resolve is an empty slot, and every
    // other kind is an id that names nothing this connection can see.
    const emptySlot = error.address.kind === 'notes'
      || error.address.kind === 'clip'
      || error.address.kind === 'clipLaunch'
      || error.address.kind === 'clipPlay';
    return refusal(
      emptySlot
        ? 'nothing was written. There is no clip in that slot — or the track id names nothing this '
          + 'connection can see, which reads the same way from here; `list_tracks` reports the ids '
          + 'that exist. Pointing at an empty slot silently lands on a DIFFERENT clip and reports '
          + 'success, so this is refused rather than attempted: create the clip first, or give '
          + 'its notes to `add_clip` in one call.'
        : 'nothing was written. That id does not name anything this connection can see. Track ids '
          + 'come from `list_tracks`; a track that was deleted never resolves again, and one '
          + 'outside what this connection can address is invisible rather than absent.',
      { where: [describeAddress(error.address)] },
    );
  }
  if (error instanceof ChangesetNotFoundError) {
    return refusal(
      'this session has no change with that id, so there is nothing of ours to put back. Undo is '
      + 'bounded to what this session itself wrote — `list_changes` is the whole of it. Edits '
      + 'made before this connection opened, or by anyone else, are the person\'s own to undo in '
      + 'Bitwig.',
    );
  }
  if (error instanceof EmptySliceError) {
    return refusal('nothing in that change is inside the part of the project you named.');
  }
  if (error instanceof InvalidOpError) {
    return refusal(`nothing was written. That call cannot be represented: ${error.op} was refused `
      + 'before anything was sent, because the underlying API would have accepted it and done '
      + 'nothing.');
  }
  if (
    error instanceof ContractVersionError
    || error instanceof WireDriftError
    || error instanceof StaleExtensionError
  ) {
    return refusal(
      'nothing was written. The ghostnote extension running inside Bitwig is not the build this '
      + 'connection expects, so what it would do with a call cannot be predicted. Rebuild and '
      + 'redeploy it (`cd extension && ./gradlew copyExtension`), then reload the controller in '
      + 'Bitwig under Settings -> Controllers.',
    );
  }
  return refusal(
    'nothing was written, and the failure is one this surface does not recognise. The detail '
    + 'below is a bug report rather than an explanation.',
    { unexpected: error instanceof Error ? `${error.name}: ${error.message}` : String(error) },
  );
}
