// 課題17.5 の実行入口 (模範解答)。4件の配送失敗の再現状況を出力する。
import { formatReport, runFindings } from './main.js';

for (const line of formatReport(await runFindings())) console.log(line);
