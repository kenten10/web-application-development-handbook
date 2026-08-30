import { spawn, type ChildProcess } from 'node:child_process';
const forwardedSignals: NodeJS.Signals[] = ['SIGTERM','SIGINT','SIGHUP','SIGQUIT'];
export function runInit(command: string, args: string[] = []): Promise<number> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, args, { stdio: 'inherit', detached: false });
    const handlers = new Map<NodeJS.Signals, () => void>();
    for (const signal of forwardedSignals) { const handler = () => { if (!child.killed) child.kill(signal); }; handlers.set(signal, handler); process.on(signal, handler); }
    const cleanup = () => { for (const [signal, handler] of handlers) process.off(signal, handler); };
    child.once('error', (error) => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => { cleanup(); if (signal) resolve(128 + signalNumber(signal)); else resolve(code ?? 1); });
  });
}
function signalNumber(signal: NodeJS.Signals): number { return ({ SIGINT:2,SIGQUIT:3,SIGHUP:1,SIGTERM:15 } as Partial<Record<NodeJS.Signals,number>>)[signal] ?? 1; }
if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, ...args] = process.argv.slice(2); if (!command) { console.error('usage: tsx mini-init.solution.ts command [args...]'); process.exit(64); }
  process.exitCode = await runInit(command, args);
}
