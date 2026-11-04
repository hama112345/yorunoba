import { createServer } from "./app.js";
import { aiStaffSelfCheck, getAiStaff } from "./moderation/aiStaff.js";
import { startNightlyReport } from "./nightStats.js";

const port = Number(process.env.PORT ?? 2567);

await createServer().listen(port);
console.log(`ヨルノバ server listening on :${port}`);
console.log(getAiStaff() ? "AI店員: 有効（動作確認中…）" : "AI店員: 無効（ANTHROPIC_API_KEY なし）。ルールだけで営業します");
if (getAiStaff()) void aiStaffSelfCheck();
// 閉店の時刻に「今夜のまとめ」（数だけ）を店主のDiscordへ（DISCORD_WEBHOOK_URL があるとき）
startNightlyReport();
