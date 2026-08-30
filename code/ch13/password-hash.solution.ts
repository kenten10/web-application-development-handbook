import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const pbkdf2Async = promisify(pbkdf2);

export interface PasswordHashOptions { iterations?: number; saltBytes?: number; keyLength?: number; digest?: string; }

export async function hashPassword(password: string, options: PasswordHashOptions = {}): Promise<string> {
  const iterations = options.iterations ?? 100_000;
  const salt = randomBytes(options.saltBytes ?? 16);
  const keyLength = options.keyLength ?? 32;
  const digest = options.digest ?? 'sha256';
  const hash = await pbkdf2Async(password, salt, iterations, keyLength, digest);
  return ['pbkdf2', digest, iterations, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, digest, iterationsText, saltText, hashText] = encoded.split('$');
  if (algorithm !== 'pbkdf2' || !digest || !iterationsText || !saltText || !hashText) return false;
  const iterations = Number(iterationsText);
  if (!Number.isSafeInteger(iterations) || iterations < 10_000 || iterations > 10_000_000) return false;
  const expected = Buffer.from(hashText, 'base64url');
  const actual = await pbkdf2Async(password, Buffer.from(saltText, 'base64url'), iterations, expected.length, digest);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
