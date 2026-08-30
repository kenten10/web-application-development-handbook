// Starter for 13.7 課題13.7: テナント境界の漏洩を再現して塞ぐ (★★★)
// Purpose: 本文 13.24 の「テナント境界が破れる典型経路」から4件を動くコードとして再現し、
//          14.20 の Row-Level Security に相当するポリシー層を通すと再現しなくなることを確かめる。
//
// 手順:
//   1. createUnsafeApi を読み、4つの経路それぞれで何の検査が抜けているかを言葉にする。
//   2. probeLeaks を実装し、テナントB のセッションからテナントA の資源へ到達できることを
//      4件すべて検出する (4/4 leaks reproduced になるまで)。
//   3. PolicyEngine と createGuardedApi を実装し、同じ probeLeaks が 0/4 になるまで通す。
//   4. 所有者バイパス (force なし) と FORCE 相当 (force あり) の違いを再現する。
//   5. probePoolReset を実装し、SET LOCAL 相当の有無で結果が変わることを確かめる。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch13 exec tsx tenant-isolation/starter/report.ts
//
// 注意: 期待値を probeLeaks へ直書きしない。API の戻り値だけから漏洩を判定すること。

// ---------------------------------------------------------------------------
// 1. データストア (与えてある)
// ---------------------------------------------------------------------------

export type TenantId = string;

export type Project = { id: string; tenantId: TenantId; name: string };
export type Task = { id: string; tenantId: TenantId; projectId: string; title: string };

export type Store = {
  projects: Map<string, Project>;
  tasks: Map<string, Task>;
  /** 全文検索の索引。語 → タスクID。テナントで分かれていない */
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
// 2. API の輪郭 (与えてある)
// ---------------------------------------------------------------------------

export type TaskApi = {
  getTask(tenantId: TenantId, taskId: string): Task | undefined;
  searchTasks(tenantId: TenantId, term: string): Task[];
  moveTask(tenantId: TenantId, taskId: string, toProjectId: string): Task;
  listTasksCached(tenantId: TenantId, projectId: string): Task[];
};

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

// ---------------------------------------------------------------------------
// 3. 境界の抜けた実装 (与えてある。直さずに再現対象として使う)
// ---------------------------------------------------------------------------

export function createUnsafeApi(store: Store, cache: Map<string, Task[]>): TaskApi {
  return {
    getTask(_tenantId, taskId) {
      return store.tasks.get(taskId);
    },
    searchTasks(_tenantId, term) {
      const ids = store.searchIndex.get(term.toLowerCase()) ?? new Set<string>();
      return [...ids].map((id) => store.tasks.get(id)).filter((task): task is Task => task !== undefined);
    },
    moveTask(tenantId, taskId, toProjectId) {
      const task = store.tasks.get(taskId);
      if (!task || task.tenantId !== tenantId) throw new NotFoundError(taskId);
      const project = store.projects.get(toProjectId);
      if (!project) throw new NotFoundError(toProjectId);
      const moved: Task = { ...task, projectId: project.id, tenantId: project.tenantId };
      store.tasks.set(moved.id, moved);
      return moved;
    },
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
  /** テーブル所有者としての接続か。PostgreSQL の所有者バイパスに対応する */
  owner: boolean;
};

export type Policy<T> = {
  name: string;
  using(row: T, session: Session): boolean;
  withCheck(row: T, session: Session): boolean;
};

/** TODO: USING と WITH CHECK を定義する。tenantId が未設定のセッションを通さないこと。 */
export const tenantPolicy: Policy<{ tenantId: TenantId }> = {
  name: 'tenant_isolation',
  using: () => true,
  withCheck: () => true,
};

/**
 * TODO: 行アクセスにポリシーを適用する最小のエンジン。
 * force が false のとき、所有者接続はポリシーを迂回する (PostgreSQL の既定と同じ)。
 */
export class PolicyEngine {
  constructor(
    private readonly policy: Policy<{ tenantId: TenantId }>,
    private readonly force: boolean,
  ) {}

  /** TODO: 見えない行を取り除く。 */
  visible<T extends { tenantId: TenantId }>(rows: readonly T[], session: Session): T[] {
    void session;
    void this.policy;
    void this.force;
    return [...rows];
  }

  /** TODO: 結果の行がポリシーを満たさなければ ForbiddenError を投げる。 */
  assertWritable<T extends { tenantId: TenantId }>(row: T, session: Session): T {
    void session;
    return row;
  }
}

/** TODO: すべての読み書きをポリシーエンジンへ通す実装を書く。cache は API 間で共有される。 */
export function createGuardedApi(
  store: Store,
  engine: PolicyEngine,
  session: Session,
  cache: Map<string, Task[]>,
): TaskApi {
  void engine;
  void session;
  return createUnsafeApi(store, cache);
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

/** 同じストアと同じキャッシュを共有する API を、テナントごとに作って渡す関数。 */
export type ApiFactory = (store: Store, tenantId: TenantId, cache: Map<string, Task[]>) => TaskApi;

/**
 * TODO: テナントB の立場から、テナントA の資源へ到達できるかを4経路で試す。
 * 各試行の前に createStore() でストアを作り直し、経路どうしが干渉しないようにする。
 *   L1 direct-id-read   : getTask(TENANT_B, 'tsk_a1')
 *   L2 search-index     : searchTasks(TENANT_B, 'review')
 *   L3 parent-reassign  : moveTask(TENANT_B, 'tsk_b1', 'prj_a1')
 *   L4 cache-key        : 同じ cache を渡した A の API で温めてから、B の API で引く
 */
export function probeLeaks(build: ApiFactory): Leak[] {
  void build;
  return [];
}

// ---------------------------------------------------------------------------
// 6. 接続の使い回しによる文脈の残留 (14.19 / 14.20)
// ---------------------------------------------------------------------------

export type Connection = { session: Session };

/** 与えてある: 物理接続を貸し出すだけの最小プール。返却時に何もしない。 */
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
 * TODO: プールから接続を借りてテナント文脈で実行する。
 * setLocal が true のときだけ、借りるたびに設定し、返す前に消す。
 * false のときは「既に値が入っていればそのまま使う」挙動にする。
 */
export function withPooledSession<T>(
  pool: SessionPool,
  tenantId: TenantId,
  setLocal: boolean,
  run: (session: Session) => T,
): T {
  void tenantId;
  void setLocal;
  const connection = pool.acquire();
  try {
    return run(connection.session);
  } finally {
    pool.release(connection);
  }
}

export type PoolProbe = { setLocal: boolean; leaked: boolean; observedTenant: TenantId | null };

/** TODO: 同じ物理接続を2回貸し出し、2回目に前の文脈が残るかを観測する。 */
export function probePoolReset(store: Store, engine: PolicyEngine, setLocal: boolean): PoolProbe {
  void store;
  void engine;
  // ヒント: withPooledSession で A → B の順に借り、2回目に見えるタスクを調べる
  return { setLocal, leaked: false, observedTenant: null };
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

/** TODO: 上で実装した部品を組み合わせ、レポートを作る。 */
export function buildReport(): Report {
  const engine = new PolicyEngine(tenantPolicy, true);
  return {
    unguarded: probeLeaks((store, _tenantId, cache) => createUnsafeApi(store, cache)),
    guarded: probeLeaks((store, tenantId, cache) =>
      createGuardedApi(store, engine, { tenantId, owner: false }, cache)),
    ownerBypass: { withoutForce: false, withForce: false },
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
