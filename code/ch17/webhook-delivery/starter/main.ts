// Starter for 17.5 課題17.5: Webhook 配送の失敗を再現して冪等・順序耐性にする (★★★)
// Purpose: 本文 17.13 の「生ボディで検証する」「一意制約に重複を判定させる」
//          「版番号で古い更新を捨てる」「突合で欠落を埋める」を実装で確かめる。
//
// 手順:
//   1. Sender と naiveVerifySignature を読み、素朴な受信側の誤りを言葉にする。
//   2. verifySignature を実装する。生バイト列・複数鍵・時刻の許容差の3点を扱う。
//   3. Receiver の guarded 経路 (insert による重複判定、版番号による棄却) を実装する。
//   4. reconcile と missingCount を実装する。
//   5. runFindings が naive 4/4、guarded 0/4 を返すところまで通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch17 exec tsx webhook-delivery/starter/report.ts
//
// 注意: 期待値を runFindings へ直書きしない。受信側の最終状態と戻り値だけから判定すること。
//
// 外部サービスへ接続しない。送信側と受信側を同一プロセスに置き、その間の Link が
// 固定表どおりに応答の取りこぼし・順序の入れ替え・欠落を起こす。

import crypto from 'node:crypto';

export class UniqueViolationError extends Error {}
export class SignatureError extends Error {}

export type Mode = 'naive' | 'guarded';

export const TOLERANCE_SECONDS = 300;

// ---------------------------------------------------------------------------
// 1. イベントと送信側
// ---------------------------------------------------------------------------

export type Status = 'active' | 'past_due' | 'canceled';

export type WebhookEvent = {
  readonly id: string;
  readonly type: string;
  readonly resourceId: string;
  readonly version: number;
  readonly status: Status;
  readonly createdAt: string;
};

