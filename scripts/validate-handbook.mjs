#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootArgIndex = process.argv.indexOf('--root');
const root = path.resolve(rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd());
const bodyFiles = [
  '02-part1-foundations.md',
  '03-part2-frontend.md',
  '04-part3-backend.md',
  '05-part4-data.md',
  '06-part5-infrastructure.md',
  '07-part6-quality.md',
  '08-part7-practice.md',
];
const tocFile = '01-toc.md';
const indexFile = '10-index.md';
const allMarkdownFiles = [
  '00-front-matter.md',
  tocFile,
  ...bodyFiles,
  '09-references.md',
  indexFile,
  'README.md',
  'CONTRIBUTING.md',
  'LEARNING_LEVELS.md',
  'LEARNING_PATHS.md',
  'CHAPTER_TEMPLATE.md',
  'STYLE_GUIDE.md',
  'GLOSSARY.md',
  'STYLE_BACKLOG.md',
];

const errors = [];
const warnings = [];
const learningMetadata = new Map();
let learningManifest = { levels: {}, sections: {} };
try {
  learningManifest = JSON.parse(fs.readFileSync(path.join(root, 'config/learning-levels.json'), 'utf8'));
} catch (error) {
  report('error', 'LEARNING_MANIFEST_INVALID', `学習レベル定義を読み込めません: ${error.message}`, 'config/learning-levels.json');
}
const allowedLearningLevels = new Set(Object.keys(learningManifest.levels ?? {}));
// 索引の見出しに使える group。五十音は行の代表音のみを認める。
const allowedIndexGroups = new Set([
  'あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
]);
let chapterGuideManifest = { requiredFields: [], chapters: {} };
try {
  chapterGuideManifest = JSON.parse(fs.readFileSync(path.join(root, 'config/chapter-guides.json'), 'utf8'));
} catch (error) {
  report('error', 'CHAPTER_GUIDE_MANIFEST_INVALID', `章ガイド定義を読み込めません: ${error.message}`, 'config/chapter-guides.json');
}
const chapterGuideLabels = [
  '解決する実務上の問題','到達目標','前提知識','中核概念','最小実装','本番実装との差分',
  '典型的な失敗','診断・デバッグ方法','意思決定チェックリスト','演習と評価基準','一次資料・発展資料',
];

