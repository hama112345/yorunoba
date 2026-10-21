import { CHAT_MAX_LENGTH } from "@yorunoba/shared";

/** 会話欄に残す行数と、1行が消えるまでの時間（どこにも保存しない） */
const LOG_LINES = 5;
const LOG_LIFETIME_MS = 60_000;

export interface ChatBar {
  addLine(name: string, text: string, isSelf: boolean): void;
  notice(text: string): void;
}

/**
 * 画面下の会話欄。入力はDOMで作る（日本語入力とスマホのキーボードのため）。
 * 直近の数行だけ表示し、1分で消える。吹き出しを見逃した人のための補助で、記録ではない。
 */
export function showChatBar(onSend: (text: string) => void): ChatBar {
  const root = document.createElement("section");
  root.id = "chat";
  root.innerHTML = `
    <ol class="log" aria-live="polite" aria-label="最近の会話（1分で消えます）"></ol>
    <p class="notice" role="status" hidden></p>
    <form class="bar">
      <input name="text" maxlength="${CHAT_MAX_LENGTH}" placeholder="ひとこと話しかける…" autocomplete="off" enterkeyhint="send" aria-label="発言" />
      <button type="submit">送る</button>
    </form>
  `;
  document.body.append(root);

  const log = root.querySelector<HTMLOListElement>(".log")!;
  const noticeEl = root.querySelector<HTMLParagraphElement>(".notice")!;
  const form = root.querySelector<HTMLFormElement>(".bar")!;
  const input = form.querySelector<HTMLInputElement>("input")!;

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

  return {
    addLine(name, text, isSelf) {
      const li = document.createElement("li");
      if (isSelf) li.className = "self";
      const who = document.createElement("b");
      who.textContent = name;
      li.append(who, document.createTextNode(` ${text}`)); // textContentで入れる（HTMLとして解釈させない）
      log.append(li);
      while (log.children.length > LOG_LINES) log.firstElementChild?.remove();
      setTimeout(() => li.remove(), LOG_LIFETIME_MS);
    },
    notice(text) {
      noticeEl.textContent = text;
      noticeEl.hidden = false;
      window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => (noticeEl.hidden = true), 3_000);
    },
  };
}
