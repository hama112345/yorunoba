import {
  AVATAR_COLORS,
  CLOSE_HOUR,
  LAST_ORDER,
  MAX_TAGS,
  NAME_MAX_LENGTH,
  OPEN_HOUR,
  TOPIC_TAGS,
  type ShopStatus,
} from "@yorunoba/shared";
import { track } from "../analytics";
import type { Profile } from "../net/connection";
import { WAITLIST_URL } from "./regularsPass";

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const pad = (n: number) => String(n).padStart(2, "0");
const HOURS_TEXT = `営業 ${OPEN_HOUR}:00〜${CLOSE_HOUR}:00（日本時間・ラストオーダー ${LAST_ORDER.hour}:${pad(LAST_ORDER.minute)}）`;

/** 「あと3時間12分」 */
function untilText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(minutes / 60);
  return h > 0 ? `あと${h}時間${minutes % 60}分` : `あと${minutes}分`;
}

/**
 * 入店画面（のれんの前）。名前・色・ひとこと札を選び、18歳以上を確認してから入店する。
 * 文字入力はcanvasではなくDOMで作る（日本語入力とスマホのキーボードのため）。
 */
export function showEntrance(
  initial: Profile,
  status: Promise<ShopStatus | null>,
  onEnter: (profile: Profile) => Promise<void>,
) {
  const root = document.createElement("form");
  root.id = "entrance";
  root.innerHTML = `
    <div class="card">
      <h1 class="brand">ヨルノバ</h1>
      <p class="lead">仕事帰りにふらっと寄れる、<br />テキストだけの居酒屋。</p>
      <p class="guests" data-testid="guests" hidden></p>
      <p class="hours" data-testid="hours">${HOURS_TEXT}</p>
      <div class="closed" data-testid="closed" hidden>
        <p class="closed-title">🌙 ただいま準備中</p>
        <p class="closed-until"></p>
        ${WAITLIST_URL ? `<a class="waitlist" target="_blank" rel="noopener">開店や新しいお知らせを受け取る</a>` : ""}
      </div>

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
      <p class="terms">
        入店すると<a href="/terms.html" target="_blank" rel="noopener">利用規約</a>と<a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>に同意したものとみなします。発言は保存されません。
      </p>

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
  const hoursLine = root.querySelector<HTMLParagraphElement>(".hours")!;
  const closed = root.querySelector<HTMLDivElement>(".closed")!;
  const closedUntil = root.querySelector<HTMLParagraphElement>(".closed-until")!;
  const waitlist = root.querySelector<HTMLAnchorElement>(".waitlist");
  if (waitlist && WAITLIST_URL) waitlist.href = WAITLIST_URL;
  waitlist?.addEventListener("click", () => track("waitlist_clicked", { from: "closed" }));

  // 営業時間外（入店禁止が有効なとき）は、開店時刻まで入店ボタンを押せなくする
  let opensAt: number | null = null;

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
    const isClosed = opensAt !== null && Date.now() < opensAt;
    closed.hidden = !isClosed;
    if (isClosed) closedUntil.textContent = `次の開店は ${OPEN_HOUR}:00（${untilText(opensAt! - Date.now())}）`;
    if (!enter.dataset.busy) enter.textContent = isClosed ? `${OPEN_HOUR}:00 開店` : "のれんをくぐる";
    enter.disabled = !adult.checked || isClosed || Boolean(enter.dataset.busy);
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
    if (enter.disabled) return;
    enter.dataset.busy = "1";
    enter.disabled = true;
    enter.textContent = "入店中…";
    error.hidden = true;
    try {
      await onEnter({ name: nameInput.value.trim(), color, tags: [...tags] });
      root.remove();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "";
      error.textContent = message.includes("留置所")
        ? `🚨 ${message}`
        : message.includes("営業時間外")
          ? `🌙 ${message}`
          : "お店につながりませんでした。少し待ってからもう一度どうぞ";
      error.hidden = false;
      delete enter.dataset.busy;
      render();
    }
  });

  status.then((s) => {
    if (!s) return;
    if (s.phase === "closed") track("closed_page_view", { enforced: s.enforced });
    if (s.phase === "closed" && s.enforced) {
      opensAt = s.nextOpeningAt;
      const timer = window.setInterval(() => {
        if (!root.isConnected) return window.clearInterval(timer);
        render();
      }, 30_000);
    } else {
      const n = s.guests;
      guestsLine.textContent = n > 0 ? `🏮 いま ${n}人が飲んでる` : "🏮 いまは貸し切り。最初の一杯をどうぞ";
      guestsLine.hidden = false;
      if (s.phase === "last_order") hoursLine.textContent = `${HOURS_TEXT}\n🍶 まもなくラストオーダーです`;
      else if (s.phase === "closed") hoursLine.textContent = `${HOURS_TEXT}\nいまは試験営業中のため、時間外も開けています`;
    }
    render();
  });

  render();
}
