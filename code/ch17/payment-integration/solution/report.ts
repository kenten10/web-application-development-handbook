// 課題17.7 の実行入口 (模範解答)。4件の欠陥の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
