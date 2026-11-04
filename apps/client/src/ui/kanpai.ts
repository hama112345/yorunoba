/** 乾杯が重なったと見なす時間（この間に2人以上が乾杯したら「かんぱーい！」） */
const WINDOW_MS = 8_000;

/**
 * 誰かが乾杯したら呼ぶ。8秒以内に2人以上が乾杯したら、画面の真ん中に「🍻 かんぱーい！」を一瞬出す。
 * 1人の乾杯に、ほかの人が乗っかる楽しさを作る（店にいる全員の画面に同じように出る）
 */
export function createKanpaiDetector() {
  const recent = new Map<string, number>();
  let lastShownAt = -Infinity;
  return (from: string, now = Date.now()) => {
    for (const [who, at] of recent) if (now - at > WINDOW_MS) recent.delete(who);
    recent.set(from, now);
    if (recent.size < 2 || now - lastShownAt < WINDOW_MS) return false;
    lastShownAt = now;
    showKanpai();
    return true;
  };
}

function showKanpai() {
  document.getElementById("kanpai")?.remove();
  const el = document.createElement("div");
  el.id = "kanpai";
  el.setAttribute("aria-hidden", "true");
  el.textContent = "🍻 かんぱーい！";
  document.body.append(el);
  window.setTimeout(() => el.remove(), 1_700);
}
