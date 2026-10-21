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

export interface JoinOptions {
  name?: string;
  color?: number;
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

export function isValidColor(color: unknown): color is number {
  return typeof color === "number" && (AVATAR_COLORS as readonly number[]).includes(color);
}

export * from "./layout";
export { IzakayaState, Player } from "./schema";
