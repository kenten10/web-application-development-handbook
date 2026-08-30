import test from 'node:test'; import assert from 'node:assert/strict';
import { describe,it,expect,run,reset } from './mini-test.solution.js';
import { mock, stub, spyOn } from './mock-stub-spy.solution.js';
import { integer,array,record,forAll } from './property-test.solution.js';
import { generateMutations, mutationScore } from './mutation-test.solution.js';
test('mini test runner reports pass/fail', async()=>{reset();describe('math',()=>{it('ok',()=>expect(2).toBe(2));it('bad',()=>{throw new Error('x')})});const r=await run();assert.deepEqual(r,{passed:1,failed:1});});
test('mock/stub/spy capture calls',()=>{const fn=mock<(x:number)=>number>().mockReturnValueOnce(1).mockReturnValue(0);assert.equal(fn(2),1);assert.equal(fn(3),0);assert.deepEqual(fn.calls,[[2],[3]]);const s=stub<{a():number}>({a:()=>4});assert.equal(s.a(),4);const obj={x(n:number){return n+1}};const spy=spyOn(obj,'x');assert.equal(obj.x(2),3);assert.equal(spy.callCount,1);spy.restore();});
test('property testing handles records and detects counterexample',()=>{forAll(record({x:integer(),y:integer()}),v=>v.x+v.y===v.y+v.x,{cases:100});assert.throws(()=>forAll(array(integer(0,10)),xs=>xs.length<2,{cases:100}),/counterexample/);});
test('mutation generator and score',async()=>{const ms=generateMutations('if (a >= b && true) return 1');assert.ok(ms.length>=2);const score=await mutationScore('return x === 1',s=>s.includes('!=='));assert.equal(score.total,1);assert.equal(score.survived.length,1);});
