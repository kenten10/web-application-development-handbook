#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArg = process.argv.indexOf('--root');
const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : process.cwd());
const check = process.argv.includes('--check');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/exercises.json'), 'utf8'));

function relativeToChapter(chapter, value) {
  return path.relative(path.join('code', `ch${chapter}`), value).replaceAll(path.sep, '/');
}

const exerciseOrder = (a, b) => Number(a.id.split('.')[1]) - Number(b.id.split('.')[1]);

function chapterReadme(chapter, info, observations = []) {
  const lines = [
    `# 第${Number(chapter)}章 ${info.title} — コード教材`, '',
    '## 前提環境', '',
    '- Node.js 24.18.0 LTS',
    '- pnpm 11.15.1',
    '- TypeScript 6.0.3', '',
    '## 共通コマンド', '', '```bash',
    'pnpm install',
    `pnpm --filter @handbook/ch${chapter} run lint`,
    `pnpm --filter @handbook/ch${chapter} run typecheck`,
    `pnpm --filter @handbook/ch${chapter} run test`,
    `pnpm --filter @handbook/ch${chapter} run build`,
    '```', '',
    '> `solution` は要件一覧ではなく、実行・観察できる模範実装でなければなりません。`referenceArtifact` や `model answer scaffold` は検証エラーになります。', '',
    '## 課題一覧', '',
    '| 課題 | 開始地点 | 模範解答 | 難易度 | 推定時間 | 必要サービス |',
    '|---|---|---|---:|---:|---|',
  ];
  for (const exercise of [...info.exercises, ...observations].sort(exerciseOrder)) {
    const starter = (exercise.starter ?? []).map(value => `\`${relativeToChapter(chapter, value)}\``).join('<br>') || '— (観察課題)';
    const solution = (exercise.solution ?? []).map(value => `\`${relativeToChapter(chapter, value)}\``).join('<br>') || '— (観察記録)';
    lines.push(`| ${exercise.id} ${exercise.title} | ${starter} | ${solution} | ${'★'.repeat(exercise.difficulty)} | ${exercise.minutes}分 | ${exercise.services.join(', ')} |`);
  }
  lines.push('', '## 課題詳細', '');
  for (const exercise of [...info.exercises, ...observations].sort(exerciseOrder)) {
    lines.push(`### ${exercise.id} ${exercise.title}`, '',
      `**目的**: ${exercise.purpose}`, '',
      `**難易度**: ${'★'.repeat(exercise.difficulty)}`, '',
      `**推定時間**: ${exercise.minutes}分 (${exercise.estimateBasis})`, '',
      `**必要サービス**: ${exercise.services.join(', ')}`, '',
      '**前提**', '',
      ...exercise.prerequisites.map(value => `- ${value}`), '',
      '**完成条件 (自己採点用チェックリスト)**', '',
      ...exercise.completion.map(value => `- [ ] ${value}`), '',
      '**期待出力**', '',
      ...exercise.expected.map(value => `- ${value}`), '',
      '**観察項目**', '',
      ...exercise.observations.map(value => `- ${value}`), '',
      '**テスト方法 (自己採点手順)**', '',
      ...exercise.verification.map((value, index) => `${index + 1}. ${value}`), '',
      '**段階的ヒント** (模範解答を開く前に、1から順に必要な分だけ読む)', '',
      `1. 方針: ${exercise.hints[0]}`,
      `2. 構造: ${exercise.hints[1]}`,
      `3. 実装の要点: ${exercise.hints[2]}`, '',
      '**本番利用時の警告**', '',
      ...exercise.warnings.map(value => `- ${value}`), '',
      '**導線**', '',
      ...(exercise.starter
        ? [`- 開始地点: ${exercise.starter.map(value => `\`${relativeToChapter(chapter, value)}\``).join('、')}`,
          `- 模範解答: ${exercise.solution.map(value => `\`${relativeToChapter(chapter, value)}\``).join('、')}`]
        : ['- コード成果物はありません。本文の手順に従って観察し、記録を完成条件と照合します。',
          `- 本文: \`${exercise.source}\``]), '');
  }
  lines.push('## 評価方法', '',
    '1. starterから開始し、本文の要件と課題詳細の完成条件を満たす。',
    '2. 期待出力・観察項目を記録する。',
    '3. 完成条件のチェックリストで自己採点し、未達項目を残す。',
    '4. solutionとの差分を説明する。',
    `5. \`pnpm --filter @handbook/ch${chapter} run test\` を実行する。`, '',
    '## 安全上の注意', '',
    '- 脆弱性・ネットワーク・OS・コンテナの演習は、localhostまたは隔離環境だけで実行してください。',
    '- 教材用の簡略実装をそのまま本番へ投入しないでください。',
    '- 各課題の「本番利用時の警告」を読まずに、演習コードを製品コードへ流用しないでください。', '',
    '## 配布対象外', '',
    '`node_modules/`、`dist/`、`coverage/`、一時DB、秘密情報、計測生成物は配布対象外です。', '');
  return lines.join('\n');
}

