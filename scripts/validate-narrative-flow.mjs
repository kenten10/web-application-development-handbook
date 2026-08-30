import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = path.join(root, 'config', 'narrative-flow.json');
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

if (!fs.existsSync(manifestPath)) {
  console.error('NARRATIVE_MANIFEST_MISSING config/narrative-flow.json');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const chapters = manifest.chapters ?? [];
if (chapters.length !== 30) {
  errors.push(`NARRATIVE_CHAPTER_COUNT expected=30 actual=${chapters.length}`);
}

const seen = new Set();
for (const item of chapters) {
  const { chapter, title, file, status, minimumBridgeCount = 0 } = item;
  if (seen.has(chapter)) errors.push(`NARRATIVE_CHAPTER_DUPLICATE chapter=${chapter}`);
  seen.add(chapter);
  if (!['planned', 'in-progress', 'completed'].includes(status)) {
    errors.push(`NARRATIVE_STATUS_INVALID chapter=${chapter} status=${status}`);
  }
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    errors.push(`NARRATIVE_FILE_MISSING chapter=${chapter} file=${file}`);
    continue;
  }
  const text = fs.readFileSync(full, 'utf8');
  const heading = `## 第${chapter}章 ${title}`;
  const headingIndex = text.indexOf(heading);
  if (headingIndex < 0) {
    errors.push(`NARRATIVE_HEADING_MISSING chapter=${chapter}`);
    continue;
  }
  const guide = `<!-- handbook:chapter-guide:start {"chapter":${chapter}} -->`;
  const guideIndex = text.indexOf(guide, headingIndex);
  if (guideIndex < 0) {
    errors.push(`NARRATIVE_GUIDE_MISSING chapter=${chapter}`);
    continue;
  }
  const intro = text.slice(headingIndex + heading.length, guideIndex)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== '---');
  if (status === 'completed') {
    if (intro.length < 2) errors.push(`NARRATIVE_INTRO_TOO_SHORT chapter=${chapter}`);
    const marker = `<!-- handbook:narrative-bridge {"section":"${chapter}.`;
    const bridgeCount = text.split(marker).length - 1;
    if (bridgeCount < minimumBridgeCount) {
      errors.push(`NARRATIVE_BRIDGE_MISSING chapter=${chapter} expected>=${minimumBridgeCount} actual=${bridgeCount}`);
    }
  } else if (intro.length === 0) {
    warnings.push(`NARRATIVE_INTRO_EMPTY chapter=${chapter}`);
  }
}

for (const required of ['NARRATIVE_EDITING_GUIDE.md', 'NARRATIVE_ARCHITECTURE.md']) {
  if (!fs.existsSync(path.join(root, required))) errors.push(`NARRATIVE_GUIDE_FILE_MISSING file=${required}`);
}

console.log(`Narrative flow: chapters=${chapters.length}, completed=${chapters.filter((c) => c.status === 'completed').length}`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length > 0) process.exit(1);
