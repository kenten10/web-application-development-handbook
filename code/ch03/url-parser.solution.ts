import { pathToFileURL } from 'node:url';

export interface ParsedUrl {
  scheme: string | null;
  userInfo: string | null;
  host: string | null;
  port: number | null;
  path: string;
  query: Map<string, string[]>;
  fragment: string | null;
  opaque: string | null;
}

function parseQuery(input: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!input) return result;
  for (const pair of input.split('&')) {
    if (!pair) continue;
    const [rawKey, rawValue = ''] = pair.split('=', 2);
    const key = decodeURIComponent(rawKey!.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    const values = result.get(key) ?? [];
    values.push(value);
    result.set(key, values);
  }
  return result;
}

function parseAuthority(authority: string): Pick<ParsedUrl, 'userInfo' | 'host' | 'port'> {
  let userInfo: string | null = null;
  let hostPort = authority;
  const at = authority.lastIndexOf('@');
  if (at >= 0) {
    userInfo = authority.slice(0, at);
    hostPort = authority.slice(at + 1);
  }
  if (!hostPort) throw new Error('host is empty');

  let host: string;
  let port: number | null = null;
  if (hostPort.startsWith('[')) {
    const end = hostPort.indexOf(']');
    if (end < 0) throw new Error('invalid IPv6 host');
    host = hostPort.slice(1, end);
    const rest = hostPort.slice(end + 1);
    if (rest) {
      if (!rest.startsWith(':')) throw new Error('invalid authority');
      port = parsePort(rest.slice(1));
    }
  } else {
    const colon = hostPort.lastIndexOf(':');
    if (colon >= 0 && hostPort.indexOf(':') === colon) {
      host = hostPort.slice(0, colon);
      port = parsePort(hostPort.slice(colon + 1));
    } else host = hostPort;
  }
  if (!host || /\s/.test(host)) throw new Error('invalid host');
  return { userInfo, host, port };
}

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`invalid port: ${value}`);
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error(`port out of range: ${value}`);
  return port;
}

export function parseUrl(input: string): ParsedUrl {
  if (input === '' || /[\u0000-\u001f\u007f]/.test(input)) throw new Error('invalid URL input');
  let rest = input;
  let fragment: string | null = null;
  const hash = rest.indexOf('#');
  if (hash >= 0) { fragment = rest.slice(hash + 1); rest = rest.slice(0, hash); }

  let queryText = '';
  const question = rest.indexOf('?');
  if (question >= 0) { queryText = rest.slice(question + 1); rest = rest.slice(0, question); }

  let scheme: string | null = null;
  const schemeMatch = rest.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (schemeMatch) {
    scheme = schemeMatch[1]!.toLowerCase();
    rest = rest.slice(schemeMatch[0].length);
  }

  let userInfo: string | null = null;
  let host: string | null = null;
  let port: number | null = null;
  let opaque: string | null = null;
  let path = '';

  if (rest.startsWith('//')) {
    const afterSlashes = rest.slice(2);
    const slash = afterSlashes.indexOf('/');
    const authority = slash >= 0 ? afterSlashes.slice(0, slash) : afterSlashes;
    ({ userInfo, host, port } = parseAuthority(authority));
    path = slash >= 0 ? afterSlashes.slice(slash) : '/';
  } else if (scheme && !rest.startsWith('/')) {
    opaque = rest;
    path = rest;
  } else {
    path = rest || (host ? '/' : '');
  }

  return { scheme, userInfo, host, port, path, query: parseQuery(queryText), fragment, opaque };
}

function normalizePath(path: string): string {
  const absolute = path.startsWith('/');
  const output: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') output.pop();
    else output.push(segment);
  }
  return `${absolute ? '/' : ''}${output.join('/')}${path.endsWith('/') && output.length ? '/' : ''}` || (absolute ? '/' : '');
}

export function resolveUrl(baseInput: string, referenceInput: string): string {
  const reference = parseUrl(referenceInput);
  if (reference.scheme) return referenceInput;
  const base = parseUrl(baseInput);
  if (!base.scheme || !base.host) throw new Error('base URL must be absolute and hierarchical');
  if (referenceInput.startsWith('//')) return `${base.scheme}:${referenceInput}`;

  const hashIndex = referenceInput.indexOf('#');
  const queryIndex = referenceInput.indexOf('?');
  const pathEndCandidates = [hashIndex, queryIndex].filter((value) => value >= 0);
  const pathEnd = pathEndCandidates.length ? Math.min(...pathEndCandidates) : referenceInput.length;
  const rawPath = referenceInput.slice(0, pathEnd);
  const suffix = referenceInput.slice(pathEnd);
  const authority = `${base.userInfo ? `${base.userInfo}@` : ''}${base.host.includes(':') ? `[${base.host}]` : base.host}${base.port ? `:${base.port}` : ''}`;
  if (rawPath.startsWith('/')) return `${base.scheme}://${authority}${normalizePath(rawPath)}${suffix}`;
  if (rawPath === '') {
    const baseQuery = baseInput.includes('?') ? baseInput.slice(baseInput.indexOf('?'), baseInput.indexOf('#') >= 0 ? baseInput.indexOf('#') : undefined) : '';
    return `${base.scheme}://${authority}${base.path || '/'}${suffix.startsWith('#') ? baseQuery + suffix : suffix}`;
  }
  const directory = (base.path || '/').replace(/[^/]*$/, '');
  return `${base.scheme}://${authority}${normalizePath(`${directory}${rawPath}`)}${suffix}`;
}

function printable(value: ParsedUrl): object {
  return { ...value, query: Object.fromEntries(value.query) };
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  const input = process.argv[2] ?? 'https://user:pass@www.example.com:8080/path/to/resource?key=value&x=1#section';
  console.dir(printable(parseUrl(input)), { depth: null });
}
