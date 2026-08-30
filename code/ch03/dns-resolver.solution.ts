import { Resolver } from 'node:dns/promises';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export interface DnsObservation {
  domain: string;
  resolverServers: string[];
  elapsedMs: number;
  a: Awaited<ReturnType<Resolver['resolve4']>>;
  aaaa: Awaited<ReturnType<Resolver['resolve6']>>;
  mx: Awaited<ReturnType<Resolver['resolveMx']>>;
  txt: Awaited<ReturnType<Resolver['resolveTxt']>>;
  ns: Awaited<ReturnType<Resolver['resolveNs']>>;
  answerSource: string;
}

async function safe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try { return await operation(); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'EREFUSED'].includes(code ?? '')) return fallback;
    throw error;
  }
}

export async function observeDns(domain: string, servers?: string[]): Promise<DnsObservation> {
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) throw new Error('domain contains unsupported characters');
  const resolver = new Resolver();
  if (servers?.length) resolver.setServers(servers);
  const started = performance.now();
  const [a, aaaa, mx, txt, ns] = await Promise.all([
    safe(() => resolver.resolve4(domain, { ttl: true }), []),
    safe(() => resolver.resolve6(domain, { ttl: true }), []),
    safe(() => resolver.resolveMx(domain), []),
    safe(() => resolver.resolveTxt(domain), []),
    safe(() => resolver.resolveNs(domain), []),
  ]);
  return {
    domain,
    resolverServers: resolver.getServers(),
    elapsedMs: performance.now() - started,
    a,
    aaaa,
    mx,
    txt,
    ns,
    answerSource: 'recursive resolver response; node:dns does not expose whether the answer came from cache',
  };
}

export function formatObservation(result: DnsObservation): string {
  const lines = [`Resolving ${result.domain}...`, `Resolver: ${result.resolverServers.join(', ') || '(system default)'}`];
  for (const record of result.a as Array<{ address: string; ttl: number }>) lines.push(`A:      ${record.address}  (TTL: ${record.ttl})`);
  for (const record of result.aaaa as Array<{ address: string; ttl: number }>) lines.push(`AAAA:   ${record.address}  (TTL: ${record.ttl})`);
  for (const record of result.mx) lines.push(`MX:     ${record.priority} ${record.exchange}`);
  for (const record of result.txt) lines.push(`TXT:    "${record.join('')}"`);
  for (const record of result.ns) lines.push(`NS:     ${record}`);
  lines.push(`Time:   ${result.elapsedMs.toFixed(1)} ms`);
  lines.push(`Source: ${result.answerSource}`);
  return lines.join('\n');
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  observeDns(process.argv[2] ?? 'example.com', process.env.DNS_SERVER ? [process.env.DNS_SERVER] : undefined)
    .then((result) => console.log(formatObservation(result)))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
