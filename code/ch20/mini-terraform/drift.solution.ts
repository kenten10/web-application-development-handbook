import { readFile, stat } from 'node:fs/promises';
export const exerciseId = '20.2';
export interface ManagedFile { name: string; content: string }
export interface Drift { path: string; kind: 'missing'|'content-mismatch'|'type-mismatch'; expected?: string; actual?: string }
export async function detectDrift(files: ManagedFile[], cwd=process.cwd()): Promise<Drift[]> {
  const drifts: Drift[]=[];
  for (const file of files) {
    const target=new URL(file.name, `file://${cwd.replace(/\\/g,'/')}/`).pathname;
    try {
      const s=await stat(target); if(!s.isFile()){drifts.push({path:file.name,kind:'type-mismatch'});continue;}
      const actual=await readFile(target,'utf8'); if(actual!==file.content) drifts.push({path:file.name,kind:'content-mismatch',expected:file.content,actual});
    } catch (error) { if((error as NodeJS.ErrnoException).code==='ENOENT') drifts.push({path:file.name,kind:'missing'}); else throw error; }
  }
  return drifts;
}
export function formatDrifts(drifts: Drift[]): string {
  if (!drifts.length) return 'No drift detected.';
  return ['⚠ DRIFT DETECTED:',...drifts.flatMap(d=>[`  - ${d.path}: ${d.kind.replace('-', ' ')}`,...(d.kind==='content-mismatch'?[`    expected: ${JSON.stringify(d.expected)}`,`    actual:   ${JSON.stringify(d.actual)}`]:[])])].join('\n');
}
