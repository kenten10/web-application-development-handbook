export const exerciseId='21.4';
export interface Metrics{requests:number;errors:number}
export interface PipelineAdapter{currentVersion():Promise<string>;deploy(version:string):Promise<void>;rollback(version:string):Promise<void>;metrics(windowSec:number):Promise<Metrics>}
export class DeploymentPipeline {
 constructor(private readonly options:{errorRateThreshold:number;observationWindowSec:number},private readonly adapter:PipelineAdapter){}
 async deploy(version:string):Promise<{status:'healthy'|'rolled-back';errorRate:number;previous:string}>{const previous=await this.adapter.currentVersion();await this.adapter.deploy(version);const m=await this.adapter.metrics(this.options.observationWindowSec);const errorRate=m.requests?m.errors/m.requests:0;if(errorRate>this.options.errorRateThreshold){await this.adapter.rollback(previous);return {status:'rolled-back',errorRate,previous}}return {status:'healthy',errorRate,previous}}
}
export class InMemoryDeploymentAdapter implements PipelineAdapter{version='v1';nextMetrics:Metrics={requests:100,errors:0};history:string[]=[];async currentVersion(){return this.version}async deploy(v:string){this.history.push(`deploy:${v}`);this.version=v}async rollback(v:string){this.history.push(`rollback:${v}`);this.version=v}async metrics(){return this.nextMetrics}}
