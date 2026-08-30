// 課題23.10 の実行入口。自分の main.ts を呼び出し、弱点の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
