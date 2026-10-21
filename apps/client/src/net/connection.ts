import { Client, type Room } from "@colyseus/sdk";
import { AVATAR_COLORS, IzakayaState, ROOM_IZAKAYA, type JoinOptions } from "@yorunoba/shared";

export type IzakayaRoom = Room<any, IzakayaState>;

/** 開発中はローカルのサーバー（2567番）、本番は同じURLのサーバーにつなぐ */
function serverUrl(): string {
  if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:2567`;
  return location.origin;
}

const PROFILE_KEY = "yorunoba:profile";

/**
 * 客としてのプロフィール。D2で入店画面を作るまでは自動で決める。
 * URLの ?name=… で名前を指定できる（テスト用）。
 */
export function loadProfile(): Required<JoinOptions> {
  const fromUrl = new URLSearchParams(location.search).get("name");
  let saved: Partial<JoinOptions> = {};
  try {
    saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}");
  } catch {
    // ストレージが使えない環境でも入店はできるようにする
  }
  const profile = {
    name: fromUrl || saved.name || `客${Math.floor(100 + Math.random() * 900)}`,
    color: saved.color ?? AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // 同上
  }
  return profile;
}

export function joinIzakaya(options: JoinOptions): Promise<IzakayaRoom> {
  return new Client(serverUrl()).joinOrCreate(ROOM_IZAKAYA, options, IzakayaState);
}
