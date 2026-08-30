// Starter for 27.5 課題27.5: 曖昧な要望を検証可能な仕様へ変換する (★★★)
// Purpose: 1行の曖昧な要望を、業務ルール、状態遷移、受け入れ条件、API契約、非機能要件まで
//          機械可読な仕様へ落とし、その仕様から受け入れテストを生成して実装を採点する。
//
// 依頼として届いた文は次の1行だけである。
//   「プロジェクトに同僚を招待できるようにしてほしい」
//
// 手順:
//   1. 本文 27.13 の問題定義シートとストーリーを埋め、story へ書き写す。
//   2. 本文 27.14 の遷移表と業務ルール表を TRANSITIONS と rules へ写す。
//   3. 本文 27.15 の Example Mapping で出した例を examples へ写す（境界と失敗を必ず含める）。
//   4. 本文 27.16 の対応表を contract へ、27.17 の5項目を nfr へ写す。
//   5. createInvitationService を仕様どおりに実装する。
//   6. runAcceptanceChecks が examples を1件ずつ実行し、auditSpec が
//      「仕様に書いたのに誰も検証していない項目」を検出するところまで通す。
//
// 完成したら次を実行する。
//   pnpm --filter @handbook/ch27 exec tsx spec-to-tests/starter/report.ts

export type InvitationState = 'pending' | 'accepted' | 'revoked' | 'expired';
export type InvitationEvent = 'accept' | 'revoke' | 'expire';
export type Role = 'admin' | 'member' | 'viewer';

export type Outcome =
  | { kind: 'transition'; to: InvitationState }
  | { kind: 'noop' }
  | { kind: 'rejected'; reason: string; status: number; error: string };

export const INVITATION_STATES: readonly InvitationState[] = ['pending', 'accepted', 'revoked', 'expired'];
export const INVITATION_EVENTS: readonly InvitationEvent[] = ['accept', 'revoke', 'expire'];

// TODO: 27.14 の遷移表の12マスをすべて埋める。Record<...> 型のおかげで、
//       埋め忘れた組み合わせは型エラーとして検出される。
export const TRANSITIONS: Record<InvitationState, Record<InvitationEvent, Outcome>> = {
  pending: {
    accept: { kind: 'transition', to: 'accepted' },
    revoke: { kind: 'transition', to: 'revoked' },
    expire: { kind: 'transition', to: 'expired' },
  },
  accepted: {
    accept: { kind: 'rejected', reason: 'already accepted', status: 409, error: 'already_accepted' },
    revoke: { kind: 'noop' }, // TODO: 27.14 の表では拒否になっている。直す。
    expire: { kind: 'noop' },
  },
  // TODO: revoked と expired の行を追加する。
} as unknown as Record<InvitationState, Record<InvitationEvent, Outcome>>;

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

export function buildInvitationSpec(): FeatureSpec {
  // TODO: rules、examples、contract、nfr を埋める。
  //       examples は1件だけ書いてある。境界（上限ちょうど、期限ちょうど）と
  //       失敗系（既にメンバー、取り消し済み、存在しないID）を追加する。
  return {
    story: { role: 'TODO', want: 'TODO', soThat: 'TODO' },
    rules: [],
    transitions: TRANSITIONS,
    contract: [],
    nfr: [],
    examples: [
      {
        id: 'E-01', rules: ['BR-03'], label: '初回招待は pending で作成され、期限は7日後',
        given: [], when: { op: 'invite', email: 'alice@example.com', role: 'member' },
        then: { status: 201, state: 'pending', invitationId: 'new', notifications: 1, expiresInDays: 7 },
      },
    ],
  };
}

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
export type ServiceFactory = (options: ServiceOptions) => InvitationService;

export function createInvitationService(_options: ServiceOptions): InvitationService {
  // TODO: BR-01〜BR-05 と TRANSITIONS に従って実装する。
  //       期限切れを保存された状態にするか、時刻から導出するかは自分で決め、
  //       決めた理由を README かコメントへ残す。
  throw new Error('not implemented');
}

export type ExampleResult = { id: string; passed: boolean; status: number; failures: string[] };
export type AcceptanceReport = { total: number; passed: number; results: ExampleResult[]; observedStatuses: number[] };

export function runAcceptanceChecks(_spec: FeatureSpec, _factory: ServiceFactory): AcceptanceReport {
  // TODO: examples を1件ずつ、given を順に実行してから when を実行し、then と突き合わせる。
  //       期待値をこの関数へ直書きしないこと。仕様データだけを読む。
  throw new Error('not implemented');
}

export type AuditReport = {
  rules: number; coveredRules: number; uncoveredRules: string[];
  transitions: number; filledTransitions: number; missingTransitions: string[];
  statuses: number; exercisedStatuses: number; unexercisedStatuses: number[];
  undeclaredStatuses: number[];
};

export function auditSpec(_spec: FeatureSpec, _report: AcceptanceReport): AuditReport {
  // TODO: 例が紐づかない業務ルール、埋まっていない遷移表の欄、
  //       受け入れテストで一度も観測されない契約上のステータスを検出する。
  throw new Error('not implemented');
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
