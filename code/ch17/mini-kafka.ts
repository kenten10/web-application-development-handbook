// Starter for 17.1 課題17.1: ミニ Kafka 風キュー (★★★)
// Purpose: Kafka の「Topic + Partition + Offset + Consumer Group」モデルを実装。
// TODO:
// - 本文に記載された観察結果または振る舞いを確認できる。

export const exerciseId = "17.1";
// TODO: implement the exercise.

// --- 実装すべき公開API (KEN-61 生成。手で書き換えない) ---
// 完成条件と章のテストは、次の名前と形が公開されている前提で書かれている。
// 別の名前で実装すると、演習カードの「テスト方法」を自分の実装に対して実行できない。
//
//   export type BrokerMessage<T
//   export class MiniBroker
//     createTopic(name: string, options: { partitions: number }): void
//     publish<T>(topicName: string, value: T, key?: string): BrokerMessage<T>
//     consumer<T = unknown>(topicName: string, options: { group: string }): MiniConsumer<T>
//     poll<T>(topic: string, group: string, max = 1): BrokerMessage<T>[]
//     commit(group: string, message: BrokerMessage): void
//   export class MiniConsumer<T> extends EventEmitter
//     constructor(private readonly broker: MiniBroker, readonly topic: string, readonly group: string)
//     poll(max = 1): BrokerMessage<T>[]
//     ack(message: BrokerMessage<T>): void
//     drain(max = 100): BrokerMessage<T>[]
//
// 実装し終えてから読む模範解答: code/ch17/mini-kafka.solution.ts
// --- ここまで ---
