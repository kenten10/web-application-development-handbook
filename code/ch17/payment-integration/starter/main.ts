// Starter for 17.7 課題17.7: 決済連携の二重課金・返金超過・突合欠如を再現して塞ぐ (★★★)
// 本文 17.16 (決済連携の実務) と 27.18 (金額と通貨の表現) の判断を、
// 実在の決済事業者へ接続せずプロセス内で再現する。
//
// 安全上の注意: ここに実在の決済事業者の鍵・エンドポイント・カード情報は一切含まれない。
//               FakeGateway はメモリ上の模擬であり、ネットワークへ出ない。
//               実際の決済 API を試す場合は必ずテスト環境の鍵だけを使う (17.16)。
//
// 手順:
//   1. naiveAllocate / naiveCharge / checkRefundAllowed を読み、4つの欠陥を言葉にする。
//   2. allocate を実装する。合計が必ず元の金額と一致することが唯一の制約である (27.18)。
//   3. applyRate を実装する。浮動小数点数を経由しない。
//   4. fixedCharge を実装する。鍵を業務上の一意な値から導き、送信前に永続化する (17.16)。
//   5. Ledger.tryAddRefund を実装する。上限の検査と反映を同じ操作にまとめる。
//   6. reconcile を実装する。金額は最小単位の整数どうしで比べる。
//   7. runFindings を実装し、report.ts を通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch17 exec tsx payment-integration/starter/report.ts
//
// 注意: 期待値を runFindings へ直書きしない。各関数の戻り値だけから導くこと。

// ---------------------------------------------------------------------------
// 1. 金額 ― 最小単位の整数で持つ (27.18)
// ---------------------------------------------------------------------------

/** 通貨ごとの小数桁 (ISO 4217)。コードの分岐にせず表として持つ。 */
export const MINOR_UNITS: Readonly<Record<string, number>> = { JPY: 0, USD: 2, KWD: 3 };

export type Money = { minor: bigint; currency: string };

export function money(minor: bigint | number, currency: string): Money {
  if (!(currency in MINOR_UNITS)) throw new RangeError(`unknown currency: ${currency}`);
  return { minor: typeof minor === 'bigint' ? minor : BigInt(minor), currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new TypeError('currency mismatch');
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function formatMinor(value: Money): string {
  return `${value.minor}${value.currency}`;
}

/**
 * 割合を分子・分母で受け取り、最後に一度だけ丸める。
 * 浮動小数点数を経由しないため、税率のような値でも誤差が入らない。
 */
export function applyRate(base: Money, numerator: bigint, denominator: bigint): Money {
  // TODO: base.minor * numerator を denominator で割り、余りから四捨五入の向きを決める。
  //       bigint の除算は 0 方向への切り捨てである点に注意する。
  void numerator;
  void denominator;
  return base;
}

/** 合計が必ず元の金額と一致する配分 (27.18)。切り捨てて配り、余りを1ずつ配り直す。 */
export function allocate(total: Money, weights: readonly bigint[]): Money[] {
  // TODO: まず切り捨てで配り、残った端数を1最小単位ずつ配り直す。
  //       戻り値の合計が total.minor と必ず一致することが制約である。
  void weights;
  return [total];
}

/** よくある誤り。主単位の浮動小数点数で計算し、最後に整数へ丸める。 */
export function naiveAllocate(totalMinor: number, weights: readonly number[], currency: string): number[] {
  const digits = MINOR_UNITS[currency] ?? 2;
  const major = totalMinor / 10 ** digits;
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight) => Math.round((major * (weight / sum)) * 10 ** digits));
}

// ---------------------------------------------------------------------------
// 2. 模擬決済事業者
// ---------------------------------------------------------------------------

export type RemotePayment = { id: string; amount: Money; state: 'succeeded' | 'failed'; refunded: bigint };

export type GatewayBehaviour = {
  /** この回数目までの呼び出しは「相手には届くが応答が返らない」。 */
  swallowResponsesUntil: number;
};