function report(kind, code, message, location) {
  const item = { code, message, location };
  (kind === 'error' ? errors : warnings).push(item);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    report('error', 'FILE_MISSING', `必要なファイルが存在しません: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length;
}

function normalizeTitle(title) {
  return title.replace(/\s+/g, ' ').trim();
}

function githubSlug(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const chapters = new Map();
const sections = new Map();
const secondLevelByChapter = new Map();

for (const file of bodyFiles) {
  const text = read(file);
  const lines = text.split('\n');
  let currentChapter = null;
  const slugCounts = new Map();

  // コードフェンス内の `## Context` のような行は見出しではない。走査対象から外す。
  let inFence = false;
  for (const [zeroBasedLine, line] of lines.entries()) {
    const lineNo = zeroBasedLine + 1;
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const chapterMatch = line.match(/^##\s+第(\d+)章\s+(.+?)\s*$/);
    if (chapterMatch) {
      const number = Number(chapterMatch[1]);
      const title = normalizeTitle(chapterMatch[2]);
      if (chapters.has(number)) {
        report('error', 'CHAPTER_DUPLICATE', `第${number}章が重複しています`, `${file}:${lineNo}`);
      } else {
        chapters.set(number, { number, title, file, line: lineNo });
      }
      currentChapter = number;
    }

    const sectionMatch = line.match(/^(#{3,6})\s+(\d+)\.(\d+)(?:\.(\d+))?\s+(.+?)\s*$/);
    if (sectionMatch) {
      const level = sectionMatch[1].length;
      const chapterNumber = Number(sectionMatch[2]);
      const sectionNumber = Number(sectionMatch[3]);
      const subsectionNumber = sectionMatch[4] ? Number(sectionMatch[4]) : null;
      const id = subsectionNumber === null
        ? `${chapterNumber}.${sectionNumber}`
        : `${chapterNumber}.${sectionNumber}.${subsectionNumber}`;
      const title = normalizeTitle(sectionMatch[5]);

      if (currentChapter !== chapterNumber) {
        report(
          'error',
          'SECTION_CHAPTER_MISMATCH',
          `${id} の章番号が現在の第${currentChapter ?? '?'}章と一致しません`,
          `${file}:${lineNo}`,
        );
      }
      if (sections.has(id)) {
        report('error', 'SECTION_DUPLICATE', `節番号 ${id} が重複しています`, `${file}:${lineNo}`);
      } else {
        sections.set(id, { id, title, file, line: lineNo, level });
      }
      if (subsectionNumber === null && level === 3) {
        const values = secondLevelByChapter.get(chapterNumber) ?? [];
        values.push({ number: sectionNumber, file, line: lineNo });
        secondLevelByChapter.set(chapterNumber, values);
      }

      const metadataLine = lines[zeroBasedLine + 1] ?? '';
      const metadataMatch = metadataLine.match(/^<!-- handbook:learning (.+) -->$/);
      if (!metadataMatch) {
        report('error', 'LEARNING_METADATA_MISSING', `節 ${id} に学習レベルメタデータがありません`, `${file}:${lineNo}`);
      } else {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (!allowedLearningLevels.has(metadata.level)) {
            report('error', 'LEARNING_LEVEL_INVALID', `節 ${id} の学習レベルが不正です: ${metadata.level}`, `${file}:${lineNo + 1}`);
          }
          if (!Number.isInteger(metadata.minutes) || metadata.minutes <= 0) {
            report('error', 'LEARNING_MINUTES_INVALID', `節 ${id} の推定時間が正の整数ではありません`, `${file}:${lineNo + 1}`);
          }
          learningMetadata.set(id, metadata);
          const manifestEntry = learningManifest.sections?.[id];
          if (!manifestEntry) {
            report('error', 'LEARNING_MANIFEST_MISSING', `分類マニフェストに節 ${id} がありません`, `${file}:${lineNo}`);
          } else {
            if (normalizeTitle(manifestEntry.title) !== title) {
              report('error', 'LEARNING_TITLE_MISMATCH', `節 ${id} の分類タイトルが本文と一致しません`, 'config/learning-levels.json');
            }
            if (manifestEntry.level !== metadata.level || manifestEntry.minutes !== metadata.minutes) {
              report('error', 'LEARNING_METADATA_DRIFT', `節 ${id} の本文メタデータと分類マニフェストが一致しません`, `${file}:${lineNo + 1}`);
            }
          }
        } catch (error) {
          report('error', 'LEARNING_METADATA_INVALID', `節 ${id} の学習レベルメタデータを解析できません: ${error.message}`, `${file}:${lineNo + 1}`);
        }
      }
    }

    // 索引メタデータの group は五十音の行かアルファベット1文字に限る。
    // 「く行」「ろ行」のような値は 10-index.md に存在しない見出しを作る。
    const indexMatch = line.match(/^<!-- handbook:index (.+) -->$/);
    if (indexMatch) {
      try {
        const entry = JSON.parse(indexMatch[1]);
        if (!allowedIndexGroups.has(entry.group)) {
          report(
            'error',
            'INDEX_GROUP_INVALID',
            `索引メタデータの group が不正です: ${entry.group} (語: ${entry.term})`,
            `${file}:${lineNo}`,
          );
        }
        if (typeof entry.term !== 'string' || entry.term.trim() === '') {
          report('error', 'INDEX_TERM_INVALID', '索引メタデータの term が空です', `${file}:${lineNo}`);
        }
      } catch (error) {
        report('error', 'INDEX_METADATA_INVALID', `索引メタデータを解析できません: ${error.message}`, `${file}:${lineNo}`);
      }
    }

    const headingMatch = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (headingMatch) {
      const previousLine = zeroBasedLine > 0 ? text.split('\n')[zeroBasedLine - 1] : '';
      const hasExplicitGeneratedAnchor = /^<a id=\"(?:chapter|section)-/.test(previousLine);
      const slug = githubSlug(headingMatch[1]);
      if (slug) {
        const count = (slugCounts.get(slug) ?? 0) + 1;
        slugCounts.set(slug, count);
        if (count > 1 && !hasExplicitGeneratedAnchor) {
          report(
            'warning',
            'ANCHOR_DUPLICATE',
            `同じ自動アンカー候補 #${slug} が複数あります`,
            `${file}:${lineNo}`,
          );
        }
      }
    }
  }
}

for (let chapterNumber = 1; chapterNumber <= 30; chapterNumber += 1) {
  if (!chapters.has(chapterNumber)) {
    report('error', 'CHAPTER_MISSING', `第${chapterNumber}章が本文に存在しません`);
  }
}

for (let chapterNumber = 1; chapterNumber <= 30; chapterNumber += 1) {
  const chapter = chapters.get(chapterNumber);
  const entry = chapterGuideManifest.chapters?.[String(chapterNumber)];
  if (!entry) {
    report('error', 'CHAPTER_GUIDE_MANIFEST_MISSING', `第${chapterNumber}章の章ガイド定義がありません`, 'config/chapter-guides.json');
    continue;
  }
  if (chapter && normalizeTitle(entry.title ?? '') !== chapter.title) {
    report('error', 'CHAPTER_GUIDE_TITLE_MISMATCH', `第${chapterNumber}章の章ガイドタイトルが本文と一致しません`, 'config/chapter-guides.json');
  }
  for (const field of chapterGuideManifest.requiredFields ?? []) {
    if (!(field in entry)) report('error', 'CHAPTER_GUIDE_FIELD_MISSING', `第${chapterNumber}章の章ガイドに ${field} がありません`, 'config/chapter-guides.json');
  }
  if (!chapter) continue;
  const text = read(chapter.file);
  const pattern = new RegExp(`<!-- handbook:chapter-guide:start \\{\"chapter\":${chapterNumber}\\} -->([\\s\\S]*?)<!-- handbook:chapter-guide:end -->`, 'g');
  const blocks = [...text.matchAll(pattern)];
  if (blocks.length !== 1) {
    report('error', 'CHAPTER_GUIDE_BLOCK_COUNT', `第${chapterNumber}章の章ガイドブロックが1件ではありません: ${blocks.length}`, chapter.file);
    continue;
  }
  for (const label of chapterGuideLabels) {
    if (!blocks[0][1].includes(label)) report('error', 'CHAPTER_GUIDE_ELEMENT_MISSING', `第${chapterNumber}章の章ガイドに「${label}」がありません`, chapter.file);
  }
  for (const field of ['coreSections', 'minimalSections', 'exerciseSections']) {
    for (const id of entry[field] ?? []) {
      if (!sections.has(id)) report('error', 'CHAPTER_GUIDE_SECTION_MISSING', `第${chapterNumber}章の ${field} が存在しない節 ${id} を参照しています`, 'config/chapter-guides.json');
    }
  }
  for (const item of entry.prerequisites ?? []) {
    if (item && typeof item === 'object' && item.section && !sections.has(item.section)) {
      report('error', 'CHAPTER_GUIDE_PREREQUISITE_MISSING', `第${chapterNumber}章が存在しない前提節 ${item.section} を参照しています`, 'config/chapter-guides.json');
    }
  }
}
for (const chapterNumber of Object.keys(chapterGuideManifest.chapters ?? {})) {
  if (!chapters.has(Number(chapterNumber))) report('error', 'CHAPTER_GUIDE_UNKNOWN_CHAPTER', `章ガイド定義の第${chapterNumber}章は本文に存在しません`, 'config/chapter-guides.json');
}

for (const [chapterNumber, values] of secondLevelByChapter) {
  const sorted = [...values].sort((a, b) => a.number - b.number);
  sorted.forEach((entry, index) => {
    const expected = index + 1;
    if (entry.number !== expected) {
      report(
        'error',
        'SECTION_SEQUENCE',
        `第${chapterNumber}章の節番号が連番ではありません。期待値 ${chapterNumber}.${expected}、実際 ${chapterNumber}.${entry.number}`,
        `${entry.file}:${entry.line}`,
      );
    }
  });
}

// 目次と本文の照合
const tocText = read(tocFile);
const tocChapters = new Map();
const tocSections = new Map();
for (const [zeroBasedLine, line] of tocText.split('\n').entries()) {
  const lineNo = zeroBasedLine + 1;
  const chapterMatch = line.match(/^-\s+\[第(\d+)章\s+(.+?)\]\([^)]+\)(?:\s+—.*)?\s*$/);
  if (chapterMatch) {
    tocChapters.set(Number(chapterMatch[1]), {
      title: normalizeTitle(chapterMatch[2].replace(/\]\([^)]+\)$/, '')),
      line: lineNo,
    });
  }
  const sectionMatch = line.match(/^\s+-\s+\[(\d+)\.(\d+)(?:\.(\d+))?\s+(.+?)\]\([^)]+\)(?:\s+—.*)?\s*$/);
  if (sectionMatch) {
    const id = sectionMatch[3]
      ? `${sectionMatch[1]}.${sectionMatch[2]}.${sectionMatch[3]}`
      : `${sectionMatch[1]}.${sectionMatch[2]}`;
    tocSections.set(id, { title: normalizeTitle(sectionMatch[4].replace(/\]\([^)]+\)$/, '')), line: lineNo });
  }
}

