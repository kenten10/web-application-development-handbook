// Starter for 14.7 課題14.7: 個人データの削除・保持・エクスポート・同意の抜けを再現して塞ぐ (★★★)
// 本文 14.25 (所在一覧、ログの漏れ口) と 14.26 (保持期間、削除の伝播、エクスポートの範囲、同意の撤回) の
// 判断を、外部サービスへ接続せずプロセス内で再現する。
//
// 安全上の注意: ここで扱うのはすべて架空の値であり、実在の個人を示すものではない。
//               プロセス外へは何も書き出さない。実データで試してはならない。
//
// 手順:
//   1. INVENTORY と buildWorld を読み、どの場所がどう扱われるべきかを言葉にする。
//   2. fixedErase を実装する。一覧を入力にし、場所ごとに erasure の種別で処理を分ける。
//   3. fixedPurge を実装する。expired() が対象を返す。
//   4. fixedExport を実装する。exportable な場所から、本人の行だけを集める。
//   5. fixedDispatch を実装する。配信の直前に同意の正本を引く。
//   6. runFindings を実装し、report.ts を通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch14 exec tsx data-lifecycle/starter/report.ts
//
// 注意: 期待値を runFindings へ直書きしない。各関数の戻り値だけから導くこと。

export const DAY = 24 * 60 * 60 * 1000;
/** 判定を現在時刻に依存させないための固定基準時刻。 */
export const NOW = Date.parse('2026-08-30T00:00:00Z');

// ---------------------------------------------------------------------------
// 1. 保存場所と、そこに置かれる行
// ---------------------------------------------------------------------------

export type Row = {
  id: string;
  /** この行が誰についてのものか。null は誰のものでもない (統計値など)。 */
  subjectId: string | null;
  createdAt: number;
  /** 個人を識別しうる項目。空になった行は残っていても識別に使えない。 */
  identifiers: Record<string, string>;
  /** 本人が入力した内容かどうか。エクスポートの範囲判定に使う。 */
  authoredBySubject?: boolean;
  threadId?: string;
  body?: string;
};

export type World = { stores: Map<string, Row[]>; sent: string[] };

/** 削除のしかた。行を消す・識別項目だけ落とす・残す (法定保存など) の3種。 */
export type Erasure = 'delete' | 'anonymize' | 'retain';

export type InventoryEntry = {
  location: string;
  /** 保持期間 (日)。null は「本人の削除まで保持する」。 */
  retentionDays: number | null;
  exportable: boolean;
  erasure: Erasure;
  note: string;
};

/**
 * 個人データの所在一覧 (14.25)。削除ジョブとエクスポートは、この一覧を入力にする。
 * 一覧に載っているのに処理が対応していない場所があれば、起動時に落とす。
 */
export const INVENTORY: readonly InventoryEntry[] = [
  { location: 'db.users', retentionDays: null, exportable: true, erasure: 'delete', note: '本人の基本情報' },
  { location: 'db.orders', retentionDays: null, exportable: true, erasure: 'anonymize', note: '取引記録。保存義務の可能性があるため識別項目のみ落とす' },
  { location: 'db.messages', retentionDays: null, exportable: true, erasure: 'delete', note: '共有スレッドの投稿' },
  { location: 'db.audit_log', retentionDays: 730, exportable: false, erasure: 'anonymize', note: '監査ログ。行を消すと監査の意味が失われる' },
  { location: 'search.users', retentionDays: null, exportable: false, erasure: 'delete', note: '検索インデックス。外部キーで辿れない' },
  { location: 'analytics.events', retentionDays: 90, exportable: true, erasure: 'anonymize', note: '分析基盤。IPと端末情報を持つ' },
  { location: 'storage.uploads', retentionDays: null, exportable: true, erasure: 'delete', note: 'アップロードされたファイル' },
  { location: 'saas.crm', retentionDays: null, exportable: false, erasure: 'delete', note: '外部SaaS。削除APIを呼ぶ' },
  { location: 'log.requests', retentionDays: 30, exportable: false, erasure: 'anonymize', note: 'アクセスログ。保持期間で落ちる' },
] as const;

export const EXPORTABLE_LOCATIONS = INVENTORY.filter((entry) => entry.exportable).map((entry) => entry.location);

// ---------------------------------------------------------------------------
// 2. 同意
// ---------------------------------------------------------------------------

export type Consent = {
  subjectId: string;
  purpose: string;
  /** 同意した文面の版。文面は変わるため記録する。 */
  policyVersion: string;
  grantedAt: number;
  revokedAt: number | null;
};

