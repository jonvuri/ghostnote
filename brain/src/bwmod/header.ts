/**
 * The 42-byte ASCII header — BWFORMAT_SPEC §1.1.
 *
 *   [0:4] 'BtWg' | [4:8] container | [8:12] encoding | [12:16] writer
 *   [16:24] f4 = streamOffset + 1 | [24:32] f5 | [32:40] f6 | [40:42] '00'
 *
 * Only `f4` and `f6` are ever written: `f4` when META changes size (E10f), `f6`
 * when a length-changing edit slides an embedded plugin-state blob (E11i).
 */
import type { Header } from './types.js';
import { ZIP_MAGIC, fail } from './format.js';

export const HEADER_LEN = 42;

export function parseHeader(buf: Buffer): Header {
  if (buf.length < HEADER_LEN) fail(`too short to be a BtWg file (${buf.length} bytes)`);
  if (buf.toString('latin1', 0, 4) !== 'BtWg') fail('not a BtWg file (bad magic)');
  const h = buf.toString('latin1', 0, HEADER_LEN);
  const hex = (s: string, what: string) => {
    if (!/^[0-9a-fA-F]+$/.test(s)) fail(`header ${what} is not hex: ${JSON.stringify(s)}`);
    return parseInt(s, 16);
  };
  return {
    container: h.slice(4, 8),
    encoding: h.slice(8, 12),
    writer: h.slice(12, 16),
    streamOffset: hex(h.slice(16, 24), 'f4') - 1,
    f5: h.slice(24, 32),
    f6: hex(h.slice(32, 40), 'f6'),
  };
}

/** Absolute offset of the object stream's `0x0a` marker. */
export function streamOffset(buf: Buffer): number {
  return parseHeader(buf).streamOffset;
}

/** Rewrite `f4` so it points at `newStreamOffset` (stored as `+1`). */
export function setF4(buf: Buffer, newStreamOffset: number): Buffer {
  const out = Buffer.from(buf);
  out.write((newStreamOffset + 1).toString(16).padStart(8, '0'), 16, 8, 'latin1');
  return out;
}

/** Shift `f4` by `delta` bytes — what a META size change costs (E10f). */
export function shiftF4(buf: Buffer, delta: number): Buffer {
  return delta === 0 ? Buffer.from(buf) : setF4(buf, streamOffset(buf) + delta);
}

/**
 * Re-point `f6` at the embedded DEFLATE-ZIP plugin-state blob (decision 8, E11i).
 *
 * No-op when `f6 == 0` (no blob). Otherwise the blob has slid by whatever the
 * edit inserted or removed ahead of it, so we re-locate `PK\x03\x04` rather than
 * trusting arithmetic. The blob itself does NOT mirror modulator topology —
 * only this pointer needs maintenance.
 */
export function repointF6(buf: Buffer): Buffer {
  const { f6, streamOffset: ss } = parseHeader(buf);
  if (f6 === 0) return Buffer.from(buf);
  const at = buf.indexOf(ZIP_MAGIC, ss);
  if (at === -1) fail('header f6 is non-zero but no PK\\x03\\x04 plugin-state blob was found');
  const out = Buffer.from(buf);
  out.write(at.toString(16).padStart(8, '0'), 32, 8, 'latin1');
  return out;
}
