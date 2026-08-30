import { createHash, randomBytes } from 'node:crypto';

export function createCodeVerifier(bytes = 32): string { return randomBytes(bytes).toString('base64url'); }
export function createCodeChallenge(verifier: string): string { return createHash('sha256').update(verifier).digest('base64url'); }

interface AuthorizationRequest { clientId: string; redirectUri: string; codeChallenge: string; state: string; subject: string; }
interface CodeRecord extends AuthorizationRequest { used: boolean; expiresAt: number; }

export class AuthorizationServer {
  readonly #clients = new Map<string, Set<string>>();
  readonly #codes = new Map<string, CodeRecord>();
  readonly #tokens = new Map<string, { subject: string; clientId: string }>();

  registerClient(clientId: string, redirectUris: readonly string[]): void { this.#clients.set(clientId, new Set(redirectUris)); }

  authorize(request: AuthorizationRequest, now = Date.now()): { code: string; state: string; redirectTo: string } {
    if (!this.#clients.get(request.clientId)?.has(request.redirectUri)) throw new Error('Invalid redirect_uri');
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(request.codeChallenge)) throw new Error('Invalid PKCE challenge');
    const code = randomBytes(24).toString('base64url');
    this.#codes.set(code, { ...request, used: false, expiresAt: now + 60_000 });
    const redirect = new URL(request.redirectUri); redirect.searchParams.set('code', code); redirect.searchParams.set('state', request.state);
    return { code, state: request.state, redirectTo: redirect.toString() };
  }

  exchange(input: { code: string; clientId: string; redirectUri: string; codeVerifier: string }, now = Date.now()): { accessToken: string; tokenType: 'Bearer' } {
    const record = this.#codes.get(input.code);
    if (!record || record.used || record.expiresAt < now) throw new Error('Invalid or expired authorization code');
    if (record.clientId !== input.clientId || record.redirectUri !== input.redirectUri) throw new Error('Client binding mismatch');
    if (createCodeChallenge(input.codeVerifier) !== record.codeChallenge) throw new Error('PKCE verification failed');
    record.used = true;
    const accessToken = randomBytes(32).toString('base64url');
    this.#tokens.set(accessToken, { subject: record.subject, clientId: record.clientId });
    return { accessToken, tokenType: 'Bearer' };
  }

  introspect(token: string): { active: boolean; subject?: string; clientId?: string } {
    const value = this.#tokens.get(token); return value ? { active: true, ...value } : { active: false };
  }
}

export async function runClientFlow(server: AuthorizationServer, input: { clientId: string; redirectUri: string; subject: string }) {
  const verifier = createCodeVerifier(); const state = randomBytes(16).toString('hex');
  const authorization = server.authorize({ ...input, codeChallenge: createCodeChallenge(verifier), state });
  const callback = new URL(authorization.redirectTo);
  if (callback.searchParams.get('state') !== state) throw new Error('State mismatch');
  return server.exchange({ code: callback.searchParams.get('code')!, clientId: input.clientId, redirectUri: input.redirectUri, codeVerifier: verifier });
}
