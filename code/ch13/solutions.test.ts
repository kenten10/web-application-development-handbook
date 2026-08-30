import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { hashPassword, verifyPassword } from './password-hash.solution.js';
import { createNoneAlgToken, signJwt, verifyJwt } from './jwt.solution.js';
import { AuthorizationServer, createCodeChallenge, createCodeVerifier, runClientFlow } from './oauth-pkce/solution/pkce.js';
import { ReplayGuard, signWebhook, verifyWebhook } from './webhook-signing.solution.js';
import { base32Encode, createOtpAuthUrl, generateTotp, verifyTotp } from './totp.solution.js';
import { PolicyEngine } from './policy-engine.solution.js';
import {
  PolicyEngine as TenantPolicyEngine,
  TENANT_A,
  TENANT_B,
  buildReport,
  createGuardedApi,
  createStore,
  createUnsafeApi,
  probeLeaks,
  tenantPolicy,
} from './tenant-isolation/solution/main.js';

test('password hashing uses random salt and verifies safely', async () => {
  const first = await hashPassword('secret', { iterations: 10_000 }); const second = await hashPassword('secret', { iterations: 10_000 });
  assert.notEqual(first, second); assert.equal(await verifyPassword('secret', first), true); assert.equal(await verifyPassword('wrong', first), false);
});

test('JWT supports HS256 and RS256 and rejects none/expired', () => {
  const now = 1_800_000_000; const hs = signJwt({ sub: 'u1', exp: now + 60 }, 'secret', 'HS256'); assert.equal(verifyJwt(hs, 'secret', ['HS256'], now).sub, 'u1');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 }); const rs = signJwt({ sub: 'u2', exp: now + 60 }, privateKey, 'RS256'); assert.equal(verifyJwt(rs, publicKey, ['RS256'], now).sub, 'u2');
  assert.throws(() => verifyJwt(createNoneAlgToken({ sub: 'admin' }), 'secret'), /Unsupported/);
  assert.throws(() => verifyJwt(signJwt({ exp: now - 1 }, 'secret'), 'secret', ['HS256'], now), /expired/);
});

test('PKCE binds code to verifier, client, redirect, and one-time use', async () => {
  const server = new AuthorizationServer(); server.registerClient('web', ['http://127.0.0.1/callback']);
  const token = await runClientFlow(server, { clientId: 'web', redirectUri: 'http://127.0.0.1/callback', subject: 'alice' }); assert.equal(server.introspect(token.accessToken).subject, 'alice');
  const verifier = createCodeVerifier(); const auth = server.authorize({ clientId: 'web', redirectUri: 'http://127.0.0.1/callback', codeChallenge: createCodeChallenge(verifier), state: 's', subject: 'alice' });
  assert.throws(() => server.exchange({ code: auth.code, clientId: 'web', redirectUri: 'http://127.0.0.1/callback', codeVerifier: 'x'.repeat(43) }), /PKCE/);
});

test('webhook signature checks age, constant-time signature, and replay', () => {
  const body = JSON.stringify({ id: 1 }); const now = 1_800_000_000; const headers = signWebhook('secret', body, now); const guard = new ReplayGuard();
  assert.equal(verifyWebhook('secret', body, headers, { now, replayGuard: guard }), true);
  assert.throws(() => verifyWebhook('secret', body, headers, { now, replayGuard: guard }), /replay/);
  assert.throws(() => verifyWebhook('secret', body, headers, { now: now + 301 }), /tolerance/);
});

test('TOTP matches RFC 6238 SHA1 vector and window verification', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(generateTotp(secret, { timeMs: 59_000, digits: 8 }), '94287082');
  const code = generateTotp(secret, { timeMs: 60_000 }); assert.equal(verifyTotp(secret, code, { timeMs: 89_000, window: 1 }), true);
  assert.match(createOtpAuthUrl(secret, 'alice@example.com', 'Handbook'), /^otpauth:\/\/totp\//);
});

test('policy engine combines RBAC, ABAC, wildcard, and deny precedence', () => {
  type Subject = { id: string; role?: string }; type Resource = { authorId?: string; confidential?: boolean };
  const engine = new PolicyEngine<Subject, Resource>()
    .define({ effect: 'allow', action: 'post.edit', condition: ({ subject, resource }) => subject.id === resource.authorId })
    .define({ effect: 'allow', action: '*', roles: ['admin'] })
    .define({ effect: 'deny', action: 'post.*', condition: ({ resource }) => resource.confidential === true });
  assert.equal(engine.can({ id: 'u1' }, 'post.edit', { authorId: 'u1' }), true);
  assert.equal(engine.can({ id: 'u1' }, 'post.edit', { authorId: 'u2' }), false);
  assert.equal(engine.can({ id: 'a', role: 'admin' }, 'user.delete', {}), true);
  assert.equal(engine.can({ id: 'a', role: 'admin' }, 'post.edit', { confidential: true }), false);
});

test('tenant boundary leaks are reproducible and closed by the policy layer', () => {
  const unguarded = probeLeaks((store, _tenantId, cache) => createUnsafeApi(store, cache));
  assert.equal(unguarded.length, 4);
  assert.deepEqual(unguarded.filter((leak) => leak.leaked).map((leak) => leak.id), ['L1', 'L2', 'L3', 'L4']);
  const engine = new TenantPolicyEngine(tenantPolicy, true);
  const guarded = probeLeaks((store, tenantId, cache) => createGuardedApi(store, engine, { tenantId, owner: false }, cache));
  assert.deepEqual(guarded.filter((leak) => leak.leaked), []);
});

test('WITH CHECK rejects writes that would move a row to another tenant', () => {
  const engine = new TenantPolicyEngine(tenantPolicy, true);
  const session = { tenantId: TENANT_B, owner: false } as const;
  const api = createGuardedApi(createStore(), engine, session, new Map());
  assert.throws(() => api.moveTask(TENANT_B, 'tsk_b1', 'prj_a1'), /prj_a1/);
  const own = api.moveTask(TENANT_B, 'tsk_b1', 'prj_b1');
  assert.equal(own.tenantId, TENANT_B);
});

test('owner bypass and pooled session reuse are both observable', () => {
  const report = buildReport();
  assert.equal(report.ownerBypass.withoutForce, true);   // FORCE なしでは所有者が素通りする
  assert.equal(report.ownerBypass.withForce, false);     // FORCE ありでポリシーが適用される
  assert.equal(report.pool.withoutSetLocal.leaked, true);
  assert.equal(report.pool.withoutSetLocal.observedTenant, TENANT_A);
  assert.equal(report.pool.withSetLocal.leaked, false);
});
