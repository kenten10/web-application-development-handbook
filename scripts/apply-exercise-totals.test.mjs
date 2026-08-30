import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMinutes, totalsByChapter } from './apply-exercise-totals.mjs';

test('formatMinutes は時間と分へ分ける', () => {
  assert.equal(formatMinutes(420), '7時間');
  assert.equal(formatMinutes(465), '7時間45分');
  assert.equal(formatMinutes(140), '2時間20分');
});

test('totalsByChapter は章キーが 0 埋めでも実装課題と観察課題を合算する', () => {
  const totals = totalsByChapter({
    chapters: {
      '01': { exercises: [{ id: '1.4', minutes: 90 }] },
      10: { exercises: [{ id: '10.1', minutes: 90 }, { id: '10.2', minutes: 150 }] },
    },
    observationExercises: [
      { id: '1.1', chapter: 1, minutes: 20 },
      { id: '1.2', chapter: 1, minutes: 15 },
      { id: '1.3', chapter: 1, minutes: 15 },
    ],
  });
  assert.equal(totals.get(1), 140);
  assert.equal(totals.get(10), 240);
});
