/**
 * `bwmod` public types — see context/spike/BWMOD_DESIGN.md §1.
 *
 * Everything here describes the plain (encoding `0002`) `.bwpreset` container
 * documented in context/spike/BWFORMAT_SPEC.md. Byte offsets are absolute
 * within the whole file unless a name says otherwise.
 */

export interface Header {
  /** container version, hex ASCII — `0003` on Bitwig 6.x */
  container: string;
  /** `0002` = plain TLV (the only editable form); `0004` = opaque DSP blob */
  encoding: string;
  /** writer/device version, hex ASCII */
  writer: string;
  /** `f4 - 1`: the offset of the `0x0a` marker; the root object starts at `f4` */
  streamOffset: number;
  /** header `f5` — meaning [U]; read-only, preserved verbatim, never synthesized */
  f5: string;
  /** 0 = no embedded plugin-state blob; else the absolute offset of its `PK\x03\x04` */
  f6: number;
}

export interface Routing {
  /** field `0x0e3d` — a Ramona model path, e.g. `CONTENTS/F1FREQ` */
  target: string;
  /** field `0x0e32` — modulation amount; 0 leaves the route dormant (E7d) */
  amount: number;
  /** field `0x0124` */
  rangeLo?: number;
  /** field `0x0125` */
  rangeHi?: number;
}

export interface Modulator {
  /** physical position in the `0x1a46` MODULATORS list (0-based) */
  index: number;
  /** field `0x02b9` — display index as a string; cosmetic, not a load gate (E11b) */
  name: string;
  /** field `0x009a`, e.g. `LFO` */
  deviceName: string;
  /** field `0x009c`, e.g. `LFO` | `Note-driven` — informational, NOT a gate (E10f) */
  category: string;
  /** field `0x18c6`, canonical 8-4-4-4-12 */
  guid: string;
  /** field `0x1a1b` — the uniqueness-gated field; the one proven load gate (E10f) */
  instanceId: number;
  /** the first modulation entry, or null when the modulator routes nowhere */
  routing: Routing | null;
  /** every modulation entry, in stream order (a modulator may drive several targets) */
  routes: Routing[];
  /** absolute byte bounds `[start, end)`; `end` is snapped to the list sentinel (E11h) */
  span: [number, number];
}

/**
 * A modulator object lifted out of a human-authored template, ready to
 * transplant (BWMOD_DESIGN decision 3 — donors are extracted, never synthesized).
 */
export interface DonorObject {
  /** the exact `0x06c9` object bytes, ending at its own `00 00 00 00` terminator */
  bytes: Buffer;
  /** field `0x18c6`, canonical 8-4-4-4-12 — also the meta `referenced_modulator_ids` entry */
  guid: string;
  /** field `0x009c` */
  category: string;
  /** field `0x009a` */
  deviceName: string;
  /**
   * The donor subtree's OBJECT footprint, consumed only by Tier-2 (sampled)
   * edits to relocate the count-list reference stubs.
   *
   * ⚠ This cannot be computed from `bytes` — a full recursive walk stalls in the
   * deep-list schema limit (BWFORMAT_SPEC §3.1). It is curated asset metadata,
   * measured once per donor by E12a load-triangulation. `null` means "not
   * measured": such a donor is fine on a Tier-1 preset and is REFUSED on a
   * sampled one rather than guessed.
   */
  footprint: number | null;
}

export interface ValidationResult {
  ok: boolean;
  /** human-readable; empty iff `ok` */
  problems: string[];
  /**
   * Conditions that do not predict a reject but do predict a silent no-op —
   * chiefly an empty route target (a bad Ramona path only shows up on readback, E10b).
   */
  warnings: string[];
}

/** A layer container's chain, as far as E10d's evidence resolves it. */
export interface Chain {
  index: number;
  /** field `0x02b9`, e.g. `CHAIN0` */
  name: string;
  /** absolute start of the `0x018f` object */
  start: number;
  /**
   * Absolute end, or `null` for the LAST chain — its tail belongs to the parent
   * and E10d never resolved an exact bound. Trim by dropping earlier chains.
   */
  end: number | null;
}
