// Starter for 23.10 課題23.10: 濫用対策の鍵と応答の設計を破って塞ぐ (★★★)
// 本文 13.25 (認証エンドポイントの濫用) と 23.27 (自動化された脅威、レート制限の設計) の判断を、
// 外部サービスへ接続せずプロセス内で再現する。
//
// 課題23.5 はレート制限の「アルゴリズム」(Token Bucket / Sliding Window) を実装した。
// 本課題が扱うのはその周りにある判断 ―― 何を鍵にするか、しきい値を超えたら何をするか、
// 応答から何が漏れるか ―― であり、アルゴリズムは固定窓の最小実装で足りる。
//
// 安全上の注意: ここに実在の資格情報・漏洩データは含まれない。すべて架空の値である。
//               攻撃の模擬はプロセス内で完結し、ネットワークへは一切出ない。
//               自分が所有していないシステムに対して同種の試行を行ってはならない。
//
// 手順:
//   1. NaiveGuard と4つの攻撃の模擬を読み、それぞれが何を突いているかを言葉にする。
//   2. LayeredGuard.signals を実装する。鍵の粒度が対策の効き方を決める。
//   3. LayeredGuard.login を実装する。段階的な対応、応答の統一、429 の返し方を含む。
//   4. runFindings を実装し、report.ts を通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch23 exec tsx abuse-defense/starter/report.ts
//
// 注意: 期待値を runFindings へ直書きしない。guard の戻り値だけから導くこと。

// ---------------------------------------------------------------------------
// 1. 固定窓カウンタ (アルゴリズムは課題23.5 の範囲。ここでは道具として使う)
// ---------------------------------------------------------------------------

export class Counter {
  private readonly hits = new Map<string, number>();