export type ConsentStore = Consent[];

export function consentActive(store: ConsentStore, subjectId: string, purpose: string, at: number): boolean {
  const record = store.find((entry) => entry.subjectId === subjectId && entry.purpose === purpose);
  if (!record) return false;
  if (record.grantedAt > at) return false;
  return record.revokedAt === null || record.revokedAt > at;
}

// ---------------------------------------------------------------------------
// 3. 初期データ
// ---------------------------------------------------------------------------

const row = (
  id: string,
  subjectId: string | null,
  ageDays: number,
  identifiers: Record<string, string>,
  extra: Partial<Row> = {},
): Row => ({ id, subjectId, createdAt: NOW - ageDays * DAY, identifiers, ...extra });

export function buildWorld(): { world: World; consents: ConsentStore } {
  const stores = new Map<string, Row[]>([
    ['db.users', [
      row('u-1', 'S1', 400, { email: 'aoi@example.test', name: '青井' }),
      row('u-2', 'S2', 400, { email: 'bito@example.test', name: '尾藤' }),
    ]],
    ['db.orders', [
      row('o-1', 'S1', 200, { shippingAddress: '架空県架空市1-1', name: '青井' }),
      row('o-2', 'S2', 150, { shippingAddress: '架空県架空市2-2', name: '尾藤' }),
    ]],
    ['db.messages', [
      row('m-1', 'S1', 20, { name: '青井' }, { authoredBySubject: true, threadId: 't-1', body: '見積もりを送ります' }),
      row('m-2', 'S2', 19, { name: '尾藤' }, { authoredBySubject: false, threadId: 't-1', body: '尾藤の連絡先は 090-0000-0000 です' }),
      row('m-3', 'S1', 18, { name: '青井' }, { authoredBySubject: true, threadId: 't-1', body: '受け取りました' }),
      row('m-4', 'S1', 10, { name: '青井' }, { authoredBySubject: true, threadId: 't-2', body: '別件です' }),
    ]],
    ['db.audit_log', [
      row('a-1', 'S1', 300, { actorEmail: 'aoi@example.test' }),
      row('a-2', 'S1', 5, { actorEmail: 'aoi@example.test' }),
    ]],
    ['search.users', [row('si-1', 'S1', 400, { email: 'aoi@example.test', name: '青井' })]],
    ['analytics.events', [
      row('e-1', 'S1', 200, { ip: '203.0.113.9', userAgent: 'ExampleBrowser/1.0' }),
      row('e-2', 'S1', 120, { ip: '203.0.113.9', userAgent: 'ExampleBrowser/1.0' }),
      row('e-3', 'S1', 10, { ip: '203.0.113.9', userAgent: 'ExampleBrowser/1.0' }),
      row('e-4', 'S2', 200, { ip: '203.0.113.8', userAgent: 'ExampleBrowser/1.0' }),
    ]],
    ['storage.uploads', [row('f-1', 'S1', 60, { originalFilename: '身分証_青井.png' })]],
    ['saas.crm', [row('c-1', 'S1', 300, { email: 'aoi@example.test' })]],
    ['log.requests', [
      row('l-1', 'S1', 100, { ip: '203.0.113.9' }),
      row('l-2', 'S1', 3, { ip: '203.0.113.9' }),
    ]],
  ]);
  const consents: ConsentStore = [
    { subjectId: 'S1', purpose: 'marketing', policyVersion: '2026-04', grantedAt: NOW - 300 * DAY, revokedAt: null },
    { subjectId: 'S2', purpose: 'marketing', policyVersion: '2026-04', grantedAt: NOW - 300 * DAY, revokedAt: null },
  ];
  return { world: { stores, sent: [] }, consents };
}

const rowsOf = (world: World, location: string): Row[] => world.stores.get(location) ?? [];

