#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : path.resolve(import.meta.dirname, '..'));
const chapterArg = process.argv.indexOf('--chapter');
const chapterFilter = chapterArg >= 0 ? process.argv[chapterArg + 1] : null;
const allowPlaceholders = process.argv.includes('--allow-placeholders');
const distAudit = process.argv.includes('--dist-audit');
const errors = [];
const warnings = [];
const requiredReadmeHeadings = ['## 前提環境', '## 共通コマンド', '## 課題一覧', '## 課題詳細', '## 評価方法', '## 安全上の注意', '## 配布対象外'];
const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];

// KEN-48: 章末演習を自己採点可能にするための必須メタデータ。
// キーは項目名、値は [表示名, 最小件数, 最大件数]。
const rubricListFields = {
  prerequisites: ['前提', 2, 6],
  completion: ['完成条件', 3, 8],
  expected: ['期待出力', 2, 8],
  observations: ['観察項目', 2, 8],
  verification: ['テスト方法', 2, 8],
  hints: ['段階的ヒント', 3, 3],
  warnings: ['本番利用時の警告', 1, 4],
};
// 内容のない定型文を検出する。KEN-48以前の自動生成値をそのまま残せないようにする。
const boilerplate = [
  '本文に記載された観察結果または振る舞いを確認できる。',
  '本文の中核概念を小さな関数または小さな実験へ分解する。',
  '最初に正常系を通し、その後に境界値と失敗系を追加する。',
  '模範解答を見る前に、観察した差分を言語化する。',
];
const commandPattern = /`[^`]*\b(?:node|npx|tsx|pnpm|npm|bash|sh|curl|openssl|dig|docker|docker-compose|kubectl|psql|redis-cli|terraform|ab|autocannon|wrk|k6|git|python3?|make|lighthouse|nc|ss|strace|tcpdump|jq)\b[^`]*`/;

function fail(code, message) { errors.push(`${code}: ${message}`); }

function isPlaceholderSolution(relative, content) {
  const normalized = content.replace(/\r\n/g, '\n');
  if (/referenceArtifact\s*=\s*true/.test(normalized)) return 'referenceArtifact marker';
  if (/model answer scaffold/i.test(normalized)) return 'model answer scaffold';
  if (/<pre>\s*Model answer for/i.test(normalized)) return 'HTML model-answer placeholder';
  if (/^# 模範解答/m.test(normalized) && /Implementation checklist:/i.test(normalized)) {
    const executableFence = /```(?:typescript|ts|javascript|js|bash|sh|sql|html|yaml|yml|json)\s*\n[\s\S]{40,}?```/i.test(normalized);
    const runnableCommand = /(?:node|tsx|pnpm|npm|bash|curl|openssl|docker|kubectl|psql|redis-cli)\s+[^`\n]+/i.test(normalized);
    if (!executableFence && !runnableCommand) return 'README contains only an implementation checklist';
  }
  return null;
}
function readJson(relative) {
  try { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
  catch (error) { fail('MANIFEST_INVALID', `${relative}: ${error.message}`); return null; }
}

/** starter 1件に対して規約上ペアとなる solution パスを返す。 */
function expectedSolutionFor(starter) {
  if (starter.includes('/starter/')) return null;
  const base = starter.slice(starter.lastIndexOf('/') + 1);
  const dir = starter.slice(0, starter.length - base.length);
  if (/^starter\./.test(base)) return `${dir}${base.replace(/^starter\./, 'solution.')}`;
  const match = base.match(/^(.*)\.([A-Za-z0-9]+)$/);
  return match ? `${dir}${match[1]}.solution.${match[2]}` : null;
}

/** 演習カードの記述項目を検証する。章別演習と観察課題で共通。 */
function validateRubric(exercise, label) {
  const stars = (exercise.title?.match(/★/g) ?? []).length;
  if (!Number.isInteger(exercise.difficulty) || exercise.difficulty < 1 || exercise.difficulty > 3) {
    fail('DIFFICULTY_INVALID', `${label}: difficulty は1〜3の整数にしてください。`);
  } else if (stars !== exercise.difficulty) {
    fail('DIFFICULTY_STAR_MISMATCH', `${label}: 見出しの★数 ${stars} と difficulty ${exercise.difficulty} が一致しません。`);
  }
  if (!Number.isInteger(exercise.minutes) || exercise.minutes < 15 || exercise.minutes > 600 || exercise.minutes % 5 !== 0) {
    fail('MINUTES_INVALID', `${label}: minutes は15〜600の5分刻みにしてください。現在: ${exercise.minutes}`);
  }
  if (!Array.isArray(exercise.services) || exercise.services.length === 0) {
    fail('SERVICES_MISSING', `${label}: services が空です。`);
  }
  if (typeof exercise.purpose !== 'string' || exercise.purpose.trim().length < 10) {
    fail('PURPOSE_TOO_SHORT', `${label}: purpose が短すぎます。`);
  }
  if (typeof exercise.estimateBasis !== 'string' || exercise.estimateBasis.trim().length < 10) {
    fail('ESTIMATE_BASIS_MISSING', `${label}: estimateBasis (推定時間の内訳) がありません。`);
  } else if (/[\n|]/.test(exercise.estimateBasis) || exercise.estimateBasis.includes('](')) {
    fail('RUBRIC_ITEM_FORMAT', `${label}: estimateBasis に改行・パイプ・リンク記法を含みます。`);
  }
  for (const [field, [name, min, max]] of Object.entries(rubricListFields)) {
    const values = exercise[field];
    if (!Array.isArray(values)) { fail('RUBRIC_FIELD_MISSING', `${label}: ${field} (${name}) がありません。`); continue; }
    if (values.length < min || values.length > max) {
      fail('RUBRIC_FIELD_COUNT', `${label}: ${field} (${name}) は${min}〜${max}件にしてください。現在: ${values.length}`);
    }
    for (const value of values) {
      if (typeof value !== 'string' || value.trim().length < 8) {
        fail('RUBRIC_ITEM_EMPTY', `${label}: ${field} に空または短すぎる項目があります。`);
        continue;
      }
      // 本文へ埋め込むため、表・箇条書き・Markdownリンクとして解釈される表記を禁止する。
      if (/[\n|]/.test(value) || /^\s*(?:[-*+]\s|#{1,6}\s|\d+\.\s|[(（])/.test(value) || value.includes('](')) {
        fail('RUBRIC_ITEM_FORMAT', `${label}: ${field} に改行・箇条書き記号・パイプ・行頭括弧・リンク記法を含む項目があります: ${value.slice(0, 30)}`);
      }
      if (boilerplate.includes(value.trim())) {
        fail('RUBRIC_ITEM_BOILERPLATE', `${label}: ${field} が汎用テンプレート文のままです: ${value.slice(0, 30)}`);
      }
    }
    if (new Set(values.map((value) => String(value).trim())).size !== values.length) {
      fail('RUBRIC_ITEM_DUPLICATE', `${label}: ${field} に重複した項目があります。`);
    }
  }
  if (Array.isArray(exercise.verification) && !exercise.verification.some((value) => commandPattern.test(String(value)))) {
    fail('VERIFICATION_COMMAND_MISSING', `${label}: verification に実行コマンド (バッククォート囲み) が1件もありません。`);
  }
  // ヒント3 (実装の要点) が方針ヒントより極端に短い場合、段階的な詳細化が崩れている。
  if (Array.isArray(exercise.hints) && exercise.hints.length === 3) {
    const lengths = exercise.hints.map((value) => String(value).length);
    if (lengths[2] < 40 || lengths[2] < lengths[0] * 0.6) {
      warnings.push(`${label}: ヒント3が方針ヒントより短く、段階的な詳細化になっていません。`);
    }
  }
}

const manifest = readJson('config/exercises.json');
if (!manifest) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
if (manifest.schemaVersion !== 2) fail('SCHEMA_VERSION', `config/exercises.json の schemaVersion は2にしてください。現在: ${manifest.schemaVersion}`);
const chapters = Object.entries(manifest.chapters ?? {}).filter(([chapter]) => !chapterFilter || `ch${chapter}` === chapterFilter);
if (chapterFilter && chapters.length !== 1) fail('CHAPTER_UNKNOWN', `${chapterFilter} はマニフェストにありません。`);
if (!chapterFilter && Object.keys(manifest.chapters ?? {}).length !== 30) fail('CHAPTER_COUNT', '30章すべての定義が必要です。');

const usedPaths = new Map();
const manifestIds = new Map();
let exerciseCount = 0;
let referenceCount = 0;
let starterCount = 0;
let solutionCount = 0;
for (const [chapter, info] of chapters) {
  const chapterDir = path.join(root, 'code', `ch${chapter}`);
  for (const required of ['README.md', 'package.json', 'tsconfig.json']) {
    if (!fs.existsSync(path.join(chapterDir, required))) fail('CHAPTER_FILE_MISSING', `code/ch${chapter}/${required}`);
  }
  const readmePath = path.join(chapterDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    for (const heading of requiredReadmeHeadings) if (!readme.includes(heading)) fail('README_FORMAT', `code/ch${chapter}/README.md に ${heading} がありません。`);
  }
  for (const exercise of info.exercises ?? []) {
    exerciseCount += 1;
    const label = `${exercise.id} ${exercise.title}`;
    for (const field of ['id', 'title', 'purpose', 'minutes', 'difficulty', 'starter', 'solution', 'references']) {
      if (!(field in exercise)) fail('EXERCISE_FIELD_MISSING', `第${Number(chapter)}章の演習に ${field} がありません。`);
    }
    if (manifestIds.has(exercise.id)) fail('EXERCISE_ID_DUPLICATE', `${exercise.id} が重複しています。`);
    manifestIds.set(exercise.id, exercise);
    validateRubric(exercise, label);
    if (!Array.isArray(exercise.starter) || exercise.starter.length === 0) fail('STARTER_MISSING', `${exercise.id} ${exercise.title}`);
    if (!Array.isArray(exercise.solution) || exercise.solution.length === 0) fail('SOLUTION_MISSING', `${exercise.id} ${exercise.title}`);
    for (const [kind, values] of [['starter', exercise.starter ?? []], ['solution', exercise.solution ?? []], ['reference', exercise.references ?? []]]) {
      for (const relative of values) {
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) fail(`${kind.toUpperCase()}_TARGET_MISSING`, `${exercise.id}: ${relative}`);
        if (kind === 'solution' && !allowPlaceholders && fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
          const reason = isPlaceholderSolution(relative, fs.readFileSync(absolute, 'utf8'));
          if (reason) fail('SOLUTION_PLACEHOLDER', `${exercise.id}: ${relative} (${reason})`);
        }
        if (kind !== 'reference') {
          const prior = usedPaths.get(relative);
          if (prior && prior !== exercise.id) fail('EXERCISE_PATH_DUPLICATE', `${relative}: ${prior}, ${exercise.id}`);
          usedPaths.set(relative, exercise.id);
        }
      }
    }
    // starter から solution への導線が命名規約どおり1対1で対応しているか。
    for (const starter of exercise.starter ?? []) {
      if (starter.includes('/starter/')) {
        if (!(exercise.solution ?? []).some((value) => value.includes('/solution/'))) {
          fail('STARTER_SOLUTION_UNPAIRED', `${exercise.id}: ${starter} に対応する solution/ ディレクトリがありません。`);
        }
        continue;
      }
      const expected = expectedSolutionFor(starter);
      if (!expected) {
        fail('STARTER_SOLUTION_UNPAIRED', `${exercise.id}: ${starter} は命名規約から solution を導出できません。`);
      } else if (!(exercise.solution ?? []).includes(expected)) {
        fail('STARTER_SOLUTION_UNPAIRED', `${exercise.id}: ${starter} に対応する ${expected} が solution にありません。`);
      }
    }
    starterCount += exercise.starter?.length ?? 0;
    solutionCount += exercise.solution?.length ?? 0;
    referenceCount += exercise.references?.length ?? 0;
  }
  for (const forbidden of distAudit ? ['node_modules', 'dist', 'coverage'] : ['dist', 'coverage']) {
    if (fs.existsSync(path.join(chapterDir, forbidden))) fail('FORBIDDEN_ARTIFACT', `code/ch${chapter}/${forbidden}`);
  }
}

// コード成果物を持たない観察課題も、同じ評価メタデータを備える。
const observationExercises = manifest.observationExercises ?? [];
if (!chapterFilter && !Array.isArray(manifest.observationExercises)) {
  fail('OBSERVATION_LIST_MISSING', 'config/exercises.json に observationExercises がありません。');
}
for (const exercise of observationExercises) {
  const label = `${exercise.id} ${exercise.title}`;
  if (manifestIds.has(exercise.id)) fail('EXERCISE_ID_DUPLICATE', `${exercise.id} が章別演習と観察課題で重複しています。`);
  manifestIds.set(exercise.id, exercise);
  for (const field of ['id', 'chapter', 'title', 'source', 'purpose', 'minutes', 'difficulty', 'services']) {
    if (!(field in exercise)) fail('OBSERVATION_FIELD_MISSING', `${label}: ${field} がありません。`);
  }
  if (!bodyFiles.includes(exercise.source)) fail('OBSERVATION_SOURCE_INVALID', `${label}: source が本文ファイルではありません。`);
  validateRubric(exercise, label);
}

// 本文の課題見出しと演習カードの対応を検証する。
const headingIds = new Map();
const cardIds = new Map();
if (!chapterFilter) {
  for (const file of bodyFiles) {
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute)) { fail('BODY_FILE_MISSING', file); continue; }
    const text = fs.readFileSync(absolute, 'utf8');
    for (const match of text.matchAll(/^#### (課題([0-9]+\.[0-9]+)[:：].*?)\s*$/gm)) {
      const id = match[2];
      if (headingIds.has(id)) fail('HEADING_DUPLICATE', `課題${id} の見出しが本文に複数あります。`);
      headingIds.set(id, { title: match[1].trim(), file });
    }
    for (const match of text.matchAll(/^<!-- handbook:exercise:start \{"id":"([0-9]+\.[0-9]+)"\} -->$/gm)) {
      cardIds.set(match[1], (cardIds.get(match[1]) ?? 0) + 1);
    }
    const starts = [...text.matchAll(/<!-- handbook:exercise:start /g)].length;
    const ends = [...text.matchAll(/<!-- handbook:exercise:end -->/g)].length;
    if (starts !== ends) fail('CARD_MARKER_UNBALANCED', `${file}: 演習カードの開始 ${starts} 件と終了 ${ends} 件が一致しません。`);
  }
  for (const [id, heading] of headingIds) {
    const exercise = manifestIds.get(id);
    if (!exercise) {
      fail('HEADING_UNREGISTERED', `${heading.file}: 課題${id} がマニフェストに登録されていません。`);
      continue;
    }
    if (exercise.title !== heading.title) {
      fail('TITLE_MISMATCH', `課題${id}: 本文「${heading.title}」/ マニフェスト「${exercise.title}」`);
    }
    if ((cardIds.get(id) ?? 0) !== 1) {
      fail('CARD_MISSING', `課題${id} の演習カードが本文で1件ではありません: ${cardIds.get(id) ?? 0}`);
    }
  }
  for (const id of manifestIds.keys()) {
    if (!headingIds.has(id)) fail('HEADING_MISSING', `課題${id} の見出しが本文にありません。`);
  }
  for (const id of cardIds.keys()) {
    if (!headingIds.has(id)) fail('CARD_ORPHAN', `課題${id} の演習カードに対応する見出しがありません。`);
  }
}

console.log(`Exercise chapters: ${chapters.length}`);
console.log(`Exercise units: ${exerciseCount}`);
console.log(`Observation units: ${observationExercises.length}`);
console.log(`Starter artifacts: ${starterCount}`);
console.log(`Solution artifacts: ${solutionCount}`);
console.log(`Manuscript references: ${referenceCount}`);
if (!chapterFilter) console.log(`Exercise cards: ${[...cardIds.values()].reduce((sum, value) => sum + value, 0)} / headings: ${headingIds.size}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length) {
  console.error(`Exercise validation failed: ${errors.length} error(s)`);
  process.exit(1);
}
console.log('Exercise validation passed');
