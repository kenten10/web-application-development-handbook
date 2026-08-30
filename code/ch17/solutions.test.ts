import test from 'node:test'; import assert from 'node:assert/strict';
import { MiniBroker } from './mini-kafka.solution.js'; import { InMemoryDatabase, OutboxRelay } from './outbox/solution/main.js'; import { RetryableQueue } from './dlq.solution.js'; import { Saga } from './saga.solution.js';
import { FIXTURES as WebhookFixtures, Sender, TOLERANCE_SECONDS, probeDropped, probeDuplicate, probeOrder, probeRotation, probeSignature, runFindings as runWebhookFindings, verifySignature } from './webhook-delivery/solution/main.js';
import { CircuitBreaker, CircuitOpenError, UpstreamError, VirtualClock, probeBreaker, probeMail, probeRetryStorm, probeTimeout, runFindings as runExternalFindings } from './external-api/solution/main.js';
import { FIXTURES as PayFixtures, FakeGateway, Ledger, allocate, applyRate, fixedCharge, legitimateFlowsPass, money, naiveAllocate, naiveCharge, reconcile, runFindings as runPaymentFindings } from './payment-integration/solution/main.js';
test('consumer groups track offsets independently',()=>{const b=new MiniBroker();b.createTopic('events',{partitions:2});b.publish('events',{n:1});b.publish('events',{n:2});const a=b.consumer<{n:number}>('events',{group:'a'});const audit=b.consumer<{n:number}>('events',{group:'audit'});assert.equal(a.drain(10).length,2);assert.equal(a.drain(10).length,0);assert.equal(audit.drain(10).length,2);});
test('outbox relay preserves unsent events and marks successful events',async()=>{const db=new InMemoryDatabase();db.transaction(tx=>{tx.createUser({id:'u1',name:'Alice'});tx.addEvent('user.created',{id:'u1'});});let attempts=0;const relay=new OutboxRelay(db,async()=>{if(attempts++===0)throw new Error('down')});assert.equal(await relay.runOnce(),0);assert.equal(await relay.runOnce(),1);assert.ok(db.outbox[0]?.sentAt);});
test('retry queue uses exponential delays and DLQ',async()=>{const q=new RetryableQueue<string>({maxRetries:3,baseDelayMs:10});q.enqueue('m','x',0);await q.processReady(async()=>{throw new Error('bad')},0);await q.processReady(async()=>{throw new Error('bad')},10);await q.processReady(async()=>{throw new Error('bad')},30);assert.equal(q.dlq.messages.length,1);});
test('saga compensates completed steps in reverse order',async()=>{const log:string[]=[];const saga=new Saga().step({name:'a',action:async()=>1,compensate:async()=>{log.push('undo-a')}}).step({name:'b',action:async()=>2,compensate:async()=>{log.push('undo-b')}}).step({name:'c',action:async()=>{throw new Error('fail')},compensate:async()=>{}});const r=await saga.execute();assert.equal(r.ok,false);assert.deepEqual(log,['undo-b','undo-a']);});
test('webhook delivery reproduces four failures and the guarded receiver removes them',async()=>{const findings=await runWebhookFindings();assert.equal(findings.length,4);assert.deepEqual(findings.filter(f=>f.reproduced).map(f=>f.id),['W1','W2','W3','W4']);assert.deepEqual(findings.filter(f=>f.remains),[]);assert.equal((await probeSignature('guarded')).accepted,true);assert.equal(await probeDuplicate('guarded'),1);assert.equal(await probeOrder('guarded'),'active');assert.equal(await probeDropped('guarded'),0);});
test('signature verification survives key rotation and rejects a stale timestamp',async()=>{assert.equal((await probeRotation('guarded')).accepted,true);assert.equal((await probeRotation('naive')).accepted,false);const sender=new Sender(WebhookFixtures.secrets);const request=sender.build(WebhookFixtures.signatureEvent,WebhookFixtures.nowSeconds-TOLERANCE_SECONDS-1);const stale=verifySignature(request.rawBody,request.headers,WebhookFixtures.secrets,WebhookFixtures.nowSeconds);assert.equal(stale.ok,false);});
test('external api resilience reproduces four failures and the resilient path removes them',()=>{const findings=runExternalFindings();assert.equal(findings.length,4);assert.deepEqual(findings.filter(f=>f.reproduced).map(f=>f.id),['E1','E2','E3','E4']);assert.deepEqual(findings.filter(f=>f.remains),[]);assert.equal(probeTimeout('resilient').elapsed,1200);assert.equal(probeRetryStorm('resilient').calls,6);assert.equal(probeBreaker('resilient').upstreamWaits,3);assert.deepEqual(probeMail('resilient'),{delivered:1,suppressedHits:0});});
test('circuit breaker ignores 4xx and reopens after a failed half-open probe',()=>{const clock=new VirtualClock(0);const breaker=new CircuitBreaker({windowSize:5,minimumCalls:2,failureThreshold:2,cooldownMs:1000});for(let i=0;i<5;i+=1)assert.throws(()=>breaker.execute(clock,()=>{throw new UpstreamError(422,null)}),UpstreamError);assert.equal(breaker.state,'closed');for(let i=0;i<2;i+=1)assert.throws(()=>breaker.execute(clock,()=>{throw new UpstreamError(500,null)}),UpstreamError);assert.equal(breaker.state,'open');assert.throws(()=>breaker.execute(clock,()=>1),CircuitOpenError);clock.advance(1000);assert.equal(breaker.execute(clock,()=>7),7);assert.equal(breaker.state,'closed');});

