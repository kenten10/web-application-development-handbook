// KEN-66: 依存ゼロの Chrome DevTools Protocol クライアント。
// Node 24+ のグローバル WebSocket / fetch のみを使う (npm 依存を追加しない)。
import { setTimeout as sleep } from 'node:timers/promises';

export async function waitForEndpoint(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw new Error(`DevTools endpoint (port ${port}) に接続できません: ${lastError}`);
}

// ブラウザターゲットへ1本だけ WebSocket を張り、flatten session で
// page / service_worker のセッションを多重化する。
export class Browser {
  #ws;
  #nextId = 1;
  #pending = new Map();
  #listeners = new Set();

  static async connect(webSocketDebuggerUrl) {
    const browser = new Browser();
    await browser.#open(webSocketDebuggerUrl);
    return browser;
  }

  #open(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.#ws = ws;
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (event) => reject(new Error(`WebSocket error: ${event?.message ?? 'unknown'}`)));
      ws.addEventListener('message', (event) => this.#onMessage(String(event.data)));
      ws.addEventListener('close', () => {
        for (const { reject: rj } of this.#pending.values()) rj(new Error('CDP connection closed'));
        this.#pending.clear();
      });
    });
  }

  #onMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.id !== undefined) {
      const entry = this.#pending.get(message.id);
      if (!entry) return;
      this.#pending.delete(message.id);
      if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
      else entry.resolve(message.result ?? {});
      return;
    }
    for (const listener of this.#listeners) {
      try {
        listener(message);
      } catch {
        /* リスナ例外で計測を止めない */
      }
    }
  }

  on(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  send(method, params = {}, sessionId) {
    const id = this.#nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.#ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.#pending.has(id)) {
          this.#pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 30000);
    });
  }

  close() {
    try {
      this.#ws.close();
    } catch {
      /* noop */
    }
  }
}

export async function waitFor(predicate, { timeout = 15000, interval = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await sleep(interval);
  }
  throw new Error(`waitFor timeout: ${label}`);
}

export { sleep };
