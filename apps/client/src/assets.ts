// 外注・AI生成した絵の登録場所。
// 絵が届いたら apps/client/public/assets/ に置き、ここにパスを書く。
// null のあいだは、コードで描いた仮の絵（objects/izakayaDecor.ts など）で表示する。
//
// 背景を差し替えるときは、絵に合わせて packages/shared/src/layout.ts の
// 席・テーブル・入口の座標と、FLOOR（店の大きさ）も引き直すこと。

export const ASSETS = {
  /** 店内の背景（斜め見下ろし・人物なし）。docs/art/background-prompts.md で生成する */
  izakayaBackground: { key: "izakaya-bg", url: null as string | null },
} as const;
