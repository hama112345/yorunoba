import { findSeat, walkPath, type Seat } from "@yorunoba/shared";
import Phaser from "phaser";
import {
  ART_HEIGHT,
  AVATAR_HEIGHT,
  animKey,
  findCharacter,
  textureKey,
  type AnimName,
  type CharacterArt,
} from "../art/characters";
import { TEXT_RESOLUTION } from "../display";
import type { SpeechBubble } from "./SpeechBubble";

const WALK_SPEED = 170; // px/秒
/** 座ったときの背の高さ（椅子ごと。名札をこの上に出す） */
const SITTING_HEIGHT = 52;
/** 名札と頭のすきま */
const LABEL_GAP = 4;
/** ときどき飲む間隔（ミリ秒。最小〜最大）。じっとしているだけより、店の空気が出る */
const DRINK_EVERY: [number, number] = [25_000, 50_000];

export interface AvatarOptions {
  name: string;
  /** 絵が読めないときの丸いアバターの色 */
  color: number;
  /** キャラ（LOOKS / STAFF_LOOK） */
  look: string;
  tags: string[];
  isSelf: boolean;
  /** 店主なら true（名札に🏮） */
  staff?: boolean;
  /** AI店員ゲンなら true（名札に🤖AI店員。店内人数には数えない） */
  ai?: boolean;
}

type Direction = "down" | "up" | "left" | "right";

