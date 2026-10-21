import { Room, type Client } from "@colyseus/core";
import {
  AVATAR_COLORS,
  FLOOR,
  IzakayaState,
  MAX_CLIENTS_PER_ROOM,
  MSG,
  Player,
  clampToFloor,
  isValidColor,
  sanitizeName,
  sanitizeTags,
  type JoinOptions,
  type MovePayload,
} from "@yorunoba/shared";

/** 入口（のれん）付近に少しばらけて出現させる */
function entrancePosition() {
  return clampToFloor(FLOOR.width / 2 + (Math.random() - 0.5) * 160, FLOOR.height - FLOOR.wall - 24);
}

export class IzakayaRoom extends Room<{ state: IzakayaState }> {
  maxClients = MAX_CLIENTS_PER_ROOM;
  /** 連打・荒らし対策の最低限。超えたクライアントは切断される */
  maxMessagesPerSecond = 20;
  state = new IzakayaState();

  onCreate() {
    this.onMessage(MSG.move, (client: Client, payload: Partial<MovePayload>) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof payload?.x !== "number" || typeof payload?.y !== "number") return;
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
      const { x, y } = clampToFloor(payload.x, payload.y);
      player.x = x;
      player.y = y;
    });
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const { x, y } = entrancePosition();
    const player = new Player();
    player.name = sanitizeName(options.name);
    player.tags = sanitizeTags(options.tags).join(",");
    player.color = isValidColor(options.color)
      ? options.color
      : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    player.x = x;
    player.y = y;
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }
}
