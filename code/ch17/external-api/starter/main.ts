// Starter for 17.6 課題17.6: 外部API連携の障害を再現して耐える (★★★)
// Purpose: 本文 17.15 の時間予算・リトライ・Circuit Breaker と、17.14 の抑制リストと
//          冪等キーを実装し、素朴な呼び出しとの差を数値で確かめる。
//
// 手順:
//   1. VirtualClock と FakeProvider を読み、仮想時刻で待つ仕組みを掴む。
//   2. budgetFor を実装する。残り時間が尽きていたら DeadlineExceededError を投げる。
//   3. retrying を実装する。再試行可否、Retry-After、完全ジッタ、予算の4点を扱う。
//   4. CircuitBreaker を実装する。判定窓・最小件数・冷却時間・half-open の1本を守る。
//   5. MailSender の resilient 経路を実装し、runFindings を通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch17 exec tsx external-api/starter/report.ts
//
// 注意: 実時間の待機を使わない。すべての待機は VirtualClock 上で行うこと。
//
// すべての待機は VirtualClock 上で行う。実時間の sleep を使わないため、実行は一瞬で終わる。

export class TimeoutError extends Error {}
export class DeadlineExceededError extends Error {}
export class CircuitOpenError extends Error {}
export class UpstreamError extends Error {
  constructor(readonly status: number, readonly retryAfterMs: number | null) {
    super(`upstream ${status}`);
  }
}

export type Mode = 'naive' | 'resilient';

// ---------------------------------------------------------------------------
// 1. 仮想時計
// ---------------------------------------------------------------------------

/**
 * 単一の論理スレッドで動く仮想時計。
 * sleep も呼び出し待ちも「時刻を進める」だけなので、指数バックオフを一瞬で観察できる。
 */
export class VirtualClock {
  constructor(public now = 0) {}
  advance(ms: number): void {
    this.now += ms;
  }
  sleep(ms: number): void {
    this.advance(ms);
  }
}

export type Deadline = { readonly at: number };

export const deadlineFrom = (clock: VirtualClock, ms: number): Deadline => ({ at: clock.now + ms });

/**
 * TODO: 残り時間 (deadline.at - clock.now) の share 倍を、cap を上限として割り当てる。
 * 残り時間が尽きていれば、呼び出さずに DeadlineExceededError を投げる。
 */
export function budgetFor(clock: VirtualClock, deadline: Deadline, share: number, cap: number): number {
  void clock;
  void deadline;
  void share;
  return cap;
}

// ---------------------------------------------------------------------------
// 2. 外部サービスの模擬
// ---------------------------------------------------------------------------

export type Behavior = { latencyMs: number; status: number; retryAfterMs?: number };

/** 決まった振る舞いを返す外部サービス。呼び出し回数を数える。 */
export class FakeProvider {
  calls = 0;
  /** 実際に応答を返した (=上流を待たせた) 回数 */
  upstreamWaits = 0;

  constructor(private readonly behavior: Behavior) {}

  /** timeoutMs が null なら無制限。呼び出しは仮想時刻を進める。 */
  invoke(clock: VirtualClock, timeoutMs: number | null): Behavior {
    this.calls += 1;
    if (timeoutMs !== null && this.behavior.latencyMs > timeoutMs) {
      clock.advance(timeoutMs);
      throw new TimeoutError(`timed out after ${timeoutMs}ms`);
    }
    clock.advance(this.behavior.latencyMs);
    this.upstreamWaits += 1;
    if (this.behavior.status >= 400) {
      throw new UpstreamError(this.behavior.status, this.behavior.retryAfterMs ?? null);
    }
    return this.behavior;
  }
}

// ---------------------------------------------------------------------------
// 3. リトライ
// ---------------------------------------------------------------------------

/** 全体の再試行量に上限を置く。個々の呼び出しの回数とは別に持つ。 */
export class RetryBudget {
  used = 0;
  constructor(readonly limit: number) {}
  tryConsume(): boolean {
    if (this.used >= this.limit) return false;
    this.used += 1;
    return true;
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof TimeoutError) return true;
  if (error instanceof UpstreamError) return error.status === 429 || error.status >= 500;
  return false;
}

export type Rand = () => number;

/**
 * 再試行可否の判定、Retry-After の尊重、完全ジッタ付き指数バックオフ、
 * リトライ予算の消費をまとめて行う。
 */
export function retrying<T>(
  clock: VirtualClock,
  deadline: Deadline,
  budget: RetryBudget,
  rand: Rand,
  attempt: (timeoutMs: number) => T,
): T {
  // TODO: 次の順で組む。
  //   1. budgetFor で1回分のタイムアウトを決め、attempt へ渡す
  //   2. 失敗したら isRetryable で再試行可否を判定する
  //   3. budget.tryConsume() が false なら、その場で失敗させる
  //   4. UpstreamError の retryAfterMs があれば、それを待ち時間として優先する
  //   5. 無ければ [0, min(200 * 2 ** i, 20000)) の一様乱数を待ち時間にする (完全ジッタ)
  //   6. 待ち終えると deadline を超える場合は DeadlineExceededError を投げる
  void deadline;
  void budget;
  void rand;
  return attempt(1_000);
}

