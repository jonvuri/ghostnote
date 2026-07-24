/**
 * Tier-2 (sampled preset) reference-stub relocation — DECISIONS D2, E12.
 *
 * A preset that EMBEDS A SAMPLE carries sample state holding count-field lists
 * (field ids `0x129c` / `0x1422`, type `0x12`). Each list holds one or more
 * class-1 reference stubs and ends with the usual sentinel:
 *
 *   field 0x129c | 0x12 | [ 00 00 00 01 <BE-u32 object index> ]+ | 00 00 00 03 00 00 00 00
 *
 * Each payload indexes an object that sits AFTER the modulator list, so adding
 * or removing a modulator shifts it by that modulator subtree's object
 * FOOTPRINT. The complete rule — and every part of it has drawn blood:
 *
 *   - relocate EVERY stub in EVERY count list by `(inserted − removed) footprint`
 *     (a "first stub only" pass silently rejects multisample, which carries 4);
 *   - the payload is BIG-endian (E11d's LE read matched by single-byte luck);
 *   - the footprint is per-DONOR, not per-type (LFO 0x10, Sampler Random 0x0d,
 *     Polysynth Random 0x0b), so it is curated metadata, never inferred.
 *
 * `retarget`/`setAmount` add and remove no objects, so they never relocate.
 * A sample-less preset has no count lists and is plain Tier 1.
 */
import { CLASS_STUB, FID, TYPE, fieldSig, isSentinel } from './format.js';

const COUNT_LIST_SIGS = [fieldSig(FID.SAMPLE_COUNT_A, TYPE.LIST), fieldSig(FID.SAMPLE_COUNT_B, TYPE.LIST)];
const STUB_HEAD = Buffer.from([0x00, 0x00, 0x00, CLASS_STUB]);

export interface CountStub {
  /** field id of the count list this stub belongs to */
  fieldId: number;
  /** absolute offset of the BE-u32 payload */
  offset: number;
  /** the object index the stub points at */
  value: number;
}

/** Every class-1 stub in every count list, in file order. Empty ⇒ no embedded sample. */
export function findCountStubs(buf: Buffer): CountStub[] {
  const out: CountStub[] = [];
  for (const sig of COUNT_LIST_SIGS) {
    const fieldId = sig.readUInt32BE(0);
    for (let i = buf.indexOf(sig); i !== -1; i = buf.indexOf(sig, i + 1)) {
      let p = i + sig.length;
      while (p + 8 <= buf.length && !isSentinel(buf, p) && buf.compare(STUB_HEAD, 0, 4, p, p + 4) === 0) {
        out.push({ fieldId, offset: p + 4, value: buf.readUInt32BE(p + 4) });
        p += 8;
      }
    }
  }
  return out;
}

/**
 * True when the preset embeds a sample / bulk blob, i.e. when relocation applies.
 * Gate on THIS, never on device class — and never to forbid an op (D2).
 */
export function hasCountStubs(buf: Buffer): boolean {
  return findCountStubs(buf).length > 0;
}

/** Add `delta` to every count stub. Returns a copy; a zero delta is a plain copy. */
export function relocateStubs(buf: Buffer, delta: number): Buffer {
  const out = Buffer.from(buf);
  if (delta === 0) return out;
  for (const stub of findCountStubs(out)) {
    out.writeUInt32BE(stub.value + delta, stub.offset);
  }
  return out;
}

/** Just the payload values — the handy form for tests and diffing. */
export function stubValues(buf: Buffer): number[] {
  return findCountStubs(buf).map((s) => s.value);
}
