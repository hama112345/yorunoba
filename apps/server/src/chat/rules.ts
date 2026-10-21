// 発言のルールチェック（AIを使わない、その場で判定できる最低限のもの）。
// 引っかかった発言は全員には流さず、本人にだけ注意を出す。

export type RuleVerdict = { ok: true } | { ok: false; kind: "ng" | "contact"; message: string };

/**
 * NGワード。普通の会話を巻き込まないよう、強い暴言・犯罪・売買春の勧誘に絞る。
 * （軽い下ネタや愚痴は居酒屋らしさとして許す。AI店員（D8）で文脈も見る予定）
 */
const NG_WORDS = [
  "死ね", "しね", "氏ね", "殺す", "ころす", "殺すぞ",
  "援交", "援助交際", "パパ活", "ママ活", "売春", "買春", "割り切り",
  "大麻", "覚醒剤", "覚せい剤", "闇バイト", "裏バイト",
];

/** 連絡先・外部への誘導（出会い目的・勧誘・詐欺の入口になるため） */
const CONTACT_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\./i,
  /[a-z0-9-]+\.(com|net|org|jp|io|me|ly|gg|app|xyz|info)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/, // メールアドレス
  /0\d{1,4}[-(]?\d{1,4}[-)]?\d{3,4}/, // 電話番号
  /\d{10,11}/, // 区切りなしの電話番号
  /(^|\s)@[a-z0-9_]{3,}/i, // SNSのID（@xxx）
  /(line|ライン|らいん|discord|ディスコ|インスタ|insta|twitter|ツイッター|kakao|カカオ|telegram|テレグラム)\s*(id|アイディ|アイディー)?\s*[:：は＝=]?\s*[a-z0-9_.-]{4,}/i,
];

/** 判定用に正規化する（全角英数→半角、大文字→小文字、空白や記号で区切ったすり抜けを防ぐ） */
function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase();
}

function squash(text: string) {
  return normalize(text).replace(/[\s・.,、。_\-ー～~!！?？*＊]/g, "");
}

export function checkChat(text: string): RuleVerdict {
  const squashed = squash(text);
  if (NG_WORDS.some((w) => squashed.includes(normalize(w)))) {
    return { ok: false, kind: "ng", message: "その言葉はこの店では使えません。言い方を変えてどうぞ" };
  }
  const normalized = normalize(text);
  if (CONTACT_PATTERNS.some((re) => re.test(normalized))) {
    return { ok: false, kind: "contact", message: "安全のため、連絡先・URL・SNSのIDは送れません" };
  }
  return { ok: true };
}
