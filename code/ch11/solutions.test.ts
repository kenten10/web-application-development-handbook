import assert from 'node:assert/strict';
import test from 'node:test';
import { Container } from './di-container.solution.js';
import { runChain, runOnion } from './middleware-patterns.solution.js';
import { TrieRouter } from './trie-router.solution.js';
import { MiniExpress, jsonBody } from './mini-express.solution.js';

test('chain and onion execution orders are observable', async () => {
  const chain: string[] = [];
  runChain([(_c, next) => { chain.push('a-before'); next(); chain.push('a-after'); }, () => chain.push('b')], {});
  assert.deepEqual(chain, ['a-before', 'b', 'a-after']);
  const onion: string[] = [];
  await runOnion([async (_c, next) => { onion.push('a-before'); await next(); onion.push('a-after'); }, async (_c, next) => { onion.push('b-before'); await next(); onion.push('b-after'); }], {});
  assert.deepEqual(onion, ['a-before', 'b-before', 'b-after', 'a-after']);
});

test('DI container resolves explicit dependencies and detects cycles', () => {
  class Repo { all() { return ['Alice']; } }
  class Service { static inject = [Repo]; constructor(readonly repo: Repo) {} }
  const container = new Container().bind(Repo).bind(Service);
  assert.deepEqual(container.get(Service).repo.all(), ['Alice']);
  assert.equal(container.get(Service), container.get(Service));
});

test('Trie router extracts parameters and wildcard', () => {
  const router = new TrieRouter<string>();
  router.add('GET', '/users/:id/posts/:postId', (params) => `${params.id}:${params.postId}`);
  router.add('GET', '/assets/*path', (params) => params.path!);
  const post = router.match('GET', '/users/42/posts/9')!;
  assert.equal(post.handler(post.params), '42:9');
  const asset = router.match('GET', '/assets/js/app.js')!;
  assert.equal(asset.handler(asset.params), 'js/app.js');
});

test('MiniExpress handles middleware, JSON body, routes, and 404', async () => {
  const app = new MiniExpress();
  app.use(async (ctx, next) => { ctx.res.setHeader('x-middleware', 'yes'); await next(); });
  app.use(jsonBody());
  app.get('/users/:id', (ctx) => ({ id: ctx.params.id }));
  app.post('/echo', (ctx) => ctx.state.json);
  const running = await app.listen();
  try {
    const user = await fetch(`http://127.0.0.1:${running.port}/users/7`);
    assert.equal(user.headers.get('x-middleware'), 'yes');
    assert.deepEqual(await user.json(), { id: '7' });
    const echo = await fetch(`http://127.0.0.1:${running.port}/echo`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    assert.deepEqual(await echo.json(), { ok: true });
    assert.equal((await fetch(`http://127.0.0.1:${running.port}/missing`)).status, 404);
  } finally { await running.close(); }
});
