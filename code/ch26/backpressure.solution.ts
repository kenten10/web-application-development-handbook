export class BackpressureQueue<T>{private items:T[]=[];private waiters:Array<()=>void>=[];private consumers:Array<(v:T)=>Promise<void>>=[];private running=false;constructor(private readonly options:{highWaterMark:number}){}
 tryPush(value:T){if(this.items.length>=this.options.highWaterMark)return false;this.items.push(value);void this.pump();return true;}
 waitForDrain(){if(this.items.length<this.options.highWaterMark)return Promise.resolve();return new Promise<void>(r=>this.waiters.push(r));}
 consume(handler:(value:T)=>Promise<void>){this.consumers.push(handler);void this.pump();}
 private async pump(){if(this.running||!this.consumers.length)return;this.running=true;try{while(this.items.length){const value=this.items.shift()!;await this.consumers[0]!(value);if(this.items.length<this.options.highWaterMark)this.waiters.splice(0).forEach(r=>r());}}finally{this.running=false;}}
 size(){return this.items.length;}
}
export const exerciseId='26.5';
