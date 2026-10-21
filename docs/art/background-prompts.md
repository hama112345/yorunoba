# 背景の生成プロンプト集

店内の背景を、ChatGPT・Gemini などの画像生成AIで作るための指示文。下の英語版をそのまま貼るのがいちばん安定する。日本語版は補助用。

## 進め方
1. 方向性 A／B／C のプロンプトを、それぞれ2〜3回ずつ生成する（合計6〜8枚）。
2. 「入ってみたい」と思える1枚を選ぶ。迷ったら2〜3枚に絞り、知人に「どこで飲みたい？」と聞く。
3. 選んだ画像を、**縮小せず元のサイズのまま**チャットに添付する。私が絵を見て、席・テーブル・壁・入口の座標を引き直して組み込む。
4. 使った生成サービスの**商用利用の規約**を確認しておく（有料プランが条件のこともある）。

### 共通の注意
- 人物は描かせない。客はゲーム側で上に重ねる。
- 文字・看板の文字・ロゴは描かせない。AIは文字が崩れるので、文字はゲーム側で載せる。
- 他社のゲーム名・作品名・キャラ名はプロンプトに書かない（権利対策）。
- 床と通路が広く見えること。客が歩いて座る場所が必要。

## 方向性A：冒険者ギルドの酒場（RPGの集会所）
みんなが集まって次の冒険を待つ、にぎやかな酒場。「インターネットの溜まり場」感がいちばん出る。

```
A cozy fantasy RPG guild tavern interior, seen from a top-down three-quarter view (like a classic 2D RPG map, camera looking down at about 45 degrees), wide landscape composition 3:2.
Warm, lively night atmosphere: wooden floor with wide open walkways, a long bar counter along the back wall with 8 round stools in front of it, shelves of bottles and barrels behind the counter, 3 large wooden tables with benches and stools spread across the room, a big wooden quest board with pinned paper notes on one wall (no readable text), hanging lanterns and candle chandeliers casting warm orange light, an open entrance with a cloth curtain at the bottom center.
Style: charming, highly detailed 2D game background art, soft painterly pixel art, cute and cozy, rich warm colors, clean shapes, readable at small size.
No people, no characters, no animals, no text, no letters, no logos, no UI.
```

## 方向性B：大衆居酒屋
仕事帰りに肩を並べて飲む、昭和レトロな大衆酒場。日本の夜らしさが強い。

```
A lively Japanese "taishu izakaya" (casual public pub) interior at night, seen from a top-down three-quarter view (like a classic 2D RPG map, camera looking down at about 45 degrees), wide landscape composition 3:2.
Wooden floor with wide open walkways, an L-shaped wooden counter along the back wall with 8 round stools, a kitchen pass with steaming pots behind it, 3 square wooden tables with stools and beer crates, red paper lanterns, hanging paper menu strips on the wall (blank, no readable text), a TV on the wall, warm yellow-orange lighting, a noren curtain at the entrance at the bottom center.
Style: charming, highly detailed 2D game background art, soft painterly pixel art, cute and nostalgic Showa-retro mood, rich warm colors, clean shapes, readable at small size.
No people, no characters, no animals, no text, no letters, no logos, no UI.
```

## 方向性C：和風ファンタジーの集会所（AとBの中間）
和風の宿場町にある冒険者の集会所。提灯と木の温かさに、RPGの依頼掲示板が同居する。

```
A Japanese-style fantasy village gathering hall that works as an adventurers' tavern, seen from a top-down three-quarter view (like a classic 2D RPG map, camera looking down at about 45 degrees), wide landscape composition 3:2.
Warm wooden floor with wide open walkways, a long counter along the back wall with 8 cushioned stools, sake barrels and shelves behind it, 3 low wooden tables with zabuton cushions and stools, a wooden quest board with paper notes (no readable text), red and white paper lanterns, a big shoji window glowing with night light, a noren curtain at the entrance at the bottom center.
Style: charming, highly detailed 2D game background art, soft painterly pixel art, cute and cozy, rich warm colors, clean shapes, readable at small size.
No people, no characters, no animals, no text, no letters, no logos, no UI.
```

## 日本語版（補助）
> 斜め上から見下ろした（昔ながらの2D RPGのマップのような）横長3:2の店内の背景。夜で、暖かい灯り。床と通路が広く見える。奥にカウンターと丸椅子8脚、テーブル3卓、手前中央に入口（のれん）。かわいく描き込みの多い2Dゲームの背景、やわらかいドット絵風。人物・動物・文字・ロゴ・UIは描かない。

方向性ごとに、上の英語版の雰囲気（ギルドの酒場／大衆居酒屋／和風ファンタジーの集会所）を足して使う。

## うまくいかないとき
- 真上からの図になる → 「three-quarter view, camera looking down at about 45 degrees, we can see the front faces of the counter and tables」を足す。
- 人が描かれる → 「empty room before opening, no people」を足す。
- 床が狭い → 「large empty floor area in the middle for walking」を足す。
- 文字が入る → 「all signs and papers are blank」を足す。

## 後日用（今はまだ不要）
- 横丁の外観（店が並ぶ通り）：一般公開前の告知画像・入店画面の背景に使う。
- OGP用キービジュアル（1200×630）：SNSでURLを共有したときに出る画像。
