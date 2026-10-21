import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  FLOOR,
  MAX_TAGS,
  NAME_MAX_LENGTH,
  clampToFloor,
  isValidColor,
  sanitizeName,
  sanitizeTags,
} from "./index";

describe("clampToFloor", () => {
  it("keeps points inside the floor as-is (rounded)", () => {
    expect(clampToFloor(100.4, 200.6)).toEqual({ x: 100, y: 201 });
  });

  it("pushes points outside the walls back inside", () => {
    expect(clampToFloor(-50, 9999)).toEqual({ x: FLOOR.wall, y: FLOOR.height - FLOOR.wall });
  });
});

describe("sanitizeName", () => {
  it("falls back to a default name", () => {
    expect(sanitizeName("   ")).toBe("名無しの客");
    expect(sanitizeName(undefined)).toBe("名無しの客");
  });

  it("strips control characters and truncates", () => {
    expect(sanitizeName("a\u0000b")).toBe("ab");
    expect(sanitizeName("あ".repeat(50))).toHaveLength(NAME_MAX_LENGTH);
  });
});

describe("isValidColor", () => {
  it("accepts only palette colors", () => {
    expect(isValidColor(AVATAR_COLORS[0])).toBe(true);
    expect(isValidColor(0x123456)).toBe(false);
    expect(isValidColor("red")).toBe(false);
  });
});

describe("sanitizeTags", () => {
  it("keeps only known tags, without duplicates, up to MAX_TAGS", () => {
    expect(sanitizeTags(["サッカー", "サッカー", "仕事終わり", "聞き専"])).toEqual(["サッカー", "仕事終わり"]);
    expect(sanitizeTags(["サッカー", "<script>", 42])).toEqual(["サッカー"]);
    expect(sanitizeTags(["仕事終わり", "聞き専", "初めて"])).toHaveLength(MAX_TAGS);
  });

  it("returns an empty list for junk input", () => {
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags("サッカー")).toEqual([]);
  });
});
