// 模範解答 課題14.6: 日時バグを再現して直す (★★★)
// 本文 14.23 / 14.24 で挙げた誤りのうち4件を、素朴な実装で再現し、
// 修正実装では再現しなくなることを機械的に確かめる。
//
// 前提: プロセスのタイムゾーンに依存しない。すべての変換で timeZone を明示する。

// ---------------------------------------------------------------------------
// 1. 壁時計とオフセットの基礎 (14.23)
// ---------------------------------------------------------------------------

export type Local = { year: number; month: number; day: number; hour: number; minute: number };
export type Wall = Local & { second: number };

const PART_ORDER = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, created);
  return created;
}

/** 指定タイムゾーンにおける壁時計の値を取り出す。 */
export function wallClockParts(instant: Date, timeZone: string): Wall {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const read = (type: (typeof PART_ORDER)[number]): number => {
    const raw = values.get(type);
    if (raw === undefined) throw new Error(`missing part: ${type}`);
    return Number(raw);
  };
  // hourCycle の実装差で 24 が返ることがあるため 0 へ正規化する
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** その瞬間における、そのタイムゾーンの UTC オフセット (分)。 */
export function offsetMinutes(instant: Date, timeZone: string): number {
  const wall = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ローカル日時 + タイムゾーンID → 瞬間。
 * 切り替えの前後2つのオフセットで候補を作り、自分のオフセットと辻褄が合うものだけを残す。
 *  - 候補が2つ残る (二度ある時刻) → 先に訪れるほうを採る
 *  - 候補が0個になる (存在しない時刻) → 切り替え後へ送る
 */
export function resolveInstant(local: Local, timeZone: string): Date {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const before = offsetMinutes(new Date(naive - DAY_MS), timeZone);
  const after = offsetMinutes(new Date(naive + DAY_MS), timeZone);
  const candidates = [...new Set([naive - before * 60000, naive - after * 60000])];
  const valid = candidates.filter(
    (candidate) => offsetMinutes(new Date(candidate), timeZone) === (naive - candidate) / 60000,
  );
  if (valid.length > 0) return new Date(Math.min(...valid));
  return new Date(Math.max(...candidates));
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** そのタイムゾーンにおけるカレンダー日 (YYYY-MM-DD)。 */
export function toPlainDate(instant: Date, timeZone: string): string {
  const wall = wallClockParts(instant, timeZone);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** そのタイムゾーンにおける壁時計 (YYYY-MM-DD HH:mm)。 */
export function formatLocal(instant: Date, timeZone: string): string {
  const wall = wallClockParts(instant, timeZone);
  return `${toPlainDate(instant, timeZone)} ${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** カレンダー日 (YYYY-MM-DD) を n 日進める。壁時計もタイムゾーンも関与しない。 */
export function addCalendarDays(plainDate: string, days: number): string {
  const [year, month, day] = plainDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`invalid plain date: ${plainDate}`);
  }
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(moved.getUTCFullYear(), 4)}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

// ---------------------------------------------------------------------------
// D1. DST をまたぐ毎日の定期実行 (14.24)
// ---------------------------------------------------------------------------

export type DailyRunPlan = {
  timeZone: string;
  /** 実行を始めるカレンダー日 (YYYY-MM-DD) */
  startDate: string;
  /** 現地の希望時刻 */
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

/** 誤り: 初回の瞬間に 24時間 を足し続ける。DST 以降、現地の実行時刻がずれる。 */
export function naiveDailyRuns(plan: DailyRunPlan): Date[] {
  const runs: Date[] = [];
  let cursor = planStart(plan);
  for (let index = 0; index < plan.days; index += 1) {
    runs.push(cursor);
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return runs;
}

/** 修正: カレンダー日を進め、その地域の壁時計として毎回解決し直す。 */
export function fixedDailyRuns(plan: DailyRunPlan): Date[] {
  const { hour, minute } = parseLocalTime(plan.localTime);
  const runs: Date[] = [];
  for (let index = 0; index < plan.days; index += 1) {
    const date = addCalendarDays(plan.startDate, index);
    const [year, month, day] = date.split('-').map(Number);
    if (year === undefined || month === undefined || day === undefined) throw new Error(`invalid date: ${date}`);
    runs.push(resolveInstant({ year, month, day, hour, minute }, plan.timeZone));
  }
  return runs;
}

/** 希望した現地時刻からずれた実行が何日あるか。 */
export function driftingRunCount(runs: Date[], plan: DailyRunPlan): number {
  const expected = plan.localTime;
  return runs.filter((run) => formatLocal(run, plan.timeZone).slice(11) !== expected).length;
}

// ---------------------------------------------------------------------------
// D2. カレンダー日を瞬間として扱う (14.23)
// ---------------------------------------------------------------------------

/** 誤り: 締切日を UTC の 00:00 とみなす。東側の地域では当日の朝から期限切れになる。 */
export function naiveIsOverdue(dueDate: string, now: Date): boolean {
  return now.getTime() >= Date.parse(`${dueDate}T00:00:00Z`);
}

/** 修正: 判定に使う地域の壁時計でカレンダー日を求め、日付どうしを比べる。 */
export function fixedIsOverdue(dueDate: string, now: Date, timeZone: string): boolean {
  return toPlainDate(now, timeZone) > dueDate;
}

// ---------------------------------------------------------------------------
// D3. 24時間の加算とカレンダー加算 (14.23)
// ---------------------------------------------------------------------------

/** 誤り: 「翌日の同じ時刻」を 24時間 の加算で表す。 */
export function naiveNextDaySameTime(instant: Date): Date {
  return new Date(instant.getTime() + 24 * 60 * 60 * 1000);
}

/** 修正: 現地の壁時計を保ったままカレンダー日を1日進める。 */
export function fixedNextDaySameTime(instant: Date, timeZone: string): Date {
  const wall = wallClockParts(instant, timeZone);
  const nextDate = addCalendarDays(`${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`, 1);
  const [year, month, day] = nextDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) throw new Error(`invalid date: ${nextDate}`);
  return resolveInstant({ year, month, day, hour: wall.hour, minute: wall.minute }, timeZone);
}

// ---------------------------------------------------------------------------
// D4. 日次集計の境界 (14.24)
// ---------------------------------------------------------------------------

export type Event = { id: string; at: Date };

/** 誤り: UTC の日境界で数える。利用者の「その日」とずれる。 */
export function naiveCountForDay(events: readonly Event[], plainDate: string): number {
  const start = Date.parse(`${plainDate}T00:00:00Z`);
  const end = Date.parse(`${addCalendarDays(plainDate, 1)}T00:00:00Z`);
  return events.filter((event) => event.at.getTime() >= start && event.at.getTime() < end).length;
}

/** 修正: 判定に使う地域の日境界を半開区間で作る。 */
export function fixedCountForDay(events: readonly Event[], plainDate: string, timeZone: string): number {
  const boundary = (date: string): number => {
    const [year, month, day] = date.split('-').map(Number);
    if (year === undefined || month === undefined || day === undefined) throw new Error(`invalid date: ${date}`);
    return resolveInstant({ year, month, day, hour: 0, minute: 0 }, timeZone).getTime();
  };
  const start = boundary(plainDate);
  const end = boundary(addCalendarDays(plainDate, 1));
  return events.filter((event) => event.at.getTime() >= start && event.at.getTime() < end).length;
}

// ---------------------------------------------------------------------------
// 再現の実行と判定
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'D1' | 'D2' | 'D3' | 'D4';
  label: string;
  /** 素朴な実装での観測値 */
  naive: string;
  /** 修正実装での観測値 */
  fixed: string;
  /** 素朴な実装で誤りが再現したか */
  reproduced: boolean;
  /** 修正実装でも誤りが残っているか */
  remains: boolean;
};

/** 検証に使う固定の条件。現在時刻に依存しない。 */
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
  /** 2026-09-01 11:00 Asia/Tokyo。東京ではまだ締切日の当日である */
  duringDueDate: new Date('2026-09-01T02:00:00Z'),
  /** 2026-10-31 20:00 America/New_York。翌日が DST 終了日にあたる */
  beforeFallBack: new Date('2026-11-01T00:00:00Z'),
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

export function runFindings(): Finding[] {
  const plan = FIXTURES.springPlan;
  const naiveDrift = driftingRunCount(naiveDailyRuns(plan), plan);
  const fixedDrift = driftingRunCount(fixedDailyRuns(plan), plan);

  const naiveOverdue = naiveIsOverdue(FIXTURES.dueDate, FIXTURES.duringDueDate);
  const fixedOverdue = fixedIsOverdue(FIXTURES.dueDate, FIXTURES.duringDueDate, FIXTURES.plainZone);

  const naiveNext = formatLocal(naiveNextDaySameTime(FIXTURES.beforeFallBack), FIXTURES.dstZone);
  const fixedNext = formatLocal(fixedNextDaySameTime(FIXTURES.beforeFallBack, FIXTURES.dstZone), FIXTURES.dstZone);
  const baseTime = formatLocal(FIXTURES.beforeFallBack, FIXTURES.dstZone).slice(11);

  const naiveCount = naiveCountForDay(FIXTURES.events, FIXTURES.dueDate);
  const fixedCount = fixedCountForDay(FIXTURES.events, FIXTURES.dueDate, FIXTURES.plainZone);

  return [
    {
      id: 'D1',
      label: 'dst-skipped-run',
      naive: `drift days=${naiveDrift}`,
      fixed: `drift days=${fixedDrift}`,
      // 修正版でも切り替え日の1件は動く。素朴な実装はそれ以降ずっとずれる
      reproduced: naiveDrift > fixedDrift,
      remains: fixedDrift > 1,
    },
    {
      id: 'D2',
      label: 'calendar-day-as-instant',
      naive: `overdue=${naiveOverdue}`,
      fixed: `overdue=${fixedOverdue}`,
      reproduced: naiveOverdue,
      remains: fixedOverdue,
    },
    {
      id: 'D3',
      label: 'add-24h-vs-add-1-day',
      naive: `local=${naiveNext}`,
      fixed: `local=${fixedNext}`,
      reproduced: naiveNext.slice(11) !== baseTime,
      remains: fixedNext.slice(11) !== baseTime,
    },
    {
      id: 'D4',
      label: 'daily-bucket-boundary',
      naive: `count=${naiveCount}`,
      fixed: `count=${fixedCount}`,
      reproduced: naiveCount !== fixedCount,
      remains: fixedCount !== 4,
    },
  ];
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
