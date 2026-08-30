import net, { type Server, type Socket } from 'node:net';

export type ServerMetrics = { connections: number; messages: number; bytes: number };
export function createMultiplexedEchoServer(transform: (chunk: Buffer) => Buffer = (chunk) => chunk): { server: Server; metrics: ServerMetrics } {
  const metrics: ServerMetrics = { connections: 0, messages: 0, bytes: 0 };
  const sockets = new Set<Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket); metrics.connections++;
    socket.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      metrics.messages++; metrics.bytes += buffer.length; socket.write(transform(buffer));
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => sockets.delete(socket));
  });
  server.on('close', () => { for (const socket of sockets) socket.destroy(); });
  return { server, metrics };
}

export async function echoRoundTrip(port: number, payload: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => socket.write(payload));
    socket.setEncoding('utf8'); socket.once('data', (data) => { resolve(typeof data === 'string' ? data : data.toString('utf8')); socket.end(); }); socket.once('error', reject);
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3001); const { server } = createMultiplexedEchoServer((chunk) => Buffer.from(chunk.toString().toUpperCase()));
  server.listen(port, '127.0.0.1', () => console.log(`echo server on 127.0.0.1:${port}`));
}
