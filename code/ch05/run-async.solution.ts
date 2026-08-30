export type Yieldable<T> = T | PromiseLike<T>;

export function runAsync<T>(generator: Generator<Yieldable<unknown>, T, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const step = (method: 'next' | 'throw', input?: unknown): void => {
      let result: IteratorResult<Yieldable<unknown>, T>;
      try {
        result = generator[method](input);
      } catch (error) {
        reject(error);
        return;
      }
      if (result.done) {
        resolve(result.value);
        return;
      }
      Promise.resolve(result.value).then(
        (value) => step('next', value),
        (error) => step('throw', error),
      );
    };
    step('next');
  });
}

export function asyncify<Args extends unknown[], T>(
  generatorFactory: (...args: Args) => Generator<Yieldable<unknown>, T, unknown>,
): (...args: Args) => Promise<T> {
  return (...args) => runAsync(generatorFactory(...args));
}

export const exerciseId = '5.2';
