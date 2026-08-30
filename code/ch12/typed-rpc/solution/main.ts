import http from 'node:http';
import { once } from 'node:events';

export interface Schema<T> { parse(value: unknown): T; }
export type Infer<S> = S extends Schema<infer T> ? T : never;
export const schema = {
  string(): Schema<string> { return { parse(value) { if (typeof value !== 'string') throw new TypeError('Expected string'); return value; } }; },
  number(): Schema<number> { return { parse(value) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Expected number'); return value; } }; },
  object<const Shape extends Record<string, Schema<unknown>>>(shape: Shape): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
    return { parse(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected object');
      return Object.fromEntries(Object.entries(shape).map(([key, validator]) => [key, validator.parse((value as Record<string, unknown>)[key])])) as { [K in keyof Shape]: Infer<Shape[K]> };
    } };
  },
};

export interface Procedure<I, O> { input: Schema<I>; output: Schema<O>; handler(args: { input: I }): Promise<O> | O; }
export function defineProcedure<I, O>(procedure: Procedure<I, O>): Procedure<I, O> { return procedure; }
export type Router = Record<string, Procedure<any, any>>;
export type Client<R extends Router> = { [K in keyof R]: (input: Infer<R[K]['input']>) => Promise<Infer<R[K]['output']>> };

export async function startRpcServer<R extends Router>(router: R): Promise<{ port: number; close(): Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    const name = new URL(request.url ?? '/', 'http://localhost').pathname.replace(/^\//, '');
    const procedure = router[name];
    if (request.method !== 'POST' || !procedure) { response.writeHead(404).end(); return; }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const input = procedure.input.parse(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      const output = procedure.output.parse(await procedure.handler({ input }));
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(output));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Address unavailable');
  return { port: address.port, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

export function createClient<R extends Router>(baseUrl: string): Client<R> {
  return new Proxy({}, { get: (_target, property) => async (input: unknown) => {
    const response = await fetch(`${baseUrl}/${String(property)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    const body = await response.json() as unknown;
    if (!response.ok) throw new Error((body as { error?: string }).error ?? `RPC failed: ${response.status}`);
    return body;
  } }) as Client<R>;
}
