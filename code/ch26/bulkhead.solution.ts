export class Bulkhead {
  private active=0;private queue:Array<()=>void>=[];
  constructor(private readonly options:{maxConcurrent:number;maxQueueSize:number}){}
  async execute<T>(task:()=>Promise<T>):Promise<T>{if(this.active>=this.options.maxConcurrent){if(this.queue.length>=this.options.maxQueueSize)throw new Error('Bulkhead queue full');await new Promise<void>(resolve=>this.queue.push(resolve));}this.active++;try{return await task();}finally{this.active--;this.queue.shift()?.();}}
  stats(){return{active:this.active,queued:this.queue.length};}
}
export const exerciseId='26.3';
