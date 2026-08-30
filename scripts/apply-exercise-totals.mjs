#!/usr/bin/env node
// 実装課題節の導入文にある「所要時間: 合計N-M時間」を、config/exercises.json の
// 推定時間の合計から生成する。KEN-48 が第10/13/28/29章で検出し、KEN-59 の通読で
// 全30章中28章に及ぶことが分かった不整合を、正本からの導出に置き換えて解消する。
//
// なお節の `handbook:learning` の `minutes` は「難易度表示と課題数からの見積もり」
// (LEARNING_LEVELS.md) であり、演習カードの推定時間の合計とは基準が異なる。
// 両者を混同させないため、本文側は基準を明記した文へ置き換える。
// 使い方: node scripts/apply-exercise-totals.mjs [--root <dir>] [--check]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const checkOnly = process.argv.includes('--check');

const manuscriptFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];

const PATTERN = /所要時間: (?:合計[\d〜\-–—.]+時間|演習カードの推定時間の合計で\d+時間(?:\d+分)?)/;

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

export function totalsByChapter(exercisesConfig) {
  const totals = new Map();
  const add = (chapter, minutes) => totals.set(chapter, (totals.get(chapter) ?? 0) + minutes);
  for (const [key, entry] of Object.entries(exercisesConfig.chapters)) {
    for (const exercise of entry.exercises ?? []) add(Number(key), exercise.minutes);
  }
  for (const exercise of exercisesConfig.observationExercises ?? []) {
    add(exercise.chapter, exercise.minutes);
  }
  return totals;
}

function main() {
  const exercisesConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/exercises.json'), 'utf8'));
  const totals = totalsByChapter(exercisesConfig);
  const touched = [];
  let replaced = 0;

  for (const file of manuscriptFiles) {
    const absolute = path.join(root, file);
    const before = fs.readFileSync(absolute, 'utf8');
    const lines = before.split('\n');
    let chapter = null;
    for (let index = 0; index < lines.length; index += 1) {
      const chapterMatch = lines[index].match(/^##\s+第(\d+)章\s/);
      if (chapterMatch) chapter = Number(chapterMatch[1]);
      if (!PATTERN.test(lines[index])) continue;
      const minutes = totals.get(chapter);
      if (minutes === undefined) continue;
      const next = lines[index].replace(PATTERN, `所要時間: 演習カードの推定時間の合計で${formatMinutes(minutes)}`);
      if (next !== lines[index]) {
        lines[index] = next;
        replaced += 1;
      }
    }
    const after = lines.join('\n');
    if (after !== before) {
      touched.push(file);
      if (!checkOnly) fs.writeFileSync(absolute, after);
    }
  }

  console.log('Exercise totals');
  console.log(`- rewritten lead sentences: ${replaced}`);
  console.log(`- changed files: ${touched.length}`);
  for (const file of touched) console.log(`  ${file}`);
  if (checkOnly && touched.length > 0) {
    console.log('本文の所要時間が config/exercises.json の合計と一致しない。');
    console.log('`pnpm run apply:exercise-totals` を実行して再生成する。');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
