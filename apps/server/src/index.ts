import { createServer } from "./app.js";
import { aiStaffSelfCheck, getAiStaff } from "./moderation/aiStaff.js";

const port = Number(process.env.PORT ?? 2567);

await createServer().listen(port);
console.log(`ヨルノバ server listening on :${port}`);
console.log(getAiStaff() ? "AI店員: 有効（動作確認中…）" : "AI店員: 無効（ANTHROPIC_API_KEY なし）。ルールだけで営業します");
if (getAiStaff()) void aiStaffSelfCheck();
