// Starter for 14.6 課題14.6: 日時バグを再現して直す (★★★)
// Purpose: DST 境界・カレンダー日と瞬間の混同・日境界のずれが起こす4つの誤りを、
//          素朴な実装で再現し、修正実装では再現しなくなることを機械的に確かめる。
//
// 手順:
//   1. 本文 14.23 を読み、瞬間・ローカル日時・カレンダー日の3種類を区別する。
//   2. resolveInstant / toPlainDate / addCalendarDays を実装する。ここが全体の土台になる。
//   3. naive* の4つは「よくある誤り」として与えてある。読んで、どこが誤りかを言葉にする。
//   4. fixed* の4つを実装する。naive* と同じ入力で結果が変わることを確かめる。
//   5. runFindings が naive 4/4 reproduced、fixed 0/4 remaining を返すところまで通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch14 exec tsx datetime-pitfalls/starter/report.ts
//
// 注意: プロセスのタイムゾーンに依存してはならない。すべての変換で timeZone を明示する。

// ---------------------------------------------------------------------------
// 1. 壁時計とオフセットの基礎 (14.23)
// ---------------------------------------------------------------------------

export type Local = { year: number; month: number; day: number; hour: number; minute: number };
export type Wall = Local & { second: number };

const PART_ORDER = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

/** 与えてある: 指定タイムゾーンにおける壁時計の値を取り出す。 */
export function wallClockParts(instant: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const read = (type: (typeof PART_ORDER)[number]): number => {
    const raw = values.get(type);
    if (raw === undefined) throw new Error(`missing part: ${type}`);
    return Number(raw);
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24, // hourCycle の実装差で 24 が返ることがある
    minute: read('minute'),
    second: read('second'),
  };
}

/** 与えてある: その瞬間における、そのタイムゾーンの UTC オフセット (分)。 */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const wall = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

/**
 * TODO: ローカル日時 + タイムゾーンID → 瞬間。
 * 答えのオフセットが答えそのものに依存するため、1回の計算では決まらない。
 * 前後1日のオフセットで候補を2つ作り、「候補の実際のオフセットが、候補を作るのに
 * 使ったオフセットと一致するか」で妥当性を判定する。
 * 候補が2つ妥当なら二度ある時刻、0個なら存在しない時刻である。
 * ここでは前者を先に訪れるほう、後者を切り替え後へ送る規則とする。
 */
export function resolveInstant(local: Local, timeZone: string): Date {
  void timeZone;
  // 誤り: オフセットを無視している。DST のある地域では最大1時間ずれる
  return new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute));
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** TODO: そのタイムゾーンにおけるカレンダー日 (YYYY-MM-DD) を返す。 */
export function toPlainDate(instant: Date, timeZone: string): string {
  void timeZone;
  // 誤り: UTC の日付を返している
  return instant.toISOString().slice(0, 10);
}

