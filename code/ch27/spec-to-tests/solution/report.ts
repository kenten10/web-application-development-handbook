// 課題27.5 模範解答の実行入口。仕様の監査結果と受け入れテストの結果を標準出力へ出す。
import { auditSpec, buildInvitationSpec, createInvitationService, formatReport, runAcceptanceChecks } from './main.js';

const spec = buildInvitationSpec();
const report = runAcceptanceChecks(spec, createInvitationService);
for (const line of formatReport(auditSpec(spec, report), report)) console.log(line);
for (const result of report.results.filter((item) => !item.passed)) {
  console.log(`  ${result.id}: ${result.failures.join(' / ')}`);
}
