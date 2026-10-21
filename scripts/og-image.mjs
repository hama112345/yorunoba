// SNSで共有されたときに出る画像（OGP、1200×630）を、実際の店の画面から作る。
// 絵を差し替えたら作り直す：  npm run build && npm start  を動かした状態で  node scripts/og-image.mjs
// 店に3人入って話している様子を撮り、上に店名を重ねて apps/client/public/og.png に保存する。

import { chromium } from "@playwright/test";

const BASE = process.env.OG_BASE_URL ?? "http://localhost:2567";
const OUT = new URL("../apps/client/public/og.png", import.meta.url).pathname;
const SIZE = { width: 1200, height: 630 };

const guests = [
  { name: "たろう", tags: ["仕事終わり"], line: "今日もおつかれさまです！" },
  { name: "みさき", tags: ["お酒好き"], line: "とりあえず生で🍺" },
  { name: "けん", tags: ["サッカー"], line: "昨日の試合みました？" },
];

const browser = await chromium.launch();
const pages = [];
for (const g of guests) {
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  await page.goto(BASE);
  const form = page.locator("#entrance");
  await form.getByPlaceholder("名無しの客").fill(g.name);
  for (const t of g.tags) await form.getByRole("button", { name: `#${t}` }).click();
  await form.getByLabel("18歳以上です").check();
  await form.getByRole("button", { name: "のれんをくぐる" }).click();
  await form.waitFor({ state: "hidden" });
  pages.push(page);
}

// 3人で少し歩いて、カウンター寄りに集まってから話す
const spots = [
  { x: 380, y: 300 },
  { x: 470, y: 330 },
  { x: 560, y: 300 },
];
for (const [i, page] of pages.entries()) {
  const pos = await page.evaluate(({ x, y }) => window.__yorunoba.worldToScreen(x, y), spots[i]);
  await page.mouse.click(pos.x, pos.y);
}
await pages[0].waitForTimeout(2500);
for (const [i, page] of pages.entries()) {
  await page.getByLabel("発言").fill(guests[i].line);
  await page.getByLabel("発言").press("Enter");
  await page.waitForTimeout(400);
}
await pages[0].waitForTimeout(1200);

// 撮る画面：HUD・会話欄を隠し、店名の帯を重ねる
const shot = pages[0];
await shot.addStyleTag({
  content: `
    #hud, #actions, #chat { display: none !important; }
    #og-title {
      position: fixed; left: 0; right: 0; bottom: 0; padding: 22px 40px 26px;
      background: linear-gradient(transparent, rgba(10, 6, 14, 0.92) 35%);
      color: #f6eadb; font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
    }
    #og-title h1 { margin: 0; font-size: 64px; color: #e8a33d; letter-spacing: 0.08em; }
    #og-title p { margin: 6px 0 0; font-size: 30px; }
  `,
});
await shot.evaluate(() => {
  const el = document.createElement("div");
  el.id = "og-title";
  el.innerHTML = "<h1>ヨルノバ</h1><p>仕事帰りにふらっと寄れる、テキストだけの居酒屋</p>";
  document.body.append(el);
});
await shot.waitForTimeout(300);
await shot.screenshot({ path: OUT });
console.log(`saved ${OUT}`);
await browser.close();
