import { Room, type Client } from "@colyseus/core";
import {
  AVATAR_COLORS,
  EVT,
  FLOOR,
  IzakayaState,
  MAX_CLIENTS_PER_ROOM,
  MSG,
  Player,
  clampToFloor,
  findSeat,
  isReaction,
  isValidColor,
  sanitizeChat,
  sanitizeName,
  sanitizeTags,
  type ChatEvent,
  type JoinOptions,
  type MovePayload,
  type NoticeEvent,
  type ReactionEvent,
} from "@yorunoba/shared";
import { RateLimiter } from "../chat/rateLimit.js";

/** 入口（のれん）付近に少しばらけて出現させる */
function entrancePosition() {
  return clampToFloor(FLOOR.width / 2 + (Math.random() - 0.5) * 160, FLOOR.height - FLOOR.wall - 24);
}

/** 通報の確認用にメモリ上だけで持っておく直近の発言数（保存はしない） */
const RECENT_CHAT_LIMIT = 20;

interface RecentChat extends ChatEvent {
  /** 反応済みの「sessionId:種類」。同じ人が同じ反応を何度も押せないように */
  reactedBy: Set<string>;
}

export class IzakayaRoom extends Room<{ state: IzakayaState }> {
  maxClients = MAX_CLIENTS_PER_ROOM;
  /** 連打・荒らし対策の最低限。超えたクライアントは切断される */
  maxMessagesPerSecond = 20;
  state = new IzakayaState();

  /** 発言：3回までは続けて、その後は1秒に1回 */
  private chatLimiter = new RateLimiter(3, 1000);
  /** 反応：5回までは続けて、その後は0.5秒に1回 */
  private reactionLimiter = new RateLimiter(5, 500);
  private recentChats: RecentChat[] = [];
  private lastBubbleId = 0;

  onCreate() {
    this.onMessage(MSG.move, (client: Client, payload: Partial<MovePayload>) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof payload?.x !== "number" || typeof payload?.y !== "number") return;
      if (!Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
      const { x, y } = clampToFloor(payload.x, payload.y);
      player.seat = ""; // 歩き出したら席を立つ
      player.x = x;
      player.y = y;
    });

    this.onMessage(MSG.sit, (client: Client, payload: { seatId?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      const seat = findSeat(payload?.seatId);
      if (!player || !seat) return;
      if (this.isSeatTaken(seat.id, client.sessionId)) {
        this.notice(client, "その席はふさがっています");
        return;
      }
      player.seat = seat.id;
      player.x = seat.x;
      player.y = seat.y;
    });

    this.onMessage(MSG.chat, (client: Client, payload: { text?: unknown }) => {
      if (!this.state.players.has(client.sessionId)) return;
      const text = sanitizeChat(payload?.text);
      if (!text) return;
      if (!this.chatLimiter.allow(client.sessionId)) {
        this.notice(client, "ちょっと早口です。ひと息ついてからどうぞ");
        return;
      }
      const event: ChatEvent = { id: ++this.lastBubbleId, from: client.sessionId, text };
      this.recentChats.push({ ...event, reactedBy: new Set() });
      if (this.recentChats.length > RECENT_CHAT_LIMIT) this.recentChats.shift();
      this.broadcast(EVT.chat, event);
    });

    this.onMessage(MSG.react, (client: Client, payload: { bubbleId?: unknown; kind?: unknown }) => {
      if (!this.state.players.has(client.sessionId) || !isReaction(payload?.kind)) return;
      const bubble = this.recentChats.find((c) => c.id === payload.bubbleId);
      // 自分の発言には反応できない。同じ反応は1人1回まで
      if (!bubble || bubble.from === client.sessionId) return;
      const key = `${client.sessionId}:${payload.kind}`;
      if (bubble.reactedBy.has(key) || !this.reactionLimiter.allow(client.sessionId)) return;
      bubble.reactedBy.add(key);
      const event: ReactionEvent = { bubbleId: bubble.id, from: client.sessionId, kind: payload.kind };
      this.broadcast(EVT.reaction, event);
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
    // 席は Player が消えれば自然に空く
    this.state.players.delete(client.sessionId);
    this.chatLimiter.forget(client.sessionId);
    this.reactionLimiter.forget(client.sessionId);
  }

  private isSeatTaken(seatId: string, except: string) {
    for (const [id, p] of this.state.players) {
      if (id !== except && p.seat === seatId) return true;
    }
    return false;
  }

  private notice(client: Client, text: string) {
    const event: NoticeEvent = { text };
    client.send(EVT.notice, event);
  }
}
