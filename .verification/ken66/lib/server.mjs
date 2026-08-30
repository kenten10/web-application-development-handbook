// KEN-66: 演習ごとに localhost 静的サーバを立てる (依存ゼロ)。
// 外部ホストへは一切アクセスしない。Report-Only CSP を付けて
// 「同一オリジン以外を読み込んでいない」ことを違反件数0で機械的に示す。
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
};

export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function startServer({ root, port, log }) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(root, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
    let status = 200;
    // Chrome が全ページで自動要求する /favicon.ico は教材側に存在しない。
    // 検証ハーネス由来の 404 を Console エラーに混ぜないため 204 で応答する。
    if (pathname === '/favicon.ico') {
      res.writeHead(204, { 'content-security-policy-report-only': CSP_REPORT_ONLY });
      res.end();
      requests.push({ method: req.method, path: pathname, status: 204, at: Date.now() });
      if (log) log(`${req.method} ${pathname} -> 204 (harness stub)`);
      return;
    }
    try {
      if (!filePath.startsWith(path.resolve(root))) throw Object.assign(new Error('outside root'), { code: 'EACCES' });
      const data = await fs.readFile(filePath);
      res.writeHead(200, {
        'content-type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
        'content-security-policy-report-only': CSP_REPORT_ONLY,
        'service-worker-allowed': '/',
        'cache-control': 'no-cache',
      });
      res.end(data);
    } catch {
      status = 404;
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
    requests.push({ method: req.method, path: pathname, status, at: Date.now() });
    if (log) log(`${req.method} ${pathname} -> ${status}`);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    // localhost だけにバインドする (外部公開しない)
    server.listen(port, '127.0.0.1', () => {
      resolve({
        port,
        requests,
        origin: `http://localhost:${port}`,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections?.();
            server.close(() => done());
          }),
      });
    });
  });
}
