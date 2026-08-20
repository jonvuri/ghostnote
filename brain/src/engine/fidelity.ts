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
  ADDRESS_IDENTITY, NOTE_PROP_FIDELITY, UNVERIFIED_NOTE_PROPS,
  UNWRITABLE_NOTE_PROPS, addressKey, stepSizeFor,
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
    caveats.push(`${prop}: its write/read inverse is unverified, so the stash records and reports `
      + 'the value but does not replay it on a guess.');
  }
  for (const prop of UNWRITABLE_NOTE_PROPS) {
    if (!present(prop)) continue;
    caveats.push(
      `${prop}: cannot be written through this API at all (E15-E) — the value lands only in the ` +
        'writing cursor\'s own NoteStep cache. A human may have authored it, so the stash keeps ' +
        'it as a record; a revert cannot put it back.',
    );
  }
  if (notes.length > 0 && stepSizeFor(notes) === undefined) {
    caveats.push(
      'note timing: one or more captured host durations cannot be represented on the writable '
        + 'grid, so replay would refuse before restoring the clip.',
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

  // ⚠ The adapter grades its own READBACK; this grades what a revert can do with
  // what came back, and for one value the two genuinely differ (see below). Same
  // direction as everything else here — worst wins — so an adapter can only ever
  // be corrected downwards.
  fidelity = worse(fidelity, restorability(entry.value));

  caveats.push(...valueCaveats(entry.value));
  return { ...base, fidelity, value: entry.value, caveats };
}

/**
 * What a REVERT can put back from this value, as distinct from how faithfully the
 * adapter read it.
 *
 * ⚠ One member today, and it is the D16 amendment's own edge case. A clip that
 * was THERE is rebuilt from its captured length (`revert.ts`) — so a clip entry
 * with no length is not "restorable, minus some metadata". It cannot be rebuilt
 * at all, and `revertOps` withholds its NOTES as well, because replaying them
 * into a slot with no clip lands the cursor on a DIFFERENT clip, silently (E2).
 * Nothing about the address survives, which is `none`.
 *
 * Both adapters report `lossy` here, correctly — they are describing a readback
 * that worked, and neither of them knows what revert does with it. Deriving the
 * consequence once, on this side, is why the rule cannot drift between them; it
 * is the same reason the label is computed rather than attached (D5).
 *
 * ⚠ It is not cosmetic. The stash's `summarize` lists exactly the `none` values
 * as `unrestorable`, so a clip labelled `lossy` here would drop out of the
 * changeset listing and the loss would surface only in the middle of a reversal
 * — which is the "never silently under-delivers" half of D5 failing.
 */
function restorability(value: StateValue): Fidelity {
  if (value.of === 'clip' && value.exists && value.lengthBeats === undefined) return 'none';
  if (value.of === 'notes' && value.notes.length > 0 && stepSizeFor(value.notes) === undefined) {
    return 'lossy';
  }
  return 'exact';
}

function valueCaveats(value: StateValue): string[] {
  switch (value.of) {
    case 'notes':
      return notePropCaveats(value.notes);
    case 'clip':
      // ⚠ AMENDED 2026-08-18 (D16, E43). Shipped clip metadata and launch
      // settings have exact paths. The play-stop setter is inert, and automation
      // remains opaque.
      if (!value.exists) return [];
      return [
        value.lengthBeats === undefined
          ? 'this clip\'s LENGTH was not captured, so it cannot be recreated at all and its ' +
            'notes cannot be replayed into it — a clip rebuilt at a guessed length is a musical ' +
            'value invented from nothing (D16, §3.3.3).'
          : `a clip that already existed is restored as a new ${value.lengthBeats}-beat clip ` +
            'with its exact metadata, launch settings, and notes. Its PLAY-STOP MARKER is not ' +
            'restored because the setter is inert, and its AUTOMATION LANES are not restored ' +
            'because the host API has no complete lane readback (E43).',
      ];
    case 'clipLaunch':
    case 'clipMetadata':
    case 'clipPlay':
      return [];
    case 'device':
      return ['device state has no readback that could reproduce the chain (E3, D8)'];
    // ⚠ A chain entry is a RECORD, not a restore plan, and the reason is measured
    // rather than architectural: chain creation exists only as duplication of a
    // chain that is already there (`e17ak`) and every typed chain DELETE refuses
    // (`e17al`, `e17am`, exhausted across both `DeleteableObject` forms). So a
    // reversal can neither put a removed chain back nor take an added one away.
    case 'chain':
      return ['a layer chain cannot be recreated or removed by any measured typed route '
        + '(e17ak creates only by duplication; e17al/e17am exhaust delete), so this entry '
        + 'records the chain and its devices and restores neither'];
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
