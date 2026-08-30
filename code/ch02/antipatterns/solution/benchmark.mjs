import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';

const count = Number(process.env.COUNT ?? 100);
const small = Buffer.alloc(256, 0x61);
const bundled = Buffer.alloc(256 * count, 0x61);
const json = Buffer.from(JSON.stringify({ rows: Array.from({ length: 5000 }, (_, id) => ({ id, value: 'x'.repeat(32) })) }));
const gzipped = gzipSync(json);
const server = http.createServer((request, response) => {
  if (request.url === '/small') return response.writeHead(200, { 'content-length': small.length }).end(small);
  if (request.url === '/bundle') return response.writeHead(200, { 'content-length': bundled.length }).end(bundled);
  if (request.url === '/json') {
    const gzip = /gzip/.test(request.headers['accept-encoding'] ?? '');
    const body = gzip ? gzipped : json;
    return response.writeHead(200, { 'content-length': body.length, ...(gzip ? { 'content-encoding': 'gzip' } : {}) }).end(body);
  }
  response.writeHead(404).end();
});

function get(path, agent, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path, agent, headers }, (response) => {
      response.resume(); response.once('end', resolve);
    }).once('error', reject);
  });
}
async function measure(label, fn) { const start = performance.now(); await fn(); return { label, ms: +(performance.now() - start).toFixed(1) }; }

server.listen(0, '127.0.0.1', async () => {
  try {
    const keepAlive = new http.Agent({ keepAlive: true, maxSockets: 10 });
    const results = [];
    results.push(await measure(`${count} small requests`, async () => { for (let i = 0; i < count; i++) await get('/small', keepAlive); }));
    results.push(await measure('one bundled request', () => get('/bundle', keepAlive)));
    results.push(await measure('no keep-alive', async () => { for (let i = 0; i < Math.min(count, 30); i++) await get('/small', false); }));
    results.push(await measure('keep-alive', async () => { for (let i = 0; i < Math.min(count, 30); i++) await get('/small', keepAlive); }));
    results.push(await measure('large JSON without gzip', () => get('/json', keepAlive)));
    results.push(await measure('large JSON with gzip', () => get('/json', keepAlive, { 'accept-encoding': 'gzip' })));
    keepAlive.destroy();
    console.table(results);
    console.log(`plain JSON=${json.length} bytes, gzip=${gzipped.length} bytes`);
  } finally { server.close(); }
});
