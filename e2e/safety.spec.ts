import { expect, test, type Page } from "@playwright/test";
import { avatars, bringIntoView, bubbles, closeGuestCard, enter, sessionId, tapWorld, waitForEmptyShop } from "./helpers";

/** 相手のアバターをタップして名札カードを開き、通報する */
async function report(page: Page, targetId: string, targetName: string) {
  const card = page.getByRole("dialog");
  // 人と同じく、名札で相手を確かめてから押す。近くの別の客が開いたら、閉じて少しずらしてタップし直す
  const nudges = [{ x: 0, y: 0 }, { x: 0, y: -12 }, { x: 8, y: 6 }];
  for (const nudge of nudges) {
    const target = (await avatars(page)).find((a) => a.id === targetId)!;
    await bringIntoView(page, target.x, target.y, targetId);
    await tapWorld(page, target.x + nudge.x, target.y + nudge.y);
    if ((await card.isVisible()) && (await card.textContent())?.includes(targetName)) break;
    await closeGuestCard(page);
  }
  await expect(card).toContainText(targetName);
  page.once("dialog", (d) => d.accept()); // 「通報しますか？」の確認
  await card.getByRole("button", { name: "通報する" }).click();
  await expect(page.locator("#chat .notice")).toHaveText(/通報を受け付けました/);
}

test("連絡先は送れず、2人から通報されると留置所へ送られ、しばらく入れない", async ({ browser, request }, testInfo) => {
  await waitForEmptyShop(request);
  const pages = await Promise.all(
    ["troll", "bob", "carol"].map(async () => (await browser.newContext(testInfo.project.use)).newPage()),
  );
  const [troll, bob, carol] = pages;
  await enter(troll, "荒らし");
  await enter(bob, "ボブ");
  await enter(carol, "キャロル");
  await expect(bob.locator("#status")).toHaveText("いま店内 3人");

  // 入店画面には利用規約・プライバシーポリシーへのリンクがある
  const terms = await request.get("/terms.html");
  expect(await terms.text()).toContain("利用規約");

  // 連絡先は送れない（本人にだけ注意が出て、ほかの客には何も届かない）
  await troll.getByLabel("発言").fill("LINE ID: troll1234 で話そうよ");
  await troll.getByLabel("発言").press("Enter");
  await expect(troll.locator("#chat .notice")).toHaveText(/連絡先/);
  await bob.waitForTimeout(500);
  expect(await bubbles(bob)).toHaveLength(0);

  // ボブとキャロルが通報 → 荒らしは留置所へ
  const trollId = await sessionId(troll);
  await report(bob, trollId, "荒らし");
  await report(carol, trollId, "荒らし");
  await expect(troll.locator("#jail")).toContainText("店員に連れて行かれました");
  await expect(troll.locator("#jail")).toContainText(/留置所であと \d+分/);
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");
  await troll.screenshot({ path: testInfo.outputPath("jail.png") });

  // 入り直そうとしても断られる
  await troll.goto("/");
  const form = troll.locator("#entrance");
  await form.getByLabel("18歳以上です").check();
  await form.getByRole("button", { name: "のれんをくぐる" }).click();
  await expect(form.getByRole("alert")).toContainText("留置所にいます");

  for (const p of pages) await p.context().close();
});