test('payment defects are reproduced and then removed', () => {
  const findings = runPaymentFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((f) => f.reproduced).map((f) => f.id), ['M1', 'M2', 'M3', 'M4']);
  assert.deepEqual(findings.filter((f) => f.remains), []);
  assert.equal(legitimateFlowsPass(), true);
});

test('allocation always sums back to the original amount', () => {
  for (const total of [1_000n, 1n, 7n, 999_999n]) {
    for (const weights of [[1n, 1n, 1n], [1n, 2n, 3n], [5n]]) {
      const shares = allocate(money(total, 'JPY'), weights);
      assert.equal(shares.reduce((sum, share) => sum + share.minor, 0n), total);
      assert.equal(shares.length, weights.length);
    }
  }
  assert.equal(naiveAllocate(1_000, [1, 1, 1], 'JPY').reduce((a, b) => a + b, 0), 999);
  assert.equal(applyRate(money(105n, 'JPY'), 10n, 100n).minor, 11n);
  assert.equal(applyRate(money(-105n, 'JPY'), 10n, 100n).minor, -11n);
  assert.throws(() => money(1n, 'XYZ'), /unknown currency/);
});

test('an idempotency key fixed before sending survives a swallowed response', () => {
  const naiveGateway = new FakeGateway({ swallowResponsesUntil: 1 });
  naiveCharge(naiveGateway, new Ledger(), 'ord-1', PayFixtures.capture);
  assert.equal(naiveGateway.payments.size, 2);

  const gateway = new FakeGateway({ swallowResponsesUntil: 1 });
  const ledger = new Ledger();
  fixedCharge(gateway, ledger, 'ord-1', PayFixtures.capture);
  assert.equal(gateway.payments.size, 1);
  const attempt = ledger.attempts.get('ord-1')!;
  assert.equal(attempt.idempotencyKey, 'order:ord-1');
  assert.equal(attempt.state, 'SUCCEEDED');
});

test('refund total is capped and duplicate refund ids are rejected', () => {
  const ledger = new Ledger();
  assert.equal(ledger.tryAddRefund('pi_1', PayFixtures.capture, money(6_000n, 'JPY'), 'rf-1').ok, true);
  const second = ledger.tryAddRefund('pi_1', PayFixtures.capture, money(6_000n, 'JPY'), 'rf-2');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'refund exceeds capture');
  assert.equal(ledger.tryAddRefund('pi_1', PayFixtures.capture, money(1_000n, 'JPY'), 'rf-1').reason, 'duplicate refund id');
  assert.equal(ledger.tryAddRefund('pi_1', PayFixtures.capture, money(1n, 'USD'), 'rf-3').reason, 'currency mismatch');
  assert.equal(ledger.totalRefunded('pi_1'), 6_000n);
});

test('reconciliation reports missing and mismatched records in both directions', () => {
  const gateway = new FakeGateway();
  const ledger = new Ledger();
  const remote = gateway.createPayment({ idempotencyKey: 'order:a', amount: PayFixtures.capture });
  gateway.createPayment({ idempotencyKey: 'order:b', amount: PayFixtures.capture });
  const applied = ledger.ensureAttempt('a', PayFixtures.capture, 'order:a');
  applied.externalId = remote.id;
  applied.state = 'SUCCEEDED';
  const ghost = ledger.ensureAttempt('c', PayFixtures.capture, 'order:c');
  ghost.externalId = 'pi_missing';
  ghost.state = 'SUCCEEDED';
  const kinds = reconcile(ledger, gateway.list()).map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['missing-local', 'missing-remote']);

  const wrong = new Ledger();
  const off = wrong.ensureAttempt('a', money(9_999n, 'JPY'), 'order:a');
  off.externalId = remote.id;
  off.state = 'SUCCEEDED';
  assert.equal(reconcile(wrong, [remote]).filter((d) => d.kind === 'mismatch').length, 1);
});
