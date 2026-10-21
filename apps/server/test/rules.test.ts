import { describe, expect, it } from "vitest";
import { checkChat } from "../src/chat/rules.js";

const blocked = (text: string) => !checkChat(text).ok;

describe("checkChat", () => {
  it("lets ordinary izakaya talk through", () => {
    for (const text of [
      "今日の仕事しんどかった〜",
      "ハイボール3杯目いきます",
      "昨日のサッカー見た？ 2-1で勝ったね",
      "LINEで連絡しといた（同僚に）",
      "部長がほんとむかつく",
      "100円ショップ最高",
    ]) {
      expect(checkChat(text), text).toEqual({ ok: true });
    }
  });

  it("blocks strong abuse and solicitation, even when split with spaces or full-width", () => {
    expect(blocked("お前 死 ね")).toBe(true);
    expect(blocked("パパ活してる人いる？")).toBe(true);
    expect(blocked("ｺﾛｽ")).toBe(false); // カタカナ表記は未対応（「シネマ」等を巻き込むため）。AI店員（D8）で補う
    expect(checkChat("死ね")).toMatchObject({ ok: false, kind: "ng" });
  });

  it("blocks contact info and links", () => {
    for (const text of [
      "https://example.com 見て",
      "www.example.jp",
      "example.com でググって",
      "メールは foo.bar@example.com",
      "電話して 090-1234-5678",
      "09012345678",
      "インスタ @yoru_noba",
      "LINE ID: yorunoba123",
      "ラインはabcd1234",
      "ｄｉｓｃｏｒｄ　ｉｄ：ｙｏｒｕ１２３",
    ]) {
      expect(checkChat(text), text).toMatchObject({ ok: false, kind: "contact" });
    }
  });
});