for (const [number, chapter] of chapters) {
  const tocChapter = tocChapters.get(number);
  if (!tocChapter) {
    report('error', 'TOC_CHAPTER_MISSING', `目次に第${number}章がありません`, chapter.file);
  } else if (tocChapter.title !== chapter.title) {
    report(
      'error',
      'TOC_CHAPTER_TITLE',
      `第${number}章のタイトルが不一致です。本文「${chapter.title}」/ 目次「${tocChapter.title}」`,
      `${tocFile}:${tocChapter.line}`,
    );
  }
}
for (const number of tocChapters.keys()) {
  if (!chapters.has(number)) {
    report('error', 'TOC_UNKNOWN_CHAPTER', `目次の第${number}章は本文に存在しません`, tocFile);
  }
}

for (const [id, section] of sections) {
  if (section.level !== 3) continue;
  const tocSection = tocSections.get(id);
  if (!tocSection) {
    report('error', 'TOC_SECTION_MISSING', `目次に節 ${id} がありません`, `${section.file}:${section.line}`);
  } else if (tocSection.title !== section.title) {
    report(
      'error',
      'TOC_SECTION_TITLE',
      `節 ${id} のタイトルが不一致です。本文「${section.title}」/ 目次「${tocSection.title}」`,
      `${tocFile}:${tocSection.line}`,
    );
  }
}
for (const id of tocSections.keys()) {
  const section = sections.get(id);
  if (!section || section.level !== 3) {
    report('error', 'TOC_UNKNOWN_SECTION', `目次の節 ${id} は本文の第3階層見出しに存在しません`, tocFile);
  }
}

