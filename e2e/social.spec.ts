import { NOTICE_BOARD } from "@yorunoba/shared";
import { expect, test } from "@playwright/test";
import { bringIntoView, collectErrors, enter, isTappable, sessionId, tapWorld, waitForEmptyShop } from "./helpers";

test("乾杯・来店のお知らせ・お題・はじめての案内で、話すきっかけが作れる", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  const errors = collectErrors(alice, bob);

  // はじめて入ると、遊び方の案内が出る（×で閉じる）
  await enter(alice, "アリス", ["仕事終わり"]);
  const hint = alice.locator("#first-visit");
  await expect(hint).toBeVisible();
  await expect(hint).toContainText("乾杯");
  await hint.getByRole("button", { name: "閉じる" }).click();
  await expect(hint).toHaveCount(0);

  // ボブが来ると、アリスの会話欄に「来店」が出る
  await enter(bob, "ボブ", ["聞き専"]);
  await expect(alice.locator("#chat .log li.system")).toContainText(["🏮 ボブさん（#聞き専）が来店"]);

  // アリスが🍻 → ボブの画面にも乾杯が届く。続けてボブも🍻 → 2人の画面に「かんぱーい！」
  await alice.getByRole("button", { name: "乾杯" }).click();
  await expect.poll(() => bob.evaluate(() => window.__yorunoba!.toasts())).toBe(1);
  await expect(alice.getByRole("button", { name: "乾杯" })).toBeDisabled(); // 連打はできない
  await bob.getByRole("button", { name: "乾杯" }).click();
  await expect(alice.locator("#kanpai")).toBeVisible();
  await expect(bob.locator("#kanpai")).toBeVisible();
  await bob.screenshot({ path: testInfo.outputPath("kanpai.png") });

  // 掲示板をタップ → 今日のお題。選ぶと会話欄に入る（送るかは本人が決める）
  const board = { x: NOTICE_BOARD.x + NOTICE_BOARD.w / 2, y: NOTICE_BOARD.y + NOTICE_BOARD.h * 0.7 };
  await bringIntoView(bob, board.x, board.y);
  expect(await isTappable(bob, board.x, board.y)).toBe(true);
  await tapWorld(bob, board.x, board.y);
  const card = bob.getByRole("dialog", { name: "📋 今日のお題" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("listitem")).toHaveCount(3);
  await bob.screenshot({ path: testInfo.outputPath("topics.png") });
  const first = (await card.getByRole("listitem").first().textContent())!;
  await card.getByRole("listitem").first().getByRole("button").click();
  await expect(card).toHaveCount(0);
  await expect(bob.getByLabel("発言")).toHaveValue(first);

  // 案内は一度きり：アリスが入り直しても、もう出ない
  const aliceId = await sessionId(alice);
  await enter(alice, "アリス", ["仕事終わり"]);
  expect(await sessionId(alice)).not.toBe(aliceId);
  await alice.waitForTimeout(1_000);
  await expect(alice.locator("#first-visit")).toHaveCount(0);

  // アリスが帰ると、ボブの会話欄に「お帰り」が出る
  await ctxA.close();
  await expect(bob.locator("#chat .log li.system").last()).toHaveText("アリスさんがお帰りになりました", { timeout: 30_000 });

  expect(errors).toEqual([]);
  await ctxB.close();
});
