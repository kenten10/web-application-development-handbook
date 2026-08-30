import { readFileSync } from 'node:fs';
import http2 from 'node:http2';

const port = Number(process.env.PORT ?? 3444);
const key = readFileSync(process.env.TLS_KEY ?? 'certs/localhost-key.pem');
const cert = readFileSync(process.env.TLS_CERT ?? 'certs/localhost-cert.pem');
const payload = Buffer.alloc(1024, 0x61);
const server = http2.createSecureServer({ key, cert, allowHTTP1: true });
server.on('request', (request, response) => {
  if (/^\/asset\/\d+$/.test(request.url ?? '')) {
    response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': payload.length });
    response.end(payload);
    return;
  }
  response.writeHead(404).end();
});
server.listen(port, '127.0.0.1', () => console.log(`benchmark server: https://127.0.0.1:${port}`));
