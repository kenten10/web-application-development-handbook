export type GreenTask = Generator<unknown, void, unknown>;

export class Scheduler {
  readonly #queue: GreenTask[] = [];
  readonly #errors: unknown[] = [];
  #steps = 0;

  spawn(factory: () => GreenTask): void {
    this.#queue.push(factory());
  }

  run(maxSteps = 100_000): { steps: number; errors: readonly unknown[] } {
    while (this.#queue.length > 0) {
      if (this.#steps >= maxSteps) throw new Error(`Scheduler exceeded maxSteps=${maxSteps}`);
      const task = this.#queue.shift()!;
      try {
        const result = task.next();
        this.#steps += 1;
        if (!result.done) this.#queue.push(task);
      } catch (error) {
        this.#errors.push(error);
      }
    }
    return { steps: this.#steps, errors: this.#errors };
  }
}

export function* repeat(name: string, count: number, output: string[]): GreenTask {
  for (let index = 0; index < count; index += 1) {
    output.push(`${name} step ${index}`);
    yield;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output: string[] = [];
  const scheduler = new Scheduler();
  scheduler.spawn(() => repeat('A', 3, output));
  scheduler.spawn(() => repeat('B', 3, output));
  const result = scheduler.run();
  console.log(output.join('\n'));
  console.log(`steps=${result.steps} errors=${result.errors.length}`);
}
