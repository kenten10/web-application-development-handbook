// 課題14.6 の実行入口。自分の main.ts を呼び出し、4つの日時バグの再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(runFindings())) console.log(line);
