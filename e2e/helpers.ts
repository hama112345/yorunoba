import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const avatars = (page: Page) => page.evaluate(() => window.__yorunoba?.avatars() ?? []);
export const bubbles = (page: Page) => page.evaluate(() => window.__yorunoba?.bubbles() ?? []);
export const seats = (page: Page) => page.evaluate(() => window.__yorunoba?.seats() ?? []);
export const sessionId = (page: Page) => page.evaluate(() => window.__yorunoba?.sessionId ?? "");

/** 店は1つを共有しているので、前のテストの客が帰りきってから始める（公開中の店では客のいない時間帯に流す） */
export async function waitForEmptyShop(request: APIRequestContext) {
  await expect
    .poll(async () => (await (await request.get("/api/status")).json()).guests, { timeout: 20_000 })
    .toBe(0);
}

/** のれんの前（入店画面）で名前・ひとこと札を入れて入店する */
export async function enter(page: Page, name: string, tags: string[] = []) {
  await page.goto("/");
  const form = page.locator("#entrance");
  await expect(form.getByRole("button", { name: "のれんをくぐる" })).toBeDisabled();
  await form.getByPlaceholder("名無しの客").fill(name);
  for (const tag of tags) await form.getByRole("button", { name: `#${tag}` }).click();
  await form.getByLabel("18歳以上です").check();
  await form.getByRole("button", { name: "のれんをくぐる" }).click();
  await expect(form).toBeHidden();
}

/** 店の座標(x, y)を、いまのカメラの映し方で画面上の位置に直してタップする */
export async function tapWorld(page: Page, x: number, y: number) {
  const pos = await page.evaluate(({ x, y }) => window.__yorunoba!.worldToScreen(x, y), { x, y });
  await page.mouse.click(pos.x, pos.y);
}
