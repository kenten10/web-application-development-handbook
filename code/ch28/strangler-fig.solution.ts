export type RouteTarget='legacy'|'modern'|'split';export type Rule={path:string;target:RouteTarget;canaryPercent?:number};
export class StranglerRouter{private counts={legacy:0,modern:0};constructor(private readonly options:{legacy:string;modern:string;routes:Rule[];random?:()=>number}){}
 route(path:string){const rule=[...this.options.routes].sort((a,b)=>b.path.length-a.path.length).find(r=>path.startsWith(r.path));let target:'legacy'|'modern'='legacy';if(rule?.target==='modern')target='modern';else if(rule?.target==='split')target=(this.options.random??Math.random)()*100<(rule.canaryPercent??0)?'modern':'legacy';this.counts[target]++;return{target,url:new URL(path,target==='modern'?this.options.modern:this.options.legacy).toString()};}
 progress(){const total=this.counts.legacy+this.counts.modern;return{...this.counts,modernPercent:total?this.counts.modern/total*100:0};}}
export const exerciseId='28.2';