/** その主体を識別できる状態で残っている行を数える。 */
export function residual(world: World, subjectId: string): Array<{ location: string; id: string }> {
  const out: Array<{ location: string; id: string }> = [];
  for (const [location, rows] of world.stores) {
    for (const item of rows) {
      if (item.subjectId !== subjectId) continue;
      if (Object.keys(item.identifiers).length > 0) out.push({ location, id: item.id });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. 削除 ― 伝播 (14.26)
// ---------------------------------------------------------------------------

export type DeletionRequest = {
  subjectId: string;
  requestedAt: number;
  /** 場所ごとの進捗。途中で失敗したときに再実行できるようにする。 */
  targets: Record<string, 'pending' | 'done'>;
  state: 'pending' | 'done';
};

export function newDeletionRequest(subjectId: string, at: number): DeletionRequest {
  const targets: Record<string, 'pending' | 'done'> = {};
  for (const entry of INVENTORY) targets[entry.location] = 'pending';
  return { subjectId, requestedAt: at, targets, state: 'pending' };
}

function eraseAt(world: World, location: string, subjectId: string, erasure: Erasure): void {
  const rows = rowsOf(world, location);
  if (erasure === 'delete') {
    world.stores.set(location, rows.filter((item) => item.subjectId !== subjectId));
    return;
  }
  if (erasure === 'anonymize') {
    // 行は残すが、識別に使える項目を落とす。再実行しても結果は同じ (冪等)。
    for (const item of rows) if (item.subjectId === subjectId) item.identifiers = {};
  }
}

/** よくある誤り。主テーブルと、外部キーで辿れる範囲だけを消す。 */
export function naiveErase(world: World, subjectId: string): DeletionRequest {
  const request = newDeletionRequest(subjectId, NOW);
  for (const location of ['db.users', 'db.orders', 'db.messages']) {
    eraseAt(world, location, subjectId, 'delete');
    request.targets[location] = 'done';
  }
  request.state = 'done';
  return request;
}

/** 一覧を入力にし、場所ごとの進捗を記録する。未対応の場所があれば起動時に落とす。 */
export function fixedErase(world: World, subjectId: string): DeletionRequest {
  // TODO: INVENTORY を入力にする。
  //   1. 一覧にあって world.stores に無い場所があれば例外を投げる (未対応の検出)
  //   2. newDeletionRequest で進捗を作り、場所ごとに eraseAt を呼ぶ
  //   3. 場所ごとの targets を done にし、最後に state を done にする
  void world;
  return newDeletionRequest(subjectId, NOW);
}

// ---------------------------------------------------------------------------
// 5. 保持期間 ― 期限切れの回収 (14.26)
// ---------------------------------------------------------------------------

export function expired(world: World, at: number): Array<{ location: string; id: string }> {
  const out: Array<{ location: string; id: string }> = [];
  for (const entry of INVENTORY) {
    if (entry.retentionDays === null) continue;
    for (const item of rowsOf(world, entry.location)) {
      if (Object.keys(item.identifiers).length === 0) continue;
      if (item.createdAt < at - entry.retentionDays * DAY) out.push({ location: entry.location, id: item.id });
    }
  }
  return out;
}

/** よくある誤り。方針は文書にあるが、実行するものが無い。 */
export function naivePurge(world: World, at: number): number {
  void world;
  void at;
  return 0;
}

/** 期限を過ぎた行から識別項目を落とす。1回あたりの件数に上限を置く。 */
export function fixedPurge(world: World, at: number, limit = 1_000): number {
  // TODO: expired(world, at) が返す対象から識別項目を落とし、落とした件数を返す。
  //       1回あたりの件数に上限 (limit) を置く。長いトランザクションを避けるためである。
  void world;
  void at;
  void limit;
  return 0;
}

// ---------------------------------------------------------------------------
// 6. エクスポート ― 範囲 (14.26)
// ---------------------------------------------------------------------------

export type ExportBundle = { subjectId: string; rows: Array<{ location: string; id: string; body?: string }> };

/** よくある誤り。本人が参加したスレッドを丸ごと書き出す。 */
export function naiveExport(world: World, subjectId: string): ExportBundle {
  const threads = new Set(
    rowsOf(world, 'db.messages').filter((item) => item.subjectId === subjectId).map((item) => item.threadId),
  );
  const rows: ExportBundle['rows'] = [];
  for (const location of ['db.users', 'db.orders']) {
    for (const item of rowsOf(world, location)) {
      if (item.subjectId === subjectId) rows.push({ location, id: item.id });
    }
  }
  for (const item of rowsOf(world, 'db.messages')) {
    // スレッド単位で入れてしまうため、他人の投稿が混ざる
    if (item.threadId !== undefined && threads.has(item.threadId)) {
      rows.push({ location: 'db.messages', id: item.id, ...(item.body === undefined ? {} : { body: item.body }) });
    }
  }
  return { subjectId, rows };
}

/** 一覧の exportable を入力にし、本人の行だけを集める。 */
export function fixedExport(world: World, subjectId: string): ExportBundle {
  // TODO: EXPORTABLE_LOCATIONS を入力にする。
  //   1. 一覧にあって world.stores に無い場所があれば例外を投げる
  //   2. 各場所から subjectId が一致する行だけを集める (スレッド単位で入れない)
  //   3. body がある行は body も含める
  void world;
  return { subjectId, rows: [] };
}

/** 他人のデータが混ざった件数。 */
export function foreignRows(world: World, bundle: ExportBundle): number {
  let count = 0;
  for (const entry of bundle.rows) {
    const item = rowsOf(world, entry.location).find((candidate) => candidate.id === entry.id);
    if (item && item.subjectId !== bundle.subjectId) count += 1;
  }
  return count;
}

/** 本人が入力した内容のうち、書き出されなかった件数。 */
export function missingAuthoredRows(world: World, bundle: ExportBundle): number {
  const included = new Set(bundle.rows.map((entry) => `${entry.location}/${entry.id}`));
  let count = 0;
  for (const item of rowsOf(world, 'db.messages')) {
    if (item.subjectId !== bundle.subjectId || item.authoredBySubject !== true) continue;
    if (!included.has(`db.messages/${item.id}`)) count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// 7. 同意の撤回が処理へ届くか (14.26)
// ---------------------------------------------------------------------------

export function revokeConsent(consents: ConsentStore, subjectId: string, purpose: string, at: number): void {
  const record = consents.find((entry) => entry.subjectId === subjectId && entry.purpose === purpose);
  if (record) record.revokedAt = at;
}

/** よくある誤り。配信バッチが同意の正本ではなく、更新されていない列を見ている。 */
export function naiveDispatch(world: World, _consents: ConsentStore, at: number): string[] {
  void _consents;
  void at;
  const sent: string[] = [];
  for (const item of rowsOf(world, 'db.users')) {
    if (item.subjectId !== null) sent.push(item.subjectId);
  }
  world.sent.push(...sent);
  return sent;
}

/** 配信の直前に同意の正本を引く。 */
export function fixedDispatch(world: World, consents: ConsentStore, at: number): string[] {
  // TODO: db.users を走査しつつ、consentActive(consents, subjectId, 'marketing', at) が
  //       true の主体だけへ送る。送った主体を world.sent へも積む。
  void world;
  void consents;
  void at;
  return [];
}

// ---------------------------------------------------------------------------
// 8. 4件の再現
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'P1' | 'P2' | 'P3' | 'P4';
  label: string;
  naive: string;
  fixed: string;
  reproduced: boolean;
  remains: boolean;
};

type Erase = (world: World, subjectId: string) => DeletionRequest;

function afterErase(erase: Erase): { residual: number; locations: string[] } {
  const { world } = buildWorld();
  erase(world, 'S1');
  const left = residual(world, 'S1');
  return { residual: left.length, locations: [...new Set(left.map((entry) => entry.location))].sort() };
}

function afterPurge(purge: (world: World, at: number) => number): { remaining: number; purged: number } {
  const { world } = buildWorld();
  const purged = purge(world, NOW);
  return { remaining: expired(world, NOW).length, purged };
}

function afterExport(exporter: (world: World, subjectId: string) => ExportBundle): {
  foreign: number;
  missing: number;
  total: number;
} {
  const { world } = buildWorld();
  const bundle = exporter(world, 'S1');
  return { foreign: foreignRows(world, bundle), missing: missingAuthoredRows(world, bundle), total: bundle.rows.length };
}

function afterRevoke(dispatch: (world: World, consents: ConsentStore, at: number) => string[]): string[] {
  const { world, consents } = buildWorld();
  revokeConsent(consents, 'S1', 'marketing', NOW - DAY);
  return dispatch(world, consents, NOW);
}

/**
 * TODO: 4件について naive と fixed の観測値を集めて Finding を組み立てる。
 * afterErase / afterPurge / afterExport / afterRevoke をそのまま使える。
 * reproduced は「naive で抜けが再現したか」、remains は「fixed にも残るか」。
 */
export function runFindings(): Finding[] {
  return [];
}

/** 過剰な削除・過剰な抑止をしていないことの確認。 */
export function otherSubjectIntact(): boolean {
  const { world, consents } = buildWorld();
  fixedErase(world, 'S1');
  const s2Rows = residual(world, 'S2').length;
  revokeConsent(consents, 'S1', 'marketing', NOW - DAY);
  const sent = fixedDispatch(world, consents, NOW);
  return s2Rows === 4 && sent.includes('S2');
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  const benign = otherSubjectIntact() ? 'other subject intact' : 'other subject AFFECTED (over-deletion)';
  return [
    `naive lifecycle: ${reproduced}/${findings.length} gaps reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / fixed ${finding.fixed}`),
    `fixed lifecycle: ${remaining}/${findings.length} gaps remaining (${benign})`,
  ];
}
