import { Callbacks, Client, type Room } from "@colyseus/sdk";
import {
  EVT,
  FLOOR,
  IzakayaState,
  MSG,
  ROOM_IZAKAYA,
  SEATS,
  type ChatEvent,
  type JailedEvent,
  type JoinOptions,
  type NoticeEvent,
  type ReactionEvent,
  type ShopStatus,
  type WipeEvent,
} from "@yorunoba/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/app.js";
import { aiStaffSettings, useAiStaff, type AiStaff, type ReviewLine } from "../src/moderation/aiStaff.js";

const PORT = 2601;
const server = createServer();
const sdk = new Client(`http://localhost:${PORT}`);

/** 条件が満たされるまで待つ（状態同期は非同期なので） */
async function waitFor(check: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
}

type IzakayaRoom = Room<any, IzakayaState>;

function join(name: string, tags?: unknown, extra: JoinOptions = {}): Promise<IzakayaRoom> {
  return sdk.joinOrCreate(ROOM_IZAKAYA, { name, tags, ...extra } as JoinOptions, IzakayaState);
}

let deviceSeq = 0;
/** テストごとに別の端末IDで入店する（留置所の記録が他のテストに影響しないように） */
const device = () => `test-device-${Date.now()}-${++deviceSeq}`;

function playerCount(room: IzakayaRoom) {
  return room.state?.players?.size ?? 0;
}

function playerOf(room: IzakayaRoom, sessionId: string) {
  return room.state?.players?.get(sessionId);
}