export class TimeoutError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`gateway timeout (key=${idempotencyKey})`);
    this.name = 'TimeoutError';
  }
}

export class FakeGateway {
  readonly payments = new Map<string, RemotePayment>();
  private readonly byKey = new Map<string, string>();
  private calls = 0;
  /** Webhook として送り出したイベント。欠落を作るために間引ける。 */
  readonly outbox: Array<{ id: string; paymentId: string; state: RemotePayment['state'] }> = [];

  constructor(private readonly behaviour: GatewayBehaviour = { swallowResponsesUntil: 0 }) {}

  createPayment(input: { idempotencyKey: string; amount: Money }): RemotePayment {
    this.calls += 1;
    const existing = this.byKey.get(input.idempotencyKey);
    // 同じ鍵で来た要求は、同じ取引として扱う
    const payment: RemotePayment = existing
      ? this.payments.get(existing)!
      : { id: `pi_${this.payments.size + 1}`, amount: input.amount, state: 'succeeded', refunded: 0n };
    if (!existing) {
      this.payments.set(payment.id, payment);
      this.byKey.set(input.idempotencyKey, payment.id);
      this.outbox.push({ id: `evt_${this.outbox.length + 1}`, paymentId: payment.id, state: payment.state });
    }
    if (this.calls <= this.behaviour.swallowResponsesUntil) throw new TimeoutError(input.idempotencyKey);
    return payment;
  }

  refund(paymentId: string, amount: Money): { ok: boolean; reason?: string } {
    const payment = this.payments.get(paymentId);
    if (!payment) return { ok: false, reason: 'unknown payment' };
    if (payment.refunded + amount.minor > payment.amount.minor) return { ok: false, reason: 'refund exceeds capture' };
    payment.refunded += amount.minor;
    return { ok: true };
  }

  /** 突合のために、事業者側の記録を一覧で取り直す (17.13 の reconcile と同じ考え方)。 */
  list(): RemotePayment[] {
    return [...this.payments.values()];
  }
}

// ---------------------------------------------------------------------------
// 3. 自分たちの記録
// ---------------------------------------------------------------------------

export type AttemptState = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';

export type PaymentAttempt = {
  orderId: string;
  idempotencyKey: string;
  amount: Money;
  state: AttemptState;
  externalId: string | null;
};

export type RefundRow = { id: string; paymentId: string; amount: Money; state: 'SUCCEEDED' | 'FAILED' };

export class Ledger {
  readonly attempts = new Map<string, PaymentAttempt>();
  readonly refunds: RefundRow[] = [];
  /** 決済ごとの返金済み累計。条件付き更新で増やす。 */
  private readonly refundedTotal = new Map<string, bigint>();

  ensureAttempt(orderId: string, amount: Money, key: string): PaymentAttempt {
    const existing = this.attempts.get(orderId);
    if (existing) return existing;
    const created: PaymentAttempt = { orderId, idempotencyKey: key, amount, state: 'PENDING', externalId: null };
    this.attempts.set(orderId, created);
    return created;
  }

  refundedOf(paymentId: string): bigint {
    return this.refundedTotal.get(paymentId) ?? 0n;
  }

  /**
   * 返金を1行として追加する。累計の上限検査と加算を同じ操作で行うことで、
   * 並行する要求が両方とも上限を通り抜ける状態を防ぐ (17.16)。
   */
  tryAddRefund(paymentId: string, captured: Money, amount: Money, id: string): { ok: boolean; reason?: string } {
    // TODO: 通貨の一致、正の金額、返金IDの重複、累計の上限を検査し、
    //       通ったときだけ refundedTotal の更新と refunds への追加を行う。
    //       検査と反映を分けないことが、この関数の目的である。
    void paymentId;
    void captured;
    void amount;
    void id;
    return { ok: false, reason: 'not implemented' };
  }

