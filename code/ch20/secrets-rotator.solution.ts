import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
export const exerciseId='20.4';
type Version={value:string;createdAt:string;expiresAt?:string}; type Entry={rotationDays:number;current:Version;previous?:Version}; type FileData={version:1;entries:Record<string,Entry>;audit:Array<{at:string;action:string;name:string}>};
export class SecretStore {
 constructor(private readonly file:string,private readonly masterKey:string,private readonly now:()=>Date=()=>new Date()){}
 private key(){return scryptSync(this.masterKey,'handbook-secret-store',32)}
 private encrypt(data:FileData){const iv=randomBytes(12);const c=createCipheriv('aes-256-gcm',this.key(),iv);const body=Buffer.concat([c.update(JSON.stringify(data),'utf8'),c.final()]);return Buffer.concat([Buffer.from('HSS1'),iv,c.getAuthTag(),body]);}
 private decrypt(buf:Buffer):FileData{if(buf.subarray(0,4).toString()!=='HSS1')throw new Error('invalid secret store');const iv=buf.subarray(4,16),tag=buf.subarray(16,32),body=buf.subarray(32);const d=createDecipheriv('aes-256-gcm',this.key(),iv);d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString('utf8')) as FileData;}
 private async load():Promise<FileData>{try{return this.decrypt(await readFile(this.file));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {version:1,entries:{},audit:[]};throw e;}}
 private async save(data:FileData){await writeFile(this.file,this.encrypt(data),{mode:0o600})}
 async set(name:string,input:{value:string;metadata:{rotationDays:number}}){const d=await this.load();d.entries[name]={rotationDays:input.metadata.rotationDays,current:{value:input.value,createdAt:this.now().toISOString()}};d.audit.push({at:this.now().toISOString(),action:'set',name});await this.save(d)}
 async get(name:string,options:{version?:'current'|'previous'}={}):Promise<string>{const d=await this.load();const e=d.entries[name];if(!e)throw new Error('secret not found');const v=options.version==='previous'?e.previous:e.current;if(!v)throw new Error('version not found');if(v.expiresAt&&this.now()>new Date(v.expiresAt))throw new Error('version expired');d.audit.push({at:this.now().toISOString(),action:`get:${options.version??'current'}`,name});await this.save(d);return v.value}
 async needsRotation(name:string){const d=await this.load();const e=d.entries[name];if(!e)throw new Error('secret not found');return this.now().getTime()-new Date(e.current.createdAt).getTime()>=e.rotationDays*86400000}
 async rotate(name:string,generate:()=>Promise<string>|string,graceDays=7){const d=await this.load();const e=d.entries[name];if(!e)throw new Error('secret not found');e.previous={...e.current,expiresAt:new Date(this.now().getTime()+graceDays*86400000).toISOString()};e.current={value:await generate(),createdAt:this.now().toISOString()};d.audit.push({at:this.now().toISOString(),action:'rotate',name});await this.save(d)}
 async audit(){return (await this.load()).audit.slice()}
}
export function generateRandomPassword(bytes=24){return randomBytes(bytes).toString('base64url')}
