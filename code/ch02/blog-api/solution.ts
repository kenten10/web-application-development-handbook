import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

export interface Post { id: number; title: string; body: string; }
export interface PostInput { title: string; body: string; }

function sendJson(response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...headers });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 1_000_000) throw new Error('request body too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validatePostInput(value: unknown, partial = false): PostInput | Partial<PostInput> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: Partial<PostInput> = {};
  if ('title' in record) {
    if (typeof record.title !== 'string' || record.title.trim() === '') return null;
    result.title = record.title.trim();
  } else if (!partial) return null;
  if ('body' in record) {
    if (typeof record.body !== 'string') return null;
    result.body = record.body;
  } else if (!partial) return null;
  return result;
}

export function createBlogServer(initial: Post[] = [{ id: 1, title: 'Hello', body: 'First post' }]): http.Server {
  const posts = new Map(initial.map((post) => [post.id, { ...post }]));
  let nextId = Math.max(0, ...posts.keys()) + 1;

  return http.createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://localhost');
    const itemMatch = url.pathname.match(/^\/posts\/(\d+)$/);

    try {
      if (method === 'GET' && url.pathname === '/posts') return sendJson(response, 200, [...posts.values()]);
      if (method === 'GET' && itemMatch) {
        const post = posts.get(Number(itemMatch[1]));
        return post ? sendJson(response, 200, post) : sendJson(response, 404, { error: 'post not found' });
      }
      if (method === 'POST' && url.pathname === '/posts') {
        const input = validatePostInput(await readJson(request));
        if (!input || !('title' in input) || !('body' in input)) return sendJson(response, 400, { error: 'title and body are required' });
        const post = { id: nextId++, title: input.title, body: input.body };
        posts.set(post.id, post);
        return sendJson(response, 201, post, { Location: `/posts/${post.id}` });
      }
      if ((method === 'PUT' || method === 'PATCH') && itemMatch) {
        const id = Number(itemMatch[1]);
        const current = posts.get(id);
        if (!current) return sendJson(response, 404, { error: 'post not found' });
        const input = validatePostInput(await readJson(request), method === 'PATCH');
        if (!input) return sendJson(response, 400, { error: 'invalid post payload' });
        if (method === 'PUT' && (!('title' in input) || !('body' in input))) return sendJson(response, 400, { error: 'PUT requires title and body' });
        const updated: Post = { ...current, ...input, id };
        posts.set(id, updated);
        return sendJson(response, 200, updated);
      }
      if (method === 'DELETE' && itemMatch) {
        const deleted = posts.delete(Number(itemMatch[1]));
        if (!deleted) return sendJson(response, 404, { error: 'post not found' });
        response.writeHead(204);
        return response.end();
      }
      response.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
      return sendJson(response, 404, { error: 'route not found' });
    } catch (error) {
      return sendJson(response, error instanceof SyntaxError ? 400 : 500, { error: error instanceof Error ? error.message : 'unknown error' });
    }
  });
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  const port = Number(process.env.PORT ?? 3001);
  createBlogServer().listen(port, '127.0.0.1', () => console.log(`blog API: http://127.0.0.1:${port}/posts`));
}
