import { open, readdir } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; import type { FileHandle } from 'node:fs/promises';
export async function countOpenFileDescriptors(): Promise<number | undefined> { try { return (await readdir('/proc/self/fd')).length; } catch { return undefined; } }
export async function openMany(count: number, closeAfter = false): Promise<FileHandle[]> {
  const handles: FileHandle[] = []; const path = join(tmpdir(), 'handbook-fd-demo.txt');
  for (let i = 0; i < count; i++) handles.push(await open(path, 'a+'));
  if (closeAfter) { await Promise.all(handles.map((handle) => handle.close())); return []; }
  return handles;
}
export async function closeAll(handles: FileHandle[]): Promise<void> { await Promise.allSettled(handles.map((handle) => handle.close())); }
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = Math.min(Number(process.argv[2] ?? 100), 1000); const before = await countOpenFileDescriptors(); const handles = await openMany(count); const during = await countOpenFileDescriptors(); await closeAll(handles); const after = await countOpenFileDescriptors(); console.log(JSON.stringify({ count, before, during, after }));
}
