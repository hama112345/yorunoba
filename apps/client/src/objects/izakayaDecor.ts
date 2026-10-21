import Phaser from "phaser";
import { TEXT_RESOLUTION } from "../display";
import { BACK_WALL_HEIGHT, COUNTER, COUNTER_SEATS, ENTRANCE, FLOOR, TABLES, TABLE_SEATS } from "@yorunoba/shared";

// 素材を買うまでの仮の内装。図形だけで「それっぽい居酒屋」を描く。
// 本物のドット絵素材に差し替えるときは、このファイルを丸ごと置き換える。
//
// 図形を毎フレーム描き直すとGPUの弱いスマホで重くなるので、
// 起動時に1回だけ描いて画像に焼き付け、その画像を表示する。

const WOOD_DARK = 0x3b2418;
const WOOD = 0x6b4226;
const WOOD_LIGHT = 0x8a5a33;
const MENU_ITEMS = ["生ビール", "やきとり", "枝豆", "冷やっこ", "唐揚げ", "ハイボール", "おでん", "日本酒"];

const vertical = (s: string) => s.split("").join("\n");

/** 提灯の位置（揺らめく灯りを重ねるために外からも使う） */
export function lanternPositions() {
  const { width, height, wall } = FLOOR;
  return [
    { x: wall + 22, y: BACK_WALL_HEIGHT + 30 },
    { x: width - wall - 22, y: BACK_WALL_HEIGHT + 30 },
    { x: ENTRANCE.x - 26, y: height - wall - 18 },
    { x: ENTRANCE.x + ENTRANCE.w + 26, y: height - wall - 18 },
  ];
}

