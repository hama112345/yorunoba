# ヨルノバ

仕事帰りにふらっと寄れる、**テキストだけの居酒屋メタバース**。いまは2週間PoC（需要検証）の段階。

- 計画：[docs/poc-plan.md](docs/poc-plan.md)
- 検証指標：[docs/hypotheses.md](docs/hypotheses.md)
- 毎晩の営業記録：[docs/nightly-log.md](docs/nightly-log.md)

## いまできること（D6まで）
- **入店**：のれんの前に「いま○人が飲んでる」と営業時間。名前・色・ひとこと札（話題タグ2つまで）を選び、18歳以上を確認して入る。
- **歩く・座る**：床をタップで歩き、席をタップで座る。スマホ縦は自分を追いかけ、PC・横持ちは店全体を映す。
- **話す**：画面下の会話欄から発言 → 頭上の吹き出し（数秒で消える。保存しない）。吹き出しをタップで「わかる／笑／へぇ」。
- **賑わい**：店内のざわめきとグラスの音（右上🔊で消音）、人数で明るくなる灯り、揺れる提灯。
- **安全**：NGワード・連絡先の自動ブロック、通報→留置所（10分入店禁止）、店主の🏮権限、規約とプライバシーポリシー。
- **営業の節目**：21:00開店・23:45ラストオーダー・24:00閉店を会話欄でお知らせ（時間外の入店禁止は設定で有効化）。
- **検証の仕掛け**：右上の「🎫 常連パス（準備中）」（月480円の案といくらなら入るか）、「📨 誘う」（招待URLの共有）、PostHogでの計測。
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

## 店主（オーナー）として入る
1. Renderの画面で、このサービスの「Environment」に `ADMIN_TOKEN` を追加する（8文字以上の、推測されにくい合言葉）。保存すると自動で再起動する。
2. `https://yorunoba.onrender.com/#staff=合言葉` を開いて入店する。名札に 🏮 が付き、ほかの客の名札カードから「留置所へ」を押せる（10分の入店禁止）。
3. 任意：Discordのチャンネル設定で「ウェブフック」を作り、そのURLを `DISCORD_WEBHOOK_URL` として追加すると、通報や留置所のたびに通知が届く。

> 合言葉の入ったURLは人に送らない。URLの合言葉部分は開いた直後に消え、そのタブを閉じるまで有効。

## 設定できる環境変数（Renderの「Environment」）
どれも任意。入れなければ、その機能が止まっているだけで店は動く。保存すると自動で作り直される（数分）。

| 名前 | 中身 | 入れると |
|---|---|---|
| `ADMIN_TOKEN` | 店主の合言葉（8文字以上） | 店主として入れる（上の手順） |
| `DISCORD_WEBHOOK_URL` | DiscordのウェブフックURL | 通報・留置所のたびにDiscordへ通知 |
| `VITE_POSTHOG_KEY` | PostHogのプロジェクトキー（`phc_` で始まる） | 計測が始まる（発言の本文は送らない） |
| `VITE_POSTHOG_HOST` | PostHogの送り先（EUで作った場合は `https://eu.i.posthog.com`） | 既定は米国（`https://us.i.posthog.com`） |
| `VITE_WAITLIST_URL` | 事前登録フォームのURL（`https://` で始まる） | 常連パスと準備中画面に「お知らせを受け取る」が出る |
| `SHOP_HOURS_ENFORCED` | `true` | 21:00〜24:00（日本時間）以外は入店できなくなる。一般公開（D10）から |
| `ANTHROPIC_API_KEY` | AnthropicのAPIキー | AI店員（Claude Haiku 5.5）が見回りと通報の一次審査を始める。起動時のログに「AI店員: 準備OK」と出れば動いている |
| `AI_STAFF` | `off` | APIキーを入れたまま、AI店員だけを止める |
| `AI_STAFF_DAILY_LIMIT` | 数字（既定 3000） | AI店員が1日に呼べる回数の上限（費用の上限） |
| `JAIL_BY_IP` | `true` | 留置所の判定に端末IDに加えてIPも使う（携帯回線の巻き込みに注意） |

PostHogのキーの取り方：[PostHog](https://posthog.com) に登録 → プロジェクトを作る → 「Project settings」の「Project API key」をコピーする。

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
| 計測 | PostHog（キーを入れたときだけ） |
| AI店員 | Claude Haiku 5.5（APIキーを入れたときだけ） |
| 予定 | Claude Haiku 5.5（AI常連） |
