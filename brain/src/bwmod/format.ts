/**
 * Format constants and TLV primitives shared by every reader and editor.
 * Grammar: BWFORMAT_SPEC §3.
 *
 *   stream := 0x0a  object
 *   object := u32 classId  field*  u32(0)
 *   field  := u32 fieldId  u8 type  value
 *   list   := object*  SENTINEL
 *   SENTINEL := 00 00 00 03 00 00 00 00     (an empty cls-0x0003 object, NOT a bare classId 0)
 */

/** The list terminator. Getting this wrong by 2 bytes rejects the whole preset (E11h). */
export const SENTINEL = Buffer.from([0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00]);

/** An object's own field-list terminator: fieldId 0. */
export const OBJ_TERMINATOR = Buffer.from([0x00, 0x00, 0x00, 0x00]);

/** Local-file-header magic of the embedded DEFLATE-ZIP plugin-state blob (E11i). */
export const ZIP_MAGIC = Buffer.from('PK\x03\x04', 'latin1');

export const CLASS_STUB = 0x0001; // a class-1 reference stub (BE-u32 object index)
export const CLASS_SENTINEL = 0x0003;
export const CLASS_MODULATOR = 0x06c9;
export const CLASS_CHAIN = 0x018f;

/** Field ids that matter — BWFORMAT_SPEC §3.2. */
export const FID = {
  DEVICE_NAME: 0x009a,
  DEVICE_CATEGORY: 0x009c,
  RANGE_LO: 0x0124,
  RANGE_HI: 0x0125,
  AMOUNT: 0x0e32,
  ROUTING_TARGET: 0x0e3d,
  NAME: 0x02b9,
  SAMPLE_COUNT_A: 0x129c,
  SAMPLE_COUNT_B: 0x1422,
  DEVICE_GUID: 0x18c6,
  INSTANCE_GROUP: 0x1a1a,
  INSTANCE_ID: 0x1a1b,
  MODULATOR_LIST: 0x1a46,
  CHAIN_LIST: 0x08e0,
} as const;

/** Value types — BWFORMAT_SPEC §3.1. `0x02`/`0x06`/`0x1a` are retired (E11h). */
export const TYPE = {
  U8: 0x01,
  U32: 0x03,
  BOOL: 0x05,
  F64: 0x07,
  STR: 0x08,
  OBJECT: 0x09,
  LIST: 0x12,
  GUID: 0x15,
  STR_ARRAY: 0x19,
} as const;

/** The 5-byte `fieldId + type` signature used to locate a field by scanning. */
export function fieldSig(fid: number, type: number): Buffer {
  const b = Buffer.allocUnsafe(5);
  b.writeUInt32BE(fid, 0);
  b.writeUInt8(type, 4);
  return b;
}

export class BwFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BwFormatError';
  }
}

export function fail(message: string): never {
  throw new BwFormatError(message);
}

/**
 * Byte length of a value of `type` starting at `at`, or `null` when the type
 * is structural (`0x09` object / `0x12` list) and needs the schema to size.
 */
export function valueSize(buf: Buffer, at: number, type: number): number | null {
  switch (type) {
    case TYPE.U8:
    case TYPE.BOOL:
      return 1;
    case TYPE.U32:
      return 4;
    case TYPE.F64:
      return 8;
    case TYPE.GUID:
      return 16;
    case TYPE.STR:
      return 4 + buf.readUInt32BE(at);
    case TYPE.STR_ARRAY: {
      const count = buf.readUInt32BE(at);
      let p = at + 4;
      for (let i = 0; i < count; i++) p += 4 + buf.readUInt32BE(p);
      return p - at;
    }
    case TYPE.OBJECT:
    case TYPE.LIST:
      return null;
    default:
      return fail(`unknown value type 0x${type.toString(16).padStart(2, '0')} at 0x${at.toString(16)}`);
  }
}

/** True when `buf` holds the list SENTINEL at `at`. */
export function isSentinel(buf: Buffer, at: number): boolean {
  return buf.compare(SENTINEL, 0, SENTINEL.length, at, at + SENTINEL.length) === 0;
}

/** Every offset at which `needle` occurs in `buf[from, to)`. */
export function findAll(buf: Buffer, needle: Buffer, from = 0, to = buf.length): number[] {
  const hits: number[] = [];
  for (let i = buf.indexOf(needle, from); i !== -1 && i + needle.length <= to; i = buf.indexOf(needle, i + 1)) {
    hits.push(i);
  }
  return hits;
}

/** Splice `[start, end)` out of `buf` and put `replacement` in its place. Never mutates. */
export function spliceBuffer(buf: Buffer, start: number, end: number, replacement: Buffer): Buffer {
  return Buffer.concat([buf.subarray(0, start), replacement, buf.subarray(end)]);
}

/** Read a length-prefixed (`u32` + UTF-8, not nul-terminated) string at `at`. */
export function readStr(buf: Buffer, at: number): string {
  const len = buf.readUInt32BE(at);
  return buf.toString('utf8', at + 4, at + 4 + len);
}

/**
 * Rewrite a length-prefixed string in place, `u32` prefix included. Lengths may
 * differ: nothing in the object stream encodes a byte span, so a length change
 * needs no enclosing fixup (E10b) beyond the header `f4` when META moved.
 */
export function patchString(buf: Buffer, at: number, value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  const oldLen = buf.readUInt32BE(at);
  const head = Buffer.allocUnsafe(4);
  head.writeUInt32BE(bytes.length, 0);
  return spliceBuffer(buf, at, at + 4 + oldLen, Buffer.concat([head, bytes]));
}

/** Format 16 raw GUID bytes as canonical 8-4-4-4-12. */
export function formatGuid(raw: Buffer): string {
  const h = raw.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
