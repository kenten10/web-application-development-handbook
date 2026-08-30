// 課題14.7 の実行入口 (模範解答)。4件の抜けの再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
