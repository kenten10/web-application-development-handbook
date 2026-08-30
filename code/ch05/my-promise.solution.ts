export type PromiseState = 'pending' | 'fulfilled' | 'rejected';

type Executor<T> = (
  resolve: (value: T | PromiseLike<T>) => void,
  reject: (reason?: unknown) => void,
) => void;

type Handler<T, U> = {
  onFulfilled?: (value: T) => U | PromiseLike<U>;
  onRejected?: (reason: unknown) => U | PromiseLike<U>;
  resolve: (value: U | PromiseLike<U>) => void;
  reject: (reason?: unknown) => void;
};

export class MyPromise<T> implements PromiseLike<T> {
  private state: PromiseState = 'pending';
  private value!: T;
  private reason: unknown;
  private handlers: Handler<T, unknown>[] = [];

  constructor(executor: Executor<T>) {
    let settled = false;
    const resolve = (value: T | PromiseLike<T>): void => {
      if (settled) return;
      if (value === this) {
        settled = true;
        this.rejectInternal(new TypeError('A promise cannot resolve itself'));
        return;
      }
      if (value && (typeof value === 'object' || typeof value === 'function')) {
        try {
          const then = (value as PromiseLike<T>).then;
          if (typeof then === 'function') {
            then.call(value, resolve, reject);
            return;
          }
        } catch (error) {
          reject(error);
          return;
        }
      }
      settled = true;
      this.state = 'fulfilled';
      this.value = value as T;
      this.flush();
    };
    const reject = (reason?: unknown): void => {
      if (settled) return;
      settled = true;
      this.rejectInternal(reason);
    };
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  private rejectInternal(reason: unknown): void {
    this.state = 'rejected';
    this.reason = reason;
    this.flush();
  }

  private flush(): void {
    if (this.state === 'pending') return;
    const handlers = this.handlers.splice(0);
    for (const handler of handlers) queueMicrotask(() => this.runHandler(handler));
  }

  private runHandler<U>(handler: Handler<T, U>): void {
    try {
      if (this.state === 'fulfilled') {
        if (!handler.onFulfilled) handler.resolve(this.value as unknown as U);
        else handler.resolve(handler.onFulfilled(this.value));
      } else {
        if (!handler.onRejected) handler.reject(this.reason);
        else handler.resolve(handler.onRejected(this.reason));
      }
    } catch (error) {
      handler.reject(error);
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): MyPromise<TResult1 | TResult2> {
    return new MyPromise<TResult1 | TResult2>((resolve, reject) => {
      const handler: Handler<T, TResult1 | TResult2> = {
        resolve,
        reject,
        ...(onfulfilled ? { onFulfilled: onfulfilled } : {}),
        ...(onrejected ? { onRejected: onrejected } : {}),
      };
      if (this.state === 'pending') this.handlers.push(handler as Handler<T, unknown>);
      else queueMicrotask(() => this.runHandler(handler));
    });
  }

  catch<TResult = never>(
    onRejected: (reason: unknown) => TResult | PromiseLike<TResult>,
  ): MyPromise<T | TResult> {
    return this.then(undefined, onRejected);
  }

  finally(onFinally: () => void | PromiseLike<void>): MyPromise<T> {
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),
      (reason) => MyPromise.resolve(onFinally()).then(() => { throw reason; }),
    );
  }

  static resolve<T>(value: T | PromiseLike<T>): MyPromise<Awaited<T>> {
    if (value instanceof MyPromise) return value as MyPromise<Awaited<T>>;
    return new MyPromise<Awaited<T>>((resolve) => resolve(value as Awaited<T> | PromiseLike<Awaited<T>>));
  }

  static reject<T = never>(reason?: unknown): MyPromise<T> {
    return new MyPromise<T>((_, reject) => reject(reason));
  }

  static all<T extends readonly unknown[]>(values: T): MyPromise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
    return new MyPromise((resolve, reject) => {
      const result = [] as unknown as { -readonly [K in keyof T]: Awaited<T[K]> };
      if (values.length === 0) { resolve(result); return; }
      let remaining = values.length;
      values.forEach((value, index) => {
        MyPromise.resolve(value).then((resolved) => {
          result[index] = resolved as Awaited<T[typeof index]>;
          remaining -= 1;
          if (remaining === 0) resolve(result);
        }, reject);
      });
    });
  }

  static allSettled<T extends readonly unknown[]>(values: T): MyPromise<{
    -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>>
  }> {
    return new MyPromise((resolve) => {
      const result = [] as unknown as { -readonly [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> };
      if (values.length === 0) { resolve(result); return; }
      let remaining = values.length;
      values.forEach((value, index) => {
        MyPromise.resolve(value).then(
          (resolved) => { result[index] = { status: 'fulfilled', value: resolved } as never; },
          (reason) => { result[index] = { status: 'rejected', reason } as never; },
        ).finally(() => {
          remaining -= 1;
          if (remaining === 0) resolve(result);
        });
      });
    });
  }

  static race<T>(values: Iterable<T | PromiseLike<T>>): MyPromise<Awaited<T>> {
    return new MyPromise((resolve, reject) => {
      for (const value of values) MyPromise.resolve(value).then(resolve, reject);
    });
  }
}

export const exerciseId = '5.1';
