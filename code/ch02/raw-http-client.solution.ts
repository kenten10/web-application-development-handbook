import net from 'node:net';
import { pathToFileURL } from 'node:url';

export interface HttpResponse {
  httpVersion: string;
  statusCode: number;
  statusText: string;
  headers: Map<string, string>;
  body: Buffer;
}

export function decodeChunkedBody(input: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;
  while (offset < input.length) {
    const lineEnd = input.indexOf('\r\n', offset);
    if (lineEnd < 0) throw new Error('chunk size line is incomplete');
    const sizeToken = input.subarray(offset, lineEnd).toString('ascii').split(';', 1)[0]?.trim();
    if (!sizeToken || !/^[0-9a-f]+$/i.test(sizeToken)) throw new Error(`invalid chunk size: ${sizeToken ?? ''}`);
    const size = Number.parseInt(sizeToken, 16);
    offset = lineEnd + 2;
    if (size === 0) return Buffer.concat(chunks);
    const dataEnd = offset + size;
    if (dataEnd + 2 > input.length) throw new Error('chunk data is incomplete');
    chunks.push(input.subarray(offset, dataEnd));
    if (input.subarray(dataEnd, dataEnd + 2).toString('ascii') !== '\r\n') throw new Error('chunk terminator is missing');
    offset = dataEnd + 2;
  }
  throw new Error('terminating zero chunk is missing');
}

export function parseHttpResponse(raw: Buffer): HttpResponse {
  const boundary = raw.indexOf('\r\n\r\n');
  if (boundary < 0) throw new Error('response header is incomplete');
  const headerText = raw.subarray(0, boundary).toString('latin1');
  const lines = headerText.split('\r\n');
  const statusLine = lines.shift();
  const statusMatch = statusLine?.match(/^HTTP\/(\d\.\d)\s+(\d{3})(?:\s+(.*))?$/);
  if (!statusMatch) throw new Error(`invalid status line: ${statusLine ?? ''}`);

  const headers = new Map<string, string>();
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator <= 0) throw new Error(`invalid header: ${line}`);
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const previous = headers.get(name);
    headers.set(name, previous ? `${previous}, ${value}` : value);
  }

  let body = raw.subarray(boundary + 4);
  if (/\bchunked\b/i.test(headers.get('transfer-encoding') ?? '')) {
    body = decodeChunkedBody(body);
  } else if (headers.has('content-length')) {
    const length = Number(headers.get('content-length'));
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('invalid Content-Length');
    if (body.length < length) throw new Error(`body is incomplete: expected ${length}, received ${body.length}`);
    body = body.subarray(0, length);
  }

  return {
    httpVersion: statusMatch[1]!,
    statusCode: Number(statusMatch[2]),
    statusText: statusMatch[3] ?? '',
    headers,
    body,
  };
}

export function requestHttp(host: string, path = '/', port = 80): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const socket = net.createConnection({ host, port });
    socket.setTimeout(10_000);
    socket.once('connect', () => {
      socket.write([
        `GET ${path || '/'} HTTP/1.1`,
        `Host: ${host}`,
        'User-Agent: handbook-raw-client/1.0',
        'Accept: */*',
        'Accept-Encoding: identity',
        'Connection: close',
        '',
        '',
      ].join('\r\n'));
    });
    socket.on('data', (chunk) => buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    socket.once('end', () => {
      try { resolve(parseHttpResponse(Buffer.concat(buffers))); }
      catch (error) { reject(error); }
    });
    socket.once('timeout', () => socket.destroy(new Error('request timed out')));
    socket.once('error', reject);
  });
}

async function main(): Promise<void> {
  const host = process.argv[2] ?? 'example.com';
  const path = process.argv[3] ?? '/';
  const response = await requestHttp(host, path);
  console.log(`HTTP/${response.httpVersion} ${response.statusCode} ${response.statusText}`);
  for (const [name, value] of response.headers) console.log(`${name}: ${value}`);
  console.log('');
  process.stdout.write(response.body);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
