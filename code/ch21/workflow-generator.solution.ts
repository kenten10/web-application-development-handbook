import {mkdir,readFile,stat,writeFile} from 'node:fs/promises'; import {join} from 'node:path';
export const exerciseId='21.3';
export interface ProjectInfo{kind:'node'|'python';hasLint:boolean;hasTest:boolean;hasBuild:boolean}
export async function detectProject(dir:string):Promise<ProjectInfo>{
 try{await stat(join(dir,'package.json'));const pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8')) as {scripts?:Record<string,string>};return {kind:'node',hasLint:!!pkg.scripts?.lint,hasTest:!!pkg.scripts?.test,hasBuild:!!pkg.scripts?.build};}catch{}
 try{await stat(join(dir,'pyproject.toml'));return {kind:'python',hasLint:true,hasTest:true,hasBuild:false};}catch{}
 throw new Error('Node.js or Python project not found');
}
export function generateWorkflow(info:ProjectInfo,nodeVersions=[18,20,22]):string{
 if(info.kind==='python')return `name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.13'\n      - run: pip install -e '.[dev]'\n      - run: ruff check .\n      - run: pytest\n`;
 const commands=['npm ci',...(info.hasLint?['npm run lint']:[]),...(info.hasTest?['npm test']:[]),...(info.hasBuild?['npm run build']:[])];
 return `name: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    strategy:\n      matrix:\n        node: [${nodeVersions.join(', ')}]\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: \${{ matrix.node }}\n          cache: npm\n${commands.map(c=>`      - run: ${c}`).join('\n')}\n`;
}
export async function writeWorkflow(dir:string,versions=[18,20,22]){const info=await detectProject(dir);const out=join(dir,'.github/workflows/ci.yml');await mkdir(join(dir,'.github/workflows'),{recursive:true});await writeFile(out,generateWorkflow(info,versions));return out}
