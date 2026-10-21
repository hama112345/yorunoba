import { Callbacks } from "@colyseus/sdk";
import { ENTRANCE, FLOOR, MSG, clampToFloor } from "@yorunoba/shared";
import Phaser from "phaser";
import { ASSETS } from "../assets";
import type { IzakayaRoom } from "../net/connection";
import { Avatar } from "../objects/Avatar";
import { drawIzakaya } from "../objects/izakayaDecor";
import { showGuests } from "../ui/hud";

/** これより小さく映る画面（スマホ縦など）では、店全体ではなく自分の周りを大きく映す */
const READABLE_ZOOM = 0.8;

export class IzakayaScene extends Phaser.Scene {
  private room?: IzakayaRoom;
  private avatars = new Map<string, Avatar>();

  constructor() {
    super("izakaya");
  }

  create() {
    const bg = ASSETS.izakayaBackground;
    if (this.textures.exists(bg.key)) {
      this.add.image(0, 0, bg.key).setOrigin(0).setDepth(-1000);
    } else {
      drawIzakaya(this);
    }

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
      const avatar = new Avatar(this, player.x, player.y, player.name, player.color, tags, isSelf);
      this.avatars.set(sessionId, avatar);
      // 自分の移動はタップ時に先に動かしているので、サーバーの値は他人のぶんだけ反映する
      callbacks.onChange(player, () => {
        if (!isSelf) avatar.walkTo(player.x, player.y);
      });
      if (isSelf) this.layoutCamera();
      showGuests(this.avatars.size);
    });
    callbacks.onRemove("players", (_player, sessionId) => {
      this.avatars.get(sessionId)?.destroy();
      this.avatars.delete(sessionId);
      showGuests(this.avatars.size);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const { x, y } = clampToFloor(pointer.worldX, pointer.worldY);
      this.avatars.get(room.sessionId)?.walkTo(x, y);
      room.send(MSG.move, { x, y });
      this.showTapMarker(x, y);
    });
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
    const { width, height } = this.scale.gameSize;
    const fit = Math.min(width / FLOOR.width, height / FLOOR.height);

    if (fit >= READABLE_ZOOM) {
      // 店が画面より小さく映るので、端に寄らないよう境界を外して真ん中に置く
      cam.stopFollow();
      cam.removeBounds();
      cam.setZoom(fit);
      cam.centerOn(FLOOR.width / 2, FLOOR.height / 2);
      return;
    }

    // 追いかけるときは、店の外（何もない所）を映さないよう境界を付ける
    cam.setBounds(0, 0, FLOOR.width, FLOOR.height);
    cam.setZoom(Math.min(READABLE_ZOOM, height / FLOOR.height));
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
    }));
  }

  /** E2Eテスト用に、店の座標を画面（ブラウザ）上の座標に直す */
  worldToScreen(x: number, y: number) {
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: rect.left + cam.x + (x - cam.worldView.x) * cam.zoom,
      y: rect.top + cam.y + (y - cam.worldView.y) * cam.zoom,
    };
  }

  /** E2Eテスト・デバッグ用に、自分のアバターが画面内に映っているかを返す */
  isSelfOnScreen() {
    const self = this.room && this.avatars.get(this.room.sessionId);
    return !!self && this.cameras.main.worldView.contains(self.x, self.y);
  }
}
