export type Jitter='none'|'equal'|'full'|'decorrelated';
export async function retry<T>(operation:()=>Promise<T>,options:{maxAttempts:number;baseDelayMs:number;maxDelayMs:number;jitter:Jitter;retryableErrors?:(e:any)=>boolean;random?:()=>number;sleep?:(ms:number)=>Promise<void>}):Promise<T>{
  const random=options.random??Math.random,sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));let previous=options.baseDelayMs;
  for(let attempt=1;;attempt++)try{return await operation();}catch(e){if(attempt>=options.maxAttempts||options.retryableErrors&&!options.retryableErrors(e))throw e;const cap=Math.min(options.maxDelayMs,options.baseDelayMs*2**(attempt-1));let delay=cap;if(options.jitter==='full')delay=random()*cap;else if(options.jitter==='equal')delay=cap/2+random()*cap/2;else if(options.jitter==='decorrelated')delay=Math.min(options.maxDelayMs,options.baseDelayMs+random()*(previous*3-options.baseDelayMs));previous=delay;await sleep(delay);}}
export const exerciseId='26.2';
