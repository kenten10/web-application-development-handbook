// Starter for 28.3 課題28.3: ADR ジェネレータ (★★)
// Purpose: 「なぜそう設計したか」を残す ADR (Architecture Decision Record) を CLI で生成。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "28.3";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export function slugify(v:string)
//   export async function nextAdrNumber(dir:string)
//   export function renderAdr(v:{number:number;title:string;date?:string;status?:string;supersedes?:number})
//   export async function createAdr(dir:string,title:string,supersedes?:number)
//
// 実装し終えてから読む模範解答: code/ch28/adr-gen.solution.ts
// --- ここまで ---