/** 仮の内装を描いて、店全体の画像（照明の色を変えられる）を返す */
export function drawIzakaya(scene: Phaser.Scene): Phaser.GameObjects.Image {
  const g = scene.make.graphics({}, false);
  const { width, height, wall } = FLOOR;

  // 床（板張り）
  for (let y = BACK_WALL_HEIGHT, row = 0; y < height - wall; y += 28, row++) {
    g.fillStyle(row % 2 ? 0x5a3a24 : 0x63412a).fillRect(wall, y, width - wall * 2, 28);
    g.lineStyle(1, 0x3b2418, 0.6);
    for (let x = wall + ((row * 97) % 160); x < width - wall; x += 160) g.lineBetween(x, y, x, y + 28);
  }

  // 奥の壁と棚
  g.fillStyle(WOOD_DARK).fillRect(0, 0, width, BACK_WALL_HEIGHT);
  g.fillStyle(0x2a1912).fillRect(0, BACK_WALL_HEIGHT - 8, width, 8);
  for (const shelfY of [40, 82]) {
    g.fillStyle(WOOD_LIGHT).fillRect(560, shelfY, 360, 5);
    for (let i = 0; i < 14; i++) {
      const colors = [0x2f6b3a, 0x7a4b1e, 0xcfe3e8, 0x3a5a7a];
      g.fillStyle(colors[i % colors.length]).fillRoundedRect(570 + i * 25, shelfY - 26, 12, 26, 3);
    }
  }

  // 短冊メニュー
  MENU_ITEMS.forEach((item, i) => {
    const x = 60 + i * 58;
    g.fillStyle(0xf3ead8).fillRect(x, 12, 34, 92);
    scene.add
      .text(x + 17, 18, vertical(item), {
        resolution: TEXT_RESOLUTION,
        fontFamily: "serif",
        fontSize: "13px",
        color: "#2a1912",
        align: "center",
        lineSpacing: -3,
      })
      .setOrigin(0.5, 0)
      .setDepth(-999);
  });

  // 左右・手前の壁（入口だけ開いている）
  g.fillStyle(WOOD_DARK).fillRect(0, BACK_WALL_HEIGHT, wall, height - BACK_WALL_HEIGHT);
  g.fillRect(width - wall, BACK_WALL_HEIGHT, wall, height - BACK_WALL_HEIGHT);
  g.fillRect(0, height - wall, ENTRANCE.x, wall);
  g.fillRect(ENTRANCE.x + ENTRANCE.w, height - wall, width - ENTRANCE.x - ENTRANCE.w, wall);

  // のれん
  const flapW = ENTRANCE.w / 4;
  "ヨルノバ".split("").forEach((ch, i) => {
    const x = ENTRANCE.x + i * flapW;
    g.fillStyle(0x23305a).fillRect(x + 2, height - wall - 6, flapW - 4, 34);
    scene.add
      .text(x + flapW / 2, height - wall + 10, ch, { resolution: TEXT_RESOLUTION, fontFamily: "serif", fontSize: "16px", color: "#f6eadb" })
      .setOrigin(0.5)
      .setDepth(height);
  });

  // カウンター
  g.fillStyle(0x2a1912).fillRect(COUNTER.x, COUNTER.y + 6, COUNTER.w, COUNTER.h);
  g.fillStyle(WOOD_LIGHT).fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h - 8);
  g.fillStyle(0xc89a62).fillRect(COUNTER.x, COUNTER.y, COUNTER.w, 5);
  for (let x = COUNTER.x + 50; x < COUNTER.x + COUNTER.w; x += 110) {
    g.fillStyle(0xf3ead8).fillEllipse(x, COUNTER.y + 18, 26, 12); // 皿
    g.fillStyle(0xf0c040).fillRect(x + 22, COUNTER.y + 8, 10, 14); // ジョッキ
  }
  for (const seat of COUNTER_SEATS) {
    g.fillStyle(0x2a1912).fillCircle(seat.x, seat.y + 3, 13);
    g.fillStyle(0xa8322d).fillCircle(seat.x, seat.y, 12);
  }

  // テーブル席
  for (const t of TABLES) {
    g.fillStyle(0x000000, 0.25).fillRoundedRect(t.x + 4, t.y + 8, t.w, t.h, 6);
    g.fillStyle(WOOD).fillRoundedRect(t.x, t.y, t.w, t.h, 6);
    g.lineStyle(3, WOOD_DARK).strokeRoundedRect(t.x, t.y, t.w, t.h, 6);
    g.fillStyle(0xf3ead8).fillEllipse(t.x + t.w / 2, t.y + t.h / 2, 40, 20);
    g.fillStyle(0xe4572e).fillEllipse(t.x + t.w / 2, t.y + t.h / 2 - 2, 22, 9);
  }
  for (const seat of TABLE_SEATS) {
    g.fillStyle(0x6d597a).fillRoundedRect(seat.x - 14, seat.y - 12, 28, 24, 5);
  }

  // 灯りのにじみ（提灯と天井の明かり）。別の層にすると毎フレームの描画が重くなるので、同じ画像に焼き込む
  const lanterns = lanternPositions();
  for (let x = 200; x <= 760; x += 280) {
    for (let r = 220; r > 0; r -= 30) g.fillStyle(0xffc070, 0.018).fillCircle(x, 300, r);
  }
  for (const l of lanterns) {
    for (let r = 90; r > 0; r -= 15) g.fillStyle(0xff9a3c, 0.035).fillCircle(l.x, l.y, r);
  }

  // 提灯（赤）
  for (const l of lanterns) {
    g.fillStyle(0xc0392b).fillEllipse(l.x, l.y, 26, 34);
    g.fillStyle(0x1a1220).fillRect(l.x - 7, l.y - 19, 14, 4).fillRect(l.x - 7, l.y + 15, 14, 4);
    scene.add
      .text(l.x, l.y, "酒", { resolution: TEXT_RESOLUTION, fontFamily: "serif", fontSize: "14px", color: "#ffe9c7" })
      .setOrigin(0.5)
      .setDepth(-997);
  }

  return bake(scene, g, "izakaya-decor").setDepth(-1000);
}

/** 描いた図形を店の大きさの画像にして、元の図形は捨てる */
function bake(scene: Phaser.Scene, graphics: Phaser.GameObjects.Graphics, key: string) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  graphics.generateTexture(key, FLOOR.width, FLOOR.height);
  graphics.destroy();
  return scene.add.image(0, 0, key).setOrigin(0);
}
