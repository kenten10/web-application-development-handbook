export type QueueMessage<T> = { id: string; payload: T; attempts: number; availableAt: number; lastError?: string };
export class DeadLetterQueue<T> {
  readonly messages: QueueMessage<T>[] = [];
  push(message: QueueMessage<T>): void { this.messages.push({ ...message }); }
  requeue(index = 0): QueueMessage<T> | undefined { return this.messages.splice(index, 1)[0]; }
}

export class RetryableQueue<T> {
  private readonly queue: QueueMessage<T>[] = [];
  readonly dlq = new DeadLetterQueue<T>();
  constructor(readonly options: { maxRetries?: number; baseDelayMs?: number } = {}) {}
  enqueue(id: string, payload: T, now = Date.now()): void { this.queue.push({ id, payload, attempts: 0, availableAt: now }); }
  pending(): number { return this.queue.length; }
  async processReady(handler: (payload: T) => Promise<void>, now = Date.now()): Promise<{ processed: number; retried: number; dead: number }> {
    let processed = 0; let retried = 0; let dead = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const message = this.queue[i]!; if (message.availableAt > now) continue;
      this.queue.splice(i, 1);
      try { await handler(message.payload); processed++; }
      catch (error) {
        message.attempts++; message.lastError = error instanceof Error ? error.message : String(error);
        if (message.attempts >= (this.options.maxRetries ?? 5)) { this.dlq.push(message); dead++; }
        else { message.availableAt = now + (this.options.baseDelayMs ?? 1000) * 2 ** (message.attempts - 1); this.queue.push(message); retried++; }
      }
    }
    return { processed, retried, dead };
  }
}
