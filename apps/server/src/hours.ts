import type { ShopPhase } from "@yorunoba/shared";

/** 時間外の入店禁止を有効にしているか（Renderの環境変数。一般公開の日から true） */
export function hoursEnforced() {
  return process.env.SHOP_HOURS_ENFORCED === "true";
}

/** 営業の節目で流すお知らせ。節目でなければ null */
export function hoursAnnouncement(prev: ShopPhase, next: ShopPhase, enforced: boolean): string | null {
  if (prev === next) return null;
  if (next === "open") return "🏮 開店です！ いらっしゃいませ。今夜もゆっくりどうぞ";
  if (next === "last_order") return "🏮 ラストオーダーです！ 24時で閉店です";
  if (next === "closed") {
    return enforced
      ? "🏮 閉店の時間です。今日もありがとうございました。また明日21時に！"
      : "🏮 本日の営業時間は終わりです（試験営業中なので、このまま開けておきます）";
  }
  return null;
}
