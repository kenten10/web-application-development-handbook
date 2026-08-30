import test from 'node:test';
import assert from 'node:assert/strict';
import { extractExports, buildBlock, applyBlock } from './apply-starter-contracts.mjs';

test('exported functions, types, and classes become the contract', () => {
  const source = [
    "export type CircuitState='CLOSED'|'OPEN';",
    'export class CircuitBreaker {',
    '  private failures=0;',
    '  constructor(private readonly options:{failureThreshold:number}){}',
    '  async execute<T>(operation:()=>Promise<T>):Promise<T>{ return operation(); }',
    '}',
    "export const exerciseId='26.1';",
  ].join('\n');
  const signatures = extractExports(source);
  assert.ok(signatures.includes('export type CircuitState'));
  assert.ok(signatures.includes('export class CircuitBreaker'));
  assert.ok(signatures.some((s) => s.includes('constructor(private readonly options:{failureThreshold:number})')));
  assert.ok(signatures.some((s) => s.includes('async execute<T>(operation:()=>Promise<T>):Promise<T>')));
  // 演習IDは starter に既にあるので契約へ出さない
  assert.ok(!signatures.some((s) => s.includes('exerciseId')));
});

test('calls inside a method body are not mistaken for declarations', () => {
  const source = [
    'export class SecretStore {',
    '  async get(name:string){ const d=await this.load(); if(!d) throw new Error("secret not found"); return new Date(d.at); }',
    '}',
  ].join('\n');
  const signatures = extractExports(source);
  assert.ok(signatures.some((s) => s.includes('async get(name:string)')));
  assert.ok(!signatures.some((s) => s.includes('Error(')));
  assert.ok(!signatures.some((s) => s.includes('Date(')));
});

test('private and protected members stay out of the contract', () => {
  const source = [
    'export class TokenBucket {',
    '  private refill(): void { this.tokens = 1; }',
    '  protected debug(): void { }',
    '  remaining(): number { return this.tokens; }',
    '}',
  ].join('\n');
  const signatures = extractExports(source);
  assert.ok(signatures.some((s) => s.includes('remaining(): number')));
  assert.ok(!signatures.some((s) => s.includes('refill')));
  assert.ok(!signatures.some((s) => s.includes('debug')));
});

test('applying the block twice produces the same file', () => {
  const starter = 'export const exerciseId = "23.5";\n// TODO: implement the exercise.\n';
  const block = buildBlock(['export class TokenBucket'], ['code/ch23/rate-limit.solution.ts']);
  const once = applyBlock(starter, block);
  const twice = applyBlock(once, block);
  assert.equal(twice, once);
  assert.match(once, /実装すべき公開API/);
  assert.match(once, /export class TokenBucket/);
});

test('regenerating replaces the previous block instead of stacking', () => {
  const starter = 'export const exerciseId = "23.5";\n';
  const first = applyBlock(starter, buildBlock(['export class Old'], ['a.ts']));
  const second = applyBlock(first, buildBlock(['export class New'], ['a.ts']));
  assert.ok(!second.includes('export class Old'));
  assert.ok(second.includes('export class New'));
  assert.equal(second.split('実装すべき公開API').length - 1, 1);
});
