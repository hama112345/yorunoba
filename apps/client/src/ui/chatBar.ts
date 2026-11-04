import { CHAT_MAX_LENGTH } from "@yorunoba/shared";

/** 会話欄に残す行数と、1行が消えるまでの時間（どこにも保存しない） */
const LOG_LINES = 5;
const LOG_LIFETIME_MS = 60_000;

export interface ChatBar {
  addLine(name: string, text: string, isSelf: boolean, id?: number): void;
  /** AI店員が消した発言を「おしぼりで拭きました」に置き換える */
  wipe(id: number): void;
  notice(text: string): void;
  /** 店からのお知らせ（開店・ラストオーダーなど）。普通の発言と見分けがつくように出す */
  announce(text: string): void;
  /** お題（店が静かなときの話のきっかけ） */
  topic(text: string): void;
  /** 来店・お帰りなど、店の様子の小さなお知らせ */
  system(text: string): void;
  /** 入力欄に文を入れる（お題を選んだとき。送るかどうかは本人が決める） */
  fill(text: string): void;
}

/** 乾杯ボタンを続けて押せない時間（サーバーの制限と同じ） */
const TOAST_COOLDOWN_MS = 8_000;

/**
 * 画面下の会話欄。入力はDOMで作る（日本語入力とスマホのキーボードのため）。
 * 直近の数行だけ表示し、1分で消える。吹き出しを見逃した人のための補助で、記録ではない。
 */
export function showChatBar(onSend: (text: string) => void, onToast: () => void): ChatBar {
  const root = document.createElement("section");
  root.id = "chat";
  root.innerHTML = `
    <ol class="log" aria-live="polite" aria-label="最近の会話（1分で消えます）"></ol>
    <p class="notice" role="status" hidden></p>
    <form class="bar">
      <button type="button" class="toast" aria-label="乾杯" title="乾杯">🍻</button>
      <input name="text" maxlength="${CHAT_MAX_LENGTH}" placeholder="ひとこと話しかける…" autocomplete="off" enterkeyhint="send" aria-label="発言" />
      <button type="submit">送る</button>
    </form>
  `;
  document.body.append(root);

  const log = root.querySelector<HTMLOListElement>(".log")!;
  const noticeEl = root.querySelector<HTMLParagraphElement>(".notice")!;
  const form = root.querySelector<HTMLFormElement>(".bar")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const toastButton = form.querySelector<HTMLButtonElement>("button.toast")!;
  toastButton.addEventListener("click", () => {
    onToast();
    // 連打しても届かないので、少しのあいだ押せなくする
    toastButton.disabled = true;
    window.setTimeout(() => (toastButton.disabled = false), TOAST_COOLDOWN_MS);
  });

  // 日本語の変換を確定するEnterで送信しない
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.isComposing || e.keyCode === 229)) e.preventDefault();
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    onSend(text);
    input.value = "";
  });

  // スマホでキーボードが出たら、会話欄をキーボードの上に持ち上げる
  const vv = window.visualViewport;
  if (vv) {
    const lift = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.bottom = `${keyboard}px`;
    };
    vv.addEventListener("resize", lift);
    vv.addEventListener("scroll", lift);
  }

  let noticeTimer: number | undefined;

  /** 店からの1行（お知らせ・お題・来店など）。発言と同じく1分で消える */
  const shopLine = (className: string, text: string) => {
    const li = document.createElement("li");
    li.className = className;
    li.textContent = text;
    log.append(li);
    while (log.children.length > LOG_LINES) log.firstElementChild?.remove();
    setTimeout(() => li.remove(), LOG_LIFETIME_MS);
  };

  return {
    addLine(name, text, isSelf, id) {
      const li = document.createElement("li");
      if (isSelf) li.className = "self";
      if (id !== undefined) li.dataset.id = String(id);
      const who = document.createElement("b");
      who.textContent = name;
      li.append(who, document.createTextNode(` ${text}`)); // textContentで入れる（HTMLとして解釈させない）
      log.append(li);
      while (log.children.length > LOG_LINES) log.firstElementChild?.remove();
      setTimeout(() => li.remove(), LOG_LIFETIME_MS);
    },
    wipe(id) {
      const li = log.querySelector<HTMLLIElement>(`li[data-id="${id}"]`);
      if (!li) return;
      li.className = "wiped";
      li.textContent = "🧽 店員がおしぼりで拭きました";
    },
    announce(text) {
      shopLine("announce", `📢 ${text}`);
    },
    topic(text) {
      shopLine("topic", `📋 お題：${text}`);
    },
    system(text) {
      shopLine("system", text);
    },
    fill(text) {
      input.value = text;
      input.focus();
    },
    notice(text) {
      noticeEl.textContent = text;
      noticeEl.hidden = false;
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => (noticeEl.hidden = true), 3_000);
    },
  };
}
