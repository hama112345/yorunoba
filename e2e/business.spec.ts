import { expect, test } from "@playwright/test";
import { enter, waitForEmptyShop } from "./helpers";

const events = (page: import("@playwright/test").Page) => page.evaluate(() => window.__yorunobaEvents ?? []);

test("常連パス（準備中）・友だちを誘う・計測に発言の本文が入らない", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const ctx = await browser.newContext(testInfo.project.use);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();

  // 入店画面に営業時間が出ている。計測：開いた（流入元つき）
  await page.goto("/?utm_source=x&utm_campaign=test");
  await expect(page.getByTestId("hours")).toContainText("21:00");
  const view = (await events(page)).find((e) => e.event === "page_view")!;
  expect(view.props).toMatchObject({ utm_source: "x", utm_campaign: "test" });

  // 計測：入店した
  await enter(page, "テスター", ["お酒好き"]);
  await expect.poll(async () => (await events(page)).map((e) => e.event)).toEqual(
    expect.arrayContaining(["page_view", "room_joined"]),
  );

  // 発言の計測は文字数だけ（本文は入らない）
  const input = page.getByLabel("発言");
  await input.fill("ひみつの話");
  await input.press("Enter");
  await expect.poll(async () => (await events(page)).find((e) => e.event === "chat_sent")?.props).toEqual({
    length: 5,
    nth: 1,
  });
  expect(JSON.stringify(await events(page))).not.toContain("ひみつ");

  // 常連パス（準備中）→ 説明と「いくらなら？」→ 1つ選ぶとお礼 → 閉じる
  await page.getByRole("button", { name: "🎫 常連パス" }).click();
  const pass = page.getByRole("dialog", { name: /常連パス/ });
  await expect(pass).toBeVisible();
  await expect(pass).toContainText("480");
  await page.screenshot({ path: testInfo.outputPath("regulars-pass.png") });
  await pass.getByRole("button", { name: "480円ならアリ" }).click();
  await expect(pass.getByText("ありがとうございます")).toBeVisible();
  await pass.getByRole("button", { name: "閉じる" }).click();
  await expect(pass).toBeHidden();
  const names = (await events(page)).map((e) => e.event);
  expect(names).toContain("paywall_clicked");
  expect((await events(page)).find((e) => e.event === "paywall_answered")?.props).toEqual({ answer: "480円ならアリ" });

  // 友だちを誘う → 招待用URLがコピーされる（共有メニューが無い環境）
  await page.getByRole("button", { name: "📨 誘う" }).click();
  await expect(page.locator("#chat .notice")).toContainText("URLをコピーしました");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("utm_source=invite");
  expect((await events(page)).find((e) => e.event === "invite_clicked")?.props).toEqual({ method: "copy" });

  await page.screenshot({ path: testInfo.outputPath("shop-with-actions.png") });
  await ctx.close();
});
