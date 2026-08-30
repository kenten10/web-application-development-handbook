import fs from 'node:fs';

export function shake(source, usedNames) {
  const used = new Set(usedNames);
  return source.replace(/export\s+function\s+(\w+)\s*\([^)]*\)\s*\{[^{}]*\}\s*/g, (block, name) => {
    return used.has(name) ? block.replace('export ', '') : '';
  });
}

if (process.argv[1]?.endsWith('shake.mjs')) {
  const [input, output, ...names] = process.argv.slice(2);
  if (!input || !output || names.length === 0) throw new Error('Usage: node shake.mjs input output usedName...');
  const before = fs.readFileSync(input, 'utf8');
  const after = shake(before, names);
  fs.writeFileSync(output, after);
  console.log(`before=${Buffer.byteLength(before)} after=${Buffer.byteLength(after)} removed=${Buffer.byteLength(before)-Buffer.byteLength(after)}`);
}
