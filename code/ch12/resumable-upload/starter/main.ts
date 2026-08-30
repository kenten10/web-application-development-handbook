// Starter for 12.6 課題12.6: 再開可能アップロードの中断を再現して直す (★★★)
// Purpose: 本文 12.13 の署名条件と 12.14 のオフセット条件・回収を、
//          動くコードとして再現し、修正実装では再現しなくなることを確かめる。
//
// 手順:
//   1. FakeStorage と Server の型を読み、台帳 (再起動で残る) と memoryOffset (消える) の違いを掴む。
//   2. issueGrant を実装する。fixed では上限を許可証へ含め、ストレージに強制させる。
//   3. headSession を実装する。fixed では保存済みバイト列の実長から導く。
//   4. patchChunk を実装する。fixed ではオフセットの一致を書き込みの条件にする。
//   5. collectExpired を実装し、runFindings が naive 4/4、fixed 0/4 を返すところまで通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch12 exec tsx resumable-upload/starter/report.ts
//
// 注意: 期待値を runFindings へ直書きしない。サーバの戻り値とストレージの状態だけから判定すること。

export class ConflictError extends Error {}
export class PayloadTooLargeError extends Error {}
export class NotFoundError extends Error {}
export class LinkError extends Error {}

export const MIB = 1024 * 1024;
export const CHUNK_BYTES = 4 * MIB;

export type Mode = 'naive' | 'fixed';

export type Grant = {
  readonly sessionId: string;
  readonly key: string;
  readonly declaredBytes: number;
  /** 署名条件に相当する。null は「上限を条件へ入れなかった」ことを表す。 */
  readonly maxBytes: number | null;
  readonly expiresAt: number;
};

export type SessionRow = {
  readonly id: string;
  readonly key: string;
  readonly declaredBytes: number;
  readonly expiresAt: number;
  readonly maxBytes: number | null;
};

// ---------------------------------------------------------------------------
// 1. ストレージの模擬
// ---------------------------------------------------------------------------

/** メモリ上のオブジェクトストレージ。中身は 1 バイト値の繰り返しで、長さだけが意味を持つ。 */
export class FakeStorage {
  private readonly parts = new Map<string, Uint8Array[]>();

  create(key: string): void {
    this.parts.set(key, []);
  }

  has(key: string): boolean {
    return this.parts.has(key);
  }

  /** 保存済みバイト数。これが受信済みオフセットの唯一の根拠になる。 */
  length(key: string): number {
    const list = this.parts.get(key);
    if (!list) throw new NotFoundError(`no object: ${key}`);
    let total = 0;
    for (const part of list) total += part.byteLength;
    return total;
  }

  /**
   * 追記する。maxBytes を超える書き込みは拒否する。
   * 「追記」と「長さの確定」が同じ1操作なので、途中で落ちても不整合にならない。
   */
  append(key: string, chunk: Uint8Array, maxBytes: number | null): number {
    const list = this.parts.get(key);
    if (!list) throw new NotFoundError(`no object: ${key}`);
    let total = 0;
    for (const part of list) total += part.byteLength;
    if (maxBytes !== null && total + chunk.byteLength > maxBytes) {
      throw new PayloadTooLargeError(`grant limit ${maxBytes} exceeded`);
    }
    list.push(chunk);
    return total + chunk.byteLength;
  }

  remove(key: string): number {
    const size = this.has(key) ? this.length(key) : 0;
    this.parts.delete(key);
    return size;
  }

  keys(): string[] {
    return [...this.parts.keys()];
  }
}

// ---------------------------------------------------------------------------
// 2. サーバ
// ---------------------------------------------------------------------------

export type Server = {
  readonly mode: Mode;
  readonly storage: FakeStorage;
  /** 台帳。DBの行に相当し、プロセス再起動で消えない。 */
  readonly sessions: Map<string, SessionRow>;
  /** プロセスメモリ上のオフセット。再起動で消える。naive 側だけがこれに頼る。 */
  readonly memoryOffset: Map<string, number>;
  nextId: number;
};

export function createServer(mode: Mode): Server {
  return { mode, storage: new FakeStorage(), sessions: new Map(), memoryOffset: new Map(), nextId: 1 };
}

/** プロセス再起動を模す。台帳は残り、メモリ上の状態だけが消える。 */
export function restart(server: Server): void {
  server.memoryOffset.clear();
}

/**
 * TODO: 許可証を発行する。
 * fixed では上限 (declaredBytes) を許可証の maxBytes へ入れ、ストレージ側で強制させる。
 * naive では null のままにする。台帳に控えるだけでは書き込みを縛れないことを確かめる。
 */
export function issueGrant(server: Server, request: { declaredBytes: number; ttlMs: number; now: number }): Grant {
  const id = `up_${server.nextId++}`;
  const key = `uploads/${id}`;
  const maxBytes: number | null = null; // TODO: fixed では request.declaredBytes を入れる
  server.sessions.set(id, {
    id,
    key,
    declaredBytes: request.declaredBytes,
    expiresAt: request.now + request.ttlMs,
    maxBytes,
  });
  server.storage.create(key);
  server.memoryOffset.set(id, 0);
  return { sessionId: id, key, declaredBytes: request.declaredBytes, maxBytes, expiresAt: request.now + request.ttlMs };
}

