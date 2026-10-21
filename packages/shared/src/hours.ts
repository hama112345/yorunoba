// 営業時間（日本時間）。人が少ないうちは時間を絞って、店に人を集中させる（閑散対策）。
// 時間外に入れなくするのは、環境変数 SHOP_HOURS_ENFORCED=true のときだけ（一般公開の日から）。

export const OPEN_HOUR = 21; // 21:00 開店
export const LAST_ORDER = { hour: 23, minute: 45 }; // 23:45 ラストオーダー
export const CLOSE_HOUR = 24; // 24:00 閉店

const JST_OFFSET_MS = 9 * 60 * 60_000;

/** 日本時間の「その日の0時からの分」 */
function jstMinutes(now: number) {
  const d = new Date(now + JST_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export type ShopPhase = "closed" | "open" | "last_order";

export function shopPhase(now = Date.now()): ShopPhase {
  const m = jstMinutes(now);
  if (m < OPEN_HOUR * 60) return "closed";
  if (m >= LAST_ORDER.hour * 60 + LAST_ORDER.minute) return "last_order";
  return "open";
}

/** 次の開店時刻（UNIXミリ秒）。開店前ならその日の21時、開店後なら翌日の21時 */
export function nextOpeningAt(now = Date.now()): number {
  const d = new Date(now + JST_OFFSET_MS);
  const openToday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), OPEN_HOUR) - JST_OFFSET_MS;
  return now < openToday ? openToday : openToday + 24 * 60 * 60_000;
}
