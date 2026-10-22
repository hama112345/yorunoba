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

/** 店の座標(x, y)が画面に映っていて、その上にボタンや会話欄が重なっていない（指で押せる）か */
export async function isTappable(page: Page, x: number, y: number) {
  return page.evaluate(({ x, y }) => {
    const p = window.__yorunoba!.worldToScreen(x, y);
    return document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS";
  }, { x, y });
}

/** 店の座標(x, y)を、いまのカメラの映し方で画面上の位置に直してタップする */
export async function tapWorld(page: Page, x: number, y: number) {
  const pos = await page.evaluate(({ x, y }) => window.__yorunoba!.worldToScreen(x, y), { x, y });
  await page.mouse.click(pos.x, pos.y);
}

/**
 * 相手が画面の外（またはボタンや会話欄の下）にいたら、人と同じようにそちらへ歩いて画面に入れる。
 * スマホ縦はカメラが自分を追いかけるので、出現位置によっては相手が見えないことがある
 */
export async function bringIntoView(page: Page, x: number, y: number, id?: string) {
  const vp = page.viewportSize()!;
  for (let i = 0; i < 6; i++) {
    const p = await page.evaluate(({ x, y }) => window.__yorunoba!.worldToScreen(x, y), { x, y });
    // 上はHUDと常連パス・誘うボタン、下は会話欄があるので避ける
    const [top, bottom] = [110, vp.height - 150];
    if (p.x > 30 && p.x < vp.width - 30 && p.y > top && p.y < bottom) break;
    // 画面の端に相手の札が出ていれば、それを押して近づく（ほかの客を間違えて押さない）
    // （札は歩いている間も動き続けるので、いまの位置をそのまま押す）
    const markers = page.locator(`.edge-marker[data-id="${id}"]`);
    const marker = id && (await markers.count()) > 0 ? await markers.boundingBox({ timeout: 1000 }).catch(() => null) : null;
    if (marker) await page.mouse.click(marker.x + marker.width / 2, marker.y + marker.height / 2);
    else await page.mouse.click(Math.min(Math.max(p.x, 40), vp.width - 40), Math.min(Math.max(p.y, top + 10), bottom - 10));
    await page.waitForTimeout(800);
  }
  await closeGuestCard(page); // 近づく途中でほかの客を押して名札カードが開いていたら閉じる
}

/** 開いている名札カードを閉じる（カードの下にいる客をタップできなくなるため） */
export async function closeGuestCard(page: Page) {
  const close = page.getByRole("dialog").getByRole("button", { name: "閉じる" });
  if (await close.isVisible()) await close.click();
}
