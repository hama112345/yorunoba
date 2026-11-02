import { COUNTER, ENTRANCE, FLOOR, SEATS, TABLES, WALK_AREA } from "@yorunoba/shared";
import Phaser from "phaser";

// 背景の絵（assets/izakaya-bg.webp）が読み込めなかったときの、仮の内装。
// 図形だけで間取り（床・カウンター・テーブル・席・のれん）がわかるように描く。
// 図形を毎フレーム描き直すとGPUの弱いスマホで重くなるので、1回だけ描いて画像に焼き付ける。

const WOOD_DARK = 0x3b2418;
const WOOD = 0x6b4226;
const WOOD_LIGHT = 0x8a5a33;

/** 仮の内装を描いて、店全体の画像（照明の色を変えられる）を返す */
export function drawIzakaya(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const g = scene.make.graphics({}, false);
  const { width, height } = FLOOR;

  // 壁と床（板張り）
  g.fillStyle(WOOD_DARK).fillRect(0, 0, width, height);
  for (let y = WALK_AREA.y - 70, row = 0; y < WALK_AREA.y + WALK_AREA.h; y += 24, row++) {
    g.fillStyle(row % 2 ? 0x5a3a24 : 0x63412a).fillRect(WALK_AREA.x, y, WALK_AREA.w, 24);
  }

  // カウンター
  g.fillStyle(0x2a1912).fillRect(COUNTER.x, COUNTER.y + 6, COUNTER.w, COUNTER.h);
  g.fillStyle(WOOD_LIGHT).fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h / 2);

  // テーブル
  for (const t of TABLES) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(t.x + 4, t.y + 8, t.w, t.h, 6);
    g.fillStyle(WOOD).fillRoundedRect(t.x, t.y, t.w, t.h * 0.7, 6);
  }

  // 席（座面）
  for (const s of SEATS) {
    g.fillStyle(0x2a1912).fillCircle(s.x, s.y - s.lift + 3, 11);
    g.fillStyle(0xa8322d).fillCircle(s.x, s.y - s.lift, 10);
  }

  // のれん
  g.fillStyle(0x23305a).fillRect(ENTRANCE.x, ENTRANCE.y, ENTRANCE.w, ENTRANCE.h * 0.7);

  if (scene.textures.exists("izakaya-decor")) scene.textures.remove("izakaya-decor");
  g.generateTexture("izakaya-decor", width, height);
  g.destroy();
  return scene.add.image(0, 0, "izakaya-decor").setOrigin(0).setDepth(-1000);
}
