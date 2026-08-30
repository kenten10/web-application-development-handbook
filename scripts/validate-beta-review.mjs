#!/usr/bin/env node
// ベータレビュー計画（KEN-60）の整合性検証。
// 章・節・演習の一覧をハードコードせず、config配下の正本から選定基準を再計算し、
// beta-review-scope.json と3つの計画文書が正本と一致しているかを検査する。
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const errors = [];
const warnings = [];

function fail(code, detail) {
  errors.push(detail ? `${code} ${detail}` : code);
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

const SCOPE_FILE = 'beta-review-scope.json';
if (!exists(SCOPE_FILE)) {
  console.error(`ERROR BETA_SCOPE_MISSING file=${SCOPE_FILE}`);
  process.exit(1);
}

let scope;
try {
  scope = readJson(SCOPE_FILE);
} catch (error) {
  console.error(`ERROR BETA_SCOPE_UNPARSABLE ${error.message}`);
  process.exit(1);
}

if (scope.schemaVersion !== 1) fail('BETA_SCHEMA_VERSION', `expected=1 actual=${scope.schemaVersion}`);

const SOURCES = {
  chapters: 'config/narrative-flow.json',
  sections: 'config/learning-levels.json',
  routes: 'config/learning-paths.json',
  exercises: 'config/exercises.json',
  environment: 'config/clean-environment-plan.json'
};

for (const [key, expected] of Object.entries(SOURCES)) {
  const declared = scope.sources?.[key];
  if (declared !== expected) fail('BETA_SOURCE_MISMATCH', `key=${key} expected=${expected} actual=${declared}`);
  if (!exists(expected)) fail('BETA_SOURCE_FILE_MISSING', `file=${expected}`);
}

const DOCUMENTS = {
  plan: 'BETA_REVIEW_PLAN.md',
  scenarios: 'BETA_REVIEW_SCENARIOS.md',
  templates: 'BETA_REVIEW_TEMPLATES.md'
};
for (const [key, expected] of Object.entries(DOCUMENTS)) {
  const declared = scope.documents?.[key];
  if (declared !== expected) fail('BETA_DOCUMENT_MISMATCH', `key=${key} expected=${expected} actual=${declared}`);
  if (!exists(expected)) fail('BETA_DOCUMENT_MISSING', `file=${expected}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

const flow = readJson(SOURCES.chapters);
const levels = readJson(SOURCES.sections);
const paths = readJson(SOURCES.routes);
const exerciseManifest = readJson(SOURCES.exercises);
const plan = readJson(SOURCES.environment);

const planText = fs.readFileSync(path.join(root, DOCUMENTS.plan), 'utf8');
const scenarioText = fs.readFileSync(path.join(root, DOCUMENTS.scenarios), 'utf8');
const templateText = fs.readFileSync(path.join(root, DOCUMENTS.templates), 'utf8');

// ---------------------------------------------------------------------------
// 1. 正本から章の指標と選定基準を再計算する（章数はハードコードしない）
// ---------------------------------------------------------------------------
const chapterNumbers = flow.chapters.map((c) => c.chapter).sort((a, b) => a - b);
const flowOf = new Map(flow.chapters.map((c) => [c.chapter, c]));

const requiredSections = new Map();
const requiredMinutes = new Map();
for (const number of chapterNumbers) {
  requiredSections.set(number, []);
  requiredMinutes.set(number, 0);
}
for (const [id, section] of Object.entries(levels.sections)) {
  const chapter = Number(id.split('.')[0]);
  if (!requiredSections.has(chapter)) continue;
  if (section.level === 'required') {
    requiredSections.get(chapter).push(id);
    requiredMinutes.set(chapter, requiredMinutes.get(chapter) + section.minutes);
  }
}

const routeAppearances = new Map(chapterNumbers.map((c) => [c, 0]));
const entryCheckReferences = new Map(chapterNumbers.map((c) => [c, 0]));
const routeIds = new Set(paths.routes.map((r) => r.id));
for (const route of paths.routes) {
  const seen = new Set();
  for (const stage of route.stages) {
    for (const selector of stage.selectors) {
      for (const chapter of selector.chapters ?? []) seen.add(chapter);
      for (const section of selector.sections ?? []) seen.add(Number(section.split('.')[0]));
    }
  }
  for (const chapter of seen) {
    if (routeAppearances.has(chapter)) routeAppearances.set(chapter, routeAppearances.get(chapter) + 1);
  }
  for (const section of route.entryChecks) {
    const chapter = Number(section.split('.')[0]);
    if (entryCheckReferences.has(chapter)) {
      entryCheckReferences.set(chapter, entryCheckReferences.get(chapter) + 1);
    }
  }
}

const planById = new Map(plan.exercises.map((e) => [e.id, e]));
const planByChapter = new Map(chapterNumbers.map((c) => [c, []]));
const environmentDependent = new Map(chapterNumbers.map((c) => [c, 0]));
for (const exercise of plan.exercises) {
  if (!planByChapter.has(exercise.chapter)) {
    fail('BETA_EXERCISE_UNKNOWN_CHAPTER', `id=${exercise.id} chapter=${exercise.chapter}`);
    continue;
  }
  planByChapter.get(exercise.chapter).push(exercise);
  if (exercise.category !== 'local-automated') {
    environmentDependent.set(exercise.chapter, environmentDependent.get(exercise.chapter) + 1);
  }
}

function quantile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

const thresholds = {
  requiredMinutesThreshold: quantile(chapterNumbers.map((c) => requiredMinutes.get(c)), 0.75),
  bridgeThreshold: quantile(chapterNumbers.map((c) => flowOf.get(c).minimumBridgeCount), 0.75),
  entryCheckThreshold: Math.max(1, quantile(chapterNumbers.map((c) => entryCheckReferences.get(c)), 0.75)),
  routeTotal: paths.routes.length
};

for (const [key, value] of Object.entries(thresholds)) {
  const declared = scope.selectionCriteria?.thresholds?.[key];
  if (declared !== value) fail('BETA_THRESHOLD_MISMATCH', `key=${key} expected=${value} actual=${declared}`);
}

const matchedCriteria = new Map();
for (const number of chapterNumbers) {
  const matched = [];
  if (requiredMinutes.get(number) >= thresholds.requiredMinutesThreshold) matched.push('C1');
  if (
    routeAppearances.get(number) >= thresholds.routeTotal ||
    entryCheckReferences.get(number) >= thresholds.entryCheckThreshold
  ) {
    matched.push('C2');
  }
  if (environmentDependent.get(number) >= 1) matched.push('C3');
  if (flowOf.get(number).minimumBridgeCount >= thresholds.bridgeThreshold) matched.push('C4');
  matchedCriteria.set(number, matched);
}

const coreChapters = new Set(
  chapterNumbers.filter((c) => matchedCriteria.get(c).length >= 2 || environmentDependent.get(c) >= 2)
);
// C5: 部（本文ファイル）ごとに必須検証章を1章以上確保する
const partFiles = [...new Set(chapterNumbers.map((c) => flowOf.get(c).file))];
for (const file of partFiles) {
  const inPart = chapterNumbers.filter((c) => flowOf.get(c).file === file);
  if (inPart.some((c) => coreChapters.has(c))) continue;
  const pick = [...inPart].sort(
    (a, b) => requiredMinutes.get(b) - requiredMinutes.get(a) || a - b
  )[0];
  coreChapters.add(pick);
  matchedCriteria.get(pick).push('C5');
}

// ---------------------------------------------------------------------------
// 2. 必須検証演習を再計算する
// ---------------------------------------------------------------------------
const e1 = plan.exercises.filter((e) => e.category !== 'local-automated').map((e) => e.id);
const e1Set = new Set(e1);
const e2 = [];
for (const number of [...coreChapters].sort((a, b) => a - b)) {
  const list = planByChapter.get(number) ?? [];
  if (list.some((e) => e1Set.has(e.id) && e.difficulty === 3)) continue;
  const maxDifficulty = list.reduce((max, e) => Math.max(max, e.difficulty), 0);
  const candidate = list
    .filter((e) => e.difficulty === maxDifficulty && !e1Set.has(e.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))[0];
  if (candidate) e2.push(candidate.id);
}
const e2Set = new Set(e2);
const mandatoryExerciseIds = new Set([...e1, ...e2]);

// ---------------------------------------------------------------------------
// 3. 章エントリの検証
// ---------------------------------------------------------------------------
const scopeChapters = scope.chapters ?? [];
const scopeChapterNumbers = scopeChapters.map((c) => c.chapter).sort((a, b) => a - b);
if (scopeChapterNumbers.join(',') !== chapterNumbers.join(',')) {
  const missing = chapterNumbers.filter((c) => !scopeChapterNumbers.includes(c));
  const extra = scopeChapterNumbers.filter((c) => !chapterNumbers.includes(c));
  fail('BETA_CHAPTER_SET_MISMATCH', `missing=[${missing.join(',')}] extra=[${extra.join(',')}]`);
}

const seenChapters = new Set();
const scopeChapterMap = new Map();
for (const entry of scopeChapters) {
  if (seenChapters.has(entry.chapter)) fail('BETA_CHAPTER_DUPLICATE', `chapter=${entry.chapter}`);
  seenChapters.add(entry.chapter);
  scopeChapterMap.set(entry.chapter, entry);
  const source = flowOf.get(entry.chapter);
  if (!source) continue;
  if (entry.title !== source.title) {
    fail('BETA_CHAPTER_TITLE_MISMATCH', `chapter=${entry.chapter} expected=${source.title} actual=${entry.title}`);
  }
  if (entry.file !== source.file) {
    fail('BETA_CHAPTER_FILE_MISMATCH', `chapter=${entry.chapter} expected=${source.file} actual=${entry.file}`);
  }

  const expectedMatched = matchedCriteria.get(entry.chapter);
  const mine = [...mandatoryExerciseIds]
    .filter((id) => planById.get(id).chapter === entry.chapter)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const expectedTier = coreChapters.has(entry.chapter) ? 'core' : mine.length > 0 ? 'exercise-only' : 'sampled';
  if (entry.tier !== expectedTier) {
    fail('BETA_CHAPTER_TIER_MISMATCH', `chapter=${entry.chapter} expected=${expectedTier} actual=${entry.tier}`);
  }
  if ((entry.matchedCriteria ?? []).join(',') !== expectedMatched.join(',')) {
    fail(
      'BETA_CHAPTER_CRITERIA_MISMATCH',
      `chapter=${entry.chapter} expected=[${expectedMatched.join(',')}] actual=[${(entry.matchedCriteria ?? []).join(',')}]`
    );
  }
  if ((entry.reasons ?? []).length !== expectedMatched.length) {
    fail('BETA_CHAPTER_REASON_COUNT', `chapter=${entry.chapter} criteria=${expectedMatched.length} reasons=${(entry.reasons ?? []).length}`);
  }

  const expectedMetrics = {
    requiredSectionCount: requiredSections.get(entry.chapter).length,
    requiredMinutes: requiredMinutes.get(entry.chapter),
    routeAppearances: routeAppearances.get(entry.chapter),
    entryCheckReferences: entryCheckReferences.get(entry.chapter),
    environmentDependentExercises: environmentDependent.get(entry.chapter),
    minimumBridgeCount: source.minimumBridgeCount
  };
  for (const [key, value] of Object.entries(expectedMetrics)) {
    if (entry.metrics?.[key] !== value) {
      fail('BETA_CHAPTER_METRIC_MISMATCH', `chapter=${entry.chapter} key=${key} expected=${value} actual=${entry.metrics?.[key]}`);
    }
  }

  const expectedSections = [...requiredSections.get(entry.chapter)].sort((a, b) =>
    a.localeCompare(b, 'en', { numeric: true })
  );
  const actualSections = [...(entry.requiredSections ?? [])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (expectedSections.join(',') !== actualSections.join(',')) {
    fail('BETA_CHAPTER_REQUIRED_SECTIONS_MISMATCH', `chapter=${entry.chapter} expected=${expectedSections.length} actual=${actualSections.length}`);
  }

  const actualMine = [...(entry.mandatoryExercises ?? [])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (mine.join(',') !== actualMine.join(',')) {
    fail('BETA_CHAPTER_EXERCISE_MISMATCH', `chapter=${entry.chapter} expected=[${mine.join(',')}] actual=[${actualMine.join(',')}]`);
  }
}

// 部（本文ファイル）ごとの必須検証章の網羅
for (const file of partFiles) {
  const covered = chapterNumbers.some((c) => flowOf.get(c).file === file && scopeChapterMap.get(c)?.tier === 'core');
  if (!covered) fail('BETA_PART_NOT_COVERED', `file=${file}`);
}

// 必修節の網羅
const totalRequiredSections = [...requiredSections.values()].reduce((sum, list) => sum + list.length, 0);
const totalRequiredMinutes = [...requiredMinutes.values()].reduce((sum, value) => sum + value, 0);
if (scope.readingScope?.route !== 'standard') {
  fail('BETA_READING_ROUTE_INVALID', `actual=${scope.readingScope?.route}`);
}
if (scope.readingScope?.requiredSectionCount !== totalRequiredSections) {
  fail('BETA_REQUIRED_SECTION_COVERAGE', `expected=${totalRequiredSections} actual=${scope.readingScope?.requiredSectionCount}`);
}
if (scope.readingScope?.requiredMinutes !== totalRequiredMinutes) {
  fail('BETA_REQUIRED_MINUTES_COVERAGE', `expected=${totalRequiredMinutes} actual=${scope.readingScope?.requiredMinutes}`);
}
const listedRequiredSections = scopeChapters.reduce((sum, entry) => sum + (entry.requiredSections ?? []).length, 0);
if (listedRequiredSections !== totalRequiredSections) {
  fail('BETA_REQUIRED_SECTION_SUM', `expected=${totalRequiredSections} actual=${listedRequiredSections}`);
}

// ---------------------------------------------------------------------------
// 4. 演習エントリの検証
// ---------------------------------------------------------------------------
const manifestExerciseIds = new Set();
for (const chapter of Object.values(exerciseManifest.chapters)) {
  for (const exercise of chapter.exercises) manifestExerciseIds.add(exercise.id);
}

const scopeExercises = scope.exercises ?? [];
const scopeExerciseIds = scopeExercises.map((e) => e.id);
const missingExercises = [...mandatoryExerciseIds].filter((id) => !scopeExerciseIds.includes(id));
const extraExercises = scopeExerciseIds.filter((id) => !mandatoryExerciseIds.has(id));
if (missingExercises.length > 0) fail('BETA_EXERCISE_MISSING', `ids=[${missingExercises.join(',')}]`);
if (extraExercises.length > 0) fail('BETA_EXERCISE_UNEXPECTED', `ids=[${extraExercises.join(',')}]`);

const seenExercises = new Set();
const trackIds = new Set((scope.roles ?? []).flatMap((r) => (r.tracks ?? []).map((t) => t.id)));
for (const entry of scopeExercises) {
  if (seenExercises.has(entry.id)) fail('BETA_EXERCISE_DUPLICATE', `id=${entry.id}`);
  seenExercises.add(entry.id);
  if (!manifestExerciseIds.has(entry.id)) fail('BETA_EXERCISE_NOT_IN_MANIFEST', `id=${entry.id}`);
  const source = planById.get(entry.id);
  if (!source) {
    fail('BETA_EXERCISE_NOT_IN_PLAN', `id=${entry.id}`);
    continue;
  }
  for (const key of ['chapter', 'category', 'difficulty', 'minutes']) {
    if (entry[key] !== source[key]) {
      fail('BETA_EXERCISE_FIELD_MISMATCH', `id=${entry.id} key=${key} expected=${source[key]} actual=${entry[key]}`);
    }
  }
  const expectedCriteria = [];
  if (e1Set.has(entry.id)) expectedCriteria.push('E1');
  if (e2Set.has(entry.id)) expectedCriteria.push('E2');
  if ((entry.matchedCriteria ?? []).join(',') !== expectedCriteria.join(',')) {
    fail('BETA_EXERCISE_CRITERIA_MISMATCH', `id=${entry.id} expected=[${expectedCriteria.join(',')}] actual=[${(entry.matchedCriteria ?? []).join(',')}]`);
  }
  if (!trackIds.has(entry.track)) fail('BETA_EXERCISE_TRACK_UNKNOWN', `id=${entry.id} track=${entry.track}`);
  if ((entry.requiredEvidence ?? []).join('|') !== (source.requiredEvidence ?? []).join('|')) {
    fail('BETA_EXERCISE_EVIDENCE_MISMATCH', `id=${entry.id}`);
  }
  if (!scopeChapterMap.get(entry.chapter)) fail('BETA_EXERCISE_CHAPTER_UNKNOWN', `id=${entry.id} chapter=${entry.chapter}`);
}

// E3: 標準通読ルートの全ステージが必須検証演習を含む
const standardRoute = paths.routes.find((r) => r.id === 'standard');
if (!standardRoute) {
  fail('BETA_STANDARD_ROUTE_MISSING');
} else {
  const coverage = scope.routeStageCoverage ?? [];
  if (coverage.length !== standardRoute.stages.length) {
    fail('BETA_STAGE_COVERAGE_COUNT', `expected=${standardRoute.stages.length} actual=${coverage.length}`);
  }
  standardRoute.stages.forEach((stage, index) => {
    const chapters = stage.selectors.flatMap((s) => s.chapters ?? []);
    const hits = [...mandatoryExerciseIds]
      .filter((id) => chapters.includes(planById.get(id).chapter))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (hits.length === 0) fail('BETA_STAGE_NOT_COVERED', `stage=${stage.label}`);
    const declared = coverage[index];
    if (!declared) return;
    if (declared.label !== stage.label) {
      fail('BETA_STAGE_LABEL_MISMATCH', `index=${index} expected=${stage.label} actual=${declared.label}`);
    }
    const declaredHits = [...(declared.exercises ?? [])].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    if (declaredHits.join(',') !== hits.join(',')) {
      fail('BETA_STAGE_EXERCISE_MISMATCH', `stage=${stage.label} expected=[${hits.join(',')}] actual=[${declaredHits.join(',')}]`);
    }
  });
}

// ---------------------------------------------------------------------------
// 5. 役割・ペルソナ・所要時間モデル
// ---------------------------------------------------------------------------
const roles = scope.roles ?? [];
const roleIds = new Set(roles.map((r) => r.id));
for (const required of ['RL-READ', 'RL-EXEC', 'RL-SPEC']) {
  if (!roleIds.has(required)) fail('BETA_ROLE_MISSING', `id=${required}`);
}
const questionnaireIds = new Set((scope.questionnaires ?? []).map((q) => q.id));
const effort = scope.effortModel ?? {};

for (const role of roles) {
  if (!role.headcount || role.headcount.minimum < 1) fail('BETA_ROLE_HEADCOUNT', `id=${role.id}`);
  if (role.headcount && role.headcount.minimum > role.headcount.target) {
    fail('BETA_ROLE_HEADCOUNT_ORDER', `id=${role.id} minimum=${role.headcount.minimum} target=${role.headcount.target}`);
  }
  if (!questionnaireIds.has(role.questionnaire)) fail('BETA_ROLE_QUESTIONNAIRE_UNKNOWN', `id=${role.id} questionnaire=${role.questionnaire}`);
  if (!(role.deliverables ?? []).length) fail('BETA_ROLE_DELIVERABLE_MISSING', `id=${role.id}`);
  if (!planText.includes(role.id)) fail('BETA_ROLE_NOT_IN_PLAN', `id=${role.id}`);
  if (!scenarioText.includes(role.id)) fail('BETA_ROLE_NOT_IN_SCENARIOS', `id=${role.id}`);
}

const readerRole = roles.find((r) => r.id === 'RL-READ');
if (readerRole) {
  const expected = totalRequiredMinutes + effort.readingRecordMinutesPerChapter * coreChapters.size;
  if (readerRole.estimatedMinutes !== expected) {
    fail('BETA_ROLE_EFFORT_MISMATCH', `id=RL-READ expected=${expected} actual=${readerRole.estimatedMinutes}`);
  }
  if (readerRole.scope?.requiredSectionCount !== totalRequiredSections) {
    fail('BETA_ROLE_SCOPE_MISMATCH', `id=RL-READ key=requiredSectionCount expected=${totalRequiredSections}`);
  }
  const recorded = [...(readerRole.scope?.recordedChapters ?? [])].sort((a, b) => a - b).join(',');
  if (recorded !== [...coreChapters].sort((a, b) => a - b).join(',')) {
    fail('BETA_ROLE_RECORDED_CHAPTERS_MISMATCH', `id=RL-READ actual=[${recorded}]`);
  }
}

const execRole = roles.find((r) => r.id === 'RL-EXEC');
if (execRole) {
  const tracks = execRole.tracks ?? [];
  if (tracks.length === 0) fail('BETA_TRACK_MISSING');
  const assigned = new Map();
  let totalTrackMinutes = 0;
  for (const track of tracks) {
    const list = track.exercises ?? [];
    for (const id of list) {
      if (assigned.has(id)) fail('BETA_TRACK_EXERCISE_DUPLICATE', `id=${id} tracks=${assigned.get(id)},${track.id}`);
      assigned.set(id, track.id);
      const entry = scopeExercises.find((e) => e.id === id);
      if (entry && entry.track !== track.id) {
        fail('BETA_TRACK_ASSIGNMENT_MISMATCH', `id=${id} entry=${entry.track} track=${track.id}`);
      }
      const source = planById.get(id);
      if (source && !(track.chapters ?? []).includes(source.chapter)) {
        fail('BETA_TRACK_CHAPTER_MISMATCH', `id=${id} chapter=${source.chapter} track=${track.id}`);
      }
    }
    const exerciseMinutes = list.reduce((sum, id) => sum + (planById.get(id)?.minutes ?? 0), 0);
    if (track.exerciseMinutes !== exerciseMinutes) {
      fail('BETA_TRACK_MINUTES_MISMATCH', `track=${track.id} expected=${exerciseMinutes} actual=${track.exerciseMinutes}`);
    }
    const expected = exerciseMinutes + effort.environmentSetupMinutes + effort.exerciseRecordMinutesPerExercise * list.length;
    if (track.estimatedMinutes !== expected) {
      fail('BETA_TRACK_EFFORT_MISMATCH', `track=${track.id} expected=${expected} actual=${track.estimatedMinutes}`);
    }
    totalTrackMinutes += expected;
  }
  for (const id of mandatoryExerciseIds) {
    if (!assigned.has(id)) fail('BETA_TRACK_EXERCISE_UNASSIGNED', `id=${id}`);
  }
  if (execRole.estimatedMinutes !== totalTrackMinutes) {
    fail('BETA_ROLE_EFFORT_MISMATCH', `id=RL-EXEC expected=${totalTrackMinutes} actual=${execRole.estimatedMinutes}`);
  }
}

const specRole = roles.find((r) => r.id === 'RL-SPEC');
const domainIds = new Set();
if (specRole) {
  const domains = specRole.domains ?? [];
  if (domains.length === 0) fail('BETA_DOMAIN_MISSING');
  let totalDomainMinutes = 0;
  for (const domain of domains) {
    domainIds.add(domain.id);
    if (!routeIds.has(domain.route)) fail('BETA_DOMAIN_ROUTE_UNKNOWN', `domain=${domain.id} route=${domain.route}`);
    const route = paths.routes.find((r) => r.id === domain.route);
    if (!route) continue;
    const seen = new Set();
    for (const stage of route.stages) {
      for (const selector of stage.selectors) {
        for (const chapter of selector.chapters ?? []) seen.add(chapter);
        for (const section of selector.sections ?? []) seen.add(Number(section.split('.')[0]));
      }
    }
    const expectedChapters = [...seen].filter((c) => coreChapters.has(c)).sort((a, b) => a - b);
    const actualChapters = [...(domain.chapters ?? [])].sort((a, b) => a - b);
    if (expectedChapters.join(',') !== actualChapters.join(',')) {
      fail('BETA_DOMAIN_CHAPTER_MISMATCH', `domain=${domain.id} expected=[${expectedChapters.join(',')}] actual=[${actualChapters.join(',')}]`);
    }
    const base = expectedChapters.reduce((sum, c) => sum + requiredMinutes.get(c), 0);
    if (domain.baseMinutes !== base) {
      fail('BETA_DOMAIN_BASE_MISMATCH', `domain=${domain.id} expected=${base} actual=${domain.baseMinutes}`);
    }
    const expected = Math.round(base * effort.specialistCloseReadingFactor) + effort.specialistRecordMinutes;
    if (domain.estimatedMinutes !== expected) {
      fail('BETA_DOMAIN_EFFORT_MISMATCH', `domain=${domain.id} expected=${expected} actual=${domain.estimatedMinutes}`);
    }
    totalDomainMinutes += expected;
  }
  if (specRole.estimatedMinutes !== totalDomainMinutes) {
    fail('BETA_ROLE_EFFORT_MISMATCH', `id=RL-SPEC expected=${totalDomainMinutes} actual=${specRole.estimatedMinutes}`);
  }
}

const personas = scope.personas ?? [];
if (personas.length < paths.routes.length) {
  fail('BETA_PERSONA_ROUTE_COVERAGE', `routes=${paths.routes.length} personas=${personas.length}`);
}
const personaRoutes = new Set();
const validLevels = new Set(Object.keys(levels.levels));
const trackIdSet = new Set((execRole?.tracks ?? []).map((t) => t.id));
for (const persona of personas) {
  if (!routeIds.has(persona.route)) fail('BETA_PERSONA_ROUTE_UNKNOWN', `id=${persona.id} route=${persona.route}`);
  personaRoutes.add(persona.route);
  for (const level of persona.levelsInScope ?? []) {
    if (!validLevels.has(level)) fail('BETA_PERSONA_LEVEL_UNKNOWN', `id=${persona.id} level=${level}`);
  }
  if (!(persona.levelsInScope ?? []).includes('required')) {
    fail('BETA_PERSONA_REQUIRED_LEVEL_MISSING', `id=${persona.id}`);
  }
  for (const role of persona.roles ?? []) {
    if (!roleIds.has(role)) fail('BETA_PERSONA_ROLE_UNKNOWN', `id=${persona.id} role=${role}`);
  }
  for (const track of persona.tracks ?? []) {
    if (!trackIdSet.has(track)) fail('BETA_PERSONA_TRACK_UNKNOWN', `id=${persona.id} track=${track}`);
  }
  for (const domain of persona.domains ?? []) {
    if (!domainIds.has(domain)) fail('BETA_PERSONA_DOMAIN_UNKNOWN', `id=${persona.id} domain=${domain}`);
  }
  if (!persona.successCriterion) fail('BETA_PERSONA_SUCCESS_MISSING', `id=${persona.id}`);
  if (!planText.includes(persona.id)) fail('BETA_PERSONA_NOT_IN_PLAN', `id=${persona.id}`);
}
for (const route of routeIds) {
  if (!personaRoutes.has(route)) fail('BETA_PERSONA_ROUTE_UNMAPPED', `route=${route}`);
}

// ---------------------------------------------------------------------------
// 6. 重大度・リリースブロッカー・質問票
// ---------------------------------------------------------------------------
const severities = scope.severities ?? [];
const severityIds = new Set();
const allowedBuckets = new Set(['Urgent', 'High', 'next-version']);
for (const severity of severities) {
  if (severityIds.has(severity.id)) fail('BETA_SEVERITY_DUPLICATE', `id=${severity.id}`);
  severityIds.add(severity.id);
  if (!allowedBuckets.has(severity.ken61Bucket)) {
    fail('BETA_SEVERITY_BUCKET_INVALID', `id=${severity.id} bucket=${severity.ken61Bucket}`);
  }
  if (!['blocking', 'non-blocking'].includes(severity.releaseImpact)) {
    fail('BETA_SEVERITY_IMPACT_INVALID', `id=${severity.id} impact=${severity.releaseImpact}`);
  }
  if (['Urgent', 'High'].includes(severity.ken61Bucket) && severity.releaseImpact !== 'blocking') {
    fail('BETA_SEVERITY_IMPACT_INCONSISTENT', `id=${severity.id} bucket=${severity.ken61Bucket}`);
  }
  if (!(severity.triageBusinessHours > 0)) fail('BETA_SEVERITY_SLA_MISSING', `id=${severity.id}`);
  if (!severity.definition) fail('BETA_SEVERITY_DEFINITION_MISSING', `id=${severity.id}`);
  if (!planText.includes(severity.label)) fail('BETA_SEVERITY_NOT_IN_PLAN', `label=${severity.label}`);
  if (!templateText.includes(severity.label)) fail('BETA_SEVERITY_NOT_IN_TEMPLATES', `label=${severity.label}`);
}
if (!severities.some((s) => s.releaseImpact === 'blocking')) fail('BETA_SEVERITY_NO_BLOCKING');
if (!severities.some((s) => s.releaseImpact === 'non-blocking')) fail('BETA_SEVERITY_NO_NON_BLOCKING');

const releaseBlockers = scope.releaseBlockers ?? [];
if (releaseBlockers.length === 0) fail('BETA_RELEASE_BLOCKER_EMPTY');
const blockerIds = new Set();
for (const blocker of releaseBlockers) {
  if (blockerIds.has(blocker.id)) fail('BETA_RELEASE_BLOCKER_DUPLICATE', `id=${blocker.id}`);
  blockerIds.add(blocker.id);
  if (!severityIds.has(blocker.severity)) fail('BETA_RELEASE_BLOCKER_SEVERITY_UNKNOWN', `id=${blocker.id} severity=${blocker.severity}`);
  for (const key of ['title', 'condition', 'check', 'ken63Gate', 'owner']) {
    if (!blocker[key]) fail('BETA_RELEASE_BLOCKER_FIELD_MISSING', `id=${blocker.id} key=${key}`);
  }
  if (!planText.includes(blocker.id)) fail('BETA_RELEASE_BLOCKER_NOT_IN_PLAN', `id=${blocker.id}`);
}

let declaredQuestions = 0;
for (const questionnaire of scope.questionnaires ?? []) {
  declaredQuestions += questionnaire.questionCount;
  if (!(questionnaire.questionCount > 0)) fail('BETA_QUESTIONNAIRE_EMPTY', `id=${questionnaire.id}`);
  for (const role of questionnaire.roles ?? []) {
    if (!roleIds.has(role)) fail('BETA_QUESTIONNAIRE_ROLE_UNKNOWN', `id=${questionnaire.id} role=${role}`);
  }
  if (!templateText.includes(questionnaire.id)) fail('BETA_QUESTIONNAIRE_NOT_IN_TEMPLATES', `id=${questionnaire.id}`);
  const marker = new RegExp(`^\\|\\s*${questionnaire.id}-\\d+\\s*\\|`, 'gm');
  const found = templateText.match(marker)?.length ?? 0;
  if (found !== questionnaire.questionCount) {
    fail('BETA_QUESTIONNAIRE_COUNT_MISMATCH', `id=${questionnaire.id} declared=${questionnaire.questionCount} found=${found}`);
  }
}

// ---------------------------------------------------------------------------
// 7. 個人情報方針
// ---------------------------------------------------------------------------
const privacy = scope.privacy ?? {};
if (!privacy.principle) fail('BETA_PRIVACY_PRINCIPLE_MISSING');
if (privacy.anonymousId?.inRepository !== false) fail('BETA_PRIVACY_ID_IN_REPOSITORY');
if (!(privacy.collected ?? []).length) fail('BETA_PRIVACY_COLLECTED_EMPTY');
if (!(privacy.notCollected ?? []).length) fail('BETA_PRIVACY_NOT_COLLECTED_EMPTY');
for (const forbidden of ['氏名', 'メールアドレス']) {
  if (!(privacy.notCollected ?? []).some((item) => item.includes(forbidden))) {
    fail('BETA_PRIVACY_FORBIDDEN_ITEM_MISSING', `item=${forbidden}`);
  }
}
for (const item of privacy.collected ?? []) {
  if (!item.item || !item.reason || !item.form) fail('BETA_PRIVACY_COLLECTED_FIELD_MISSING', `item=${item.item}`);
}
if (!(privacy.retention?.rawResponseDays > 0)) fail('BETA_PRIVACY_RETENTION_MISSING');
if (privacy.consentDocument !== DOCUMENTS.templates) {
  fail('BETA_PRIVACY_CONSENT_DOCUMENT', `expected=${DOCUMENTS.templates} actual=${privacy.consentDocument}`);
}
if (!templateText.includes('同意文面')) fail('BETA_PRIVACY_CONSENT_TEXT_MISSING');

// ---------------------------------------------------------------------------
// 8. 文書との相互参照
// ---------------------------------------------------------------------------
for (const number of [...coreChapters].sort((a, b) => a - b)) {
  if (!scenarioText.includes(`第${number}章`)) fail('BETA_CORE_CHAPTER_NOT_IN_SCENARIOS', `chapter=${number}`);
}
for (const id of [...mandatoryExerciseIds].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  if (!scenarioText.includes(`\`${id}\``)) fail('BETA_EXERCISE_NOT_IN_SCENARIOS', `id=${id}`);
}

