import { track } from "../analytics";

/**
 * 常連パス（準備中）の案内。実際の支払いはまだ無く、「押した人の割合」と「いくらなら払うか」を測るための入口。
 * 事前登録フォームのURL（VITE_WAITLIST_URL）があれば「お知らせを受け取る」を出す。
 */
export const WAITLIST_URL = (() => {
  const url = import.meta.env.VITE_WAITLIST_URL as string | undefined;
  return url && /^https:\/\//.test(url) ? url : undefined;
})();

/** 「いくらなら払う？」の選択肢。押したものだけを数える（自由記述は取らない） */
export const PRICE_ANSWERS = ["払わない", "〜300円", "480円ならアリ", "もっと払える"] as const;

let current: HTMLElement | null = null;

export function showRegularsPass() {
  closeRegularsPass();
  track("paywall_clicked");

  const root = document.createElement("div");
  root.className = "modal";
  root.id = "regulars-pass";
  root.innerHTML = `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="pass-title">
      <h2 id="pass-title">🎫 常連パス <small>（準備中）</small></h2>
      <p class="price">月 <b>480</b> 円を予定しています</p>
      <ul class="perks">
        <li>🍶 <b>マイ徳利</b>：名札に自分のボトルが付く（キープボトル）</li>
        <li>🪑 <b>常連席</b>：混んでいても座れる席</li>
        <li>🎨 <b>名札の色・飾り</b>が増える</li>
        <li>🏮 お店の運営（見回り・サーバー代）を支える</li>
      </ul>
      <p class="ask">正直なところ、いくらなら入りますか？</p>
      <div class="answers">
        ${PRICE_ANSWERS.map((a) => `<button type="button" data-answer="${a}">${a}</button>`).join("")}
      </div>
      <p class="thanks" role="status" hidden>ありがとうございます。参考にします 🍻</p>
      ${
        WAITLIST_URL
          ? `<a class="waitlist" target="_blank" rel="noopener">始まったらお知らせを受け取る</a>`
          : `<p class="later">始まるときは、店内でお知らせします。</p>`
      }
      <button type="button" class="close">閉じる</button>
    </div>
  `;
  document.body.append(root);
  current = root;

  const thanks = root.querySelector<HTMLParagraphElement>(".thanks")!;
  root.querySelector(".answers")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-answer]");
    if (!b) return;
    track("paywall_answered", { answer: b.dataset.answer! });
    root.querySelectorAll<HTMLButtonElement>(".answers button").forEach((x) => {
      x.disabled = true;
      x.setAttribute("aria-pressed", String(x === b));
    });
    thanks.hidden = false;
  });
  const waitlist = root.querySelector<HTMLAnchorElement>(".waitlist");
  if (waitlist && WAITLIST_URL) waitlist.href = WAITLIST_URL;
  waitlist?.addEventListener("click", () => track("waitlist_clicked", { from: "regulars_pass" }));
  root.querySelector(".close")!.addEventListener("click", closeRegularsPass);
  // カードの外側（暗い部分）をタップしても閉じる
  root.addEventListener("click", (e) => {
    if (e.target === root) closeRegularsPass();
  });
}

export function closeRegularsPass() {
  current?.remove();
  current = null;
}
