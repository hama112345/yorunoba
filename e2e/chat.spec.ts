import { expect, test } from "@playwright/test";
import { avatars, bubbles, enter, seats, sessionId, tapWorld, waitForEmptyShop } from "./helpers";

test("吹き出しで話し、ワンタップで反応し、席に座れる", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  await enter(alice, "アリス", ["仕事終わり"]);
  await enter(bob, "ボブ", ["聞き専"]);
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // 会話の前に席へ。ボブが画面に映っている空き席をタップ → 歩いて座り、アリスの画面でも座っている
  const bobId = await sessionId(bob);
  const me = (await avatars(bob)).find((a) => a.id === bobId)!;
  const seat = (await seats(bob))
    .filter((s) => s.free && s.onScreen)
    .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  await tapWorld(bob, seat.x, seat.y);
  await expect.poll(async () => (await avatars(alice)).find((a) => a.id === bobId)?.seat).toBe(seat.id);
  await expect
    .poll(async () => {
      const b = (await avatars(alice)).find((a) => a.id === bobId)!;
      return Math.hypot(b.x - seat.x, b.y - seat.y) < 2;
    }, { timeout: 15_000 })
    .toBe(true);

  // アリスが会話欄から話しかける → ボブの画面に吹き出しと会話欄の行が出る
  const input = alice.getByLabel("発言");
  await input.fill("こんばんは！今日もおつかれさまです");
  await input.press("Enter");
  await expect(input).toHaveValue("");
  await expect.poll(async () => (await bubbles(bob)).map((b) => b.text)).toContain("こんばんは！今日もおつかれさまです");
  await expect(bob.locator("#chat .log li").last()).toHaveText("アリス こんばんは！今日もおつかれさまです");

  // ボブがアリスの吹き出しをタップして「わかる」→ アリスの画面で反応が数えられる
  // （人と同じく、吹き出しが出きってからタップする）
  await expect.poll(async () => (await bubbles(bob)).find((b) => b.text.startsWith("こんばんは"))?.alpha).toBe(1);
  const bubble = (await bubbles(bob)).find((b) => b.text.startsWith("こんばんは"))!;
  await tapWorld(bob, bubble.x, bubble.y);
  await bob.getByTestId("reaction-picker").getByRole("menuitem", { name: "わかる" }).click();
  await expect
    .poll(async () => (await bubbles(alice)).find((b) => b.id === bubble.id)?.reactions)
    .toEqual({ わかる: 1 });

  // ボブも話して、両方の吹き出しが出ている様子を撮っておく
  await bob.getByLabel("発言").fill("わかります〜。座って一杯いきます");
  await bob.getByLabel("発言").press("Enter");
  await expect.poll(async () => (await bubbles(alice)).length).toBe(2);
  await alice.screenshot({ path: testInfo.outputPath("alice-chat.png") });
  await bob.screenshot({ path: testInfo.outputPath("bob-view.png") });

  await ctxA.close();
  await ctxB.close();
});
