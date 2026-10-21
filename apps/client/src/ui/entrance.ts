import { AVATAR_COLORS, MAX_TAGS, NAME_MAX_LENGTH, TOPIC_TAGS } from "@yorunoba/shared";
import type { Profile } from "../net/connection";

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * 入店画面（のれんの前）。名前・色・ひとこと札を選び、18歳以上を確認してから入店する。
 * 文字入力はcanvasではなくDOMで作る（日本語入力とスマホのキーボードのため）。
 */
export function showEntrance(
  initial: Profile,
  guests: Promise<number | null>,
  onEnter: (profile: Profile) => Promise<void>,
) {
  const root = document.createElement("form");
  root.id = "entrance";
  root.innerHTML = `
    <div class="card">
      <h1 class="brand">ヨルノバ</h1>
      <p class="lead">仕事帰りにふらっと寄れる、<br />テキストだけの居酒屋。</p>
      <p class="guests" data-testid="guests" hidden></p>

      <label class="field">
        <span>名前</span>
        <input name="name" maxlength="${NAME_MAX_LENGTH}" placeholder="名無しの客" autocomplete="nickname" />
      </label>

      <fieldset class="field">
        <legend>色</legend>
        <div class="swatches">
          ${AVATAR_COLORS.map(
            (c) =>
              `<button type="button" class="swatch" data-color="${c}" style="--c:${hex(c)}" aria-label="色 ${hex(c)}"></button>`,
          ).join("")}
        </div>
      </fieldset>

      <fieldset class="field">
        <legend>ひとこと札 <small>（${MAX_TAGS}つまで・話しかけるきっかけに）</small></legend>
        <div class="chips">
          ${TOPIC_TAGS.map((t) => `<button type="button" class="chip" data-tag="${t}">#${t}</button>`).join("")}
        </div>
      </fieldset>

      <label class="adult">
        <input type="checkbox" name="adult" />
        <span>18歳以上です</span>
      </label>

      <button type="submit" class="enter" disabled>のれんをくぐる</button>
      <p class="error" role="alert" hidden></p>
    </div>
  `;
  document.body.append(root);

  const nameInput = root.querySelector<HTMLInputElement>("input[name=name]")!;
  const adult = root.querySelector<HTMLInputElement>("input[name=adult]")!;
  const enter = root.querySelector<HTMLButtonElement>(".enter")!;
  const error = root.querySelector<HTMLParagraphElement>(".error")!;
  const guestsLine = root.querySelector<HTMLParagraphElement>(".guests")!;

  let color = initial.color;
  const tags = new Set<string>(initial.tags);
  nameInput.value = initial.name;

  const render = () => {
    root.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => {
      b.setAttribute("aria-pressed", String(Number(b.dataset.color) === color));
    });
    root.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => {
      const on = tags.has(b.dataset.tag!);
      b.setAttribute("aria-pressed", String(on));
      b.disabled = !on && tags.size >= MAX_TAGS;
    });
    enter.disabled = !adult.checked;
  };

  root.querySelector(".swatches")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".swatch");
    if (b) color = Number(b.dataset.color);
    render();
  });
  root.querySelector(".chips")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".chip");
    if (!b) return;
    const tag = b.dataset.tag!;
    if (tags.has(tag)) tags.delete(tag);
    else if (tags.size < MAX_TAGS) tags.add(tag);
    render();
  });
  adult.addEventListener("change", render);

  root.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!adult.checked) return;
    enter.disabled = true;
    enter.textContent = "入店中…";
    error.hidden = true;
    try {
      await onEnter({ name: nameInput.value.trim(), color, tags: [...tags] });
      root.remove();
    } catch (err) {
      console.error(err);
      error.textContent = "お店につながりませんでした。少し待ってからもう一度どうぞ";
      error.hidden = false;
      enter.textContent = "のれんをくぐる";
      render();
    }
  });

  guests.then((n) => {
    if (n === null) return;
    guestsLine.textContent = n > 0 ? `🏮 いま ${n}人が飲んでる` : "🏮 いまは貸し切り。最初の一杯をどうぞ";
    guestsLine.hidden = false;
  });

  render();
}