  /**
   * よくある誤り。上限の検査 (read) と反映 (write) が別の操作に分かれている。
   * 2本の要求が「両方とも検査を通ってから、両方とも書く」という順序で交錯すると、
   * どちらも上限内だと判断したまま累計が上限を越える。
   */
  checkRefundAllowed(paymentId: string, captured: Money, amount: Money): boolean {
    return this.refundedOf(paymentId) + amount.minor <= captured.minor;
  }

  commitRefund(paymentId: string, amount: Money, id: string): void {
    this.refunds.push({ id, paymentId, amount, state: 'SUCCEEDED' });
    this.refundedTotal.set(paymentId, this.refundedOf(paymentId) + amount.minor);
  }

  totalRefunded(paymentId: string): bigint {
    return this.refunds
      .filter((refund) => refund.paymentId === paymentId && refund.state === 'SUCCEEDED')
      .reduce((sum, refund) => sum + refund.amount.minor, 0n);
  }
}

// ---------------------------------------------------------------------------
// 4. 課金 ― 冪等キーの確保順序 (17.16)
// ---------------------------------------------------------------------------

/** よくある誤り。毎回新しい鍵を作り、応答を受け取ってから記録する。 */
export function naiveCharge(gateway: FakeGateway, ledger: Ledger, orderId: string, amount: Money): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // 誤り1: 再試行のたびに鍵が変わるため、事業者から見て別の取引になる
      const result = gateway.createPayment({ idempotencyKey: `${orderId}:${attempt}:${Math.min(attempt, 1)}`, amount });
      // 誤り2: 応答を受け取ってからしか記録できない
      ledger.attempts.set(orderId, { orderId, idempotencyKey: 'n/a', amount, state: 'SUCCEEDED', externalId: result.id });
      return;
    } catch (error) {
      // 誤り3: タイムアウトを失敗として扱い、新しい取引として作り直す
      if (error instanceof TimeoutError) continue;
      throw error;
    }
  }
}

/** 鍵を業務上の一意な値から導き、送信前に永続化し、不明なときは同じ鍵で再試行する。 */
export function fixedCharge(gateway: FakeGateway, ledger: Ledger, orderId: string, amount: Money): void {
  // TODO:
  //   1. ledger.ensureAttempt で鍵 (`order:<orderId>`) を送信前に確保する
  //   2. その鍵で createPayment を呼ぶ
  //   3. TimeoutError は失敗ではなく UNKNOWN として扱い、同じ鍵でもう一度呼ぶ
  void gateway;
  void ledger;
  void orderId;
  void amount;
}

// ---------------------------------------------------------------------------
// 5. 突合 (17.16)
// ---------------------------------------------------------------------------

export type Discrepancy = { kind: 'missing-local' | 'missing-remote' | 'mismatch'; id: string; detail: string };

export function reconcile(ledger: Ledger, remote: readonly RemotePayment[]): Discrepancy[] {
  // TODO: 3方向を照合する。
  //   missing-local : 事業者にあって自分たちに無い
  //   missing-remote: 自分たちにあって事業者に無い
  //   mismatch      : 両方にあるが金額または通貨が違う (最小単位の整数で比較する)
  void ledger;
  void remote;
  return [];
}

// ---------------------------------------------------------------------------
// 6. 4件の再現
// ---------------------------------------------------------------------------

export const FIXTURES = {
  price: money(1_000n, 'JPY'),
  splitWeights: [1n, 1n, 1n] as const,
  order: 'ord-1001',
  capture: money(10_000n, 'JPY'),
  partialRefund: money(6_000n, 'JPY'),
} as const;

export type Finding = {
  id: 'M1' | 'M2' | 'M3' | 'M4';
  label: string;
  naive: string;
  fixed: string;
  reproduced: boolean;
  remains: boolean;
};

/** M1: 3件へ 1,000円 を按分する。合計が元と一致するか。 */
function splitTotals(): { naive: number; fixed: bigint } {
  const naive = naiveAllocate(1_000, [1, 1, 1], 'JPY').reduce((a, b) => a + b, 0);
  const fixed = allocate(FIXTURES.price, FIXTURES.splitWeights).reduce((a, b) => a + b.minor, 0n);
  return { naive, fixed };
}

