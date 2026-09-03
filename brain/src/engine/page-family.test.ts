import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchPageFamily } from './page-family.js';

test('5t pages: one page keeps its exact bare name', () => {
  assert.deepEqual(matchPageFamily(['Main', 'Classic LFO'], 'Classic LFO', 1), {
    matches: true,
    actualCount: 1,
  });
  assert.equal(matchPageFamily(['Classic LFO 1'], 'Classic LFO', 1).matches, false);
});

test('5t pages: five duplicates form one complete ordinal family', () => {
  const pages = Array.from({ length: 5 }, (_, index) => `Classic LFO ${index + 1}`);
  assert.deepEqual(matchPageFamily(pages, 'Classic LFO', 5), {
    matches: true,
    actualCount: 5,
  });
});

test('5t pages: a missing, extra, or malformed ordinal fails closed', () => {
  assert.equal(matchPageFamily(
    ['Classic LFO 1', 'Classic LFO 2', 'Classic LFO 4', 'Classic LFO 5'],
    'Classic LFO', 5,
  ).matches, false);
  assert.equal(matchPageFamily(
    Array.from({ length: 6 }, (_, index) => `Classic LFO ${index + 1}`),
    'Classic LFO', 5,
  ).matches, false);
  assert.equal(matchPageFamily(
    ['Classic LFO 1', 'Classic LFO 02'], 'Classic LFO', 2,
  ).matches, false);
  assert.equal(matchPageFamily(
    ['Classic LFO 1', 'Classic LFO two'], 'Classic LFO', 2,
  ).matches, false);
});

test('5t pages: zero expected pages rejects bare and numbered family members', () => {
  assert.equal(matchPageFamily(['Main'], 'Classic LFO', 0).matches, true);
  assert.equal(matchPageFamily(['Classic LFO'], 'Classic LFO', 0).matches, false);
  assert.equal(matchPageFamily(['Classic LFO 1'], 'Classic LFO', 0).matches, false);
});

test('5t pages: digits in a public name are not stripped', () => {
  assert.equal(matchPageFamily(['Steps 4'], 'Steps 4', 1).matches, true);
  assert.equal(matchPageFamily(['Steps 4 1', 'Steps 4 2'], 'Steps 4', 2).matches, true);
  assert.equal(matchPageFamily(['Steps 1', 'Steps 2'], 'Steps 4', 2).matches, false);
});
