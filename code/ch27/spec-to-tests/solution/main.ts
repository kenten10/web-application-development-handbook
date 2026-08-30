// 課題27.5 模範解答: 曖昧な要望を検証可能な仕様へ変換する。
// 仕様(データ) → 実装 → 受け入れテスト → 仕様と実装の対応検査 を1本の流れにする。
// 本文 27.13〜27.17 の各工程が、この1ファイル内でどのデータ構造になるかを対応させている。

// ---------------------------------------------------------------------------
// 27.14: 状態と事象、遷移表
// ---------------------------------------------------------------------------
export type InvitationState = 'pending' | 'accepted' | 'revoked' | 'expired';
export type InvitationEvent = 'accept' | 'revoke' | 'expire';
export type Role = 'admin' | 'member' | 'viewer';

export type Outcome =
  | { kind: 'transition'; to: InvitationState }
  | { kind: 'noop' }
  | { kind: 'rejected'; reason: string; status: number; error: string };

export const INVITATION_STATES: readonly InvitationState[] = ['pending', 'accepted', 'revoked', 'expired'];
export const INVITATION_EVENTS: readonly InvitationEvent[] = ['accept', 'revoke', 'expire'];

const rejected = (reason: string, status: number, error: string): Outcome => ({ kind: 'rejected', reason, status, error });

export const TRANSITIONS: Record<InvitationState, Record<InvitationEvent, Outcome>> = {
  pending: {
    accept: { kind: 'transition', to: 'accepted' },
    revoke: { kind: 'transition', to: 'revoked' },
    expire: { kind: 'transition', to: 'expired' },
  },
  accepted: {
    accept: rejected('already accepted', 409, 'already_accepted'),
    revoke: rejected('accepted invitation cannot be revoked', 409, 'accepted_invitation'),
    expire: { kind: 'noop' },
  },
  revoked: {
    accept: rejected('invitation revoked', 409, 'invitation_revoked'),
    revoke: { kind: 'noop' },
    expire: { kind: 'noop' },
  },
  expired: {
    accept: rejected('invitation expired', 410, 'invitation_expired'),
    revoke: rejected('invitation expired', 410, 'invitation_expired'),
    expire: { kind: 'noop' },
  },
};

// ---------------------------------------------------------------------------
// 27.13〜27.17: 仕様そのものをデータとして持つ
// ---------------------------------------------------------------------------
export type BusinessRule = { id: string; kind: 'constraint' | 'derivation' | 'reaction'; text: string };
export type ContractEntry = { operation: 'invite' | 'accept' | 'revoke'; status: number; error?: string; description: string };
export type NonFunctionalRequirement = { id: string; target: string; metric: string; budgetMs: number; condition: string };

export type Step =
  | { op: 'addMember'; email: string }
  | { op: 'advance'; ms: number }
  | { op: 'invite'; email: string; role: Role }
  | { op: 'accept'; ref: 'last' | 'unknown' }
  | { op: 'revoke'; ref: 'last' | 'unknown' };

export type Expectation = {
  status: number;
  error?: string;
  state?: InvitationState;
  invitationId?: 'new' | 'existing';
  notifications?: number;
  expiresInDays?: number;
};

export type Example = { id: string; rules: string[]; label: string; given: Step[]; when: Step; then: Expectation };

export type FeatureSpec = {
  story: { role: string; want: string; soThat: string };
  rules: BusinessRule[];
  transitions: Record<InvitationState, Record<InvitationEvent, Outcome>>;
  examples: Example[];
  contract: ContractEntry[];
  nfr: NonFunctionalRequirement[];
};

const members = (count: number): Step[] =>
  Array.from({ length: count }, (_, index) => ({ op: 'addMember' as const, email: `m${index + 1}@example.com` }));

const DAY_MS = 86_400_000;

