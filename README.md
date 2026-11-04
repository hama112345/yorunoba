# ヨルノバ

仕事帰りにふらっと寄れる、**テキストだけの居酒屋メタバース**。いまは2週間PoC（需要検証）の段階。

- 計画：[docs/poc-plan.md](docs/poc-plan.md)
- 検証指標：[docs/hypotheses.md](docs/hypotheses.md)
- 毎晩の営業記録：[docs/nightly-log.md](docs/nightly-log.md)
- プレオープン（D7）の手順：[docs/pre-open.md](docs/pre-open.md)
- 一般公開（D10）の告知文とURLの付け方：[docs/launch-kit.md](docs/launch-kit.md)
- 最終の集計（D14）：[docs/poc-result.md](docs/poc-result.md)／キープボトルの始め方：[docs/keep-bottle.md](docs/keep-bottle.md)

## いまできること
- **入店**：のれんの前に「いま○人が飲んでる」と営業時間。名前・キャラ・ひとこと札（話題タグ2つまで）を選び、18歳以上を確認して入る。はじめての人には遊び方の短い案内。
- **歩く・座る**：床をタップで歩き、席をタップで座る。スマホ縦は自分を追いかけ、PC・横持ちは店全体を映す。
- **話す**：画面下の会話欄から発言 → 頭上の吹き出し（数秒で消える。保存しない）。吹き出しをタップで「わかる／笑／へぇ」（押した人の頭上に絵文字）。
- **話すきっかけ**：🍻乾杯ボタン（2人以上続くと「かんぱーい！」）、右奥の掲示板の「今日のお題」（静かなときは店からも出す）、会話欄に「〇〇さんが来店」。
- **途切れても戻れる**：電波が途切れた・アプリを切り替えたときは、30秒以内なら自動でつなぎ直して続きから。
- **賑わい**：店内のざわめきとグラスの音（右上🔊で消音）、人数で明るくなる灯り、揺れる提灯。
- **安全**：NGワード・連絡先の自動ブロック、通報→留置所（10分入店禁止）、店主の🏮権限、規約とプライバシーポリシー。
- **営業の節目**：21:00開店・23:45ラストオーダー・24:00閉店を会話欄でお知らせ（時間外の入店禁止は設定で有効化）。
- **検証の仕掛け**：右上の「🎫 常連パス（準備中）」（月480円の案といくらなら入るか）、「📨 誘う」（招待URLの共有）、「🧾 お会計」（帰る前に「また来たい？」）、キープボトル（500円・設定したときだけ）、PostHogでの計測。
- **見た目**：居酒屋の背景（AI生成）と、入店画面で選べるキャラ6人（歩く・座る・手を振る・笑う・飲む）。テーブルの奥の人は天板に隠れて立体に見える。客が少ないときはカウンターの中にAI店員ゲンが立つ（APIキーを入れたとき）。
- 絵の差し替え・作り直しは [art/README.md](./art/README.md)。

## 公開する（Render）
GitHubのリポジトリが非公開でも公開でも、この手順で公開できる。遊ぶ人は発行されたURLで入店するので、GitHubを見せる必要はない。

