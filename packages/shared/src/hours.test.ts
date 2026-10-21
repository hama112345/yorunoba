import { describe, expect, it } from "vitest";
import { nextOpeningAt, shopPhase } from "./hours";

/** 日本時間の日時（UNIXミリ秒） */
const jst = (iso: string) => Date.parse(`${iso}+09:00`);

describe("shop hours (JST)", () => {
  it("is closed before 21:00, open until 23:45, then last order until midnight", () => {
    expect(shopPhase(jst("2026-10-22T20:59:00"))).toBe("closed");
    expect(shopPhase(jst("2026-10-22T21:00:00"))).toBe("open");
    expect(shopPhase(jst("2026-10-22T23:44:59"))).toBe("open");
    expect(shopPhase(jst("2026-10-22T23:45:00"))).toBe("last_order");
    expect(shopPhase(jst("2026-10-23T00:00:00"))).toBe("closed");
  });

  it("points to today's 21:00 before opening, and tomorrow's after", () => {
    expect(nextOpeningAt(jst("2026-10-22T10:00:00"))).toBe(jst("2026-10-22T21:00:00"));
    expect(nextOpeningAt(jst("2026-10-22T22:00:00"))).toBe(jst("2026-10-23T21:00:00"));
    expect(nextOpeningAt(jst("2026-10-23T00:30:00"))).toBe(jst("2026-10-23T21:00:00"));
  });
});
