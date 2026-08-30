import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { TrieRouter } from './trie-router.solution.js';
import { runOnion, type OnionMiddleware } from './middleware-patterns.solution.js';

export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  state: Record<string, unknown>;
  body?: unknown;
  status?: number;
}
type Handler = (context: Context) => unknown | Promise<unknown>;

export class MiniExpress {
  readonly #router = new TrieRouter<Handler>();
  readonly #middlewares: OnionMiddleware<Context>[] = [];
  readonly #errorHandlers: Array<(error: unknown, context: Context) => void | Promise<void>> = [];

  use(middleware: OnionMiddleware<Context>): this { this.#middlewares.push(middleware); return this; }
  onError(handler: (error: unknown, context: Context) => void | Promise<void>): this { this.#errorHandlers.push(handler); return this; }
  get(path: string, handler: Handler): this { this.#router.add('GET', path, () => handler); return this; }
  post(path: string, handler: Handler): this { this.#router.add('POST', path, () => handler); return this; }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const context: Context = { req, res, url: new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), params: {}, state: {} };
    try {
      await runOnion([...this.#middlewares, async (ctx) => {
        const match = this.#router.match(req.method ?? 'GET', ctx.url.pathname);
        if (!match) { ctx.status = 404; ctx.body = { error: 'not_found' }; return; }
        ctx.params = match.params;
        ctx.body = await match.handler(ctx.params)(ctx);
      }], context);
      if (!res.writableEnded) send(context);
    } catch (error) {
      for (const handler of this.#errorHandlers) await handler(error, context);
      if (!res.writableEnded) {
        context.status ??= 500;
        context.body ??= { error: 'internal_error' };
        send(context);
      }
    }
  }

  async listen(port = 0, host = '127.0.0.1'): Promise<{ port: number; close(): Promise<void> }> {
    const server = http.createServer((req, res) => void this.handle(req, res));
    server.listen(port, host);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Address unavailable');
    return { port: address.port, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
  }
}

export function jsonBody(limitBytes = 1_000_000): OnionMiddleware<Context> {
  return async (context, next) => {
    if ((context.req.headers['content-type'] ?? '').startsWith('application/json')) {
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of context.req) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > limitBytes) throw new Error('body_too_large');
        chunks.push(buffer);
      }
      context.state.json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    await next();
  };
}

function send(context: Context): void {
  const { res } = context;
  res.statusCode = context.status ?? 200;
  if (context.body === undefined) { res.end(); return; }
  if (Buffer.isBuffer(context.body) || typeof context.body === 'string') { res.end(context.body); return; }
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(context.body));
}
