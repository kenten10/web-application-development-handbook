import test from 'node:test';import assert from 'node:assert/strict';import {demonstrateAttack} from './sqli/solution/demo.js';import {escapeHtml,sanitize} from './xss/solution/main.js';import {createCsrfToken,verifyCsrfToken} from './csrf.solution.js';import {SSRFGuard,isBlockedAddress} from './ssrf-guard.solution.js';import {TokenBucket,SlidingWindowLimiter} from './rate-limit.solution.js';import {buildSecurityHeaders} from './secure-headers.solution.js';import {scan,satisfies} from './dep-scanner.solution.js';import {MerkleTree} from './merkle-tree.solution.js';
import { FIXTURES as UploadFixtures, benignAccepted, deliveryHeaders, expandArchive, missingDeliveryHeaders, runFindings as runUploadFindings, sniffType, strictGate } from './upload-validation/solution/main.js';
import { LayeredGuard, NaiveGuard, credentialStuffing, enumerate as enumerateAccounts, lockoutDos, networkOf, normalLoginPasses, normalizeEmail, runFindings as runAbuseFindings } from './abuse-defense/solution/main.js';
test('SQL injection demonstration exposes bad query while parameters stay safe',()=>{const r=demonstrateAttack("' OR 1=1 --");assert.equal((r.badResult as unknown[]).length,2);assert.equal(r.goodResult.length,0);assert.equal(r.safe.params[0],"' OR 1=1 --")});
test('XSS sanitizer removes scripts and unsafe attributes',()=>{assert.equal(escapeHtml('<x>'),'&lt;x&gt;');assert.equal(sanitize('<p onclick="x">Hi<script>x</script><b>ok</b></p>',{allowedTags:['p','b']}),'<p>Hi<b>ok</b></p>')});
test('CSRF double-submit token validates exact pair',()=>{const t=createCsrfToken('secret','session');assert.equal(verifyCsrfToken({secret:'secret',sessionId:'session',cookieToken:t,formToken:t}),true);assert.equal(verifyCsrfToken({secret:'secret',sessionId:'other',cookieToken:t,formToken:t}),false)});
test('SSRF guard blocks private addresses and validates public resolution',async()=>{assert.equal(isBlockedAddress('169.254.169.254'),true);const g=new SSRFGuard({resolve:async()=>['93.184.216.34'],allowedPorts:[443]});assert.equal((await g.validate('https://example.com')).addresses[0],'93.184.216.34');await assert.rejects(new SSRFGuard({resolve:async()=>['127.0.0.1']}).validate('http://example.test'))});
test('TokenBucket.remaining refills with elapsed time and caps at capacity',()=>{let now=0;const b=new TokenBucket({capacity:10,refillPerSec:5,now:()=>now});while(b.tryConsume()){}assert.equal(b.remaining(),0);now=500;assert.equal(b.remaining(),2.5);now=1000;assert.equal(b.remaining(),5);now=100000;assert.equal(b.remaining(),10)});
test('rate limiters enforce capacity/window',()=>{let now=0;const b=new TokenBucket({capacity:2,refillPerSec:1,now:()=>now});assert.equal(b.tryConsume(),true);assert.equal(b.tryConsume(),true);assert.equal(b.tryConsume(),false);now=1000;assert.equal(b.tryConsume(),true);const s=new SlidingWindowLimiter({windowMs:1000,max:2,now:()=>now});assert.equal(s.check('u').allowed,true);assert.equal(s.check('u').allowed,true);assert.equal(s.check('u').allowed,false)});
test('security middleware creates all requested headers',()=>{const h=buildSecurityHeaders({csp:{defaultSrc:["'self'"]},hsts:{maxAge:1,includeSubDomains:true},frameOptions:'DENY',contentTypeOptions:true,referrerPolicy:'same-origin',permissionsPolicy:{camera:[]}});for(const k of ['Content-Security-Policy','Strict-Transport-Security','X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Permissions-Policy'])assert.ok(h[k])});
test('dependency scanner supports common semver ranges',()=>{assert.equal(satisfies('1.2.3','>=1.0.0 <2.0.0'),true);const f=scan({packages:{'node_modules/x':{version:'1.2.3'}}},[{name:'x',range:'<1.3.0',severity:'HIGH',id:'X-1',title:'bad'}]);assert.equal(f.length,1)});
test('Merkle proof verifies inclusion and rejects tampering',()=>{const t=new MerkleTree();['a','b','c'].forEach(x=>t.append(x));const p=t.proof(1);assert.equal(MerkleTree.verify('b',p,t.root()),true);assert.equal(MerkleTree.verify('x',p,t.root()),false)});
test('upload validation reproduces four weaknesses and the strict gate removes them',()=>{const findings=runUploadFindings();assert.equal(findings.length,4);assert.deepEqual(findings.filter(f=>f.reproduced).map(f=>f.id),['V1','V2','V3','V4']);assert.deepEqual(findings.filter(f=>f.remains),[]);assert.equal(benignAccepted(),true);const v1=strictGate.accept(UploadFixtures.magicMismatch);assert.equal(v1.ok,false);assert.equal(v1.ok===false&&v1.reason,'declared type mismatch');const v2=strictGate.accept(UploadFixtures.doubleExtension);assert.equal(v2.ok,false);assert.equal(v2.ok===false&&v2.reason,'unsupported type')});
test('archive expansion aborts on ratio without trusting the declared size',()=>{const bomb=UploadFixtures.zipBomb.archive;const strict=expandArchive(bomb,UploadFixtures.limits,{depth:1});assert.equal(strict.aborted,'compression ratio');assert.ok(strict.expanded<bomb.entries[0]!.expandedBytes);assert.equal(expandArchive(bomb,UploadFixtures.limits,{depth:3}).aborted,'nested archive too deep');assert.equal(sniffType(UploadFixtures.benignPng.bytes),'image/png');assert.equal(sniffType(new Uint8Array([1,2])),null)});
test('delivery headers stop content sniffing and force a disposition',()=>{const file={id:'x',filename:'a b.pdf',declaredType:'image/png',detectedType:'application/pdf'};assert.deepEqual(missingDeliveryHeaders(deliveryHeaders(file,'strict')),[]);const headers=deliveryHeaders(file,'strict');assert.equal(headers['content-type'],'application/pdf');assert.match(headers['content-disposition']!,/^attachment; filename\*=UTF-8''/);assert.ok(missingDeliveryHeaders(deliveryHeaders(file,'naive')).includes('x-content-type-options'))});