/** 客のアバター。サーバーの座標を目標に、歩いて追いかける。キャラの絵が無いときは丸いアバターで出す */
export class Avatar extends Phaser.GameObjects.Container {
  readonly guestName: string;
  readonly look: string;
  readonly tags: string[];
  readonly ai: boolean;
  /** 座っている席のID（立っていれば ""） */
  seat = "";
  /** これから通る点（最後が行き先）。テーブルを突っ切らないよう角を回る。空なら止まっている */
  private path: { x: number; y: number }[] = [];
  private art?: CharacterArt;
  private sprite?: Phaser.GameObjects.Sprite;
  /** 絵が読めないときの丸い体 */
  private blob?: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private label: Phaser.GameObjects.Text;
  /** ひとこと札（立っているときは足元、座っているときは名札の上） */
  private tagLine?: Phaser.GameObjects.Text;
  private bubble?: SpeechBubble;
  private direction: Direction = "down";
  /** いま再生中の1回きりの動き（乾杯・笑う・飲む）。歩き出したらやめる */
  private emote?: AnimName;
  private nextDrinkAt: number;
  private bob = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, o: AvatarOptions) {
    super(scene, x, y);
    this.guestName = o.name;
    this.look = o.look;
    this.ai = o.ai ?? false;
    this.tags = o.tags;
    this.nextDrinkAt = scene.time.now + Phaser.Math.Between(...DRINK_EVERY);

    this.shadow = scene.add.ellipse(0, 0, 30, 9, 0x000000, 0.32);
    // 自分の足元は金色の輪で示す（頭の上は名札と吹き出しのために空けておく）
    if (o.isSelf) this.add(scene.add.ellipse(0, 0, 40, 13).setStrokeStyle(2, 0xffd27a, 0.9));
    this.add(this.shadow);

    const art = findCharacter(o.look);
    if (art && scene.textures.exists(textureKey(art.id))) {
      this.art = art;
      this.sprite = scene.add
        .sprite(0, 0, textureKey(art.id), 0)
        // 絵のコマは下から2pxのところに足元がそろえてある
        .setOrigin(0.5, (art.frameHeight - 2) / art.frameHeight)
        .setScale(AVATAR_HEIGHT / ART_HEIGHT);
      this.add(this.sprite);
    } else {
      this.blob = scene.add.ellipse(0, -18, 30, 34, o.color).setStrokeStyle(2, 0x1a1220, 0.9);
      const face = [
        scene.add.circle(-6, -22, 2.6, 0x1a1220),
        scene.add.circle(6, -22, 2.6, 0x1a1220),
        scene.add.circle(-10, -15, 3.2, 0xff8fa3, 0.55),
        scene.add.circle(10, -15, 3.2, 0xff8fa3, 0.55),
      ];
      this.add([this.blob, ...face]);
    }

    this.label = scene.add
      .text(0, 0, o.staff ? `🏮${o.name}` : this.ai ? `🤖${o.name}（AI店員）` : o.name, {
        resolution: TEXT_RESOLUTION,
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: o.staff ? "#ff9a7a" : this.ai ? "#9fd0ff" : o.isSelf ? "#ffd27a" : "#f6eadb",
        stroke: "#1a1220",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);
    this.add(this.label);

    // ひとこと札は足元に小さく出す（頭の上は名札と吹き出しのため空けておく）。AI店員はカウンターの中なので出さない
    if (o.tags.length > 0 && !this.ai) {
      this.tagLine = scene.add
        .text(0, 6, o.tags.map((t) => `#${t}`).join(" "), {
          resolution: TEXT_RESOLUTION,
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#ffe3a3",
          backgroundColor: "rgba(26,18,32,0.7)",
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5, 0);
      this.add(this.tagLine);
    }
    // 体をタップすると名札カード（通報など）を出せるように、見えない当たり判定を置く
    if (!o.isSelf) {
      const height = this.sprite ? AVATAR_HEIGHT : 40;
      const hit = scene.add.zone(0, -height / 2, 40, height + 8).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.emit("tap"));
      this.add(hit);
    }
    this.setDepth(y);
    this.updatePose(false, undefined);
    scene.add.existing(this);
  }

  walkTo(x: number, y: number) {
    const last = this.path[this.path.length - 1];
    if (last && last.x === x && last.y === y) return; // 同じ行き先へ歩いている途中
    this.path = x === this.x && y === this.y ? [] : walkPath({ x: this.x, y: this.y }, { x, y });
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

  /**
   * 1回きりの動き（乾杯・笑う・飲む）。その絵が無いキャラ・歩いている最中は何もしない。
   * 座っているときは、座って飲む絵だけ使う（立ち姿の絵だと立ち上がって見えるため）
   */
  playEmote(name: "cheer" | "laugh" | "drink") {
    if (!this.sprite || !this.art || this.isMoving()) return;
    const seated = this.seatHere() !== undefined;
    const anim: AnimName | undefined = seated ? (name === "drink" ? "sit_drink" : undefined) : name;
    if (!anim || !this.art.anims[anim]) return;
    this.emote = anim;
    this.sprite.setFlipX(false);
    const key = animKey(this.art.id, anim);
    this.sprite.play(key);
    this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, () => {
      if (this.emote === anim) this.emote = undefined;
    });
  }

  /** ふわっと現れる（AI店員がカウンターに出てくるとき） */
  fadeIn() {
    this.setAlpha(0);
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 700, ease: "Sine.Out" });
  }

  destroy(fromScene?: boolean) {
    if (this.bubble?.active) this.bubble.destroy();
    super.destroy(fromScene);
  }

  private isMoving() {
    return this.path.length > 0;
  }

  /** いま立っている場所が、座っている席の上ならその席 */
  private seatHere(): Seat | undefined {
    const seat = this.seat ? findSeat(this.seat) : undefined;
    return seat && Math.abs(seat.x - this.x) < 1 && Math.abs(seat.y - this.y) < 1 ? seat : undefined;
  }

  private placeBubble() {
    // 名札（座っているときは、その上のひとこと札）の上に出す（隠さない）
    const top = this.seatHere() && this.tagLine ? this.tagLine.y - 14 : this.label.y - 16;
    if (this.bubble?.active) this.bubble.setPosition(this.x, this.y + top - 2);
  }

  step(deltaMs: number) {
    // 通る点を順にたどる。1コマで次の点に着いたら、残りの歩幅で先へ進む
    let budget = (WALK_SPEED * deltaMs) / 1000;
    while (this.path.length > 0 && budget > 0) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) this.direction = Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      if (dist <= budget) {
        this.setPosition(next.x, next.y);
        this.path.shift();
        budget -= dist;
      } else {
        this.setPosition(this.x + (dx / dist) * budget, this.y + (dy / dist) * budget);
        budget = 0;
      }
    }
    const moving = this.path.length > 0;
    this.bob = moving ? this.bob + deltaMs / 90 : 0;
    const seat = moving ? undefined : this.seatHere();
    this.updatePose(moving, seat);
    // じっとしているときは、ときどき一杯飲む
    if (!moving && !this.emote && this.scene.time.now >= this.nextDrinkAt) {
      this.nextDrinkAt = this.scene.time.now + Phaser.Math.Between(...DRINK_EVERY);
      this.playEmote("drink");
    }
    this.setDepth(this.y);
    this.placeBubble();
  }

  /**
   * ひとこと札の位置。立っているときは足元、座っているときは名札のすぐ上
   * （座ると足元がテーブルや椅子に隠れて読めなくなるため）
   */
  private placeTagLine(seated: boolean) {
    if (!this.tagLine) return;
    if (seated) this.tagLine.setOrigin(0.5, 1).setY(this.label.y - 15);
    else this.tagLine.setOrigin(0.5, 0).setY(6);
  }

  /** 歩く・座る・立つの絵を切り替える。名札の高さも姿勢に合わせる */
  private updatePose(moving: boolean, seat: Seat | undefined) {
    // 椅子に座ると影は椅子に隠れる
    this.shadow.setVisible(!seat);
    const art = this.art;
    if (!art || !this.sprite) {
      // 丸いアバター：歩くと少し弾み、座ると少し沈む
      this.blob!.setScale(1, seat ? 0.88 : 1 - Math.abs(Math.sin(this.bob)) * 0.06);
      this.label.y = -(seat ? 34 : 38) - LABEL_GAP;
      this.placeTagLine(seat !== undefined);
      return;
    }
    if (moving) this.emote = undefined;
    const has = (name: AnimName) => art.anims[name] !== undefined;
    const pick = (...names: AnimName[]) => names.find(has) ?? "idle";
    let anim: AnimName;
    let flip = false;
    let lift = 0;
    if (moving) {
      if (this.direction === "left" || this.direction === "right") {
        anim = pick("walk_side", "walk_down");
        // 横歩きの絵が向いている側と逆へ歩くときは、左右反転する
        flip = anim === "walk_side" && (this.direction === "right" ? art.side === "left" : art.side === "right");
      } else if (this.direction === "up") {
        anim = pick("walk_up", "walk_side", "walk_down");
      } else {
        anim = pick("walk_down", "walk_side");
      }
    } else if (seat) {
      anim = seat.facing === "front" ? "sit_front" : seat.facing === "back" ? "sit_back" : "sit_side";
      flip = anim === "sit_side" && seat.facing !== art.sitSide;
      // 床に座っている絵は、椅子の座面の高さまで持ち上げる
      lift = art.sitOnFloor ? seat.lift : 0;
    } else {
      anim = this.direction === "up" ? pick("idle_back", "idle") : "idle";
    }
    this.label.y = -lift - (seat ? SITTING_HEIGHT : AVATAR_HEIGHT) - LABEL_GAP;
    this.placeTagLine(seat !== undefined);
    this.sprite.y = -lift;
    // 乾杯・笑う・飲むの途中は、止まっているあいだは最後まで見せる
    if (this.emote && !moving) return;
    this.sprite.setFlipX(flip);
    this.sprite.play(animKey(art.id, anim), true);
  }
}
