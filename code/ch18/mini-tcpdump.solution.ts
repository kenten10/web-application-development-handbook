import net, { type Server } from 'node:net';
export function hexDump(buffer: Buffer, width = 16): string {
  const lines: string[] = [];
  for (let offset = 0; offset < buffer.length; offset += width) {
    const slice = buffer.subarray(offset, offset + width); const hex = [...slice].map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(width * 3 - 1);
    const ascii = [...slice].map((b) => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join(''); lines.push(`${offset.toString(16).padStart(4, '0')}  ${hex}  ${ascii}`);
  }
  return lines.join('\n');
}
export function httpPreview(buffer: Buffer, maxLines = 4): string | undefined {
  const text = buffer.toString('utf8'); if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s/.test(text)) return undefined; return text.split(/\r?\n/).slice(0, maxLines).join('\n');
}
export function createCapturingProxy(options: { listenPort: number; targetPort: number; onCapture?: (dump: string, preview?: string) => void }): Server {
  return net.createServer((client) => {
    const upstream = net.createConnection({ host: '127.0.0.1', port: options.targetPort });
    client.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      options.onCapture?.(hexDump(buffer), httpPreview(buffer)); upstream.write(buffer);
    });
    upstream.on('data', (chunk) => client.write(chunk)); client.on('end', () => upstream.end()); upstream.on('end', () => client.end());
    client.on('error', () => upstream.destroy()); upstream.on('error', () => client.destroy());
  }).listen(options.listenPort, '127.0.0.1');
}
