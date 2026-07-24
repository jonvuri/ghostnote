/**
 * The META section — BWFORMAT_SPEC §2. A flat, self-describing TLV run from
 * byte 42, space-padded out to `f4-1`.
 *
 *   record := section | field
 *   section:= u32(4)  u32 nameLen  name
 *   field  := u32(1)  u32 nameLen  name  u8 type  value
 *
 * The load-bearing key is `referenced_modulator_ids` (a `0x19` str[]): it must
 * stay in sync with the modulator GUIDs in the object stream (E10c/E10f).
 * Growing or shrinking META shifts the object stream, so every edit here
 * finishes by patching the header `f4` — and only `f4`.
 */
import { TYPE, fail, readStr, spliceBuffer } from './format.js';
import { parseHeader, shiftF4 } from './header.js';

export const META_START = 42;
export const REF_MOD_IDS = 'referenced_modulator_ids';

const KIND_SECTION = 4;
const KIND_FIELD = 1;

export type MetaValue = string | number | string[];

export interface MetaRecord {
  kind: 'section' | 'field';
  name: string;
  /** value type byte (`0x02` u8, `0x03` u32, `0x08` str, `0x19` str[]); absent on sections */
  type?: number;
  value?: MetaValue;
  /** absolute offset of the record's leading `u32` kind word */
  start: number;
  /** absolute offset one past the record */
  end: number;
  /** absolute offset of the encoded value (after the type byte); absent on sections */
  valueStart?: number;
}

/** The absolute offset one past the last META byte — i.e. the `0x0a` separator. */
export function metaEnd(buf: Buffer): number {
  return parseHeader(buf).streamOffset;
}

/**
 * Walk META records. Stops at the space padding that runs out to `f4-1`; a
 * record whose leading word is neither `4` (section) nor `1` (field) ends the
 * walk, which is exactly how the padding terminates it.
 */
export function parseMetaRecords(buf: Buffer): MetaRecord[] {
  const limit = metaEnd(buf);
  const out: MetaRecord[] = [];
  let p = META_START;
  while (p + 8 <= limit) {
    const kind = buf.readUInt32BE(p);
    if (kind !== KIND_SECTION && kind !== KIND_FIELD) break; // padding
    const nameLen = buf.readUInt32BE(p + 4);
    const nameAt = p + 8;
    if (nameAt + nameLen > limit) fail(`META record at 0x${p.toString(16)} overruns the section`);
    const name = buf.toString('utf8', nameAt, nameAt + nameLen);
    if (kind === KIND_SECTION) {
      out.push({ kind: 'section', name, start: p, end: nameAt + nameLen });
      p = nameAt + nameLen;
      continue;
    }
    const type = buf.readUInt8(nameAt + nameLen);
    const valueStart = nameAt + nameLen + 1;
    let value: MetaValue;
    let valueEnd: number;
    switch (type) {
      case 0x02: // u8 — META's own compact int, distinct from the stream's 0x01
        value = buf.readUInt8(valueStart);
        valueEnd = valueStart + 1;
        break;
      case TYPE.U32:
        value = buf.readUInt32BE(valueStart);
        valueEnd = valueStart + 4;
        break;
      case TYPE.STR:
        value = readStr(buf, valueStart);
        valueEnd = valueStart + 4 + buf.readUInt32BE(valueStart);
        break;
      case TYPE.STR_ARRAY: {
        const count = buf.readUInt32BE(valueStart);
        const items: string[] = [];
        let q = valueStart + 4;
        for (let i = 0; i < count; i++) {
          items.push(readStr(buf, q));
          q += 4 + buf.readUInt32BE(q);
        }
        value = items;
        valueEnd = q;
        break;
      }
      default:
        return fail(`unknown META value type 0x${type.toString(16)} for ${JSON.stringify(name)}`);
    }
    out.push({ kind: 'field', name, type, value, start: p, end: valueEnd, valueStart });
    p = valueEnd;
  }
  return out;
}

/** Every META field as a plain map (sections are structural and dropped). */
export function readMeta(buf: Buffer): Map<string, MetaValue> {
  const m = new Map<string, MetaValue>();
  for (const r of parseMetaRecords(buf)) {
    if (r.kind === 'field') m.set(r.name, r.value as MetaValue);
  }
  return m;
}

function refRecord(buf: Buffer): MetaRecord {
  const rec = parseMetaRecords(buf).find((r) => r.kind === 'field' && r.name === REF_MOD_IDS);
  if (!rec) fail(`META has no ${REF_MOD_IDS} field`);
  if (rec.type !== TYPE.STR_ARRAY) fail(`${REF_MOD_IDS} is not a str[] (type 0x${rec.type?.toString(16)})`);
  return rec;
}

/** The current `referenced_modulator_ids` list, in order. */
export function readModulatorRefs(buf: Buffer): string[] {
  return (refRecord(buf).value as string[]).slice();
}

/** Rewrite `referenced_modulator_ids` wholesale, bump the count, patch `f4`. */
export function writeModulatorRefs(buf: Buffer, refs: string[]): Buffer {
  const rec = refRecord(buf);
  const parts: Buffer[] = [];
  const count = Buffer.allocUnsafe(4);
  count.writeUInt32BE(refs.length, 0);
  parts.push(count);
  for (const ref of refs) {
    const bytes = Buffer.from(ref, 'utf8');
    const len = Buffer.allocUnsafe(4);
    len.writeUInt32BE(bytes.length, 0);
    parts.push(len, bytes);
  }
  const replacement = Buffer.concat(parts);
  const spliced = spliceBuffer(buf, rec.valueStart as number, rec.end, replacement);
  return shiftF4(spliced, spliced.length - buf.length);
}

/** Append one GUID (E10f step 3). Duplicates are legitimate — same-type modulators (E11f). */
export function appendMetaRef(buf: Buffer, guid: string): Buffer {
  return writeModulatorRefs(buf, [...readModulatorRefs(buf), guid]);
}

/** Remove the entry at `index`, keeping order aligned with the modulator list. */
export function removeMetaRefAt(buf: Buffer, index: number): Buffer {
  const refs = readModulatorRefs(buf);
  if (index < 0 || index >= refs.length) fail(`no ${REF_MOD_IDS} entry at index ${index}`);
  refs.splice(index, 1);
  return writeModulatorRefs(buf, refs);
}

/** Remove the first entry equal to `guid`. */
export function removeMetaRef(buf: Buffer, guid: string): Buffer {
  const refs = readModulatorRefs(buf);
  const at = refs.indexOf(guid);
  if (at === -1) fail(`${guid} is not in ${REF_MOD_IDS}`);
  return removeMetaRefAt(buf, at);
}

/** Swap the entry at `index` — the ordered counterpart of a modulator replace. */
export function replaceMetaRefAt(buf: Buffer, index: number, guid: string): Buffer {
  const refs = readModulatorRefs(buf);
  if (index < 0 || index >= refs.length) fail(`no ${REF_MOD_IDS} entry at index ${index}`);
  refs[index] = guid;
  return writeModulatorRefs(buf, refs);
}
