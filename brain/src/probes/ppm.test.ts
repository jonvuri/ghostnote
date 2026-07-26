/**
 * The PPM→PNG converter, tested offline.
 *
 * It is probe scaffolding rather than product code, so the bar is not "is it a
 * good image library" — it is "can a render artifact from E14 rows H/I be
 * trusted as evidence". That makes exactly two things worth asserting: that a
 * correctly-parsed image round-trips its pixels intact, and that a MALFORMED one
 * is refused loudly. A converter that silently half-decodes would turn a bug
 * here into a finding about Bitwig, which is the failure this suite exists to
 * prevent (D15 corollary — the tests assert the misbehaviour, not just the fix).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { parsePpm, ppmToPng, summarise } from './ppm.js';

/** A 2x2 P6 with a comment line, which real writers emit and naive parsers eat. */
const p6 = Buffer.concat([
  Buffer.from('P6\n# written by something\n2 2\n255\n', 'ascii'),
  Buffer.from([
    0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
    0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
  ]),
]);

test('P-parse: a P6 with a comment yields the right dimensions and pixels', () => {
  const ppm = parsePpm(p6);
  assert.equal(ppm.magic, 'P6');
  assert.equal(ppm.width, 2);
  assert.equal(ppm.height, 2);
  assert.deepEqual([...ppm.rgb.subarray(0, 3)], [0xff, 0, 0]);
  assert.deepEqual([...ppm.rgb.subarray(9, 12)], [0xff, 0xff, 0xff]);
});

test('P-parse: P3 (ASCII samples) decodes to the same pixels as P6', () => {
  // Which variant Bitwig writes is unknown — `saveToDiskAsPPM`'s entire javadoc
  // is "Saves the image as a PPM file" — so both are handled and both are
  // checked rather than assuming the binary one.
  const p3 = Buffer.from('P3 2 2 255\n255 0 0  0 255 0\n0 0 255  255 255 255\n', 'ascii');
  assert.deepEqual([...parsePpm(p3).rgb], [...parsePpm(p6).rgb]);
});

test('P-refuse: 16-bit and truncated data are errors, never partial images', () => {
  assert.throws(() => parsePpm(Buffer.from('P6 2 2 65535\n', 'ascii')), /not 8-bit/);
  assert.throws(
    () => parsePpm(Buffer.concat([Buffer.from('P6 2 2 255\n', 'ascii'), Buffer.from([1, 2, 3])])),
    /truncated/);
  assert.throws(() => parsePpm(Buffer.from('P5 2 2 255\n', 'ascii')), /not a PPM/);
});

test('P-png: the PNG is well-formed and its pixel data survives the round trip', () => {
  const png = ppmToPng(parsePpm(p6));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2);
  assert.equal(png.readUInt32BE(20), 2);
  // IEND is a 12-byte chunk: 4 length + 4 type + 0 payload + 4 CRC.
  assert.equal(png.subarray(-12).toString('ascii', 4, 8), 'IEND');

  // The part that actually matters: inflate the IDAT and check the scanlines
  // still carry the source pixels behind their filter bytes. A converter that
  // produced a valid-but-blank PNG would pass every check above.
  const idatStart = png.indexOf(Buffer.from('IDAT', 'ascii'));
  const idatLength = png.readUInt32BE(idatStart - 4);
  const raw = inflateSync(png.subarray(idatStart + 4, idatStart + 4 + idatLength));
  assert.equal(raw.length, (2 * 3 + 1) * 2);
  assert.equal(raw[0], 0, 'filter byte for scanline 0');
  assert.deepEqual([...raw.subarray(1, 7)], [0xff, 0, 0, 0, 0xff, 0]);
  assert.equal(raw[7], 0, 'filter byte for scanline 1');
  assert.deepEqual([...raw.subarray(8, 14)], [0, 0, 0xff, 0xff, 0xff, 0xff]);
});

test('P-summary: a uniform image reports one colour and 0% content', () => {
  // The check that catches "rendered: true, drew nothing" — the row H/I failure
  // mode that is invisible from the extension side.
  const blank = Buffer.concat([
    Buffer.from('P6 2 2 255\n', 'ascii'),
    Buffer.from(new Array(12).fill(0x11)),
  ]);
  assert.deepEqual(summarise(parsePpm(blank)), { distinctColors: 1, nonBackgroundPct: 0 });
  const summary = summarise(parsePpm(p6));
  assert.equal(summary.distinctColors, 4);
  assert.equal(summary.nonBackgroundPct, 75);
});
