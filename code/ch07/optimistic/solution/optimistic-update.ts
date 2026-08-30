export type Updater<T> = (current: T) => T;
export type MutationResult = { ok: true } | { ok: false; error: Error };

type Pending<T> = { id: number; update: Updater<T> };

export class OptimisticStore<T> {
  private confirmed: T;
  private optimistic: T;
  private pending: Pending<T>[] = [];
  private sequence = 0;
  private listeners = new Set<(state: T) => void>();
  private errorListeners = new Set<(error: Error) => void>();

  constructor(initial: T) {
    this.confirmed = initial;
    this.optimistic = initial;
  }

  getState(): T { return this.optimistic; }
  getPendingCount(): number { return this.pending.length; }

  subscribe(listener: (state: T) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  async mutate(update: Updater<T>, send: () => Promise<void>): Promise<MutationResult> {
    const operation = { id: ++this.sequence, update };
    this.pending.push(operation);
    this.recompute();
    try {
      await send();
      this.confirmed = update(this.confirmed);
      this.pending = this.pending.filter((item) => item.id !== operation.id);
      this.recompute();
      return { ok: true };
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.pending = this.pending.filter((item) => item.id !== operation.id);
      this.recompute();
      for (const listener of this.errorListeners) listener(error);
      return { ok: false, error };
    }
  }

  private recompute(): void {
    this.optimistic = this.pending.reduce((state, item) => item.update(state), this.confirmed);
    for (const listener of this.listeners) listener(this.optimistic);
  }
}

export function flakyServer(failureRate = 0.3, random: () => number = Math.random): () => Promise<void> {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (random() < failureRate) throw new Error('Server rejected the mutation');
  };
}
