import { CLOSE_HOUR, OPEN_HOUR } from "@yorunoba/shared";
import { track } from "../analytics";
import { invite } from "./invite";
import { WAITLIST_URL } from "./regularsPass";

/**
 * 店を出たあとの画面。
 * - checkout：「お会計」で出たとき。次の営業時間・お知らせの受け取り・友だちを誘う・もう一度入る
 * - lost：接続が切れて戻れなかったとき（電波・お店の開け直し）。もう一度入る
 * 「もう一度入る」はページを読み込み直す（入店画面に戻る。名前・キャラは覚えている）
 */
export function showGoodbye(kind: "checkout" | "lost") {
  if (document.getElementById("goodbye")) return;
  const root = document.createElement("div");
  root.className = "modal";
  root.id = "goodbye";
  root.innerHTML =
    kind === "checkout"
      ? `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="goodbye-title">
      <h2 id="goodbye-title">🏮 ありがとうございました</h2>
      <p class="lead">またのお越しをお待ちしています。</p>
      <p class="hours">毎晩 ${OPEN_HOUR}:00〜${CLOSE_HOUR}:00（日本時間）に開いています</p>
      ${WAITLIST_URL ? `<a class="waitlist" target="_blank" rel="noopener">新しいお知らせを受け取る</a>` : ""}
      <div class="row">
        <button type="button" class="invite">📨 友だちを誘う</button>
        <button type="button" class="again">もう一度入る</button>
      </div>
      <p class="said" role="status" hidden></p>
    </div>`
      : `
    <div class="card" role="alertdialog" aria-modal="true" aria-labelledby="goodbye-title">
      <h2 id="goodbye-title">📶 お店との接続が切れました</h2>
      <p class="lead">電波が不安定になったか、お店が開け直しました。もう一度入れば、続きから飲めます。</p>
      <div class="row">
        <button type="button" class="again primary">もう一度入る</button>
      </div>
    </div>`;
  document.body.append(root);

  root.querySelector(".again")!.addEventListener("click", () => location.reload());
  const waitlist = root.querySelector<HTMLAnchorElement>(".waitlist");
  if (waitlist && WAITLIST_URL) waitlist.href = WAITLIST_URL;
  waitlist?.addEventListener("click", () => track("waitlist_clicked", { from: "goodbye" }));
  const said = root.querySelector<HTMLParagraphElement>(".said");
  root.querySelector(".invite")?.addEventListener("click", () => {
    void invite((text) => {
      if (!said) return;
      said.textContent = text;
      said.hidden = false;
    });
  });
}
