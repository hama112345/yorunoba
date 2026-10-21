/**
 * 連投制限（トークンバケット方式）。
 * 1人あたり最大 burst 回まで続けて送れ、その後は refillMs ごとに1回ぶん回復する。
 * 例：burst=3, refillMs=1000 →「3回まではポンポン送れるが、その後は1秒に1回」
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();

  constructor(
    private readonly burst: number,
    private readonly refillMs: number,
  ) {}

  /** 送ってよければ true（1回ぶん消費する） */
  allow(key: string, now = Date.now()): boolean {
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now };
    const refilled = Math.min(this.burst, b.tokens + (now - b.at) / this.refillMs);
    if (refilled < 1) {
      this.buckets.set(key, { tokens: refilled, at: now });
      return false;
    }
    this.buckets.set(key, { tokens: refilled - 1, at: now });
    return true;
  }

  forget(key: string) {
    this.buckets.delete(key);
  }
}
