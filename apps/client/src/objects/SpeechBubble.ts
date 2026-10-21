import { REACTIONS, bubbleDurationMs, type Reaction } from "@yorunoba/shared";
import Phaser from "phaser";

const MAX_WIDTH = 190;
const PAD_X = 10;
const PAD_Y = 7;
/** 吹き出しはどのアバターよりも手前に出す */
const BUBBLE_DEPTH = 10_000;

/**
 * 頭の上の吹き出し。数秒で消え、どこにも保存しない。
 * タップすると onTap が呼ばれ、ワンタップ反応（わかる／笑／へぇ）を選べる。
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  readonly bubbleId: number;
  readonly text: string;
  private counts = new Map<Reaction, number>();
  private countLabel: Phaser.GameObjects.Text;
  private boxHeight: number;
  private fadeTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, bubbleId: number, text: string, onTap: (b: SpeechBubble, p: Phaser.Input.Pointer) => void) {
    super(scene, 0, 0);
    this.bubbleId = bubbleId;
    this.text = text;

    const label = scene.add
      .text(0, 0, text, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#2a1912",
        wordWrap: { width: MAX_WIDTH - PAD_X * 2, useAdvancedWrap: true },
        lineSpacing: 2,
      })
      .setOrigin(0.5, 1);
    const w = Math.max(48, label.width + PAD_X * 2);
    const h = label.height + PAD_Y * 2;
    this.boxHeight = h;

    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 2, -h - 8 + 3, w, h, 10);
    bg.fillStyle(0xfff8ec).fillRoundedRect(-w / 2, -h - 8, w, h, 10);
    bg.fillTriangle(-7, -9, 7, -9, 0, 0); // しっぽ
    label.setPosition(0, -8 - PAD_Y);

    this.countLabel = scene.add
      .text(w / 2 + 4, -h - 8, "", {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#1a1220",
        backgroundColor: "#ffd27a",
        padding: { x: 5, y: 2 },
      })
      .setOrigin(0, 0.5)
      .setVisible(false);

    // 吹き出し全体を押せるようにする（見えない当たり判定）
    const hit = scene.add.zone(0, -h / 2 - 8, w, h + 8).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => onTap(this, pointer));

    this.add([bg, label, this.countLabel, hit]);
    this.setDepth(BUBBLE_DEPTH);
    scene.add.existing(this);

    // 透明度0から始めると、出た直後の一瞬はタップできない（Phaserは見えない物を押せない）ので少しだけ見せておく
    this.setAlpha(0.2).setScale(0.85);
    scene.tweens.add({ targets: this, alpha: 1, scale: 1, duration: 140, ease: "Back.Out" });
    this.scheduleFade(bubbleDurationMs(text));
  }

  /** 反応を受けたら数を出し、少しだけ長く表示する */
  addReaction(kind: Reaction) {
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
    this.countLabel
      .setText(
        REACTIONS.filter((r) => this.counts.has(r))
          .map((r) => `${r}${this.counts.get(r)}`)
          .join(" "),
      )
      .setVisible(true);

    const pop = this.scene.add
      .text(this.x, this.y - this.boxHeight - 14, `${kind}!`, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd27a",
        stroke: "#1a1220",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(BUBBLE_DEPTH + 1);
    this.scene.tweens.add({ targets: pop, y: pop.y - 24, alpha: 0, duration: 900, onComplete: () => pop.destroy() });
    this.scheduleFade(3_000);
  }

  reactionCounts(): Partial<Record<Reaction, number>> {
    return Object.fromEntries(this.counts);
  }

  private scheduleFade(ms: number) {
    const remaining = this.fadeTimer ? this.fadeTimer.getRemaining() : 0;
    this.fadeTimer?.remove();
    this.fadeTimer = this.scene.time.delayedCall(Math.max(ms, remaining), () => {
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 400, onComplete: () => this.destroy() });
    });
  }
}
