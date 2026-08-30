import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { after, before, test } from 'node:test';
import { createBlogServer } from './blog-api/solution.js';
import { parseHttpResponse } from './raw-http-client.solution.js';
import { createRawHttpServer } from './raw-http-server.solution.js';

const rawServer = createRawHttpServer();
const blogServer = createBlogServer();
let rawPort = 0;
let blogPort = 0;

before(async () => {
  await new Promise<void>((resolve) => rawServer.listen(0, '127.0.0.1', resolve));
  await new Promise<void>((resolve) => blogServer.listen(0, '127.0.0.1', resolve));
  rawPort = (rawServer.address() as net.AddressInfo).port;
  blogPort = (blogServer.address() as net.AddressInfo).port;
});
after(async () => {
  await Promise.all([
    new Promise<void>((resolve, reject) => rawServer.close((error) => error ? reject(error) : resolve())),
    new Promise<void>((resolve, reject) => blogServer.close((error) => error ? reject(error) : resolve())),
  ]);
});

test('raw HTTP response parser separates status, headers, and body', () => {
  const response = parseHttpResponse(Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nX-Test: a\r\n\r\nhelloEXTRA'));
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers.get('x-test'), 'a');
  assert.equal(response.body.toString(), 'hello');
});

test('raw server handles GET and POST echo routes', async () => {
  const send = (request: string) => new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: rawPort });
    const chunks: Buffer[] = [];
    socket.once('connect', () => socket.end(request));
    socket.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    socket.once('end', () => resolve(Buffer.concat(chunks).toString()));
    socket.once('error', reject);
  });
  assert.match(await send('GET / HTTP/1.1\r\nHost: x\r\n\r\n'), /Hello, World!/);
  assert.match(await send('POST /echo HTTP/1.1\r\nHost: x\r\nContent-Length: 5\r\n\r\nhello'), /hello$/);
});

test('blog API returns REST status codes and Location', async () => {
  const request = (method: string, path: string, body?: object) => new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({ host: '127.0.0.1', port: blogPort, path, method, headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      res.once('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.once('error', reject); req.end(payload);
  });
  const created = await request('POST', '/posts', { title: 'New', body: 'Body' });
  assert.equal(created.status, 201);
  assert.match(String(created.headers.location), /^\/posts\/\d+$/);
  const removed = await request('DELETE', String(created.headers.location));
  assert.equal(removed.status, 204);
  assert.equal(removed.body, '');
});
