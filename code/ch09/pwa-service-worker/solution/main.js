const CACHE_VERSION = 'webbook-v1';
const APP_SHELL = ['/', '/index.html', '/app.js', '/style.css', '/offline.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  // ここで skipWaiting() を呼ぶと waiting 状態が発生せず、更新の適用を
  // ページ側から制御できなくなる。待機は残し、下の SKIP_WAITING で明示的に進める
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  if (cached) {
    refresh.catch(() => undefined);
    return cached;
  }
  return refresh;
}

async function navigateWithFallback(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    return await fetch(request);
  } catch {
    // 無条件に offline.html を返すと、キャッシュ済みのアプリシェルがあっても
    // オフライン時に「接続できません」の画面しか出せない。
    // 要求されたURL → アプリシェル → offline.html の順に落とす
    return (
      (await cache.match(request)) ??
      (await cache.match('/index.html')) ??
      (await cache.match('/offline.html'))
    );
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(navigateWithFallback(event.request));
    return;
  }
  event.respondWith(staleWhileRevalidate(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