function sessionOf(server: Server, sessionId: string): SessionRow {
  const row = server.sessions.get(sessionId);
  if (!row) throw new NotFoundError(`no session: ${sessionId}`);
  return row;
}

/**
 * TODO: 受信済みバイト数を返す (tus の HEAD に相当)。
 * fixed では保存済みバイト列の実長 (server.storage.length) から導く。
 * naive はプロセスメモリ上の値を返すため、restart の後に 0 へ戻る。
 */
export function headSession(server: Server, sessionId: string): number {
  sessionOf(server, sessionId);
  return server.memoryOffset.get(sessionId) ?? 0;
}

/**
 * TODO: 追記する (tus の PATCH に相当)。
 * fixed では、書き込みの前に次の2つを条件として確かめる。
 *   1. offset が受信済みバイト数と一致すること。違えば ConflictError を投げ、書き込まない。
 *   2. offset + chunk.byteLength が declaredBytes を超えないこと。
 * naive はどちらも見ずに末尾へ足すため、再送が二重書き込みになる。
 */
export function patchChunk(server: Server, sessionId: string, offset: number, chunk: Uint8Array): number {
  const row = sessionOf(server, sessionId);
  void offset;
  const next = server.storage.append(row.key, chunk, row.maxBytes);
  server.memoryOffset.set(sessionId, next);
  return next;
}

export type Collected = { sessions: number; bytes: number };

/**
 * TODO: 期限切れの未完了セッションを回収する。
 * fixed では、期限を過ぎていて、かつ保存済みバイト数が declaredBytes に達していない
 * セッションについて、ストレージの実体と台帳の行の両方を消し、件数と回収バイト数を返す。
 * naive は何もしないため、占有が残り続ける。
 */
export function collectExpired(server: Server, now: number): Collected {
  void now;
  void server;
  return { sessions: 0, bytes: 0 };
}

/** 未完了のまま残っているセッションの数と占有バイト数。 */
export function retained(server: Server, now: number): Collected {
  let sessions = 0;
  let bytes = 0;
  for (const row of server.sessions.values()) {
    if (row.expiresAt > now) continue;
    const stored = server.storage.length(row.key);
    if (stored >= row.declaredBytes) continue;
    sessions += 1;
    bytes += stored;
  }
  return { sessions, bytes };
}

// ---------------------------------------------------------------------------
// 3. 回線とクライアント
// ---------------------------------------------------------------------------

/** 決まった位置で必ず切れる回線。乱数を使わないため、実行のたびに同じ結果になる。 */
export type Link = {
  /** 何バイト転送した時点で切るか。null なら切らない。 */
  cutAfterBytes: number | null;
  /** 応答を落とす転送位置 (クライアントは送信成功を知らない)。 */
  dropAckAtBytes: number | null;
  transferred: number;
};

export function createLink(options: Partial<Omit<Link, 'transferred'>> = {}): Link {
  return { cutAfterBytes: options.cutAfterBytes ?? null, dropAckAtBytes: options.dropAckAtBytes ?? null, transferred: 0 };
}

const chunkOf = (size: number): Uint8Array => new Uint8Array(size).fill(1);

export type SendResult = { sentBytes: number; cut: boolean; ackLostAt: number | null };

/**
 * オフセットから最後まで送る。回線が切れたら LinkError を投げずに cut=true で返す。
 * 送信バイト数を数えるのがこの関数の役目で、再開の効率はこの値で測る。
 */
export function sendFrom(
  server: Server,
  grant: Grant,
  totalBytes: number,
  startOffset: number,
  link: Link,
  chunkBytes = CHUNK_BYTES,
): SendResult {
  let offset = startOffset;
  let sent = 0;
  let ackLostAt: number | null = null;
  while (offset < totalBytes) {
    const size = Math.min(chunkBytes, totalBytes - offset);
    if (link.cutAfterBytes !== null && link.transferred + size > link.cutAfterBytes) {
      return { sentBytes: sent, cut: true, ackLostAt };
    }
    try {
      patchChunk(server, grant.sessionId, offset, chunkOf(size));
    } catch (error) {
      if (error instanceof PayloadTooLargeError) return { sentBytes: sent, cut: false, ackLostAt };
      throw error;
    }
    sent += size;
    link.transferred += size;
    if (link.dropAckAtBytes !== null && offset + size === link.dropAckAtBytes) {
      // 書き込みは成功したが、クライアントは応答を受け取れなかった。
      ackLostAt = offset;
      return { sentBytes: sent, cut: false, ackLostAt };
    }
    offset += size;
  }
  return { sentBytes: sent, cut: false, ackLostAt };
}

/** 中断後の再開。必ず HEAD で問い合わせてから続きを送る (記憶した値は使わない)。 */
export function resume(server: Server, grant: Grant, totalBytes: number, link: Link): SendResult {
  const offset = headSession(server, grant.sessionId);
  return sendFrom(server, grant, totalBytes, offset, link);
}

