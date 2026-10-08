import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClipMetadataFields, changedClipMetadataFields, clipColorWireBytes, clipColorWithinTolerance,
  clipMetadataDifferences, ownedClipMetadata, type ClipMetadataState,
} from './index.js';

const PRIOR: ClipMetadataState = {
  name: 'IcyShellStab01', color: { red: 145, green: 105, blue: 77 },
  lengthBeats: 16, playStartBeats: 0, loopEnabled: true, loopStartBeats: 0, loopEndBeats: 16,
};

test('8i0 (D42): name-only and colour-only changes own no marker field', () => {
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, name: 'verse' }), ['name']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, color: { red: 0, green: 0, blue: 0 } }), ['color']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, loopEnabled: false }), ['loopEnabled']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, PRIOR), []);
});

test('8i0 (D42): a length change owns loop end and play start; a loop-start change also owns loop start (E43)', () => {
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, lengthBeats: 32, loopEndBeats: 32 }),
    ['lengthBeats', 'loopEndBeats', 'playStartBeats']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, loopStartBeats: 4, loopEndBeats: 20 }),
    ['lengthBeats', 'loopStartBeats', 'loopEndBeats', 'playStartBeats']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, playStartBeats: 2 }), ['playStartBeats']);
  assert.deepEqual(changedClipMetadataFields(PRIOR, { ...PRIOR, name: 'x', lengthBeats: 8, loopEndBeats: 8 }),
    ['lengthBeats', 'loopEndBeats', 'playStartBeats', 'name']);
  for (const fields of [['lengthBeats', 'loopEndBeats', 'playStartBeats'], ['name'], ['color'],
    ['lengthBeats', 'loopStartBeats', 'loopEndBeats', 'playStartBeats']]) {
    assert.equal(assertClipMetadataFields(fields), undefined, fields.join());
  }
  for (const fields of [[], ['name', 'name'], ['pitch'], ['lengthBeats'], ['loopStartBeats'],
    ['lengthBeats', 'loopEndBeats']]) {
    assert.notEqual(assertClipMetadataFields(fields), undefined, fields.join());
  }
});

test('8i0 (D42): colour encoding uses the table, else the requested bytes; tolerance is one byte', () => {
  assert.deepEqual(clipColorWireBytes({ red: 217, green: 46, blue: 36 }), [217, 46, 37]);
  assert.deepEqual(clipColorWireBytes({ red: 145, green: 105, blue: 78 }), [145, 105, 78]);
  assert.equal(clipColorWithinTolerance({ red: 145, green: 105, blue: 78 }, { red: 145, green: 105, blue: 77 }), true);
  assert.equal(clipColorWithinTolerance({ red: 255, green: 0, blue: 0 }, { red: 254, green: 1, blue: 0 }), true);
  assert.equal(clipColorWithinTolerance({ red: 145, green: 105, blue: 78 }, { red: 145, green: 105, blue: 76 }), false);
});

test('8i0 (D42): a written colour passes within one byte; an unwritten colour and other fields compare exactly', () => {
  const seen = { ...PRIOR, color: { red: 145, green: 105, blue: 76 } };
  const requested = { ...PRIOR, color: { red: 145, green: 105, blue: 77 } };
  assert.deepEqual(clipMetadataDifferences(requested, seen, { fields: ['color'], colorWritten: true }), []);
  assert.deepEqual(clipMetadataDifferences(requested, seen, { colorWritten: false }),
    [{ field: 'color.blue', requested: 77, observed: 76 }]);
  assert.deepEqual(clipMetadataDifferences(requested, { ...seen, color: { red: 145, green: 105, blue: 75 } },
    { fields: ['color'], colorWritten: true }), [{ field: 'color.blue', requested: 77, observed: 75 }]);
  assert.deepEqual(clipMetadataDifferences(requested, { ...requested, name: 'person' }, { fields: ['lengthBeats',
    'loopEndBeats', 'playStartBeats'] }), [], 'an unowned field is not compared');
  assert.deepEqual(ownedClipMetadata({ ...PRIOR, name: 'person' }, { ...PRIOR, lengthBeats: 8, loopEndBeats: 8 },
    ['lengthBeats', 'loopEndBeats']), { ...PRIOR, name: 'person', lengthBeats: 8, loopEndBeats: 8 });
});
