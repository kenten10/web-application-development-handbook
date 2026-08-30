// 課題27.5 の実行入口。自分の main.ts を呼び出し、仕様の監査結果と受け入れ結果を出力する。
import { auditSpec, buildInvitationSpec, createInvitationService, formatReport, runAcceptanceChecks } from './main.js';

const spec = buildInvitationSpec();
const report = runAcceptanceChecks(spec, createInvitationService);
for (const line of formatReport(auditSpec(spec, report), report)) console.log(line);
for (const result of report.results.filter((item) => !item.passed)) {
  console.log(`  ${result.id}: ${result.failures.join(' / ')}`);
}
