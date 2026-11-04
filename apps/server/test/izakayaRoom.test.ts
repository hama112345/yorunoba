import { matchMaker } from "@colyseus/core";
import { Callbacks, Client, type Room } from "@colyseus/sdk";
import {
  AI_REGULAR,
  EVT,
  IzakayaState,
  LOOKS,
  MSG,
  OBSTACLES,
  ROOM_IZAKAYA,
  SEATS,
  SPAWN_AREA,
  STAFF_LOOK,
  STAFF_SPOT,
  WALK_AREA,
  isWalkable,
  type ChatEvent,
  type JailedEvent,
  type JoinOptions,
  type NoticeEvent,
  type ReactionEvent,
  type ShopStatus,
  type ToastEvent,
  type TopicEvent,
  type WipeEvent,
  todaysTopics,
} from "@yorunoba/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/app.js";
import { topicSettings } from "../src/rooms/IzakayaRoom.js";
import { aiStaffSettings, useAiStaff, type AiStaff, type ReviewLine } from "../src/moderation/aiStaff.js";
import { SELF_SPEAKER, aiRegularSettings, useAiRegular, type AiRegular } from "../src/npc/aiRegular.js";

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
    // AI常連も基本オフ。使うテストだけ偽物を入れ、間隔を短くする
    useAiRegular(null);
    Object.assign(aiRegularSettings, {
      tickMs: 100,
      leaveGraceMs: 300,
      replyDelayMs: [50, 100],
      minGapMs: 0,
      silenceMs: 60_000,
      greetDelayMs: 100,
      byeDelayMs: 200,
    });
    // お題は基本出さない（静かになるまでの時間を長く）。使うテストだけ短くする
    Object.assign(topicSettings, { tickMs: 50, quietMs: 60_000, gapMs: 60_000 });
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

    alice.send(MSG.move, { x: 300, y: 300 }); // テーブルの間の通路
    await waitFor(() => playerOf(bob, alice.sessionId)?.x === 300);
    expect(playerOf(bob, alice.sessionId)?.y).toBe(300);
    expect(seen).toContain(300);

    await alice.leave();
    await waitFor(() => playerCount(bob) === 1);
    await bob.leave();
  });

  it("keeps guests inside the walls and ignores junk input", async () => {
    const room = await join("");
    await waitFor(() => playerOf(room, room.sessionId) !== undefined);
    expect(playerOf(room, room.sessionId)?.name).toBe("名無しの客");

    // 入口（のれん）の内側に出てくる
    const start = playerOf(room, room.sessionId)!;
    expect(isWalkable(start.x, start.y)).toBe(true);
    expect(Math.abs(start.y - (SPAWN_AREA.y + SPAWN_AREA.h / 2))).toBeLessThanOrEqual(SPAWN_AREA.h);

    room.send(MSG.move, { x: "boom", y: null });
    room.send(MSG.move, { x: -999, y: 99999 });
    await waitFor(() => playerOf(room, room.sessionId)?.x === WALK_AREA.x);
    expect(playerOf(room, room.sessionId)?.y).toBe(WALK_AREA.y + WALK_AREA.h);

    // テーブルの上には立てない（いちばん近い外側に押し出される）
    const table = OBSTACLES[0];
    room.send(MSG.move, { x: table.x + table.w / 2, y: table.y + table.h - 3 });
    await waitFor(() => playerOf(room, room.sessionId)?.y === table.y + table.h + 1);
    const p = playerOf(room, room.sessionId)!;
    expect(isWalkable(p.x, p.y)).toBe(true);

    await room.leave();
  });

  it("lets guests pick a character, but not the staff one", async () => {
    const lady = await join("レディ", [], { look: "lady" });
    const sneaky = await join("店員のふり", [], { look: STAFF_LOOK });
    const junk = await join("いたずら", [], { look: "<img>" as string });
    await waitFor(() => playerCount(junk) === 3);
    expect(playerOf(junk, lady.sessionId)?.look).toBe("lady");
    expect(LOOKS).toContain(playerOf(junk, sneaky.sessionId)?.look);
    expect(LOOKS).toContain(playerOf(junk, junk.sessionId)?.look);
    await Promise.all([lady.leave(), sneaky.leave(), junk.leave()]);
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

  it("keeps a dropped guest for a while, so they come back as themselves", async () => {
    const alice = await join("アリス", ["サッカー"]);
    const bob = await join("ボブ");
    alice.reconnection.minUptime = 0; // テストでは入店直後でもつなぎ直す
    await waitFor(() => playerCount(bob) === 2);
    const seat = SEATS[5];
    alice.send(MSG.sit, { seatId: seat.id });
    await waitFor(() => playerOf(bob, alice.sessionId)?.seat === seat.id);

    // 電波が途切れたのと同じ：本人の同意なく接続が切れる
    const dropped = new Promise<void>((resolve) => alice.onDrop(() => resolve()));
    const back = new Promise<void>((resolve) => alice.onReconnect(() => resolve()));
    const serverRoom = matchMaker.getLocalRoomById(alice.roomId);
    (serverRoom.clients.getById(alice.sessionId) as unknown as { ref: { terminate(): void } }).ref.terminate();
    await dropped;
    // つなぎ直しを待つあいだも、席と名前は残っている
    expect(playerOf(bob, alice.sessionId)).toMatchObject({ name: "アリス", seat: seat.id, tags: "サッカー" });
    await back;

    // 戻ったあとも同じ客として話せる
    const heard: ChatEvent[] = [];
    bob.onMessage(EVT.chat, (e: ChatEvent) => heard.push(e));
    alice.send(MSG.chat, { text: "ただいま" });
    await waitFor(() => heard.some((h) => h.from === alice.sessionId && h.text === "ただいま"));
    expect(playerCount(bob)).toBe(2);

    await alice.leave();
    await waitFor(() => playerCount(bob) === 1);
    await bob.leave();
  });

  it("lets a guest who closed the tab leave at once (no ghost left behind)", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    await waitFor(() => playerCount(bob) === 2);
    alice.reconnection.enabled = false;
    // タブを閉じたときの「去ります」（1001）で接続が切れる
    const serverRoom = matchMaker.getLocalRoomById(alice.roomId);
    (serverRoom.clients.getById(alice.sessionId) as unknown as { ref: { close(code: number): void } }).ref.close(1001);
    await waitFor(() => playerCount(bob) === 1);
    await bob.leave();
  });

  it("relays a toast to everyone, but not when someone mashes the button", async () => {
    const alice = await join("アリス");
    const bob = await join("ボブ");
    await waitFor(() => playerCount(bob) === 2);
    const toasts: ToastEvent[] = [];
    bob.onMessage(EVT.toast, (e: ToastEvent) => toasts.push(e));
    alice.send(MSG.toast);
    alice.send(MSG.toast); // 連打（8秒に1回まで）
    alice.send(MSG.toast);
    await waitFor(() => toasts.length >= 1);
    await new Promise((r) => setTimeout(r, 200));
    expect(toasts).toEqual([{ from: alice.sessionId }]);
    await alice.leave();
    await bob.leave();
  });

  it("puts up a topic when guests are there but nobody talks, not too often", async () => {
    Object.assign(topicSettings, { quietMs: 300, gapMs: 1_500 });
    try {
      const alice = await join("アリス");
      const topics: TopicEvent[] = [];
      alice.onMessage(EVT.topic, (e: TopicEvent) => topics.push(e));
      // 1人のときは出さない（話す相手がいない）
      await new Promise((r) => setTimeout(r, 500));
      expect(topics).toHaveLength(0);

      const bob = await join("ボブ");
      await waitFor(() => topics.length === 1, 2_000);
      expect(todaysTopics()).toContain(topics[0].text);
      // 続けては出さない
      await new Promise((r) => setTimeout(r, 600));
      expect(topics).toHaveLength(1);
      await alice.leave();
      await bob.leave();
    } finally {
      Object.assign(topicSettings, { quietMs: 60_000, gapMs: 60_000 });
    }
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

  it("brings in the AI regular only while the shop is quiet, and lets it chat within the rules", async () => {
    const asked: ReviewLine[][] = [];
    let next: string | null = "いいですね、乾杯！";
    const fake: AiRegular = {
      async reply(lines) {
        asked.push(lines);
        return next;
      },
    };
    useAiRegular(fake);
    const alice = await join("アリス", ["サッカー"], { deviceId: device() });
    const heard: ChatEvent[] = [];
    alice.onMessage(EVT.chat, (e: ChatEvent) => heard.push(e));
    alice.onMessage(EVT.notice, () => {});

    // 客が1人なので、AI店員ゲンがカウンターの中に現れ（名札にAI・店員の絵・席はふさがない）、あいさつする
    await waitFor(() => playerOf(alice, AI_REGULAR.id)?.ai === true);
    expect(playerOf(alice, AI_REGULAR.id)).toMatchObject({ x: STAFF_SPOT.x, y: STAFF_SPOT.y, seat: "", look: STAFF_LOOK });
    await waitFor(() => heard.some((h) => h.from === AI_REGULAR.id));
    // 店内人数（入店画面の「いま○人」）にはAIを数えない
    const status = (await (await fetch(`http://localhost:${PORT}/api/status`)).json()) as ShopStatus;
    expect(status.guests).toBe(1);

    // 話しかけると、少し間を置いて返事をする。AIには名前ではなく仮の呼び名で渡る
    alice.send(MSG.chat, { text: "こんばんは、ゲンさん" });
    await waitFor(() => heard.some((h) => h.from === AI_REGULAR.id && h.text === "いいですね、乾杯！"));
    const last = asked[asked.length - 1];
    expect(last.some((l) => l.speaker === "客1" && l.text === "こんばんは、ゲンさん")).toBe(true);
    expect(last.some((l) => l.speaker === SELF_SPEAKER)).toBe(true);
    expect(JSON.stringify(asked)).not.toContain("アリス");

    // 黙ると決めたら何も言わない
    next = null;
    const before = heard.length;
    alice.send(MSG.chat, { text: "ひとりごと" });
    await new Promise((r) => setTimeout(r, 400));
    expect(heard.slice(before).filter((h) => h.from === AI_REGULAR.id)).toHaveLength(0);

    // AIは通報できない（何も起きない）
    alice.send(MSG.report, { target: AI_REGULAR.id });

    // 客が3人になったら、しばらくして挨拶して帰る
    const bob = await join("ボブ", undefined, { deviceId: device() });
    const carol = await join("キャロル", undefined, { deviceId: device() });
    bob.onMessage(EVT.chat, () => {});
    carol.onMessage(EVT.chat, () => {});
    await waitFor(() => heard.some((h) => h.from === AI_REGULAR.id && h.text.includes("帰ります")), 5000);
    await waitFor(() => playerOf(alice, AI_REGULAR.id) === undefined, 5000);

    useAiRegular(null);
    await bob.leave();
    await carol.leave();
    await alice.leave();
  }, 15_000);

  it("keeps the AI regular away without an API key", async () => {
    const alice = await join("アリス", undefined, { deviceId: device() });
    await waitFor(() => playerCount(alice) === 1);
    await new Promise((r) => setTimeout(r, 400));
    expect(playerOf(alice, AI_REGULAR.id)).toBeUndefined();
    await alice.leave();
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
