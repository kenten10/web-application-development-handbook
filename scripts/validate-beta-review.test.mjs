import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const validator = path.join(root, 'scripts', 'validate-beta-review.mjs');

function run(cwd) {
  return spawnSync(process.execPath, [validator], { cwd, encoding: 'utf8' });
}

function copyFixture(prefix) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const dir = path.join(parent, 'repo');
  fs.cpSync(root, dir, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${path.sep}node_modules${path.sep}`) &&
      !src.includes(`${path.sep}dist${path.sep}`) &&
      !src.includes(`${path.sep}.git${path.sep}`) &&
      !src.includes(`${path.sep}.verification${path.sep}`)
  });
  return dir;
}

function readScope(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'beta-review-scope.json'), 'utf8'));
}

function writeScope(dir, scope) {
  fs.writeFileSync(path.join(dir, 'beta-review-scope.json'), `${JSON.stringify(scope, null, 2)}\n`);
}

test('current beta review scope is valid', () => {
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Beta review scope: chapters=\d+/);
  assert.match(result.stdout, /core=\d+/);
});

test('scope must cover every chapter in the narrative manifest', () => {
  const dir = copyFixture('beta-review-chapters-');
  const scope = readScope(dir);
  scope.chapters = scope.chapters.filter((c) => c.tier !== 'sampled' || c.chapter !== scope.chapters.find((x) => x.tier === 'sampled').chapter);
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_CHAPTER_SET_MISMATCH/);
});

test('a chapter with environment dependent exercises cannot be downgraded', () => {
  const dir = copyFixture('beta-review-tier-');
  const scope = readScope(dir);
  const target = scope.chapters.find((c) => c.tier === 'core' && c.metrics.environmentDependentExercises >= 2);
  target.tier = 'sampled';
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`BETA_CHAPTER_TIER_MISMATCH chapter=${target.chapter}`));
});

test('dropping an environment dependent exercise is rejected', () => {
  const dir = copyFixture('beta-review-exercise-');
  const scope = readScope(dir);
  const target = scope.exercises.find((e) => e.category === 'browser-manual');
  scope.exercises = scope.exercises.filter((e) => e.id !== target.id);
  const chapter = scope.chapters.find((c) => c.chapter === target.chapter);
  chapter.mandatoryExercises = chapter.mandatoryExercises.filter((id) => id !== target.id);
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_EXERCISE_MISSING/);
});

test('required section coverage must match the learning level manifest', () => {
  const dir = copyFixture('beta-review-sections-');
  const scope = readScope(dir);
  scope.readingScope.requiredSectionCount -= 1;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_REQUIRED_SECTION_COVERAGE/);
});

test('a chapter whose required sections are trimmed is rejected', () => {
  const dir = copyFixture('beta-review-chapter-sections-');
  const scope = readScope(dir);
  const target = scope.chapters.find((c) => c.requiredSections.length > 1);
  target.requiredSections = target.requiredSections.slice(1);
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_CHAPTER_REQUIRED_SECTIONS_MISMATCH/);
});

test('every mandatory exercise must be assigned to exactly one track', () => {
  const dir = copyFixture('beta-review-track-');
  const scope = readScope(dir);
  const execRole = scope.roles.find((r) => r.id === 'RL-EXEC');
  const track = execRole.tracks[0];
  track.exercises = track.exercises.slice(1);
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_TRACK_EXERCISE_UNASSIGNED/);
});

test('effort estimates must follow the declared formula', () => {
  const dir = copyFixture('beta-review-effort-');
  const scope = readScope(dir);
  scope.roles.find((r) => r.id === 'RL-READ').estimatedMinutes += 60;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_ROLE_EFFORT_MISMATCH id=RL-READ/);
});

test('a persona pointing at an unknown learning route is rejected', () => {
  const dir = copyFixture('beta-review-persona-');
  const scope = readScope(dir);
  scope.personas[0].route = 'no-such-route';
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_PERSONA_ROUTE_UNKNOWN/);
});

test('an Urgent severity must block the release', () => {
  const dir = copyFixture('beta-review-severity-');
  const scope = readScope(dir);
  scope.severities.find((s) => s.ken61Bucket === 'Urgent').releaseImpact = 'non-blocking';
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_SEVERITY_IMPACT_INCONSISTENT/);
});

test('release blockers must be documented in the plan', () => {
  const dir = copyFixture('beta-review-blocker-');
  const scope = readScope(dir);
  scope.releaseBlockers.push({
    id: 'RB-99',
    title: '未記載の停止条件',
    condition: '条件',
    check: '判定',
    ken63Gate: 'ゲート',
    severity: 'SEV-BLOCKER',
    owner: 'メンテナ'
  });
  scope.totals.releaseBlockers += 1;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_RELEASE_BLOCKER_NOT_IN_PLAN id=RB-99/);
});

test('release blockers cannot be emptied', () => {
  const dir = copyFixture('beta-review-blocker-empty-');
  const scope = readScope(dir);
  scope.releaseBlockers = [];
  scope.totals.releaseBlockers = 0;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_RELEASE_BLOCKER_EMPTY/);
});

test('questionnaire question counts must match the template document', () => {
  const dir = copyFixture('beta-review-questionnaire-');
  const scope = readScope(dir);
  const target = scope.questionnaires.find((q) => q.id === 'QS-READER');
  target.questionCount += 1;
  scope.totals.questions += 1;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_QUESTIONNAIRE_COUNT_MISMATCH id=QS-READER/);
});

test('collecting a name is rejected by the privacy policy check', () => {
  const dir = copyFixture('beta-review-privacy-');
  const scope = readScope(dir);
  scope.privacy.notCollected = scope.privacy.notCollected.filter((item) => !item.includes('氏名'));
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_PRIVACY_FORBIDDEN_ITEM_MISSING/);
});

test('storing the anonymous id mapping in the repository is rejected', () => {
  const dir = copyFixture('beta-review-privacy-id-');
  const scope = readScope(dir);
  scope.privacy.anonymousId.inRepository = true;
  writeScope(dir, scope);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_PRIVACY_ID_IN_REPOSITORY/);
});

test('a mandatory exercise missing from the scenario document is detected', () => {
  const dir = copyFixture('beta-review-scenario-');
  const target = readScope(dir).exercises.find((e) => e.category === 'external-service');
  const file = path.join(dir, 'BETA_REVIEW_SCENARIOS.md');
  const text = fs.readFileSync(file, 'utf8').replaceAll(`\`${target.id}\``, `${target.id}`);
  fs.writeFileSync(file, text);
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`BETA_EXERCISE_NOT_IN_SCENARIOS id=${target.id.replace('.', '\\.')}`));
});

test('a missing planning document is detected', () => {
  const dir = copyFixture('beta-review-document-');
  fs.rmSync(path.join(dir, 'BETA_REVIEW_TEMPLATES.md'));
  const result = run(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BETA_DOCUMENT_MISSING/);
});
