type Row = Record<string, unknown> & { id: number };
type ConditionValue = unknown | { gte?: unknown; lte?: unknown; gt?: unknown; lt?: unknown };
export type Conditions = Record<string, ConditionValue>;

export class MemoryAdapter {
  readonly #tables = new Map<string, Row[]>(); readonly #sequences = new Map<string, number>();
  createTable(name: string): void { if (!this.#tables.has(name)) this.#tables.set(name, []); }
  insert(name: string, values: Record<string, unknown>): Row { const table = this.#table(name); const id = this.#sequences.get(name) ?? 1; this.#sequences.set(name, id + 1); const row = { id, ...values } as Row; table.push(row); return { ...row }; }
  find(name: string, id: number): Row | undefined { const row = this.#table(name).find((item) => item.id === id); return row ? { ...row } : undefined; }
  update(name: string, id: number, values: Record<string, unknown>): Row | undefined { const row = this.#table(name).find((item) => item.id === id); if (!row) return undefined; Object.assign(row, values); return { ...row }; }
  delete(name: string, id: number): boolean { const table = this.#table(name); const index = table.findIndex((item) => item.id === id); if (index < 0) return false; table.splice(index, 1); return true; }
  all(name: string): Row[] { return this.#table(name).map((row) => ({ ...row })); }
  #table(name: string): Row[] { const table = this.#tables.get(name); if (!table) throw new Error(`Unknown table ${name}`); return table; }
}

export class Query<T extends Row> implements PromiseLike<T[]> {
  #conditions: Conditions = {}; #order?: { field: keyof T; direction: 'asc' | 'desc' }; #limit?: number;
  constructor(readonly adapter: MemoryAdapter, readonly table: string) {}
  where(conditions: Conditions): this { this.#conditions = { ...this.#conditions, ...conditions }; return this; }
  orderBy(field: keyof T, direction: 'asc' | 'desc' = 'asc'): this { this.#order = { field, direction }; return this; }
  limit(count: number): this { this.#limit = count; return this; }
  compile(): { sql: string; params: unknown[] } {
    const entries = Object.entries(this.#conditions); const params: unknown[] = [];
    const where = entries.map(([field, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const [operator, operand] = Object.entries(value as Record<string, unknown>)[0] ?? ['eq', undefined]; params.push(operand); return `${field} ${{ gte: '>=', lte: '<=', gt: '>', lt: '<' }[operator] ?? '='} ?`;
      }
      params.push(value); return `${field} = ?`;
    });
    return { sql: `SELECT * FROM ${this.table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}${this.#order ? ` ORDER BY ${String(this.#order.field)} ${this.#order.direction.toUpperCase()}` : ''}${this.#limit === undefined ? '' : ' LIMIT ?'}`, params: this.#limit === undefined ? params : [...params, this.#limit] };
  }
  async execute(): Promise<T[]> {
    let rows = this.adapter.all(this.table) as T[];
    rows = rows.filter((row) => Object.entries(this.#conditions).every(([field, expected]) => compare(row[field], expected)));
    if (this.#order) rows.sort((left, right) => { const result = left[this.#order!.field]! < right[this.#order!.field]! ? -1 : left[this.#order!.field]! > right[this.#order!.field]! ? 1 : 0; return this.#order!.direction === 'asc' ? result : -result; });
    return this.#limit === undefined ? rows : rows.slice(0, this.#limit);
  }
  then<TResult1 = T[], TResult2 = never>(onfulfilled?: ((value: T[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> { return this.execute().then(onfulfilled, onrejected); }
}
function compare(actual: unknown, expected: ConditionValue): boolean {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) { const condition = expected as Record<string, unknown>; if ('gte' in condition && !(actual! >= condition.gte!)) return false; if ('lte' in condition && !(actual! <= condition.lte!)) return false; if ('gt' in condition && !(actual! > condition.gt!)) return false; if ('lt' in condition && !(actual! < condition.lt!)) return false; return true; }
  return actual === expected;
}

export class Model {
  static tableName = ''; static adapter: MemoryAdapter;
  static use(adapter: MemoryAdapter): void { this.adapter = adapter; this.adapter.createTable(this.tableName); }
  static async create<T extends typeof Model>(this: T, values: Record<string, unknown>): Promise<InstanceType<T>> { return Object.assign(new this(), this.adapter.insert(this.tableName, values)) as InstanceType<T>; }
  static async find<T extends typeof Model>(this: T, id: number): Promise<InstanceType<T> | undefined> { const row = this.adapter.find(this.tableName, id); return row ? Object.assign(new this(), row) as InstanceType<T> : undefined; }
  static where<T extends typeof Model>(this: T, conditions: Conditions): Query<InstanceType<T> & Row> { return new Query<InstanceType<T> & Row>(this.adapter, this.tableName).where(conditions); }
  static async update<T extends typeof Model>(this: T, id: number, values: Record<string, unknown>): Promise<InstanceType<T> | undefined> { const row = this.adapter.update(this.tableName, id, values); return row ? Object.assign(new this(), row) as InstanceType<T> : undefined; }
  static async delete<T extends typeof Model>(this: T, id: number): Promise<boolean> { return this.adapter.delete(this.tableName, id); }
}