/** 誤り: 予算もジッタも持たず、固定間隔で決め打ちの回数だけ再試行する。 */
export function naiveRetrying<T>(clock: VirtualClock, attempts: number, attempt: () => T): T {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return attempt();
    } catch (error) {
      last = error;
      clock.sleep(100);
    }
  }
  throw last;
}

// ---------------------------------------------------------------------------
// 4. サーキットブレーカ
// ---------------------------------------------------------------------------

export type BreakerState = 'closed' | 'open' | 'half-open';

export type BreakerOptions = {
  windowSize: number;
  minimumCalls: number;
  failureThreshold: number;
  cooldownMs: number;
};

export class CircuitBreaker {
  private window: boolean[] = []; // true = 失敗
  private openedAt = 0;
  private probeInFlight = false;
  state: BreakerState = 'closed';
  shortCircuited = 0;

  constructor(private readonly options: BreakerOptions) {}

  /** 4xx は失敗として数えない。こちらの入力誤りで相手を遮断しないため。 */
  private countsAsFailure(error: unknown): boolean {
    if (error instanceof TimeoutError) return true;
    if (error instanceof UpstreamError) return error.status >= 500;
    return false;
  }

  private refreshState(now: number): void {
    if (this.state === 'open' && now - this.openedAt >= this.options.cooldownMs) {
      this.state = 'half-open';
      this.probeInFlight = false;
    }
  }

  execute<T>(clock: VirtualClock, call: () => T): T {
    // TODO: 次の順で組む。
    //   1. 冷却時間が過ぎていれば open から half-open へ移す
    //   2. open のとき、あるいは half-open で試験呼び出しが通過中のときは
    //      call を呼ばずに CircuitOpenError を投げ、shortCircuited を数える
    //   3. 成功したら closed へ戻し、判定窓を空にする
    //   4. countsAsFailure が真の失敗だけを窓へ積む (4xx は数えない)
    return call();
  }

  private onSuccess(): void {
    this.probeInFlight = false;
    this.state = 'closed';
    this.window = [];
  }

  private onFailure(now: number): void {
    // TODO: half-open での失敗は即座に open へ戻す。
    //       closed では窓へ積み、windowSize を超えたら先頭を捨てる。
    //       窓の件数が minimumCalls 以上で、失敗数が failureThreshold 以上なら open にする。
    void now;
  }
}

// ---------------------------------------------------------------------------
// 5. メール送信 (17.14)
// ---------------------------------------------------------------------------

export type MailJob = { dedupeKey: string; to: string };
export type BounceEvent = { address: string; kind: 'hard_bounce' | 'complaint' };

export class MailSender {
  readonly suppression = new Set<string>();
  /** 冪等キーの台帳。送信の「前」に確保する。 */
  readonly sent = new Map<string, string>();
  /** 実際には配送できない宛先。抑制漏れを外から数えるためだけに使う。 */
  readonly knownBad: Set<string>;
  delivered = 0;
  suppressedHits = 0;

  constructor(readonly mode: Mode, knownBad: Iterable<string> = []) {
    this.knownBad = new Set(knownBad);
  }

  /** 誤り: naive はバウンスイベントを取り込まないため、抑制リストが空のままになる。 */
  applyBounce(event: BounceEvent): void {
    if (this.mode === 'naive') return;
    this.suppression.add(event.address);
  }

  send(job: MailJob): { skipped: boolean; reason?: string } {
    if (this.mode === 'resilient') {
      // TODO: 抑制リストの照合を先に行い、次に冪等キーを「送信前に」確保してから deliver する。
      this.deliver(job);
      return { skipped: false };
    }
    // 誤り: 抑制を見ず、冪等キーを送信後に書く。
    this.deliver(job);
    this.sent.set(job.dedupeKey, job.to);
    return { skipped: false };
  }

  private deliver(job: MailJob): void {
    this.delivered += 1;
    if (this.knownBad.has(job.to)) this.suppressedHits += 1;
  }
}

// ---------------------------------------------------------------------------
// 6. 固定の条件
// ---------------------------------------------------------------------------

