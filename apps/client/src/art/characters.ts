// キャラと背景の絵の一覧。中身の characters.json は art/build.py が作る（手で書き換えない）。
// 絵を差し替えたら python3 art/build.py を実行するだけで、ここから読み込まれる。
import Phaser from "phaser";
import data from "./characters.json";

export type AnimName =
  | "idle"
  | "idle_back"
  | "walk_down"
  | "walk_up"
  | "walk_side"
  | "sit_front"
  | "sit_back"
  | "sit_side"
  | "drink"
  | "sit_drink"
  | "cheer"
  | "laugh";

export interface CharacterArt {
  id: string;
  /** 入店画面に出す名前 */
  label: string;
  url: string;
  /** 入店画面のキャラ選びに出す、正面の立ち姿 */
  thumb: string;
  frameWidth: number;
  frameHeight: number;
  /** 横向きに歩く絵が、左右どちらを向いているか */
  side: "left" | "right";
  /** 横向きに座る絵が、左右どちらを向いているか */
  sitSide: "left" | "right";
  /** 店員の絵（客は選べない） */
  staffOnly: boolean;
  /** 座る絵に椅子が描かれていない（床に座っている）。店では座面の高さまで持ち上げる */
  sitOnFloor: boolean;
  anims: Partial<Record<AnimName, { frames: number[]; rate: number }>>;
}

export const CHARACTERS = data.characters as CharacterArt[];
export const BACKGROUND = data.background;
/** 立ち姿の高さ（絵のpx）。店ではこれを AVATAR_HEIGHT の高さに縮めて描く */
export const ART_HEIGHT = data.targetHeight;
/** 店の中でのキャラの背の高さ（店の座標のpx） */
export const AVATAR_HEIGHT = 62;

/** くり返す動き（歩く・待つ・座る）。それ以外（乾杯・笑う・飲む）は1回だけ */
const LOOPING: AnimName[] = ["idle", "idle_back", "walk_down", "walk_up", "walk_side", "sit_front", "sit_back", "sit_side"];

export const textureKey = (id: string) => `char-${id}`;
export const animKey = (id: string, anim: AnimName) => `${id}:${anim}`;

export function findCharacter(id: string): CharacterArt | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

/** 読み込めたキャラの動きを登録する（読み込めなかったキャラは、丸いアバターで代わりに出す） */
export function registerCharacterAnims(scene: Phaser.Scene) {
  for (const c of CHARACTERS) {
    const key = textureKey(c.id);
    if (!scene.textures.exists(key)) continue;
    for (const [name, anim] of Object.entries(c.anims) as [AnimName, { frames: number[]; rate: number }][]) {
      if (scene.anims.exists(animKey(c.id, name))) continue;
      scene.anims.create({
        key: animKey(c.id, name),
        frames: scene.anims.generateFrameNumbers(key, { frames: anim.frames }),
        frameRate: anim.rate,
        repeat: LOOPING.includes(name) ? -1 : 0,
      });
    }
  }
}
