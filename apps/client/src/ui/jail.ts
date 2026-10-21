/** 留置所に送られたときの画面。戻れる時刻までのカウントダウンを出す */
export function showJail(until: number, reason: string) {
  const el = document.createElement("div");
  el.id = "jail";
  el.setAttribute("role", "alertdialog");
  const card = document.createElement("div");
  card.className = "card";
  const title = document.createElement("h2");
  title.textContent = "🚨 店員に連れて行かれました";
  const why = document.createElement("p");
  why.textContent = `理由：${reason}`;
  const left = document.createElement("p");
  left.className = "left";
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "店のルールを守って、またのお越しをお待ちしています。";
  card.append(title, why, left, note);
  el.append(card);
  document.body.append(el);

  const tick = () => {
    const ms = until - Date.now();
    if (ms <= 0) {
      left.textContent = "もう戻れます。再読み込みして入店してください。";
      return;
    }
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    left.textContent = `留置所であと ${m}分${String(s).padStart(2, "0")}秒`;
    setTimeout(tick, 1000);
  };
  tick();
}
