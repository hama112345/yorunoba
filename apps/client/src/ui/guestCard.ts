/** アバターをタップしたときの名札カード。困ったときの「通報」もここから */
export interface GuestInfo {
  name: string;
  tags: string[];
  staff: boolean;
  ai: boolean;
}

let current: HTMLElement | null = null;

export function showGuestCard(guest: GuestInfo, viewerIsStaff: boolean, onReport: () => void) {
  closeGuestCard();
  const card = document.createElement("div");
  card.className = "guest-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", `${guest.name}さんの名札`);

  const title = document.createElement("p");
  title.className = "name";
  title.textContent = guest.staff ? `🏮 ${guest.name}（店主）` : guest.ai ? `🤖 ${guest.name}（AI常連）` : guest.name; // textContentで入れる（HTMLとして解釈させない）
  const tags = document.createElement("p");
  tags.className = "tags";
  tags.textContent = guest.ai
    ? "店のAIです。人が少ない時間だけ、話し相手になります。人が増えたら帰ります"
    : guest.tags.length
      ? guest.tags.map((t) => `#${t}`).join(" ")
      : "ひとこと札なし";

  const actions = document.createElement("div");
  actions.className = "actions";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "閉じる";
  close.addEventListener("click", closeGuestCard);
  actions.append(close);

  if (!guest.staff && !guest.ai) {
    const report = document.createElement("button");
    report.type = "button";
    report.className = "danger";
    report.textContent = viewerIsStaff ? "留置所へ（店主）" : "通報する";
    report.addEventListener("click", () => {
      const ok = viewerIsStaff
        ? confirm(`${guest.name}さんを留置所へ送りますか？（10分間入店できなくなります）`)
        : confirm(`${guest.name}さんを通報しますか？\n嫌な思いをしたときに使ってください。複数の人から通報があると、店員が留置所へ連れていきます。`);
      if (ok) onReport();
      closeGuestCard();
    });
    actions.append(report);
  }

  card.append(title, tags, actions);
  document.body.append(card);
  current = card;
}

export function closeGuestCard() {
  current?.remove();
  current = null;
}
