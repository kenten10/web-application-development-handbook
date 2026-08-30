import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buffer: Buffer): string {
  let bits = ''; for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = ''; for (let index = 0; index < bits.length; index += 5) output += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return output;
}
export function base32Decode(value: string): Buffer {
  let bits = ''; for (const character of value.toUpperCase().replace(/=|\s/g, '')) { const index = ALPHABET.indexOf(character); if (index < 0) throw new Error('Invalid base32'); bits += index.toString(2).padStart(5, '0'); }
  const bytes: number[] = []; for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2)); return Buffer.from(bytes);
}
export function generateSecret(bytes = 20): string { return base32Encode(randomBytes(bytes)); }
export function generateTotp(secret: string, options: { timeMs?: number; stepSeconds?: number; digits?: number; algorithm?: 'sha1' | 'sha256' | 'sha512' } = {}): string {
  const step = options.stepSeconds ?? 30; const digits = options.digits ?? 6; const counter = Math.floor((options.timeMs ?? Date.now()) / 1000 / step);
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac(options.algorithm ?? 'sha1', base32Decode(secret)).update(message).digest();
  const offset = digest.at(-1)! & 0x0f; const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(binary).padStart(digits, '0');
}
export function verifyTotp(secret: string, code: string, options: { timeMs?: number; window?: number; stepSeconds?: number; digits?: number } = {}): boolean {
  const time = options.timeMs ?? Date.now(); const step = options.stepSeconds ?? 30; const window = options.window ?? 1;
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotp(secret, { ...options, timeMs: time + offset * step * 1000 });
    const left = Buffer.from(candidate); const right = Buffer.from(code); if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}
export function createOtpAuthUrl(secret: string, account: string, issuer: string): string {
  const url = new URL(`otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`); url.searchParams.set('secret', secret); url.searchParams.set('issuer', issuer); url.searchParams.set('period', '30'); url.searchParams.set('digits', '6'); return url.toString();
}
