import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { discoverPages, renderPage, routeFromFilename, startServer } from './mini-ssr/solution/main.js';

// --- Service Worker を実際に動かすための最小ハーネス -------------------------
// ソース文字列の grep では「書いてあるか」しか分からず、挙動の誤りを見逃す。
// Cache Storage と fetch を差し替えた上で本物のイベントハンドラを呼び出す。
const APP_SHELL = ['/', '/index.html', '/app.js', '/style.css', '/offline.html', '/manifest.webmanifest'];
const ORIGIN = 'https://example.test';

// Cache Storage の鍵はパス名へ正規化する。Request でも文字列でも同じ物を指すようにする
function keyOf(target: string | { url: string }): string {
  const raw = typeof target === 'string' ? target : target.url;
  return raw.startsWith('http') ? new URL(raw).pathname : raw;
}

class Res {
  constructor(private readonly body: string, readonly ok = true) {}
  clone(): Res { return new Res(this.body, this.ok); }
  async text(): Promise<string> { return this.body; }
}

function loadServiceWorker() {
  const source = fs.readFileSync(new URL('./pwa-service-worker/solution/main.js', import.meta.url), 'utf8');
  const caches = new Map<string, Map<string, Res>>();
  const pending: Promise<unknown>[] = [];
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const state = {
    caches, online: true, networkBody: 'network', skipWaitingCalls: 0, claimCalls: 0,
    get cache() { return caches.get('webbook-v1') ?? new Map<string, Res>(); },
    async settle() { await Promise.allSettled(pending.splice(0)); },
    async dispatch(type: string, event: Record<string, unknown>) {
      const waits: Promise<unknown>[] = [];
      listeners.get(type)?.({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
      await Promise.all(waits);
    },
    async request(url: string, init: { mode: string }): Promise<Res> {
      let responded: Promise<Res> | undefined;
      const request = { url, method: 'GET', mode: init.mode };
      listeners.get('fetch')?.({ request, respondWith: (p: Promise<Res>) => { responded = p; } });
      assert.ok(responded, `fetch handler did not respond to ${url}`);
      return responded;
    },
  };

  const cacheApi = {
    async open(name: string) {
      if (!caches.has(name)) caches.set(name, new Map());
      const store = caches.get(name)!;
      return {
        async addAll(urls: string[]) { for (const u of urls) store.set(u, new Res(`shell:${u}`)); },
        async match(target: string | { url: string }) { return store.get(keyOf(target)); },
        async put(target: string | { url: string }, response: Res) { store.set(keyOf(target), response); },
      };
    },
    async keys() { return [...caches.keys()]; },
    async delete(name: string) { return caches.delete(name); },
  };

  const self_ = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (event: Record<string, unknown>) => void) => listeners.set(type, fn),
    skipWaiting: () => { state.skipWaitingCalls += 1; },
    clients: { claim: async () => { state.claimCalls += 1; } },
  };
  const fetchStub = async (request: { url: string } | string) => {
    if (!state.online) throw new Error('offline');
    const response = new Res(state.networkBody);
    return response;
  };
  const context = vm.createContext({
    self: self_, caches: cacheApi, fetch: fetchStub, URL, Promise, console,
    // put() は待たずに走るので、テスト側から待てるよう捕捉しておく
    queueMicrotask: (fn: () => void) => pending.push(Promise.resolve().then(fn)),
  });
  vm.runInContext(source, context, { filename: 'sw.js' });
  const originalPut = cacheApi.open;
  cacheApi.open = async (name: string) => {
    const cache = await originalPut(name);
    const put = cache.put.bind(cache);
    cache.put = async (target, response) => { const p = put(target, response); pending.push(p); return p; };
    return cache;
  };
  return state;
}

test('service worker caches the app shell and defers activation to SKIP_WAITING', async () => {
  const sw = loadServiceWorker();
  await sw.dispatch('install', {});
  assert.deepEqual([...sw.cache.keys()].sort(), [...APP_SHELL].sort());
  // install で skipWaiting してしまうと waiting 状態が作れず、更新の適用を制御できない
  assert.equal(sw.skipWaitingCalls, 0);
  await sw.dispatch('message', { data: { type: 'SKIP_WAITING' } });
  assert.equal(sw.skipWaitingCalls, 1);
});

