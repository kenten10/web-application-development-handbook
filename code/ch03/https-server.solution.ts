import { readFileSync } from 'node:fs';
import https from 'node:https';

const keyPath = process.env.TLS_KEY ?? 'certs/localhost-key.pem';
const certPath = process.env.TLS_CERT ?? 'certs/localhost-cert.pem';
const port = Number(process.env.PORT ?? 3443);

const server = https.createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath), minVersion: 'TLSv1.2' }, (_request, response) => {
  const body = JSON.stringify({ message: 'Hello over TLS', protocol: 'https' });
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  response.end(body);
});
server.listen(port, '127.0.0.1', () => console.log(`HTTPS server: https://localhost:${port}`));
