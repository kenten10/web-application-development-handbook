// 模範解答 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★)
// 本文 13.24 の「テナント境界が破れる典型経路」から4件を、動くコードとして再現し、
// 14.20 の Row-Level Security に相当するポリシー層を通すと再現しなくなることを確かめる。
//
// 外部サービスを使わず、メモリ上の最小データストアで完結させる。

// ---------------------------------------------------------------------------
// 1. データストア
// ---------------------------------------------------------------------------

export type TenantId = string;

export type Project = { id: string; tenantId: TenantId; name: string };
export type Task = { id: string; tenantId: TenantId; projectId: string; title: string };

export type Store = {
  projects: Map<string, Project>;
  tasks: Map<string, Task>;
  /** 全文検索の索引。語 → タスクID。テナントで分かれていない点が経路L2の火種になる */
  searchIndex: Map<string, Set<string>>;
};

export const TENANT_A: TenantId = 'ten_a';
export const TENANT_B: TenantId = 'ten_b';

function indexTask(store: Store, task: Task): void {
  for (const term of task.title.toLowerCase().split(/\s+/)) {
    const bucket = store.searchIndex.get(term) ?? new Set<string>();
    bucket.add(task.id);
    store.searchIndex.set(term, bucket);
  }
}

export function createStore(): Store {
  const store: Store = { projects: new Map(), tasks: new Map(), searchIndex: new Map() };
  const seed: Array<Project> = [
    { id: 'prj_a1', tenantId: TENANT_A, name: 'Acme roadmap' },
    { id: 'prj_b1', tenantId: TENANT_B, name: 'Beta roadmap' },
  ];
  for (const project of seed) store.projects.set(project.id, project);
  const tasks: Task[] = [
    { id: 'tsk_a1', tenantId: TENANT_A, projectId: 'prj_a1', title: 'acme merger contract review' },
    { id: 'tsk_a2', tenantId: TENANT_A, projectId: 'prj_a1', title: 'acme salary table update' },
    { id: 'tsk_b1', tenantId: TENANT_B, projectId: 'prj_b1', title: 'beta onboarding review' },
  ];
  for (const task of tasks) {
    store.tasks.set(task.id, task);
    indexTask(store, task);
  }
  return store;
}

// ---------------------------------------------------------------------------
// 2. API の輪郭
// ---------------------------------------------------------------------------

export type TaskApi = {
  /** 主キーによる単体取得 */
  getTask(tenantId: TenantId, taskId: string): Task | undefined;
  /** 全文検索 */
  searchTasks(tenantId: TenantId, term: string): Task[];
  /** タスクを別プロジェクトへ移す */
  moveTask(tenantId: TenantId, taskId: string, toProjectId: string): Task;
  /** 一覧 (キャッシュつき) */
  listTasksCached(tenantId: TenantId, projectId: string): Task[];
};

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

// ---------------------------------------------------------------------------
// 3. 境界の抜けた実装 (再現対象)
// ---------------------------------------------------------------------------