// ---------------------------------------------------------------------------
// 9. 集計値
// ---------------------------------------------------------------------------
const expectedTotals = {
  chapters: chapterNumbers.length,
  coreChapters: coreChapters.size,
  exerciseOnlyChapters: scopeChapters.filter((c) => c.tier === 'exercise-only').length,
  sampledChapters: scopeChapters.filter((c) => c.tier === 'sampled').length,
  mandatoryExercises: mandatoryExerciseIds.size,
  mandatoryExerciseMinutes: [...mandatoryExerciseIds].reduce((sum, id) => sum + planById.get(id).minutes, 0),
  personas: personas.length,
  roles: roles.length,
  severities: severities.length,
  questions: declaredQuestions,
  releaseBlockers: releaseBlockers.length,
  reviewerTarget: roles.reduce((sum, r) => sum + (r.headcount?.target ?? 0), 0),
  reviewerMinimum: roles.reduce((sum, r) => sum + (r.headcount?.minimum ?? 0), 0),
  scheduleBusinessDays: (scope.schedule ?? []).reduce((sum, p) => sum + p.businessDays, 0)
};
for (const [key, value] of Object.entries(expectedTotals)) {
  if (scope.totals?.[key] !== value) {
    fail('BETA_TOTALS_MISMATCH', `key=${key} expected=${value} actual=${scope.totals?.[key]}`);
  }
}

if ((scope.schedule ?? []).length === 0) fail('BETA_SCHEDULE_EMPTY');

console.log(
  `Beta review scope: chapters=${chapterNumbers.length} (core=${coreChapters.size}, exercise-only=${expectedTotals.exerciseOnlyChapters}, sampled=${expectedTotals.sampledChapters}), ` +
    `exercises=${mandatoryExerciseIds.size} (${expectedTotals.mandatoryExerciseMinutes}分), personas=${personas.length}, roles=${roles.length}, ` +
    `questions=${declaredQuestions}, severities=${severities.length}, releaseBlockers=${releaseBlockers.length}, requiredSections=${totalRequiredSections}`
);
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length > 0) process.exit(1);
