export const exerciseId = '23.5';

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(readonly options: { capacity: number; refillPerSec: number; now?: () => number }) {
    this.tokens = options.capacity;
    this.last = (options.now ?? Date.now)();
  }

  // 補充は「時間が進んだ分だけ足す」処理なので、消費と残量照会の両方から呼ぶ。
  // tryConsume の中だけで補充していると、remaining() が枯渇した値のまま止まる
  private refill(): void {
    const now = (this.options.now ?? Date.now)();
    const elapsedSec = (now - this.last) / 1000;
    this.tokens = Math.min(this.options.capacity, this.tokens + elapsedSec * this.options.refillPerSec);
    this.last = now;
  }

  tryConsume(n = 1): boolean {
    this.refill();
    if (n <= this.tokens) {
      this.tokens -= n;
      return true;
    }
    return false;
  }

  remaining(): number {
    this.refill();
    return this.tokens;
  }
}

export class SlidingWindowLimiter {
  private log = new Map<string, number[]>();

  constructor(readonly options: { windowMs: number; max: number; now?: () => number }) {}

  check(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = (this.options.now ?? Date.now)();
    const recent = (this.log.get(key) ?? []).filter(t => t > now - this.options.windowMs);
    if (recent.length >= this.options.max) {
      this.log.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: recent[0]! + this.options.windowMs - now };
    }
    recent.push(now);
    this.log.set(key, recent);
    return { allowed: true, remaining: this.options.max - recent.length, retryAfterMs: 0 };
  }
}