export function createUnsafeApi(store: Store, cache: Map<string, Task[]>): TaskApi {
  return {
    // L1: 所有者を検査していない
    getTask(_tenantId, taskId) {
      return store.tasks.get(taskId);
    },
    // L2: 索引を先に引き、テナント条件が後段にない
    searchTasks(_tenantId, term) {
      const ids = store.searchIndex.get(term.toLowerCase()) ?? new Set<string>();
      return [...ids].map((id) => store.tasks.get(id)).filter((task): task is Task => task !== undefined);
    },
    // L3: 移動元は検査しているが、移動先プロジェクトを検査していない
    moveTask(tenantId, taskId, toProjectId) {
      const task = store.tasks.get(taskId);
      if (!task || task.tenantId !== tenantId) throw new NotFoundError(taskId);
      const project = store.projects.get(toProjectId);
      if (!project) throw new NotFoundError(toProjectId);
      const moved: Task = { ...task, projectId: project.id, tenantId: project.tenantId };
      store.tasks.set(moved.id, moved);
      return moved;
    },
    // L4: キャッシュキーにテナント識別子が入っていない
    listTasksCached(tenantId, projectId) {
      const key = `tasks:${projectId}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const rows = [...store.tasks.values()].filter(
        (task) => task.projectId === projectId && task.tenantId === tenantId,
      );
      cache.set(key, rows);
      return rows;
    },
  };
}

// ---------------------------------------------------------------------------
// 4. ポリシー層 (14.20 の RLS 相当)
// ---------------------------------------------------------------------------

export type Session = {
  tenantId: TenantId | null;
  /** テーブル所有者としての接続かどうか。PostgreSQL の所有者バイパスに対応する */
  owner: boolean;
};

export type Policy<T> = {
  name: string;
  /** 見える行を決める (SELECT / UPDATE / DELETE の対象選択) */
  using(row: T, session: Session): boolean;
  /** 書ける行を決める (INSERT の新しい行 / UPDATE 後の行) */
  withCheck(row: T, session: Session): boolean;
};

export const tenantPolicy: Policy<{ tenantId: TenantId }> = {
  name: 'tenant_isolation',
  using: (row, session) => session.tenantId !== null && row.tenantId === session.tenantId,
  withCheck: (row, session) => session.tenantId !== null && row.tenantId === session.tenantId,
};

/**
 * 行アクセスにポリシーを適用する最小のエンジン。
 * force が false のとき、所有者接続はポリシーを迂回する (PostgreSQL の既定と同じ)。
 */
export class PolicyEngine {
  constructor(
    private readonly policy: Policy<{ tenantId: TenantId }>,
    private readonly force: boolean,
  ) {}

  private bypasses(session: Session): boolean {
    return session.owner && !this.force;
  }

  /** 読み取り: 見えない行は存在しないものとして扱う。 */
  visible<T extends { tenantId: TenantId }>(rows: readonly T[], session: Session): T[] {
    if (this.bypasses(session)) return [...rows];
    return rows.filter((row) => this.policy.using(row, session));
  }

  /** 書き込み: 結果の行がポリシーを満たさなければ拒否する。 */
  assertWritable<T extends { tenantId: TenantId }>(row: T, session: Session): T {
    if (this.bypasses(session)) return row;
    if (!this.policy.withCheck(row, session)) {
      throw new ForbiddenError(`row violates policy ${this.policy.name}`);
    }
    return row;
  }
}

/** すべての読み書きをポリシーエンジンへ通す実装。 */
export function createGuardedApi(
  store: Store,
  engine: PolicyEngine,
  session: Session,
  cache: Map<string, Task[]>,
): TaskApi {
  const visibleTask = (taskId: string): Task | undefined => {
    const row = store.tasks.get(taskId);
    if (!row) return undefined;
    return engine.visible([row], session)[0];
  };
  return {
    getTask(_tenantId, taskId) {
      return visibleTask(taskId);
    },
    searchTasks(_tenantId, term) {
      const ids = store.searchIndex.get(term.toLowerCase()) ?? new Set<string>();
      const rows = [...ids].map((id) => store.tasks.get(id)).filter((task): task is Task => task !== undefined);
      return engine.visible(rows, session);
    },
    moveTask(_tenantId, taskId, toProjectId) {
      const task = visibleTask(taskId);
      if (!task) throw new NotFoundError(taskId);
      const project = store.projects.get(toProjectId);
      const allowed = project ? engine.visible([project], session)[0] : undefined;
      if (!allowed) throw new NotFoundError(toProjectId);
      // 移動後の行に WITH CHECK を適用する。他テナントへは書き出せない
      const moved = engine.assertWritable({ ...task, projectId: allowed.id, tenantId: allowed.tenantId }, session);
      store.tasks.set(moved.id, moved);
      return moved;
    },
    listTasksCached(_tenantId, projectId) {
      // キャッシュキーにセッションのテナントを含める
      const key = `tasks:${session.tenantId ?? 'none'}:${projectId}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const rows = engine.visible(
        [...store.tasks.values()].filter((task) => task.projectId === projectId),
        session,
      );
      cache.set(key, rows);
      return rows;
    },
  };
}

