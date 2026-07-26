/**
 * Fidelity labelling — DERIVED, never remembered.
 *
 * D5 requires every take to carry "what it can and cannot restore, so a revert
 * never silently under-delivers", and PHASE-1 §Risks names the way that promise
 * usually dies: the label gets skipped under time pressure, and a later phase
 * reverts a device insert believing it was exact. The mitigation is that no
 * caller can attach a label — the executor computes one from three sources that
 * already exist:
 *
 *   `ADDRESS_IDENTITY`     which kinds are durable vs positional (address.ts)
 *   `NOTE_PROP_FIDELITY`   which properties round-trip (state.ts)
 *   the adapter's own      per-entry `Fidelity` from readback
 *
 * The three combine by taking the WORST, which is the only safe direction: a
 * label that over-promises is worse than no label at all.
 */
import {
  ADDRESS_IDENTITY, GAIN_READ_SCALE, NOTE_PROP_FIDELITY, UNVERIFIED_NOTE_PROPS,
  UNWRITABLE_NOTE_PROPS, addressKey,
  type Fidelity, type NoteRecord, type Snapshot, type StateValue,
} from '../contract/index.js';
import type { TakeValue } from './take.js';
import { isAtRisk, type StructuralRisk, type WriteTarget } from './write-set.js';

const RANK: Record<Fidelity, number> = { none: 0, lossy: 1, exact: 2 };

export function worse(a: Fidelity, b: Fidelity): Fidelity {
  return RANK[a] <= RANK[b] ? a : b;
}

export function worstOf(values: readonly { readonly fidelity: Fidelity }[]): Fidelity {
  return values.reduce<Fidelity>((f, v) => worse(f, v.fidelity), 'exact');
}

/**
 * The properties on these notes whose round-trip we cannot promise, each with
 * the measurement that says so.
 *
 * Derived from `NOTE_PROP_FIDELITY` rather than naming `gain` and `pressure`,
 * so a Phase-1 live probe that promotes `gain` to `exact` silently retires this
 * caveat everywhere at once — which is the whole reason the table exists.
 */
export function notePropCaveats(notes: readonly NoteRecord[]): string[] {
  const caveats: string[] = [];
  const present = (prop: string): boolean =>
    notes.some((n) => (n as unknown as Record<string, unknown>)[prop] !== undefined);

  for (const prop of UNVERIFIED_NOTE_PROPS) {
    if (!present(prop)) continue;
    caveats.push(
      `${prop}: reads back ${GAIN_READ_SCALE}x what was written and the INVERSE IS UNVERIFIED ` +
        '(E2, D8) — the stash records the doubled readback, so replaying it would compound the ' +
        'error on every revert. Captured and reported; never corrected on a guess.',
    );
  }
  for (const prop of UNWRITABLE_NOTE_PROPS) {
    if (!present(prop)) continue;
    caveats.push(
      `${prop}: cannot be written through this API at all (E15-E) — the value lands only in the ` +
        'writing cursor\'s own NoteStep cache. A human may have authored it, so the stash keeps ' +
        'it as a record; a revert cannot put it back.',
    );
  }
  return caveats;
}

/**
 * Label one write-set target from its stashed state.
 *
 * The order of the tests is the order of severity, and each one is a different
 * question:
 *
 *   1. can this address be restored AT ALL?      (`WriteTarget.restore`, E3/D8)
 *   2. could we even SEE it?                     (bank window, E5)
 *   3. was anything there?                       (absence is restorable)
 *   4. what did the adapter say about readback?  (its own `Fidelity`)
 *   5. does the batch move positional addresses? (`ADDRESS_IDENTITY`, E3)
 *   6. which individual properties are lossy?    (`NOTE_PROP_FIDELITY`, E2/E15-E)
 */
export function labelTarget(target: WriteTarget, stash: Snapshot, risk: StructuralRisk): TakeValue {
  const base = { address: target.address, key: target.key } as const;
  const caveats: string[] = [];

  if (target.restore === 'none') {
    return { ...base, fidelity: 'none', value: stash.entries[target.key]?.value, caveats: [target.reason ?? 'no inverse exists'] };
  }

  if (stash.unreachable.some((a) => addressKey(a) === target.key)) {
    return {
      ...base,
      fidelity: 'none',
      value: undefined,
      caveats: [
        'outside the bank window: this address is INVISIBLE, not empty, so its prior state was ' +
          'never captured and cannot be restored (E5, standing rule 5).',
      ],
    };
  }

  const entry = stash.entries[target.key];
  if (entry === undefined) {
    // Nothing was there. That is a state a revert CAN reproduce — by writing
    // nothing, or by deleting whatever the batch created — so it is exact, and
    // the caveat exists only so a reader is never surprised by an empty value.
    return { ...base, fidelity: 'exact', value: undefined, caveats: ['nothing was there before this batch'] };
  }

  let fidelity: Fidelity = entry.fidelity;

  if (isAtRisk(target.address, risk)) {
    fidelity = worse(fidelity, 'lossy');
    caveats.push(
      `${target.address.kind} is a POSITIONAL address (ADDRESS_IDENTITY) and this batch contains ` +
        'a structural op that can move it — scene deletion compacts rows and device chains ' +
        're-index (E3). Re-resolve before replaying this take.',
    );
  }

  caveats.push(...valueCaveats(entry.value));
  return { ...base, fidelity, value: entry.value, caveats };
}

function valueCaveats(value: StateValue): string[] {
  switch (value.of) {
    case 'notes':
      return notePropCaveats(value.notes);
    case 'clip':
      return value.exists
        ? ['a clip that already existed cannot be recreated from readback (E3, D8)']
        : [];
    case 'device':
      return ['device state has no readback that could reproduce the chain (E3, D8)'];
    case 'track':
    case 'param':
      return [];
  }
}

/**
 * Which of a note's properties may be REPLAYED, and which the stash can only
 * report. Shared by `revert.ts` and by the labelling above so the two can never
 * disagree about what a revert is going to do.
 */
export function splitReplayable(note: NoteRecord): { note: NoteRecord; withheld: string[] } {
  const bag = { ...(note as unknown as Record<string, unknown>) };
  const withheld: string[] = [];
  for (const [prop, f] of Object.entries(NOTE_PROP_FIDELITY)) {
    if (f === 'exact') continue;
    if (bag[prop] === undefined) continue;
    delete bag[prop];
    withheld.push(prop);
  }
  return { note: bag as unknown as NoteRecord, withheld };
}

/** Is this address kind anchored to something that survives a structural op? */
export const isDurable = (kind: keyof typeof ADDRESS_IDENTITY): boolean =>
  ADDRESS_IDENTITY[kind] === 'durable';
