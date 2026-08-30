export class OptimisticStore<T> {
  constructor(private state: T) {}
  getState(): T { return this.state; }
  // TODO: apply immediately, commit on success, and roll back only the failed operation.
}
