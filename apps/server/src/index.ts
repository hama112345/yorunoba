import { createServer } from "./app.js";

const port = Number(process.env.PORT ?? 2567);

await createServer().listen(port);
console.log(`ヨルノバ server listening on :${port}`);
