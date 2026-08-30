import http from 'node:http';
import net from 'node:net';
import { once } from 'node:events';

export interface RunningEchoServers {
  tcpPort: number;
  httpPort: number;
  close(): Promise<void>;
}

function boundedCpuWork(iterations: number): number {
  const safeIterations = Math.max(0, Math.min(iterations, 2_000_000));
  let value = 0;
  for (let index = 0; index < safeIterations; index += 1) {
    value = (value + Math.imul(index, 31)) >>> 0;
  }
  return value;
}

export async function startEchoServers(host = '127.0.0.1'): Promise<RunningEchoServers> {
  const tcp = net.createServer((socket) => socket.pipe(socket));
  const web = http.createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
    if (url.pathname !== '/echo') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const work = Number(url.searchParams.get('work') ?? '0');
      const checksum = boundedCpuWork(Number.isFinite(work) ? work : 0);
      const body = Buffer.concat(chunks);
      response.writeHead(200, {
        'content-type': request.headers['content-type'] ?? 'application/octet-stream',
        'content-length': String(body.length),
        'x-work-checksum': String(checksum),
      });
      response.end(body);
    });
  });

  tcp.listen(0, host);
  web.listen(0, host);
  await Promise.all([once(tcp, 'listening'), once(web, 'listening')]);
  const tcpAddress = tcp.address();
  const webAddress = web.address();
  if (!tcpAddress || typeof tcpAddress === 'string' || !webAddress || typeof webAddress === 'string') {
    throw new Error('Could not resolve listening ports');
  }
  return {
    tcpPort: tcpAddress.port,
    httpPort: webAddress.port,
    async close() {
      await Promise.all([
        new Promise<void>((resolve, reject) => tcp.close((error) => error ? reject(error) : resolve())),
        new Promise<void>((resolve, reject) => web.close((error) => error ? reject(error) : resolve())),
      ]);
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const servers = await startEchoServers();
  console.log(JSON.stringify({ tcpPort: servers.tcpPort, httpPort: servers.httpPort }));
  const shutdown = async () => { await servers.close(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
