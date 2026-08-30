import { pathToFileURL } from 'node:url';

type Task = () => void;
interface TimerTask { due: number; order: number; task: Task; }

export class MiniEventLoop {
  private readonly microtasks: Task[] = [];
  private readonly macrotasks: Task[] = [];
  private readonly animationFrames: Task[] = [];
  private readonly timers: TimerTask[] = [];
  private now = 0;
  private order = 0;

  addMicrotask(task: Task): void { this.microtasks.push(task); }
  addMacrotask(task: Task): void { this.macrotasks.push(task); }
  setTimeout(task: Task, delayMs: number): void {
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('delay must be a non-negative finite number');
    this.timers.push({ due: this.now + delayMs, order: this.order++, task });
  }
  requestAnimationFrame(task: Task): void { this.animationFrames.push(task); }

  private drainMicrotasks(): void {
    while (this.microtasks.length) this.microtasks.shift()!();
  }
  private sortTimers(): void {
    this.timers.sort((a, b) => a.due - b.due || a.order - b.order);
  }
  private enqueueDueTimers(): void {
    this.sortTimers();
    // 期限が現在時刻ちょうどのものだけを取ると、時刻を跨いで積み残したタイマーが
    // 永久に発火しない。期限が過ぎたものはすべて取り出す
    while (this.timers.length && this.timers[0]!.due <= this.now) {
      this.macrotasks.push(this.timers.shift()!.task);
    }
  }

  run(maxSteps = 10_000): void {
    let steps = 0;
    this.drainMicrotasks();
    while (this.macrotasks.length || this.timers.length || this.animationFrames.length || this.microtasks.length) {
      if (++steps > maxSteps) throw new Error('event loop exceeded maxSteps');
      // 仮想時刻を進める前に必ず並べ替える。登録順のまま timers[0] を読むと、
      // setTimeout(20) → setTimeout(10) の順に登録したときに時刻が 20 へ飛び、
      // 10ms 側が取り残されて1件も発火しなくなる
      if (!this.macrotasks.length && this.timers.length) {
        this.sortTimers();
        this.now = Math.max(this.now, this.timers[0]!.due);
      }
      this.enqueueDueTimers();
      const macro = this.macrotasks.shift();
      if (macro) macro();
      this.drainMicrotasks();
      if (this.animationFrames.length) {
        const frames = this.animationFrames.splice(0);
        for (const frame of frames) frame();
        this.drainMicrotasks();
        this.now += 16;
      }
    }
  }
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  const loop = new MiniEventLoop();
  loop.addMacrotask(() => {
    console.log('1. macro');
    loop.addMicrotask(() => console.log('2. micro from macro'));
  });
  loop.addMicrotask(() => console.log('3. initial micro'));
  loop.run();
}
