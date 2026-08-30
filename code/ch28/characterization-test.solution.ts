export type CharacterizationCase<I extends unknown[], O> = { input: I; output: O | { throws: string } };

export function generateCharacterizationTests<I extends unknown[], O>(options: {
  fn: (...args: I) => O;
  inputGenerator: () => I;
  numCases: number;
}): CharacterizationCase<I, O>[] {
  const out: CharacterizationCase<I, O>[] = [];
  for (let i = 0; i < options.numCases; i++) {
    const input = options.inputGenerator();
    try {
      out.push({ input, output: structuredClone(options.fn(...input)) });
    } catch (e) {
      out.push({ input, output: { throws: e instanceof Error ? e.message : String(e) } });
    }
  }
  return out;
}

function isThrowCase(output: unknown): output is { throws: string } {
  return typeof output === 'object' && output !== null && 'throws' in output;
}

export function renderNodeAssertions<I extends unknown[], O>(
  modulePath: string,
  exportName: string,
  cases: CharacterizationCase<I, O>[],
): string {
  const lines = [
    `import test from 'node:test';`,
    `import assert from 'node:assert/strict';`,
    `import { ${exportName} } from ${JSON.stringify(modulePath)};`,
  ];
  cases.forEach((c, i) => {
    const call = `${exportName}(...${JSON.stringify(c.input)})`;
    // assert.throws の第2引数へ素の文字列を渡すと Node は ERR_AMBIGUOUS_ARGUMENT を投げる
    // (文字列はメッセージ指定と解釈されるため)。述語関数で受け取り、型と message を確かめる
    const body = isThrowCase(c.output)
      ? `assert.throws(() => ${call}, (error) => error instanceof Error && error.message === ${JSON.stringify(c.output.throws)});`
      : `assert.deepEqual(${call}, ${JSON.stringify(c.output)});`;
    lines.push(`test(${JSON.stringify(`characterization ${i + 1}`)}, () => { ${body} });`);
  });
  return lines.join('\n');
}

export const exerciseId = '28.1';
