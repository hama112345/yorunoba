// クライアントとサーバーで共有する定数・型。
// ここを変えると両方に効くので、店のサイズや部屋名はここだけで定義する。

/** Colyseus上の部屋名（＝店の種類） */
export const ROOM_IZAKAYA = "izakaya";

/** 店内の広さ（ピクセル）。Phaserの座標系と一致させる */
export const FLOOR = {
  width: 960,
  height: 640,
  /** 壁の厚み。アバターはこの内側だけ歩ける */
  wall: 48,
} as const;

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
} as const;

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
  tags?: string[];
}

/** 店の様子（入店画面の「いま○人」用） */
export interface ShopStatus {
  guests: number;
}

export interface MovePayload {
  x: number;
  y: number;
}

/** 歩ける範囲に座標を収める */
export function clampToFloor(x: number, y: number): MovePayload {
  const min = FLOOR.wall;
  const maxX = FLOOR.width - FLOOR.wall;
  const maxY = FLOOR.height - FLOOR.wall;
  return {
    x: Math.round(Math.min(Math.max(x, min), maxX)),
    y: Math.round(Math.min(Math.max(y, min), maxY)),
  };
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

export function isValidColor(color: unknown): color is number {
  return typeof color === "number" && (AVATAR_COLORS as readonly number[]).includes(color);
}

export * from "./layout";
export { IzakayaState, Player } from "./schema";