export type Request = {
  readonly rawBody: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * 署名対象は "id.timestamp.rawBody"。本文は必ず生バイト列で扱う。
 * 整形の仕方が1バイトでも違えば署名は一致しない。
 */
export function signPayload(secret: Uint8Array, eventId: string, timestamp: number, rawBody: Uint8Array): string {
  const prefix = encoder.encode(`${eventId}.${timestamp}.`);
  const signed = new Uint8Array(prefix.byteLength + rawBody.byteLength);
  signed.set(prefix, 0);
  signed.set(rawBody, prefix.byteLength);
  return crypto.createHmac('sha256', secret).update(signed).digest('base64');
}

export type Secret = { id: string; key: Uint8Array };

export class Sender {
  /** 送信側が持つ正本の状態。突合はここを参照する。 */
  readonly canonical = new Map<string, { status: Status; version: number }>();

  constructor(readonly secrets: readonly Secret[]) {}

  record(event: WebhookEvent): void {
    const current = this.canonical.get(event.resourceId);
    if (!current || current.version < event.version) {
      this.canonical.set(event.resourceId, { status: event.status, version: event.version });
    }
  }

  /**
   * 配送要求を組み立てる。
   * pretty=false は開発環境の素朴な送信側 (整形なし)、pretty=true は本番の送信側 (2スペース整形)。
   * 受信側が JSON.parse してから JSON.stringify し直す実装は、前者では偶然一致し、後者で落ちる。
   * これが「開発環境では通って本番で落ちる」の正体である。
   */
  build(event: WebhookEvent, timestamp: number, pretty = false): Request {
    this.record(event);
    const rawBody = encoder.encode(pretty ? JSON.stringify(event, null, 2) : JSON.stringify(event));
    // 鍵ローテーション中は複数の署名を空白区切りで併記する。新しい鍵を先頭に置く。
    const signature = this.secrets
      .map((secret) => `${secret.id},${signPayload(secret.key, event.id, timestamp, rawBody)}`)
      .join(' ');
    return {
      rawBody,
      headers: {
        'webhook-id': event.id,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': signature,
        'content-type': 'application/json',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// 2. 署名検証
// ---------------------------------------------------------------------------

export type Verification = { ok: true; eventId: string } | { ok: false; reason: string };

/**
 * TODO: 生バイト列に対して検証する。次の3点を扱う。
 *   1. rawBody をそのまま署名対象にする (パースし直さない)
 *   2. webhook-signature は空白区切りの複数署名。どれか1つが一致すれば受理する
 *   3. webhook-timestamp と nowSeconds の差が TOLERANCE_SECONDS を超えたら拒否する
 * 比較には crypto.timingSafeEqual を使う。長さが違うと例外を投げるため、先に長さを確認する。
 */
export function verifySignature(
  rawBody: Uint8Array,
  headers: Readonly<Record<string, string>>,
  secrets: readonly Secret[],
  nowSeconds: number,
): Verification {
  void rawBody;
  void headers;
  void secrets;
  void nowSeconds;
  return { ok: false, reason: 'not implemented' };
}

/** 誤り: パースし直した文字列で検証し、署名も鍵も先頭の1つしか見ない。 */
export function naiveVerifySignature(
  rawBody: Uint8Array,
  headers: Readonly<Record<string, string>>,
  secrets: readonly Secret[],
  nowSeconds: number,
): Verification {
  const eventId = headers['webhook-id'];
  const timestamp = Number(headers['webhook-timestamp']);
  if (!eventId || !Number.isFinite(timestamp)) return { ok: false, reason: 'missing headers' };
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }
  const reserialized = encoder.encode(JSON.stringify(JSON.parse(decoder.decode(rawBody))));
  const first = (headers['webhook-signature'] ?? '').split(' ')[0] ?? '';
  const value = first.split(',')[1] ?? '';
  const secret = secrets[0];
  if (!secret) return { ok: false, reason: 'no secret configured' };
  const expected = signPayload(secret.key, eventId, timestamp, reserialized);
  return value === expected ? { ok: true, eventId } : { ok: false, reason: 'no matching signature' };
}

// ---------------------------------------------------------------------------
// 3. 受信側
// ---------------------------------------------------------------------------

export type DeliveryResult = { accepted: boolean; duplicate: boolean; reason?: string };

const tick = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

export class Receiver {
  /** 受信台帳。イベントIDが主キーであり、これが重複判定そのものになる。 */
  readonly inbound = new Map<string, WebhookEvent>();
  readonly state = new Map<string, { status: Status; version: number }>();
  charges = 0;

  constructor(
    readonly mode: Mode,
    readonly secrets: readonly Secret[],
    readonly nowSeconds: number,
  ) {}

  /** 一意制約に相当する。既に行があれば例外を投げる。 */
  private insert(event: WebhookEvent): void {
    if (this.inbound.has(event.id)) throw new UniqueViolationError(event.id);
    this.inbound.set(event.id, event);
  }

  async deliver(request: Request): Promise<DeliveryResult> {
    const verify = this.mode === 'guarded' ? verifySignature : naiveVerifySignature;
    const result = verify(request.rawBody, request.headers, this.secrets, this.nowSeconds);
    if (!result.ok) return { accepted: false, duplicate: false, reason: result.reason };

    const event = JSON.parse(decoder.decode(request.rawBody)) as WebhookEvent;

    if (this.mode === 'guarded') {
      // TODO: 挿入を先に試み、UniqueViolationError を重複として扱う。
      //       検索してから挿入する形にすると、並行到着で両方が通る。
      //       挿入に成功したら await tick() を挟んでから apply する。
      return { accepted: true, duplicate: false };
    }

    // 誤り: 先に読んで、無ければ書く。並行して届くと両方が「無い」を見る。
    const known = this.inbound.has(event.id);
    await tick();
    if (known) return { accepted: true, duplicate: true };
    this.apply(event);
    this.inbound.set(event.id, event);
    return { accepted: true, duplicate: false };
  }

  private apply(event: WebhookEvent): void {
    if (this.mode === 'guarded') {
      // TODO: 版番号を更新条件に入れる。現在の版以下のイベントは何もせずに戻る
      //       (0 件更新に相当する。例外にはしない)。
    }
    this.state.set(event.resourceId, { status: event.status, version: event.version });
    if (event.type === 'invoice.payment_failed') this.charges += 1;
  }
}

/**
 * TODO: 突合。送信側の正本 (sender.canonical) と受信側の状態を突き合わせ、
 * 版が古い、または欠けている資源だけを埋める。埋めた件数を返す。
 */
export function reconcile(receiver: Receiver, sender: Sender): number {
  void receiver;
  void sender;
  return 0;
}

/** 送信側の正本と食い違っている資源の数。 */
export function missingCount(receiver: Receiver, sender: Sender): number {
  let missing = 0;
  for (const [resourceId, canonical] of sender.canonical) {
    const current = receiver.state.get(resourceId);
    if (!current || current.version !== canonical.version || current.status !== canonical.status) missing += 1;
  }
  return missing;
}

// ---------------------------------------------------------------------------
// 4. 固定の配送表
// ---------------------------------------------------------------------------

export const FIXTURES = {
  nowSeconds: 1_800_000_000,
  /** 新しい鍵を先頭に、旧鍵を後ろに置く。ローテーション中の状態を表す。 */
  secrets: [
    { id: 'k2', key: encoder.encode('rotated-secret-2026-08') },
    { id: 'k1', key: encoder.encode('previous-secret-2026-05') },
  ] satisfies Secret[],
  signatureEvent: {
    id: 'evt_sig',
    type: 'subscription.updated',
    resourceId: 'sub_1',
    version: 2,
    status: 'active',
    createdAt: '2026-08-30T04:00:00.000Z',
  } satisfies WebhookEvent,
  chargeEvent: {
    id: 'evt_dup',
    type: 'invoice.payment_failed',
    resourceId: 'sub_1',
    version: 3,
    status: 'past_due',
    createdAt: '2026-08-30T04:05:00.000Z',
  } satisfies WebhookEvent,
  orderedEvents: [
    // 到着順。新しい版が先に着き、古い版が後から着く。
    {
      id: 'evt_v5',
      type: 'subscription.updated',
      resourceId: 'sub_2',
      version: 5,
      status: 'active',
      createdAt: '2026-08-30T04:10:00.000Z',
    },
    {
      id: 'evt_v4',
      type: 'subscription.updated',
      resourceId: 'sub_2',
      version: 4,
      status: 'past_due',
      createdAt: '2026-08-30T04:09:00.000Z',
    },
  ] satisfies WebhookEvent[],
  dropSequence: [
    {
      id: 'evt_a',
      type: 'subscription.updated',
      resourceId: 'sub_3',
      version: 1,
      status: 'active',
      createdAt: '2026-08-30T04:20:00.000Z',
    },
    {
      id: 'evt_b',
      type: 'subscription.updated',
      resourceId: 'sub_4',
      version: 1,
      status: 'active',
      createdAt: '2026-08-30T04:21:00.000Z',
    },
    {
      id: 'evt_c',
      type: 'subscription.updated',
      resourceId: 'sub_4',
      version: 2,
      status: 'canceled',
      createdAt: '2026-08-30T04:22:00.000Z',
    },
  ] satisfies WebhookEvent[],
  /** dropSequence のうち、Link が落とすイベント */
  droppedEventId: 'evt_c',
} as const;

const makePair = (mode: Mode, senderSecrets: readonly Secret[] = FIXTURES.secrets) => {
  const sender = new Sender(senderSecrets);
  // 鍵の設定は両者とも同じ。違うのは検証の実装だけである。
  return { sender, receiver: new Receiver(mode, FIXTURES.secrets, FIXTURES.nowSeconds) };
};

// ---------------------------------------------------------------------------
// 5. 4件の再現
// ---------------------------------------------------------------------------

export async function probeSignature(mode: Mode): Promise<DeliveryResult> {
  const { sender, receiver } = makePair(mode);
  // 本番の送信側は整形した JSON を送る。パースし直して検証すると一致しない。
  return receiver.deliver(sender.build(FIXTURES.signatureEvent, FIXTURES.nowSeconds, true));
}

/** 鍵ローテーション中 (旧鍵が先頭) でも受理できるか。 */
export async function probeRotation(mode: Mode): Promise<DeliveryResult> {
  const rotated = [FIXTURES.secrets[1]!, FIXTURES.secrets[0]!];
  const { sender, receiver } = makePair(mode, rotated);
  return receiver.deliver(sender.build(FIXTURES.signatureEvent, FIXTURES.nowSeconds));
}

export async function probeDuplicate(mode: Mode): Promise<number> {
  const { sender, receiver } = makePair(mode);
  const request = sender.build(FIXTURES.chargeEvent, FIXTURES.nowSeconds);
  // 同じイベントが並行して2本届く。読んでから書く実装は両方が「無い」を見る。
  await Promise.all([receiver.deliver(request), receiver.deliver(request)]);
  return receiver.charges;
}

export async function probeOrder(mode: Mode): Promise<Status | 'none'> {
  const { sender, receiver } = makePair(mode);
  for (const event of FIXTURES.orderedEvents) {
    await receiver.deliver(sender.build(event, FIXTURES.nowSeconds));
  }
  return receiver.state.get('sub_2')?.status ?? 'none';
}

export async function probeDropped(mode: Mode): Promise<number> {
  const { sender, receiver } = makePair(mode);
  for (const event of FIXTURES.dropSequence) {
    const request = sender.build(event, FIXTURES.nowSeconds);
    if (event.id === FIXTURES.droppedEventId) continue; // Link が落とす
    await receiver.deliver(request);
  }
  // 突合を持つのは guarded 側だけ。
  if (mode === 'guarded') reconcile(receiver, sender);
  return missingCount(receiver, sender);
}

export type Finding = {
  id: 'W1' | 'W2' | 'W3' | 'W4';
  label: string;
  naive: string;
  guarded: string;
  reproduced: boolean;
  remains: boolean;
};

/**
 * TODO: 4件について、naive と guarded の観測値を集めて Finding を組み立てる。
 * reproduced は「naive で失敗が再現したか」、remains は「guarded にも残るか」。
 * 期待値をここへ直書きせず、probe* の戻り値から導くこと。
 */
export async function runFindings(): Promise<Finding[]> {
  return [];
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  return [
    `naive receiver: ${reproduced}/${findings.length} failures reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / guarded ${finding.guarded}`),
    `guarded receiver: ${remaining}/${findings.length} failures remaining`,
  ];
}
