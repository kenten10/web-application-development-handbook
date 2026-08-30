// Starter for 22.2 課題22.2: Prometheus 風メトリクスサーバ (★★★)
// Purpose: Counter / Gauge / Histogram を自作し、/metrics HTTP エンドポイントで公開。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "22.2";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export class Counter extends Metric
//     inc(labels:Labels={},value=1)
//     expose()
//   export class Gauge extends Metric
//     set(value:number,labels:Labels={} )
//     inc(labels:Labels={},v=1)
//     dec(labels:Labels={},v=1)
//   export class Histogram extends Metric
//     constructor(name:string,help:string,readonly buckets:number[])
//     observe(value:number,labels:Labels={})
//   export class MetricRegistry
//     counter(o:{name:string;help:string;labelNames?:string[]})
//     gauge(o:{name:string;help:string})
//     histogram(o:{name:string;help:string;buckets:number[]})
//     serve(port=0):Promise<
//
// 実装し終えてから読む模範解答: code/ch22/metrics.solution.ts
// --- ここまで ---
