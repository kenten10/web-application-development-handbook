// Starter for 9.2 課題9.2: Service Worker でオフライン対応 (★★)
//
// アプリシェル (index.html / app.js / style.css / offline.html / manifest.webmanifest) は
// この starter に揃えてある。実装するのは、このファイルの Service Worker だけである。
//
// 配信して開く:
//   npx http-server code/ch09/pwa-service-worker/starter -p 8080
//   http://localhost:8080/index.html
// Service Worker は http://localhost か HTTPS でしか登録できない。file:// では動かない。

export const exerciseId = '9.2';

const CACHE_VERSION = 'webbook-v1';
const APP_SHELL = ['/', '/index.html', '/app.js', '/style.css', '/offline.html', '/manifest.webmanifest'];

// TODO(1) install: APP_SHELL を CACHE_VERSION のキャッシュへ入れる。
//   event.waitUntil で完了まで待たせること。
//   ここで skipWaiting() を呼ぶと waiting 状態が発生せず、TODO(5) の更新経路を観察できなくなる。
self.addEventListener('install', (event) => {
  // 実装する
});

// TODO(2) activate: CACHE_VERSION 以外の古いキャッシュを消し、clients.claim() で
//   既存のタブを新しい Service Worker の管理下へ入れる。
self.addEventListener('activate', (event) => {
  // 実装する
});

// TODO(3) fetch (ナビゲーション): まずネットワークを試す。失敗したら
//   「要求されたURLのキャッシュ → アプリシェル (/index.html) → /offline.html」の順に落とす。
//   いきなり offline.html を返すと、キャッシュ済みのアプリが表示できなくなる。
//
// TODO(4) fetch (それ以外): stale-while-revalidate。
//   キャッシュがあれば即座に返し、裏でネットワークから取り直してキャッシュを更新する。
self.addEventListener('fetch', (event) => {
  // GET 以外と、別オリジンへの要求は素通しする
  // 実装する
});

// TODO(5) message: { type: 'SKIP_WAITING' } を受け取ったら skipWaiting() を呼ぶ。
//   ページ側から明示的に更新を適用させるための経路。
self.addEventListener('message', (event) => {
  // 実装する
});
