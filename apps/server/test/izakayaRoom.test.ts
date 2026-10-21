import { Callbacks, Client, type Room } from "@colyseus/sdk";
import { FLOOR, IzakayaState, MSG, ROOM_IZAKAYA } from "@yorunoba/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../src/app.js";

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

function join(name: string): Promise<IzakayaRoom> {
  return sdk.joinOrCreate(ROOM_IZAKAYA, { name }, IzakayaState);
}

function playerCount(room: IzakayaRoom) {
  return room.state?.players?.size ?? 0;
}

function playerOf(room: IzakayaRoom, sessionId: string) {
  return room.state?.players?.get(sessionId);
}

describe("IzakayaRoom", () => {
  beforeAll(async () => {
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
});
