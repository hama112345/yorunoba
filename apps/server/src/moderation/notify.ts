// 店主への通知（Discord）。Renderの環境変数 DISCORD_WEBHOOK_URL が無ければ何もしない。
// 通報・違反の対応のためだけに、該当する人の直近の発言を数行だけ送る（保存はしない）。

export async function notifyStaff(content: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
  } catch (err) {
    console.warn("店主への通知に失敗しました", err);
  }
}
