import { isDeepStrictEqual } from 'node:util';

type TestFn = () => void | Promise<void>;
type TestCase = { name: string; fn: TestFn };
const tests: TestCase[] = [];
let suite: string[] = [];

export function describe(name: string, fn: () => void): void {
  suite.push(name);
  try { fn(); } finally { suite.pop(); }
}
export function it(name: string, fn: TestFn): void { tests.push({ name: [...suite, name].join(' > '), fn }); }
export function reset(): void { tests.length = 0; suite = []; }

export function expect<T>(actual: T) {
  return {
    toBe(expected: T) { if (!Object.is(actual, expected)) throw new Error(`Expected ${String(actual)} to be ${String(expected)}`); },
    toEqual(expected: unknown) { if (!isDeepStrictEqual(actual, expected)) throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
    toThrow(expected?: RegExp | string) {
      if (typeof actual !== 'function') throw new Error('toThrow expects a function');
      let thrown: unknown;
      try { (actual as unknown as () => unknown)(); } catch (error) { thrown = error; }
      if (!thrown) throw new Error('Expected function to throw');
      const message = thrown instanceof Error ? thrown.message : String(thrown);
      if (typeof expected === 'string' && !message.includes(expected)) throw new Error(`Expected error to include ${expected}`);
      if (expected instanceof RegExp && !expected.test(message)) throw new Error(`Expected error to match ${expected}`);
    },
    toBeTruthy() { if (!actual) throw new Error(`Expected ${String(actual)} to be truthy`); },
  };
}

export async function run(): Promise<{ passed: number; failed: number }> {
  let passed = 0; let failed = 0;
  for (const test of tests) {
    try { await test.fn(); passed++; console.log(`✓ ${test.name}`); }
    catch (error) { failed++; console.error(`✗ ${test.name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { passed, failed };
}

export const exerciseId = '25.1';
