import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EXACT_CLIP_COLORS, exactClipColor, supportedClipColors } from './clip-color.js';

test('d02-s8: the exact clip colour domain is explicit and unique', () => {
  assert.equal(EXACT_CLIP_COLORS.length, 27);
  assert.equal(new Set(EXACT_CLIP_COLORS.map((item) => JSON.stringify(item.color))).size,
    EXACT_CLIP_COLORS.length);
  assert.equal(new Set(EXACT_CLIP_COLORS.map((item) => item.name)).size,
    EXACT_CLIP_COLORS.length);
  for (const item of EXACT_CLIP_COLORS) {
    assert.deepEqual(exactClipColor({ ...item.color }), item);
    assert.ok(item.wireBytes.every((value) => Number.isInteger(value)
      && value >= 0 && value <= 255));
  }
  assert.deepEqual(supportedClipColors(), EXACT_CLIP_COLORS.map((item) => ({
    name: item.name, ...item.color,
  })));
});

test('d02-s8: the measured lossy source colour is outside the domain', () => {
  assert.equal(exactClipColor({ red: 145, green: 105, blue: 78 }), undefined);
});
