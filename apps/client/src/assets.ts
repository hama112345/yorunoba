// 外注・AI生成した絵の登録場所。
// キャラと背景は art/build.py が apps/client/public/assets/ に書き出し、art/characters.json の一覧から読み込む。
// 読み込めなかったときは、コードで描いた仮の絵（objects/izakayaDecor.ts・丸いアバター）で表示する。
//
// 背景を差し替えるときは、絵に合わせて packages/shared/src/layout.ts の
// 席・テーブル・入口・歩ける範囲の座標も引き直すこと。
import { BACKGROUND } from "./art/characters";

export const ASSETS = {
  /** 店内の背景（斜め見下ろし・人物なし）。docs/art/background-prompts.md で生成した */
  izakayaBackground: { key: "izakaya-bg", url: BACKGROUND.url as string | null },
} as const;
