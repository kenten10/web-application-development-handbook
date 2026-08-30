export const exerciseId='20.3';
export type Resource =
 | {type:'ec2';instance:'t3.small'|'t3.medium';hours_per_month?:number;count?:number}
 | {type:'rds';instance:'db.t3.small';hours_per_month?:number;storage_gb?:number;count?:number}
 | {type:'s3';storage_gb:number;requests_per_month?:number};
export interface EstimateLine { label:string; monthlyUsd:number }
const prices={ec2:{'t3.small':0.0208,'t3.medium':0.0416},rds:{'db.t3.small':0.034},rdsStorage:0.115,s3Storage:0.023,s3RequestsPer1000:0.0004} as const;
export function estimateResource(resource:Resource):EstimateLine {
 const count='count' in resource ? resource.count??1 : 1;
 if(resource.type==='ec2'){const hours=resource.hours_per_month??730;return {label:`ec2 ${resource.instance} x${count}`,monthlyUsd:prices.ec2[resource.instance]*hours*count};}
 if(resource.type==='rds'){const hours=resource.hours_per_month??730;const storage=resource.storage_gb??0;return {label:`rds ${resource.instance} x${count}`,monthlyUsd:(prices.rds[resource.instance]*hours+storage*prices.rdsStorage)*count};}
 return {label:'s3',monthlyUsd:resource.storage_gb*prices.s3Storage+(resource.requests_per_month??0)/1000*prices.s3RequestsPer1000};
}
export function estimate(resources:Resource[]):{lines:EstimateLine[];total:number}{const lines=resources.map(estimateResource);return {lines,total:lines.reduce((a,x)=>a+x.monthlyUsd,0)}}
export function formatEstimate(resources:Resource[]):string {const {lines,total}=estimate(resources);return [...lines.map(x=>`${x.label.padEnd(35)} $${x.monthlyUsd.toFixed(2)}`),'-'.repeat(48),`${'TOTAL'.padEnd(35)} $${total.toFixed(2)}`].join('\n')}
