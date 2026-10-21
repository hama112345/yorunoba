// 利用状況の計測（PostHog）。検証したい指標は docs/hypotheses.md を参照。
// 約束：発言の本文は送らない（文字数だけ）。画面の録画・クリックの自動収集もしない。
// 環境変数 VITE_POSTHOG_KEY が無いときは何も送らない（開発中・テスト中）。

import type { PostHog } from "posthog-js";

export type EventName =
  | "page_view"
  | "closed_page_view"
  | "room_joined"
  | "chat_sent"
  | "emote_sent"
  | "seat_taken"
  | "room_left"
  | "report_sent"
  | "paywall_clicked"
  | "paywall_answered"
  | "waitlist_clicked"
  | "invite_clicked";

type Props = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    /** E2Eテスト用：送った（送るはずだった）イベントの控え。名前と数値だけで、発言の本文は入らない */
    __yorunobaEvents?: { event: EventName; props: Props }[];
  }
}

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com";

const sent: { event: EventName; props: Props }[] = [];
window.__yorunobaEvents = sent;

let client: PostHog | null = null;
const queue: { event: EventName; props: Props; beacon: boolean }[] = [];

/** URLの # 以降（店主の合言葉が入ることがある）は送らない */
const stripHash = (url: unknown) => (typeof url === "string" ? url.replace(/#.*$/, "") : url);

export function initAnalytics() {
  if (!KEY) return;
  // 計測の部品は大きいので、キーがあるときだけ後から読み込む（店の表示を遅らせない）
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: HOST,
      person_profiles: "always", // 再来訪（リテンション）を端末ごとに数えるため
      persistence: "localStorage", // Cookieは使わない
      autocapture: false, // クリックの自動収集はしない（会話欄の文字を拾わないように）
      capture_pageview: false, // 下の page_view を自分で送る
      capture_pageleave: false,
      disable_session_recording: true, // 画面の録画はしない
      disable_surveys: true,
      disable_external_dependency_loading: true,
      mask_all_text: true,
      before_send: (e) => {
        if (!e) return e;
        for (const key of ["$current_url", "$referrer", "$initial_current_url", "$initial_referrer"]) {
          if (key in e.properties) e.properties[key] = stripHash(e.properties[key]);
        }
        return e;
      },
    });
    client = posthog;
    for (const q of queue.splice(0)) send(q.event, q.props, q.beacon);
  });
}

function send(event: EventName, props: Props, beacon: boolean) {
  client?.capture(event, props, beacon ? { transport: "sendBeacon" } : undefined);
}

/**
 * イベントを1件送る。beacon=true は、ページを閉じる直前でも届くようにする送り方。
 * 発言の本文や名前は絶対に渡さないこと（文字数などの数値だけ）。
 */
export function track(event: EventName, props: Props = {}, beacon = false) {
  sent.push({ event, props });
  if (sent.length > 200) sent.shift();
  if (!KEY) return;
  if (client) send(event, props, beacon);
  else queue.push({ event, props, beacon });
}

/** 流入元（広告・SNS・招待リンクのどれから来たか）を page_view に付ける */
export function campaignProps(): Props {
  const params = new URLSearchParams(location.search);
  const props: Props = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"]) {
    const value = params.get(key);
    if (value) props[key] = value.slice(0, 64);
  }
  return props;
}
