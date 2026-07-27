# 「集中の世界」ゲーム機能 — 完成版

送っていただいた本番の `index.html` / `script.js` / `style.css` / `firebase-config.js` に、
そのまま組み込んだ完成版一式です。

## 変更点
- **`index.html`**: `script.js` を読み込んでいる行の直後に、1行だけ追加しました。
  ```html
  <script src="script.js?v=20260727b"></script>
  <script src="game.js?v=20260727b"></script>   ← 追加した行
  ```
  それ以外は元のファイルと完全に同じです。
- **`script.js` / `style.css` / `firebase-config.js`**: 中身は変更していません(そのまま置き換えてOK)。
- **`game.js`**: 今回新規に追加したファイルです。既存の `db`, `auth`, `addEntry`, `adjustCoins`,
  `currentUserCoins`, `getCurrentUser`, `USERS_COLLECTION` をそのまま利用して動くので、
  他のファイルへの追加変更は不要です。

## 使い方
ダウンロードした5ファイル(`index.html`, `script.js`, `style.css`, `firebase-config.js`, `game.js`)を
すべて、今使っているプロジェクトの同じ場所に上書き保存(またはアップロード)するだけです。
アプリを開いてログインすると、右下に「⚔ 集中の世界」ボタンが出現します。

## 2. 何を作ったか

- **ステータス成長**: タイマー(ポモドーロ含む)で記録した勉強内容(`addEntry` が呼ばれた瞬間)をフック。
  - 数学→INT / 国語→MP / 英語→AGI / 理科→ATK / 社会→HP に自動加算
  - それ以外の科目はランダムで5ステータスのどれかに加算
  - 全ステータス100スタート、1教科10時間(600分)でそのステータス+100のレート
- **ショップ(YEEN消費)**:
  - 装備ガチャ(1回300 YEEN、N/R/SRの重み付き抽選、重複は半額YEEN還元)
  - 一時バフ(次のバトル1回だけ有効な能力アップ、購入するとスタックされ、バトル開始時に消費)
- **集中の世界**: アンダーテール風の黒背景+ドット文字(Press Start 2P)でタイプ演出付きの導入 → ポケモン風のバトル(たたかう/とくぎ)→ リザルト画面、という一連の流れ
- **敵**: 画像ファイルは使わず、3体とも純粋なSVG図形(円・多角形の組み合わせ)で表現しているので、
  画像をアップロード/GitHubに置く作業は不要です(あせり・まよい・なまけ の3体)。
- Firestoreの `users` コレクションに `fw_stats` / `fw_xp` / `fw_equipment` / `fw_equipped` /
  `fw_buffs` / `fw_dex` というフィールドが自動で追加されます(既存フィールドには触れません)。

## 3. 調整したい場合
`game.js` 冒頭の定数(`SUBJECT_STAT_MAP`, `STAT_PER_MIN`, `EQUIPMENT_CATALOG`, `BUFF_CATALOG`,
`ENEMIES`, `GACHA_COST` など)を書き換えるだけで、成長レート・装備・敵・値段を自由に調整できます。

---

## 毎回コードを更新するときのコマンド(3行)

```
git add .
git commit -m "update"
git push
```