/** 与えてある: そのタイムゾーンにおける壁時計 (YYYY-MM-DD HH:mm)。 */
export function formatLocal(instant: Date, timeZone: string): string {
  const wall = wallClockParts(instant, timeZone);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)} ${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** TODO: カレンダー日 (YYYY-MM-DD) を n 日進める。壁時計もタイムゾーンも関与しない。 */
export function addCalendarDays(plainDate: string, days: number): string {
  void days;
  return plainDate;
}

// ---------------------------------------------------------------------------
// D1. DST をまたぐ毎日の定期実行 (14.24)
// ---------------------------------------------------------------------------

export type DailyRunPlan = {
  timeZone: string;
  startDate: string;
  localTime: string;
  days: number;
};

function parseLocalTime(localTime: string): { hour: number; minute: number } {
  const [hour, minute] = localTime.split(':').map(Number);
  if (hour === undefined || minute === undefined) throw new Error(`invalid local time: ${localTime}`);
  return { hour, minute };
}

function planStart(plan: DailyRunPlan): Date {
  const [year, month, day] = plan.startDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid start date: ${plan.startDate}`);
  }
  const { hour, minute } = parseLocalTime(plan.localTime);
  return resolveInstant({ year, month, day, hour, minute }, plan.timeZone);
}

/** 与えてある誤り: 初回の瞬間に 24時間 を足し続ける。 */
export function naiveDailyRuns(plan: DailyRunPlan): Date[] {
  const runs: Date[] = [];
  let cursor = planStart(plan);
  for (let index = 0; index < plan.days; index += 1) {
    runs.push(cursor);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return runs;
}

/** TODO: カレンダー日を進め、その地域の壁時計として毎回解決し直す。 */
export function fixedDailyRuns(plan: DailyRunPlan): Date[] {
  return naiveDailyRuns(plan);
}

/** TODO: 希望した現地時刻からずれた実行が何日あるかを数える。 */
export function driftingRunCount(runs: Date[], plan: DailyRunPlan): number {
  void runs;
  void plan;
  return 0;
}

// ---------------------------------------------------------------------------
// D2. カレンダー日を瞬間として扱う (14.23)
// ---------------------------------------------------------------------------

/** 与えてある誤り: 締切日を UTC の 00:00 とみなす。 */
export function naiveIsOverdue(dueDate: string, now: Date): boolean {
  return now.getTime() >= Date.parse(`${dueDate}T00:00:00Z`);
}

/** TODO: 判定に使う地域の壁時計でカレンダー日を求め、日付どうしを比べる。 */
export function fixedIsOverdue(dueDate: string, now: Date, timeZone: string): boolean {
  void timeZone;
  return naiveIsOverdue(dueDate, now);
}

// ---------------------------------------------------------------------------
// D3. 24時間の加算とカレンダー加算 (14.23)
// ---------------------------------------------------------------------------

/** 与えてある誤り: 「翌日の同じ時刻」を 24時間 の加算で表す。 */
export function naiveNextDaySameTime(instant: Date): Date {
  return new Date(instant.getTime() + 24 * 60 * 60 * 1000);
}

/** TODO: 現地の壁時計を保ったままカレンダー日を1日進める。 */
export function fixedNextDaySameTime(instant: Date, timeZone: string): Date {
  void timeZone;
  return naiveNextDaySameTime(instant);
}

// ---------------------------------------------------------------------------
// D4. 日次集計の境界 (14.24)
// ---------------------------------------------------------------------------

export type Event = { id: string; at: Date };

/** 与えてある誤り: UTC の日境界で数える。 */
export function naiveCountForDay(events: readonly Event[], plainDate: string): number {
  const start = Date.parse(`${plainDate}T00:00:00Z`);
  const end = start + 24 * 60 * 60 * 1000;
  return events.filter((event) => event.at.getTime() >= start && event.at.getTime() < end).length;
}

/** TODO: 判定に使う地域の日境界を半開区間で作る。 */
export function fixedCountForDay(events: readonly Event[], plainDate: string, timeZone: string): number {
  void timeZone;
  return naiveCountForDay(events, plainDate);
}

// ---------------------------------------------------------------------------
// 再現の実行と判定
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'D1' | 'D2' | 'D3' | 'D4';
  label: string;
  naive: string;
  fixed: string;
  reproduced: boolean;
  remains: boolean;
};

/** 与えてある: 検証に使う固定の条件。現在時刻に依存しない。 */
export const FIXTURES = {
  dstZone: 'America/New_York',
  plainZone: 'Asia/Tokyo',
  springPlan: {
    timeZone: 'America/New_York',
    startDate: '2026-03-06',
    localTime: '02:30',
    days: 5,
  } satisfies DailyRunPlan,
  dueDate: '2026-09-01',
  duringDueDate: new Date('2026-09-01T02:00:00Z'), // 09-01 11:00 JST
  beforeFallBack: new Date('2026-11-01T00:00:00Z'), // 10-31 20:00 America/New_York
  events: [
    { id: 'e1', at: new Date('2026-08-31T14:00:00Z') }, // 08-31 23:00 JST / 08-31 UTC
    { id: 'e2', at: new Date('2026-08-31T18:00:00Z') }, // 09-01 03:00 JST / 08-31 UTC
    { id: 'e3', at: new Date('2026-08-31T20:00:00Z') }, // 09-01 05:00 JST / 08-31 UTC
    { id: 'e4', at: new Date('2026-09-01T02:00:00Z') }, // 09-01 11:00 JST / 09-01 UTC
    { id: 'e5', at: new Date('2026-09-01T09:00:00Z') }, // 09-01 18:00 JST / 09-01 UTC
    { id: 'e6', at: new Date('2026-09-01T16:00:00Z') }, // 09-02 01:00 JST / 09-01 UTC
    { id: 'e7', at: new Date('2026-09-02T01:00:00Z') }, // 09-02 10:00 JST / 09-02 UTC
  ] satisfies Event[],
} as const;

/**
 * TODO: 4つの誤りについて、素朴な実装と修正実装の観測値を集める。
 * reproduced は「素朴な実装で誤りが再現したか」、remains は「修正実装にも誤りが残るか」。
 * 期待値をここへ直書きせず、naive* と fixed* の結果の差から判定すること。
 */
export function runFindings(): Finding[] {
  return [];
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  return [
    `naive implementation: ${reproduced}/${findings.length} bugs reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / fixed ${finding.fixed}`),
    `fixed implementation: ${remaining}/${findings.length} bugs remaining`,
  ];
}