for (const id of Object.keys(learningManifest.sections ?? {})) {
  if (!sections.has(id)) {
    report('error', 'LEARNING_UNKNOWN_SECTION', `分類マニフェストの節 ${id} は本文に存在しません`, 'config/learning-levels.json');
  }
}

// 索引参照先の存在検査
const indexText = read(indexFile);
for (const match of indexText.matchAll(/—\s*([^\n]+)/g)) {
  const references = [...match[1].matchAll(/\b(\d+\.\d+(?:\.\d+)?)\b/g)].map((item) => item[1]);
  for (const reference of references) {
    if (!sections.has(reference)) {
      report(
        'error',
        'INDEX_TARGET_MISSING',
        `索引の参照先 ${reference} が本文に存在しません`,
        `${indexFile}:${lineNumber(indexText, match.index)}`,
      );
    }
  }
}

// 本文中のコードパス存在検査
const codeReferencePattern = /\bcode\/ch\d{2}\/[A-Za-z0-9_./{}-]+/g;
for (const file of bodyFiles) {
  const text = read(file);
  for (const match of text.matchAll(codeReferencePattern)) {
    const reference = match[0].replace(/[.,;:]+$/, '');
    if (!fs.existsSync(path.join(root, reference))) {
      report(
        'error',
        'CODE_TARGET_MISSING',
        `コード参照先が存在しません: ${reference}`,
        `${file}:${lineNumber(text, match.index)}`,
      );
    }
  }
}

// Markdown相対リンク検査
const markdownLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
for (const file of allMarkdownFiles) {
  const text = read(file);
  const lines = text.split('\n');
  let inFence = false;
  let offset = 0;
  for (const [zeroBasedLine, line] of lines.entries()) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      offset += line.length + 1;
      continue;
    }
    if (!inFence) {
      for (const match of line.matchAll(markdownLinkPattern)) {
        const rawTarget = match[1].trim().replace(/^<|>$/g, '');
        if (!rawTarget || /^(?:https?:|mailto:|tel:|data:)/i.test(rawTarget) || rawTarget.startsWith('#')) {
          continue;
        }
        const targetWithoutAnchor = decodeURIComponent(rawTarget.split('#')[0]);
        if (!targetWithoutAnchor) continue;
        const absoluteTarget = path.resolve(root, path.dirname(file), targetWithoutAnchor);
        if (!fs.existsSync(absoluteTarget)) {
          report(
            'error',
            'MARKDOWN_LINK_MISSING',
            `相対リンク先が存在しません: ${rawTarget}`,
            `${file}:${zeroBasedLine + 1}`,
          );
        }
      }
    }
    offset += line.length + 1;
  }
}

const formatItem = (item) => {
  const location = item.location ? ` (${item.location})` : '';
  return `[${item.code}] ${item.message}${location}`;
};

console.log('Handbook validation');
console.log(`- chapters: ${chapters.size}`);
console.log(`- numbered sections/subsections: ${sections.size}`);
console.log(`- learning metadata: ${learningMetadata.size}`);
console.log(`- chapter guides: ${Object.keys(chapterGuideManifest.chapters ?? {}).length}`);
console.log(`- errors: ${errors.length}`);
console.log(`- warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\nErrors');
  for (const item of errors) console.log(`- ${formatItem(item)}`);
}
if (warnings.length > 0) {
  console.log('\nWarnings');
  for (const item of warnings) console.log(`- ${formatItem(item)}`);
}

if (errors.length > 0) process.exitCode = 1;