export const FIXTURES = {
  /** E1: 30秒間応答しない相手 */
  hanging: { latencyMs: 30_000, status: 200 } satisfies Behavior,
  hangingDeadlineMs: 3_000,
  /** E2: 常に 503 を返す相手 */
  flapping: { latencyMs: 50, status: 503 } satisfies Behavior,
  naiveAttempts: 64,
  retryBudgetLimit: 5,
  retryDeadlineMs: 600_000,
  /** E3: 恒久的に 500 を返す相手へ12回要求する */
  broken: { latencyMs: 800, status: 500 } satisfies Behavior,
  requestCount: 12,
  requestIntervalMs: 100,
  breaker: { windowSize: 10, minimumCalls: 3, failureThreshold: 3, cooldownMs: 60_000 } satisfies BreakerOptions,
  /** E4: 同じ冪等キーの再試行と、バウンス済み宛先への送信 */
  bounce: { address: 'bounced@example.test', kind: 'hard_bounce' } satisfies BounceEvent,
  mailJobs: [
    { dedupeKey: 'welcome:u1', to: 'alice@example.test' },
    { dedupeKey: 'welcome:u1', to: 'alice@example.test' }, // ジョブのリトライ
    { dedupeKey: 'welcome:u2', to: 'bounced@example.test' },
  ] satisfies MailJob[],
  /** 完全ジッタ用の固定乱数列。テストを決定的にする。 */
  randSequence: [0.5, 0.25, 0.75, 0.1, 0.9, 0.3, 0.6, 0.4],
} as const;

const fixedRand = (): Rand => {
  let index = 0;
  return () => FIXTURES.randSequence[index++ % FIXTURES.randSequence.length]!;
};

// ---------------------------------------------------------------------------
// 7. 4件の再現
// ---------------------------------------------------------------------------

/** E1: タイムアウトを設定しないと、応答しない相手に予算を使い切られる。 */
export function probeTimeout(mode: Mode): { elapsed: number; budget: number } {
  const clock = new VirtualClock(0);
  const provider = new FakeProvider(FIXTURES.hanging);
  const deadline = deadlineFrom(clock, FIXTURES.hangingDeadlineMs);
  let budget = 0;
  try {
    if (mode === 'naive') {
      provider.invoke(clock, null); // 誤り: 無制限
    } else {
      budget = budgetFor(clock, deadline, 0.4, 3_000);
      provider.invoke(clock, budget);
    }
  } catch {
    /* 記録は経過時間で行う */
  }
  return { elapsed: clock.now, budget };
}

/** E2: 予算とジッタがないと、再試行が跳ね上がる。 */
export function probeRetryStorm(mode: Mode): { calls: number } {
  const clock = new VirtualClock(0);
  const provider = new FakeProvider(FIXTURES.flapping);
  try {
    if (mode === 'naive') {
      naiveRetrying(clock, FIXTURES.naiveAttempts, () => provider.invoke(clock, 1_000));
    } else {
      const deadline = deadlineFrom(clock, FIXTURES.retryDeadlineMs);
      const budget = new RetryBudget(FIXTURES.retryBudgetLimit);
      retrying(clock, deadline, budget, fixedRand(), (timeoutMs) => provider.invoke(clock, timeoutMs));
    }
  } catch {
    /* 失敗は想定どおり */
  }
  return { calls: provider.calls };
}

/** E3: ブレーカがないと、恒久障害でも全要求が相手を待つ。 */
export function probeBreaker(mode: Mode): { upstreamWaits: number; shortCircuited: number; state: BreakerState } {
  const clock = new VirtualClock(0);
  const provider = new FakeProvider(FIXTURES.broken);
  const breaker = new CircuitBreaker(FIXTURES.breaker);
  for (let i = 0; i < FIXTURES.requestCount; i += 1) {
    try {
      if (mode === 'naive') provider.invoke(clock, 1_000);
      else breaker.execute(clock, () => provider.invoke(clock, 1_000));
    } catch {
      /* 失敗は想定どおり */
    }
    clock.advance(FIXTURES.requestIntervalMs);
  }
  return { upstreamWaits: provider.upstreamWaits, shortCircuited: breaker.shortCircuited, state: breaker.state };
}

/** E4: 冪等キーを送信後に書き、バウンスを無視すると、二重送信と抑制漏れが起きる。 */
export function probeMail(mode: Mode): { delivered: number; suppressedHits: number } {
  const sender = new MailSender(mode, [FIXTURES.bounce.address]);
  sender.applyBounce(FIXTURES.bounce);
  for (const job of FIXTURES.mailJobs) sender.send(job);
  return { delivered: sender.delivered, suppressedHits: sender.suppressedHits };
}

export type Finding = {
  id: 'E1' | 'E2' | 'E3' | 'E4';
  label: string;
  naive: string;
  resilient: string;
  reproduced: boolean;
  remains: boolean;
};

/**
 * TODO: 4件について、naive と resilient の観測値を集めて Finding を組み立てる。
 * reproduced は「naive で失敗が再現したか」、remains は「resilient にも残るか」。
 * 期待値をここへ直書きせず、probe* の戻り値から導くこと。
 */
export function runFindings(): Finding[] {
  return [];
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  return [
    `naive integration: ${reproduced}/${findings.length} failures reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / resilient ${finding.resilient}`),
    `resilient integration: ${remaining}/${findings.length} failures remaining`,
  ];
}