/** M2: 応答が返らない1回目のあと、同じ注文を再試行したときの課金件数。 */
function chargeCount(charge: (g: FakeGateway, l: Ledger, o: string, a: Money) => void): number {
  const gateway = new FakeGateway({ swallowResponsesUntil: 1 });
  charge(gateway, new Ledger(), FIXTURES.order, FIXTURES.capture);
  return gateway.payments.size;
}

/**
 * M3: 6,000円 の部分返金の要求が2本、同時に届いたときの返金累計。
 * naive 側は「2本とも検査を終えてから、2本とも書く」という交錯を再現する。
 */
function refundTotal(mode: 'naive' | 'fixed'): bigint {
  const ledger = new Ledger();
  if (mode === 'naive') {
    const allowedA = ledger.checkRefundAllowed('pi_1', FIXTURES.capture, FIXTURES.partialRefund);
    const allowedB = ledger.checkRefundAllowed('pi_1', FIXTURES.capture, FIXTURES.partialRefund);
    if (allowedA) ledger.commitRefund('pi_1', FIXTURES.partialRefund, 'rf-1');
    if (allowedB) ledger.commitRefund('pi_1', FIXTURES.partialRefund, 'rf-2');
  } else {
    // 検査と反映が同じ操作にまとまっていれば、2本目は上限で止まる
    ledger.tryAddRefund('pi_1', FIXTURES.capture, FIXTURES.partialRefund, 'rf-1');
    ledger.tryAddRefund('pi_1', FIXTURES.capture, FIXTURES.partialRefund, 'rf-2');
  }
  return ledger.totalRefunded('pi_1');
}

/** M4: Webhook が1件届かなかったとき、突合の有無で検出できるか。 */
function reconcileGap(mode: 'naive' | 'fixed'): number {
  const gateway = new FakeGateway();
  const ledger = new Ledger();
  gateway.createPayment({ idempotencyKey: 'order:ord-2001', amount: FIXTURES.capture });
  gateway.createPayment({ idempotencyKey: 'order:ord-2002', amount: FIXTURES.capture });
  // 1件目の通知だけを適用し、2件目は届かなかったことにする
  const applied = gateway.outbox[0]!;
  const attempt = ledger.ensureAttempt('ord-2001', FIXTURES.capture, 'order:ord-2001');
  attempt.state = 'SUCCEEDED';
  attempt.externalId = applied.paymentId;
  if (mode === 'naive') return 0; // 突合を持たないため、差分は永久に見つからない
  return reconcile(ledger, gateway.list()).length;
}

/**
 * TODO: 4件について naive と fixed の観測値を集めて Finding を組み立てる。
 * splitTotals / chargeCount / refundTotal / reconcileGap をそのまま使える。
 * reproduced は「naive で欠陥が再現したか」、remains は「fixed にも残るか」。
 */
export function runFindings(): Finding[] {
  return [];
}

/** 過剰な拒否をしていないことの確認。上限内の返金は通り、正常な課金は1件だけ成立する。 */
export function legitimateFlowsPass(): boolean {
  const ledger = new Ledger();
  const within = ledger.tryAddRefund('pi_1', FIXTURES.capture, money(4_000n, 'JPY'), 'rf-a').ok;
  const second = ledger.tryAddRefund('pi_1', FIXTURES.capture, money(6_000n, 'JPY'), 'rf-b').ok;
  const gateway = new FakeGateway();
  const fresh = new Ledger();
  fixedCharge(gateway, fresh, 'ord-3001', FIXTURES.capture);
  return within && second && gateway.payments.size === 1 && reconcile(fresh, gateway.list()).length === 0;
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  const benign = legitimateFlowsPass() ? 'legitimate charge and refund still pass' : 'legitimate flows BROKEN';
  return [
    `naive payments: ${reproduced}/${findings.length} defects reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / fixed ${finding.fixed}`),
    `fixed payments: ${remaining}/${findings.length} defects remaining (${benign})`,
  ];
}
