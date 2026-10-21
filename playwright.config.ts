import { defineConfig, devices } from "@playwright/test";

const PORT = 2610;

// 本番と同じ形（サーバーがビルド済みクライアントを配信）で動かして確かめる。
// 先に `npm run build` しておくこと。
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // 全員が同じ1号店に入るので、テストは1つずつ順番に流す
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `PORT=${PORT} npm start`,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
  },
});
