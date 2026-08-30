import dns from 'node:dns';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export interface UrlTrace {
  url: string;
  address: string;
  dnsMs: number;
  tcpMs: number;
  tlsMs: number;
  ttfbMs: number;
  bodyMs: number;
  totalMs: number;
  statusCode: number;
  httpVersion: string;
  tlsProtocol: string | null;
  cipher: string | null;
  bytes: number;
  subresources: number;
}

export async function traceUrl(input: string): Promise<UrlTrace> {
  const target = new URL(input);
  if (target.protocol !== 'https:') throw new Error('this exercise traces https:// URLs only');
  const start = performance.now();
  let lookupAt = start;
  let connectAt = start;
  let secureAt = start;
  let responseAt = start;
  let address = '';
  let tlsProtocol: string | null = null;
  let cipher: string | null = null;

  return new Promise((resolve, reject) => {
    const request = https.request(target, { method: 'GET', lookup: dns.lookup, headers: { 'user-agent': 'handbook-url-trace/1.0', accept: 'text/html,*/*' } }, (response) => {
      responseAt = performance.now();
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.once('end', () => {
        const end = performance.now();
        const body = Buffer.concat(chunks);
        const html = /text\/html/i.test(String(response.headers['content-type'] ?? '')) ? body.toString('utf8') : '';
        const matches = html.match(/<(?:script|img|link|iframe|source)\b[^>]+(?:src|href)=/gi) ?? [];
        resolve({
          url: target.href,
          address,
          dnsMs: lookupAt - start,
          tcpMs: connectAt - lookupAt,
          tlsMs: secureAt - connectAt,
          ttfbMs: responseAt - secureAt,
          bodyMs: end - responseAt,
          totalMs: end - start,
          statusCode: response.statusCode ?? 0,
          httpVersion: response.httpVersion,
          tlsProtocol,
          cipher,
          bytes: body.length,
          subresources: matches.length,
        });
      });
    });
    request.once('socket', (socket) => {
      socket.once('lookup', (_error, foundAddress) => { address = foundAddress; lookupAt = performance.now(); });
      socket.once('connect', () => { connectAt = performance.now(); });
      socket.once('secureConnect', () => {
        secureAt = performance.now();
        const tlsSocket = socket as import('node:tls').TLSSocket;
        tlsProtocol = tlsSocket.getProtocol();
        cipher = tlsSocket.getCipher().name;
      });
    });
    request.setTimeout(15_000, () => request.destroy(new Error('request timed out')));
    request.once('error', reject);
    request.end();
  });
}

export function formatTrace(trace: UrlTrace): string {
  const critical = trace.dnsMs + trace.tcpMs + trace.tlsMs + trace.ttfbMs;
  return [
    `[DNS]   ${trace.address} (${trace.dnsMs.toFixed(1)} ms)`,
    `[TCP]   ${trace.tcpMs.toFixed(1)} ms`,
    `[TLS]   ${trace.tlsMs.toFixed(1)} ms, ${trace.tlsProtocol ?? 'unknown'}, ${trace.cipher ?? 'unknown'}`,
    `[HTTP]  HTTP/${trace.httpVersion} ${trace.statusCode}, TTFB ${trace.ttfbMs.toFixed(1)} ms`,
    `[Body]  ${trace.bytes} bytes (${trace.bodyMs.toFixed(1)} ms)`,
    `[Parse] ${trace.subresources} sub-resource references`,
    `Total: ${trace.totalMs.toFixed(1)} ms`,
    `Critical path estimate: ${critical.toFixed(1)} ms (${trace.totalMs ? ((critical / trace.totalMs) * 100).toFixed(1) : '0'}%)`,
  ].join('\n');
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  traceUrl(process.argv[2] ?? 'https://example.com')
    .then((trace) => console.log(formatTrace(trace)))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
