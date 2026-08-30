export type Mutation = { description: string; source: string };
const OPERATORS: Array<[RegExp, string, string]> = [
  [/\btrue\b/g, 'false', 'true→false'], [/\bfalse\b/g, 'true', 'false→true'],
  [/>=/g, '>', '>=→>'], [/<=/g, '<', '<=→<'], [/===/g, '!==', '===→!=='], [/&&/g, '||', '&&→||'], [/\|\|/g, '&&', '||→&&'],
];
export function generateMutations(source: string): Mutation[] {
  const result: Mutation[] = [];
  for (const [pattern, replacement, description] of OPERATORS) {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? -1; if (index < 0) continue;
      result.push({ description, source: source.slice(0, index) + replacement + source.slice(index + match[0].length) });
    }
  }
  return result;
}
export async function mutationScore(source: string, survives: (mutated: string) => boolean | Promise<boolean>) {
  const mutations = generateMutations(source); const survived: Mutation[] = [];
  for (const mutation of mutations) if (await survives(mutation.source)) survived.push(mutation);
  const killed = mutations.length - survived.length;
  return { total: mutations.length, killed, survived, score: mutations.length ? killed / mutations.length : 1 };
}
export const exerciseId = '25.4';
