#!/usr/bin/env node
// 本文の章末「コード集の使い方」ブロックを config/exercises.json から生成する。
// KEN-48 が検出した「実在しないパス・コマンド」の再発を構造的に防ぐのが目的で、
// 実行コマンドは CODE_TOOLCHAIN.md が定める pnpm ワークスペースの呼び出し形に統一する。
// 見出しは章ごとに一意にして、自動アンカーの重複 (ANCHOR_DUPLICATE) を避ける。
// 使い方: node scripts/apply-code-usage.mjs [--root <dir>] [--check]
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

const START = chapter => `<!-- handbook:code-usage:start {"chapter":${chapter}} -->`;
const END = '<!-- handbook:code-usage:end -->';
const HEADING = /^###\s+(?:第\d+章の)?コード集の使い方\s*$/;
// ブロック内でのみ現れるべき生成文。外に残っていたら残骸として掃除する。
const GENERATED_PROSE = [
  '<!-- handbook:generated; do not edit -->',
  'コード集は pnpm ワークスペースとして構成してある',
  '開始地点は模範解答と同じ場所に置いてある',
  '`open` は macOS のコマンドである。',
];

// 模範解答のうち、どのファイルを章の入口として示すかを決める優先順位。
const RUNNABLE = new Set(['ts', 'sh', 'mjs', 'html']);
export function priority(file) {
  const base = path.basename(file);
  const extension = base.split('.').pop();
  if (!RUNNABLE.has(extension)) return 99;
  // ブラウザ課題は HTML が入口。同じ課題に .ts があっても HTML を先に案内する。
  if (extension === 'html' && /^(index|main)\./.test(base)) return 0;
  if (/^main\./.test(base)) return 1;
  if (base.endsWith('.solution.ts')) return 2;
  if (extension === 'ts') return 3;
  if (extension === 'sh') return 4;
  if (extension === 'mjs') return 5;
  return 6; // html
}

// 1つの模範解答ファイルを実行するコマンドへ変換する。
export function commandFor(chapter, file) {
  const pad = String(chapter).padStart(2, '0');
  const prefix = `code/ch${pad}/`;
  const relative = file.startsWith(prefix) ? file.slice(prefix.length) : file;
  const extension = path.basename(file).split('.').pop();
  if (extension === 'ts') return `pnpm --filter @handbook/ch${pad} exec tsx ${relative}`;
  if (extension === 'mjs') return `node ${file}`;
  if (extension === 'sh') return `bash ${file}`;
  if (extension === 'html') return `open ${file}`;
  return null;
}

export function buildBlock(chapter, exercises) {
  const pad = String(chapter).padStart(2, '0');
  const lines = [];
  lines.push(START(chapter));
  lines.push(`### 第${chapter}章のコード集の使い方`);
  lines.push('');
  lines.push('<!-- handbook:generated; do not edit -->');
  lines.push('');
  lines.push(
    `コード集は pnpm ワークスペースとして構成してある (CODE_TOOLCHAIN.md)。依存はリポジトリ最上位で一度だけ解決し、` +
    `章ごとの操作は \`--filter\` でワークスペースを指定する。`,
  );
  lines.push('');
  lines.push('```bash');
  lines.push('# 初回のみ。リポジトリ最上位で実行する');
  lines.push('pnpm install');
  lines.push('');
  lines.push(`# 第${chapter}章の模範解答をまとめて検証する`);
  lines.push(`pnpm --filter @handbook/ch${pad} run test`);
  const commands = [];
  const manual = [];
  for (const exercise of exercises) {
    const candidates = [...(exercise.solution ?? [])].sort((a, b) => priority(a) - priority(b));
    const primary = candidates[0];
    if (!primary || priority(primary) === 99) {
      manual.push(exercise);
      continue;
    }
    const command = commandFor(chapter, primary);
    if (command) commands.push({ id: exercise.id, command });
  }
  if (commands.length > 0) {
    lines.push('');
    lines.push('# 模範解答を個別に実行する');
    const width = Math.max(...commands.map(item => item.command.length));
    for (const item of commands) {
      lines.push(`${item.command.padEnd(width)}  # 課題${item.id}`);
    }
  }
  lines.push('```');
  lines.push('');
  lines.push(
    `開始地点は模範解答と同じ場所に置いてある (\`<name>.ts\` と \`<name>.solution.ts\`、` +
    `またはディレクトリ課題の \`starter/\` と \`solution/\`)。課題ごとの完成条件と採点手順は本節の演習カードと ` +
    `\`code/ch${pad}/README.md\` にある。模範解答の多くは関数を export するだけで、` +
    `実行して意味のある出力が出るかどうかは課題によって異なる。まず \`run test\` で通し、` +
    `個別実行は演習カードのテスト方法に従う。`,
  );
  if (commands.some(item => item.command.startsWith('open '))) {
    lines.push('');
    lines.push('`open` は macOS のコマンドである。Linux では `xdg-open`、Windows では `start` を使う。');
  }
  if (manual.length > 0) {
    const ids = manual.map(exercise => `課題${exercise.id}`).join('、');
    lines.push('');
    lines.push(`${ids} はコマンドで完結しない観察・記録課題であり、手順は演習カードに従う。`);
  }
  lines.push(END);
  return lines.join('\n');
}

