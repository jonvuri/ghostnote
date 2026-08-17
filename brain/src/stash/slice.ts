/**
 * Partial revert, sliced by musical address — D5's "keep the hats, revert the
 * snare".
 *
 * ⚠ **KEPT when the take store was retired** (D17 rev, §d): partial revert by
 * address is not a store feature, it is a stash feature. Branching yields one
 * winner per track, and D5's motivating case — *"that take had a better
 * hi-hat"* — is WITHIN a track, so no amount of track-level branching reaches it.
 *
 * The whole feature is a filter, and that is the point. `addressKey`
 * ([address.ts:118](../contract/address.ts)) was built "for write-set diffing and
 * partial-revert slicing"; session 1's `revertOps` takes `{targets, unrevertable,
 * stash}` rather than a whole take. So slicing is: drop targets whose key the
 * slice does not select, hand the rest to the same function. No new concepts, no
 * second code path, and nothing that can disagree with a whole revert about what
 * a revert means.
 *
 * ⚠ **Granularity is `addressKey`, and time/pitch ranges are deliberately NOT
 * offered.** PHASE-1 §Risks names over-modelling here as the phase's top design
 * risk, and a time-sliced revert is not merely more code: a `note.write`
 * truncates same-pitch neighbours OUTSIDE its own extent (E8-E), so restoring
 * "beats 4-8 of this clip" cannot be done by replaying a sub-range of the stash.
 * It would need a merge of stashed and live notes — which is exactly the "if a
 * merge operation appears in the design, something has gone wrong" tripwire.
 * Whole-clip slicing has no such problem. Note changes protect all 16 channels
 * because the host can clear only the complete clip (D16e, D21).
 *
 * ⚠ D20 re-confirms that refusal and says why it is different in kind from the
 * rest of the destruction posture: *"authorization changes 'may we', never 'how'
 * — mechanical walls do not move for permission."* A directed, approved,
 * explicitly-requested time-sliced revert is still refused, because what stops it
 * is E8-E and not a privilege.
 *
 * A slice is PLAIN DATA on purpose: it crosses the MCP tool surface as an
 * argument, and a predicate cannot cross a wire.
 */
import { addressKey, addressScene, addressTrack, type Address, type AddressKey, type ClipAddress, type TrackAddress } from '../contract/index.js';
import { EmptySliceError } from './errors.js';

export interface Slice {
  /**
   * Exact keys — what a checkbox list sends, since every take already exposes
   * its own keys through `values[].key`.
   */
  readonly keys?: readonly AddressKey[];
  /**
   * Key prefixes, for the cases a UI would rather express structurally.
   *
   * ⚠ The kind tag leads the key (`notes:…`, `clip:…`), so one prefix selects one
   * KIND. "Everything about this clip" is therefore two prefixes, not one — which
   * is why `selectClip` below exists and why callers should prefer it to writing
   * prefixes by hand against a grammar that is not theirs.
   */
  readonly prefixes?: readonly AddressKey[];
}

/** Everything the take touched. The default, and the shape a full revert uses. */
export const WHOLE_TAKE: Slice = {};

/**
 * ⚠ "No slice was given" and "a slice that selects nothing" are DIFFERENT, and
 * conflating them is a data-loss bug rather than a rounding error.
 *
 * The first version of this asked whether the key lists were empty, which made
 * `selectClip(take, someClipTheTakeNeverTouched)` — an empty `keys` array —
 * indistinguishable from `WHOLE_TAKE`. A human asking to revert one clip would
 * have had the ENTIRE take reverted, silently, precisely because their request
 * matched nothing. Presence of the field is the test; emptiness is a refusal
 * (`assertSelects`). Found by a test.
 */
export function isWholeTake(slice: Slice | undefined): boolean {
  return slice === undefined || (slice.keys === undefined && slice.prefixes === undefined);
}

export function selects(slice: Slice | undefined, key: AddressKey): boolean {
  if (isWholeTake(slice)) return true;
  if (slice!.keys?.includes(key)) return true;
  return (slice!.prefixes ?? []).some((p) => key.startsWith(p));
}

/**
 * The keys in `addresses` that belong to `clip`.
 *
 * Built from `addressTrack` and `addressScene` rather than by parsing the key
 * string, so this cannot drift from `addressKey`'s grammar — the two would
 * otherwise be a duplicated spec, and the copy that goes stale is the one that
 * silently selects nothing.
 */
export function selectClip(addresses: readonly Address[], clip: ClipAddress): Slice {
  const wanted = clip.slot;
  return {
    keys: addresses
      .filter((a) => {
        const track = addressTrack(a);
        const scene = addressScene(a);
        return track?.channelId === wanted.track.channelId
          && scene?.index === wanted.scene.index
          && scene?.epoch === wanted.scene.epoch;
      })
      .map(addressKey),
  };
}

/** The keys in `addresses` that hang off `track`, of every kind. */
export function selectTrack(addresses: readonly Address[], track: TrackAddress): Slice {
  return {
    keys: addresses
      .filter((a) => addressTrack(a)?.channelId === track.channelId)
      .map(addressKey),
  };
}

/**
 * ⚠ Refuse a slice that selects nothing.
 *
 * A partial revert matching zero addresses would apply zero ops and report
 * success, which from the outside is indistinguishable from a revert that
 * worked — the human hears no change and cannot tell whether the store is
 * broken or the take was. D5's "never silently under-delivers" makes this a
 * refusal rather than a warning.
 */
export function assertSelects(slice: Slice | undefined, available: readonly AddressKey[]): void {
  if (isWholeTake(slice)) return;
  if (available.some((key) => selects(slice, key))) return;
  throw new EmptySliceError(available);
}
