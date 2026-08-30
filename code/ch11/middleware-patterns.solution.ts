export type ChainMiddleware<C> = (context: C, next: () => void) => void;
export type OnionMiddleware<C> = (context: C, next: () => Promise<void>) => Promise<void>;

export function runChain<C>(middlewares: readonly ChainMiddleware<C>[], context: C): void {
  let index = -1;
  const dispatch = (position: number): void => {
    if (position <= index) throw new Error('next() called more than once');
    index = position;
    const middleware = middlewares[position];
    if (middleware) middleware(context, () => dispatch(position + 1));
  };
  dispatch(0);
}

export async function runOnion<C>(middlewares: readonly OnionMiddleware<C>[], context: C): Promise<void> {
  let index = -1;
  const dispatch = async (position: number): Promise<void> => {
    if (position <= index) throw new Error('next() called more than once');
    index = position;
    const middleware = middlewares[position];
    if (middleware) await middleware(context, () => dispatch(position + 1));
  };
  await dispatch(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const chainLog: string[] = [];
  runChain([
    (_ctx, next) => { chainLog.push('1 before'); next(); chainLog.push('1 after'); },
    () => { chainLog.push('2'); },
  ], {});
  const onionLog: string[] = [];
  await runOnion([
    async (_ctx, next) => { onionLog.push('1 before'); await next(); onionLog.push('1 after'); },
    async (_ctx, next) => { onionLog.push('2 before'); await next(); onionLog.push('2 after'); },
  ], {});
  console.log({ chainLog, onionLog });
}
