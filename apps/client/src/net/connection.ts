import { Client, type Room } from "@colyseus/sdk";
import {
  AVATAR_COLORS,
  IzakayaState,
  ROOM_IZAKAYA,
  isValidColor,
  sanitizeTags,
  type JoinOptions,
  type ShopStatus,
} from "@yorunoba/shared";

export type IzakayaRoom = Room<any, IzakayaState>;
export type Profile = Required<JoinOptions>;

/** 開発中はローカルのサーバー（2567番）、本番は同じURLのサーバーにつなぐ */
function serverUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:2567`;
  return location.origin;
}

const PROFILE_KEY = "yorunoba:profile";

/** 前回の入店時のプロフィール。初めてなら空欄＋ランダムな色 */
export function loadProfile(): Profile {
  let saved: Partial<JoinOptions> = {};
  try {
    saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
  } catch {
    // ストレージが使えない環境でも入店はできるようにする
  }
  return {
    name: typeof saved.name === "string" ? saved.name : "",
    color: isValidColor(saved.color)
      ? saved.color
      : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    tags: sanitizeTags(saved.tags),
  };
}

export function saveProfile(profile: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 同上
  }
}

export function joinIzakaya(options: JoinOptions): Promise<IzakayaRoom> {
  return new Client(serverUrl()).joinOrCreate(ROOM_IZAKAYA, options, IzakayaState);
}

/** いま店に何人いるか。取れなければ null（入店画面で表示を省くだけ） */
export async function fetchStatus(): Promise<ShopStatus | null> {
  try {
    const res = await fetch(`${serverUrl()}/api/status`);
    return res.ok ? ((await res.json()) as ShopStatus) : null;
  } catch {
    return null;
  }
}
