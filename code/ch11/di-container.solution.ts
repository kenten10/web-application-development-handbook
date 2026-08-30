export type Token<T> = symbol | string | Constructor<T>;
export type Constructor<T> = new (...args: any[]) => T;
export type Provider<T> =
  | { useValue: T }
  | { useFactory: (container: Container) => T }
  | { useClass: Constructor<T>; deps?: Token<unknown>[] };

export class Container {
  readonly #providers = new Map<Token<unknown>, Provider<unknown>>();
  readonly #singletons = new Map<Token<unknown>, unknown>();
  readonly #resolving: Token<unknown>[] = [];

  bind<T>(token: Token<T>, provider?: Provider<T>): this {
    const inferred: Provider<T> = provider ?? { useClass: token as Constructor<T> };
    this.#providers.set(token, inferred as Provider<unknown>);
    return this;
  }

  get<T>(token: Token<T>): T {
    if (this.#singletons.has(token)) return this.#singletons.get(token) as T;
    if (this.#resolving.includes(token)) {
      throw new Error(`Circular dependency: ${[...this.#resolving, token].map(String).join(' -> ')}`);
    }
    const provider = this.#providers.get(token) as Provider<T> | undefined;
    if (!provider) throw new Error(`No provider for ${String(token)}`);
    this.#resolving.push(token);
    try {
      let value: T;
      if ('useValue' in provider) value = provider.useValue;
      else if ('useFactory' in provider) value = provider.useFactory(this);
      else {
        const declared = (provider.useClass as Constructor<T> & { inject?: Token<unknown>[] }).inject ?? provider.deps ?? [];
        value = new provider.useClass(...declared.map((dependency) => this.get(dependency)));
      }
      this.#singletons.set(token, value);
      return value;
    } finally {
      this.#resolving.pop();
    }
  }

  clear(): void { this.#singletons.clear(); }
}