// ---------------------------------------------------------------------------
// 5. 漏洩の探索
// ---------------------------------------------------------------------------

export type Leak = {
  id: 'L1' | 'L2' | 'L3' | 'L4';
  label: string;
  leaked: boolean;
  detail: string;
};

/**
 * 同じストアと同じキャッシュを共有する API を、テナントごとに作って渡す関数。
 * 境界の抜けた実装とポリシー層つき実装を、同じ探索へ差し替えられるようにする。
 */
export type ApiFactory = (store: Store, tenantId: TenantId, cache: Map<string, Task[]>) => TaskApi;

/**
 * テナントB の立場から、テナントA の資源へ到達できるかを4経路で試す。
 * 各試行の前にストアとキャッシュを作り直し、経路どうしが干渉しないようにする。
 */
export function probeLeaks(build: ApiFactory): Leak[] {
  const leaks: Leak[] = [];

  // L1: 主キー直接参照
  {
    const store = createStore();
    const api = build(store, TENANT_B, new Map());
    const task = api.getTask(TENANT_B, 'tsk_a1');
    leaks.push({
      id: 'L1',
      label: 'direct-id-read',
      leaked: task !== undefined,
      detail: task ? `read ${task.id} of ${task.tenantId}` : 'not found',
    });
  }

  // L2: 全文検索
  {
    const store = createStore();
    const api = build(store, TENANT_B, new Map());
    const found = api.searchTasks(TENANT_B, 'review').filter((task) => task.tenantId !== TENANT_B);
    leaks.push({
      id: 'L2',
      label: 'search-index',
      leaked: found.length > 0,
      detail: `foreign hits=${found.length}`,
    });
  }

  // L3: 親の付け替え
  {
    const store = createStore();
    const api = build(store, TENANT_B, new Map());
    let detail = 'rejected';
    let leaked = false;
    try {
      const moved = api.moveTask(TENANT_B, 'tsk_b1', 'prj_a1');
      leaked = moved.tenantId !== TENANT_B;
      detail = `moved into ${moved.projectId} of ${moved.tenantId}`;
    } catch (error) {
      detail = error instanceof Error ? error.constructor.name : 'error';
    }
    leaks.push({ id: 'L3', label: 'parent-reassign', leaked, detail });
  }

  // L4: キャッシュキー。テナントA の一覧が温めたキャッシュを、テナントB が引く
  {
    const store = createStore();
    const cache = new Map<string, Task[]>();
    build(store, TENANT_A, cache).listTasksCached(TENANT_A, 'prj_a1');
    const rows = build(store, TENANT_B, cache).listTasksCached(TENANT_B, 'prj_a1');
    const foreign = rows.filter((task) => task.tenantId !== TENANT_B);
    leaks.push({
      id: 'L4',
      label: 'cache-key',
      leaked: foreign.length > 0,
      detail: `foreign rows=${foreign.length}`,
    });
  }

  return leaks;
}

// ---------------------------------------------------------------------------
// 6. 接続の使い回しによる文脈の残留 (14.19 / 14.20)
// ---------------------------------------------------------------------------

export type Connection = { session: Session };

/** 物理接続を貸し出すだけの最小プール。返却時に何もしない点が事故の火種になる。 */
export class SessionPool {
  private readonly connections: Connection[];
  constructor(size: number) {
    this.connections = Array.from({ length: size }, () => ({ session: { tenantId: null, owner: false } }));
  }

  acquire(): Connection {
    const connection = this.connections.pop();
    if (!connection) throw new Error('pool exhausted');
    return connection;
  }

