import { createHash } from 'node:crypto';
function stable(value:unknown):string{if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stable(v)).join(',')}}`;return JSON.stringify(value);}
export class IdempotencyStore {private records=new Map<string,{hash:string;expires:number;promise:Promise<unknown>}>();constructor(private readonly options:{ttlSec:number;now?:()=>number}){}
 async execute<T>(key:string,body:unknown,operation:()=>Promise<T>):Promise<T>{const now=(this.options.now??Date.now)();const hash=createHash('sha256').update(stable(body)).digest('hex');const existing=this.records.get(key);if(existing&&existing.expires>now){if(existing.hash!==hash)throw new Error('Idempotency key reused with different body');return existing.promise as Promise<T>;}const promise=operation();this.records.set(key,{hash,expires:now+this.options.ttlSec*1000,promise});try{return await promise;}catch(e){this.records.delete(key);throw e;}}
}
export const exerciseId='26.4';
