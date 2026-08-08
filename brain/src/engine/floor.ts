/**
 * The fidelity floor — a REFUSAL, never an automatic branch.
 *
 * E16-OPEN-QUESTIONS §3.3.5 derived the floor's membership rather than listing
 * it, and the derivation produced a predicate that was already in the code:
 *
 *   resolve → stash → LABEL → (floor) → apply → verify → report
 *                      ▲
 *                      └── `labelTarget` / `worstOf`, fidelity.ts
 *
 * **The predicate is unchanged: the batch's own labelled fidelity is worse than
 * `exact`.** Five properties make it better than a hand-kept list, and all five
 * still hold: it is evaluable at the one instant the decision can still be made
 * (the labels exist before the first write); it was already implemented; it
 * cannot rot, because `targetsOf`'s `assertNever` turns an unmapped op into a
 * COMPILE error; it retires its own members (promote `gain` to `exact` in
 * `state.ts` and note writes stop tripping it everywhere at once); and it is
 * content-conditional, which a list cannot be — the same `note.write` is `exact`
 * on a clean clip and `lossy` on one a human has played into.
 *
 * ⚠ **What changed on 2026-08-07 is the RESPONSE, and it is the whole point
 * (D18c).** The floor used to say *fork automatically*. It now says **refuse
 * unless the caller cleared it** — because an automatic fork is automatic
 * mechanism-level branching, and the operator's framing forbids that outright:
 * *"only reporting is imposed, no automatic mechanism-level branching or
 * prescriptiveness."* Three consequences worth stating rather than discovering:
 *
 *   - **The refusal is a DOCUMENTED PRECONDITION**, so it is predictable. An
 *     unpredictable refusal pollutes the measurement it is supposed to protect —
 *     a wall-bump that forces a change of approach is not judgement.
 *   - ⚠ **The refusal text never redirects.** It says what cannot be restored
 *     and what would clear it, and it names no mechanism, because a redirect
 *     arriving through an error message is the leak wearing a disguise (D18c).
 *   - **There is no prescriptive fallback.** If nothing clears the batch, the
 *     system reports and stops. It does not pick.
 *
 * ⚠ The predicate reads `WriteSet.targets` and deliberately NOT
 * `WriteSet.unrevertable`, whose members have no prior address to label. That is
 * exactly right rather than an oversight: with `device.insert` moved out
 * (D16 amendment 2), what remains there is `track.create` (nothing to branch) and
 * `scene.create` (not track-scoped) — the ops a branch could not rescue anyway.
 * They still reach the take, through `revertOps`' `unrestored`.
 */
import type { Fidelity, Op } from '../contract/index.js';
import { worstOf } from './fidelity.js';
import type { TakeValue } from './take.js';

/**
 * Why a batch may proceed when its prior state cannot be restored exactly.
 *
 * Two kinds, and they are kept distinct rather than collapsed into a boolean
 * because the record has to be able to tell them apart afterwards — one is a
 * branch the caller took responsibility for, the other is the human asking for
 * their own changes back.
 */
export type Clearance =
  /**
   * D18c: the batch runs somewhere its prior state survives. WHICH mechanism is
   * the caller's business and is deliberately not modelled here — this type
   * carries an identifier, not a kind, so no dispatch rule can hide in it.
   */
  | { readonly kind: 'branch-protected'; readonly branch: string }
  /**
   * D19/D20: reversing our own changeset rides the ordinary write surface and is
   * not gated. Refusing it would be the deadlock version of the rule — a lossy
   * take could never be undone at all — and the fidelity machinery already
   * reports what the reversal cannot put back (`unrestored`), which is the
   * protection D19 actually asks for.
   */
  | { readonly kind: 'own-changeset-reversal'; readonly of: string };

/** The batch is protected by `branch`, whatever that branch turns out to be. */
export const branchProtected = (branch: string): Clearance => ({ kind: 'branch-protected', branch });

/** The batch puts back what take `of` changed. */
export const ownChangesetReversal = (of: string): Clearance =>
  ({ kind: 'own-changeset-reversal', of });

/**
 * A write whose prior state cannot be restored exactly, with nothing protecting
 * it. Loud, and refused before the first op goes out.
 */
