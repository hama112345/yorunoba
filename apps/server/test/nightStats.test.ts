import type { ShopStatus } from "@yorunoba/shared";
import { afterEach, describe, expect, it } from "vitest";
import { countUp, nightSummary, recordJoin, resetNightStats, startNightlyReport } from "../src/nightStats.js";

describe("今夜のまとめ", () => {
  afterEach(() => resetNightStats());

  it("counts visitors by device, the busiest moment, and activity — numbers only", () => {
    recordJoin("device-a", 1);
    recordJoin("device-b", 2);
    recordJoin("device-a", 3); // 入り直し：人数は増えない、のべ回数は増える
    countUp("chats");
    countUp("chats");
    countUp("toasts");
    countUp("jailed");
    const text = nightSummary();
    expect(text).toContain("来店：2人（のべ3回）・いちばん多いとき3人");
    expect(text).toContain("発言：2回・乾杯：1回・反応：0回");
    expect(text).toContain("通報：0件・留置所：1人");
  });

  it("sends the summary once when the shop closes, and starts over (not on nights nobody came)", async () => {
    let phase: ShopStatus["phase"] = "open";
    const sent: string[] = [];
    const stop = startNightlyReport(10, () => phase, async (t) => void sent.push(t));
    const tick = () => new Promise((r) => setTimeout(r, 40));
    try {
      recordJoin("device-a", 1);
      await tick();
      phase = "closed";
      await tick();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toContain("来店：1人");
      await tick(); // 閉店のあいだは何度も送らない
      expect(sent).toHaveLength(1);
      // 次の夜：誰も来なかったら送らない
      phase = "open";
      await tick();
      phase = "closed";
      await tick();
      expect(sent).toHaveLength(1);
    } finally {
      stop();
    }
  });
});
