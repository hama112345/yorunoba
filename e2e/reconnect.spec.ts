import { expect, test } from "@playwright/test";
import { bubbles, collectErrors, enter, waitForEmptyShop } from "./helpers";

test("電波が途切れても、つなぎ直して同じ客のまま続けられる", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();
  const errors = collectErrors(alice, bob);
  await enter(alice, "アリス");
  await enter(bob, "ボブ");
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");
  // 入店した直後は自動でつなぎ直さない決まり（SDKの最低5秒）なので、少し飲んでから
  await alice.waitForTimeout(5_500);

  // アリスの電波が途切れる（地下鉄・アプリの切り替えなど）
  await ctxA.setOffline(true);
  await expect(alice.locator("#status")).toHaveText("📶 つなぎ直し中…");
  // ボブの画面では、アリスはまだ店にいる（30秒は席を残す）
  await bob.waitForTimeout(2_000);
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // 電波が戻ると、入り直さなくても続きから
  await ctxA.setOffline(false);
  await expect(alice.locator("#status")).toHaveText("いま店内 2人", { timeout: 20_000 });
  await expect(alice.locator("#goodbye")).toHaveCount(0);
  const input = alice.getByLabel("発言");
  await input.fill("ただいま、電波が切れてました");
  await input.press("Enter");
  await expect.poll(async () => (await bubbles(bob)).map((b) => b.text)).toContain("ただいま、電波が切れてました");

  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});
