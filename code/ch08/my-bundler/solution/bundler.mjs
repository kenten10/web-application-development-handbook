import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"](.+?)['"];?/g;
const EXPORT_CONST_RE = /export\s+const\s+(\w+)\s*=/g;
const EXPORT_FUNCTION_RE = /export\s+function\s+(\w+)\s*\(/g;

function resolveModule(from, specifier) {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) if (fs.existsSync(candidate)) return candidate;
  throw new Error(`Cannot resolve ${specifier} from ${from}`);
}

export function buildGraph(entry) {
  const modules = [];
  const byFile = new Map();
  function visit(file) {
    const absolute = path.resolve(file);
    const known = byFile.get(absolute);
    if (known !== undefined) return known;
    const id = modules.length;
    byFile.set(absolute, id);
    modules.push(null);
    const source = fs.readFileSync(absolute, 'utf8');
    const dependencies = [];
    for (const match of source.matchAll(IMPORT_RE)) {
      const child = resolveModule(absolute, match[2]);
      dependencies.push({ specifier: match[2], id: visit(child), names: match[1].split(',').map((name) => name.trim()) });
    }
    modules[id] = { id, file: absolute, source, dependencies };
    return id;
  }
  visit(entry);
  return modules;
}

function transform(module) {
  let code = module.source.replace(IMPORT_RE, (_full, names, specifier) => {
    const dependency = module.dependencies.find((item) => item.specifier === specifier);
    if (!dependency) throw new Error(`Missing dependency ${specifier}`);
    return `const { ${names.trim()} } = require(${dependency.id});`;
  });
  const exports = new Set();
  code = code.replace(EXPORT_CONST_RE, (_full, name) => { exports.add(name); return `const ${name} =`; });
  code = code.replace(EXPORT_FUNCTION_RE, (_full, name) => { exports.add(name); return `function ${name}(`; });
  if (exports.size) code += `\nObject.assign(module.exports, { ${[...exports].join(', ')} });`;
  return code;
}

export function bundle(entry, outfile) {
  const graph = buildGraph(entry);
  const modules = graph.map((module) => `${module.id}: (module, exports, require) => {\n${transform(module)}\n}`).join(',\n');
  const output = `(function(modules){\nconst cache={};\nfunction require(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports,require);return module.exports;}\nrequire(0);\n})({\n${modules}\n});\n`;
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  fs.writeFileSync(outfile, output);
  return { modules: graph.length, bytes: Buffer.byteLength(output) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [entry, outfile] = process.argv.slice(2);
  if (!entry || !outfile) throw new Error('Usage: node bundler.mjs <entry.js> <outfile.js>');
  const result = bundle(entry, outfile);
  console.log(`bundled modules=${result.modules} bytes=${result.bytes} -> ${outfile}`);
}
