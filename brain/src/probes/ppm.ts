/**
 * PPM → PNG, so E14 rows H and I can be judged from an artifact.
 *
 * `Bitmap.saveToDiskAsPPM(String)` is the ONLY export the Bitwig graphics API
 * offers — there is no PNG writer, no framebuffer read, and `getMemoryBlock()`
 * hands back raw ARGB with no header. So a probe that wants to prove "it renders
 * text and paths acceptably" has exactly one route off the DAW, and it lands in
 * a format nothing on a Mac opens.
 *
 * Why this matters more than the file format suggests: rows H and I are the two
 * rows whose real question is *what Bitwig DREW*. Every such row in E14 so far
 * has been settled by asking the human and recording their answer verbatim
 * (`ask()` in lib.ts, and the reason it echoes answers into the transcript). A
 * yes/no about legibility is a much weaker record than the image itself, and the
 * image costs one conversion.
 *
 * No dependencies: node's zlib does the deflate and the CRC.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

export interface Ppm {
  readonly width: number;
  readonly height: number;
  /** RGB triples, row-major, 3 bytes per pixel. */
  readonly rgb: Buffer;
  /** `P6` (binary) or `P3` (ASCII) — recorded because we do not know which Bitwig writes. */
  readonly magic: string;
  readonly maxValue: number;
}

/**
 * Parse a Netpbm PPM.
 *
 * ⚠ Deliberately strict about the things that would corrupt an image silently
 * and tolerant about the things that vary between writers. A `maxValue` other
 * than 255 means 16-bit samples, which we refuse rather than truncate — a
 * half-decoded render is worse evidence than no render, since it looks like a
 * finding about Bitwig when it is a bug here.
 */
export function parsePpm(data: Buffer): Ppm {
  // The header is ASCII whitespace-separated tokens with `#` comments to
  // end-of-line, and the pixel data starts exactly ONE whitespace byte after
  // the maxValue token — so it cannot be tokenised with a regex over the whole
  // file without risking eating a pixel that happens to be 0x20.
  let offset = 0;
  const tokens: string[] = [];
  const isSpace = (b: number) => b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d;

  while (tokens.length < 4) {
    while (offset < data.length && isSpace(data[offset]!)) offset++;
    if (offset < data.length && data[offset] === 0x23) {
      while (offset < data.length && data[offset] !== 0x0a) offset++;
      continue;
    }
    const start = offset;
    while (offset < data.length && !isSpace(data[offset]!)) offset++;
    if (offset === start) throw new Error('truncated PPM header');
    tokens.push(data.toString('ascii', start, offset));
  }
  // Exactly one whitespace byte separates the header from binary pixel data.
  offset++;

  const [magic, widthText, heightText, maxText] = tokens as [string, string, string, string];
  if (magic !== 'P6' && magic !== 'P3') {
    throw new Error(`not a PPM: magic "${magic}" (expected P6 or P3)`);
  }
  const width = Number.parseInt(widthText, 10);
  const height = Number.parseInt(heightText, 10);
  const maxValue = Number.parseInt(maxText, 10);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`bad PPM dimensions: ${widthText}x${heightText}`);
  }
  if (maxValue !== 255) {
    throw new Error(`PPM maxValue ${maxValue} is not 8-bit; refusing rather than truncating`);
  }

  const expected = width * height * 3;
  let rgb: Buffer;
  if (magic === 'P6') {
    rgb = data.subarray(offset, offset + expected);
    if (rgb.length !== expected) {
      throw new Error(`truncated P6 data: ${rgb.length} of ${expected} bytes`);
    }
  } else {
    const values = data.toString('ascii', offset).trim().split(/\s+/);
    if (values.length < expected) {
      throw new Error(`truncated P3 data: ${values.length} of ${expected} samples`);
    }
    rgb = Buffer.from(values.slice(0, expected).map((v) => Number.parseInt(v, 10)));
  }
  return { width, height, rgb, magic, maxValue };
}

/** A PNG chunk: length, type, payload, CRC over type+payload. */
function chunk(type: string, payload: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), payload])) >>> 0, 0);
  return Buffer.concat([head, payload, tail]);
}

/** 8-bit truecolour PNG. Filter byte 0 on every scanline — no prediction. */
export function ppmToPng(ppm: Ppm): Buffer {
  const stride = ppm.width * 3;
  const raw = Buffer.alloc((stride + 1) * ppm.height);
  for (let y = 0; y < ppm.height; y++) {
    raw[y * (stride + 1)] = 0;
    ppm.rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ppm.width, 0);
  ihdr.writeUInt32BE(ppm.height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type 2 = truecolour RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Cheap "is there anything in this image?" summary.
 *
 * Reported alongside every converted render because it catches the failure mode
 * that looks exactly like success from the extension side: a render that returns
 * `rendered: true`, reports plausible text extents, and produces a uniform
 * rectangle of background. One distinct colour means nothing was drawn.
 */
export interface Artifact {
  readonly pngPath: string;
  readonly width: number;
  readonly height: number;
  readonly magic: string;
  readonly distinctColors: number;
  readonly nonBackgroundPct: number;
}

/**
 * Read a PPM the extension just wrote, drop a PNG beside it, and summarise.
 *
 * The PNG is the deliverable: it is what makes "does it render text acceptably"
 * a question anyone can answer later, from the repo, without Bitwig running.
 */
export function convertArtifact(ppmPath: string): Artifact {
  const ppm = parsePpm(readFileSync(ppmPath));
  const pngPath = ppmPath.replace(/\.ppm$/, '.png');
  writeFileSync(pngPath, ppmToPng(ppm));
  return {
    pngPath, width: ppm.width, height: ppm.height, magic: ppm.magic, ...summarise(ppm),
  };
}

export function summarise(ppm: Ppm): { distinctColors: number; nonBackgroundPct: number } {
  const seen = new Set<number>();
  const background = (ppm.rgb[0]! << 16) | (ppm.rgb[1]! << 8) | ppm.rgb[2]!;
  let nonBackground = 0;
  for (let i = 0; i < ppm.rgb.length; i += 3) {
    const c = (ppm.rgb[i]! << 16) | (ppm.rgb[i + 1]! << 8) | ppm.rgb[i + 2]!;
    if (seen.size < 4096) seen.add(c);
    if (c !== background) nonBackground++;
  }
  const pixels = ppm.width * ppm.height;
  return {
    distinctColors: seen.size,
    nonBackgroundPct: Math.round((nonBackground / pixels) * 1000) / 10,
  };
}