export function buildInvitationSpec(): FeatureSpec {
  return {
    story: {
      role: 'プロジェクト管理者',
      want: '同僚をプロジェクトへ招待したい',
      soThat: 'メンバー追加のたびに運営へ依頼する手間をなくしたい',
    },
    rules: [
      { id: 'BR-01', kind: 'constraint', text: 'プロジェクトのメンバーは50名以下' },
      { id: 'BR-02', kind: 'constraint', text: '同一アドレスの pending 招待は1件まで' },
      { id: 'BR-03', kind: 'derivation', text: '招待の有効期限は作成時刻の7日後' },
      { id: 'BR-04', kind: 'constraint', text: '有効期限に達した招待は受諾できない' },
      { id: 'BR-05', kind: 'reaction', text: '招待を新規作成したときだけ通知を1件予約する' },
    ],
    transitions: TRANSITIONS,
    contract: [
      { operation: 'invite', status: 201, description: '招待を新規作成した' },
      { operation: 'invite', status: 200, description: '同一宛先の pending 招待があり、既存を返した (BR-02)' },
      { operation: 'invite', status: 409, error: 'already_member', description: '宛先が既にメンバー' },
      { operation: 'invite', status: 422, error: 'member_limit_reached', description: 'メンバー数上限 (BR-01)' },
      { operation: 'accept', status: 200, description: '受諾しメンバーへ追加した' },
      { operation: 'accept', status: 409, error: 'invitation_revoked', description: '取り消し済みの招待' },
      { operation: 'accept', status: 410, error: 'invitation_expired', description: '有効期限切れ (BR-04)' },
      { operation: 'accept', status: 404, error: 'invitation_not_found', description: '招待が存在しない' },
      { operation: 'revoke', status: 200, description: '招待を取り消した' },
      { operation: 'revoke', status: 409, error: 'accepted_invitation', description: '受諾済みは取り消せない' },
    ],
    nfr: [
      {
        id: 'NFR-01',
        target: 'invite 1回',
        metric: 'p95 処理時間',
        budgetMs: 5,
        condition: 'メンバー50名・招待100件を保持した状態で200回実行',
      },
    ],
    examples: [
      {
        id: 'E-01', rules: ['BR-03', 'BR-05'], label: '初回招待は pending で作成され、期限は7日後',
        given: [], when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 201, state: 'pending', invitationId: 'new', notifications: 1, expiresInDays: 7 },
      },
      {
        id: 'E-02', rules: ['BR-02', 'BR-05'], label: '重複招待は新規作成せず既存を返し、通知も増えない',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }],
        when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 200, state: 'pending', invitationId: 'existing', notifications: 1 },
      },
      {
        id: 'E-03', rules: ['BR-02'], label: '取り消し後の再招待は新しい招待になる',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'revoke', ref: 'last' }],
        when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 201, state: 'pending', invitationId: 'new', notifications: 2 },
      },
      {
        id: 'E-04', rules: ['BR-01'], label: 'メンバー49名なら招待できる（上限の境界）',
        given: members(49), when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 201, state: 'pending' },
      },
      {
        id: 'E-05', rules: ['BR-01'], label: 'メンバー50名では招待できない（上限の境界）',
        given: members(50), when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 422, error: 'member_limit_reached' },
      },
      {
        id: 'E-06', rules: [], label: '既にメンバーの宛先は招待できない',
        given: [{ op: 'addMember', email: 'alice@example.com' }],
        when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 409, error: 'already_member' },
      },
      {
        id: 'E-07', rules: ['BR-04'], label: '期限1秒前の受諾は成功する',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'advance', ms: 7 * DAY_MS - 1000 }],
        when: { op: 'accept', ref: 'last' }, then: { status: 200, state: 'accepted' },
      },
      {
        id: 'E-08', rules: ['BR-04'], label: '期限ちょうどの受諾は拒否される',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'advance', ms: 7 * DAY_MS }],
        when: { op: 'accept', ref: 'last' }, then: { status: 410, error: 'invitation_expired' },
      },
      {
        id: 'E-09', rules: ['BR-04'], label: '期限1秒後の受諾は拒否される',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'advance', ms: 7 * DAY_MS + 1000 }],
        when: { op: 'accept', ref: 'last' }, then: { status: 410, error: 'invitation_expired' },
      },
      {
        id: 'E-10', rules: [], label: '取り消し済みの招待は受諾できない',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'revoke', ref: 'last' }],
        when: { op: 'accept', ref: 'last' }, then: { status: 409, error: 'invitation_revoked' },
      },
      {
        id: 'E-11', rules: [], label: 'pending の招待は取り消せる',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }],
        when: { op: 'revoke', ref: 'last' }, then: { status: 200, state: 'revoked' },
      },
      {
        id: 'E-12', rules: [], label: '受諾済みの招待は取り消せない',
        given: [{ op: 'invite', email: 'alice@example.com', role: 'member' }, { op: 'accept', ref: 'last' }],
        when: { op: 'revoke', ref: 'last' }, then: { status: 409, error: 'accepted_invitation' },
      },
      {
        id: 'E-13', rules: [], label: '存在しない招待の受諾は404',
        given: [], when: { op: 'accept', ref: 'unknown' }, then: { status: 404, error: 'invitation_not_found' },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 仕様に従う実装
// ---------------------------------------------------------------------------
export type Invitation = {
  id: string; email: string; role: Role; state: InvitationState; createdAt: Date; expiresAt: Date;
};
export type Result = { status: number; error?: string; invitation?: Invitation };
export type InvitationService = {
  addMember(email: string): void;
  memberCount(): number;
  notificationCount(): number;
  invite(input: { email: string; role: Role }): Result;
  accept(input: { id: string }): Result;
  revoke(input: { id: string }): Result;
};
export type ServiceOptions = { now: () => Date; memberLimit?: number; ttlDays?: number };

export function createInvitationService(options: ServiceOptions): InvitationService {
  const memberLimit = options.memberLimit ?? 50;
  const ttlDays = options.ttlDays ?? 7;
  const memberEmails = new Set<string>();
  const invitations = new Map<string, Invitation>();
  const notifications: { type: string; invitationId: string }[] = [];
  let sequence = 0;

  // 期限切れは保存された状態ではなく時刻から導出する。バッチ停止で実態とずれないため。
  const effectiveState = (invitation: Invitation, now: Date): InvitationState =>
    invitation.state === 'pending' && now.getTime() >= invitation.expiresAt.getTime() ? 'expired' : invitation.state;

  const transition = (id: string, event: InvitationEvent): Result => {
    const now = options.now();
    const invitation = invitations.get(id);
    if (!invitation) return { status: 404, error: 'invitation_not_found' };
    const outcome = TRANSITIONS[effectiveState(invitation, now)][event];
    if (outcome.kind === 'rejected') return { status: outcome.status, error: outcome.error };
    if (outcome.kind === 'transition') {
      invitation.state = outcome.to;
      if (outcome.to === 'accepted') memberEmails.add(invitation.email);
    }
    return { status: 200, invitation };
  };

  return {
    addMember(email) { memberEmails.add(email); },
    memberCount() { return memberEmails.size; },
    notificationCount() { return notifications.length; },
    invite({ email, role }) {
      const now = options.now();
      if (memberEmails.has(email)) return { status: 409, error: 'already_member' };
      for (const invitation of invitations.values()) {
        // BR-02: 同一宛先の pending 招待は1件まで。二重通知も防ぐ。
        if (invitation.email === email && effectiveState(invitation, now) === 'pending') {
          return { status: 200, invitation };
        }
      }
      if (memberEmails.size >= memberLimit) return { status: 422, error: 'member_limit_reached' }; // BR-01
      sequence += 1;
      const invitation: Invitation = {
        id: `inv-${sequence}`,
        email,
        role,
        state: 'pending',
        createdAt: now,
        expiresAt: new Date(now.getTime() + ttlDays * DAY_MS), // BR-03
      };
      invitations.set(invitation.id, invitation);
      notifications.push({ type: 'InvitationCreated', invitationId: invitation.id }); // BR-05
      return { status: 201, invitation };
    },
    accept({ id }) { return transition(id, 'accept'); },
    revoke({ id }) { return transition(id, 'revoke'); },
  };
}

// ---------------------------------------------------------------------------
// 仕様から受け入れテストを回す
// ---------------------------------------------------------------------------
export type ExampleResult = { id: string; passed: boolean; status: number; failures: string[] };
export type AcceptanceReport = { total: number; passed: number; results: ExampleResult[]; observedStatuses: number[] };

export type ServiceFactory = (options: ServiceOptions) => InvitationService;

const BASE_TIME = Date.parse('2026-01-01T00:00:00Z');

export function runExample(example: Example, factory: ServiceFactory): ExampleResult {
  const clock = { ms: BASE_TIME };
  const service = factory({ now: () => new Date(clock.ms) });
  let lastId: string | null = null;

  const execute = (step: Step): Result | null => {
    switch (step.op) {
      case 'addMember': service.addMember(step.email); return null;
      case 'advance': clock.ms += step.ms; return null;
      case 'invite': {
        const result = service.invite({ email: step.email, role: step.role });
        if (result.invitation) lastId = result.invitation.id;
        return result;
      }
      case 'accept': return service.accept({ id: step.ref === 'last' ? (lastId ?? 'missing') : 'missing' });
      case 'revoke': return service.revoke({ id: step.ref === 'last' ? (lastId ?? 'missing') : 'missing' });
    }
  };

  for (const step of example.given) execute(step);
  const previousId = lastId;
  const result = execute(example.when);
  const failures: string[] = [];
  if (!result) {
    return { id: example.id, passed: false, status: 0, failures: ['when ステップが結果を返しませんでした'] };
  }

  const expected = example.then;
  if (result.status !== expected.status) failures.push(`status: expected ${expected.status}, actual ${result.status}`);
  if (expected.error !== undefined && result.error !== expected.error) {
    failures.push(`error: expected ${expected.error}, actual ${result.error ?? 'none'}`);
  }
  if (expected.state !== undefined && result.invitation?.state !== expected.state) {
    failures.push(`state: expected ${expected.state}, actual ${result.invitation?.state ?? 'none'}`);
  }
  if (expected.invitationId !== undefined) {
    const isSame = result.invitation !== undefined && result.invitation.id === previousId;
    const matched = expected.invitationId === 'existing' ? isSame : !isSame;
    if (!matched) failures.push(`invitationId: expected ${expected.invitationId}`);
  }
  if (expected.notifications !== undefined && service.notificationCount() !== expected.notifications) {
    failures.push(`notifications: expected ${expected.notifications}, actual ${service.notificationCount()}`);
  }
  if (expected.expiresInDays !== undefined && result.invitation) {
    const days = (result.invitation.expiresAt.getTime() - result.invitation.createdAt.getTime()) / DAY_MS;
    if (days !== expected.expiresInDays) failures.push(`expiresInDays: expected ${expected.expiresInDays}, actual ${days}`);
  }
  return { id: example.id, passed: failures.length === 0, status: result.status, failures };
}

export function runAcceptanceChecks(spec: FeatureSpec, factory: ServiceFactory): AcceptanceReport {
  const results = spec.examples.map((example) => runExample(example, factory));
  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    results,
    observedStatuses: [...new Set(results.map((result) => result.status))].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// 仕様と実装の対応を検査する
// ---------------------------------------------------------------------------
export type AuditReport = {
  rules: number; coveredRules: number; uncoveredRules: string[];
  transitions: number; filledTransitions: number; missingTransitions: string[];
  statuses: number; exercisedStatuses: number; unexercisedStatuses: number[];
  undeclaredStatuses: number[];
};

export function auditSpec(spec: FeatureSpec, report: AcceptanceReport): AuditReport {
  const covered = new Set(spec.examples.flatMap((example) => example.rules));
  const uncoveredRules = spec.rules.filter((rule) => !covered.has(rule.id)).map((rule) => rule.id);

  const missingTransitions: string[] = [];
  for (const state of INVITATION_STATES) {
    for (const event of INVITATION_EVENTS) {
      if (!spec.transitions[state]?.[event]) missingTransitions.push(`${state}/${event}`);
    }
  }
  const transitions = INVITATION_STATES.length * INVITATION_EVENTS.length;

  const declared = [...new Set(spec.contract.map((entry) => entry.status))].sort((a, b) => a - b);
  const observed = new Set(report.observedStatuses);
  const unexercisedStatuses = declared.filter((status) => !observed.has(status));
  const undeclaredStatuses = report.observedStatuses.filter((status) => !declared.includes(status));

  return {
    rules: spec.rules.length,
    coveredRules: spec.rules.length - uncoveredRules.length,
    uncoveredRules,
    transitions,
    filledTransitions: transitions - missingTransitions.length,
    missingTransitions,
    statuses: declared.length,
    exercisedStatuses: declared.length - unexercisedStatuses.length,
    unexercisedStatuses,
    undeclaredStatuses,
  };
}

export function formatReport(audit: AuditReport, report: AcceptanceReport): string[] {
  return [
    `spec audit: rules=${audit.rules} covered=${audit.coveredRules} / ` +
      `transitions=${audit.transitions} filled=${audit.filledTransitions} / ` +
      `statuses=${audit.statuses} exercised=${audit.exercisedStatuses}`,
    `acceptance: ${report.passed}/${report.total} passed`,
  ];
}

export const exerciseId = '27.5';
