import https from 'node:https';
import http2 from 'node:http2';
import { performance } from 'node:perf_hooks';

const origin = process.env.ORIGIN ?? 'https://127.0.0.1:3444';
const count = Number(process.env.COUNT ?? 100);

async function http1(): Promise<number> {
  const agent = new https.Agent({ keepAlive: true, maxSockets: 6, rejectUnauthorized: false });
  const started = performance.now();
  await Promise.all(Array.from({ length: count }, (_, index) => new Promise<void>((resolve, reject) => {
    https.get(`${origin}/asset/${index}`, { agent, rejectUnauthorized: false }, (response) => {
      response.resume();
      response.once('end', resolve);
    }).once('error', reject);
  })));
  agent.destroy();
  return performance.now() - started;
}

async function http2Multiplexed(): Promise<number> {
  const session = http2.connect(origin, { rejectUnauthorized: false });
  const started = performance.now();
  await Promise.all(Array.from({ length: count }, (_, index) => new Promise<void>((resolve, reject) => {
    const request = session.request({ ':path': `/asset/${index}` });
    request.on('data', () => {});
    request.once('end', resolve);
    request.once('error', reject);
    request.end();
  })));
  session.close();
  return performance.now() - started;
}

const rounds = Number(process.env.ROUNDS ?? 3);

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

// 1回だけ測ると、JITの暖機、TLSセッションの再利用、OSのソケット再利用の
// 状態がそのまま数値へ乗る。捨てる1回 (ウォームアップ) を置いてから複数回測り、
// 中央値と生の値の両方を出す
async function measure(label: string, run: () => Promise<number>): Promise<{ protocol: string; requests: number; medianMs: string; rawMs: string }> {
  await run();  // ウォームアップ。この結果は捨てる
  const samples: number[] = [];
  for (let i = 0; i < rounds; i++) samples.push(await run());
  return {
    protocol: label,
    requests: count,
    medianMs: median(samples).toFixed(1),
    rawMs: samples.map(v => v.toFixed(1)).join(' / '),
  };
}

const h1 = await measure('HTTP/1.1', http1);
const h2 = await measure('HTTP/2', http2Multiplexed);
console.table([h1, h2]);
console.log(`ウォームアップ1回を捨て、${rounds}回計測した中央値です。`);
console.log('結果はCPU、TLS、接続数、遅延設定に依存します。測定条件と複数回の分布を記録してください。');
