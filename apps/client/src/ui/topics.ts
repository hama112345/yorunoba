import { todaysTopics } from "@yorunoba/shared";

let current: HTMLElement | null = null;

/**
 * 掲示板の「今日のお題」。押すと会話欄にそのお題が入る（送るかどうかは本人が決める）。
 * お題は日付で決まるので、店にいる全員が同じものを見ている
 */
export function showTopicsCard(onPick: (topic: string) => void) {
  closeTopicsCard();
  const root = document.createElement("div");
  root.className = "modal";
  root.id = "topics";
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "topics-title");
  card.innerHTML = `
    <h2 id="topics-title">📋 今日のお題</h2>
    <p class="lead">話しかけるきっかけにどうぞ。押すと会話欄に入ります。</p>
    <ul class="list"></ul>
    <button type="button" class="close">閉じる</button>
  `;
  const list = card.querySelector("ul")!;
  for (const topic of todaysTopics()) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = topic;
    b.addEventListener("click", () => {
      onPick(topic);
      closeTopicsCard();
    });
    li.append(b);
    list.append(li);
  }
  root.append(card);
  document.body.append(root);
  current = root;
  card.querySelector(".close")!.addEventListener("click", closeTopicsCard);
  root.addEventListener("click", (e) => {
    if (e.target === root) closeTopicsCard();
  });
}

export function closeTopicsCard() {
  current?.remove();
  current = null;
}
