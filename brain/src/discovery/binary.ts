/**
 * Bounded binary reading for the discovery readers (V14, E349, E350).
 *
 * Every reader consumes its input exactly and refuses truncation, oversized counts, and unexpected bytes. A file
 * read records the inode, size, and both timestamps before and after the read, so an ordinary concurrent rewrite
 * is detected. That is not an atomic host snapshot: Bitwig can append to an index between two complete reads.
 */
import { openSync, closeSync, fstatSync, readSync, statSync } from 'node:fs';

export class DiscoveryFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryFormatError';
  }
}

export class ByteReader {
  pos = 0;
  constructor(readonly data: Buffer, readonly limit = 32 * 1024 * 1024) {
    if (data.length > limit) throw new DiscoveryFormatError('input exceeds the read bound');
  }

  get remaining(): number { return this.data.length - this.pos; }

  take(n: number): Buffer {
    if (!Number.isInteger(n) || n < 0 || n > this.remaining) {
      throw new DiscoveryFormatError(`truncated input at ${this.pos}, requested ${n}`);
    }
    const out = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  u8(): number { return this.take(1)[0]!; }
  u16le(): number { return this.take(2).readUInt16LE(0); }
  u32le(): number { return this.take(4).readUInt32LE(0); }
  u32be(): number { return this.take(4).readUInt32BE(0); }
  u64le(): bigint { return this.take(8).readBigUInt64LE(0); }
  u64be(): bigint { return this.take(8).readBigUInt64BE(0); }

  boolean(): boolean {
    const n = this.u8();
    if (n !== 0 && n !== 1) throw new DiscoveryFormatError('invalid boolean');
    return n === 1;
  }

  /** Bitwig's big-endian string: a 31-bit character count with the high bit selecting UTF-16BE over ASCII. */
  stringBe(maxChars = 1024 * 1024): string {
    const n = this.u32be();
    const wide = (n & 0x80000000) !== 0;
    const count = n & 0x7fffffff;
    if (count > maxChars) throw new DiscoveryFormatError('oversized string');
    const bytes = this.take(count * (wide ? 2 : 1));
    if (wide) return utf16be(bytes);
    for (const byte of bytes) if (byte > 0x7f) throw new DiscoveryFormatError('non-ASCII byte in a narrow string');
    return bytes.toString('latin1');
  }

  done(): void {
    if (this.pos !== this.data.length) {
      throw new DiscoveryFormatError(`unconsumed bytes: ${this.data.length - this.pos}`);
    }
  }
}

export function utf16be(bytes: Buffer): string {
  if (bytes.length % 2 !== 0) throw new DiscoveryFormatError('odd UTF-16 byte length');
  const swapped = Buffer.from(bytes);
  swapped.swap16();
  return swapped.toString('utf16le');
}

export interface FileSignature {
  readonly dev: string;
  readonly ino: string;
  readonly size: number;
  readonly mtimeNs: string;
  readonly ctimeNs: string;
}

export const signatureKey = (s: FileSignature): string => `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;

const signatureOf = (stat: { dev: bigint; ino: bigint; size: bigint; mtimeNs: bigint; ctimeNs: bigint }): FileSignature => ({
  dev: String(stat.dev), ino: String(stat.ino), size: Number(stat.size), mtimeNs: String(stat.mtimeNs), ctimeNs: String(stat.ctimeNs),
});

export function fileSignature(path: string): FileSignature {
  return signatureOf(statSync(path, { bigint: true }));
}

/** Read one complete regular file whose signature is equal before and after the read. */
export function readStableFile(path: string, maxBytes = 32 * 1024 * 1024): { bytes: Buffer; signature: FileSignature } {
  const fd = openSync(path, 'r');
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) throw new DiscoveryFormatError('not a regular file');
    if (before.size > BigInt(maxBytes)) throw new DiscoveryFormatError(`file is larger than ${maxBytes} bytes`);
    const size = Number(before.size);
    const bytes = Buffer.alloc(size);
    let read = 0;
    while (read < size) {
      const n = readSync(fd, bytes, read, size - read, read);
      if (n === 0) break;
      read += n;
    }
    const after = signatureOf(fstatSync(fd, { bigint: true }));
    const signature = signatureOf(before);
    if (read !== size || signatureKey(after) !== signatureKey(signature)) {
      throw new DiscoveryFormatError('the file changed during the read');
    }
    return { bytes, signature };
  } finally {
    closeSync(fd);
  }
}
