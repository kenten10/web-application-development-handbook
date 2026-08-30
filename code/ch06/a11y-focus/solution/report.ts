// 課題6.6 の実行入口 (模範解答)。4件の障壁の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
