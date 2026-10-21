import { describe, expect, it } from "vitest";
import { hoursAnnouncement } from "../src/hours.js";

describe("hoursAnnouncement", () => {
  it("announces opening, last order and closing only at the transition", () => {
    expect(hoursAnnouncement("closed", "open", true)).toContain("開店");
    expect(hoursAnnouncement("open", "last_order", true)).toContain("ラストオーダー");
    expect(hoursAnnouncement("last_order", "closed", true)).toContain("また明日");
    expect(hoursAnnouncement("last_order", "closed", false)).toContain("このまま開けておきます");
    expect(hoursAnnouncement("open", "open", true)).toBeNull();
  });
});
