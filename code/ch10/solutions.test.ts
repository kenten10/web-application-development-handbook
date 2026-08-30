import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { startEchoServers } from './echo-server.solution.js';
import { Scheduler, repeat } from './green-threads.solution.js';

function tcpRoundTrip(port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => socket.end(message));
    let output = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => { output += chunk; });
    socket.on('end', () => resolve(output));
    socket.on('error', reject);
  });
}

test('TCP and HTTP echo return the request body', async () => {
  const running = await startEchoServers();
  try {
    assert.equal(await tcpRoundTrip(running.tcpPort, 'hello'), 'hello');
    const response = await fetch(`http://127.0.0.1:${running.httpPort}/echo`, { method: 'POST', body: 'world' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'world');
  } finally { await running.close(); }
});

test('green scheduler interleaves cooperative tasks', () => {
  const output: string[] = [];
  const scheduler = new Scheduler();
  scheduler.spawn(() => repeat('A', 2, output));
  scheduler.spawn(() => repeat('B', 2, output));
  const result = scheduler.run();
  assert.deepEqual(output, ['A step 0', 'B step 0', 'A step 1', 'B step 1']);
  assert.equal(result.errors.length, 0);
});
