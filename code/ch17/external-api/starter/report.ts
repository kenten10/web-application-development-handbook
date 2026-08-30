// 課題17.6 の実行入口。自分の main.ts を呼び出し、外部連携障害の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
