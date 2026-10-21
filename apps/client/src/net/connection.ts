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
/** 入店画面で入力して、次回のために覚えておく項目 */
export type Profile = Required<Pick<JoinOptions, "name" | "color" | "tags">>;

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

const DEVICE_KEY = "yorunoba:device";
const STAFF_KEY = "yorunoba:staff";

/** 端末ごとのランダムなID（留置所の判定用。名前や個人情報とは結びつけない） */
function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * 店主の合言葉。URLの末尾に #staff=合言葉 を付けて開くと、このタブの間だけ覚える。
 * （# 以降はサーバーのアクセス記録に残らない。URLからはすぐ消す）
 */
function staffToken(): string | undefined {
  try {
    const match = location.hash.match(/staff=([^&]+)/);
    if (match) {
      sessionStorage.setItem(STAFF_KEY, decodeURIComponent(match[1]));
      history.replaceState(null, "", location.pathname + location.search);
    }
    return sessionStorage.getItem(STAFF_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function joinIzakaya(options: JoinOptions): Promise<IzakayaRoom> {
  return new Client(serverUrl()).joinOrCreate(
    ROOM_IZAKAYA,
    { ...options, deviceId: deviceId(), staffToken: staffToken() },
    IzakayaState,
  );
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
