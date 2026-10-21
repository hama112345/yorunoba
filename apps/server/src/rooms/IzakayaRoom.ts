import { timingSafeEqual } from "node:crypto";
import { Room, ServerError, type AuthContext, type Client } from "@colyseus/core";
import {
  AVATAR_COLORS,
  EVT,
  FLOOR,
  IzakayaState,
  JAIL_MS,
  MAX_CLIENTS_PER_ROOM,
  MSG,
  Player,
  REPORTS_TO_JAIL,
  REPORT_WINDOW_MS,
  RULE_STRIKES_TO_JAIL,
  clampToFloor,
  findSeat,
  isReaction,
  isValidColor,
  sanitizeChat,
  sanitizeName,
  sanitizeTags,
  shopPhase,
  type AnnounceEvent,
  type ChatEvent,
  type JailedEvent,
  type JoinOptions,
  type MovePayload,
  type NoticeEvent,
  type ReactionEvent,
} from "@yorunoba/shared";
import { RateLimiter } from "../chat/rateLimit.js";
import { checkChat } from "../chat/rules.js";
import { hoursAnnouncement, hoursEnforced } from "../hours.js";
import { ReportBook, jailList } from "../moderation/jail.js";
import { notifyStaff } from "../moderation/notify.js";

/** 出現位置どうしの最低距離（重なると、タップで別の人を選んでしまう） */
const SPAWN_GAP = 44;

/** 入口（のれん）付近の、ほかの客と重ならない位置に出現させる */
function entrancePosition(others: { x: number; y: number }[]) {
  let best = { x: FLOOR.width / 2, y: FLOOR.height - FLOOR.wall - 24 };
  let bestGap = -1;
  for (let i = 0; i < 12; i++) {
    const p = clampToFloor(
      FLOOR.width / 2 + (Math.random() - 0.5) * 360,
      FLOOR.height - FLOOR.wall - 16 - Math.random() * 70,
    );
    const gap = Math.min(Infinity, ...others.map((o) => Math.hypot(o.x - p.x, o.y - p.y)));
    if (gap >= SPAWN_GAP) return p;
    if (gap > bestGap) [best, bestGap] = [p, gap];
  }
  return best; // 混んでいて空きがなければ、いちばん空いている所
}

/** 通報の確認用にメモリ上だけで持っておく直近の発言数（保存はしない） */
const RECENT_CHAT_LIMIT = 20;

interface RecentChat extends ChatEvent {
  /** 反応済みの「sessionId:種類」。同じ人が同じ反応を何度も押せないように */
  reactedBy: Set<string>;
}

/** 入店時に確かめた情報（onAuth の戻り値。client.auth に入る） */
interface GuestAuth {
  deviceId?: string;
  ip?: string;
  staff: boolean;
}

/** 端末IDは英数字とハイフンだけ・長さを制限して受け取る */
function sanitizeDeviceId(raw: unknown): string | undefined {
  return typeof raw === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(raw) ? raw : undefined;
}

