import { track } from "../analytics";

/** 招待リンク。utm_source=invite を付けて、招待から来た人を数えられるようにする */
export function inviteUrl(): string {
  return `${location.origin}/?utm_source=invite&utm_medium=share`;
}

const INVITE_TEXT = "いま居酒屋「ヨルノバ」で飲んでます。ちょっと寄っていきませんか？";

/**
 * 友だちを誘う。スマホでは共有メニュー（LINE・Xなど）を出し、使えないときはURLをコピーする。
 * 結果をひとこと返す（会話欄の注意書きの場所に出す）。
 */
export async function invite(say: (text: string) => void) {
  const url = inviteUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: "ヨルノバ", text: INVITE_TEXT, url });
      track("invite_clicked", { method: "share" });
    } catch {
      // 共有メニューを閉じただけ（キャンセル）なら何もしない
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${INVITE_TEXT}\n${url}`);
    track("invite_clicked", { method: "copy" });
    say("お店のURLをコピーしました。LINEなどに貼って送ってください");
  } catch {
    track("invite_clicked", { method: "prompt" });
    window.prompt("このURLを送ってください", url);
  }
}
