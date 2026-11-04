// 今夜の店の様子（数だけ）。閉店の時刻に、店主へDiscordで「今夜のまとめ」を送る。
// 毎晩の営業記録（docs/nightly-log.md）を書く助けにする。発言の中身・名前は数えない・残さない。
// 店（部屋）は誰もいなくなると片付けられるので、数はこのモジュールに持つ（メモリ上だけ。再起動で消える）。

import { shopPhase, type ShopStatus } from "@yorunoba/shared";
import { notifyStaff } from "./moderation/notify.js";

type Counter = "chats" | "toasts" | "reactions" | "reports" | "jailed";

function fresh() {
  return {
    /** 来た端末（数えるだけ。端末IDはランダムな値で、個人とは結びつかない） */
    devices: new Set<string>(),
    /** 入店の回数（入り直しも数える） */
    joins: 0,
    /** いちばん多いときの人数 */
    peak: 0,
    chats: 0,
    toasts: 0,
    reactions: 0,
    reports: 0,
    jailed: 0,
  };
}

let stats = fresh();

/** 入店した。guestsNow は入店後の店内人数 */
export function recordJoin(device: string, guestsNow: number) {
  stats.devices.add(device);
  stats.joins += 1;
  stats.peak = Math.max(stats.peak, guestsNow);
}

export function countUp(kind: Counter) {
  stats[kind] += 1;
}

/** Discordに送る「今夜のまとめ」の文（数だけ） */
export function nightSummary(): string {
  const s = stats;
  return [
    "🌙 今夜のまとめ（前回の閉店から）",
    `来店：${s.devices.size}人（のべ${s.joins}回）・いちばん多いとき${s.peak}人`,
    `発言：${s.chats}回・乾杯：${s.toasts}回・反応：${s.reactions}回`,
    `通報：${s.reports}件・留置所：${s.jailed}人`,
  ].join("\n");
}

/** 数をゼロに戻す（まとめを送ったあと） */
export function resetNightStats() {
  stats = fresh();
}

/**
 * 閉店の時刻になったら、まとめを店主へ送ってゼロに戻す（だれも来なかった夜は送らない）。
 * phaseAt はテストで時刻を差し替えるため
 */
export function startNightlyReport(
  intervalMs = 30_000,
  phaseAt: () => ShopStatus["phase"] = () => shopPhase(),
  send: (text: string) => Promise<void> = notifyStaff,
) {
  let last = phaseAt();
  const timer = setInterval(() => {
    const now = phaseAt();
    if (last !== "closed" && now === "closed") {
      if (stats.joins > 0) void send(nightSummary());
      resetNightStats();
    }
    last = now;
  }, intervalMs);
  timer.unref(); // これだけが残ってサーバーが終われない、ということがないように
  return () => clearInterval(timer);
}
