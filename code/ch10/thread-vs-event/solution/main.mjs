import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';

const pbkdf2Async = promisify(pbkdf2);

export async function runConcurrent(label, tasks) {
  const started = performance.now();
  await Promise.all(tasks.map((task) => task()));
  return { label, count: tasks.length, elapsedMs: performance.now() - started };
}

export function ioTask(delayMs = 10) {
  return () => new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function threadPoolTask(iterations = 20_000) {
  return async () => { await pbkdf2Async('password', 'salt', iterations, 32, 'sha256'); };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Number(process.argv[2] ?? 16);
  const io = await runConcurrent('event-loop-io', Array.from({ length: count }, () => ioTask()));
  const cpu = await runConcurrent('libuv-thread-pool', Array.from({ length: count }, () => threadPoolTask()));
  console.table([io, cpu]);
  console.log('Observation: I/O timers overlap cheaply; CPU-bound pbkdf2 throughput is bounded by the libuv worker pool.');
}
