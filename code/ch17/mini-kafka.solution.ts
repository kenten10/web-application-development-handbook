import { EventEmitter } from 'node:events';

export type BrokerMessage<T = unknown> = { topic: string; partition: number; offset: number; value: T; timestamp: number };
type Topic = { partitions: Array<BrokerMessage[]>; nextPartition: number };

export class MiniBroker {
  private readonly topics = new Map<string, Topic>();
  private readonly committed = new Map<string, number>();
  createTopic(name: string, options: { partitions: number }): void {
    if (options.partitions <= 0) throw new Error('partitions must be positive');
    this.topics.set(name, { partitions: Array.from({ length: options.partitions }, () => []), nextPartition: 0 });
  }
  publish<T>(topicName: string, value: T, key?: string): BrokerMessage<T> {
    const topic = this.topics.get(topicName); if (!topic) throw new Error(`unknown topic ${topicName}`);
    const partition = key === undefined ? topic.nextPartition++ % topic.partitions.length : hash(key) % topic.partitions.length;
    const log = topic.partitions[partition]!;
    const message: BrokerMessage<T> = { topic: topicName, partition, offset: log.length, value, timestamp: Date.now() };
    log.push(message); return message;
  }
  consumer<T = unknown>(topicName: string, options: { group: string }): MiniConsumer<T> {
    if (!this.topics.has(topicName)) throw new Error(`unknown topic ${topicName}`);
    return new MiniConsumer<T>(this, topicName, options.group);
  }
  poll<T>(topic: string, group: string, max = 1): BrokerMessage<T>[] {
    const data = this.topics.get(topic)!; const result: BrokerMessage<T>[] = [];
    for (let partition = 0; partition < data.partitions.length && result.length < max; partition++) {
      const key = `${group}:${topic}:${partition}`; const offset = this.committed.get(key) ?? 0; const log = data.partitions[partition]!;
      while (result.length < max && offset + result.filter((m) => m.partition === partition).length < log.length) {
        result.push(log[offset + result.filter((m) => m.partition === partition).length] as BrokerMessage<T>);
      }
    }
    return result;
  }
  commit(group: string, message: BrokerMessage): void { this.committed.set(`${group}:${message.topic}:${message.partition}`, message.offset + 1); }
}

export class MiniConsumer<T> extends EventEmitter {
  constructor(private readonly broker: MiniBroker, readonly topic: string, readonly group: string) { super(); }
  poll(max = 1): BrokerMessage<T>[] { return this.broker.poll<T>(this.topic, this.group, max); }
  ack(message: BrokerMessage<T>): void { this.broker.commit(this.group, message); }
  drain(max = 100): BrokerMessage<T>[] { const messages = this.poll(max); for (const message of messages) { this.emit('message', message); this.ack(message); } return messages; }
}
function hash(value: string): number { let h = 2166136261; for (const c of value) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
