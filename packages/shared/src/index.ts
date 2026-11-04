// クライアントとサーバーで共有する定数・型。
// ここを変えると両方に効くので、店のサイズや部屋名はここだけで定義する。

/** Colyseus上の部屋名（＝店の種類） */
export const ROOM_IZAKAYA = "izakaya";

/** 1店舗あたりの最大人数（居酒屋っぽさを保つため少なめ） */
export const MAX_CLIENTS_PER_ROOM = 30;

export const NAME_MAX_LENGTH = 12;

/** アバターの色の候補（入店時に選ぶ。D1ではランダム） */
export const AVATAR_COLORS = [
  0xe4572e, 0xf3a712, 0x29335c, 0x669bbc, 0x8cb369, 0xb56576, 0x6d597a, 0xd4a373,
] as const;

/** クライアント→サーバーのメッセージ */
export const MSG = {
  move: "move",
  chat: "chat",
  sit: "sit",
  react: "react",
  report: "report",
  /** 🍻 乾杯（その場で乾杯の動き。全員に見える） */
  toast: "toast",
} as const;

/** サーバー→クライアントのお知らせ（状態として残さず、その場で流すもの） */
export const EVT = {
  /** 誰かの発言（吹き出し）。保存はしない */
  chat: "chat",
  /** 吹き出しへのワンタップ反応 */
  reaction: "reaction",
  /** 本人だけに出す注意（連投しすぎ など） */
  notice: "notice",
  /** 留置所に送られた本人への知らせ（このあと店から出される） */
  jailed: "jailed",
  /** 店からのお知らせ（開店・ラストオーダー・閉店） */
  announce: "announce",
  /** AI店員が問題のある発言を全員の画面から消す（「店員がおしぼりで拭きました」） */
  wipe: "wipe",
  /** 誰かが🍻乾杯した */
  toast: "toast",
  /** 店が静かなときに出すお題（会話欄に📋で出す） */
  topic: "topic",
} as const;

export interface ToastEvent {
  /** 乾杯した人の sessionId */
  from: string;
}

export interface TopicEvent {
  text: string;
}

export interface AnnounceEvent {
  text: string;
}

export interface WipeEvent {
  bubbleId: number;
}

/** 留置所（入店禁止）の時間 */
export const JAIL_MS = 10 * 60_000;
/** この時間内に、別々の人からこの人数の通報があれば留置所へ */
export const REPORT_WINDOW_MS = 10 * 60_000;
export const REPORTS_TO_JAIL = 2;
/** NGワード・連絡先の書き込みをこの回数くり返したら留置所へ */
export const RULE_STRIKES_TO_JAIL = 3;

export interface JailedEvent {
  /** 店に戻れる時刻（UNIXミリ秒） */
  until: number;
  reason: string;
}

/** 1回の発言の最大文字数（吹き出しに収まる長さ） */
export const CHAT_MAX_LENGTH = 80;

/** ワンタップ反応の種類。読むだけの人も参加できるように */
export const REACTIONS = ["わかる", "笑", "へぇ"] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface ChatEvent {
  /** 吹き出しの番号（反応を付けるときに使う） */
  id: number;
  /** 発言した人の sessionId */
  from: string;
  text: string;
}

export interface ReactionEvent {
  bubbleId: number;
  from: string;
  kind: Reaction;
}

export interface NoticeEvent {
  text: string;
}

/** ひとこと札（話題タグ）。荒らし対策のため自由入力にせず、この中から選ぶ */
export const TOPIC_TAGS = [
  "仕事終わり",
  "聞き専",
  "初めて",
  "サッカー",
  "野球",
  "アニメ",
  "ゲーム",
  "音楽",
  "お酒好き",
  "愚痴りたい",
] as const;
export type TopicTag = (typeof TOPIC_TAGS)[number];
export const MAX_TAGS = 2;

export interface JoinOptions {
  name?: string;
  color?: number;
  /** キャラ（LOOKS の中から） */
  look?: string;
  tags?: string[];
  /** 端末ごとのランダムなID（留置所の判定に使う。個人は特定しない） */
  deviceId?: string;
  /** 店主の合言葉（Renderの環境変数 ADMIN_TOKEN と一致すれば店主になる） */
  staffToken?: string;
}

/** 店の様子（入店画面の「いま○人」と営業時間の表示用） */
export interface ShopStatus {
  guests: number;
  phase: "closed" | "open" | "last_order";
  /** 時間外に入店できなくしているか（一般公開の日から true にする） */
  enforced: boolean;
  /** 次の開店時刻（UNIXミリ秒） */
  nextOpeningAt: number;
}

export interface MovePayload {
  x: number;
  y: number;
}

/** ニックネームを整える。空なら「名無しの客」 */
export function sanitizeName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
  return name.slice(0, NAME_MAX_LENGTH) || "名無しの客";
}

/** ひとこと札を整える。一覧にあるものだけ・重複なし・最大 MAX_TAGS 個 */
export function sanitizeTags(raw: unknown): TopicTag[] {
  if (!Array.isArray(raw)) return [];
  const known = raw.filter((t): t is TopicTag => (TOPIC_TAGS as readonly unknown[]).includes(t));
  return [...new Set(known)].slice(0, MAX_TAGS);
}

/** 発言を整える。制御文字と改行を除き、空白をまとめ、最大文字数で切る。空なら "" */
export function sanitizeChat(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(text).slice(0, CHAT_MAX_LENGTH).join("");
}

/** 吹き出しを出しておく時間。短い発言は6秒、長いほど延びて最大12秒 */
export function bubbleDurationMs(text: string): number {
  return Math.min(12_000, 6_000 + Array.from(text).length * 80);
}

export function isReaction(kind: unknown): kind is Reaction {
  return (REACTIONS as readonly unknown[]).includes(kind);
}

export function isValidColor(color: unknown): color is number {
  return typeof color === "number" && (AVATAR_COLORS as readonly number[]).includes(color);
}

/**
 * 客が入店時に選べるキャラ（絵は apps/client/public/assets/chars/<id>.webp、切り出し方は art/characters.json）。
 * 店員の絵（STAFF_LOOK）は、客と見分けがつくように客には選ばせない
 */
export const LOOKS = ["adventurer", "hoodie", "bookworm", "mechanic", "gentleman", "lady"] as const;
export type Look = (typeof LOOKS)[number];
/** 店員（AI店員ゲン）の絵 */
export const STAFF_LOOK = "waiter";

/** キャラを整える。一覧にないものは、一覧からランダムに選ぶ */
export function sanitizeLook(raw: unknown): Look {
  return (LOOKS as readonly unknown[]).includes(raw) ? (raw as Look) : LOOKS[Math.floor(Math.random() * LOOKS.length)];
}

export * from "./layout";
export { IzakayaState, Player } from "./schema";
export * from "./hours";
export * from "./topics";

/**
 * AI店員「ゲン」（コードの中では AI_REGULAR と呼ぶ。最初は常連客の役だった）。
 * 客が少ない時間（1〜2人）だけカウンターの中に現れて、話し相手になる。
 * 名札に「AI店員」と出し、人のふりはしない。sessionId の代わりにこのIDで店内の状態に入る
 */
export const AI_REGULAR = {
  id: "ai-regular",
  name: "ゲン",
  color: 0x8fb8de,
  look: STAFF_LOOK,
  tags: ["お酒好き"],
} as const;
