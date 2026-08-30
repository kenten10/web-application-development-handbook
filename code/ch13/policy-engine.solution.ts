export type Effect = 'allow' | 'deny';
export interface PolicyContext<S, R> { subject: S; resource: R; action: string; }
export interface Policy<S, R> { effect: Effect; action: string | readonly string[]; roles?: readonly string[]; condition?: (context: PolicyContext<S, R>) => boolean; }

function actionMatches(pattern: string, action: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return action.startsWith(pattern.slice(0, -1));
  return pattern === action;
}

export class PolicyEngine<S extends { role?: string; roles?: readonly string[] }, R = Record<string, unknown>> {
  readonly #policies: Policy<S, R>[] = [];
  define(policy: Policy<S, R>): this { this.#policies.push(policy); return this; }
  can(subject: S, action: string, resource: R): boolean {
    const roles = new Set([subject.role, ...(subject.roles ?? [])].filter((role): role is string => Boolean(role)));
    const matches = this.#policies.filter((policy) => {
      const actions = Array.isArray(policy.action) ? policy.action : [policy.action];
      if (!actions.some((pattern) => actionMatches(pattern, action))) return false;
      if (policy.roles && !policy.roles.some((role) => roles.has(role))) return false;
      if (!policy.condition) return true;
      // 条件式が例外を投げたら「判定できなかった」であって「許可」ではない。
      // 例外を呼び出し元まで通すと、上位で握りつぶされたときに許可扱いになりうる。
      // 判定不能は拒否側へ倒す (fail closed)
      try {
        return policy.condition({ subject, action, resource });
      } catch {
        return policy.effect === 'deny';
      }
    });
    if (matches.some((policy) => policy.effect === 'deny')) return false;
    return matches.some((policy) => policy.effect === 'allow');
  }
}
