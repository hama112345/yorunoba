import { Callbacks } from "@colyseus/sdk";
import {
  ENTRANCE,
  EVT,
  FLOOR,
  MSG,
  SEATS,
  clampToFloor,
  type ChatEvent,
  type ReactionEvent,
  type WipeEvent,
} from "@yorunoba/shared";
import Phaser from "phaser";
import { track } from "../analytics";
import { ASSETS } from "../assets";
import { DPR } from "../display";
import type { IzakayaRoom } from "../net/connection";
import { Avatar } from "../objects/Avatar";
import { drawIzakaya, lanternPositions } from "../objects/izakayaDecor";
import { SpeechBubble } from "../objects/SpeechBubble";
import { showGuests } from "../ui/hud";
import { closeGuestCard } from "../ui/guestCard";
import { closeReactionPicker, showReactionPicker } from "../ui/reactionPicker";

/** これより小さく映る画面（スマホ縦など）では、店全体ではなく自分の周りを大きく映す */
const READABLE_ZOOM = 0.8;
/** 画面下の会話欄のぶん、店全体を映すときは少し上に寄せる（px） */
const CHAT_BAR_SPACE = 120;
/** 店の明るさ：1人だと少し落ち着いた灯り、10人以上で一番明るい（賑わいが目で分かるように） */
const DIM_TINT = { r: 0xc4, g: 0xb2, b: 0xb0 };
const FULL_GUESTS = 10;

export class IzakayaScene extends Phaser.Scene {
  private room?: IzakayaRoom;
  private avatars = new Map<string, Avatar>();
  /** 画面に出ている吹き出し（吹き出し番号 → 吹き出し）。消えたものは自動で外れる */
  private bubbles = new Map<number, SpeechBubble>();
  /** 店の背景（人数に応じて照明の色を変える） */
  private roomBg!: Phaser.GameObjects.Image;
  private brightness = { t: 0 };

  constructor() {
    super("izakaya");
  }

