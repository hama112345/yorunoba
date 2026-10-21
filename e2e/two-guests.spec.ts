import { expect, test, type Page } from "@playwright/test";

const avatars = (page: Page) => page.evaluate(() => window.__yorunoba?.avatars() ?? []);
const sessionId = (page: Page) => page.evaluate(() => window.__yorunoba?.sessionId ?? "");

test("2人の客が同じ店に入り、お互いの移動が見える", async ({ browser }, testInfo) => {
  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  await alice.goto("/?name=アリス");
  await bob.goto("/?name=ボブ");

  await expect(alice.locator("#status")).toHaveText("いま店内 2人");
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // アリスが店の左上あたりをタップ → ボブの画面でもアリスがそこへ歩いていく
  const canvas = alice.locator("#game canvas");
  const box = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: box.width * 0.25, y: box.height * 0.45 } });

  const aliceId = await sessionId(alice);
  await expect
    .poll(async () => (await avatars(bob)).find((a) => a.id === aliceId), { timeout: 10_000 })
    .toMatchObject({ x: expect.any(Number) });
  await expect
    .poll(async () => {
      const a = (await avatars(bob)).find((a) => a.id === aliceId)!;
      return Math.abs(a.x - 240) < 30 && Math.abs(a.y - 288) < 30;
    }, { timeout: 10_000 })
    .toBe(true);

  await bob.screenshot({ path: testInfo.outputPath("bob-view.png") });

  // アリスが帰るとボブの店内人数が減る
  await ctxA.close();
  await expect(bob.locator("#status")).toHaveText("いま店内 1人");
  await ctxB.close();
});
