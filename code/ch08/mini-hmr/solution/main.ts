import fs from 'node:fs';
import http, { type Server } from 'node:http';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export function createClientScript(eventPath = '/events'): string {
  return `const source = new EventSource('${eventPath}');\nsource.onmessage = async (event) => {\n  const update = JSON.parse(event.data);\n  const started = performance.now();\n  const module = await import(update.url + '?t=' + update.timestamp);\n  module.render?.(document.querySelector('#app'));\n  console.log('hmr-ms', (performance.now() - started).toFixed(2));\n};`;
}

export function startHmrServer(moduleFile: string, port = 0): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const clients = new Set<http.ServerResponse>();
  const absolute = path.resolve(moduleFile);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      response.write(': connected\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (url.pathname === '/module.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
      response.end(fs.readFileSync(absolute));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><div id="app"></div><script type="module">${createClientScript()}\nimport('/module.js').then(m=>m.render?.(document.querySelector('#app')))</script>`);
  });
  const watcher = fs.watch(absolute, () => {
    const message = JSON.stringify({ type: 'update', url: '/module.js', timestamp: Date.now() });
    for (const client of clients) client.write(`data: ${message}\n\n`);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not determine port'));
      resolve({
        server,
        port: address.port,
        close: () => new Promise<void>((done, fail) => { watcher.close(); server.close((error) => error ? fail(error) : done()); }),
      });
    });
  });
}

export async function measureReload(operation: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await operation();
  return performance.now() - start;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node main.js <module.js>');
  const running = await startHmrServer(file, Number(process.env.PORT ?? 3001));
  console.log(`HMR server: http://127.0.0.1:${running.port}`);
}

export const exerciseId = '8.3';