  create() {
    const bg = ASSETS.izakayaBackground;
    this.roomBg = this.textures.exists(bg.key)
      ? this.add.image(0, 0, bg.key).setOrigin(0).setDepth(-1000)
      : drawIzakaya(this);
    this.addLanternGlows();
    this.applyBrightness(0);

    this.layoutCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
    window.addEventListener("resize", this.redrawWhileWaiting);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutCamera, this);
      window.removeEventListener("resize", this.redrawWhileWaiting);
    });

    // 入店前の店内は動かないので、1回描いたら描画を止めておく（入店画面の操作を軽く、電池も減らさない）
    this.sleepAfterNextFrame();
    this.game.events.emit("izakaya-ready", this);
  }

  private sleepAfterNextFrame() {
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      if (!this.room) this.game.loop.sleep();
    });
  }

  /** 入店前に画面サイズが変わったら、1回だけ描き直す */
  private redrawWhileWaiting = () => {
    if (this.room || this.game.loop.running) return;
    this.game.loop.wake();
    this.sleepAfterNextFrame();
  };

  /** 入店したら呼ばれる。ここから客の表示と移動を始める */
  enterRoom(room: IzakayaRoom) {
    this.room = room;
    this.game.loop.wake();
    const callbacks = Callbacks.get(room);
    callbacks.onAdd("players", (player, sessionId) => {
      const isSelf = sessionId === room.sessionId;
      const tags = player.tags ? player.tags.split(",") : [];
      const avatar = new Avatar(this, player.x, player.y, player.name, player.color, tags, isSelf, player.staff);
      avatar.seat = player.seat;
      avatar.on("tap", () => this.game.events.emit("guest-tap", sessionId));
      this.avatars.set(sessionId, avatar);
      // 自分の移動はタップ時に先に動かしているので、サーバーの値は他人のぶんだけ反映する
      callbacks.onChange(player, () => {
        // 計測：自分が席に着いたとき（サーバーが認めた時点）だけ数える
        if (isSelf && player.seat && player.seat !== avatar.seat) {
          track("seat_taken", { seat_type: player.seat.startsWith("counter") ? "counter" : "table" });
        }
        avatar.seat = player.seat;
        if (!isSelf) avatar.walkTo(player.x, player.y);
      });
      if (isSelf) this.layoutCamera();
      this.onGuestsChanged();
    });
    callbacks.onRemove("players", (_player, sessionId) => {
      this.avatars.get(sessionId)?.destroy();
      this.avatars.delete(sessionId);
      this.onGuestsChanged();
    });

    room.onMessage(EVT.chat, (e: ChatEvent) => this.showBubble(e));
    room.onMessage(EVT.reaction, (e: ReactionEvent) => this.bubbles.get(e.bubbleId)?.addReaction(e.kind));
    // AI店員が消した発言は、吹き出しがまだ出ていればすぐ消す
    room.onMessage(EVT.wipe, (e: WipeEvent) => this.bubbles.get(e.bubbleId)?.wipe());

    this.addSeatSpots(room);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      // 吹き出し・席・ほかの客を押したときは歩かない（それぞれの処理が先に動いている。
      // ここで選択肢や名札カードを閉じると、開いたばかりのものまで閉じてしまう）
      if (over.length > 0) return;
      closeReactionPicker();
      closeGuestCard();
      const { x, y } = clampToFloor(pointer.worldX, pointer.worldY);
      this.avatars.get(room.sessionId)?.walkTo(x, y);
      room.send(MSG.move, { x, y });
      this.showTapMarker(x, y);
    });
  }

  /** 誰かの発言を頭上の吹き出しにする。自分以外の吹き出しはタップで反応できる */
  private showBubble(e: ChatEvent) {
    const avatar = this.avatars.get(e.from);
    if (!avatar) return;
    const isOwn = e.from === this.room?.sessionId;
    const bubble = new SpeechBubble(this, e.id, e.text, (b, pointer) => {
      if (isOwn) return;
      const event = pointer.event as PointerEvent;
      showReactionPicker(event.clientX, event.clientY, (kind) => {
        this.room?.send(MSG.react, { bubbleId: b.bubbleId, kind });
        track("emote_sent", { kind });
      });
    });
    this.bubbles.set(e.id, bubble);
    bubble.once(Phaser.GameObjects.Events.DESTROY, () => this.bubbles.delete(e.id));
    avatar.say(bubble);
  }

  /** 席に見えない当たり判定を置く。押すとそこへ歩いて座る */
  private addSeatSpots(room: IzakayaRoom) {
    for (const seat of SEATS) {
      const spot = this.add.zone(seat.x, seat.y, 34, 34).setInteractive({ useHandCursor: true });
      spot.on("pointerdown", () => {
        closeReactionPicker();
        this.avatars.get(room.sessionId)?.walkTo(seat.x, seat.y);
        room.send(MSG.sit, { seatId: seat.id });
        this.showTapMarker(seat.x, seat.y);
      });
    }
  }

  /** 人数が変わったら：右上の人数、店の明るさ、音（main.ts が "guests" を聞いている） */
  private onGuestsChanged() {
    const count = this.avatars.size;
    showGuests(count);
    this.game.events.emit("guests", count);
    const target = Math.min(1, (count - 1) / (FULL_GUESTS - 1));
    this.tweens.add({
      targets: this.brightness,
      t: target,
      duration: 1500,
      onUpdate: () => this.applyBrightness(this.brightness.t),
    });
  }

  private applyBrightness(t: number) {
    const mix = (dim: number) => Math.round(dim + (0xff - dim) * t);
    this.roomBg.setTint(Phaser.Display.Color.GetColor(mix(DIM_TINT.r), mix(DIM_TINT.g), mix(DIM_TINT.b)));
  }

  /** 提灯のまわりに、ゆらゆら揺れる暖かい光を重ねる（小さな画像なので軽い） */
  private addLanternGlows() {
    if (!this.textures.exists("glow")) {
      const size = 128;
      const canvas = this.textures.createCanvas("glow", size, size)!;
      const ctx = canvas.getContext();
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      canvas.refresh();
    }
    for (const p of lanternPositions()) {
      const glow = this.add
        .image(p.x, p.y, "glow")
        .setTint(0xff9a3c)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.3)
        .setAlpha(0.35)
        .setDepth(-990);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.25, to: 0.45 },
        scale: { from: 1.2, to: 1.35 },
        duration: 900 + Math.random() * 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
  }

  update(_time: number, delta: number) {
    for (const avatar of this.avatars.values()) avatar.step(delta);
  }

  /**
   * 画面の大きさに合わせて映し方を決める。
   * - PC・横持ち：店全体が十分大きく映るなら、全体を映す
   * - スマホ縦：店全体だと小さすぎるので、ズームして自分（入店前は入口）を追いかける
   */
  private layoutCamera() {
    const cam = this.cameras.main;
    // 計算は画面上の大きさ（CSSのpx）で行い、最後に画面の細かさ（DPR）を掛ける
    const width = this.scale.gameSize.width / DPR;
    const height = this.scale.gameSize.height / DPR;
    // 入店後は画面下に会話欄が出るので、そのぶんを除いた高さで考える
    const bottom = this.room ? CHAT_BAR_SPACE : 0;
    const fitWithBar = Math.min(width / FLOOR.width, (height - bottom) / FLOOR.height);
    if (fitWithBar >= READABLE_ZOOM) {
      // 店が画面より小さく映るので、端に寄らないよう境界を外して（会話欄の上の）真ん中に置く
      cam.stopFollow();
      cam.removeBounds();
      cam.setZoom(fitWithBar * DPR);
      cam.centerOn(FLOOR.width / 2, FLOOR.height / 2 + bottom / 2 / fitWithBar);
      return;
    }

    // 追いかけるときは、店の外（何もない所）を映さないよう境界を付ける
    cam.setBounds(0, 0, FLOOR.width, FLOOR.height);
    cam.setZoom(Math.min(READABLE_ZOOM, height / FLOOR.height) * DPR);
    const self = this.room && this.avatars.get(this.room.sessionId);
    if (self) {
      cam.startFollow(self, true, 0.12, 0.12);
    } else {
      cam.stopFollow();
      cam.centerOn(ENTRANCE.x + ENTRANCE.w / 2, ENTRANCE.y);
    }
  }

  private showTapMarker(x: number, y: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(2, 0xffd27a).setDepth(FLOOR.height);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  /** E2Eテスト・デバッグ用に、いま画面に出ているアバターの一覧を返す */
  snapshot() {
    return [...this.avatars.entries()].map(([id, a]) => ({
      id,
      x: Math.round(a.x),
      y: Math.round(a.y),
      tags: a.tags,
      seat: a.seat,
    }));
  }

  /** E2Eテスト用に、いま出ている吹き出しの一覧を返す */
  bubbleSnapshot() {
    return [...this.bubbles.values()].map((b) => ({
      id: b.bubbleId,
      text: b.text,
      x: Math.round(b.x),
      y: Math.round(b.y - 20), // 吹き出しの中ほど（タップ用）
      alpha: b.alpha,
      reactions: b.reactionCounts(),
    }));
  }

  /** E2Eテスト用に、席の一覧（空いているか）を返す */
  seatSnapshot() {
    const taken = new Set([...this.avatars.values()].map((a) => a.seat));
    return SEATS.map((s) => ({ ...s, free: !taken.has(s.id), onScreen: this.cameras.main.worldView.contains(s.x, s.y) }));
  }

  /** E2Eテスト用に、店の座標を画面（ブラウザ）上の座標に直す */
  worldToScreen(x: number, y: number) {
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: rect.left + (cam.x + (x - cam.worldView.x) * cam.zoom) / DPR,
      y: rect.top + (cam.y + (y - cam.worldView.y) * cam.zoom) / DPR,
    };
  }

  /** E2Eテスト・デバッグ用に、自分のアバターが画面内に映っているかを返す */
  isSelfOnScreen() {
    const self = this.room && this.avatars.get(this.room.sessionId);
    return !!self && this.cameras.main.worldView.contains(self.x, self.y);
  }
}
