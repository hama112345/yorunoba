import { REACTIONS, type Reaction } from "@yorunoba/shared";

let current: HTMLElement | null = null;

/** 吹き出しをタップしたときに出る「わかる／笑／へぇ」の小さな選択肢 */
export function showReactionPicker(screenX: number, screenY: number, onPick: (kind: Reaction) => void) {
  closeReactionPicker();
  const el = document.createElement("div");
  el.className = "reaction-picker";
  el.setAttribute("role", "menu");
  el.dataset.testid = "reaction-picker";
  el.innerHTML = REACTIONS.map(
    (r) => `<button type="button" role="menuitem" data-kind="${r}">${r}</button>`,
  ).join("");
  document.body.append(el);

  // 指の少し上に出す。画面の外にはみ出さないように寄せる
  const { width, height } = el.getBoundingClientRect();
  const x = Math.min(Math.max(8, screenX - width / 2), window.innerWidth - width - 8);
  const y = Math.max(8, screenY - height - 16);
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  el.addEventListener("click", (e) => {
    const kind = (e.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset.kind;
    if (kind) onPick(kind as Reaction);
    closeReactionPicker();
  });
  // ほかの場所を触ったら閉じる（この操作自体で閉じないよう、次の操作から受け付ける）
  setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 0);
  current = el;
}

export function closeReactionPicker() {
  current?.remove();
  current = null;
  document.removeEventListener("pointerdown", onOutside, true);
}

function onOutside(e: PointerEvent) {
  if (current && !current.contains(e.target as Node)) closeReactionPicker();
}
