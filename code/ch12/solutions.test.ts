import assert from 'node:assert/strict';
import test from 'node:test';
import { DataLoader } from './dataloader.solution.js';
import { generateServerStub, type OpenApiDocument } from './openapi-codegen/solution/main.js';
import { createClient, defineProcedure, schema, startRpcServer } from './typed-rpc/solution/main.js';
import { RoomBroker, decodeClientTextFrame, encodeServerTextFrame, reconnectDelay } from './websocket-chat/solution/main.js';
import { MIB, createServer as createUploadServer, ConflictError as UploadConflictError, headSession, issueGrant, patchChunk, probeDuplicate, probeOrphan, probeOversize, probeResume, runFindings as runUploadFindings } from './resumable-upload/solution/main.js';

test('DataLoader batches within a tick, caches, and clears', async () => {
  const calls: number[][] = [];
  const loader = new DataLoader<number, string>(async (keys) => { calls.push([...keys]); return keys.map((key) => `v${key}`); });
  assert.deepEqual(await Promise.all([loader.load(1), loader.load(2), loader.load(1)]), ['v1', 'v2', 'v1']);
  assert.deepEqual(calls, [[1, 2]]);
  loader.clear(1); assert.equal(await loader.load(1), 'v1'); assert.deepEqual(calls, [[1, 2], [1]]);
});

test('OpenAPI generator emits Zod schemas and typed handler', () => {
  const document: OpenApiDocument = { paths: { '/users/{id}': { get: { operationId: 'getUser', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } } } } } }, components: { schemas: { User: { type: 'object', required: ['id', 'name'], properties: { id: { type: 'integer' }, name: { type: 'string' } } } } } };
  const source = generateServerStub(document);
  assert.match(source, /UserSchema = z\.object/); assert.match(source, /getUserParamsSchema/); assert.match(source, /function getUser/);
});

test('typed RPC validates input and output over HTTP', async () => {
  const router = { getUser: defineProcedure({ input: schema.object({ id: schema.string() }), output: schema.object({ id: schema.string(), name: schema.string() }), handler: ({ input }) => ({ id: input.id, name: `User ${input.id}` }) }) };
  const running = await startRpcServer(router);
  try {
    const client = createClient<typeof router>(`http://127.0.0.1:${running.port}`);
    assert.deepEqual(await client.getUser({ id: '7' }), { id: '7', name: 'User 7' });
    await assert.rejects(() => (client.getUser as (input: unknown) => Promise<unknown>)({ id: 7 }), /Expected string/);
  } finally { await running.close(); }
});

test('WebSocket educational primitives frame text and publish by room', () => {
  assert.equal(encodeServerTextFrame('hi').toString('hex'), '81026869');
  const payload = Buffer.from('hello'); const mask = Buffer.from([1,2,3,4]); const masked = Buffer.from(payload.map((byte,index)=>byte ^ mask[index%4]!));
  assert.equal(decodeClientTextFrame(Buffer.concat([Buffer.from([0x81,0x80|payload.length]),mask,masked])), 'hello');
  const broker = new RoomBroker(); const messages: string[] = [];
  const leave = broker.join('room', 'alice', (message) => messages.push(message.type));
  broker.publish({ type: 'message', room: 'room', user: 'alice', text: 'hello' }); leave();
  assert.deepEqual(messages, ['join','message']); assert.equal(reconnectDelay(3), 2000);
});

test('resumable upload reproduces four failures and the fixed server removes them', () => {
  const findings = runUploadFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((finding) => finding.reproduced).map((finding) => finding.id), ['U1', 'U2', 'U3', 'U4']);
  assert.deepEqual(findings.filter((finding) => finding.remains), []);
  // 上限は許可証へ入れたときだけ強制される
  assert.equal(probeOversize('naive').stored, 30 * MIB);
  assert.equal(probeOversize('fixed').stored, 4 * MIB);
  // オフセットを保存済み実長から導けば、再起動後も続きから送れる
  assert.equal(probeResume('naive').resent, 12 * MIB);
  assert.equal(probeResume('fixed').resent, 4 * MIB);
  // 追記の条件にオフセットを入れると、応答の取りこぼしによる再送が二重書き込みにならない
  assert.equal(probeDuplicate('fixed').stored, 8 * MIB);
  assert.equal(probeOrphan('fixed').collected.sessions, 3);
});

test('resumable upload rejects a mismatched offset without writing', () => {
  const server = createUploadServer('fixed');
  const grant = issueGrant(server, { declaredBytes: 8 * MIB, ttlMs: 60_000, now: 0 });
  patchChunk(server, grant.sessionId, 0, new Uint8Array(4 * MIB));
  assert.throws(() => patchChunk(server, grant.sessionId, 0, new Uint8Array(4 * MIB)), UploadConflictError);
  assert.equal(headSession(server, grant.sessionId), 4 * MIB);
});
