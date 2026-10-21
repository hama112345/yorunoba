import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/chat/rateLimit.js";

describe("RateLimiter", () => {
  it("allows a short burst, then one per refill period", () => {
    const limiter = new RateLimiter(3, 1000);
    const t = 10_000;
    expect([0, 1, 2, 3].map(() => limiter.allow("a", t))).toEqual([true, true, true, false]);
    expect(limiter.allow("a", t + 500)).toBe(false);
    expect(limiter.allow("a", t + 1000)).toBe(true);
    expect(limiter.allow("a", t + 1100)).toBe(false);
  });

  it("tracks each person separately and can forget them", () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.allow("a", 0)).toBe(true);
    expect(limiter.allow("b", 0)).toBe(true);
    expect(limiter.allow("a", 0)).toBe(false);
    limiter.forget("a");
    expect(limiter.allow("a", 0)).toBe(true);
  });
});