  increment(key: string): number {
    const next = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, next);
    return next;
  }

  get(key: string): number {
    return this.hits.get(key) ?? 0;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

// ---------------------------------------------------------------------------
// 2. 利用者と資格情報
// ---------------------------------------------------------------------------

export type Account = { email: string; password: string };

/** すべて架空の値。実在の資格情報ではない。 */
export const ACCOUNTS: readonly Account[] = [
  { email: 'aoi@example.test', password: 'correct-horse-battery' },
  { email: 'bito@example.test', password: 'summer-2026-office' },
  { email: 'chiba@example.test', password: 'p@ssw0rd-2026' },
  { email: 'dan@example.test', password: 'kX7#vq2Lm9$eR4' },
] as const;

/** 漏洩したとして広く出回っている想定の文字列。実在のリストではない。 */
export const BREACHED = new Set(['p@ssw0rd-2026', 'summer-2026-office', 'password123']);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function networkOf(ip: string): string {
  return ip.split('.').slice(0, 3).join('.');
}

// ---------------------------------------------------------------------------
// 3. ログイン
// ---------------------------------------------------------------------------

export type LoginRequest = { email: string; password: string; ip: string };

export type LoginOutcome =
  | { status: 200; body: 'authenticated'; challenged: boolean; headers: Record<string, string> }
  | { status: 401; body: string; challenged: boolean; headers: Record<string, string> }
  | { status: 429; body: string; challenged: boolean; headers: Record<string, string> };

/** 応答から存在の有無を推測できるかを見るための、処理コストの記録。 */
export type Trace = { verifiedHash: boolean };

export interface Guard {
  login(request: LoginRequest, trace: Trace): LoginOutcome;
  /** ロックアウトされているかどうかの外部から見える兆候。 */
  lockedOut(email: string): boolean;
}

const ACCOUNT_LIMIT = 5;
const IP_LIMIT = 20;
const NETWORK_LIMIT = 40;
const GLOBAL_LIMIT = 200;

function accountFor(email: string): Account | undefined {
  return ACCOUNTS.find((account) => account.email === normalizeEmail(email));
}

/**
 * よくある誤り。
 *  - 鍵がメールアドレスだけ。IPもネットワークも全体も数えない
 *  - しきい値を超えたら固定時間ロックする (他人を締め出せる)
 *  - 鍵を正規化しない
 *  - 存在しないアカウントではハッシュ検証を省き、応答文言も分ける
 */
export class NaiveGuard implements Guard {
  private readonly counter = new Counter();
  private readonly locked = new Set<string>();

  login(request: LoginRequest, trace: Trace): LoginOutcome {
    const key = `login:${request.email}`; // 正規化していない
    if (this.locked.has(request.email)) {
      return { status: 429, body: 'account locked', challenged: false, headers: {} };
    }
    const account = accountFor(request.email);
    if (!account) {
      // 存在しないアカウントでは検証を省くため、応答が明確に速くなる
      trace.verifiedHash = false;
      this.counter.increment(key);
      return { status: 401, body: 'no such account', challenged: false, headers: {} };
    }
    trace.verifiedHash = true;
    if (account.password === request.password) {
      this.counter.reset(key);
      return { status: 200, body: 'authenticated', challenged: false, headers: {} };
    }
    const attempts = this.counter.increment(key);
    if (attempts >= ACCOUNT_LIMIT) this.locked.add(request.email);
    return { status: 401, body: 'wrong password', challenged: false, headers: {} };
  }

  lockedOut(email: string): boolean {
    return this.locked.has(email);
  }
}

/**
 * 層を重ね、段階的に費用を上げ、応答を揃える (13.25、23.27)。
 * 固定ロックは使わない。超えた層に応じてチャレンジを課し、最終的に 429 を返す。
 */
export class LayeredGuard implements Guard {
  private readonly counter = new Counter();

  private signals(request: LoginRequest): Array<{ key: string; limit: number }> {
    // TODO: アカウント・送信元IP・ネットワーク・全体の4層の鍵と上限を返す。
    //       鍵は normalizeEmail / networkOf で正規化する。
    void request;
    return [];
  }

  login(request: LoginRequest, trace: Trace): LoginOutcome {
    // TODO:
    //   1. signals の各鍵について、上限を超えているものを数える
    //   2. 2層以上が超えていたら 429 と Retry-After を返す (DBを引かずに完結させる)
    //   3. 1層だけなら追加確認 (challenged) へ回す。成否で文言を変えない
    //   4. 存在しないアカウントでも同じ経路を通し、処理時間の差を残さない
    //   5. 漏洩資格情報 (BREACHED) に一致するパスワードは、正しくても素通りさせない
    //   6. 合図が立っていない成功だけ 200 を返し、アカウント単位のカウンタを消す
    void request;
    void trace;
    return { status: 401, body: 'not implemented', challenged: false, headers: {} };
  }

  lockedOut(): boolean {
    // 固定ロックを持たない。締め出しは起こらない
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. 攻撃の模擬
// ---------------------------------------------------------------------------

/** 分散した Credential Stuffing。1アカウントにつき1回、送信元も毎回変える。 */
export function credentialStuffing(guard: Guard): { accepted: string[]; attempts: number } {
  const accepted: string[] = [];
  let attempts = 0;
  // 「他所で漏れた組」として、実在アカウントのうち2件が漏洩パスワードを使い回している
  const combos = [
    { email: 'chiba@example.test', password: 'p@ssw0rd-2026' },
    { email: 'bito@example.test', password: 'summer-2026-office' },
    { email: 'dan@example.test', password: 'password123' },
    { email: 'aoi@example.test', password: 'password123' },
  ];
  combos.forEach((combo, index) => {
    attempts += 1;
    const outcome = guard.login(
      { ...combo, ip: `198.51.${index}.${index + 10}` },
      { verifiedHash: false },
    );
    if (outcome.status === 200) accepted.push(combo.email);
  });
  return { accepted, attempts };
}

/** 単一のIPからの総当たり。共有IP配下の正規利用者を巻き込むかも見る。 */
export function bruteForceFromOneIp(guard: Guard, ip = '203.0.113.7'): { blocked: number; attempts: number } {
  let blocked = 0;
  const attempts = 30;
  for (let i = 0; i < attempts; i += 1) {
    const outcome = guard.login({ email: 'aoi@example.test', password: `guess-${i}`, ip }, { verifiedHash: false });
    if (outcome.status === 429) blocked += 1;
  }
  return { blocked, attempts };
}

/** 応答の差からアカウントの存在を判別できるか。 */
export function enumerate(guard: Guard): { distinguishable: number; probes: number } {
  const probes = [
    { email: 'aoi@example.test', exists: true },
    { email: 'ghost@example.test', exists: false },
  ];
  const observed = probes.map((probe) => {
    const trace: Trace = { verifiedHash: false };
    const outcome = guard.login({ email: probe.email, password: 'definitely-wrong', ip: '192.0.2.5' }, trace);
    return { exists: probe.exists, body: outcome.body, verifiedHash: trace.verifiedHash };
  });
  const [present, absent] = observed as [(typeof observed)[number], (typeof observed)[number]];
  let distinguishable = 0;
  if (present.body !== absent.body) distinguishable += 1;
  if (present.verifiedHash !== absent.verifiedHash) distinguishable += 1;
  return { distinguishable, probes: probes.length };
}

/** 攻撃者がわざと失敗させて、正規利用者を締め出せるか。 */
export function lockoutDos(guard: Guard): { victimBlocked: boolean; attempts: number } {
  const victim = 'aoi@example.test';
  const attempts = 6;
  for (let i = 0; i < attempts; i += 1) {
    guard.login({ email: victim, password: `attacker-${i}`, ip: '198.51.100.99' }, { verifiedHash: false });
  }
  // 正規の利用者が、正しいパスワードで、別の場所から入ろうとする
  const outcome = guard.login(
    { email: victim, password: 'correct-horse-battery', ip: '203.0.113.20' },
    { verifiedHash: false },
  );
  // 追加確認を求められるのは「締め出し」ではない。本人が越えられる関門が残っていれば通れる。
  const victimBlocked = outcome.status !== 200 && !outcome.challenged;
  return { victimBlocked, attempts };
}

// ---------------------------------------------------------------------------
// 5. 4件の再現
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'B1' | 'B2' | 'B3' | 'B4';
  label: string;
  naive: string;
  layered: string;
  reproduced: boolean;
  remains: boolean;
};

/**
 * TODO: 4件について naive と layered の観測値を集めて Finding を組み立てる。
 * credentialStuffing / enumerate / lockoutDos / bruteForceFromOneIp をそのまま使える。
 * reproduced は「naive で弱点が再現したか」、remains は「layered にも残るか」。
 */
export function runFindings(): Finding[] {
  return [];
}

/** 過剰な拒否をしていないことの確認。平常時の正しいログインは通り続ける。 */
export function normalLoginPasses(): boolean {
  const guard = new LayeredGuard();
  const outcome = guard.login(
    { email: 'AOI@Example.test', password: 'correct-horse-battery', ip: '203.0.113.30' },
    { verifiedHash: false },
  );
  return outcome.status === 200 && !guard.lockedOut();
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  const benign = normalLoginPasses() ? 'normal login still succeeds' : 'normal login BLOCKED (over-blocking)';
  return [
    `naive guard: ${reproduced}/${findings.length} weaknesses reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / layered ${finding.layered}`),
    `layered guard: ${remaining}/${findings.length} weaknesses remaining (${benign})`,
  ];
}
