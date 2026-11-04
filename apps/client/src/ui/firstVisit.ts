// はじめて入店した人への短い案内。一度出したら、その端末では次から出さない。

const KEY = "yorunoba:hinted";

function alreadyShown(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markShown() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // 覚えられなくても、案内を出すだけなので困らない
  }
}

/** 会話欄の上に、遊び方を小さく出す（×で閉じる。30秒たったら自動で消える） */
export function showFirstVisitHint() {
  if (alreadyShown()) return;
  markShown();
  const el = document.createElement("aside");
  el.id = "first-visit";
  el.setAttribute("aria-label", "遊び方");
  el.innerHTML = `
    <button type="button" class="x" aria-label="閉じる">×</button>
    <p class="title">🏮 いらっしゃいませ</p>
    <ul>
      <li>床をタップで歩く・椅子をタップで座る</li>
      <li>下の欄から話しかける（発言は保存されません）</li>
      <li>人の吹き出しをタップで「わかる」「笑」</li>
      <li>🍻 で乾杯・右奥の掲示板に今日のお題</li>
    </ul>
  `;
  document.body.append(el);
  const close = () => el.remove();
  el.querySelector(".x")!.addEventListener("click", close);
  window.setTimeout(close, 30_000);
}
