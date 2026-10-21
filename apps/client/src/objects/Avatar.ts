import Phaser from "phaser";
import type { SpeechBubble } from "./SpeechBubble";

const WALK_SPEED = 170; // px/秒

/** 客のアバター。サーバーの座標を目標に、歩いて追いかける */
export class Avatar extends Phaser.GameObjects.Container {
  readonly guestName: string;
  readonly tags: string[];
  /** 座っている席のID（立っていれば ""） */
  seat = "";
  private target: Phaser.Math.Vector2;
  private body_: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private bubble?: SpeechBubble;
  private bob = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    name: string,
    color: number,
    tags: string[],
    isSelf: boolean,
    staff = false,
  ) {
    super(scene, x, y);
    this.guestName = name;
    this.tags = tags;
    this.target = new Phaser.Math.Vector2(x, y);

    const shadow = (this.shadow = scene.add.ellipse(0, 14, 30, 10, 0x000000, 0.3));
    this.body_ = scene.add.ellipse(0, 0, 30, 34, color).setStrokeStyle(2, 0x1a1220, 0.9);
    const eyes = [
      scene.add.circle(-6, -4, 2.6, 0x1a1220),
      scene.add.circle(6, -4, 2.6, 0x1a1220),
    ];
    const cheeks = [
      scene.add.circle(-10, 3, 3.2, 0xff8fa3, 0.55),
      scene.add.circle(10, 3, 3.2, 0xff8fa3, 0.55),
    ];
    const label = scene.add
      .text(0, -32, staff ? `🏮${name}` : name, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: staff ? "#ff9a7a" : isSelf ? "#ffd27a" : "#f6eadb",
        stroke: "#1a1220",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);

    this.add([shadow, this.body_, ...cheeks, ...eyes, label]);
    // ひとこと札は足元に小さく出す（頭の上は名前と、D3で吹き出しを出すため空けておく）
    if (tags.length > 0) {
      const tagLine = scene.add
        .text(0, 22, tags.map((t) => `#${t}`).join(" "), {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#ffe3a3",
          backgroundColor: "rgba(26,18,32,0.7)",
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5, 0);
      this.add(tagLine);
    }
    if (isSelf) {
      this.add(scene.add.triangle(0, -50, 0, 0, 10, 0, 5, 7, 0xffd27a).setOrigin(0.5));
    }
    // 体をタップすると名札カード（通報など）を出せるように、見えない当たり判定を置く
    if (!isSelf) {
      const hit = scene.add.zone(0, 0, 40, 46).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.emit("tap"));
      this.add(hit);
    }
    this.setDepth(y);
    scene.add.existing(this);
  }

  walkTo(x: number, y: number) {
    this.target.set(x, y);
  }

  /** 新しい吹き出しを出す（前の吹き出しは消す） */
  say(bubble: SpeechBubble) {
    if (this.bubble?.active) this.bubble.destroy();
    this.bubble = bubble;
    this.placeBubble();
  }

  get currentBubble(): SpeechBubble | undefined {
    return this.bubble?.active ? this.bubble : undefined;
  }

  destroy(fromScene?: boolean) {
    if (this.bubble?.active) this.bubble.destroy();
    super.destroy(fromScene);
  }

  private placeBubble() {
    // 名前の上に出す（名前を隠さない）
    if (this.bubble?.active) this.bubble.setPosition(this.x, this.y - 56);
  }

  step(deltaMs: number) {
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const maxStep = (WALK_SPEED * deltaMs) / 1000;

    const arrived = dist <= maxStep;
    if (arrived) {
      this.setPosition(this.target.x, this.target.y);
      this.bob = 0;
    } else {
      this.setPosition(this.x + (dx / dist) * maxStep, this.y + (dy / dist) * maxStep);
      this.bob += deltaMs / 90;
    }
    // 席に着いたら少し沈んで座った姿に（影は椅子に隠れる）
    const sitting = arrived && this.seat !== "";
    this.body_.setScale(1, sitting ? 0.88 : 1 - Math.abs(Math.sin(this.bob)) * 0.06);
    this.body_.y = sitting ? 3 : 0;
    this.shadow.setVisible(!sitting);
    this.setDepth(this.y);
    this.placeBubble();
  }
}