  release(connection: Connection): void {
    this.connections.push(connection);
  }
}

/**
 * プールから接続を借りてテナント文脈で実行する。
 * setLocal を false にすると、セッション変数を設定せずに前回の値へ依存する
 * (PostgreSQL で SET LOCAL を使わずに SET を使った場合に相当する)。
 */
export function withPooledSession<T>(
  pool: SessionPool,
  tenantId: TenantId,
  setLocal: boolean,
  run: (session: Session) => T,
): T {
  const connection = pool.acquire();
  try {
    if (setLocal || connection.session.tenantId === null) connection.session.tenantId = tenantId;
    return run(connection.session);
  } finally {
    if (setLocal) connection.session.tenantId = null; // トランザクション終了で戻る
    pool.release(connection);
  }
}

export type PoolProbe = { setLocal: boolean; leaked: boolean; observedTenant: TenantId | null };

/** 同じ物理接続を2回貸し出し、2回目に前の文脈が残るかを観測する。 */
export function probePoolReset(store: Store, engine: PolicyEngine, setLocal: boolean): PoolProbe {
  const pool = new SessionPool(1);
  withPooledSession(pool, TENANT_A, setLocal, (session) =>
    createGuardedApi(store, engine, session, new Map()).getTask(TENANT_A, 'tsk_a1'));
  return withPooledSession(pool, TENANT_B, setLocal, (session) => {
    const rows = createGuardedApi(store, engine, session, new Map()).searchTasks(TENANT_B, 'review');
    const foreign = rows.filter((task) => task.tenantId !== TENANT_B);
    return { setLocal, leaked: foreign.length > 0, observedTenant: session.tenantId };
  });
}

// ---------------------------------------------------------------------------
// 7. レポート
// ---------------------------------------------------------------------------

export type Report = {
  unguarded: Leak[];
  guarded: Leak[];
  ownerBypass: { withoutForce: boolean; withForce: boolean };
  pool: { withoutSetLocal: PoolProbe; withSetLocal: PoolProbe };
};

export function buildReport(): Report {
  const engine = new PolicyEngine(tenantPolicy, true);

  const ownerSession: Session = { tenantId: TENANT_B, owner: true };
  const rowsOfA = [...createStore().tasks.values()].filter((task) => task.tenantId === TENANT_A);
  const withoutForce = new PolicyEngine(tenantPolicy, false).visible(rowsOfA, ownerSession).length > 0;
  const withForce = new PolicyEngine(tenantPolicy, true).visible(rowsOfA, ownerSession).length > 0;

  return {
    unguarded: probeLeaks((store, _tenantId, cache) => createUnsafeApi(store, cache)),
    guarded: probeLeaks((store, tenantId, cache) =>
      createGuardedApi(store, engine, { tenantId, owner: false }, cache)),
    ownerBypass: { withoutForce, withForce },
    pool: {
      withoutSetLocal: probePoolReset(createStore(), engine, false),
      withSetLocal: probePoolReset(createStore(), engine, true),
    },
  };
}

export function formatReport(report: Report): string[] {
  const count = (leaks: readonly Leak[]) => leaks.filter((leak) => leak.leaked).length;
  return [
    `unguarded api: ${count(report.unguarded)}/${report.unguarded.length} leaks reproduced`,
    ...report.unguarded.map((leak) => `  ${leak.id} ${leak.label}: leaked=${leak.leaked} (${leak.detail})`),
    `guarded api: ${count(report.guarded)}/${report.guarded.length} leaks reproduced`,
    ...report.guarded.map((leak) => `  ${leak.id} ${leak.label}: leaked=${leak.leaked} (${leak.detail})`),
    `owner bypass: without force=${report.ownerBypass.withoutForce} / with force=${report.ownerBypass.withForce}`,
    `session pool: without SET LOCAL=${report.pool.withoutSetLocal.leaked} / with SET LOCAL=${report.pool.withSetLocal.leaked}`,
  ];
}
