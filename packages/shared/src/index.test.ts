import { describe, expect, it } from "vitest";
import {
  AVATAR_COLORS,
  LOOKS,
  MAX_TAGS,
  OBSTACLES,
  SPAWN_AREA,
  STAFF_LOOK,
  STAFF_SPOT,
  TABLES,
  WALK_AREA,
  isWalkable,
  sanitizeLook,
  MAX_BOTTLES,
  parseBottles,
  TOPICS,
  TOPICS_PER_DAY,
  todaysTopics,
  walkPath,
  NAME_MAX_LENGTH,
  clampToFloor,
  isValidColor,
  CHAT_MAX_LENGTH,
  SEATS,
  bubbleDurationMs,
  findSeat,
  isReaction,
  sanitizeChat,
  sanitizeName,
  sanitizeTags,
} from "./index";

describe("clampToFloor", () => {
  it("keeps walkable points as-is (rounded)", () => {
    expect(clampToFloor(480.4, 430.6)).toEqual({ x: 480, y: 431 });
  });

  it("pulls points outside the walk area back to its edge", () => {
    expect(clampToFloor(-50, 9999)).toEqual({ x: WALK_AREA.x, y: WALK_AREA.y + WALK_AREA.h });
    expect(clampToFloor(480, -50)).toEqual({ x: 480, y: WALK_AREA.y });
    // 奥の角は飾り（階段・掲示板）があるので、その手前に出る
    const corner = clampToFloor(9999, -50);
    expect(isWalkable(corner.x, corner.y)).toBe(true);
  });

  it("pushes points on a table out to the nearest walkable side", () => {
    const t = OBSTACLES[0];
    // 天板の下端すれすれ → 手前に出る
    expect(clampToFloor(t.x + t.w / 2, t.y + t.h - 2)).toEqual({ x: Math.round(t.x + t.w / 2), y: t.y + t.h + 1 });
    // 天板の左端すれすれ → 左に出る
    expect(clampToFloor(t.x + 2, t.y + t.h / 2)).toEqual({ x: t.x - 1, y: Math.round(t.y + t.h / 2) });
    for (const table of TABLES) {
      const p = clampToFloor(table.x + table.w / 2, table.y + table.h / 2);
      expect(isWalkable(p.x, p.y)).toBe(true);
    }
  });

  it("treats junk numbers as the middle of the floor", () => {
    const p = clampToFloor(Number.NaN, Number.POSITIVE_INFINITY);
    expect(isWalkable(p.x, p.y)).toBe(true);
  });
});

describe("layout", () => {
  it("puts every seat on its own spot, near the floor", () => {
    expect(new Set(SEATS.map((s) => s.id)).size).toBe(SEATS.length);
    for (const s of SEATS) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(WALK_AREA.y - 10);
      expect(s.y).toBeLessThanOrEqual(WALK_AREA.y + WALK_AREA.h);
    }
  });

  it("spawns guests on walkable floor, and the staff spot is behind the counter", () => {
    for (const [x, y] of [
      [SPAWN_AREA.x, SPAWN_AREA.y],
      [SPAWN_AREA.x + SPAWN_AREA.w, SPAWN_AREA.y + SPAWN_AREA.h],
    ]) {
      expect(isWalkable(x, y)).toBe(true);
    }
    expect(isWalkable(STAFF_SPOT.x, STAFF_SPOT.y)).toBe(false);
  });
});

