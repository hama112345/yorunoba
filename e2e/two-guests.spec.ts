import { expect, test, type Page } from "@playwright/test";

const avatars = (page: Page) => page.evaluate(() => window.__yorunoba?.avatars() ?? []);
const sessionId = (page: Page) => page.evaluate(() => window.__yorunoba?.sessionId ?? "");

/** のれんの前（入店画面）で名前・ひとこと札を入れて入店する */
async function enter(page: Page, name: string, tags: string[]) {
  await page.goto("/");
  const form = page.locator("#entrance");
  await expect(form.getByRole("button", { name: "のれんをくぐる" })).toBeDisabled();
  await form.getByPlaceholder("名無しの客").fill(name);
  for (const tag of tags) await form.getByRole("button", { name: `#${tag}` }).click();
  await form.getByLabel("18歳以上です").check();
  await form.getByRole("button", { name: "のれんをくぐる" }).click();
  await expect(form).toBeHidden();
}

test("2人の客が入店画面から入り、ひとこと札とお互いの移動が見える", async ({ browser, request }, testInfo) => {
  // 店は1つを共有しているので、前のテストの客が帰りきってから始める
  // （公開中の店で流すときは、客のいない時間帯に流すこと）
  await expect
    .poll(async () => (await (await request.get("/api/status")).json()).guests, { timeout: 20_000 })
    .toBe(0);

  const ctxA = await browser.newContext(testInfo.project.use);
  const ctxB = await browser.newContext(testInfo.project.use);
  const alice = await ctxA.newPage();
  const bob = await ctxB.newPage();

  await enter(alice, "アリス", ["サッカー", "仕事終わり"]);

  // ボブは入店前に「いま1人が飲んでる」が見える
  await bob.goto("/");
  await expect(bob.getByTestId("guests")).toHaveText(/いま 1人が飲んでる/);
  await bob.screenshot({ path: testInfo.outputPath("entrance.png") });
  await enter(bob, "ボブ", ["聞き専"]);

  await expect(alice.locator("#status")).toHaveText("いま店内 2人");
  await expect(bob.locator("#status")).toHaveText("いま店内 2人");

  // ボブの画面で、アリスのひとこと札が見える
  const aliceId = await sessionId(alice);
  await expect
    .poll(async () => (await avatars(bob)).find((a) => a.id === aliceId)?.tags)
    .toEqual(["サッカー", "仕事終わり"]);

  // 自分のアバターが画面内に映っている（スマホ縦でもカメラが追いかける）
  expect(await alice.evaluate(() => window.__yorunoba?.isSelfOnScreen())).toBe(true);

  // アリスが自分の画面に映っている範囲（左上の床）をタップ → ボブの画面でもアリスがそこへ歩いていく
  // スマホ縦では自分の周りしか映らないので、目的地は自分の位置から決める
  const start = (await avatars(alice)).find((a) => a.id === aliceId)!;
  const target = { x: start.x - 120, y: start.y - 200 };
  await tapWorld(alice, target.x, target.y);

  await expect
    .poll(
      async () => {
        const a = (await avatars(bob)).find((a) => a.id === aliceId);
        return !!a && Math.abs(a.x - target.x) < 30 && Math.abs(a.y - target.y) < 30;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(await alice.evaluate(() => window.__yorunoba?.isSelfOnScreen())).toBe(true);

  await bob.screenshot({ path: testInfo.outputPath("bob-view.png") });
  await alice.screenshot({ path: testInfo.outputPath("alice-view.png") });

  // アリスが帰るとボブの店内人数が減る
  await ctxA.close();
  await expect(bob.locator("#status")).toHaveText("いま店内 1人");
  await ctxB.close();
});

/** 店の座標(x, y)を、いまのカメラの映し方で画面上の位置に直してタップする */
async function tapWorld(page: Page, x: number, y: number) {
  const pos = await page.evaluate(({ x, y }) => window.__yorunoba!.worldToScreen(x, y), { x, y });
  await page.mouse.click(pos.x, pos.y);
}