// ---------------------------------------------------------------------------
// 4. 4件の再現
// ---------------------------------------------------------------------------

export type Finding = {
  id: 'U1' | 'U2' | 'U3' | 'U4';
  label: string;
  naive: string;
  fixed: string;
  reproduced: boolean;
  remains: boolean;
};

export const FIXTURES = {
  now: 1_800_000_000_000,
  ttlMs: 15 * 60 * 1000,
  /** U1: 申告 5MiB に対して 30MiB を送りつける */
  oversize: { declaredBytes: 5 * MIB, actualBytes: 30 * MIB },
  /** U2: 12MiB のうち 8MiB まで送った時点で回線が切れる */
  resume: { totalBytes: 12 * MIB, cutAfterBytes: 8 * MIB },
  /** U3: 8MiB の2チャンク目で応答を取りこぼし、同じチャンクを再送する */
  duplicate: { totalBytes: 8 * MIB, dropAckAtBytes: 8 * MIB },
  /** U4: 4MiB まで送って放置されたセッションが3件 */
  orphan: { count: 3, declaredBytes: 12 * MIB, storedBytes: 4 * MIB },
} as const;

/** U1: 上限を許可証へ入れたかどうかで、書き込める量が変わる。 */
export function probeOversize(mode: Mode): { stored: number; declared: number } {
  const server = createServer(mode);
  const { declaredBytes, actualBytes } = FIXTURES.oversize;
  const grant = issueGrant(server, { declaredBytes, ttlMs: FIXTURES.ttlMs, now: FIXTURES.now });
  sendFrom(server, grant, actualBytes, 0, createLink());
  return { stored: server.storage.length(grant.key), declared: declaredBytes };
}

/** U2: 再起動の後に受信済みオフセットを答えられるかどうかで、再送量が変わる。 */
export function probeResume(mode: Mode): { resent: number; minimum: number } {
  const server = createServer(mode);
  const { totalBytes, cutAfterBytes } = FIXTURES.resume;
  const grant = issueGrant(server, { declaredBytes: totalBytes, ttlMs: FIXTURES.ttlMs, now: FIXTURES.now });
  const first = sendFrom(server, grant, totalBytes, 0, createLink({ cutAfterBytes }));
  restart(server);
  const second = resume(server, grant, totalBytes, createLink());
  return { resent: second.sentBytes, minimum: totalBytes - first.sentBytes };
}

/** U3: オフセットを条件にするかどうかで、再送が二重書き込みになるかが変わる。 */
export function probeDuplicate(mode: Mode): { stored: number; declared: number } {
  const server = createServer(mode);
  const { totalBytes, dropAckAtBytes } = FIXTURES.duplicate;
  const grant = issueGrant(server, { declaredBytes: totalBytes, ttlMs: FIXTURES.ttlMs, now: FIXTURES.now });
  const link = createLink({ dropAckAtBytes });
  const first = sendFrom(server, grant, totalBytes, 0, link);
  // 応答を取りこぼしたので、クライアントは同じチャンクをもう一度送る。
  if (first.ackLostAt !== null) {
    const size = Math.min(CHUNK_BYTES, totalBytes - first.ackLostAt);
    try {
      patchChunk(server, grant.sessionId, first.ackLostAt, chunkOf(size));
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      // 409 を受けたら HEAD で問い合わせ直す。ここでは既に完了している。
    }
  }
  return { stored: server.storage.length(grant.key), declared: totalBytes };
}

/** U4: 中断セッションを回収するかどうかで、占有が残るかが変わる。 */
export function probeOrphan(mode: Mode): { collected: Collected; retained: Collected } {
  const server = createServer(mode);
  const { count, declaredBytes, storedBytes } = FIXTURES.orphan;
  for (let i = 0; i < count; i += 1) {
    const grant = issueGrant(server, { declaredBytes, ttlMs: FIXTURES.ttlMs, now: FIXTURES.now });
    sendFrom(server, grant, storedBytes, 0, createLink());
  }
  const later = FIXTURES.now + FIXTURES.ttlMs + 1;
  const collected = collectExpired(server, later);
  return { collected, retained: retained(server, later) };
}

/**
 * TODO: 4件について、naive と fixed の観測値を集めて Finding を組み立てる。
 * reproduced は「naive で失敗が再現したか」、remains は「fixed にも失敗が残るか」。
 * 期待値をここへ直書きせず、probe* の戻り値どうしの比較から判定すること。
 *
 * 例: U1 は naive.stored > naive.declared なら reproduced、
 *     fixed.stored > fixed.declared なら remains になる。
 */
export function runFindings(): Finding[] {
  return [];
}

export function formatReport(findings: readonly Finding[]): string[] {
  const reproduced = findings.filter((finding) => finding.reproduced).length;
  const remaining = findings.filter((finding) => finding.remains).length;
  return [
    `naive server: ${reproduced}/${findings.length} failures reproduced`,
    ...findings.map((finding) => `  ${finding.id} ${finding.label}: naive ${finding.naive} / fixed ${finding.fixed}`),
    `fixed server: ${remaining}/${findings.length} failures remaining`,
  ];
}
