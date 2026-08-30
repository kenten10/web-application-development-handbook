import http from 'node:http';
const port = Number(process.argv[2] ?? 0);
const server = http.createServer((request, response) => {
  if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/events') { response.writeHead(404).end(); return; }
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  const last = Number(request.headers['last-event-id'] ?? 0);
  const events = [
    { type: 'stock-update', data: { symbol: 'WEB', price: 101 } },
    { type: 'user-online', data: { user: 'alice' } },
    { type: 'notification', data: { message: 'build complete' } },
  ];
  events.forEach((event, index) => {
    const id = last + index + 1;
    response.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  });
  response.end();
});
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Address unavailable');
  console.log(address.port);
});
