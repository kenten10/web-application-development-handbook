// 課題17.5 の実行入口。自分の main.ts を呼び出し、配送失敗の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(await runFindings())) console.log(line);