describe("IzakayaRoom", () => {
  beforeAll(async () => {
    // AI店員は基本オフ（使うテストだけ偽物を入れる）。見回りはテスト用に短い間隔で
    useAiStaff(null);
    aiStaffSettings.patrolMs = 100;
    await server.listen(PORT);
  });

  afterAll(async () => {
    await server.gracefullyShutdown(false);
  });

  it("puts two guests in the same izakaya and syncs movement", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    expect(bob.roomId).toBe(alice.roomId);

    await waitFor(() => playerCount(alice) === 2 && playerCount(bob) === 2);
    expect(playerOf(bob, alice.sessionId)?.name).toBe("アリス");

    const seen: number[] = [];
    const callbacks = Callbacks.get(bob);
    callbacks.onAdd("players", (player, key) => {
      if (key === alice.sessionId) callbacks.listen(player, "x", (x) => seen.push(x));
    });

    alice.send(MSG.move, { x: 300, y: 200 });
    await waitFor(() => playerOf(bob, alice.sessionId)?.x === 300);
    expect(playerOf(bob, alice.sessionId)?.y).toBe(200);
    expect(seen).toContain(300);

    await alice.leave();
    await waitFor(() => playerCount(bob) === 1);
    await bob.leave();
  });

  it("keeps guests inside the walls and ignores junk input", async () => {
    const room = await join("");
    await waitFor(() => playerOf(room, room.sessionId) !== undefined);
    expect(playerOf(room, room.sessionId)?.name).toBe("名無しの客");

    room.send(MSG.move, { x: "boom", y: null });
    room.send(MSG.move, { x: -999, y: 99999 });
    await waitFor(() => playerOf(room, room.sessionId)?.x === FLOOR.wall);
    expect(playerOf(room, room.sessionId)?.y).toBe(FLOOR.height - FLOOR.wall);

    await room.leave();
  });

  it("syncs sanitized topic tags", async () => {
    const room = await join("タグの人", ["サッカー", "ハッキング", "サッカー", "仕事終わり", "聞き専"]);
    await waitFor(() => playerOf(room, room.sessionId) !== undefined);
    expect(playerOf(room, room.sessionId)?.tags).toBe("サッカー,仕事終わり");
    await room.leave();
  });

  it("reports how many guests are drinking", async () => {
    const status = async () => (await (await fetch(`http://localhost:${PORT}/api/status`)).json()) as ShopStatus;
    expect(await status()).toMatchObject({ guests: 0, enforced: false });

    const a = await join("A");
    const b = await join("B");
    await waitFor(() => playerCount(b) === 2);
    expect(await status()).toMatchObject({ guests: 2 });

    await a.leave();
    await b.leave();
  });

  it("broadcasts sanitized chat to everyone, with a rate limit", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    await waitFor(() => playerCount(bob) === 2);

    const heard: ChatEvent[] = [];
    bob.onMessage(EVT.chat, (e: ChatEvent) => heard.push(e));
    const notices: NoticeEvent[] = [];
    alice.onMessage(EVT.notice, (e: NoticeEvent) => notices.push(e));
    alice.onMessage(EVT.chat, () => {});

    alice.send(MSG.chat, { text: "  こんばんは\nおつかれさま  " });
    alice.send(MSG.chat, { text: "   " }); // 空は無視
    await waitFor(() => heard.length === 1);
    expect(heard[0]).toMatchObject({ from: alice.sessionId, text: "こんばんは おつかれさま" });

    // 4回目以降は連投制限で届かず、本人にだけ注意が出る
    for (let i = 0; i < 5; i++) alice.send(MSG.chat, { text: `連投${i}` });
    await waitFor(() => notices.length > 0);
    await new Promise((r) => setTimeout(r, 200));
    expect(heard.length).toBeLessThanOrEqual(3);

    await alice.leave();
    await bob.leave();
  });

  it("lets guests sit on a free seat only, and stand up by walking", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    await waitFor(() => playerCount(bob) === 2);
    const seat = SEATS[0];
    const notices: NoticeEvent[] = [];
    bob.onMessage(EVT.notice, (e: NoticeEvent) => notices.push(e));

    alice.send(MSG.sit, { seatId: seat.id });
    await waitFor(() => playerOf(bob, alice.sessionId)?.seat === seat.id);
    expect(playerOf(bob, alice.sessionId)).toMatchObject({ x: seat.x, y: seat.y });

    bob.send(MSG.sit, { seatId: seat.id }); // 取り合い
    bob.send(MSG.sit, { seatId: "存在しない席" });
    await waitFor(() => notices.length === 1);
    expect(playerOf(alice, bob.sessionId)?.seat).toBe("");

    alice.send(MSG.move, { x: 300, y: 400 });
    await waitFor(() => playerOf(bob, alice.sessionId)?.seat === "");

    await alice.leave();
    await bob.leave();
  });

  it("relays one-tap reactions to existing bubbles of other guests", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    await waitFor(() => playerCount(bob) === 2);

    const chats: ChatEvent[] = [];
    bob.onMessage(EVT.chat, (e: ChatEvent) => chats.push(e));
    alice.onMessage(EVT.chat, () => {});
    const reactions: ReactionEvent[] = [];
    alice.onMessage(EVT.reaction, (e: ReactionEvent) => reactions.push(e));
    bob.onMessage(EVT.reaction, () => {});

    alice.send(MSG.chat, { text: "今日も一日おつかれ" });
    await waitFor(() => chats.length === 1);
    const bubbleId = chats[0].id;

    bob.send(MSG.react, { bubbleId, kind: "わかる" });
    bob.send(MSG.react, { bubbleId, kind: "わかる" }); // 同じ反応は1回まで
    bob.send(MSG.react, { bubbleId, kind: "いいね" }); // 知らない種類
    bob.send(MSG.react, { bubbleId: 9999, kind: "笑" }); // 知らない吹き出し
    alice.send(MSG.react, { bubbleId, kind: "笑" }); // 自分の発言
    await waitFor(() => reactions.length === 1);
    await new Promise((r) => setTimeout(r, 200));
    expect(reactions).toEqual([{ bubbleId, from: bob.sessionId, kind: "わかる" }]);

    await alice.leave();
    await bob.leave();
  });

  it("keeps NG words and contact info off the floor, and jails repeat offenders", async () => {
    const offenderDevice = device();
    const troll = await join("荒らし", undefined, { deviceId: offenderDevice });
    const bob = await join("ボブ", undefined, { deviceId: device() });
    await waitFor(() => playerCount(bob) === 2);

    const heard: ChatEvent[] = [];
    bob.onMessage(EVT.chat, (e: ChatEvent) => heard.push(e));
    troll.onMessage(EVT.chat, () => {});
    const notices: NoticeEvent[] = [];
    troll.onMessage(EVT.notice, (e: NoticeEvent) => notices.push(e));
    const jailed: JailedEvent[] = [];
    troll.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));

    troll.send(MSG.chat, { text: "LINE ID: troll1234 で話そう" });
    await waitFor(() => notices.length === 1);
    expect(notices[0].text).toContain("連絡先");
    expect(heard).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 1100)); // 連投制限に当たらないよう間を空ける
    troll.send(MSG.chat, { text: "死ね" });
    await new Promise((r) => setTimeout(r, 1100));
    troll.send(MSG.chat, { text: "パパ活しよ" });
    await waitFor(() => jailed.length === 1);
    expect(jailed[0].until).toBeGreaterThan(Date.now());
    await waitFor(() => playerCount(bob) === 1);
    expect(heard).toHaveLength(0);

    // 同じ端末からは入り直せない
    await expect(join("荒らし", undefined, { deviceId: offenderDevice })).rejects.toThrow(/留置所/);
    await bob.leave();
  });

  it("sends a guest to jail after reports from two different people", async () => {
    const targetDevice = device();
    const target = await join("迷惑な人", undefined, { deviceId: targetDevice });
    const a = await join("A", undefined, { deviceId: device() });
    const b = await join("B", undefined, { deviceId: device() });
    await waitFor(() => playerCount(a) === 3);
    const jailed: JailedEvent[] = [];
    target.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));
    const notices: NoticeEvent[] = [];
    a.onMessage(EVT.notice, (e: NoticeEvent) => notices.push(e));
    b.onMessage(EVT.notice, () => {});

    a.send(MSG.report, { target: target.sessionId });
    a.send(MSG.report, { target: target.sessionId }); // 同じ人の2回目は数えない
    await waitFor(() => notices.length >= 1);
    expect(jailed).toHaveLength(0);
    a.send(MSG.report, { target: a.sessionId }); // 自分は通報できない

    b.send(MSG.report, { target: target.sessionId });
    await waitFor(() => jailed.length === 1);
    expect(jailed[0].reason).toContain("通報");
    await waitFor(() => playerCount(a) === 2);
    await expect(join("迷惑な人", undefined, { deviceId: targetDevice })).rejects.toThrow(/留置所/);

    await a.leave();
    await b.leave();
  });

  it("lets the owner (staff token) send someone to jail at once, and staff cannot be reported", async () => {
    process.env.ADMIN_TOKEN = "test-admin-token-123";
    const owner = await join("店主", undefined, { deviceId: device(), staffToken: "test-admin-token-123" });
    const fake = await join("偽店主", undefined, { deviceId: device(), staffToken: "wrong-token-xxxx" });
    const guest = await join("客", undefined, { deviceId: device() });
    await waitFor(() => playerCount(owner) === 3);
    expect(playerOf(guest, owner.sessionId)?.staff).toBe(true);
    expect(playerOf(guest, fake.sessionId)?.staff).toBe(false);

    const jailed: JailedEvent[] = [];
    guest.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));
    fake.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));
    owner.onMessage(EVT.notice, () => {});
    guest.onMessage(EVT.notice, () => {});

    guest.send(MSG.report, { target: owner.sessionId }); // 店主は通報されない
    owner.send(MSG.report, { target: fake.sessionId }); // 店主の判断で即留置所
    await waitFor(() => jailed.length === 1);
    expect(jailed[0].reason).toBe("店主の判断");
    await waitFor(() => playerCount(guest) === 2);
    expect(playerOf(guest, owner.sessionId)).toBeDefined();

    delete process.env.ADMIN_TOKEN;
    await owner.leave();
    await guest.leave();
  });

  it("lets the AI staff warn about what the rules missed, and jail after repeated warnings", async () => {
    const seen: ReviewLine[][] = [];
    const fake: AiStaff = {
      async review(lines) {
        seen.push(lines);
        return lines.flatMap((l, index) =>
          l.text.includes("ブス") ? [{ index, category: "harassment" as const, severity: "warn" as const, note: "悪口" }] : [],
        );
      },
      async triage() {
        return null;
      },
    };
    useAiStaff(fake);
    const troll = await join("荒らし", undefined, { deviceId: device() });
    const bob = await join("ボブ", undefined, { deviceId: device() });
    await waitFor(() => playerCount(bob) === 2);
    const heard: ChatEvent[] = [];
    bob.onMessage(EVT.chat, (e: ChatEvent) => heard.push(e));
    bob.onMessage(EVT.notice, () => {});
    const wiped: WipeEvent[] = [];
    bob.onMessage(EVT.wipe, (e: WipeEvent) => wiped.push(e));
    troll.onMessage(EVT.chat, () => {});
    troll.onMessage(EVT.wipe, () => {});
    const notices: NoticeEvent[] = [];
    troll.onMessage(EVT.notice, (e: NoticeEvent) => notices.push(e));
    const jailed: JailedEvent[] = [];
    troll.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));

    // ふつうの発言は注意されない。悪口は吹き出しになったあと、本人にだけ店員から注意
    bob.send(MSG.chat, { text: "こんばんは" });
    troll.send(MSG.chat, { text: "お前ブスだな" });
    await waitFor(() => notices.length === 1);
    expect(notices[0].text).toContain("店員より");
    expect(heard.map((h) => h.text)).toContain("お前ブスだな");
    // その吹き出しは全員の画面から消える（ふつうの発言は消えない）
    await waitFor(() => wiped.length === 1);
    expect(wiped[0].bubbleId).toBe(heard.find((h) => h.text === "お前ブスだな")!.id);
    // AIには名前を渡さない（仮の呼び名だけ）
    const all = seen.flat();
    expect(all.map((l) => l.speaker)).toEqual(expect.arrayContaining(["客1"]));
    expect(JSON.stringify(seen)).not.toContain("荒らし");
    expect(JSON.stringify(seen)).not.toContain("ボブ");

    troll.send(MSG.chat, { text: "ブスはブス" });
    troll.send(MSG.chat, { text: "やっぱりブス" });
    await waitFor(() => jailed.length === 1);
    expect(jailed[0].reason).toContain("店員");
    await waitFor(() => playerCount(bob) === 1);
    expect(notices.filter((n) => n.text.startsWith("店員より")).length).toBeGreaterThanOrEqual(2);

    useAiStaff(null);
    await bob.leave();
  });

  it("lets the AI staff handle a first report without waiting for a second one", async () => {
    let asked: { reported: string; lines: ReviewLine[] } | undefined;
    useAiStaff({
      async review() {
        return [];
      },
      async triage(reported, lines) {
        asked = { reported, lines };
        const said = lines.filter((l) => l.speaker === reported).map((l) => l.text).join();
        return said.includes("殴") ? { action: "jail", note: "脅し" } : { action: "none", note: "" };
      },
    });
    const target = await join("物騒な人", undefined, { deviceId: device() });
    const a = await join("A", undefined, { deviceId: device() });
    await waitFor(() => playerCount(a) === 2);
    target.onMessage(EVT.chat, () => {});
    a.onMessage(EVT.chat, () => {});
    a.onMessage(EVT.notice, () => {});
    const jailed: JailedEvent[] = [];
    target.onMessage(EVT.jailed, (e: JailedEvent) => jailed.push(e));

    a.send(MSG.chat, { text: "どうしたの" });
    target.send(MSG.chat, { text: "今から殴りに行くぞ" });
    await new Promise((r) => setTimeout(r, 200));
    a.send(MSG.report, { target: target.sessionId });
    await waitFor(() => jailed.length === 1);
    expect(jailed[0].reason).toContain("店員が確認");
    expect(asked?.lines.some((l) => l.speaker === asked?.reported && l.text.includes("殴"))).toBe(true);

    useAiStaff(null);
    await a.leave();
  });

  it("spawns new guests apart from each other near the entrance", async () => {
    const rooms = [];
    for (let i = 0; i < 5; i++) rooms.push(await join(`客${i}`));
    const last = rooms[rooms.length - 1];
    await waitFor(() => playerCount(last) === 5);
    const ps = [...last.state.players.values()];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        expect(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)).toBeGreaterThanOrEqual(40);
      }
    }
    for (const r of rooms) await r.leave();
  });

  it("refuses entry outside opening hours only when hours are enforced", async () => {
    process.env.SHOP_HOURS_ENFORCED = "true";
    const { shopPhase } = await import("@yorunoba/shared");
    if (shopPhase() === "closed") {
      await expect(join("時間外の客")).rejects.toThrow(/営業時間外/);
    } else {
      const r = await join("営業中の客");
      await r.leave();
    }
    delete process.env.SHOP_HOURS_ENFORCED;
    const r = await join("いつでも入れる客"); // 既定（試験営業中）は24時間入れる
    await r.leave();
  });
});
