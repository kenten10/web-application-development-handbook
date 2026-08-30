import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatObservation, type DnsObservation } from './dns-resolver.solution.js';
import { parseUrl, resolveUrl } from './url-parser.solution.js';

test('URL parser handles authority, duplicate query keys, and fragment', () => {
  const parsed = parseUrl('https://user:pass@example.com:8080/a?x=1&x=2#top');
  assert.equal(parsed.scheme, 'https');
  assert.equal(parsed.userInfo, 'user:pass');
  assert.equal(parsed.host, 'example.com');
  assert.equal(parsed.port, 8080);
  assert.deepEqual(parsed.query.get('x'), ['1', '2']);
  assert.equal(parsed.fragment, 'top');
});

test('URL resolver normalizes relative segments', () => {
  assert.equal(resolveUrl('https://example.com/a/b/page.html', '../asset.js'), 'https://example.com/a/asset.js');
  assert.equal(resolveUrl('https://example.com/a/b', '/root?q=1'), 'https://example.com/root?q=1');
});

test('DNS formatter includes TTL and source limitation', () => {
  const sample = {
    domain: 'example.com', resolverServers: ['127.0.0.1'], elapsedMs: 12,
    a: [{ address: '192.0.2.1', ttl: 60 }], aaaa: [], mx: [], txt: [['v=spf1 -all']], ns: ['ns.example.com'],
    answerSource: 'recursive resolver response',
  } as unknown as DnsObservation;
  const output = formatObservation(sample);
  assert.match(output, /TTL: 60/);
  assert.match(output, /recursive resolver response/);
});
