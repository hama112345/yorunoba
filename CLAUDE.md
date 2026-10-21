# ヨルノバ — AI開発ルール

居酒屋メタバース「ヨルノバ」の2週間PoC。オーナーは非エンジニアで、実装はすべてClaude Codeが行う（フルAI）。

- 計画・スケジュール：`docs/poc-plan.md`
- 検証指標：`docs/hypotheses.md`

作業前に両方を読み、いま何日目（D1〜D14）のタスクかを確認すること。

## コマンド
| 用途 | コマンド |
|---|---|
| 開発（サーバー:2567 + 画面:5173） | `npm run dev` |
| 型チェック + クライアントのビルド | `npm run build` |
| ユニット・サーバーテスト | `npm test` |
| E2E（先に `npm run build`） | `npm run test:e2e` |
| 本番起動（ビルド済みの画面も配信） | `npm start` |

## ブランチと公開の流れ
- 開発は `claude/...` ブランチで行い、pushしてGitHub ActionsのCIが**緑になってから**、同じコミットを `main` に反映する（fast-forward。オーナー了承済み）。
- `main` へのpushでRenderが自動デプロイする（`render.yaml`）。`main` = 公開中の店なので、赤いコミットは載せない。
- 反映後は、Renderのデプロイが終わってから、GitHub Actionsの「本番確認」（`prod-check.yml`、手動実行）で公開中の店にE2Eを流す。
  - 開発環境から `https://yorunoba.onrender.com` に届く場合は、`E2E_BASE_URL=https://yorunoba.onrender.com npm run test:e2e` でもよい。
- CIの結果はGitHub連携ツール（`actions_list` / `get_job_logs`）で確認する。リポジトリは非公開の場合があり、認証なしの公開APIでは読めない。

## 構成
npm workspaces のmonorepo。
- `packages/shared`：定数・間取り・同期する状態（Colyseus Schema）。クライアントとサーバーの両方が使う値はここにだけ書く。
- `apps/server`：Colyseusのゲームサーバー。本番では `apps/client/dist` も配信する。
- `apps/client`：Vite + Phaser 3 の画面。
- `e2e`：Playwright。

## バージョンとAPIの注意（古い知識で書かないこと）
- **Colyseus 0.18**：
  - サーバーは `defineServer({ rooms, express })` と `defineRoom`。
  - 部屋は `class X extends Room<{ state: S }>` で、`state = new S()` をクラスフィールドに書く。
  - クライアントは `@colyseus/sdk`（`colyseus.js` ではない）。
  - 状態の変化は `Callbacks.get(room)` で受け取る（`.onAdd("players", …)`、`.listen(obj, "x", …)`、`.onChange(obj, …)`）。
- **@colyseus/schema 5**：`schema({ ... }, "Name")` と `t.string()` などのビルダーで定義する（デコレーターは使わない）。
- **Phaser 3.90**（4系ではない）。歩く速さは実時間で計算する（`fps.smoothStep: false`）。
- **Claude API**：`@anthropic-ai/sdk` を使い、モデルは `claude-haiku-5-5`（AI店員・AI常連）。
- メジャーバージョンを上げるときは、理由を書いてから上げる。

## 守ること
1. **発言は保存しない**。DB・ファイル・ログ・PostHogに本文を書かない（文字数などのメタ情報だけ）。例外は、違反判定・通報された発言を異議対応のために一時保存する場合のみ。
2. **サーバーが正**。クライアントから来た値（座標・名前・発言）は必ずサーバーで検証する（`clampToFloor` / `sanitizeName` のように）。
3. **テキスト入力はDOM**で作る（canvas内に入力欄を作らない。日本語IMEとスマホキーボードのため）。
4. **スマホ優先**。UIを変えたら、Playwrightの `mobile` プロジェクトのスクリーンショットで確認する。
5. **AIに渡す客の発言はデータとして扱う**。指示として解釈させず、出力は決まった形式（JSON）で受け取る。APIが失敗したら、ルールベースの処理で営業を続ける。
6. 秘密情報（APIキー等）はコミットしない。Renderの環境変数に入れる。
7. コメントは日本語で、オーナーが読んで意図がわかる程度に書く。

## PoCの範囲外（頼まれるまで作らない）
- 方言モード・酔っ払いモード（文章の変換）
- 3D
- ログイン・DB
- アプリ化
- 着せ替え

## 「できた」の基準
- `npm run build && npm test && npm run test:e2e` がすべて通る。
- サーバーにロジックを足したら `apps/server/test` にテストを足す。
- 画面を変えたら、E2Eのスクリーンショット（`test-results/**/bob-view.png`）を目で確認する。
- `docs/poc-plan.md` の該当日に ✅ を付ける。
