// 課題13.7 の実行入口 (模範解答)。4つの漏洩経路とポリシー層の効果を出力する。
import { buildReport, formatReport } from './main.js';

for (const line of formatReport(buildReport())) console.log(line);