export class UnprotectedWriteError extends Error {
  constructor(
    readonly fidelity: Fidelity,
    readonly caveats: readonly string[],
    detail: string,
  ) {
    super(
      `refused: this batch would change state it cannot put back exactly (${fidelity}). ${detail}` +
        (caveats.length === 0 ? '' : `\n  - ${caveats.join('\n  - ')}`),
    );
    this.name = new.target.name;
  }
}

/**
 * The floor, over the labels the stash produced.
 *
 * Returns the error to throw, or `undefined` to proceed — the caller throws, so
 * the predicate stays a pure function of the labels and can be read, tested and
 * quoted without running a batch.
 */
export function floorRefusal(
  values: readonly TakeValue[],
  clearance: Clearance | undefined,
): UnprotectedWriteError | undefined {
  const fidelity = worstOf(values);
  if (fidelity === 'exact' || clearance !== undefined) return undefined;
  return new UnprotectedWriteError(
    fidelity,
    values.filter((v) => v.fidelity !== 'exact').flatMap((v) => v.caveats),
    'Nothing was written. Re-run it with the prior state protected, or narrow the batch until ' +
      'everything it touches can be restored exactly.',
  );
}

/**
 * ⚠ The one member that is hard-coded rather than derived, and the reason it has
 * to be: **its damage precedes the stash** (§3.3.6).
 *
 * Everywhere else the stash is a faithful record and the only question is whether
 * it can be REPLAYED, which is what a label answers. For a device REPLACE the
 * stash cannot even be taken — the outgoing device's opaque plugin state is a blob
 * with no readback (B2 read 2193 DirectParameters and that is still not the whole
 * device), so there is no snapshot whose fidelity could be labelled and the
 * predicate's own input is unreliable. A rule that cannot be derived is exactly
 * the shape of thing that deserves to be written down.
 *
 * ⚠ It runs BEFORE anything is read, because reading first would be paying for a
 * stash we already know is insufficient.
 *
 * **Nothing matches it today, and that is a fact about the CONTRACT, not about
 * Bitwig.** `device.insertFileAt` with `where: 'replace'` is on the wire; the
 * `device.insert` op carries `{track, source}` and no placement, so a replace is
 * not expressible. If Phase 5 adds it, the `assertNever` below turns "forgot to
 * classify the new variant" into a compile error rather than an ungated replace.
 */
export function gateBeforeReading(
  ops: readonly Op[],
  clearance: Clearance | undefined,
): UnprotectedWriteError | undefined {
  // ⚠ `branch-protected` ONLY, where the floor above takes either kind. D18c
  // says this one is *"unconditional refusal unless branch-protected"*, and a
  // reversal cannot honestly clear it: putting our own changeset back cannot
  // rebuild a device whose state was never capturable in the first place.
  if (clearance?.kind === 'branch-protected') return undefined;
  for (const op of ops) {
    const why = damagePrecedesTheStash(op);
    if (why !== undefined) {
      return new UnprotectedWriteError('none', [why], 'Nothing was read and nothing was written.');
    }
  }
  return undefined;
}

/** Does this op destroy state that no stash could have captured first? */
function damagePrecedesTheStash(op: Op): string | undefined {
  switch (op.op) {
    // Every one of these leaves its prior state readable long enough to capture
    // it. That is the claim `floorRefusal`'s labels then grade.
    case 'note.write':
    case 'note.clear':
    case 'note.props':
    case 'clip.create':
    case 'clip.delete':
    case 'track.create':
    case 'track.rename':
    case 'track.delete':
    case 'scene.create':
    case 'scene.delete':
    case 'device.insert':
    case 'device.delete':
    case 'param.set':
    case 'notify':
      return undefined;
    default:
      // ⚠ Not a fallthrough — a Phase-4/5 variant must be classified here before
      // it can be executed. `device.insertFileAt where:'replace'` is the member
      // this seat is being kept warm for.
      return assertNeverGated(op);
  }
}

/**
 * Deliberately NOT `assertNever`'s throw-at-runtime shape.
 *
 * An unclassified op is refused, not executed — a variant added without a verdict
 * must fail CLOSED. The compile error is the real defence; this is what happens
 * if someone reaches for a cast to get around it.
 */
function assertNeverGated(op: never): string {
  return `${JSON.stringify(op)} has not been classified against the damage-precedes-the-stash ` +
    'rule (floor.ts). Classify it there before it can run.';
}