function chapterOf(exercisesConfig, chapter) {
  const entry = exercisesConfig.chapters[String(chapter)]
    ?? exercisesConfig.chapters[String(chapter).padStart(2, '0')];
  const extra = (exercisesConfig.observationExercises ?? []).filter(item => item.chapter === chapter);
  return [...(entry?.exercises ?? []), ...extra].sort((a, b) => {
    const left = a.id.split('.').map(Number);
    const right = b.id.split('.').map(Number);
    return left[0] - right[0] || left[1] - right[1];
  });
}

// 既存ブロックの範囲を求める。マーカー付きならマーカー間、無ければ見出しから bash フェンス終端まで。
export function findBlock(lines, index) {
  if (lines[index] === undefined) return null;
  let start = index;
  let end = index;
  // 見出しの直前がマーカーならそこから。
  if (start > 0 && /^<!-- handbook:code-usage:start /.test(lines[start - 1])) start -= 1;
  // 終端マーカーがあれば必ずそこまでを1ブロックとして扱う。
  // フェンスの閉じで打ち切ると、フェンスの後ろに置いた説明とマーカーが取り残されて
  // 再生成のたびに内容が揺れる (冪等でなくなる)。
  // bash フェンスの中にはコメント行 (`# 初回のみ...`) があるため、フェンスの内側では
  // 見出し判定をしない。ここを見落とすとブロック終端を取り違えて再生成が揺れる。
  let scanningFence = false;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const row = lines[cursor];
    if (row === END) return { start, end: cursor };
    if (/^```/.test(row)) {
      scanningFence = !scanningFence;
      continue;
    }
    if (scanningFence) continue;
    if (/^#{1,6}\s/.test(row)) break;
    if (/^---\s*$/.test(row)) break;
  }
  // マーカーが無い旧形式は、見出しの直後のフェンスが閉じるところまでを置き換える。
  let sawFence = false;
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (/^```/.test(lines[cursor])) {
      if (!sawFence) {
        sawFence = true;
      } else {
        end = cursor;
        return { start, end };
      }
    }
    if (!sawFence && /^#{1,6}\s/.test(lines[cursor])) break;
  }
  return sawFence ? null : { start, end };
}

function main() {
  const exercisesConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/exercises.json'), 'utf8'));
  const drift = [];
  const touched = [];
  let blocks = 0;

  for (const file of manuscriptFiles) {
    const absolute = path.join(root, file);
    const before = fs.readFileSync(absolute, 'utf8');
    const lines = before.split('\n');
    const output = [];
    let chapter = null;
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const chapterMatch = line.match(/^##\s+第(\d+)章\s/);
      if (chapterMatch) chapter = Number(chapterMatch[1]);
      if (line.startsWith('<!-- handbook:code-usage:start ')) continue; // 見出し側で拾う
      if (!HEADING.test(line)) {
        // 生成文の断片がブロックの外へ取り残されていたら落とす。
        // 過去の実行で残った残骸を毎回掃除することで、再生成を冪等に保つ。
        if (line === END || GENERATED_PROSE.some(prefix => line.startsWith(prefix))) continue;
        output.push(line);
        continue;
      }
      const block = findBlock(lines, index);
      if (!block || chapter === null) {
        output.push(line);
        continue;
      }
      // 直前へ積んだマーカー行を取り除く。
      while (output.length > 0 && output[output.length - 1].startsWith('<!-- handbook:code-usage:start ')) {
        output.pop();
      }
      blocks += 1;
      output.push(...buildBlock(chapter, chapterOf(exercisesConfig, chapter)).split('\n'));
      index = block.end;
    }
    // 残骸を落とした跡に空行が続くことがある。3行以上の空行は2行へ畳んで冪等にする。
    const collapsed = [];
    for (const item of output) {
      const blanks = collapsed.length >= 2
        && collapsed[collapsed.length - 1] === ''
        && collapsed[collapsed.length - 2] === '';
      if (item === '' && blanks) continue;
      collapsed.push(item);
    }
    const after = collapsed.join('\n');
    if (after !== before) {
      touched.push(file);
      if (!checkOnly) fs.writeFileSync(absolute, after);
    }
  }

  console.log('Code usage blocks');
  console.log(`- blocks: ${blocks}`);
  console.log(`- changed files: ${touched.length}`);
  for (const file of touched) console.log(`  ${file}`);
  if (checkOnly && touched.length > 0) {
    console.log('本文の「コード集の使い方」が config/exercises.json と一致しない。');
    console.log('`pnpm run apply:code-usage` を実行して再生成する。');
    process.exitCode = 1;
  }
  void drift;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