test('abuse defence weaknesses are reproduced and then removed', () => {
  const findings = runAbuseFindings();
  assert.equal(findings.length, 4);
  assert.deepEqual(findings.filter((f) => f.reproduced).map((f) => f.id), ['B1', 'B2', 'B3', 'B4']);
  assert.deepEqual(findings.filter((f) => f.remains), []);
  assert.equal(normalLoginPasses(), true);
});

test('layered keys stop distributed stuffing that per-account limits miss', () => {
  assert.equal(credentialStuffing(new NaiveGuard()).accepted.length, 2);
  assert.deepEqual(credentialStuffing(new LayeredGuard()).accepted, []);
  assert.equal(normalizeEmail('  AOI@Example.TEST '), 'aoi@example.test');
  assert.equal(networkOf('198.51.100.99'), '198.51.100');
});

test('responses do not distinguish existing accounts, and the victim is never locked out', () => {
  const naiveProbe = enumerateAccounts(new NaiveGuard());
  assert.equal(naiveProbe.distinguishable, 2);
  assert.equal(enumerateAccounts(new LayeredGuard()).distinguishable, 0);
  assert.equal(lockoutDos(new NaiveGuard()).victimBlocked, true);
  assert.equal(lockoutDos(new LayeredGuard()).victimBlocked, false);
  assert.equal(new NaiveGuard().lockedOut('aoi@example.test'), false);
});

test('the throttled response carries 429 and Retry-After without touching storage', () => {
  const guard = new LayeredGuard();
  for (let i = 0; i < 30; i += 1) {
    guard.login({ email: 'aoi@example.test', password: `guess-${i}`, ip: '203.0.113.7' }, { verifiedHash: false });
  }
  const outcome = guard.login({ email: 'aoi@example.test', password: 'x', ip: '203.0.113.7' }, { verifiedHash: false });
  assert.equal(outcome.status, 429);
  assert.equal(outcome.headers['retry-after'], '30');
  // 大文字小文字を変えても同じ鍵として数える
  const evaded = guard.login({ email: 'AOI@EXAMPLE.TEST', password: 'x', ip: '203.0.113.7' }, { verifiedHash: false });
  assert.equal(evaded.status, 429);
});