test('service worker drops stale caches and claims clients on activate', async () => {
  const sw = loadServiceWorker();
  sw.caches.set('webbook-v0', new Map([['/', new Res('old')]]));
  await sw.dispatch('install', {});
  await sw.dispatch('activate', {});
  assert.deepEqual([...sw.caches.keys()], ['webbook-v1']);
  assert.equal(sw.claimCalls, 1);
});

test('offline navigation falls back to the cached shell, not offline.html', async () => {
  const sw = loadServiceWorker();
  await sw.dispatch('install', {});
  sw.online = false;
  const response = await sw.request('https://example.test/index.html', { mode: 'navigate' });
  assert.equal(await response.text(), 'shell:/index.html');
});

test('offline navigation to an uncached route still serves the app shell', async () => {
  const sw = loadServiceWorker();
  await sw.dispatch('install', {});
  sw.online = false;
  const response = await sw.request('https://example.test/not-cached', { mode: 'navigate' });
  assert.equal(await response.text(), 'shell:/index.html');
});

test('offline navigation falls back to offline.html when no shell is cached', async () => {
  const sw = loadServiceWorker();
  await sw.dispatch('install', {});
  sw.cache.delete('/index.html');
  sw.online = false;
  const response = await sw.request('https://example.test/not-cached', { mode: 'navigate' });
  assert.equal(await response.text(), 'shell:/offline.html');
});

test('stale-while-revalidate serves the cache first and refreshes behind it', async () => {
  const sw = loadServiceWorker();
  await sw.dispatch('install', {});
  sw.cache.set('/app.js', new Res('cached-app'));
  sw.networkBody = 'fresh-app';
  const first = await sw.request('https://example.test/app.js', { mode: 'same-origin' });
  assert.equal(await first.text(), 'cached-app');
  await sw.settle();
  assert.equal(await sw.cache.get('/app.js')!.text(), 'fresh-app');
});

test('the web app manifest declares a standalone display mode', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('./pwa-service-worker/solution/manifest.webmanifest', import.meta.url), 'utf8')) as { display: string };
  assert.equal(manifest.display, 'standalone');
});

test('routeFromFilename implements file-based routes', () => {
  assert.equal(routeFromFilename('index.mjs'), '/');
  assert.equal(routeFromFilename('about.mjs'), '/about');
  assert.equal(routeFromFilename('blog/index.mjs'), '/blog');
});

test('SSR renders props and hydration marker', async () => {
  const html = await renderPage({
    getServerSideProps: ({ query }) => ({ props: { name: query.get('name') } }),
    default: (props) => `<h1>Hello ${String(props.name)}</h1>`,
  }, { pathname: '/', query: new URLSearchParams('name=Alice') });
  assert.match(html, /Hello Alice/);
  assert.match(html, /__SSR_PROPS__/);
  assert.match(html, /__HYDRATED__/);
});

test('SSR server returns page and 404', async () => {
  const routes = new Map([['/', { default: () => '<h1>Home</h1>' }]]);
  const running = await startServer(routes);
  try {
    const ok = await fetch(`http://127.0.0.1:${running.port}/`);
    assert.equal(ok.status, 200);
    assert.match(await ok.text(), /Home/);
    assert.equal((await fetch(`http://127.0.0.1:${running.port}/missing`)).status, 404);
  } finally { await running.close(); }
});

test('discoverPages loads default-exported modules', async () => {
  const directory = fs.mkdtempSync('/tmp/mini-ssr-pages-');
  fs.writeFileSync(path.join(directory, 'index.mjs'), "export default () => '<h1>Index</h1>'");
  fs.writeFileSync(path.join(directory, 'about.mjs'), "export const getServerSideProps=()=>({props:{x:1}}); export default p => '<p>'+p.x+'</p>'");
  const routes = await discoverPages(directory);
  assert.deepEqual([...routes.keys()].sort(), ['/', '/about']);
});
