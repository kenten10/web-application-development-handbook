import { createHmac, createSign, createVerify, timingSafeEqual, type KeyLike } from 'node:crypto';
export type JwtAlgorithm = 'HS256' | 'RS256';
export interface JwtPayload { exp?: number; nbf?: number; iat?: number; [key: string]: unknown; }

function jsonPart(value: unknown): string { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function parsePart<T>(part: string): T { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T; }
function signBytes(input: string, key: KeyLike | string | Buffer, algorithm: JwtAlgorithm): Buffer {
  if (algorithm === 'HS256') return createHmac('sha256', key as string | Buffer).update(input).digest();
  return createSign('RSA-SHA256').update(input).end().sign(key as KeyLike);
}

export function signJwt(payload: JwtPayload, key: KeyLike | string | Buffer, algorithm: JwtAlgorithm = 'HS256'): string {
  const header = jsonPart({ alg: algorithm, typ: 'JWT' });
  const body = jsonPart(payload);
  const input = `${header}.${body}`;
  return `${input}.${signBytes(input, key, algorithm).toString('base64url')}`;
}

export function decodeJwt(token: string): { header: { alg?: string; typ?: string }; payload: JwtPayload; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) throw new Error('Malformed JWT');
  return { header: parsePart(parts[0]), payload: parsePart(parts[1]), signature: parts[2] ?? '' };
}

export function verifyJwt(token: string, key: KeyLike | string | Buffer, allowedAlgorithms: readonly JwtAlgorithm[] = ['HS256'], nowSeconds = Math.floor(Date.now() / 1000)): JwtPayload {
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || signaturePart === undefined) throw new Error('Malformed JWT');
  const { header, payload } = decodeJwt(token);
  if (header.alg !== 'HS256' && header.alg !== 'RS256') throw new Error('Unsupported algorithm');
  if (!allowedAlgorithms.includes(header.alg)) throw new Error('Algorithm is not allowed');
  const input = `${headerPart}.${payloadPart}`;
  const signature = Buffer.from(signaturePart, 'base64url');
  let valid = false;
  if (header.alg === 'HS256') {
    const expected = signBytes(input, key, 'HS256');
    valid = signature.length === expected.length && timingSafeEqual(signature, expected);
  } else valid = createVerify('RSA-SHA256').update(input).end().verify(key as KeyLike, signature);
  if (!valid) throw new Error('Invalid signature');
  if (typeof payload.exp === 'number' && nowSeconds >= payload.exp) throw new Error('Token expired');
  if (typeof payload.nbf === 'number' && nowSeconds < payload.nbf) throw new Error('Token is not active');
  return payload;
}

export function createNoneAlgToken(payload: JwtPayload): string { return `${jsonPart({ alg: 'none', typ: 'JWT' })}.${jsonPart(payload)}.`; }