**先にやること（非公開リポジトリでは必須）**：RenderがこのリポジトリをGitHubから読めるように許可する。
[Render GitHub App の設定](https://github.com/apps/render/installations/new) を開き、自分のアカウントの「Configure」→「Repository access」で
`yorunoba` を追加して（または「All repositories」）保存する。

1. [Render](https://dashboard.render.com) にGitHubアカウントでログインする。
2. 「New +」→「Blueprint」を選ぶ。
3. リポジトリの一覧から `yorunoba` を選ぶ（出てこないときは、上の「先にやること」をやり直す）。
4. `render.yaml` の内容（サービス名 `yorunoba`、無料プラン、`main` ブランチ）が表示されるので「Apply」を押す。
5. 数分でビルドが終わると、`https://yorunoba.onrender.com` のようなURLが発行される。スマホでも開いて確認する。
6. 以後は、`main` にpushするたびに自動で更新される（されないときは下の「自動で更新されないとき」）。

### 自動で更新されないとき（main に載せても公開中の店が古いまま）
どちらか一方をやれば、以後は `main` に載るたびに新しい版になる。GitHub Actions の「公開（Render）」が、公開中の店が入れ替わるまで見届ける（Actionsの画面で緑なら完了）。
- **かんたん**：Renderのサービス →「Settings」→「Build & Deploy」→「Auto-Deploy」を **On Commit** にする。
- **確実**：Renderのサービス →「Settings」→「Deploy Hook」のURLをコピーし、GitHubのリポジトリ →「Settings」→「Secrets and variables」→「Actions」→「New repository secret」で、名前 `RENDER_DEPLOY_HOOK`・値にそのURLを入れて保存する。
  - このURLは合言葉と同じ扱い（知っている人は誰でもデプロイを始められる）。チャットやIssueには貼らない。

> 「Deploy to Render」ボタン（`render.com/deploy?repo=…`）は公開リポジトリ専用の近道。これで作ったサービスは、あとでリポジトリを非公開にすると更新できなくなるので使わない。

### 「We are unable to access to your GitHub repository」と出たとき
RenderがGitHubのリポジトリを読めていない（非公開にした後に多い）。上から順に確かめる。
1. 上の「先にやること」で、Render GitHub App に `yorunoba` へのアクセスを許可する。
2. Renderのサービス →「Settings」→「Build & Deploy」で、リポジトリが自分のGitHub連携（Git Credentials）でつながっているか、
   ブランチが `main` か、Auto-Deploy がオンかを確かめ、「Manual Deploy」→「Deploy latest commit」。
   - Render全体でGitHubがつながっていなければ「Account Settings」→「Git Deployment Credentials」→「Add credential」→ GitHub。
3. それでもだめなら、環境変数の値を控えてからサービスを削除し、上の手順（Blueprint）で作り直す（URLは同じになる）。

> 無料プランは15分アクセスがないとサーバーが眠り、次の入店に1分ほどかかる。一般公開（D10）の前に、Renderの画面で Starter（月7ドル）に切り替える。

公開中の店に対してE2Eを流すとき：`E2E_BASE_URL=https://（発行されたURL） npm run test:e2e`

## 店主（オーナー）として入る
1. Renderの画面で、このサービスの「Environment」に `ADMIN_TOKEN` を追加する（8文字以上の、推測されにくい合言葉）。保存すると自動で再起動する。
2. `https://yorunoba.onrender.com/#staff=合言葉` を開いて入店する。名札に 🏮 が付き、ほかの客の名札カードから「留置所へ」を押せる（10分の入店禁止）。
3. 任意：Discordのチャンネル設定で「ウェブフック」を作り、そのURLを `DISCORD_WEBHOOK_URL` として追加すると、通報や留置所のたびに通知が届く。閉店の時刻（24:00）には「今夜のまとめ」（来店人数・発言や乾杯の回数など、数だけ）も届く。
4. 店主だけの合図：会話欄に `/お知らせ 伝えたいこと` と書くと全員の会話欄に📢で流れ、`/お題` で今日のお題をすぐ出せる（吹き出しにはならない）。

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
| `VITE_KEEP_BOTTLE_URL` | StripeのPayment LinkのURL（`https://` で始まる） | 常連パスのカードに「🍶 キープボトル 500円」が出る（[docs/keep-bottle.md](docs/keep-bottle.md)） |
| `KEEP_BOTTLES` | キープボトルを買ってくれた人の名前（カンマ区切り） | 酒棚の瓶に名札が掛かる（最大8本） |
| `SHOP_HOURS_ENFORCED` | `true` | 21:00〜24:00（日本時間）以外は入店できなくなる。一般公開（D10）から |
| `ANTHROPIC_API_KEY` | AnthropicのAPIキー | AI店員（Claude Haiku 5.5）が見回りと通報の一次審査を始め、客が少ない時間にAI店員「ゲン」がカウンターの中に現れる。起動時のログに「AI店員: 準備OK」と出れば動いている |
| `AI_STAFF` | `off` | APIキーを入れたまま、AI店員だけを止める |
| `AI_STAFF_DAILY_LIMIT` | 数字（既定 3000） | AI店員が1日に呼べる回数の上限（費用の上限） |
| `AI_REGULAR` | `off` | APIキーを入れたまま、AI店員ゲン（話し相手）だけを止める。見回りは続ける |
| `AI_REGULAR_DAILY_LIMIT` | 数字（既定 2000） | ゲンが1日に返事を考える回数の上限（費用の上限） |
| `JAIL_BY_IP` | `true` | 留置所の判定に端末IDに加えてIPも使う（携帯回線の巻き込みに注意） |

SNSで共有されたときの画像（`apps/client/public/og.png`）は、実際の店の画面から作っている。絵を差し替えたら、`npm run build && npm start` を動かした状態で `node scripts/og-image.mjs` を実行して作り直す。公開URLが変わったら `apps/client/index.html` の `og:url` と `og:image` も直す。

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
| AI店員ゲン（話し相手） | Claude Haiku 5.5（APIキーを入れたときだけ。客が1〜2人のときに現れる） |
