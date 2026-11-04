import { expect, test } from "@playwright/test";
import { collectErrors, enter, waitForEmptyShop } from "./helpers";

const events = (page: import("@playwright/test").Page) => page.evaluate(() => window.__yorunobaEvents ?? []);

test("お会計で「また来たい？」に答えて店を出ると、またのお越しを画面になり、入り直せる", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  const errors = collectErrors(alice, bob);
  await enter(alice, "アリス");
  await enter(bob, "ボブ");
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // 「もう少し飲む」なら何も起きない
  await alice.getByRole("button", { name: "🧾 お会計" }).click();
  const checkout = alice.getByRole("dialog", { name: "🧾 お会計" });
  await expect(checkout).toBeVisible();
  await checkout.getByRole("button", { name: "もう少し飲む" }).click();
  await expect(checkout).toHaveCount(0);
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // 答えて帰る → 計測は選んだ答えと滞在秒数だけ
  await alice.getByRole("button", { name: "🧾 お会計" }).click();
  await expect(checkout).toBeVisible();
  await alice.screenshot({ path: testInfo.outputPath("checkout.png") });
  await checkout.getByRole("button", { name: "また来たい" }).click();
  const goodbye = alice.getByRole("dialog", { name: "🏮 ありがとうございました" });
  await expect(goodbye).toBeVisible();
  await alice.screenshot({ path: testInfo.outputPath("goodbye.png") });
  const sent = await events(alice);
  expect(sent.find((e) => e.event === "exit_survey")?.props).toEqual({ answer: "また来たい" });
  expect(sent.find((e) => e.event === "room_left")?.props).toMatchObject({ via: "checkout" });

  // ボブの画面からアリスがすぐいなくなる（幽霊が残らない）
  await expect(bob.locator("#status")).toHaveText("いま店内 1人", { timeout: 10_000 });
  await expect(bob.locator("#chat .log li.system").last()).toHaveText("アリスさんがお帰りになりました");

  // 「もう一度入る」で入店画面に戻る（名前は覚えている）
  await goodbye.getByRole("button", { name: "もう一度入る" }).click();
  await expect(alice.locator("#entrance")).toBeVisible();
  await expect(alice.getByPlaceholder("名無しの客")).toHaveValue("アリス");

  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