describe("walkPath", () => {
  /** 道すじの各区間がテーブルの上を通らないか（区間を細かく区切って確かめる） */
  const avoidsTables = (from: { x: number; y: number }, path: { x: number; y: number }[], skipEnds = false) => {
    let prev = from;
    for (const [i, p] of path.entries()) {
      for (let t = 0.05; t < 0.96; t += 0.05) {
        const x = prev.x + (p.x - prev.x) * t;
        const y = prev.y + (p.y - prev.y) * t;
        const atEnd = skipEnds && (i === 0 || i === path.length - 1);
        if (!atEnd && OBSTACLES.some((o) => x > o.x + 1 && x < o.x + o.w - 1 && y > o.y + 1 && y < o.y + o.h - 1)) return false;
      }
      prev = p;
    }
    return true;
  };

  it("walks straight when nothing is in the way", () => {
    expect(walkPath({ x: 400, y: 430 }, { x: 600, y: 430 })).toEqual([{ x: 600, y: 430 }]);
  });

  it("goes around a table instead of through it, and ends at the destination", () => {
    const t = OBSTACLES[1];
    const from = { x: t.x + t.w / 2, y: t.y + t.h + 20 };
    const to = { x: t.x + t.w / 2, y: t.y - 20 };
    const path = walkPath(from, to);
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual(to);
    expect(avoidsTables(from, path)).toBe(true);
  });

  it("reaches a seat behind a table from its own side", () => {
    const seat = SEATS.find((s) => s.id === "table2-1")!;
    const from = { x: 480, y: 430 };
    const path = walkPath(from, seat);
    expect(path[path.length - 1]).toEqual({ x: seat.x, y: seat.y });
    // 最後の1歩（席に入るところ）以外はテーブルの上を通らない。席には奥側から入る
    expect(avoidsTables(from, path.slice(0, -1))).toBe(true);
    expect(path[path.length - 2].y).toBeLessThan(seat.y);
  });
});

describe("sanitizeLook", () => {
  it("keeps a known look and replaces anything else with a guest look", () => {
    expect(sanitizeLook("lady")).toBe("lady");
    for (const junk of [undefined, "<script>", 3, STAFF_LOOK]) {
      expect(LOOKS).toContain(sanitizeLook(junk));
    }
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

describe("sanitizeChat", () => {
  it("trims, flattens newlines and collapses spaces", () => {
    expect(sanitizeChat("  こんばんは\n\nおつかれ   さま  ")).toBe("こんばんは おつかれ さま");
  });

  it("cuts long text by characters (not bytes) and rejects junk", () => {
    expect(Array.from(sanitizeChat("🍺".repeat(200)))).toHaveLength(CHAT_MAX_LENGTH);
    expect(sanitizeChat("   ")).toBe("");
    expect(sanitizeChat(42)).toBe("");
  });
});

describe("bubbleDurationMs", () => {
  it("keeps bubbles between 6 and 12 seconds", () => {
    expect(bubbleDurationMs("うん")).toBeGreaterThanOrEqual(6_000);
    expect(bubbleDurationMs("あ".repeat(80))).toBe(12_000);
  });
});

describe("reactions and seats", () => {
  it("accepts only known reactions", () => {
    expect(isReaction("わかる")).toBe(true);
    expect(isReaction("いいね")).toBe(false);
  });

  it("finds seats by id and keeps ids unique", () => {
    expect(findSeat("counter-1")).toBeDefined();
    expect(findSeat("nope")).toBeUndefined();
    expect(new Set(SEATS.map((s) => s.id)).size).toBe(SEATS.length);
  });
});

describe("todaysTopics", () => {
  it("gives everyone the same topics for the same night, without duplicates", () => {
    const night = Date.UTC(2026, 10, 4, 13, 0); // 日本時間 22:00
    const afterMidnight = Date.UTC(2026, 10, 4, 16, 30); // 日本時間 翌1:30（同じ夜）
    expect(todaysTopics(night)).toEqual(todaysTopics(afterMidnight));
    expect(new Set(todaysTopics(night)).size).toBe(TOPICS_PER_DAY);
    for (const t of todaysTopics(night)) expect(TOPICS).toContain(t);
  });

  it("changes topics from one night to the next", () => {
    const night = Date.UTC(2026, 10, 4, 13, 0);
    const nextNight = night + 86_400_000;
    expect(todaysTopics(nextNight)).not.toEqual(todaysTopics(night));
  });
});

describe("parseBottles", () => {
  it("reads names separated by commas, tidies them, and keeps at most MAX_BOTTLES", () => {
    expect(parseBottles("たろう, みさき、けん\nたろう")).toEqual(["たろう", "みさき", "けん"]);
    expect(parseBottles(" , ,")).toEqual([]);
    expect(parseBottles(undefined)).toEqual([]);
    expect(parseBottles("あ".repeat(40))).toEqual(["あ".repeat(NAME_MAX_LENGTH)]);
    expect(parseBottles(Array.from({ length: 20 }, (_, i) => `客${i}`).join(","))).toHaveLength(MAX_BOTTLES);
  });
});
