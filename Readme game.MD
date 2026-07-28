# ドット絵化アップデート

## 変更点
`img/` フォルダの実画像(`namida.png` / `yurumi.png` / `hero_front.png` / `hero_walk1.png` / `hero_walk2.png`)を廃止し、
既存の敵キャラ(あせり・まよい・なまけ…など)と同じ「座標+パレット番号のドット絵データ」方式に統一しました。

- `game.js` の `SPRITE_PIXELS` に `namida` / `yurumi` / `hero_front` / `hero_walk1` / `hero_walk2` を追加
- `fwSpriteImg(key, size)` の中身を `fwPixelSvg(key, size)` 呼び出しに差し替え(呼び出し側は無変更で動作)
- 未使用だった `SPRITE_IMG_MAP` と `fwHeroSvg()` は削除
- コード内にも変更理由をコメントで残してあります(`game.js` の該当箇所、`fwSpriteImg` 定義の直前)

## 使い方
`game.js` を上書きするだけです。`index.html` / `script.js` / `style.css` / `firebase-config.js` は今回変更していません。
`img/` フォルダはもう参照されないので、アップロードしなくても大丈夫です(残っていても害はありません)。

## 各キャラのデザイン意図
- **ナミダ**: 涙のしずく型の半透明スピリット、伏し目がちな悲しげな目
- **ユルミ**: 丸っこい垂れ耳のマスコット、たれ目+ほっぺの赤みで「ゆるい」空気感
- **hero_front / hero_walk1 / hero_walk2**: 主人公の正面立ち姿と、後ろ姿の歩行2コマ(腕と脚が左右交互)

## 毎回コードを更新するときのコマンド(3行)

```
git add .
git commit -m "update"
git push
```