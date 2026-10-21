import { defineConfig, devices } from "@playwright/test";

const PORT = 2610;
/** 公開中の店を確かめるときは E2E_BASE_URL=https://… を付けて実行する */
const REMOTE_URL = process.env.E2E_BASE_URL;

// 本番と同じ形（サーバーがビルド済みクライアントを配信）で動かして確かめる。
// 手元で動かすときは、先に `npm run build` しておくこと。
export default defineConfig({
  testDir: "e2e",
  // GitHubのランナーはGPUがなく描画が遅いので、時間に余裕を持たせる（リトライはしない）
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 全員が同じ1号店に入るので、テストは1つずつ順番に流す
  workers: 1,
  use: {
    baseURL: REMOTE_URL ?? `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: REMOTE_URL
    ? undefined
    : {
        command: `PORT=${PORT} npm start`,
        url: `http://localhost:${PORT}/healthz`,
        reuseExistingServer: !process.env.CI,
      },
});
