export type CircuitState='CLOSED'|'OPEN'|'HALF_OPEN';
export class CircuitBreaker {
  private failures=0; private halfOpenSuccesses=0; private openedAt=0; state:CircuitState='CLOSED';
  constructor(private readonly options:{failureThreshold:number;resetTimeoutMs:number;successThresholdInHalfOpen:number;now?:()=>number}){}
  async execute<T>(operation:()=>Promise<T>):Promise<T>{
    const now=(this.options.now??Date.now)();
    if(this.state==='OPEN'){if(now-this.openedAt<this.options.resetTimeoutMs) throw new Error('Circuit is open');this.state='HALF_OPEN';}
    try{const value=await operation();this.failures=0;if(this.state==='HALF_OPEN'&&++this.halfOpenSuccesses>=this.options.successThresholdInHalfOpen){this.state='CLOSED';this.halfOpenSuccesses=0;}return value;}
    catch(error){this.failures++;this.halfOpenSuccesses=0;if(this.state==='HALF_OPEN'||this.failures>=this.options.failureThreshold){this.state='OPEN';this.openedAt=now;}throw error;}
  }
}
export const exerciseId='26.1';