function overview() {
  const exercises = Object.values(manifest.chapters).flatMap(info => info.exercises);
  const observations = manifest.observationExercises ?? [];
  const all = [...exercises, ...observations];
  const totalMinutes = all.reduce((sum, exercise) => sum + exercise.minutes, 0);
  const byDifficulty = [1, 2, 3].map(level => all.filter(exercise => exercise.difficulty === level).length);
  const lines = ['# コード演習ガイド', '', '<!-- handbook:generated; do not edit -->', '',
    '全30章のコード教材は、直接ファイル型と複数ファイル型の2形式へ統一されています。', '',
    '- 直接ファイル型: `name.ts` / `name.solution.ts`',
    '- 複数ファイル型: `exercise/starter/` / `exercise/solution/` / `exercise/README.md`', '',
    '## 演習カードの必須項目', '',
    '全課題は本文の見出し直下に「演習カード」を持ちます。カードは `config/exercises.json` から生成され、次の項目を必ず備えます。', '',
    '| 項目 | 内容 | 件数 |',
    '|---|---|---:|',
    '| 目的 | その課題で確認する原理 | 1 |',
    '| 難易度 | ★1〜★3。本文見出しの★数と一致 | 1 |',
    '| 推定時間 | 分単位。内訳を `estimateBasis` に記録 | 1 |',
    '| 前提 | 先に読む節、必要な知識・環境 | 2〜6 |',
    '| 完成条件 | 二値判定できる自己採点チェックリスト | 3〜8 |',
    '| 期待出力 | 実行時に得られる出力の形 | 2〜8 |',
    '| 観察項目 | 原理を確認するために見るもの | 2〜8 |',
    '| テスト方法 | 実行コマンドを含む自己採点手順 | 2〜8 |',
    '| 段階的ヒント | 方針→構造→実装の要点の3段階 | 3 |',
    '| 本番利用時の警告 | 省略した保証と、そのまま使った場合の被害 | 1〜4 |',
    '| 導線 | starterから対応するsolutionへの対応 | 1組 |', '',
    '`node scripts/validate-exercises.mjs` がこれらの欠落・定型文・導線不一致を検出します。', '',
    '## 模範解答の完成条件', '',
    '- `solution` はREADMEや要件メモだけでなく、読者が実行・観察できる実装を含める。',
    '- `referenceArtifact = true`、`model answer scaffold`、実装チェックリストだけのREADME/HTMLは未完成として扱う。',
    '- `node scripts/validate-exercises.mjs` は未完成solutionを `SOLUTION_PLACEHOLDER` として拒否する。',
    '- starterが `name.ts` なら solution は `name.solution.ts`、`starter/` なら `solution/` に1対1で対応する。',
    '- 外部サービスや手動操作が必要な場合も、実行手順、期待結果、確認記録を残す。', '',
    '## 全体集計', '',
    `- 章数: ${Object.keys(manifest.chapters).length}`,
    `- 演習・補助教材単位: ${exercises.length}`,
    `- コード成果物を持たない観察課題: ${observations.length}`,
    `- 演習カード総数: ${all.length}`,
    `- 難易度分布: ★ ${byDifficulty[0]}件 / ★★ ${byDifficulty[1]}件 / ★★★ ${byDifficulty[2]}件`,
    `- 推定時間合計: ${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`,
    `- 本文コード参照: ${exercises.reduce((sum, exercise) => sum + exercise.references.length, 0)}`, ''];
  for (const [chapter, info] of Object.entries(manifest.chapters)) {
    const chapterObservations = observations.filter(exercise => Number(exercise.chapter) === Number(chapter));
    const minutes = info.exercises.reduce((sum, exercise) => sum + exercise.minutes, 0)
      + chapterObservations.reduce((sum, exercise) => sum + exercise.minutes, 0);
    lines.push(`## 第${Number(chapter)}章 ${info.title}`, '',
      `- 課題数: ${info.exercises.length + chapterObservations.length}`,
      ...(chapterObservations.length ? [`- うち観察課題 (コード成果物なし): ${chapterObservations.length}`] : []),
      `- 推定時間: ${Math.floor(minutes / 60)}時間${minutes % 60}分`,
      `- [章README](code/ch${chapter}/README.md)`, '');
  }
  if (observations.length) {
    lines.push('## 観察課題一覧 (コード成果物なし)', '',
      '本文の手順に従って観察し、記録で自己採点します。演習カードは本文の見出し直下にあります。', '',
      '| 課題 | 章 | 難易度 | 推定時間 | 本文 |',
      '|---|---:|---:|---:|---|');
    for (const exercise of observations) {
      lines.push(`| ${exercise.title} | 第${Number(exercise.chapter)}章 | ${'★'.repeat(exercise.difficulty)} | ${exercise.minutes}分 | \`${exercise.source}\` |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

const outputs = new Map([['CODE_EXERCISES.md', overview()]]);
for (const [chapter, info] of Object.entries(manifest.chapters)) {
  const observations = (manifest.observationExercises ?? []).filter(exercise => Number(exercise.chapter) === Number(chapter));
  outputs.set(`code/ch${chapter}/README.md`, chapterReadme(chapter, info, observations));
}

const changed = [];
for (const [relative, content] of outputs) {
  const target = path.join(root, relative);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current !== content) {
    changed.push(relative);
    if (!check) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
  }
}
if (check && changed.length) {
  console.error(`Exercise catalog is stale: ${changed.join(', ')}`);
  process.exit(1);
}
console.log(`Exercise catalog ${check ? 'check' : 'generation'} passed: ${outputs.size} file(s)`);
