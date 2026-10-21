# ヨルノバ

仕事帰りにふらっと寄れる、**テキストだけの居酒屋メタバース**。いまは2週間PoC（需要検証）の段階。

- 計画：[docs/poc-plan.md](docs/poc-plan.md)
- 検証指標：[docs/hypotheses.md](docs/hypotheses.md)
- 毎晩の営業記録：[docs/nightly-log.md](docs/nightly-log.md)

## いまできること（D1）
- URLを開くと、居酒屋「1号店」に入店する（名前と色は自動で決まる。`?name=名前` で指定もできる）。
- 床をタップすると、そこへ歩く。ほかの客の動きもリアルタイムに見える。
- 右上に店内の人数が出る。

## 公開する（Render）
1. [Render](https://render.com) にGitHubアカウントでログインする。
2. 「New +」→「Blueprint」→ このリポジトリを選ぶ。`render.yaml` の設定がそのまま使われる。
3. デプロイが終わると `https://yorunoba-xxxx.onrender.com` のようなURLが発行される。スマホでも開いて確認する。
4. 以後は、連携したブランチ（通常は main）にpushするたびに自動で更新される。

> 無料プランはアクセスがないとサーバーが眠り、入店に1分近くかかる。PoCでは月7ドルの Starter プランを推奨。

## 手元で動かす（開発者・AI向け）
Node.js 22 以上が必要。

```bash
npm install
npm run dev          # http://localhost:5173 を2つのブラウザで開く
npm run build        # 型チェック + 画面のビルド
npm test             # ユニット・サーバーテスト
npm run test:e2e     # 2つのブラウザで入店→移動が同期されるか（先に build）
```

## 技術
| 部分 | 使っているもの |
|---|---|
| 画面 | TypeScript, Vite, Phaser 3 |
| ゲームサーバー | Node.js, Colyseus 0.18（部屋＝店。発言は保存しない） |
| ホスティング | Render（1サービス） |
| テスト | Vitest, Playwright |
| 予定 | PostHog（計測）, Claude Haiku 5.5（AI店員・AI店主） |
