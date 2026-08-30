import http, { type Server } from 'node:http';
import { once } from 'node:events';

export class GracefulHttpServer {
  readonly server: Server; private active = 0; private shuttingDown = false;
  constructor(private readonly handler: (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void> | void) {
    this.server = http.createServer(async (request, response) => {
      if (this.shuttingDown) { response.writeHead(503, { connection: 'close' }).end('shutting down'); return; }
      this.active++;
      try { await this.handler(request, response); }
      catch { if (!response.headersSent) response.writeHead(500); response.end('internal error'); }
      finally { this.active--; }
    });
  }
  listen(port: number): Promise<void> { this.server.listen(port, '127.0.0.1'); return once(this.server, 'listening').then(() => undefined); }
  get activeRequests(): number { return this.active; }
  async shutdown(timeoutMs = 30_000): Promise<'drained' | 'timeout'> {
    // ここで先に server.close() を呼んではいけない。Node.js 19 以降の close() は
    // listener を止めたうえでアイドルな keep-alive 接続も切るため、
    // 停止中に届いた要求は 503 ではなく接続拒否 (ECONNREFUSED) になる。
    // まず 503 を返せる状態にし、処理中の要求が終わりきってから閉じる
    this.shuttingDown = true;
    const deadline = Date.now() + timeoutMs;
    while (this.active > 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    const timedOut = this.active > 0;
    if (this.server.listening) {
      this.server.close();
      this.server.closeAllConnections();
      await once(this.server, 'close');
    }
    return timedOut ? 'timeout' : 'drained';
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = new GracefulHttpServer(async (_request, response) => { await new Promise((resolve) => setTimeout(resolve, 50)); response.end('ok'); });
  await app.listen(Number(process.env.PORT ?? 3002)); console.log('graceful server ready');
  process.on('SIGTERM', async () => { console.log(await app.shutdown()); process.exit(0); });
}
