import { createHmac, timingSafeEqual } from 'node:crypto';
export interface WebhookHeaders { 'webhook-signature': string; }
function signature(secret: string, timestamp: number, body: string): string { return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('base64url'); }

export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): WebhookHeaders {
  return { 'webhook-signature': `v1,t=${timestamp},sig=${signature(secret, timestamp, body)}` };
}

export class ReplayGuard {
  readonly #seen = new Map<string, number>();
  consume(id: string, expiresAt: number, now: number): void {
    for (const [key, expiry] of this.#seen) if (expiry < now) this.#seen.delete(key);
    if (this.#seen.has(id)) throw new Error('Webhook replay detected');
    this.#seen.set(id, expiresAt);
  }
}

export function verifyWebhook(secret: string, body: string, headers: WebhookHeaders, options: { now?: number; toleranceSeconds?: number; replayGuard?: ReplayGuard } = {}): true {
  const now = options.now ?? Math.floor(Date.now() / 1000); const tolerance = options.toleranceSeconds ?? 300;
  const fields = Object.fromEntries(headers['webhook-signature'].split(',').map((field) => field.split('=', 2) as [string, string]));
  const timestamp = Number(fields.t); const provided = fields.sig;
  if (!Number.isSafeInteger(timestamp) || !provided) throw new Error('Malformed signature header');
  if (Math.abs(now - timestamp) > tolerance) throw new Error('Webhook timestamp outside tolerance');
  const expected = Buffer.from(signature(secret, timestamp, body)); const actual = Buffer.from(provided);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid webhook signature');
  options.replayGuard?.consume(`${timestamp}:${provided}`, timestamp + tolerance, now);
  return true;
}
