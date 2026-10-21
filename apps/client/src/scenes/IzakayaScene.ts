import { Callbacks } from "@colyseus/sdk";
import { FLOOR, MSG, clampToFloor } from "@yorunoba/shared";
import Phaser from "phaser";
import type { IzakayaRoom } from "../net/connection";
import { Avatar } from "../objects/Avatar";
import { drawIzakaya } from "../objects/izakayaDecor";
import { showGuests } from "../ui/hud";

export class IzakayaScene extends Phaser.Scene {
  private room!: IzakayaRoom;
  private avatars = new Map<string, Avatar>();

  constructor() {
    super("izakaya");
  }

  init(data: { room: IzakayaRoom }) {
    this.room = data.room;
  }

  create() {
    drawIzakaya(this);

    const callbacks = Callbacks.get(this.room);
    callbacks.onAdd("players", (player, sessionId) => {
      const isSelf = sessionId === this.room.sessionId;
      const avatar = new Avatar(this, player.x, player.y, player.name, player.color, isSelf);
      this.avatars.set(sessionId, avatar);
      // 自分の移動はタップ時に先に動かしているので、サーバーの値は他人のぶんだけ反映する
      callbacks.onChange(player, () => {
        if (!isSelf) avatar.walkTo(player.x, player.y);
      });
      showGuests(this.avatars.size);
    });
    callbacks.onRemove("players", (_player, sessionId) => {
      this.avatars.get(sessionId)?.destroy();
      this.avatars.delete(sessionId);
      showGuests(this.avatars.size);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const { x, y } = clampToFloor(pointer.worldX, pointer.worldY);
      this.avatars.get(this.room.sessionId)?.walkTo(x, y);
      this.room.send(MSG.move, { x, y });
      this.showTapMarker(x, y);
    });
  }

  update(_time: number, delta: number) {
    for (const avatar of this.avatars.values()) avatar.step(delta);
  }

  private showTapMarker(x: number, y: number) {
    const ring = this.add.circle(x, y, 6).setStrokeStyle(2, 0xffd27a).setDepth(FLOOR.height);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
  }

  /** E2Eテスト・デバッグ用に、いま画面に出ているアバターの一覧を返す */
  snapshot() {
    return [...this.avatars.entries()].map(([id, a]) => ({ id, x: Math.round(a.x), y: Math.round(a.y) }));
  }
}
