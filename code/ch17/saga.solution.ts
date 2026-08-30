export type SagaStep<Result> = { name: string; action: () => Promise<Result>; compensate: (result: Result) => Promise<void> };
export type SagaResult = { ok: true; completed: string[] } | { ok: false; failedStep: string; completed: string[]; compensated: string[]; error: Error };

export class Saga {
  private readonly steps: Array<SagaStep<unknown>> = [];
  step<Result>(step: SagaStep<Result>): this { this.steps.push(step as SagaStep<unknown>); return this; }
  async execute(): Promise<SagaResult> {
    const completed: Array<{ step: SagaStep<unknown>; result: unknown }> = [];
    for (const step of this.steps) {
      try { completed.push({ step, result: await step.action() }); }
      catch (cause) {
        const compensated: string[] = [];
        for (const item of completed.slice().reverse()) { try { await item.step.compensate(item.result); compensated.push(item.step.name); } catch { /* compensation failure should be recorded in production */ } }
        return { ok: false, failedStep: step.name, completed: completed.map((item) => item.step.name), compensated, error: cause instanceof Error ? cause : new Error(String(cause)) };
      }
    }
    return { ok: true, completed: completed.map((item) => item.step.name) };
  }
}
