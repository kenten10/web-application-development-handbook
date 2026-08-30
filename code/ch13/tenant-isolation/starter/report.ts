// 課題13.7 の実行入口。自分の main.ts を呼び出し、漏洩の再現状況を出力する。
import { buildReport, formatReport } from './main.js';

for (const line of formatReport(buildReport())) console.log(line);
