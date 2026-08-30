import net, { type Server } from 'node:net';
import { pathToFileURL } from 'node:url';

export interface RawRequest {
  method: string;
  target: string;
  version: string;
  headers: Map<string, string>;
  body: Buffer;
}

export interface RawResponse {
  status: number;
  reason: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
}

export function parseRequest(raw: Buffer): RawRequest | null {
  const boundary = raw.indexOf('\r\n\r\n');
  if (boundary < 0) return null;
  const headerText = raw.subarray(0, boundary).toString('latin1');
  const lines = headerText.split('\r\n');
  const requestLine = lines.shift();
  const match = requestLine?.match(/^([A-Z]+)\s+(\S+)\s+HTTP\/(1\.[01])$/);
  if (!match) throw new Error('invalid request line');
  const headers = new Map<string, string>();
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator <= 0) throw new Error(`invalid header: ${line}`);
    headers.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  const lengthHeader = headers.get('content-length') ?? '0';
  if (!/^\d+$/.test(lengthHeader)) throw new Error('invalid Content-Length');
  const length = Number(lengthHeader);
  const available = raw.length - boundary - 4;
  if (available < length) return null;
  return {
    method: match[1]!,
    target: match[2]!,
    version: match[3]!,
    headers,
    body: raw.subarray(boundary + 4, boundary + 4 + length),
  };
}

export function route(request: RawRequest): RawResponse {
  if (request.method === 'GET' && request.target === '/') {
    return { status: 200, reason: 'OK', body: 'Hello, World!' };
  }
  if (request.method === 'GET' && request.target.startsWith('/echo/')) {
    const encoded = request.target.slice('/echo/'.length).split('?', 1)[0] ?? '';
    try { return { status: 200, reason: 'OK', body: decodeURIComponent(encoded) }; }
    catch { return { status: 400, reason: 'Bad Request', body: 'invalid URL encoding' }; }
  }
  if (request.method === 'POST' && request.target === '/echo') {
    return { status: 200, reason: 'OK', body: request.body };
  }
  return { status: 404, reason: 'Not Found', body: 'Not Found' };
}

export function serializeResponse(response: RawResponse): Buffer {
  const body = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body ?? '', 'utf8');
  const headers: Record<string, string> = {
    'Content-Length': String(body.length),
    'Content-Type': 'text/plain; charset=utf-8',
    Connection: 'close',
    ...response.headers,
  };
  const head = [`HTTP/1.1 ${response.status} ${response.reason}`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), '', ''].join('\r\n');
  return Buffer.concat([Buffer.from(head, 'latin1'), body]);
}

export function createRawHttpServer(): Server {
  return net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.setTimeout(10_000, () => socket.end(serializeResponse({ status: 408, reason: 'Request Timeout' })));
    socket.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      try {
        const request = parseRequest(raw);
        if (!request) return;
        socket.end(serializeResponse(route(request)));
      } catch (error) {
        socket.end(serializeResponse({ status: 400, reason: 'Bad Request', body: error instanceof Error ? error.message : 'Bad Request' }));
      }
    });
    socket.on('error', () => {});
  });
}

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const server = createRawHttpServer();
  server.listen(port, '127.0.0.1', () => console.log(`raw HTTP server: http://127.0.0.1:${port}`));
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
