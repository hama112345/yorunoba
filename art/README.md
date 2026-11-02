# 絵（背景・キャラ）の作り方

届いた絵を、ゲームで使う形に変換する場所。**絵を差し替えたら、ここの手順で作り直す。**

| ファイル | 中身 |
|---|---|
| `source/*.png` | 届いた絵そのまま（背景1枚・キャラ7人） |
| `characters.json` | キャラの絵の、どのコマをどの動きに使うか（手で書く） |
| `build.py` | 変換するスクリプト |

出力（コミットする）：
- `apps/client/public/assets/izakaya-bg.webp`（背景）
- `apps/client/public/assets/chars/<id>.webp`（コマを同じ大きさに並べ直した1枚）と `<id>-thumb.webp`（入店画面のキャラ選び用）
- `apps/client/src/art/characters.json`（コマの大きさと動きの対応。ゲームはこれを読む）

## 作り直す
```bash
pip install pillow numpy            # 初回だけ
python3 art/build.py                # 全員ぶん変換
python3 art/build.py --preview /tmp/art   # 番号の一覧と、動きごとの確認画像も作る
```
そのあと `npm run build && npm start` で店を開いて見た目を確かめ、`node scripts/og-image.mjs` でSNS用の画像も作り直す。

## キャラの絵を差し替える・足す
1. 絵を `source/` に置く（透明な背景のPNGが一番よい。市松模様が焼き込まれていても外側から透明にする）。
2. `python3 art/build.py --preview /tmp/art <id>` を実行し、`/tmp/art/index-<id>.png` で各コマの番号（`行.列`）を見る。
3. `characters.json` の `anims` に、動きごとのコマ番号を書く。
   - 使える動き：`idle`（正面で待つ）`idle_back` `walk_down` `walk_up` `walk_side` `sit_front` `sit_back` `sit_side` `drink` `sit_drink` `cheer`（手を振る・乾杯）`laugh`
   - `idle` `walk_down` `walk_side` `sit_front` `sit_back` `sit_side` は必須。ほかは無くてもよい（その動きを出さないだけ）。
   - 2人がくっついて1コマに見えるときは `split`（例 `"1.2": 2`）で分け、`1.2:0` `1.2:1` と呼ぶ。
   - 行ごとに描かれた大きさが違うときは `scale` で動きごとに補正する。
   - `side` / `sitSide`：横向きの絵が左右どちらを向いているか。`sitOnFloor`：座る絵に椅子が無い（床に座っている）とき true。
   - 腰や膝で切れている絵は使わない（立っている人として出すと浮いて見える）。
4. `/tmp/art/anims-<id>.png` で、動きごとの並びと大きさがそろっているかを目で確かめる。
5. 客が選べるキャラの一覧は `packages/shared/src/index.ts` の `LOOKS`（店員の絵は `STAFF_LOOK`）。

## 背景を差し替える
`source/background.png` を置き換えて `build.py` を実行したあと、**`packages/shared/src/layout.ts` の数字を新しい絵に合わせて引き直す**（席の位置と向き、テーブル、歩ける範囲、カウンター、入口、店員の立ち位置、手前に重ねる部分、灯りの位置）。数字は背景の絵の上のピクセルで書く。
