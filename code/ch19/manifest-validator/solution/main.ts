export type Severity = 'error' | 'warning';
export type ManifestIssue = { severity: Severity; rule: string; message: string; path: string };
type Manifest = Record<string, unknown>;

function scalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true; if (trimmed === 'false') return false; if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

export function parseSimpleYaml(text: string): Manifest {
  if (text.trim().startsWith('{')) return JSON.parse(text) as Manifest;
  const root: Manifest = {}; const stack: Array<{ indent: number; value: Manifest }> = [{ indent: -1, value: root }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('#') || raw.trimStart().startsWith('- ')) continue;
    const indent = raw.length - raw.trimStart().length; const match = raw.trim().match(/^([^:]+):(.*)$/); if (!match) continue;
    while (stack.at(-1)!.indent >= indent) stack.pop();
    const parent = stack.at(-1)!.value; const key = match[1]!.trim(); const rest = match[2]!.trim();
    if (rest) parent[key] = scalar(rest); else { const child: Manifest = {}; parent[key] = child; stack.push({ indent, value: child }); }
  }
  return root;
}

function get(root: unknown, path: string): unknown { return path.split('.').reduce<unknown>((value, key) => typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined, root); }
export class ManifestValidator {
  validate(input: string | Manifest): ManifestIssue[] {
    const manifest = typeof input === 'string' ? parseSimpleYaml(input) : input; const issues: ManifestIssue[] = [];
    const kind = get(manifest, 'kind'); if (typeof kind !== 'string') issues.push({ severity:'error', rule:'required-kind', message:'kind is required', path:'kind' });
    const image = get(manifest, 'spec.template.spec.containers.0.image') ?? findImage(manifest);
    if (typeof image === 'string' && (image.endsWith(':latest') || !image.includes(':'))) issues.push({ severity:'warning', rule:'no-latest-tag', message:'Pin the container image to an immutable version or digest', path:'spec.template.spec.containers[].image' });
    if (!findKey(manifest, 'resources')) issues.push({ severity:'warning', rule:'require-resources', message:'Container resources requests/limits are missing', path:'spec.template.spec.containers[].resources' });
    if (!findKey(manifest, 'readinessProbe')) issues.push({ severity:'warning', rule:'require-readiness-probe', message:'readinessProbe is missing', path:'spec.template.spec.containers[].readinessProbe' });
    // livenessProbe と readinessProbe は役割が違う。前者が無いと固まったPodが再起動されない
    if (!findKey(manifest, 'livenessProbe')) issues.push({ severity:'warning', rule:'require-liveness-probe', message:'livenessProbe is missing', path:'spec.template.spec.containers[].livenessProbe' });
    if (findValue(manifest, 'runAsNonRoot') !== true) issues.push({ severity:'warning', rule:'require-run-as-non-root', message:'securityContext.runAsNonRoot should be true', path:'spec.template.spec.securityContext.runAsNonRoot' });
    const privileged = findValue(manifest, 'privileged'); if (privileged === true) issues.push({ severity:'error', rule:'no-privileged', message:'Privileged containers are not allowed', path:'securityContext.privileged' });
    return issues;
  }
}
function findKey(value: unknown, key: string): boolean { if (typeof value !== 'object' || value === null) return false; return Object.entries(value).some(([k, v]) => k === key || findKey(v, key)); }
function findValue(value: unknown, key: string): unknown { if (typeof value !== 'object' || value === null) return undefined; for (const [k,v] of Object.entries(value)) { if (k === key) return v; const found = findValue(v,key); if (found !== undefined) return found; } return undefined; }
function findImage(value: unknown): unknown { return findValue(value, 'image'); }
