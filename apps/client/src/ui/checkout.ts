import { track } from "../analytics";

/** 「また来たい？」の選択肢。押したものだけを数える（自由記述は取らない） */
export const COME_BACK_ANSWERS = ["また来たい", "どちらでもない", "たぶん来ない"] as const;

let current: HTMLElement | null = null;

/**
 * お会計（店を出る）。帰る前に「また来たいと思いましたか？」を1問だけ聞く（答えなくても帰れる）。
 * onLeave を呼ぶと店を出る（その後は「またのお越しを」の画面）
 */
export function showCheckout(onLeave: () => void) {
  closeCheckout();
  const root = document.createElement("div");
  root.className = "modal";
  root.id = "checkout";
  root.innerHTML = `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <h2 id="checkout-title">🧾 お会計</h2>
      <p class="lead">今夜はありがとうございました。帰る前にひとつだけ。</p>
      <p class="ask">また来たいと思いましたか？</p>
      <div class="answers">
        ${COME_BACK_ANSWERS.map((a) => `<button type="button" data-answer="${a}">${a}</button>`).join("")}
      </div>
      <button type="button" class="skip">答えずに帰る</button>
      <button type="button" class="close">もう少し飲む</button>
    </div>
  `;
  document.body.append(root);
  current = root;

  const leave = () => {
    closeCheckout();
    onLeave();
  };
  root.querySelector(".answers")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-answer]");
    if (!b) return;
    track("exit_survey", { answer: b.dataset.answer! });
    leave();
  });
  root.querySelector(".skip")!.addEventListener("click", leave);
  root.querySelector(".close")!.addEventListener("click", closeCheckout);
  root.addEventListener("click", (e) => {
    if (e.target === root) closeCheckout();
  });
}

export function closeCheckout() {
  current?.remove();
  current = null;
}
