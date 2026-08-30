import fs from 'node:fs';
import http, { type Server } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type Props = Record<string, unknown>;
export type PageContext = { pathname: string; query: URLSearchParams };
export type PageModule = {
  default(props: Props): string;
  getServerSideProps?(context: PageContext): Promise<{ props: Props }> | { props: Props };
};

export function routeFromFilename(file: string): string {
  const normalized = file.replace(/\\/g, '/').replace(/\.(?:ts|js|mjs)$/, '');
  const withoutIndex = normalized === 'index' ? '' : normalized.endsWith('/index') ? normalized.slice(0, -6) : normalized;
  return withoutIndex === '' ? '/' : `/${withoutIndex}`.replace(/\/+/g, '/');
}

export async function discoverPages(directory: string): Promise<Map<string, PageModule>> {
  const routes = new Map<string, PageModule>();
  const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
  for (const file of walk(directory).filter((name) => /\.(?:js|mjs)$/.test(name))) {
    const relative = path.relative(directory, file);
    const module = await import(`${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`) as PageModule;
    if (typeof module.default !== 'function') throw new Error(`${file} must default-export a page function`);
    routes.set(routeFromFilename(relative), module);
  }
  return routes;
}

function escapeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

export async function renderPage(page: PageModule, context: PageContext): Promise<string> {
  const result = await page.getServerSideProps?.(context) ?? { props: {} };
  const body = page.default(result.props);
  const serialized = escapeJson(result.props);
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>Mini SSR</title></head><body><div id="app">${body}</div><script>window.__SSR_PROPS__=${serialized};window.__HYDRATED__=true;</script></body></html>`;
}

export function startServer(routes: Map<string, PageModule>, port = 0): Promise<{ server: Server; port: number; close(): Promise<void> }> {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const page = routes.get(url.pathname);
      if (!page) { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not Found'); return; }
      const html = await renderPage(page, { pathname: url.pathname, query: url.searchParams });
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not determine port'));
      resolve({ server, port: address.port, close: () => new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done())) });
    });
  });
}

export const exerciseId = '9.3';