/** 店主の合言葉が正しいか（Renderの環境変数 ADMIN_TOKEN。8文字未満なら店主機能は無効） */
function isStaffToken(raw: unknown): boolean {
  const secret = process.env.ADMIN_TOKEN ?? "";
  if (secret.length < 8 || typeof raw !== "string") return false;
  const a = Buffer.from(raw);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * 入店禁止の判定に使うキー。基本は端末IDだけ。
 * IPは携帯回線などで多くの人が共有しているため、巻き込みを避けて既定では使わない
 * （荒らしが端末を変えて戻ってくるようなら、環境変数 JAIL_BY_IP=true で有効にする）
 */
function jailKeys(auth: Pick<GuestAuth, "deviceId" | "ip">) {
  return [
    auth.deviceId && `device:${auth.deviceId}`,
    process.env.JAIL_BY_IP === "true" && auth.ip ? `ip:${auth.ip}` : undefined,
  ];
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
  /** 通報：同じ人が連打しないように */
  private reportLimiter = new RateLimiter(3, 10_000);
  private reportBook = new ReportBook(REPORT_WINDOW_MS);
  /** NGワード・連絡先の書き込み回数（sessionId → 回数） */
  private strikes = new Map<string, number>();
  private recentChats: RecentChat[] = [];
  private lastBubbleId = 0;
  private phase = shopPhase();

  /** 留置所にいる人は入れない。店主の合言葉もここで確かめる */
  onAuth(_client: Client, options: JoinOptions = {}, context: AuthContext): GuestAuth {
    if (hoursEnforced() && shopPhase() === "closed") {
      throw new ServerError(403, "営業時間外です。次の開店は21:00（日本時間）です");
    }
    const auth = { deviceId: sanitizeDeviceId(options.deviceId), ip: context.ip };
    const releaseAt = jailList.releaseAt(jailKeys(auth));
    if (releaseAt) {
      const minutes = Math.max(1, Math.ceil((releaseAt - Date.now()) / 60_000));
      throw new ServerError(403, `留置所にいます。あと${minutes}分で戻れます`);
    }
    return { ...auth, staff: isStaffToken(options.staffToken) };
  }

  onCreate() {
    // 営業の節目（開店・ラストオーダー・閉店）を店内に知らせる
    this.clock.setInterval(() => this.checkHours(), 20_000);

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
      const verdict = checkChat(text);
      if (!verdict.ok) {
        // 全員には流さず、本人にだけ注意。くり返したら留置所へ
        this.notice(client, verdict.message);
        const strikes = (this.strikes.get(client.sessionId) ?? 0) + 1;
        this.strikes.set(client.sessionId, strikes);
        if (strikes >= RULE_STRIKES_TO_JAIL) this.sendToJail(client, "店のルール（NGワード・連絡先）をくり返し破ったため");
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

    this.onMessage(MSG.report, (client: Client, payload: { target?: unknown }) => {
      const reporter = this.state.players.get(client.sessionId);
      const targetId = typeof payload?.target === "string" ? payload.target : "";
      const target = this.state.players.get(targetId);
      const targetClient = this.clients.get(targetId);
      if (!reporter || !target || !targetClient || targetId === client.sessionId) return;
      if (target.staff || !this.reportLimiter.allow(client.sessionId)) return;

      if (reporter.staff) {
        this.sendToJail(targetClient, "店主の判断");
        this.notice(client, `${target.name}さんを留置所へ送りました`);
        return;
      }
      const reporters = this.reportBook.add(targetId, client.sessionId);
      this.notice(client, "通報を受け付けました。ありがとうございます");
      void notifyStaff(`📣 通報：${target.name}（${reporters}人目）\n${this.recentLinesOf(targetId)}`);
      if (reporters >= REPORTS_TO_JAIL) this.sendToJail(targetClient, "複数のお客さんから通報があったため");
    });
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    const { x, y } = entrancePosition([...this.state.players.values()]);
    const player = new Player();
    player.staff = (client.auth as GuestAuth | undefined)?.staff ?? false;
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
    this.strikes.delete(client.sessionId);
  }

  /** 留置所へ：一定時間の入店禁止にして、本人に知らせてから店の外へ出す */
  private sendToJail(client: Client, reason: string) {
    const auth = (client.auth as GuestAuth | undefined) ?? { staff: false };
    const until = jailList.jail(jailKeys(auth), JAIL_MS);
    const event: JailedEvent = { until, reason };
    client.send(EVT.jailed, event);
    const name = this.state.players.get(client.sessionId)?.name ?? "だれか";
    void notifyStaff(`🚨 留置所へ：${name}（${reason}）\n${this.recentLinesOf(client.sessionId)}`);
    this.reportBook.forget(client.sessionId);
    client.leave(4001);
  }

  /** 通知用：その人の直近の発言（メモリ上の数行だけ） */
  private recentLinesOf(sessionId: string) {
    const lines = this.recentChats.filter((c) => c.from === sessionId).slice(-5);
    return lines.length ? lines.map((c) => `> ${c.text}`).join("\n") : "（直近の発言なし）";
  }

  private checkHours(now = Date.now()) {
    const next = shopPhase(now);
    const text = hoursAnnouncement(this.phase, next, hoursEnforced());
    this.phase = next;
    if (!text) return;
    const event: AnnounceEvent = { text };
    this.broadcast(EVT.announce, event);
    // 閉店時間を守るときは、お知らせのあと2分で店を閉める
    if (next === "closed" && hoursEnforced()) this.clock.setTimeout(() => this.disconnect(), 2 * 60_000);
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
