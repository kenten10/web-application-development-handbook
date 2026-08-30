import http, { type IncomingMessage, type RequestOptions, type Server } from 'node:http';
export type Strategy = 'round-robin' | 'least-conn' | 'random';
type Backend = { url: URL; active: number; healthy: boolean };
export class LoadBalancer {
  private readonly backends: Backend[]; private cursor = 0; readonly server: Server;
  constructor(readonly options: { strategy: Strategy; backends: string[]; random?: () => number }) {
    this.backends = options.backends.map((url) => ({ url: new URL(url), active: 0, healthy: true }));
    this.server = http.createServer((request, response) => this.proxy(request, response));
  }
  private choose(): Backend {
    const healthy = this.backends.filter((backend) => backend.healthy); if (!healthy.length) throw new Error('no healthy backends');
    if (this.options.strategy === 'least-conn') return healthy.reduce((a, b) => a.active <= b.active ? a : b);
    if (this.options.strategy === 'random') return healthy[Math.floor((this.options.random ?? Math.random)() * healthy.length)]!;
    return healthy[this.cursor++ % healthy.length]!;
  }
  private proxy(request: IncomingMessage, response: http.ServerResponse): void {
    let backend: Backend; try { backend = this.choose(); } catch { response.writeHead(503).end('no healthy backends'); return; }
    backend.active++;
    const headers = { ...request.headers, host: backend.url.host, 'x-forwarded-for': request.socket.remoteAddress ?? '' };
    const options: RequestOptions = { hostname: backend.url.hostname, port: backend.url.port, path: request.url, method: request.method, headers };
    const upstream = http.request(options, (upstreamResponse) => { response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers); upstreamResponse.pipe(response); });
    upstream.on('error', () => { backend.healthy = false; if (!response.headersSent) response.writeHead(502); response.end('bad gateway'); });
    const done = () => { backend.active = Math.max(0, backend.active - 1); };
    upstream.once('close', done); request.pipe(upstream);
  }
  markHealthy(index: number, healthy: boolean): void { const backend = this.backends[index]; if (!backend) throw new Error('invalid backend index'); backend.healthy = healthy; }
  listen(port: number): Promise<void> { return new Promise((resolve) => this.server.listen(port, '127.0.0.1', resolve)); }
}
