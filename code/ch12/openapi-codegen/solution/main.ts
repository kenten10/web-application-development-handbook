import fs from 'node:fs';

export interface JsonSchema { type?: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema; $ref?: string; }
export interface OpenApiOperation { operationId?: string; parameters?: Array<{ name: string; in: string; required?: boolean; schema?: JsonSchema }>; requestBody?: { content?: { 'application/json'?: { schema?: JsonSchema } } }; responses?: Record<string, { content?: { 'application/json'?: { schema?: JsonSchema } } }>; }
export interface OpenApiDocument { paths: Record<string, Record<string, OpenApiOperation>>; components?: { schemas?: Record<string, JsonSchema> }; }

export function parseOpenApiFile(filename: string): OpenApiDocument {
  const text = fs.readFileSync(filename, 'utf8').trim();
  if (!text.startsWith('{')) throw new Error('This dependency-free example accepts JSON syntax in openapi.yaml. JSON is valid YAML 1.2.');
  return JSON.parse(text) as OpenApiDocument;
}

function identifier(value: string): string { return value.replace(/[^a-zA-Z0-9]+(.)/g, (_m, char: string) => char.toUpperCase()).replace(/^[^a-zA-Z_$]/, '_$&'); }
function operationName(method: string, path: string, operation: OpenApiOperation): string {
  return operation.operationId ?? identifier(`${method.toLowerCase()}-${path.replace(/[{}]/g, '')}`);
}
function schemaExpression(schema: JsonSchema | undefined): string {
  if (!schema) return 'z.unknown()';
  if (schema.$ref) return `${identifier(schema.$ref.split('/').at(-1) ?? 'Unknown')}Schema`;
  if (schema.type === 'string') return 'z.string()';
  if (schema.type === 'integer') return 'z.coerce.number().int()';
  if (schema.type === 'number') return 'z.coerce.number()';
  if (schema.type === 'boolean') return 'z.coerce.boolean()';
  if (schema.type === 'array') return `z.array(${schemaExpression(schema.items)})`;
  if (schema.type === 'object' || schema.properties) {
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {}).map(([name, child]) => `${JSON.stringify(name)}: ${schemaExpression(child)}${required.has(name) ? '' : '.optional()'}`);
    return `z.object({ ${properties.join(', ')} })`;
  }
  return 'z.unknown()';
}

export function generateServerStub(document: OpenApiDocument): string {
  const lines = ["import { z } from 'zod';", ''];
  for (const [name, schema] of Object.entries(document.components?.schemas ?? {})) {
    lines.push(`export const ${identifier(name)}Schema = ${schemaExpression(schema)};`);
    lines.push(`export type ${identifier(name)} = z.infer<typeof ${identifier(name)}Schema>;`, '');
  }
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const name = operationName(method, path, operation);
      const parameterProperties = Object.fromEntries((operation.parameters ?? []).map((parameter) => [parameter.name, parameter.schema ?? ({ type: 'string' } satisfies JsonSchema)]));
      const required = (operation.parameters ?? []).filter((parameter) => parameter.required).map((parameter) => parameter.name);
      const input = operation.requestBody?.content?.['application/json']?.schema;
      const success = Object.entries(operation.responses ?? {}).find(([status]) => /^2/.test(status))?.[1].content?.['application/json']?.schema;
      lines.push(`export const ${name}ParamsSchema = ${schemaExpression({ type: 'object', properties: parameterProperties, required })};`);
      if (input) lines.push(`export const ${name}BodySchema = ${schemaExpression(input)};`);
      lines.push(`export async function ${name}(params: z.infer<typeof ${name}ParamsSchema>${input ? `, body: z.infer<typeof ${name}BodySchema>` : ''}): Promise<z.infer<typeof ${success?.$ref ? identifier(success.$ref.split('/').at(-1) ?? 'Unknown') + 'Schema' : name + 'ResponseSchema'}>> {`);
      if (!success?.$ref) lines.splice(lines.length - 1, 0, `export const ${name}ResponseSchema = ${schemaExpression(success)};`);
      lines.push(`  void params;${input ? ' void body;' : ''}`, `  throw new Error(${JSON.stringify(`${method.toUpperCase()} ${path} is not implemented`)});`, '}', '');
    }
  }
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: tsx main.ts openapi.yaml [output.ts]');
  const output = generateServerStub(parseOpenApiFile(input));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], output); else process.stdout.write(output);
}
