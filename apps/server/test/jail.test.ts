import { describe, expect, it } from "vitest";
import { JailList, ReportBook } from "../src/moderation/jail.js";

describe("JailList", () => {
  it("bans by any of the keys until the time passes", () => {
    const jail = new JailList();
    const until = jail.jail(["device-1", "1.2.3.4"], 600_000, 0);
    expect(jail.releaseAt(["device-1"], 1000)).toBe(until);
    expect(jail.releaseAt(["other-device", "1.2.3.4"], 1000)).toBe(until); // 端末を変えてもIPで止まる
    expect(jail.releaseAt(["other-device", "5.6.7.8"], 1000)).toBe(0);
    expect(jail.releaseAt(["device-1"], until + 1)).toBe(0);
  });

  it("ignores missing keys", () => {
    const jail = new JailList();
    jail.jail([undefined, "d"], 1000, 0);
    expect(jail.releaseAt([undefined], 10)).toBe(0);
  });
});

describe("ReportBook", () => {
  it("counts distinct reporters within the window", () => {
    const book = new ReportBook(10_000);
    expect(book.add("troll", "a", 0)).toBe(1);
    expect(book.add("troll", "a", 1000)).toBe(1); // 同じ人は1回
    expect(book.add("troll", "b", 2000)).toBe(2);
    expect(book.add("troll", "c", 20_000)).toBe(1); // 古い通報は数えない
  });
});
