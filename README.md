# ヨルノバ

仕事帰りにふらっと寄れる、**テキストだけの居酒屋メタバース**。いまは2週間PoC（需要検証）の段階。

- 計画：[docs/poc-plan.md](docs/poc-plan.md)
- 検証指標：[docs/hypotheses.md](docs/hypotheses.md)
- 毎晩の営業記録：[docs/nightly-log.md](docs/nightly-log.md)

## いまできること（D2）
- URLを開くと、のれんの前（入店画面）に「いま○人が飲んでる」が出る。
- 名前・色・ひとこと札（話題タグを2つまで）を選び、18歳以上を確認して入店する。前回の入力は覚えている。
- 床をタップすると、そこへ歩く。ほかの客の動きと、足元のひとこと札もリアルタイムに見える。
- スマホ縦では、自分を追いかけて店を大きく映す。PC・横持ちでは店全体を映す。
- 背景・キャラの絵は仮。本物の絵は `docs/art/` の指示書で用意し、届いたら差し替える。

## 公開する（Render）
GitHubのリポジトリが非公開でも公開でも、この手順で公開できる。遊ぶ人は発行されたURLで入店するので、GitHubを見せる必要はない。

1. [Render](https://dashboard.render.com) にGitHubアカウントでログインする。
2. 「New +」→「Blueprint」を選ぶ。
3. リポジトリの一覧から `yorunoba` を選ぶ。
   - 一覧に出ないときは「Configure GitHub」から、RenderにこのリポジトリへのアクセスをGitHub側で許可する（非公開リポジトリのとき）。
4. `render.yaml` の内容（サービス名 `yorunoba`、無料プラン、`main` ブランチ）が表示されるので「Apply」を押す。
5. 数分でビルドが終わると、`https://yorunoba.onrender.com` のようなURLが発行される。スマホでも開いて確認する。
6. 以後は、`main` にpushするたびに自動で更新される。

> 近道（リポジトリが公開のときだけ使える）：[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hama112345/yorunoba)

> 無料プランは15分アクセスがないとサーバーが眠り、次の入店に1分ほどかかる。一般公開（D10）の前に、Renderの画面で Starter（月7ドル）に切り替える。

公開中の店に対してE2Eを流すとき：`E2E_BASE_URL=https://（発行されたURL） npm run test:e2e`

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
| 予定 | PostHog（計測）, Claude Haiku 5.5（AI店員・AI常連） |
