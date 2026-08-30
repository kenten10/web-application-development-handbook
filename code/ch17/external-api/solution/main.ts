// 模範解答 for 17.6 課題17.6: 外部API連携の障害を再現して耐える (★★★)
// 本文 17.15 の時間予算・リトライ・Circuit Breaker と、17.14 の抑制リストと冪等キーを
// 動くコードとして示す。
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

/** 残り時間の一部を1回の呼び出しへ割り当てる。上限も置く。 */
export function budgetFor(clock: VirtualClock, deadline: Deadline, share: number, cap: number): number {
  const remaining = deadline.at - clock.now;
  if (remaining <= 0) throw new DeadlineExceededError('no time left');
  return Math.max(1, Math.min(cap, Math.floor(remaining * share)));
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
  const base = 200;
  for (let i = 0; ; i += 1) {
    const timeoutMs = budgetFor(clock, deadline, 0.4, 3_000);
    try {
      return attempt(timeoutMs);
    } catch (error) {
      if (!isRetryable(error)) throw error;
      if (!budget.tryConsume()) throw error;
      const hint = error instanceof UpstreamError ? error.retryAfterMs : null;
      // 完全ジッタ: [0, backoff) の一様乱数。固定待ちだと再試行が同じ瞬間へ揃う。
      const ceiling = Math.min(base * 2 ** i, 20_000);
      const backoff = hint ?? Math.floor(rand() * ceiling);
      if (clock.now + backoff >= deadline.at) throw new DeadlineExceededError('deadline reached');
      clock.sleep(backoff);
    }
  }
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
    this.refreshState(clock.now);
    if (this.state === 'open' || (this.state === 'half-open' && this.probeInFlight)) {
      this.shortCircuited += 1;
      throw new CircuitOpenError('circuit is open');
    }
    if (this.state === 'half-open') this.probeInFlight = true;
    try {
      const value = call();
      this.onSuccess();
      return value;
    } catch (error) {
      if (this.countsAsFailure(error)) this.onFailure(clock.now);
      else this.probeInFlight = false;
      throw error;
    }
  }

  private onSuccess(): void {
    this.probeInFlight = false;
    this.state = 'closed';
    this.window = [];
  }

  private onFailure(now: number): void {
    this.probeInFlight = false;
    if (this.state === 'half-open') {
      this.state = 'open';
      this.openedAt = now;
      return;
    }
    this.window.push(true);
    if (this.window.length > this.options.windowSize) this.window.shift();
    const failures = this.window.filter(Boolean).length;
    if (this.window.length >= this.options.minimumCalls && failures >= this.options.failureThreshold) {
      this.state = 'open';
      this.openedAt = now;
    }
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
      if (this.suppression.has(job.to)) return { skipped: true, reason: 'suppressed' };
      // 冪等キーは送信「前」に確保する。送信後に書くと、その間で落ちたとき二重に届く。
      if (this.sent.has(job.dedupeKey)) return { skipped: true, reason: 'already sent' };
      this.sent.set(job.dedupeKey, job.to);
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

export function runFindings(): Finding[] {
  const timeout = { naive: probeTimeout('naive'), resilient: probeTimeout('resilient') };
  const storm = { naive: probeRetryStorm('naive'), resilient: probeRetryStorm('resilient') };
  const breaker = { naive: probeBreaker('naive'), resilient: probeBreaker('resilient') };
  const mail = { naive: probeMail('naive'), resilient: probeMail('resilient') };
  const maxCalls = FIXTURES.retryBudgetLimit + 1;

  return [
    {
      id: 'E1',
      label: 'no-timeout',
      naive: `elapsed=${timeout.naive.elapsed}ms`,
      resilient: `elapsed=${timeout.resilient.elapsed}ms (budget=${timeout.resilient.budget}ms)`,
      // 予算を超えて相手を待ったら再現。
      reproduced: timeout.naive.elapsed > FIXTURES.hangingDeadlineMs,
      remains: timeout.resilient.elapsed > FIXTURES.hangingDeadlineMs,
    },
    {
      id: 'E2',
      label: 'retry-storm',
      naive: `calls=${storm.naive.calls}`,
      resilient: `calls=${storm.resilient.calls} (limit=${maxCalls})`,
      reproduced: storm.naive.calls > maxCalls,
      remains: storm.resilient.calls > maxCalls,
    },
    {
      id: 'E3',
      label: 'no-breaker',
      naive: `upstream-waits=${breaker.naive.upstreamWaits}`,
      resilient: `upstream-waits=${breaker.resilient.upstreamWaits} (short-circuited=${breaker.resilient.shortCircuited}, state=${breaker.resilient.state})`,
      reproduced: breaker.naive.upstreamWaits >= FIXTURES.requestCount,
      remains: breaker.resilient.upstreamWaits >= FIXTURES.requestCount,
    },
    {
      id: 'E4',
      label: 'duplicate-mail',
      naive: `delivered=${mail.naive.delivered} suppressed-hits=${mail.naive.suppressedHits}`,
      resilient: `delivered=${mail.resilient.delivered} suppressed-hits=${mail.resilient.suppressedHits}`,
      // 冪等キーの数だけ届くのが正しい。それを超えたら、あるいは抑制漏れがあれば再現。
      reproduced: mail.naive.delivered > 1 || mail.naive.suppressedHits > 0,
      remains: mail.resilient.delivered > 1 || mail.resilient.suppressedHits > 0,
    },
  ];
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
