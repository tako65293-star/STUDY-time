/* =========================================================================
   STUDY-time — 「集中の世界」ゲーム機能 (Focus World)
   既存の script.js / firebase-config.js を書き換えずに後付けで動く
   追加モジュールです。index.html の </body> 直前に

     <script src="game.js"></script>

   を1行追加するだけで動作します(既存の db, auth, addEntry, adjustCoins,
   currentUserCoins, getCurrentUser などをそのまま利用します)。
   ========================================================================= */

(function () {
  "use strict";

  /* ================= 設定値 ================= */
  const FIVE_STATS = ["hp", "mp", "agi", "atk", "int"];
  const STAT_LABEL = { hp: "HP", mp: "MP", agi: "AGI", atk: "ATK", int: "INT" };
  const STAT_JP = { hp: "体力", mp: "集中力", agi: "俊敏さ", atk: "攻撃力", int: "知力" };
  // 5教科 → ステータス対応(固定科目のみ。それ以外の科目はランダム加算)
  const SUBJECT_STAT_MAP = { "数学": "int", "国語": "mp", "英語": "agi", "理科": "atk", "社会": "hp" };
  // 1教科を10時間(600分)勉強すると+100されるレート
  const STAT_PER_MIN = 140 / 600; // 中ボス追加に合わせて伸び率を引き上げ(10時間で+100→+140)
  const BASE_STAT = 100;

  const GACHA_COST = 300;
  // 重複時のYEEN還元率(以前は50%だったのを引き下げ)
  const DUPLICATE_REFUND_RATE = 0.2;

  const EQUIPMENT_CATALOG = [
    // ---- N ----
    { id: "wood_sword", name: "木刀", rarity: "N", bonus: { atk: 5 } },
    { id: "cloth_cape", name: "布のマント", rarity: "N", bonus: { hp: 8 } },
    { id: "vocab_card", name: "単語帳のお守り", rarity: "N", bonus: { int: 5 } },
    { id: "run_shoes", name: "運動靴", rarity: "N", bonus: { agi: 6 } },
    { id: "leather_gloves", name: "皮の手袋", rarity: "N", bonus: { atk: 4, hp: 4 } },
    { id: "cotton_hat", name: "綿の帽子", rarity: "N", bonus: { mp: 6 } },
    // ---- R ----
    { id: "iron_sword", name: "鉄の剣", rarity: "R", bonus: { atk: 12 } },
    { id: "swift_boots", name: "俊足のブーツ", rarity: "R", bonus: { agi: 15 } },
    { id: "focus_ring", name: "集中の指輪", rarity: "R", bonus: { int: 12, mp: 8 } },
    { id: "guard_charm", name: "守りのお札", rarity: "R", bonus: { hp: 16 } },
    { id: "silver_dagger", name: "銀の短剣", rarity: "R", bonus: { agi: 10, atk: 6 } },
    { id: "scholar_glasses", name: "秀才のメガネ", rarity: "R", bonus: { int: 14 } },
    // ---- SR ----
    { id: "sage_staff", name: "賢者の杖", rarity: "SR", bonus: { int: 25, mp: 15 } },
    { id: "fight_gauntlet", name: "闘志のガントレット", rarity: "SR", bonus: { atk: 22, hp: 10 } },
    { id: "gale_scarf", name: "疾風のマフラー", rarity: "SR", bonus: { agi: 25, atk: 8 } },
    { id: "flame_blade", name: "紅蓮の剣", rarity: "SR", bonus: { atk: 20, int: 5 } },
    { id: "moon_veil", name: "月かげのヴェール", rarity: "SR", bonus: { agi: 18, mp: 10 } },
    // ---- SSR ----
    { id: "dragon_fang_sword", name: "竜牙の剣", rarity: "SSR", bonus: { atk: 35, hp: 10 } },
    { id: "arcane_orb", name: "秘術のオーブ", rarity: "SSR", bonus: { int: 38, mp: 15 } },
    { id: "phantom_boots", name: "幻影のブーツ", rarity: "SSR", bonus: { agi: 35, atk: 10 } },
    // ---- UR ----
    { id: "heaven_piercer", name: "天穿つ槍", rarity: "UR", bonus: { atk: 50, agi: 15 } },
    { id: "sage_crown", name: "賢者の王冠", rarity: "UR", bonus: { int: 50, mp: 20 } },
    { id: "titan_plate", name: "巨人の鎧", rarity: "UR", bonus: { hp: 55, atk: 10 } },
    // ---- LR ----
    { id: "world_ender_blade", name: "終焉の大剣", rarity: "LR", bonus: { atk: 70, int: 20 } },
    { id: "astral_ring", name: "星辰の指輪", rarity: "LR", bonus: { hp: 15, mp: 15, agi: 15, atk: 15, int: 15 } },
    // ---- XR ----
    { id: "infinity_gauntlet", name: "無限の籠手", rarity: "XR", bonus: { atk: 90, hp: 30 } },
    { id: "void_scepter", name: "虚空の錫杖", rarity: "XR", bonus: { int: 90, mp: 30 } },
    // ---- GR ----
    { id: "god_slayer", name: "神殺しの刃", rarity: "GR", bonus: { atk: 120, agi: 30 } },
    { id: "celestial_robe", name: "天上のローブ", rarity: "GR", bonus: { hp: 100, mp: 40 } },
    // ---- DR ----
    { id: "dragon_king_blade", name: "竜王剣", rarity: "DR", bonus: { atk: 160, hp: 50 } },
    { id: "abyss_grimoire", name: "深淵の魔導書", rarity: "DR", bonus: { int: 160, mp: 60 } },
    // ---- MR(最高ランク) ----
    { id: "genesis_crown", name: "創世の冠", rarity: "MR", bonus: { hp: 80, mp: 80, agi: 80, atk: 80, int: 80 } },
  ];
  const RARITY_ORDER = ["N", "R", "SR", "SSR", "UR", "LR", "XR", "GR", "DR", "MR"];
  const RARITY_LABEL = {
    N: "ノーマル", R: "レア", SR: "スーパーレア", SSR: "スーパースペシャルレア",
    UR: "ウルトラレア", LR: "レジェンドレア", XR: "エクストリームレア",
    GR: "ゴッドレア", DR: "ドラゴンレア", MR: "ミシックレア",
  };
  const RARITY_WEIGHT = { N: 300, R: 180, SR: 100, SSR: 55, UR: 30, LR: 16, XR: 8, GR: 4, DR: 2, MR: 1 };
  const RARITY_COLOR = {
    N: "#8a8a8a", R: "#6c8ecf", SR: "#d1a324", SSR: "#c15fd6", UR: "#e0663f",
    LR: "#33c1a3", XR: "#4fc0e8", GR: "#f2c744", DR: "#e0435b", MR: "#ff5fd0",
  };
  const MAX_EQUIPPED = 3;

  // ---- わざ(とくぎ)カタログ ----
  // element が敵の type(HONOO/MORI/YAMI/YUME/SUNA/SEI/YUKI)と一致すると「こうかは ばつぐん」で1.3倍
  const SKILL_CATALOG = [
    { id: "basic_strike", name: "気合いの一撃", element: null, scaleStat: "int", power: 0.55, mpCost: 15, price: 0, desc: "最初から使える基本のとくぎ(知力で攻撃)" },
    { id: "flame_edge", name: "火炎斬り", element: "HONOO", scaleStat: "atk", power: 0.6, mpCost: 18, price: 400, desc: "攻撃力ベースの炎属性わざ" },
    { id: "forest_veil", name: "森の加護", element: "MORI", scaleStat: "mp", power: 0.6, mpCost: 18, price: 400, desc: "集中力ベースの森属性わざ" },
    { id: "shadow_pierce", name: "影縫い", element: "YAMI", scaleStat: "agi", power: 0.65, mpCost: 20, price: 500, desc: "俊敏さベースの闇属性わざ" },
    { id: "dream_lull", name: "夢うつつ", element: "YUME", scaleStat: "int", power: 0.65, mpCost: 20, price: 500, desc: "知力ベースの夢属性わざ" },
    { id: "sand_storm", name: "砂塵の舞", element: "SUNA", scaleStat: "agi", power: 0.7, mpCost: 22, price: 600, desc: "俊敏さベースの砂属性わざ" },
    { id: "holy_ray", name: "聖なる光条", element: "SEI", scaleStat: "mp", power: 0.75, mpCost: 24, price: 700, desc: "集中力ベースの聖属性わざ" },
    { id: "frost_blast", name: "氷結波動", element: "YUKI", scaleStat: "int", power: 0.75, mpCost: 25, price: 750, desc: "知力ベースの氷属性わざ" },
    { id: "soul_break", name: "渾身の型", element: null, scaleStat: "atk", power: 0.95, mpCost: 30, price: 1000, desc: "無属性・攻撃力特化の大技" },
  ];

  const BUFF_CATALOG = [
    { id: "buff_atk", name: "気合いドリンク", desc: "次のバトルでATK+20", bonus: { atk: 20 }, price: 150 },
    { id: "buff_int", name: "集中サプリ", desc: "次のバトルでINT+20", bonus: { int: 20 }, price: 150 },
    { id: "buff_agi", name: "俊敏エキス", desc: "次のバトルでAGI+20", bonus: { agi: 20 }, price: 150 },
    { id: "buff_hp", name: "体力ゼリー", desc: "次のバトルでHP+30", bonus: { hp: 30 }, price: 180 },
    { id: "buff_all", name: "万能エナジー", desc: "次のバトルで全ステータス+10", bonus: { hp: 10, mp: 10, agi: 10, atk: 10, int: 10 }, price: 400 },
  ];

  // バトル中に「どうぐ」コマンドから使える消耗品(ショップの「どうぐ」タブで購入してストックする)
  const ITEM_CATALOG = [
    { id: "potion_small", name: "小さな回復薬", desc: "HPを40かいふく", heal: 40, price: 80 },
    { id: "potion_big", name: "大きな回復薬", desc: "HPを90かいふく", heal: 90, price: 160 },
    { id: "ether", name: "エーテル", desc: "MPを20かいふく", restoreMp: 20, price: 120 },
  ];

  const ENEMIES = [
    {
      id: "aseri", name: "アセリ", type: "HONOO", level: 5, hp: 230, atk: 60,
      color1: "#c1503a", color2: "#e8b6a8", color3: "#5c2419",
      intro: ["* 集中の世界", "* 何かの気配がする…", "* 気配は3つ。うち1つが近づいてくる。"],
      encounter: "* アセリが あらわれた!",
      quote: "「…ただ、認められたかっただけ。」",
      reward: { xp: 40, yeen: 160 },
    },
    {
      id: "hikari", name: "ヒカリイシ", type: "MORI", level: 8, hp: 300, atk: 78,
      color1: "#8bac0f", color2: "#9bbc0f", color3: "#0f380f",
      intro: ["* 集中の世界", "* 淡い緑の光が揺れている…", "* 石のようで、石ではない。"],
      encounter: "* ヒカリイシが あらわれた!",
      quote: "「光っていれば、見つけてもらえると思った。」",
      reward: { xp: 52, yeen: 190 },
    },
    {
      id: "mayoi", name: "マヨイ", type: "YAMI", level: 11, hp: 390, atk: 98,
      color1: "#2b2740", color2: "#8a6fd1", color3: "#c94b4b",
      intro: ["* 集中の世界", "* 静かな気配…", "* 影がゆらりと動いた。"],
      encounter: "* マヨイが あらわれた!",
      quote: "「自分を、信じられなかった。ただ、それだけなんだ。」",
      reward: { xp: 68, yeen: 230 },
    },
    {
      id: "mayotto", name: "マヨット", type: "MORI", level: 14, hp: 490, atk: 120,
      color1: "#6daa2c", color2: "#d2aa99", color3: "#4e4a4f",
      intro: ["* 集中の世界", "* 木の下に、緑の人影…", "* こちらをじっと見ている。"],
      encounter: "* マヨットが あらわれた!",
      quote: "「森の奥なら、誰にも見つからないと思ったんだ。」",
      reward: { xp: 88, yeen: 280 },
    },
    {
      id: "namake", name: "ナマケ", type: "YUME", level: 17, hp: 600, atk: 144,
      color1: "#d8c39a", color2: "#c1503a", color3: "#8a7658",
      intro: ["* 集中の世界", "* とても眠たい気配がする…", "* 何かが、あくびをした。"],
      encounter: "* ナマケが あらわれた!",
      quote: "「少しくらい、休んでもいいと思ったんだ。」",
      reward: { xp: 112, yeen: 340 },
    },
    {
      id: "hasami", name: "ハサミガニ", type: "SUNA", level: 20, hp: 720, atk: 170,
      color1: "#df7126", color2: "#639bff", color3: "#8f563b",
      intro: ["* 集中の世界", "* 砂の下から、カサカサと音がする…", "* 横向きの気配が近づいてくる。"],
      encounter: "* ハサミガニが あらわれた!",
      quote: "「挟んだら、離さない。それだけが取り柄だった。」",
      reward: { xp: 140, yeen: 400 },
    },
    {
      id: "kutsune", name: "クツネ", type: "HONOO", level: 23, hp: 850, atk: 198,
      color1: "#d77643", color2: "#3e2731", color3: "#2ce8f5",
      intro: ["* 集中の世界", "* 片方だけの足音が聞こえる…", "* 何かを探し回っているようだ。"],
      encounter: "* クツネが あらわれた!",
      quote: "「もう片方を、ずっと探しているんだ。」",
      reward: { xp: 172, yeen: 470 },
    },
    {
      id: "toriimon", name: "トリイモン", type: "SEI", level: 26, hp: 1000, atk: 230,
      color1: "#b86f50", color2: "#e4a672", color3: "#8b9bb4",
      intro: ["* 集中の世界", "* 古い鳥居がぽつんと立っている…", "* くぐった先に、何かがいる。"],
      encounter: "* トリイモンが あらわれた!",
      quote: "「くぐる者を、ただ静かに見ていた。」",
      reward: { xp: 210, yeen: 550 },
    },
    {
      id: "rama", name: "シロラマ", type: "YUKI", level: 30, hp: 1180, atk: 268,
      color1: "#c0cbdc", color2: "#5a6988", color3: "#3a4466",
      intro: ["* 集中の世界", "* 白い息が、ふわりと浮かぶ…", "* 静かな瞳がこちらを見た。"],
      encounter: "* シロラマが あらわれた!",
      quote: "「ただ、まっすぐ立っていたかっただけ。」",
      reward: { xp: 260, yeen: 650 },
    },
    {
      id: "miren", name: "ミレン", type: "YAMI", level: 33, hp: 1370, atk: 308,
      color1: "#0c0c0c", color2: "#3c6c84", color3: "#cce4fc",
      intro: ["* 集中の世界", "* 白いすがたが宙に浮かんでいる…", "* 何かを、ずっと引きずっているようだ。"],
      encounter: "* ミレンが あらわれた!",
      quote: "「あの時ああしていれば、って。ずっと、そこで止まったままなんだ。」",
      reward: { xp: 300, yeen: 750 },
    },
    {
      id: "aoitori", name: "アオイトリ", type: "SEI", level: 36, hp: 1570, atk: 350,
      color1: "#243c6c", color2: "#3c9cfc", color3: "#fcfcfc",
      intro: ["* 集中の世界", "* 遠くで、青い羽ばたきが見える…", "* 追いかけても、追いかけても届かない。"],
      encounter: "* アオイトリが あらわれた!",
      quote: "「本当の幸せは、きっともっと遠くにあると思ってたんだ。」",
      reward: { xp: 342, yeen: 850 },
    },
    {
      id: "mihari", name: "ミハリ", type: "YAMI", level: 40, hp: 3130, atk: 630,
      color1: "#6c0c0c", color2: "#fc0c0c", color3: "#e4e4e4",
      intro: ["* 集中の世界", "* 空気が、ずしりと重くなった…", "* 巨大な瞳が、こちらをじっと見ている。", "* 敵の気配が、これまでと違う…"],
      encounter: "* ミハリが あらわれた! 【中ボス】",
      quote: "「みんなに見られてる。失敗したら、笑われる。ずっと、そう思ってきた。」",
      reward: { xp: 800, yeen: 1870 },
      boss: true,
    },
    {
      id: "mametsubu", name: "マメツブ", type: "SUNA", level: 43, hp: 2060, atk: 452,
      color1: "#6c3c3c", color2: "#e46c24", color3: "#e4cc9c",
      intro: ["* 集中の世界", "* 小さな影が、もぞもぞ動いている…", "* 誰かと自分を、くらべているようだ。"],
      encounter: "* マメツブが あらわれた!",
      quote: "「どうせ自分なんて、ちっぽけだから。」",
      reward: { xp: 446, yeen: 1100 },
    },
    {
      id: "karamigusa", name: "カラミグサ", type: "MORI", level: 46, hp: 2290, atk: 498,
      color1: "#24243c", color2: "#3c8454", color3: "#6ccc54",
      intro: ["* 集中の世界", "* 足元に、緑のつるが伸びている…", "* 考えれば考えるほど、からみついてくる。"],
      encounter: "* カラミグサが あらわれた!",
      quote: "「一つ心配すると、次から次へと絡みついてくるんだ。」",
      reward: { xp: 494, yeen: 1210 },
    },
    {
      id: "tsumikasanari", name: "ツミカサナリ", type: "HONOO", level: 50, hp: 4430, atk: 872,
      color1: "#540c0c", color2: "#cc0c0c", color3: "#b40c24",
      intro: ["* 集中の世界", "* 赤い塊が、うごめきながら膨らんでいく…", "* 積もり積もったものが、形になったようだ。"],
      encounter: "* ツミカサナリが あらわれた! 【中ボス】",
      quote: "「小さな我慢を、ずっと積み重ねてきた。もう、あふれそうなんだ。」",
      reward: { xp: 1118, yeen: 2590 },
      boss: true,
    },
    {
      id: "toge", name: "トゲ", type: "HONOO", level: 53, hp: 2850, atk: 612,
      color1: "#543c0c", color2: "#b40c0c", color3: "#fc3c0c",
      intro: ["* 集中の世界", "* 赤く尖った気配が近づいてくる…", "* 言葉が、刺さるように鋭い。"],
      encounter: "* トゲが あらわれた!",
      quote: "「『どうせできない』って、自分に言い続けてきたんだ。」",
      reward: { xp: 610, yeen: 1480 },
    },
    {
      id: "hiyokko", name: "ヒヨッコ", type: "YUME", level: 56, hp: 3100, atk: 662,
      color1: "#246c24", color2: "#fc9c0c", color3: "#fccc84",
      intro: ["* 集中の世界", "* 小さな黄色い影が、そわそわしている…", "* まだ早い、と繰り返しているようだ。"],
      encounter: "* ヒヨッコが あらわれた!",
      quote: "「まだ自分には早い、って。ずっと言い訳にしてきた。」",
      reward: { xp: 664, yeen: 1610 },
    },
    {
      id: "shoudou", name: "ショウドウ", type: "YAMI", level: 60, hp: 5870, atk: 1134,
      color1: "#6c0c0c", color2: "#cc2424", color3: "#e4e4e4",
      intro: ["* 集中の世界", "* 赤い刃のようなものが、ちらついている…", "* 何かを、一瞬で断ち切りたがっているようだ。"],
      encounter: "* ショウドウが あらわれた! 【中ボス】",
      quote: "「面倒になると、全部やめてしまいたくなるんだ。一瞬で、全部。」",
      reward: { xp: 1470, yeen: 3370 },
      boss: true,
    },
    {
      id: "genkai", name: "ゲンカイ", type: "YAMI", level: 65, hp: 6650, atk: 1274,
      color1: "#3c0c0c", color2: "#fc0c0c", color3: "#fc0c54",
      intro: ["* 集中の世界", "* あたり一面が、赤く染まっていく…", "* これまでで、いちばん強い気配がする。", "* もう後がない、というように。"],
      encounter: "* ゲンカイが あらわれた! 【中ボス】",
      quote: "「もう無理、もう無理って。何度も、何度も思ったんだ。」",
      reward: { xp: 1658, yeen: 3790 },
      boss: true,
    },
  ];

  // ================= 章立て(マップ代わりの背景テーマ分け) =================
  // 実際のフィールド移動は作らず、既存のゲート一覧をこの区切りで色分け・見出し分けする。
  const CHAPTERS = [
    { id: "ch1", title: "第1章 迷いの入口", enemyIds: ["aseri", "hikari", "mayoi", "mayotto", "namake"], color: "#8a7048" },
    { id: "ch2", title: "第2章 探し人の道", enemyIds: ["hasami", "kutsune", "toriimon", "rama", "miren", "aoitori"], color: "#3c6c5c" },
    { id: "ch3", title: "第3章 降り積もる場所", enemyIds: ["mametsubu", "karamigusa"], color: "#a4502c" },
    { id: "ch4", title: "第4章 崩れゆく境界", enemyIds: ["toge", "hiyokko"], color: "#7c1c1c" },
    { id: "ch5", title: "第5章 限界の間近", enemyIds: ["genkai"], color: "#c1503a" },
  ];
  function fwChapterOf(enemyId) {
    return CHAPTERS.find((c) => c.enemyIds.includes(enemyId)) || null;
  }
  // 章にいる敵を1回でも倒しきっているか
  function fwChapterCleared(chapter) {
    return chapter.enemyIds.every((id) => FW.dex.includes(id));
  }
  // [2026-07-28追加] 「つづきから」用: 章の順番どおりに、まだ倒していない敵/まだ見ていないナミダを探す
  function fwFindNextStep() {
    for (const chapter of CHAPTERS) {
      const nextEnemyId = chapter.enemyIds.find((id) => !FW.dex.includes(id));
      if (nextEnemyId) return { type: "battle", id: nextEnemyId };
      const namidaEvt = NAMIDA_EVENTS.find((n) => n.afterChapter === chapter.id);
      if (namidaEvt && !FW.namidaSeen.includes(namidaEvt.id)) return { type: "namida", id: namidaEvt.id };
    }
    return null;
  }
  function fwContinue() {
    const step = fwFindNextStep();
    if (!step) { window.FocusWorld.showChapters(); return; } // 全部クリア済みなら一覧を開く
    if (step.type === "namida") fwStartNamida(step.id);
    else fwStartIntro(step.id);
  }

  // [2026-07-28追加] 章ごとの背景画像(イントロ/バトル/リザルト画面に使用)。
  // 実ファイルを img/bg/ フォルダに置く必要があります(このアップデートのみ、他のキャラ用ドット絵とは違い
  // 実画像を使用しています)。1章につき複数枚あるものは、バトルのたびランダムで1枚選ばれます。
  //   img/bg/ch1_a.png, ch1_b.png, ch1_c.png … 第1章(迷いの入口)
  //   img/bg/ch2_a.png, ch2_b.png, ch2_c.png … 第2章(探し人の道)
  //   img/bg/ch3_a.png, ch3_b.png, ch3_c.png, ch3_d.png … 第3章(降り積もる場所)
  //   img/bg/ch4_a.png, ch4_b.png, ch4_c.png, ch4_d.png … 第4章(崩れゆく境界)
  //   img/bg/ch5_a.png, ch5_b.png, ch5_c.png … 第5章(限界の間近/ゲンカイ前の廊下)
  //   img/bg/entrance.png … 起動時の「洞窟入口を歩いて入る」演出専用
  const CHAPTER_BG = {
    ch1: ["img/bg/ch1_a.png", "img/bg/ch1_b.png", "img/bg/ch1_c.png"],
    ch2: ["img/bg/ch2_a.png", "img/bg/ch2_b.png", "img/bg/ch2_c.png"],
    ch3: ["img/bg/ch3_a.png", "img/bg/ch3_b.png", "img/bg/ch3_c.png", "img/bg/ch3_d.png"],
    ch4: ["img/bg/ch4_a.png", "img/bg/ch4_b.png", "img/bg/ch4_c.png", "img/bg/ch4_d.png"],
    ch5: ["img/bg/ch5_a.png", "img/bg/ch5_b.png", "img/bg/ch5_c.png"],
  };
  function fwPickChapterBg(enemyId) {
    const chapter = fwChapterOf(enemyId);
    const list = (chapter && CHAPTER_BG[chapter.id]) || CHAPTER_BG.ch1;
    return list[Math.floor(Math.random() * list.length)];
  }
  // イントロ/バトル/リザルトの3画面に同じ背景を適用する(バトル中に背景が変わらないように)
  function fwApplySceneBg(url) {
    ["fw-v-intro", "fw-v-battle", "fw-v-result"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.backgroundImage = `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.6)), url('${url}')`;
    });
  }

  // ================= ナミダ(非戦闘の再会イベント/全3回) =================
  const NAMIDA_EVENTS = [
    {
      id: "namida1",
      afterChapter: "ch1",
      lines: ["* 集中の世界", "* 何かが、しくしくと泣いている…", "* 白い、丸いすがた。"],
      talkLines: ["「…だれも、いない方がいいと思ってた。」", "* ナミダは、少しだけ泣きやんだ。"],
      hitLines: ["* ナミダは 声もなく、うずくまった。"],
    },
    {
      id: "namida2",
      afterChapter: "ch3",
      lines: ["* 集中の世界", "* また、あの白いすがたがいる…", "* こちらに気づいて、びくっとした。"],
      talkLines: ["「まだ、いてくれたんだ。」", "* ナミダは、少しだけ笑ったように見えた。"],
      hitLines: ["* ナミダは、何も言わずに離れていった。"],
    },
    {
      id: "namida3",
      afterChapter: "ch4",
      lines: ["* 集中の世界", "* 最後に、もう一度だけ会えた気がした…"],
      talkLinesGood: ["「ありがとう。」", "* それだけ言って、ナミダは静かに光になった。"],
      talkLinesBad: ["「……もういいや。」", "* 声だけが、風に流れて消えていった。"],
    },
  ];

  // ================= ユルミ(懐く相棒/ルートによって豹変する) =================
  const YURUMI_LINES = [
    "「がんばったね。」",
    "「つかれたら、やすんでいいんだよ。」",
    "「むりしないでね、ユルミがついてるから。」",
    "「今日はもう、それだけで十分だよ。」",
  ];

  /* ================= ルート判定用カウンタ =================
     共感値 = FW.mercyCount   (みまもるで解決した回数)
     周回値 = winCounts の合計値
     依存度 = FW.yurumiDepend (ユルミに話しかけた回数) */
  function fwWinCountTotal() {
    return Object.values(FW.winCounts || {}).reduce((a, b) => a + b, 0);
  }
  function fwDetermineRoute() {
    const mercy = FW.mercyCount || 0;
    const grind = fwWinCountTotal();
    const depend = FW.yurumiDepend || 0;
    if (grind >= 40) return "attrition";               // 摩耗の道
    if (mercy >= 8 && depend <= 6) return "symbiosis";  // 共生の道
    return "challenger";                                // 挑戦の道(標準/ユルミ豹変)
  }
  const ROUTE_ENDING = {
    challenger: {
      title: "* ゲンカイは、静かに消えていった。",
      quote: "* ……と思ったその時、後ろでユルミの声がした。<br>「がんばらなくていいなんて、うそだよ。」<br>「僕は、ずっと頑張れなかった君の代わりに、頑張らない言い訳を探してただけなんだ。」",
    },
    symbiosis: {
      title: "* ゲンカイの声が、ふっと軽くなった。",
      quote: "* トリイモンが静かに開いていく。<br>そこには、これまで出会った皆が、争わず並んで待っていた。",
    },
    attrition: {
      title: "* 勝った。……はずなのに、何も感じない。",
      quote: "* トリイモンは、もう開かない。<br>「……もう、誰の声も聞こえない。」",
    },
  };

  // 敵は倒すたびに強くなる(同じ相手を何度も狩り続けても頭打ちにならないように)。
  // 1回討伐するごとに+18%、最大15回ぶんまで積み重なる(最大 約+270%)。
  const WIN_SCALE_PER_WIN = 0.18;
  const WIN_SCALE_MAX_STACKS = 15;
  // 討伐報酬(XP/YEEN)側は控えめに+6%/回・最大10回ぶんだけ伸びる(強くなる速さ>報酬の伸びなので、
  // 同じ相手を粘って周回するより、勉強してステータスを上げて次の相手に挑む方が効率が良くなる)。
  const REWARD_SCALE_PER_WIN = 0.06;
  const REWARD_SCALE_MAX_STACKS = 10;

  function fwWinCount(enemyId) { return (FW.winCounts && FW.winCounts[enemyId]) || 0; }

  function fwEnemyEffective(enemy) {
    const n = Math.min(fwWinCount(enemy.id), WIN_SCALE_MAX_STACKS);
    const scale = 1 + n * WIN_SCALE_PER_WIN;
    return {
      hp: Math.round(enemy.hp * scale),
      atk: Math.round(enemy.atk * scale),
      scale,
      winCount: fwWinCount(enemy.id),
    };
  }

  function fwEnemyRewardEffective(enemy) {
    const n = Math.min(fwWinCount(enemy.id), REWARD_SCALE_MAX_STACKS);
    const scale = 1 + n * REWARD_SCALE_PER_WIN;
    return {
      xp: Math.round(enemy.reward.xp * scale),
      yeen: Math.round(enemy.reward.yeen * scale),
    };
  }

  /* ================= 状態 ================= */
  const FW = {
    stats: { hp: BASE_STAT, mp: BASE_STAT, agi: BASE_STAT, atk: BASE_STAT, int: BASE_STAT },
    xp: 0,
    equipment: [],
    equipped: [],
    buffs: {},
    items: {},
    skills: ["basic_strike"],
    dex: [],
    winCounts: {},
    mercyCount: 0,
    yurumiDepend: 0,
    namidaSeen: [],
    namidaGood: true,
    route: null,
    loaded: false,
    open: false,
    shopTab: "gacha",
    battle: null,
  };

  function fwLevel() { return Math.floor(FW.xp / 100) + 1; }

  function fwEffectiveStats(includeBuffs) {
    const eff = Object.assign({}, FW.stats);
    FW.equipped.forEach((id) => {
      const item = EQUIPMENT_CATALOG.find((e) => e.id === id);
      if (!item) return;
      Object.keys(item.bonus).forEach((k) => (eff[k] += item.bonus[k]));
    });
    if (includeBuffs) {
      Object.keys(FW.buffs).forEach((buffId) => {
        const count = FW.buffs[buffId] || 0;
        if (count <= 0) return;
        const def = BUFF_CATALOG.find((b) => b.id === buffId);
        if (!def) return;
        Object.keys(def.bonus).forEach((k) => (eff[k] += def.bonus[k] * count));
      });
    }
    return eff;
  }

  /* ================= Firestore連携 ================= */
  function fwDefaultData() {
    return {
      fw_stats: { hp: BASE_STAT, mp: BASE_STAT, agi: BASE_STAT, atk: BASE_STAT, int: BASE_STAT },
      fw_xp: 0, fw_equipment: [], fw_equipped: [], fw_buffs: {}, fw_items: {}, fw_skills: ["basic_strike"], fw_dex: [], fw_win_counts: {},
      fw_mercy_count: 0, fw_yurumi_depend: 0, fw_namida_seen: [], fw_namida_good: true,
    };
  }

  function fwListen() {
    if (typeof auth === "undefined" || typeof db === "undefined") return;
    auth.onAuthStateChanged((user) => {
      const btn = document.getElementById("fw-launcher");
      if (!user) {
        FW.loaded = false;
        if (btn) btn.style.display = "none";
        return;
      }
      if (btn) btn.style.display = "";
      db.collection(USERS_COLLECTION).doc(user.uid).onSnapshot((doc) => {
        const d = (doc.exists && doc.data()) || {};
        FW.stats = Object.assign({ hp: BASE_STAT, mp: BASE_STAT, agi: BASE_STAT, atk: BASE_STAT, int: BASE_STAT }, d.fw_stats || {});
        FW.xp = d.fw_xp || 0;
        FW.equipment = d.fw_equipment || [];
        FW.equipped = d.fw_equipped || [];
        FW.buffs = d.fw_buffs || {};
        FW.items = d.fw_items || {};
        FW.skills = d.fw_skills && d.fw_skills.length ? d.fw_skills : ["basic_strike"];
        FW.dex = d.fw_dex || [];
        FW.winCounts = d.fw_win_counts || {};
        FW.mercyCount = d.fw_mercy_count || 0;
        FW.yurumiDepend = d.fw_yurumi_depend || 0;
        FW.namidaSeen = d.fw_namida_seen || [];
        FW.namidaGood = d.fw_namida_good !== false;
        FW.loaded = true;
        fwRenderHome();
        fwRenderShop();
        fwUpdateLauncherBadge();
      });
    });
  }

  function fwSave(partial) {
    const user = auth.currentUser;
    if (!user) return Promise.resolve();
    return db.collection(USERS_COLLECTION).doc(user.uid).set(partial, { merge: true });
  }

  // 勉強セッションが記録されたときにステータスへ反映する
  function fwApplyStudyGrowth(subject, minutes) {
    const user = auth.currentUser;
    if (!user || !minutes || minutes <= 0) return;
    let statKey = SUBJECT_STAT_MAP[subject];
    let randomPick = false;
    if (!statKey) {
      statKey = FIVE_STATS[Math.floor(Math.random() * FIVE_STATS.length)];
      randomPick = true;
    }
    const gain = Math.round(minutes * STAT_PER_MIN * 10) / 10;
    const ref = db.collection(USERS_COLLECTION).doc(user.uid);
    db.runTransaction((tx) => tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const stats = Object.assign({ hp: BASE_STAT, mp: BASE_STAT, agi: BASE_STAT, atk: BASE_STAT, int: BASE_STAT }, data.fw_stats || {});
      stats[statKey] = Math.round((stats[statKey] + gain) * 10) / 10;
      tx.set(ref, { fw_stats: stats }, { merge: true });
    })).then(() => {
      fwToast(`特訓の成果! ${STAT_JP[statKey]}(${STAT_LABEL[statKey]}) +${gain}${randomPick ? "(ランダム加算)" : ""}`);
    }).catch((err) => console.error("ステータス更新に失敗しました:", err));
  }

  // 既存の addEntry を横取りして、自分の記録が保存されるたびに成長させる
  function fwHookAddEntry() {
    if (typeof window.addEntry !== "function") { setTimeout(fwHookAddEntry, 300); return; }
    const orig = window.addEntry;
    window.addEntry = function (name, subject, minutes) {
      const isOwn = auth.currentUser && (name || getCurrentUser()) === getCurrentUser();
      if (isOwn) fwApplyStudyGrowth(subject, minutes);
      return orig.apply(this, arguments);
    };
  }

  /* ================= UI構築 ================= */
  function fwInjectFonts() {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }

  function fwInjectStyle() {
    const style = document.createElement("style");
    style.textContent = FW_CSS;
    document.head.appendChild(style);
  }

  function fwBuildRoot() {
    const root = document.createElement("div");
    root.id = "fw-root";
    root.innerHTML = `
      <button id="fw-launcher" class="fw-launcher" style="display:none;" onclick="FocusWorld.open()">
        <span class="fw-launcher-icon">⚔</span><span class="fw-launcher-label">集中の世界</span>
      </button>
      <div id="fw-overlay" class="fw-overlay">
        <div class="fw-modal">
          <button class="fw-close" onclick="FocusWorld.close()">✕</button>

          <div class="fw-view fw-view-game fw-view-welcome" id="fw-v-welcome">
            <p class="fw-welcome-text" id="fw-welcome-text">welcome</p>
          </div>

          <div class="fw-view fw-view-game fw-view-entrance" id="fw-v-entrance">
            <div class="fw-entrance-wrap">
              <div class="fw-entrance-walker" id="fw-entrance-walker">
                <span class="fw-walk-frame fw-walk-frame-1">${fwSpriteImg("hero_walk1", 84)}</span>
                <span class="fw-walk-frame fw-walk-frame-2">${fwSpriteImg("hero_walk2", 84)}</span>
              </div>
              <p class="fw-entrance-hint">洞窟の奥へ…</p>
            </div>
          </div>

          <div class="fw-view fw-view-home active" id="fw-v-home">
            <div class="fw-home-hub">
              <p class="fw-eyebrow">FOCUS WORLD</p>
              <h2 class="fw-title">集中の世界</h2>
              <div class="fw-hub-main">
                <div class="fw-hub-hero">
                  <div class="fw-hub-hero-sprite">${fwSpriteImg("hero_front", 60)}</div>
                  <p class="fw-hub-hero-caption">訓練中…</p>
                </div>
                <div class="fw-hub-status">
                  <div class="fw-stat-grid" id="fw-stat-grid"></div>
                </div>
              </div>
              <button class="fw-btn-continue" onclick="FocusWorld.continueGame()">スタート ▶</button>
              <div class="fw-yurumi-box" id="fw-yurumi-box"></div>
            </div>
            <div class="fw-hub-navbar">
              <button class="fw-navbar-btn" onclick="FocusWorld.showChapters()"><span>⚔</span>冒険</button>
              <button class="fw-navbar-btn" onclick="FocusWorld.showEquip()"><span>🛡</span>装備</button>
              <button class="fw-navbar-btn" onclick="FocusWorld.showShop()"><span>🛒</span>ショップ</button>
            </div>
          </div>

          <div class="fw-view fw-view-chapters" id="fw-v-chapters">
            <p class="fw-eyebrow">ADVENTURE</p>
            <h2 class="fw-title">敵の気配</h2>
            <div id="fw-enemy-list"></div>
            <button class="fw-btn-ghost fw-back-btn" onclick="FocusWorld.showHome()">← もどる</button>
          </div>

          <div class="fw-view fw-view-equip" id="fw-v-equip">
            <p class="fw-eyebrow">EQUIPMENT</p>
            <h2 class="fw-title">装備(最大${MAX_EQUIPPED}個まで)</h2>
            <div id="fw-equip-list" class="fw-equip-list"></div>
            <button class="fw-btn-ghost fw-back-btn" onclick="FocusWorld.showHome()">← もどる</button>
          </div>

          <div class="fw-view fw-view-shop" id="fw-v-shop">
            <p class="fw-eyebrow">SHOP</p>
            <h2 class="fw-title" id="fw-yeen-title">YEEN: 0</h2>
            <div class="fw-tabs">
              <button class="fw-tab" id="fw-tab-gacha" onclick="FocusWorld.setShopTab('gacha')">装備ガチャ</button>
              <button class="fw-tab" id="fw-tab-skill" onclick="FocusWorld.setShopTab('skill')">わざ</button>
              <button class="fw-tab" id="fw-tab-buff" onclick="FocusWorld.setShopTab('buff')">バフ</button>
              <button class="fw-tab" id="fw-tab-item" onclick="FocusWorld.setShopTab('item')">どうぐ</button>
            </div>
            <div id="fw-shop-body"></div>
            <button class="fw-btn-ghost fw-back-btn" onclick="FocusWorld.showHome()">← もどる</button>
          </div>

          <div class="fw-view fw-view-game fw-view-corridor" id="fw-v-corridor" onclick="FocusWorld.corridorAdvance()">
            <div class="fw-corridor-wrap">
              <div class="fw-corridor-track" id="fw-corridor-track">
                <div class="fw-corridor-lane"></div>
              </div>
              <div class="fw-corridor-walker" id="fw-corridor-walker">
                <span class="fw-walk-frame fw-walk-frame-1">${fwSpriteImg("hero_walk1", 48)}</span>
                <span class="fw-walk-frame fw-walk-frame-2">${fwSpriteImg("hero_walk2", 48)}</span>
              </div>
              <p class="fw-corridor-quote" id="fw-corridor-quote"></p>
              <p class="fw-corridor-hint">タップ、または→キーで奥へ</p>
            </div>
          </div>

          <div class="fw-view fw-view-game" id="fw-v-intro">
            <div class="fw-intro-wrap" onclick="FocusWorld.skipIntro()">
              <div class="fw-intro-text" id="fw-intro-text"></div>
              <p class="fw-intro-skip">タップして進める</p>
            </div>
          </div>

          <div class="fw-view fw-view-game" id="fw-v-battle">
            <div class="fw-battle-wrap">
              <div class="fw-battle-top">
                <div class="fw-enemy-tag">
                  <span class="fw-nm" id="fw-enemy-name"></span>
                  <div class="fw-bar-row">
                    <span class="fw-bar-label">HP</span>
                    <div class="fw-hpbar"><div class="fw-hpbar-fill" id="fw-enemy-hp"></div></div>
                    <span class="fw-bar-num" id="fw-enemy-hp-num"></span>
                  </div>
                </div>
                <div class="fw-enemy-sprite" id="fw-enemy-sprite"></div>
                <p class="fw-battle-log" id="fw-battle-log"></p>
              </div>
              <div class="fw-battle-bottom">
                <div class="fw-player-row">
                  <div class="fw-player-tag">
                    <span class="fw-nm" id="fw-player-name"></span>
                    <div class="fw-bar-row">
                      <span class="fw-bar-label">HP</span>
                      <div class="fw-hpbar"><div class="fw-hpbar-fill fw-player-hpbar-fill" id="fw-player-hp"></div></div>
                      <span class="fw-bar-num" id="fw-player-hp-num"></span>
                    </div>
                    <div class="fw-bar-row">
                      <span class="fw-bar-label">MP</span>
                      <div class="fw-mp-track"><div class="fw-mp-fill" id="fw-player-mp"></div></div>
                      <span class="fw-bar-num" id="fw-player-mp-num"></span>
                    </div>
                  </div>
                  <div class="fw-lv-badge" id="fw-player-lv"></div>
                </div>
                <div class="fw-battle-actions" id="fw-battle-actions">
                  <button class="fw-fight-btn" id="fw-fight-btn" onclick="FocusWorld.act('attack')">たたかう</button>
                  <button class="fw-fight-btn" id="fw-special-btn" onclick="FocusWorld.openSkillMenu()">とくぎ</button>
                  <button class="fw-fight-btn" id="fw-item-btn" onclick="FocusWorld.openItemMenu()">どうぐ</button>
                  <button class="fw-fight-btn" id="fw-defend-btn" onclick="FocusWorld.act('defend')">ふせぐ</button>
                </div>
                <div class="fw-item-menu" id="fw-item-menu">
                  <div class="fw-item-menu-list" id="fw-item-menu-list"></div>
                  <button class="fw-fight-btn fw-item-menu-back" onclick="FocusWorld.closeItemMenu()">← もどる</button>
                </div>
                <div class="fw-item-menu" id="fw-skill-menu">
                  <div class="fw-item-menu-list" id="fw-skill-menu-list"></div>
                  <button class="fw-fight-btn fw-item-menu-back" onclick="FocusWorld.closeSkillMenu()">← もどる</button>
                </div>
              </div>
            </div>
          </div>

          <div class="fw-view fw-view-game" id="fw-v-result">
            <div class="fw-result-wrap">
              <p class="fw-result-title" id="fw-result-title"></p>
              <div class="fw-result-quote" id="fw-result-quote"></div>
              <div class="fw-reward-row"><span>獲得 EXP</span><span class="fw-val" id="fw-result-xp"></span></div>
              <div class="fw-reward-row"><span>獲得 YEEN</span><span class="fw-val" id="fw-result-yeen"></span></div>
              <div class="fw-reward-row fw-dim" id="fw-result-drop"><span>装備ドロップ</span><span class="fw-val"></span></div>
              <div class="fw-reward-row fw-dim"><span>図鑑</span><span class="fw-val" id="fw-result-dex"></span></div>
              <div class="fw-result-btn" onclick="FocusWorld.close()">とじる</div>
            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  function fwGoView(id) {
    document.querySelectorAll("#fw-overlay .fw-view").forEach((v) => v.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function fwToast(msg) {
    let t = document.getElementById("fw-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "fw-toast";
      t.className = "fw-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove("show");
    void t.offsetWidth;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function fwUpdateLauncherBadge() {
    const undefeated = ENEMIES.some((e) => !FW.dex.includes(e.id));
    const btn = document.getElementById("fw-launcher");
    if (btn) btn.classList.toggle("fw-launcher-alert", undefeated);
    const tabBtn = document.getElementById("fw-tabbtn");
    if (tabBtn) tabBtn.classList.toggle("fw-tabbtn-alert", undefeated);
  }

  /* ---- ホーム画面 ---- */
  function fwRenderHome() {
    const grid = document.getElementById("fw-stat-grid");
    if (!grid) return;
    const eff = fwEffectiveStats(false);
    grid.innerHTML = `
      <div class="fw-level-block">Lv.${fwLevel()} <span>EXP ${FW.xp}</span></div>
      ${FIVE_STATS.map((k) => `
        <div class="fw-stat-cell">
          <span class="fw-stat-key">${STAT_LABEL[k]}</span>
          <span class="fw-stat-val">${Math.round(eff[k])}</span>
        </div>`).join("")}
    `;
    const list = document.getElementById("fw-enemy-list");
    if (list) {
      list.innerHTML = CHAPTERS.map((chapter) => {
        const cardsHtml = chapter.enemyIds.map((id) => {
          const e = ENEMIES.find((x) => x.id === id);
          if (!e) return "";
          const beaten = FW.dex.includes(e.id);
          const wc = fwWinCount(e.id);
          const subText = wc > 0
            ? `討伐 ${wc}回・今は本来の${Math.round(fwEnemyEffective(e).scale * 100)}%の強さ`
            : "未討伐";
          return `
            <div class="fw-gate-card ${beaten ? "fw-beaten" : ""} ${e.boss ? "fw-gate-boss" : ""}" onclick="FocusWorld.startBattle('${e.id}')">
              <div class="fw-gate-sprite">${fwEnemySvg(e, 46)}</div>
              <div class="fw-gate-info">
                <p class="fw-gate-title">${e.name} <span class="fw-gate-lv">Lv.${e.level}</span>${e.boss ? `<span class="fw-gate-boss-tag">中ボス</span>` : ""}</p>
                <p class="fw-gate-sub">${subText}</p>
              </div>
              <span class="fw-gate-arrow">→</span>
            </div>`;
        }).join("");
        // この章のあとに解放されるナミダイベントがあれば末尾に差し込む
        const namidaEvt = NAMIDA_EVENTS.find((n) => n.afterChapter === chapter.id);
        const namidaHtml = (namidaEvt && fwChapterCleared(chapter))
          ? (FW.namidaSeen.includes(namidaEvt.id)
            ? `<div class="fw-gate-card fw-beaten fw-gate-namida"><div class="fw-gate-sprite">${fwSpriteImg("namida", 46)}</div><div class="fw-gate-info"><p class="fw-gate-title">ナミダ</p><p class="fw-gate-sub">もう会えないかもしれない…</p></div></div>`
            : `<div class="fw-gate-card fw-gate-namida" onclick="FocusWorld.startNamida('${namidaEvt.id}')"><div class="fw-gate-sprite">${fwSpriteImg("namida", 46)}</div><div class="fw-gate-info"><p class="fw-gate-title">ナミダ <span class="fw-gate-lv">非戦闘</span></p><p class="fw-gate-sub">何かが、そこにいる…</p></div><span class="fw-gate-arrow">→</span></div>`)
          : "";
        return `
          <p class="fw-section-label fw-chapter-label" style="color:${chapter.color}">${chapter.title}</p>
          <div class="fw-chapter-group" style="--chapter-color:${chapter.color}">${cardsHtml}${namidaHtml}</div>
        `;
      }).join("");
    }
    fwRenderYurumi();
  }

  /* ---- ユルミ(相棒ウィジェット) ---- */
  function fwRenderYurumi() {
    const el = document.getElementById("fw-yurumi-box");
    if (!el) return;
    // ミハリ撃破(第2章クリア相当)以降に姿を見せ始める
    const unlocked = FW.dex.includes("mihari") || FW.dex.some((id) => CHAPTERS[1].enemyIds.includes(id));
    if (!unlocked) { el.style.display = "none"; return; }
    el.style.display = "";
    const line = YURUMI_LINES[(FW.yurumiDepend || 0) % YURUMI_LINES.length];
    el.innerHTML = `
      <div class="fw-yurumi-sprite">${fwSpriteImg("yurumi", 40)}</div>
      <div class="fw-yurumi-body">
        <p class="fw-yurumi-name">ユルミ</p>
        <p class="fw-yurumi-line">${line}</p>
      </div>
      <button class="fw-btn-mini" onclick="FocusWorld.talkYurumi()">はなす</button>
    `;
  }

  function fwTalkYurumi() {
    const next = (FW.yurumiDepend || 0) + 1;
    FW.yurumiDepend = next;
    fwSave({ fw_yurumi_depend: next });
    // ちいさな見返り(依存を可視化するための演出。回復薬を1つ渡す)
    const items = Object.assign({}, FW.items);
    items.potion_small = (items.potion_small || 0) + 1;
    FW.items = items;
    fwSave({ fw_items: items });
    fwToast("ユルミが 小さな回復薬をくれた");
    fwRenderYurumi();
  }

  /* ---- ナミダ(非戦闘イベント) ---- */
  let namidaCurrent = null;
  function fwStartNamida(eventId) {
    const evt = NAMIDA_EVENTS.find((n) => n.id === eventId);
    if (!evt || FW.namidaSeen.includes(eventId)) return;
    namidaCurrent = evt;
    introLines = evt.lines.slice();
    introStep = 0;
    fwGoView("fw-v-intro");
    document.getElementById("fw-intro-text").innerHTML = "";
    fwNamidaTypeNext();
  }
  function fwNamidaTypeNext() {
    if (introStep >= introLines.length) { setTimeout(fwShowNamidaChoice, 400); return; }
    const wrap = document.getElementById("fw-intro-text");
    const p = document.createElement("p");
    p.className = "fw-ln";
    wrap.appendChild(p);
    const text = introLines[introStep];
    let i = 0;
    const iv = setInterval(() => {
      p.textContent = text.slice(0, i + 1);
      i++;
      if (i >= text.length) {
        clearInterval(iv);
        introStep++;
        setTimeout(fwNamidaTypeNext, 260);
      }
    }, 32);
  }
  function fwShowNamidaChoice() {
    const wrap = document.getElementById("fw-intro-text");
    const choice = document.createElement("div");
    choice.className = "fw-namida-choice";
    choice.innerHTML = `
      <button class="fw-fight-btn" onclick="FocusWorld.namidaRespond('talk')">みまもる/はなす</button>
      <button class="fw-fight-btn" onclick="FocusWorld.namidaRespond('hit')">たたかう</button>
    `;
    wrap.appendChild(choice);
  }
  function fwNamidaRespond(kind) {
    const evt = namidaCurrent;
    if (!evt) return;
    const wrap = document.getElementById("fw-intro-text");
    wrap.innerHTML = "";
    let lines;
    if (evt.id === "namida3") {
      lines = kind === "talk" ? evt.talkLinesGood : evt.talkLinesBad;
      FW.namidaGood = kind === "talk";
      fwSave({ fw_namida_good: FW.namidaGood });
    } else {
      lines = kind === "talk" ? evt.talkLines : evt.hitLines;
    }
    if (kind === "talk") {
      const next = (FW.mercyCount || 0) + 1;
      FW.mercyCount = next;
      fwSave({ fw_mercy_count: next });
    }
    const nextSeen = FW.namidaSeen.concat([evt.id]);
    FW.namidaSeen = nextSeen;
    fwSave({ fw_namida_seen: nextSeen });
    lines.forEach((t) => {
      const p = document.createElement("p");
      p.className = "fw-ln";
      p.textContent = t;
      wrap.appendChild(p);
    });
    const backBtn = document.createElement("button");
    backBtn.className = "fw-fight-btn fw-item-menu-back";
    backBtn.textContent = "← もどる";
    backBtn.onclick = () => { namidaCurrent = null; FocusWorld.showHome(); };
    wrap.appendChild(backBtn);
  }

  /* ---- 装備画面 ---- */
  function fwRenderEquip() {
    const list = document.getElementById("fw-equip-list");
    if (!list) return;
    if (FW.equipment.length === 0) {
      list.innerHTML = `<p class="fw-empty">まだ装備を持っていません。ショップのガチャで手に入れよう。</p>`;
      return;
    }
    list.innerHTML = FW.equipment.map((id) => {
      const item = EQUIPMENT_CATALOG.find((e) => e.id === id);
      if (!item) return "";
      const on = FW.equipped.includes(id);
      const bonusText = Object.keys(item.bonus).map((k) => `${STAT_LABEL[k]}+${item.bonus[k]}`).join(" ");
      return `
        <div class="fw-equip-row ${on ? "fw-on" : ""}" onclick="FocusWorld.toggleEquip('${id}')">
          <span class="fw-rarity" style="color:${RARITY_COLOR[item.rarity]}">${item.rarity}</span>
          <span class="fw-equip-name">${item.name}</span>
          <span class="fw-equip-bonus">${bonusText}</span>
          <span class="fw-equip-check">${on ? "装備中" : ""}</span>
        </div>`;
    }).join("");
  }

  function fwToggleEquip(id) {
    const has = FW.equipped.includes(id);
    let next;
    if (has) {
      next = FW.equipped.filter((x) => x !== id);
    } else {
      if (FW.equipped.length >= MAX_EQUIPPED) { fwToast(`装備は最大${MAX_EQUIPPED}個までです`); return; }
      next = FW.equipped.concat([id]);
    }
    FW.equipped = next;
    fwSave({ fw_equipped: next });
    fwRenderEquip();
    fwRenderHome();
  }

  /* ---- ショップ画面 ---- */
  function fwRenderShop() {
    const title = document.getElementById("fw-yeen-title");
    if (title) title.textContent = `YEEN: ${(typeof currentUserCoins !== "undefined" ? currentUserCoins : 0).toLocaleString()}`;
    document.getElementById("fw-tab-gacha").classList.toggle("active", FW.shopTab === "gacha");
    document.getElementById("fw-tab-skill").classList.toggle("active", FW.shopTab === "skill");
    document.getElementById("fw-tab-buff").classList.toggle("active", FW.shopTab === "buff");
    document.getElementById("fw-tab-item").classList.toggle("active", FW.shopTab === "item");
    const body = document.getElementById("fw-shop-body");
    if (!body) return;
    if (FW.shopTab === "item") {
      body.innerHTML = `
        <p class="fw-shop-desc">購入するとストックされ、バトル中に「どうぐ」コマンドでいつでも使えます。</p>
        <div class="fw-catalog-list">
          ${ITEM_CATALOG.map((it) => {
            const count = FW.items[it.id] || 0;
            return `
            <div class="fw-catalog-row">
              <span class="fw-equip-name">${it.name}${count ? `<span class="fw-buff-count"> ×${count}</span>` : ""}</span>
              <span class="fw-equip-bonus">${it.desc}</span>
              <button class="fw-btn-mini" onclick="FocusWorld.buyItem('${it.id}')">${it.price} YEEN</button>
            </div>`;
          }).join("")}
        </div>
      `;
    } else if (FW.shopTab === "gacha") {
      body.innerHTML = `
        <p class="fw-shop-desc">1回 ${GACHA_COST} YEEN。装備がランダムで手に入ります(すでに持っている場合は${Math.round(DUPLICATE_REFUND_RATE * 100)}%のYEENを返却)。</p>
        <button class="fw-btn-accent" onclick="FocusWorld.gachaPull()">ガチャを引く</button>
        <p class="fw-section-label">ラインナップ(全${RARITY_ORDER.length}ランク・${EQUIPMENT_CATALOG.length}種)</p>
        <div class="fw-catalog-list">
          ${RARITY_ORDER.map((rarity) => EQUIPMENT_CATALOG.filter((item) => item.rarity === rarity).map((item) => `
            <div class="fw-catalog-row">
              <span class="fw-rarity" style="color:${RARITY_COLOR[item.rarity]}" title="${RARITY_LABEL[item.rarity]}">${item.rarity}</span>
              <span class="fw-equip-name">${item.name}</span>
              <span class="fw-equip-bonus">${Object.keys(item.bonus).map((k) => `${STAT_LABEL[k]}+${item.bonus[k]}`).join(" ")}</span>
            </div>`).join("")).join("")}
        </div>
      `;
    } else if (FW.shopTab === "skill") {
      body.innerHTML = `
        <p class="fw-shop-desc">YEENを払うと、そのわざを永久に習得できます。習得したわざはバトル中「とくぎ」からいつでも使えます。</p>
        <div class="fw-catalog-list">
          ${SKILL_CATALOG.filter((s) => s.id !== "basic_strike").map((s) => {
            const known = (FW.skills || []).includes(s.id);
            return `
            <div class="fw-catalog-row">
              <span class="fw-equip-name">${s.name}${s.element ? `<span class="fw-buff-count"> [${s.element}属性]</span>` : "<span class=\"fw-buff-count\"> [無属性]</span>"}</span>
              <span class="fw-equip-bonus">${s.desc}(MP${s.mpCost})</span>
              ${known
                ? `<span class="fw-btn-mini" style="opacity:.5;">習得済み</span>`
                : `<button class="fw-btn-mini" onclick="FocusWorld.learnSkill('${s.id}')">${s.price} YEEN</button>`}
            </div>`;
          }).join("")}
        </div>
      `;
    } else {
      body.innerHTML = `
        <p class="fw-shop-desc">購入すると次のバトル開始時に効果が発動し、消費されます(スタックできます)。</p>
        <div class="fw-catalog-list">
          ${BUFF_CATALOG.map((b) => {
            const count = FW.buffs[b.id] || 0;
            return `
            <div class="fw-catalog-row">
              <span class="fw-equip-name">${b.name}${count ? `<span class="fw-buff-count"> ×${count}</span>` : ""}</span>
              <span class="fw-equip-bonus">${b.desc}</span>
              <button class="fw-btn-mini" onclick="FocusWorld.buyBuff('${b.id}')">${b.price} YEEN</button>
            </div>`;
          }).join("")}
        </div>
      `;
    }
  }

  function fwSetShopTab(tab) { FW.shopTab = tab; fwRenderShop(); }

  function fwGachaPull() {
    const coins = typeof currentUserCoins !== "undefined" ? currentUserCoins : 0;
    if (coins < GACHA_COST) { fwToast("YEENが足りません"); return; }
    const totalWeight = Object.values(RARITY_WEIGHT).reduce((a, b) => a + b, 0);
    let r = Math.random() * totalWeight;
    let rarity = "N";
    for (const key of Object.keys(RARITY_WEIGHT)) {
      if (r < RARITY_WEIGHT[key]) { rarity = key; break; }
      r -= RARITY_WEIGHT[key];
    }
    const pool = EQUIPMENT_CATALOG.filter((e) => e.rarity === rarity);
    const picked = pool[Math.floor(Math.random() * pool.length)];
    adjustCoins(-GACHA_COST);
    if (FW.equipment.includes(picked.id)) {
      const refund = Math.round(GACHA_COST * DUPLICATE_REFUND_RATE);
      adjustCoins(refund);
      fwToast(`${picked.name}(重複) → ${refund} YEEN還元`);
    } else {
      const next = FW.equipment.concat([picked.id]);
      FW.equipment = next;
      fwSave({ fw_equipment: next });
      fwToast(`★${picked.rarity} ${picked.name} を手に入れた!`);
    }
    setTimeout(fwRenderShop, 250);
  }

  function fwLearnSkill(id) {
    const def = SKILL_CATALOG.find((s) => s.id === id);
    if (!def) return;
    const known = FW.skills || ["basic_strike"];
    if (known.includes(id)) { fwToast("すでに習得しています"); return; }
    const coins = typeof currentUserCoins !== "undefined" ? currentUserCoins : 0;
    if (coins < def.price) { fwToast("YEENが足りません"); return; }
    adjustCoins(-def.price);
    const next = known.concat([id]);
    FW.skills = next;
    fwSave({ fw_skills: next });
    fwToast(`「${def.name}」を習得しました!`);
    setTimeout(fwRenderShop, 250);
  }

  function fwBuyBuff(id) {
    const def = BUFF_CATALOG.find((b) => b.id === id);
    if (!def) return;
    const coins = typeof currentUserCoins !== "undefined" ? currentUserCoins : 0;
    if (coins < def.price) { fwToast("YEENが足りません"); return; }
    adjustCoins(-def.price);
    const next = Object.assign({}, FW.buffs);
    next[id] = (next[id] || 0) + 1;
    FW.buffs = next;
    fwSave({ fw_buffs: next });
    fwToast(`${def.name} を購入しました`);
    setTimeout(fwRenderShop, 250);
  }

  function fwBuyItem(id) {
    const def = ITEM_CATALOG.find((it) => it.id === id);
    if (!def) return;
    const coins = typeof currentUserCoins !== "undefined" ? currentUserCoins : 0;
    if (coins < def.price) { fwToast("YEENが足りません"); return; }
    adjustCoins(-def.price);
    const next = Object.assign({}, FW.items);
    next[id] = (next[id] || 0) + 1;
    FW.items = next;
    fwSave({ fw_items: next });
    fwToast(`${def.name} を購入しました`);
    setTimeout(fwRenderShop, 250);
  }

  /* ---- 敵SVG(ドット絵をピクセル単位のrectで再現。画像ファイル不要) ---- */
  const SPRITE_PIXELS = {
    aseri: { w:32, h:32, pal:["#000000","#881400","#a81000","#fcfcfc","#f87858","#f0d0b0","#503000"], px:[[6,9,2,0],[7,10,3,0],[15,10,2,0],[8,11,1,0],[9,11,1,1],[10,11,2,0],[13,11,2,0],[15,11,1,1],[16,11,1,0],[8,12,2,0],[10,12,2,1],[12,12,2,0],[14,12,2,2],[16,12,1,0],[19,12,5,0],[10,13,1,0],[11,13,2,2],[13,13,1,3],[14,13,2,2],[16,13,3,0],[19,13,2,2],[21,13,1,1],[22,13,1,0],[8,14,2,0],[10,14,1,2],[11,14,3,3],[14,14,1,2],[15,14,3,3],[18,14,2,2],[20,14,1,1],[21,14,2,0],[8,15,1,0],[9,15,1,3],[10,15,6,2],[16,15,2,3],[18,15,1,2],[19,15,1,1],[20,15,1,0],[5,16,3,0],[8,16,2,2],[10,16,1,3],[11,16,14,0],[5,17,2,0],[7,17,2,2],[9,17,3,0],[12,17,7,4],[19,17,3,0],[23,17,2,0],[6,18,3,0],[10,18,1,0],[11,18,2,5],[13,18,4,4],[17,18,1,5],[18,18,2,4],[20,18,4,0],[9,19,1,0],[10,19,8,5],[18,19,1,4],[19,19,2,0],[9,20,1,0],[10,20,8,5],[18,20,7,0],[9,21,2,0],[11,21,1,5],[12,21,7,0],[19,21,3,1],[22,21,1,6],[23,21,1,1],[24,21,1,0],[10,22,4,0],[14,22,7,1],[21,22,3,6],[24,22,1,1],[25,22,1,0],[12,23,2,0],[14,23,1,1],[15,23,6,6],[21,23,1,1],[22,23,2,6],[24,23,1,1],[25,23,1,0],[11,24,2,0],[13,24,1,6],[14,24,1,1],[15,24,6,6],[21,24,3,1],[24,24,1,6],[25,24,1,0],[11,25,2,0],[13,25,5,6],[18,25,1,1],[19,25,3,6],[22,25,2,1],[24,25,1,6],[25,25,1,0],[12,26,1,0],[13,26,3,6],[16,26,1,1],[17,26,1,6],[18,26,2,1],[20,26,2,6],[22,26,2,1],[24,26,1,6],[25,26,1,0],[12,27,2,0],[14,27,2,6],[16,27,1,1],[17,27,2,6],[19,27,1,1],[20,27,2,6],[22,27,2,1],[24,27,1,6],[25,27,1,0],[13,28,1,0],[14,28,2,6],[16,28,1,1],[17,28,2,6],[19,28,2,1],[21,28,1,6],[22,28,1,1],[23,28,1,6],[24,28,1,0],[13,29,1,0],[14,29,2,6],[16,29,1,1],[17,29,3,6],[20,29,1,1],[21,29,1,6],[22,29,1,1],[23,29,1,6],[24,29,1,0],[13,30,1,0],[14,30,1,6],[15,30,2,1],[17,30,2,6],[19,30,2,1],[21,30,1,6],[22,30,1,1],[23,30,1,6],[24,30,2,0],[13,31,1,0],[14,31,2,6],[16,31,2,1],[18,31,1,6],[19,31,1,1],[20,31,5,6],[25,31,1,0]] },
    mayoi: { w:32, h:32, pal:["#000000","#3f3f74","#76428a","#d9a066","#222034","#eec39a","#8f563b"], px:[[12,8,7,0],[10,9,2,0],[12,9,7,1],[19,9,4,0],[4,10,6,0],[10,10,1,1],[11,10,5,2],[16,10,4,1],[20,10,3,2],[23,10,2,0],[2,11,1,0],[3,11,6,2],[9,11,2,1],[11,11,3,0],[14,11,8,1],[22,11,2,2],[24,11,2,0],[1,12,2,0],[3,12,1,2],[4,12,12,1],[16,12,4,0],[20,12,3,1],[23,12,2,2],[25,12,1,0],[0,13,2,0],[2,13,1,2],[3,13,6,1],[9,13,5,2],[14,13,1,1],[15,13,1,0],[20,13,3,0],[23,13,3,1],[26,13,1,0],[0,14,2,2],[2,14,4,1],[6,14,3,2],[9,14,2,1],[11,14,1,2],[12,14,4,1],[16,14,1,0],[23,14,4,0],[0,15,9,0],[9,15,3,1],[12,15,3,2],[15,15,2,1],[17,15,1,0],[5,16,1,0],[6,16,2,3],[8,16,14,0],[5,17,1,0],[6,17,6,3],[12,17,1,0],[13,17,9,4],[22,17,6,0],[4,18,1,0],[5,18,3,5],[8,18,3,3],[11,18,1,6],[12,18,1,3],[13,18,1,0],[14,18,13,4],[27,18,2,0],[4,19,2,0],[6,19,3,5],[9,19,2,3],[11,19,1,6],[12,19,1,3],[13,19,1,0],[14,19,14,4],[28,19,1,0],[5,20,1,0],[6,20,4,5],[10,20,2,3],[12,20,1,0],[13,20,3,1],[16,20,13,4],[29,20,1,0],[6,21,1,0],[7,21,3,5],[10,21,1,3],[11,21,1,0],[12,21,2,1],[14,21,5,4],[19,21,2,1],[21,21,8,4],[29,21,1,0],[7,22,4,0],[11,22,1,1],[12,22,9,4],[21,22,1,1],[22,22,6,4],[28,22,1,0],[10,23,1,0],[11,23,10,4],[21,23,1,1],[22,23,6,4],[28,23,1,0],[10,24,1,0],[11,24,1,4],[12,24,1,0],[13,24,8,4],[21,24,2,1],[23,24,5,4],[28,24,1,0],[11,25,2,0],[13,25,16,4],[29,25,1,0],[12,26,1,0],[13,26,1,1],[14,26,15,4],[29,26,2,0],[12,27,1,0],[13,27,1,1],[14,27,6,4],[20,27,2,1],[22,27,1,4],[23,27,1,1],[24,27,8,4],[12,28,1,0],[13,28,1,1],[14,28,7,4],[21,28,4,1],[25,28,7,4],[12,29,1,0],[13,29,1,1],[14,29,1,4],[15,29,1,1],[16,29,8,4],[24,29,2,1],[26,29,5,4],[31,29,1,1],[12,30,1,0],[13,30,1,1],[14,30,2,4],[16,30,1,1],[17,30,15,4],[12,31,2,0],[14,31,1,1],[15,31,1,4],[16,31,1,1],[17,31,15,4]] },
    namake: { w:32, h:32, pal:["#000000","#f4f4f4","#dfa4af","#d8c29c","#566c86","#baa57d"], px:[[10,7,4,0],[7,8,1,0],[11,8,1,0],[12,8,2,1],[14,8,1,0],[7,9,2,0],[12,9,1,0],[13,9,2,1],[15,9,1,0],[7,10,1,0],[8,10,1,1],[9,10,1,0],[11,10,2,0],[13,10,2,1],[15,10,1,2],[16,10,1,0],[8,11,1,0],[9,11,1,1],[10,11,3,0],[13,11,1,1],[14,11,3,2],[17,11,1,0],[8,12,1,0],[9,12,1,1],[10,12,2,2],[12,12,1,0],[13,12,1,1],[14,12,3,2],[17,12,1,0],[8,13,1,0],[9,13,2,2],[11,13,4,0],[15,13,1,2],[16,13,3,0],[8,14,1,0],[9,14,1,2],[10,14,1,0],[11,14,1,3],[12,14,1,0],[13,14,1,3],[14,14,2,0],[16,14,1,4],[17,14,3,0],[8,15,2,0],[10,15,5,3],[15,15,4,0],[19,15,1,4],[20,15,1,0],[7,16,1,0],[8,16,2,3],[10,16,1,0],[11,16,5,3],[16,16,1,0],[17,16,1,4],[18,16,3,0],[7,17,1,0],[8,17,7,3],[15,17,1,0],[16,17,1,4],[17,17,3,0],[20,17,1,4],[21,17,1,0],[7,18,2,0],[9,18,5,3],[14,18,2,5],[16,18,3,0],[19,18,1,4],[20,18,2,0],[8,19,1,0],[9,19,6,3],[15,19,1,5],[16,19,1,0],[17,19,1,4],[18,19,1,0],[19,19,1,4],[20,19,1,0],[21,19,1,4],[22,19,1,0],[8,20,1,0],[9,20,6,3],[15,20,1,5],[16,20,1,0],[17,20,1,4],[18,20,1,0],[19,20,1,4],[20,20,1,0],[21,20,1,4],[22,20,1,0],[8,21,1,0],[9,21,1,5],[10,21,6,3],[16,21,1,5],[17,21,3,0],[20,21,1,4],[21,21,2,0],[8,22,1,0],[9,22,1,5],[10,22,6,3],[16,22,1,5],[17,22,3,0],[20,22,1,4],[21,22,2,0],[8,23,1,0],[9,23,1,5],[10,23,6,3],[16,23,1,5],[17,23,4,0],[21,23,1,4],[22,23,1,0],[8,24,1,0],[9,24,1,5],[10,24,7,3],[17,24,1,5],[18,24,3,0],[21,24,1,4],[22,24,1,0],[8,25,1,0],[9,25,1,5],[10,25,7,3],[17,25,1,5],[18,25,2,0],[20,25,1,4],[21,25,2,0],[8,26,1,0],[9,26,1,5],[10,26,8,3],[18,26,1,5],[19,26,3,0],[8,27,1,0],[9,27,2,5],[11,27,6,3],[17,27,2,5],[19,27,2,0],[8,28,1,0],[9,28,4,5],[13,28,3,3],[16,28,3,5],[19,28,2,0],[9,29,1,0],[10,29,8,5],[18,29,3,0],[9,30,1,0],[10,30,6,5],[16,30,2,0],[20,30,2,0],[10,31,6,0],[21,31,1,0]] },
    // ↓ ここから追加(送っていただいた画像のピクセル座標をそのまま写した新キャラたち)
    crab: { w:32, h:32, pal:["#000000", "#639bff", "#df7126", "#8f563b", "#cbdbfc", "#663931"], px:[[18,2,2,0],[17,3,4,0],[17,4,1,0],[18,4,2,1],[20,4,1,0],[27,4,3,0],[16,5,1,0],[17,5,4,1],[21,5,1,0],[27,5,1,0],[28,5,1,2],[29,5,1,0],[5,6,2,0],[12,6,2,0],[16,6,2,0],[18,6,1,1],[19,6,1,0],[20,6,1,1],[21,6,1,0],[27,6,1,0],[28,6,1,2],[29,6,1,0],[4,7,1,0],[5,7,1,2],[6,7,1,0],[11,7,2,0],[13,7,1,1],[14,7,1,0],[17,7,1,0],[18,7,1,1],[19,7,1,0],[20,7,1,1],[21,7,1,0],[23,7,5,0],[28,7,1,2],[29,7,1,0],[0,8,2,0],[3,8,1,0],[4,8,2,2],[6,8,1,0],[11,8,1,0],[12,8,2,1],[14,8,1,0],[17,8,1,0],[18,8,1,1],[19,8,1,0],[20,8,1,1],[21,8,1,0],[23,8,1,0],[24,8,2,3],[26,8,1,2],[27,8,1,0],[28,8,1,2],[29,8,1,0],[0,9,1,0],[1,9,1,3],[2,9,2,0],[4,9,2,2],[6,9,1,0],[11,9,1,0],[12,9,1,1],[13,9,1,0],[14,9,1,1],[15,9,1,0],[17,9,1,0],[18,9,2,1],[20,9,1,0],[23,9,2,0],[25,9,1,3],[26,9,3,2],[29,9,1,0],[0,10,1,0],[1,10,1,3],[2,10,1,2],[3,10,1,0],[4,10,1,2],[5,10,2,0],[11,10,1,0],[12,10,1,1],[13,10,1,0],[14,10,1,1],[15,10,1,0],[17,10,1,0],[18,10,1,1],[19,10,1,4],[20,10,1,0],[24,10,2,0],[26,10,1,3],[27,10,1,2],[28,10,3,0],[0,11,1,0],[1,11,1,3],[2,11,3,2],[5,11,1,0],[12,11,1,0],[13,11,1,1],[14,11,1,4],[15,11,1,0],[18,11,2,0],[25,11,2,0],[27,11,2,2],[29,11,1,3],[30,11,1,0],[0,12,1,0],[1,12,2,3],[3,12,2,2],[5,12,2,0],[12,12,1,0],[13,12,2,4],[15,12,7,0],[25,12,1,0],[26,12,1,3],[27,12,2,2],[29,12,1,3],[30,12,1,0],[1,13,1,0],[2,13,1,3],[3,13,3,2],[6,13,3,0],[13,13,3,0],[16,13,2,2],[18,13,1,0],[19,13,2,2],[21,13,3,0],[26,13,1,0],[27,13,1,3],[28,13,1,2],[29,13,1,3],[30,13,1,0],[1,14,1,0],[2,14,2,3],[4,14,5,2],[9,14,2,0],[13,14,2,0],[15,14,8,2],[23,14,4,0],[27,14,2,3],[29,14,1,0],[2,15,1,0],[3,15,3,3],[6,15,4,2],[10,15,4,0],[14,15,9,2],[23,15,2,0],[25,15,3,3],[28,15,2,0],[3,16,2,0],[5,16,3,3],[8,16,3,2],[11,16,1,0],[12,16,9,2],[21,16,1,0],[22,16,2,2],[24,16,1,0],[25,16,3,3],[28,16,1,0],[5,17,5,0],[10,17,1,2],[11,17,1,0],[12,17,1,3],[13,17,7,2],[20,17,1,0],[21,17,3,2],[24,17,3,0],[10,18,2,0],[12,18,1,3],[13,18,2,2],[15,18,1,0],[16,18,4,2],[20,18,1,0],[21,18,2,2],[23,18,1,5],[24,18,1,0],[11,19,1,0],[12,19,3,3],[15,19,1,2],[16,19,4,0],[20,19,2,2],[22,19,2,5],[24,19,1,0],[11,20,2,0],[13,20,2,3],[15,20,4,2],[19,20,4,5],[23,20,2,0],[11,21,1,0],[12,21,3,3],[15,21,5,5],[20,21,4,0],[10,22,1,0],[11,22,1,3],[12,22,10,0],[22,22,1,5],[23,22,3,0],[9,23,1,0],[10,23,2,3],[12,23,2,0],[21,23,2,0],[23,23,2,5],[25,23,1,0],[9,24,1,0],[10,24,2,3],[12,24,1,0],[22,24,2,0],[24,24,1,5],[25,24,1,0],[9,25,2,0],[11,25,1,3],[12,25,1,0],[23,25,2,0],[10,26,1,0],[11,26,1,3],[12,26,1,0],[23,26,2,0],[10,27,3,0],[24,27,1,0]] },
    char: { w:32, h:32, pal:["#140c1c", "#6daa2c", "#346524", "#d2aa99", "#4e4a4f", "#757161"], px:[[16,9,5,0],[13,10,4,0],[17,10,3,1],[20,10,2,0],[13,11,1,0],[14,11,7,1],[21,11,1,0],[13,12,1,0],[14,12,7,1],[21,12,2,0],[12,13,2,0],[14,13,8,1],[22,13,1,0],[11,14,2,0],[13,14,2,1],[15,14,1,2],[16,14,1,1],[17,14,1,2],[18,14,2,0],[20,14,1,2],[21,14,1,1],[22,14,1,0],[11,15,1,0],[12,15,2,1],[14,15,1,0],[15,15,1,1],[16,15,1,2],[17,15,3,0],[20,15,1,2],[21,15,1,1],[22,15,2,0],[11,16,2,0],[13,16,1,2],[14,16,2,0],[16,16,1,2],[17,16,1,0],[18,16,1,3],[19,16,2,0],[21,16,1,2],[22,16,1,1],[23,16,1,0],[12,17,1,0],[13,17,1,2],[14,17,2,0],[16,17,1,1],[17,17,1,0],[18,17,2,3],[20,17,2,0],[22,17,1,2],[23,17,1,0],[12,18,1,0],[13,18,1,2],[14,18,4,0],[18,18,3,3],[21,18,3,0],[12,19,3,0],[15,19,4,3],[19,19,2,4],[21,19,1,3],[22,19,1,0],[14,20,1,0],[15,20,5,3],[20,20,3,0],[14,21,7,0],[17,22,1,0],[18,22,1,3],[19,22,1,0],[15,23,3,0],[18,23,2,5],[20,23,3,0],[14,24,1,0],[15,24,8,5],[23,24,1,0],[13,25,1,0],[14,25,1,5],[15,25,1,4],[16,25,8,5],[24,25,1,0],[13,26,1,0],[14,26,1,4],[15,26,9,5],[24,26,1,0],[13,27,1,0],[14,27,1,5],[15,27,1,4],[16,27,6,5],[22,27,2,4],[24,27,1,0],[14,28,1,0],[15,28,1,4],[16,28,3,5],[19,28,1,4],[20,28,2,5],[22,28,2,4],[24,28,1,0],[14,29,1,0],[15,29,1,5],[16,29,2,4],[18,29,4,5],[22,29,1,4],[23,29,1,5],[24,29,1,0],[14,30,1,0],[15,30,1,5],[16,30,2,4],[18,30,1,5],[19,30,1,4],[20,30,2,5],[22,30,1,4],[23,30,1,5],[24,30,1,0],[14,31,1,0],[15,31,1,5],[16,31,2,4],[18,31,1,5],[19,31,1,4],[20,31,4,5],[24,31,1,0]] },
    torii: { w:32, h:32, pal:["#000000", "#8b9bb4", "#5a6988", "#3a4466", "#b86f50", "#e4a672", "#ead4aa"], px:[[13,10,14,0],[10,11,3,0],[13,11,14,1],[27,11,2,0],[9,12,1,0],[10,12,4,1],[14,12,12,2],[26,12,2,3],[28,12,1,0],[8,13,1,0],[9,13,2,1],[11,13,4,2],[15,13,12,3],[27,13,2,0],[7,14,1,0],[8,14,2,1],[10,14,2,2],[12,14,4,3],[16,14,12,0],[6,15,1,0],[7,15,2,1],[9,15,2,2],[11,15,2,3],[13,15,3,0],[19,15,1,0],[20,15,1,4],[21,15,1,0],[6,16,1,0],[7,16,1,1],[8,16,3,2],[11,16,1,3],[12,16,1,0],[18,16,1,0],[19,16,1,4],[20,16,1,5],[21,16,1,6],[22,16,1,0],[6,17,1,0],[7,17,1,1],[8,17,2,2],[10,17,2,3],[12,17,1,0],[18,17,1,0],[19,17,1,4],[20,17,1,5],[21,17,1,6],[22,17,1,0],[6,18,1,0],[7,18,1,1],[8,18,2,2],[10,18,1,3],[11,18,1,0],[18,18,1,0],[19,18,1,4],[20,18,1,5],[21,18,1,6],[22,18,1,0],[6,19,1,0],[7,19,1,1],[8,19,2,2],[10,19,1,3],[11,19,1,0],[18,19,1,0],[19,19,1,4],[20,19,1,5],[21,19,1,6],[22,19,1,0],[6,20,1,0],[7,20,1,1],[8,20,2,2],[10,20,1,3],[11,20,1,0],[17,20,1,0],[18,20,1,4],[19,20,1,5],[20,20,3,6],[23,20,1,0],[6,21,1,0],[7,21,1,1],[8,21,2,2],[10,21,1,3],[11,21,1,0],[17,21,1,0],[18,21,1,4],[19,21,1,5],[20,21,3,6],[23,21,1,0],[6,22,1,0],[7,22,1,1],[8,22,2,2],[10,22,1,3],[11,22,1,0],[17,22,1,0],[18,22,1,4],[19,22,1,5],[20,22,3,6],[23,22,1,0],[6,23,1,0],[7,23,1,1],[8,23,2,2],[10,23,1,3],[11,23,1,0],[16,23,1,0],[17,23,1,4],[18,23,1,5],[19,23,5,6],[24,23,1,0],[6,24,1,0],[7,24,1,1],[8,24,2,2],[10,24,1,3],[11,24,1,0],[16,24,1,0],[17,24,1,4],[18,24,1,5],[19,24,5,6],[24,24,1,0],[6,25,1,0],[7,25,1,1],[8,25,2,2],[10,25,1,3],[11,25,1,0],[16,25,1,0],[17,25,1,4],[18,25,1,5],[19,25,5,6],[24,25,1,0],[6,26,1,0],[7,26,1,1],[8,26,2,2],[10,26,1,3],[11,26,1,0],[15,26,1,0],[16,26,1,4],[17,26,1,5],[18,26,7,6],[25,26,1,0],[6,27,1,0],[7,27,1,1],[8,27,2,2],[10,27,1,3],[11,27,1,0],[15,27,1,0],[16,27,1,4],[17,27,1,5],[18,27,7,6],[25,27,1,0],[6,28,1,0],[7,28,1,1],[8,28,2,2],[10,28,1,3],[11,28,1,0],[15,28,1,0],[16,28,1,4],[17,28,1,5],[18,28,7,6],[25,28,1,0],[6,29,1,0],[7,29,1,1],[8,29,2,2],[10,29,1,3],[11,29,1,0],[15,29,1,0],[16,29,1,4],[17,29,1,5],[18,29,7,6],[25,29,1,0],[6,30,1,0],[7,30,1,1],[8,30,2,2],[10,30,1,3],[11,30,1,0],[14,30,1,0],[15,30,1,4],[16,30,1,5],[17,30,9,6],[26,30,1,0],[6,31,1,0],[7,31,1,1],[8,31,2,2],[10,31,1,3],[11,31,1,0],[14,31,1,0],[15,31,1,4],[16,31,1,5],[17,31,9,6],[26,31,1,0]] },
    shoe: { w:32, h:32, pal:["#000000", "#e4a672", "#b86f50", "#d77643", "#3e2731", "#ead4aa", "#733e39", "#2ce8f5"], px:[[24,13,1,0],[23,14,1,0],[24,14,1,1],[25,14,1,0],[22,15,1,0],[23,15,1,1],[24,15,1,2],[25,15,1,1],[26,15,1,0],[15,16,7,0],[22,16,1,1],[23,16,1,2],[24,16,1,3],[25,16,1,2],[26,16,1,1],[27,16,1,0],[10,17,6,0],[16,17,4,4],[20,17,1,0],[21,17,1,1],[22,17,1,2],[23,17,1,3],[24,17,1,5],[25,17,1,3],[26,17,1,2],[27,17,1,1],[28,17,1,0],[8,18,3,0],[11,18,3,4],[14,18,3,2],[17,18,1,6],[18,18,4,0],[22,18,1,1],[23,18,1,2],[24,18,1,3],[25,18,1,2],[26,18,1,1],[27,18,1,0],[6,19,3,0],[9,19,1,4],[10,19,1,6],[11,19,3,2],[14,19,4,6],[18,19,2,0],[22,19,1,0],[23,19,1,1],[24,19,1,2],[25,19,1,1],[26,19,1,0],[6,20,1,0],[7,20,11,6],[18,20,6,0],[24,20,1,1],[25,20,1,0],[6,21,3,0],[9,21,1,2],[10,21,1,6],[11,21,1,7],[12,21,7,6],[19,21,5,4],[24,21,2,0],[6,22,1,0],[7,22,13,6],[20,22,3,2],[23,22,2,6],[25,22,2,0],[6,23,2,0],[8,23,1,4],[9,23,6,6],[15,23,4,2],[19,23,5,6],[24,23,2,4],[26,23,1,0],[6,24,2,0],[8,24,5,4],[13,24,5,6],[18,24,9,4],[27,24,1,0],[7,25,6,0],[13,25,5,4],[18,25,10,0],[12,26,7,0]] },
    llama: { w:32, h:32, pal:["#000000", "#ffffff", "#c0cbdc", "#5a6988", "#3a4466", "#8b9bb4"], px:[[8,1,2,0],[7,2,1,0],[8,2,1,1],[9,2,2,0],[5,3,2,0],[7,3,1,1],[8,3,3,2],[11,3,1,0],[5,4,1,0],[6,4,4,1],[10,4,1,2],[11,4,1,0],[4,5,1,0],[5,5,2,1],[7,5,2,0],[9,5,1,1],[10,5,1,2],[11,5,1,0],[4,6,3,0],[7,6,3,1],[10,6,1,2],[11,6,1,1],[12,6,1,0],[6,7,2,0],[8,7,2,1],[10,7,1,2],[11,7,1,1],[12,7,1,0],[6,8,1,0],[7,8,2,1],[9,8,1,2],[10,8,1,1],[11,8,1,2],[12,8,1,0],[6,9,1,0],[7,9,3,1],[10,9,2,2],[12,9,1,0],[5,10,1,0],[6,10,1,1],[7,10,2,2],[9,10,1,1],[10,10,1,2],[11,10,1,1],[12,10,1,0],[5,11,1,0],[6,11,1,1],[7,11,1,2],[8,11,4,1],[12,11,1,0],[5,12,1,0],[6,12,1,1],[7,12,1,2],[8,12,4,1],[12,12,1,0],[6,13,1,0],[7,13,2,2],[9,13,1,1],[10,13,1,2],[11,13,1,1],[12,13,1,0],[6,14,1,0],[7,14,1,1],[8,14,1,2],[9,14,3,1],[12,14,1,0],[6,15,1,0],[7,15,5,1],[12,15,2,0],[6,16,1,0],[7,16,1,2],[8,16,1,1],[9,16,1,2],[10,16,3,1],[13,16,2,0],[6,17,1,0],[7,17,1,2],[8,17,2,1],[10,17,3,2],[13,17,2,1],[15,17,10,0],[6,18,1,0],[7,18,3,2],[10,18,2,1],[12,18,1,2],[13,18,9,1],[22,18,3,2],[25,18,2,0],[6,19,1,0],[7,19,1,1],[8,19,1,2],[9,19,5,1],[14,19,2,2],[16,19,1,1],[17,19,1,2],[18,19,4,1],[22,19,1,2],[23,19,1,1],[24,19,2,2],[26,19,1,1],[27,19,1,0],[6,20,2,0],[8,20,1,2],[9,20,1,3],[10,20,4,1],[14,20,3,2],[17,20,5,1],[22,20,2,2],[24,20,1,1],[25,20,3,2],[28,20,1,0],[7,21,1,0],[8,21,1,1],[9,21,1,3],[10,21,6,1],[16,21,2,2],[18,21,2,1],[20,21,1,3],[21,21,2,1],[23,21,1,2],[24,21,1,1],[25,21,1,2],[26,21,1,1],[27,21,1,3],[28,21,1,0],[7,22,1,0],[8,22,1,1],[9,22,5,2],[14,22,2,1],[16,22,1,2],[17,22,3,1],[20,22,1,2],[21,22,5,1],[26,22,1,2],[27,22,1,3],[28,22,1,0],[7,23,1,0],[8,23,3,3],[11,23,1,2],[12,23,3,1],[15,23,3,3],[18,23,1,1],[19,23,1,2],[20,23,1,3],[21,23,1,2],[22,23,3,1],[25,23,1,2],[26,23,1,3],[27,23,1,2],[28,23,1,0],[7,24,3,0],[10,24,2,3],[12,24,1,2],[13,24,2,1],[15,24,1,3],[16,24,1,2],[17,24,1,1],[18,24,1,2],[19,24,1,1],[20,24,1,3],[21,24,4,2],[25,24,2,3],[27,24,1,0],[9,25,2,0],[11,25,1,2],[12,25,2,3],[14,25,1,2],[15,25,3,1],[18,25,3,0],[21,25,2,2],[23,25,1,3],[24,25,3,0],[10,26,2,0],[12,26,1,1],[13,26,2,2],[15,26,3,0],[20,26,1,0],[21,26,1,2],[22,26,2,0],[11,27,1,0],[12,27,2,4],[15,27,1,0],[20,27,1,0],[21,27,1,5],[22,27,1,0],[11,28,1,0],[12,28,1,5],[13,28,2,0],[20,28,1,0],[21,28,1,1],[22,28,1,0],[11,29,1,0],[12,29,1,5],[13,29,1,0],[20,29,1,0],[21,29,1,5],[22,29,1,0],[11,30,1,0],[12,30,1,1],[13,30,1,0],[20,30,1,0],[21,30,1,5],[22,30,1,0],[11,31,1,0],[12,31,1,5],[13,31,1,0],[20,31,1,0],[21,31,1,1],[22,31,1,0]] },
    gem: { w:32, h:32, pal:["#000000", "#0f380f", "#8bac0f", "#9bbc0f", "#aff49a", "#306230"], px:[[13,8,10,0],[10,9,3,0],[13,9,9,1],[22,9,1,2],[23,9,2,0],[9,10,1,0],[10,10,2,1],[12,10,1,3],[13,10,1,1],[14,10,10,2],[24,10,1,1],[25,10,1,0],[8,11,1,0],[9,11,2,1],[11,11,1,3],[12,11,6,1],[18,11,8,2],[26,11,2,0],[7,12,1,0],[8,12,1,3],[9,12,1,1],[10,12,1,3],[11,12,5,1],[16,12,2,2],[18,12,4,1],[22,12,1,3],[23,12,1,4],[24,12,1,2],[25,12,1,4],[26,12,1,2],[27,12,1,1],[28,12,1,0],[6,13,1,0],[7,13,1,1],[8,13,3,3],[11,13,1,1],[12,13,2,3],[14,13,3,1],[17,13,7,2],[24,13,2,4],[26,13,1,2],[27,13,1,4],[28,13,1,1],[29,13,1,0],[6,14,1,0],[7,14,2,3],[9,14,1,1],[10,14,1,3],[11,14,1,1],[12,14,1,3],[13,14,6,1],[19,14,2,2],[21,14,3,1],[24,14,1,2],[25,14,3,4],[28,14,1,2],[29,14,1,0],[6,15,1,0],[7,15,1,3],[8,15,2,5],[10,15,1,3],[11,15,10,1],[21,15,2,2],[23,15,2,1],[25,15,4,4],[29,15,1,1],[30,15,1,0],[5,16,1,0],[6,16,1,5],[7,16,1,3],[8,16,2,5],[10,16,2,3],[12,16,2,1],[14,16,1,5],[15,16,8,1],[23,16,1,2],[24,16,1,1],[25,16,1,4],[26,16,1,3],[27,16,2,4],[29,16,1,1],[30,16,1,0],[5,17,1,0],[6,17,1,5],[7,17,1,3],[8,17,2,5],[10,17,2,1],[12,17,1,5],[13,17,1,3],[14,17,1,1],[15,17,2,5],[17,17,3,1],[20,17,1,2],[21,17,3,1],[24,17,1,2],[25,17,1,4],[26,17,1,2],[27,17,3,4],[30,17,1,0],[5,18,1,0],[6,18,1,1],[7,18,4,5],[11,18,2,1],[13,18,1,5],[14,18,3,1],[17,18,2,5],[19,18,3,2],[22,18,2,1],[24,18,1,4],[25,18,1,2],[26,18,3,4],[29,18,1,1],[30,18,1,0],[5,19,1,0],[6,19,2,5],[8,19,1,1],[9,19,1,5],[10,19,1,2],[11,19,3,1],[14,19,1,5],[15,19,4,1],[19,19,2,2],[21,19,1,1],[22,19,4,2],[26,19,1,1],[27,19,1,4],[28,19,2,1],[30,19,1,0],[5,20,1,0],[6,20,1,1],[7,20,1,2],[8,20,1,5],[9,20,1,1],[10,20,1,5],[11,20,3,1],[14,20,1,3],[15,20,1,5],[16,20,2,1],[18,20,1,2],[19,20,2,1],[21,20,4,2],[25,20,2,4],[27,20,2,1],[29,20,1,0],[6,21,1,0],[7,21,1,1],[8,21,5,5],[13,21,2,1],[15,21,1,5],[16,21,2,3],[18,21,5,2],[23,21,1,1],[24,21,1,2],[25,21,3,1],[28,21,1,0],[7,22,1,0],[8,22,3,2],[11,22,3,5],[14,22,1,1],[15,22,1,2],[16,22,3,1],[19,22,3,3],[22,22,2,5],[24,22,3,1],[27,22,1,0],[8,23,1,0],[9,23,1,1],[10,23,3,5],[13,23,1,2],[14,23,2,5],[16,23,4,1],[20,23,1,2],[21,23,4,1],[25,23,2,0],[8,24,2,0],[11,24,1,1],[12,24,2,5],[14,24,2,2],[16,24,6,5],[22,24,2,1],[24,24,1,0],[11,25,2,0],[13,25,1,2],[14,25,5,5],[19,25,3,1],[22,25,2,0],[13,26,9,0]] },
    ghost: { w:32, h:32, pal:["#0c0c0c", "#3c3c3c", "#3c6c84", "#9cb4b4", "#cce4fc", "#fcfcfc"], px:[[17,10,2,0],[7,11,7,0],[16,11,1,0],[17,11,2,5],[19,11,1,0],[23,11,1,0],[6,12,1,0],[7,12,7,5],[14,12,2,0],[16,12,4,5],[20,12,3,0],[23,12,1,5],[24,12,1,0],[5,13,1,0],[6,13,1,2],[7,13,7,5],[14,13,1,0],[15,13,10,5],[25,13,1,0],[5,14,1,0],[6,14,1,1],[7,14,1,2],[8,14,5,5],[13,14,1,0],[14,14,11,5],[25,14,1,0],[4,15,1,0],[5,15,2,1],[7,15,1,2],[8,15,4,5],[12,15,1,4],[13,15,1,0],[14,15,12,5],[26,15,1,0],[4,16,1,0],[5,16,2,1],[7,16,1,2],[8,16,5,5],[13,16,1,0],[14,16,1,5],[15,16,2,0],[17,16,4,5],[21,16,1,3],[22,16,3,5],[25,16,1,4],[26,16,1,0],[4,17,1,0],[5,17,2,1],[7,17,1,2],[8,17,5,5],[13,17,1,0],[14,17,1,5],[15,17,2,0],[17,17,7,5],[24,17,1,4],[25,17,1,5],[26,17,1,0],[4,18,1,0],[5,18,1,1],[6,18,1,2],[7,18,5,5],[12,18,1,0],[13,18,3,5],[16,18,1,0],[17,18,7,5],[24,18,1,4],[25,18,1,5],[26,18,1,0],[4,19,1,0],[5,19,1,1],[6,19,1,2],[7,19,5,5],[12,19,1,0],[13,19,10,5],[23,19,1,3],[24,19,1,4],[25,19,1,5],[26,19,1,0],[4,20,1,0],[5,20,1,2],[6,20,1,5],[7,20,1,4],[8,20,4,5],[12,20,1,0],[13,20,12,5],[25,20,1,0],[4,21,1,0],[5,21,1,2],[6,21,1,5],[7,21,1,4],[8,21,5,5],[13,21,2,0],[15,21,3,4],[18,21,1,0],[19,21,5,5],[24,21,1,4],[25,21,1,0],[4,22,1,0],[5,22,2,5],[7,22,1,4],[8,22,1,5],[9,22,1,4],[10,22,5,5],[15,22,4,0],[19,22,5,5],[24,22,1,4],[25,22,1,0],[4,23,1,0],[5,23,3,5],[8,23,1,3],[9,23,4,5],[13,23,1,4],[14,23,10,5],[24,23,1,4],[5,24,1,0],[6,24,4,5],[10,24,1,4],[11,24,7,5],[18,24,1,3],[19,24,2,5],[21,24,1,3],[22,24,1,4],[23,24,1,5],[24,24,1,0],[5,25,2,0],[7,25,2,5],[9,25,1,4],[10,25,5,5],[15,25,1,4],[16,25,5,5],[21,25,1,3],[22,25,1,5],[23,25,1,0],[6,26,1,0],[7,26,2,5],[9,26,1,4],[10,26,2,3],[12,26,2,5],[14,26,1,3],[15,26,2,5],[17,26,1,4],[18,26,3,5],[21,26,1,3],[22,26,1,0],[6,27,2,0],[8,27,1,5],[9,27,1,4],[10,27,2,5],[12,27,1,0],[13,27,2,5],[15,27,4,3],[19,27,1,4],[20,27,2,3],[22,27,1,0],[7,28,1,0],[8,28,1,5],[9,28,1,4],[10,28,1,3],[11,28,1,5],[12,28,3,0],[15,28,4,5],[19,28,1,4],[20,28,2,3],[22,28,1,0],[7,29,1,0],[8,29,1,5],[9,29,1,4],[10,29,2,5],[12,29,1,0],[14,29,1,0],[15,29,1,3],[16,29,2,5],[18,29,1,0],[19,29,1,4],[20,29,2,3],[22,29,1,0],[7,30,1,0],[8,30,1,5],[9,30,1,0],[10,30,1,5],[11,30,1,0],[15,30,1,3],[16,30,2,5],[18,30,1,0],[19,30,1,4],[20,30,1,3],[21,30,1,5],[22,30,1,0],[7,31,1,0],[8,31,1,5],[9,31,1,0],[10,31,1,5],[11,31,1,0],[15,31,1,0],[16,31,1,3],[17,31,1,5],[18,31,1,0],[19,31,3,5],[22,31,1,0]] },
    bluebird: { w:32, h:32, pal:["#0c0c0c", "#242424", "#243c6c", "#3c3c54", "#546c84", "#3c54cc", "#3c9cfc", "#6ce4fc", "#fcfcfc"], px:[[13,5,11,0],[11,6,2,0],[13,6,9,6],[22,6,2,5],[24,6,2,0],[10,7,1,0],[11,7,1,7],[12,7,7,6],[19,7,1,7],[20,7,4,6],[24,7,2,5],[26,7,2,0],[9,8,1,0],[10,8,1,7],[11,8,6,6],[17,8,1,7],[18,8,6,6],[24,8,4,5],[28,8,1,0],[8,9,1,0],[9,9,5,7],[14,9,1,6],[15,9,2,7],[17,9,3,6],[20,9,6,0],[26,9,3,5],[29,9,1,0],[8,10,1,0],[9,10,4,7],[13,10,1,6],[14,10,3,7],[17,10,1,6],[18,10,1,7],[19,10,1,0],[20,10,6,3],[26,10,2,0],[28,10,1,5],[29,10,1,0],[7,11,1,0],[8,11,4,7],[12,11,1,6],[13,11,3,7],[16,11,1,6],[17,11,1,7],[18,11,1,0],[19,11,9,3],[28,11,2,0],[7,12,1,0],[8,12,8,7],[16,12,1,6],[17,12,1,7],[18,12,1,0],[19,12,6,3],[25,12,1,2],[26,12,1,3],[27,12,1,2],[28,12,1,3],[29,12,1,0],[8,13,2,0],[10,13,1,7],[11,13,2,6],[13,13,3,7],[16,13,1,6],[17,13,1,7],[18,13,1,0],[19,13,1,2],[20,13,4,3],[24,13,1,2],[25,13,3,0],[28,13,1,2],[29,13,1,0],[10,14,3,0],[13,14,1,6],[14,14,1,7],[15,14,1,6],[16,14,1,7],[17,14,1,6],[18,14,1,0],[19,14,2,2],[21,14,1,3],[22,14,2,2],[24,14,1,0],[25,14,2,7],[27,14,1,8],[28,14,2,0],[11,15,1,0],[12,15,1,6],[13,15,1,0],[14,15,3,7],[17,15,1,6],[18,15,1,0],[19,15,5,2],[24,15,1,0],[25,15,1,7],[26,15,1,8],[27,15,3,0],[11,16,1,0],[12,16,1,6],[13,16,1,2],[14,16,4,0],[18,16,2,2],[20,16,1,5],[21,16,4,2],[25,16,3,0],[28,16,1,1],[29,16,1,0],[10,17,1,0],[11,17,1,5],[12,17,1,6],[13,17,1,5],[14,17,2,2],[16,17,1,5],[17,17,2,2],[19,17,1,5],[20,17,1,2],[21,17,2,5],[23,17,3,2],[26,17,1,5],[27,17,1,2],[28,17,1,1],[29,17,1,0],[10,18,2,6],[12,18,3,2],[15,18,1,5],[16,18,1,2],[17,18,2,5],[19,18,1,2],[20,18,2,5],[22,18,2,2],[24,18,4,5],[28,18,1,0],[7,19,3,0],[10,19,1,5],[11,19,2,2],[13,19,8,5],[21,19,1,2],[22,19,5,5],[27,19,1,2],[28,19,1,0],[6,20,1,0],[7,20,3,5],[10,20,1,4],[11,20,1,5],[12,20,1,4],[13,20,13,5],[26,20,2,2],[5,21,1,0],[6,21,1,5],[7,21,1,4],[8,21,8,5],[16,21,1,4],[17,21,8,5],[25,21,1,2],[26,21,1,1],[27,21,1,0],[11,22,5,4],[16,22,1,5],[17,22,2,4],[19,22,2,5],[21,22,1,4],[22,22,4,5],[26,22,1,0],[18,23,4,4],[22,23,1,5],[23,23,2,2],[25,23,1,0],[22,24,2,2],[24,24,1,0]] },
    peanut: { w:32, h:32, pal:["#0c0c0c", "#6c3c3c", "#84543c", "#e46c24", "#e49c6c", "#e4cc9c"], px:[[8,1,10,0],[6,2,3,0],[9,2,2,3],[11,2,1,4],[12,2,5,3],[17,2,2,0],[5,3,2,0],[7,3,1,3],[8,3,1,5],[9,3,3,4],[12,3,1,3],[13,3,3,4],[16,3,2,3],[18,3,2,0],[5,4,1,0],[6,4,1,4],[7,4,2,5],[9,4,2,4],[11,4,8,3],[19,4,2,0],[5,5,1,0],[6,5,1,4],[7,5,1,5],[8,5,1,4],[9,5,11,3],[20,5,1,0],[5,6,1,0],[6,6,2,5],[8,6,8,3],[16,6,1,0],[17,6,3,3],[20,6,1,0],[5,7,1,0],[6,7,1,2],[7,7,1,4],[8,7,8,3],[16,7,2,0],[18,7,1,3],[19,7,1,2],[20,7,1,0],[5,8,1,0],[6,8,1,2],[7,8,1,4],[8,8,1,3],[9,8,2,0],[11,8,5,3],[16,8,2,0],[18,8,3,3],[21,8,1,0],[5,9,1,0],[6,9,1,2],[7,9,1,4],[8,9,1,3],[9,9,2,0],[11,9,8,3],[19,9,2,2],[21,9,1,0],[5,10,2,0],[7,10,1,2],[8,10,1,3],[9,10,2,0],[11,10,6,3],[17,10,1,2],[18,10,1,3],[19,10,2,2],[21,10,2,0],[6,11,1,0],[7,11,1,2],[8,11,9,3],[17,11,1,2],[18,11,1,3],[19,11,2,2],[21,11,1,3],[22,11,1,0],[6,12,1,0],[7,12,1,2],[8,12,9,3],[17,12,1,2],[18,12,2,3],[20,12,2,2],[22,12,1,0],[6,13,2,0],[8,13,9,3],[17,13,1,2],[18,13,2,3],[20,13,2,2],[22,13,1,0],[7,14,1,0],[8,14,1,3],[9,14,1,2],[10,14,7,3],[17,14,2,2],[19,14,1,3],[20,14,2,2],[22,14,1,0],[7,15,2,0],[9,15,8,3],[17,15,1,2],[18,15,1,3],[19,15,2,2],[21,15,1,3],[22,15,1,0],[8,16,2,0],[10,16,1,2],[11,16,3,3],[14,16,1,2],[15,16,1,3],[16,16,2,2],[18,16,1,3],[19,16,1,2],[20,16,1,3],[21,16,1,2],[22,16,2,0],[9,17,2,0],[11,17,2,2],[13,17,2,3],[15,17,2,2],[17,17,1,3],[18,17,2,2],[20,17,2,3],[22,17,1,2],[23,17,1,0],[10,18,2,0],[12,18,1,3],[13,18,1,2],[14,18,1,3],[15,18,2,2],[17,18,1,3],[18,18,2,2],[20,18,2,3],[22,18,1,1],[23,18,2,0],[11,19,2,0],[13,19,1,2],[14,19,2,3],[16,19,3,2],[19,19,1,3],[20,19,1,2],[21,19,1,3],[22,19,2,1],[24,19,1,0],[12,20,1,0],[13,20,1,1],[14,20,1,2],[15,20,2,3],[17,20,1,2],[18,20,1,3],[19,20,1,2],[20,20,1,3],[21,20,3,1],[24,20,1,0],[12,21,1,0],[13,21,3,1],[16,21,2,3],[18,21,1,2],[19,21,1,3],[20,21,4,1],[24,21,1,0],[12,22,1,0],[13,22,4,1],[17,22,2,3],[19,22,5,1],[24,22,2,0],[12,23,2,0],[14,23,9,1],[23,23,3,0],[13,24,3,0],[16,24,6,1],[22,24,2,0],[15,25,3,0],[18,25,2,1],[20,25,3,0],[17,26,4,0]] },
    vine: { w:32, h:32, pal:["#0c0c0c", "#24243c", "#243c3c", "#24543c", "#3c8454", "#6ccc54"], px:[[10,2,6,0],[18,2,7,0],[7,3,4,0],[11,3,3,5],[14,3,5,0],[19,3,2,4],[21,3,1,5],[22,3,2,4],[24,3,1,0],[5,4,3,0],[8,4,3,5],[11,4,1,3],[12,4,4,4],[16,4,2,0],[18,4,1,4],[19,4,2,5],[21,4,1,3],[22,4,2,4],[24,4,2,0],[3,5,3,0],[6,5,3,5],[9,5,3,4],[12,5,3,3],[15,5,1,4],[16,5,2,0],[18,5,1,5],[19,5,1,3],[20,5,2,4],[22,5,2,3],[24,5,1,4],[25,5,2,0],[2,6,2,0],[4,6,1,4],[5,6,2,5],[7,6,4,4],[11,6,1,0],[12,6,2,4],[14,6,2,3],[16,6,2,4],[18,6,1,5],[19,6,1,3],[20,6,1,4],[21,6,1,0],[22,6,1,4],[23,6,2,3],[25,6,1,4],[26,6,1,0],[2,7,1,0],[3,7,2,4],[5,7,2,3],[7,7,1,4],[8,7,6,0],[14,7,1,4],[15,7,1,3],[16,7,1,4],[17,7,1,5],[18,7,2,3],[20,7,3,0],[23,7,1,4],[24,7,1,3],[25,7,1,4],[26,7,2,0],[2,8,7,0],[13,8,2,0],[15,8,2,4],[17,8,2,3],[19,8,2,0],[22,8,1,0],[23,8,2,4],[25,8,1,3],[26,8,1,4],[27,8,1,0],[14,9,3,0],[17,9,2,3],[19,9,1,0],[22,9,2,0],[24,9,1,4],[25,9,1,3],[26,9,1,4],[27,9,1,0],[15,10,2,0],[17,10,2,3],[19,10,1,0],[23,10,1,0],[24,10,1,4],[25,10,1,3],[26,10,1,4],[27,10,1,0],[15,11,1,0],[16,11,1,3],[17,11,2,4],[19,11,1,0],[23,11,1,0],[24,11,1,4],[25,11,1,3],[26,11,1,4],[27,11,1,0],[15,12,1,0],[16,12,1,3],[17,12,2,4],[19,12,1,0],[23,12,2,0],[25,12,1,3],[26,12,1,4],[27,12,1,0],[15,13,1,0],[16,13,1,3],[17,13,2,4],[19,13,1,0],[24,13,1,0],[25,13,1,3],[26,13,1,4],[27,13,1,0],[15,14,1,0],[16,14,1,3],[17,14,1,4],[18,14,2,0],[24,14,2,0],[26,14,1,4],[27,14,1,0],[13,15,2,2],[15,15,1,0],[16,15,1,3],[17,15,1,4],[18,15,2,0],[20,15,1,2],[25,15,1,0],[26,15,1,4],[27,15,1,0],[12,16,3,2],[15,16,1,0],[16,16,1,3],[17,16,1,4],[18,16,1,0],[19,16,3,2],[25,16,3,0],[11,17,4,2],[15,17,1,0],[16,17,1,3],[17,17,1,4],[18,17,1,0],[19,17,4,2],[10,18,3,2],[13,18,2,1],[15,18,1,0],[16,18,1,3],[17,18,1,4],[18,18,1,0],[19,18,4,2],[10,19,3,2],[13,19,2,1],[15,19,5,0],[20,19,3,2],[11,20,2,2],[13,20,7,1],[20,20,2,2],[11,21,3,2],[14,21,7,1],[21,21,1,2],[13,22,7,2],[14,23,5,2]] },
    thorn: { w:32, h:32, pal:["#0c0c0c", "#543c0c", "#6c2424", "#b40c0c", "#6c3c3c", "#fc3c0c"], px:[[21,5,2,0],[19,6,4,0],[16,7,3,0],[19,7,3,3],[22,7,1,0],[15,8,1,0],[16,8,4,3],[20,8,2,2],[22,8,1,0],[14,9,1,0],[15,9,2,3],[17,9,5,2],[22,9,1,0],[12,10,2,0],[14,10,2,3],[16,10,6,2],[22,10,1,0],[12,11,2,0],[14,11,1,3],[15,11,7,2],[22,11,1,0],[13,12,1,0],[14,12,1,2],[15,12,1,3],[16,12,6,2],[22,12,1,0],[13,13,1,0],[14,13,1,3],[15,13,4,2],[19,13,2,0],[21,13,1,2],[22,13,1,0],[12,14,1,0],[13,14,2,3],[15,14,4,2],[19,14,4,0],[11,15,1,0],[12,15,1,3],[13,15,1,5],[14,15,2,3],[16,15,3,2],[19,15,1,0],[21,15,2,0],[10,16,1,0],[11,16,3,3],[14,16,5,2],[19,16,1,0],[22,16,1,0],[10,17,1,0],[11,17,1,3],[12,17,7,2],[19,17,1,0],[9,18,1,0],[10,18,1,3],[11,18,2,0],[13,18,5,2],[18,18,1,4],[19,18,1,0],[8,19,1,0],[9,19,1,3],[10,19,1,5],[11,19,2,0],[13,19,2,2],[15,19,2,0],[17,19,1,2],[18,19,1,4],[19,19,1,0],[8,20,1,0],[9,20,1,5],[10,20,2,3],[12,20,3,2],[15,20,2,0],[17,20,2,2],[19,20,1,0],[8,21,1,0],[9,21,3,3],[12,21,6,2],[18,21,1,0],[7,22,1,0],[8,22,3,3],[11,22,6,2],[17,22,1,4],[18,22,1,0],[7,23,1,0],[8,23,1,5],[9,23,2,3],[11,23,6,2],[17,23,1,4],[18,23,1,0],[7,24,1,0],[8,24,1,5],[9,24,1,3],[10,24,6,2],[16,24,2,0],[7,25,1,0],[8,25,2,3],[10,25,5,2],[15,25,1,4],[16,25,1,0],[8,26,1,0],[9,26,1,3],[10,26,5,2],[15,26,1,4],[16,26,1,0],[8,27,1,0],[9,27,1,2],[10,27,1,3],[11,27,4,2],[15,27,1,0],[6,28,2,0],[8,28,1,5],[9,28,3,2],[12,28,2,4],[14,28,1,1],[15,28,1,0],[6,29,1,0],[7,29,1,3],[8,29,1,2],[9,29,1,0],[10,29,4,2],[14,29,1,1],[15,29,1,0],[5,30,1,0],[6,30,1,3],[7,30,1,2],[8,30,2,0],[10,30,1,2],[11,30,1,0],[12,30,1,2],[13,30,2,1],[15,30,1,0],[4,31,1,0],[5,31,1,3],[6,31,2,0],[8,31,2,2],[10,31,1,0],[11,31,1,2],[12,31,1,1],[13,31,1,0],[14,31,1,1],[15,31,1,0]] },
    chick: { w:32, h:32, pal:["#0c0c0c", "#246c24", "#fc3c3c", "#fc9c0c", "#fccc0c", "#fccc84", "#fcfc9c"], px:[[18,5,4,0],[17,6,1,0],[18,6,4,3],[22,6,2,0],[17,7,1,0],[18,7,1,3],[19,7,3,5],[22,7,2,3],[24,7,1,5],[25,7,2,0],[16,8,6,0],[22,8,3,3],[25,8,1,5],[26,8,1,3],[27,8,1,0],[14,9,2,0],[16,9,1,4],[17,9,2,6],[19,9,1,1],[20,9,1,6],[21,9,1,5],[22,9,2,0],[24,9,3,3],[27,9,2,0],[13,10,1,0],[14,10,6,4],[20,10,2,1],[22,10,1,4],[23,10,2,0],[25,10,1,5],[26,10,3,3],[29,10,1,0],[11,11,2,0],[13,11,2,4],[15,11,1,2],[16,11,6,4],[22,11,1,5],[23,11,1,4],[24,11,2,0],[26,11,1,5],[27,11,2,3],[29,11,1,0],[10,12,1,0],[11,12,2,4],[13,12,2,6],[15,12,2,2],[17,12,2,4],[19,12,2,2],[21,12,4,4],[25,12,1,1],[26,12,1,0],[27,12,1,5],[28,12,2,3],[30,12,1,0],[9,13,1,0],[10,13,3,6],[13,13,2,4],[15,13,1,1],[16,13,2,4],[18,13,1,3],[19,13,3,2],[22,13,2,4],[24,13,1,3],[25,13,1,5],[26,13,2,0],[28,13,1,5],[29,13,1,3],[30,13,1,0],[9,14,1,6],[10,14,1,4],[11,14,1,3],[12,14,1,6],[13,14,2,4],[15,14,2,1],[17,14,3,4],[20,14,2,2],[22,14,1,4],[23,14,2,3],[25,14,2,5],[27,14,1,0],[28,14,2,3],[30,14,1,0],[8,15,1,0],[9,15,1,6],[10,15,1,4],[11,15,2,3],[13,15,2,4],[15,15,2,2],[17,15,2,4],[19,15,7,3],[26,15,1,4],[27,15,2,0],[29,15,1,3],[30,15,1,0],[8,16,1,0],[9,16,2,2],[11,16,2,4],[13,16,1,1],[14,16,1,4],[15,16,2,2],[17,16,1,4],[18,16,1,1],[19,16,3,3],[22,16,5,0],[28,16,3,0],[8,17,1,0],[9,17,3,1],[12,17,2,4],[14,17,3,3],[17,17,1,4],[18,17,1,3],[19,17,1,4],[20,17,1,3],[21,17,2,0],[26,17,1,0],[8,18,1,0],[9,18,2,1],[11,18,1,2],[12,18,2,4],[14,18,2,3],[16,18,3,0],[19,18,2,3],[21,18,1,0],[8,19,1,0],[9,19,5,4],[14,19,1,3],[15,19,2,0],[18,19,1,0],[19,19,1,3],[20,19,1,0],[8,20,1,0],[9,20,2,4],[11,20,2,0],[13,20,1,4],[14,20,2,0],[18,20,1,0],[19,20,1,4],[20,20,1,3],[8,21,1,0],[9,21,1,4],[10,21,2,0],[12,21,2,4],[14,21,1,3],[18,21,1,0],[19,21,1,3],[20,21,1,0],[8,22,4,0],[12,22,2,4],[14,22,1,3],[18,22,1,0],[19,22,1,3],[20,22,1,0],[21,22,1,3],[9,23,1,0],[13,23,1,4],[14,23,1,0],[18,23,1,0],[19,23,1,3],[20,23,1,4],[21,23,1,3],[11,24,1,0],[13,24,1,4],[19,24,1,0],[20,24,1,4],[21,24,1,3],[11,25,1,0],[14,25,1,0],[19,25,1,0],[20,25,1,4],[21,25,1,3],[12,26,1,4],[14,26,1,0],[20,26,1,0],[21,26,1,3],[22,26,1,0],[11,27,2,0],[21,27,2,0],[13,28,1,0]] },
    eyeball: { w:32, h:32, pal:["#0c0c0c", "#6c0c0c", "#cc0c0c", "#545454", "#fc0c0c", "#b4b4b4", "#cccccc", "#e4e4e4", "#e4fcfc"], px:[[15,5,8,0],[13,6,2,0],[15,6,8,5],[23,6,2,0],[11,7,2,0],[13,7,12,5],[25,7,2,0],[10,8,1,0],[11,8,3,5],[14,8,4,6],[18,8,9,5],[27,8,1,0],[8,9,1,7],[9,9,2,2],[11,9,2,5],[13,9,1,6],[14,9,1,7],[15,9,6,6],[21,9,1,5],[22,9,1,6],[23,9,5,5],[28,9,1,0],[7,10,1,7],[8,10,3,2],[11,10,1,5],[12,10,3,6],[15,10,2,7],[17,10,5,6],[22,10,3,5],[25,10,3,2],[28,10,1,0],[2,11,1,2],[3,11,1,4],[4,11,5,2],[9,11,1,4],[10,11,1,5],[11,11,2,6],[13,11,6,7],[19,11,4,6],[23,11,1,5],[24,11,1,4],[25,11,3,1],[28,11,2,0],[2,12,1,4],[4,12,2,1],[6,12,2,2],[8,12,1,4],[9,12,1,2],[10,12,1,5],[11,12,1,6],[12,12,3,7],[15,12,1,8],[16,12,2,7],[18,12,1,6],[19,12,1,7],[20,12,2,6],[22,12,1,5],[23,12,1,4],[24,12,1,1],[25,12,5,0],[1,13,1,4],[5,13,2,2],[7,13,1,4],[8,13,1,2],[9,13,1,3],[10,13,1,5],[11,13,1,6],[12,13,1,7],[15,13,1,7],[16,13,1,8],[17,13,2,7],[19,13,3,6],[22,13,1,4],[23,13,1,1],[24,13,7,0],[6,14,1,2],[7,14,1,4],[8,14,1,2],[9,14,1,3],[10,14,1,5],[11,14,1,6],[12,14,2,8],[16,14,4,7],[20,14,1,6],[21,14,1,5],[22,14,1,1],[23,14,5,0],[28,14,2,1],[30,14,1,0],[7,15,2,2],[9,15,1,3],[10,15,1,5],[11,15,1,6],[12,15,1,7],[13,15,1,8],[16,15,4,7],[20,15,1,6],[21,15,1,4],[22,15,1,1],[23,15,4,0],[27,15,2,1],[29,15,1,2],[30,15,1,0],[4,16,2,4],[6,16,1,1],[7,16,1,2],[8,16,2,3],[10,16,2,5],[12,16,2,7],[15,16,4,7],[19,16,2,6],[21,16,1,4],[22,16,1,1],[23,16,4,0],[27,16,1,1],[28,16,1,2],[29,16,1,4],[30,16,1,0],[1,17,2,4],[5,17,3,2],[8,17,3,3],[11,17,1,5],[12,17,1,6],[13,17,6,7],[19,17,2,6],[21,17,1,4],[22,17,5,0],[27,17,1,1],[28,17,1,2],[29,17,1,4],[30,17,1,0],[3,18,2,2],[5,18,1,4],[6,18,2,2],[8,18,1,1],[9,18,2,3],[11,18,2,5],[13,18,2,6],[15,18,3,7],[18,18,3,6],[21,18,1,2],[22,18,1,1],[23,18,4,0],[27,18,2,1],[29,18,1,2],[30,18,1,0],[4,19,1,4],[5,19,2,2],[7,19,1,4],[8,19,2,1],[10,19,2,3],[12,19,3,5],[15,19,6,6],[21,19,1,4],[22,19,2,1],[24,19,4,0],[28,19,2,1],[30,19,1,0],[5,20,1,4],[6,20,2,2],[8,20,2,1],[10,20,3,3],[13,20,9,5],[22,20,1,2],[23,20,4,1],[27,20,4,0],[0,21,1,4],[4,21,1,8],[5,21,2,2],[7,21,1,4],[8,21,2,1],[10,21,4,3],[14,21,8,5],[22,21,3,2],[25,21,4,1],[29,21,1,0],[2,22,1,4],[4,22,4,2],[8,22,2,1],[10,22,7,3],[17,22,7,5],[24,22,2,2],[26,22,3,1],[29,22,1,0],[30,22,1,8],[3,23,2,4],[6,23,2,2],[8,23,3,1],[11,23,1,0],[12,23,8,3],[20,23,4,5],[24,23,1,3],[25,23,3,2],[28,23,1,0],[5,24,1,8],[7,24,5,1],[12,24,1,0],[13,24,15,3],[28,24,1,0],[9,25,1,2],[10,25,1,0],[11,25,3,3],[14,25,1,0],[15,25,13,3],[28,25,1,8],[7,26,1,8],[10,26,1,0],[11,26,3,3],[14,26,1,1],[15,26,2,0],[17,26,8,3],[25,26,1,0],[26,26,1,3],[27,26,1,8],[12,27,1,8],[13,27,10,3],[23,27,1,0],[24,27,1,3],[25,27,2,8],[13,28,2,8],[15,28,2,3],[17,28,2,5],[19,28,4,3],[23,28,3,8],[14,29,6,8],[23,29,2,8],[14,30,4,8],[12,31,1,8],[15,31,1,8]] },
    redswarm: { w:32, h:32, pal:["#0c0c0c", "#540c0c", "#6c0c0c", "#840c0c", "#9c0c0c", "#b40c0c", "#cc0c0c", "#b40c24", "#e40c0c"], px:[[4,3,1,7],[19,6,2,1],[21,6,2,2],[23,6,2,1],[25,6,1,2],[26,6,1,3],[3,7,2,7],[6,7,1,4],[7,7,1,3],[8,7,2,7],[10,7,4,0],[18,7,1,0],[19,7,1,1],[20,7,1,6],[21,7,5,8],[26,7,2,4],[2,8,1,7],[3,8,1,8],[4,8,2,7],[6,8,1,3],[7,8,1,8],[8,8,1,7],[9,8,2,4],[11,8,2,3],[13,8,2,0],[18,8,1,0],[19,8,1,5],[20,8,1,6],[21,8,1,8],[22,8,1,6],[23,8,5,8],[28,8,1,5],[3,9,1,4],[4,9,1,6],[5,9,1,8],[6,9,1,7],[7,9,2,8],[9,9,1,7],[10,9,1,4],[11,9,1,3],[12,9,1,2],[13,9,1,3],[14,9,2,0],[17,9,2,0],[19,9,1,3],[20,9,1,5],[21,9,2,6],[23,9,5,8],[28,9,1,6],[29,9,1,5],[2,10,1,3],[3,10,2,6],[5,10,1,7],[6,10,1,8],[7,10,2,7],[9,10,1,5],[10,10,2,4],[12,10,3,2],[15,10,3,0],[18,10,1,2],[19,10,1,3],[20,10,2,5],[22,10,1,6],[23,10,1,5],[24,10,1,6],[25,10,4,8],[29,10,1,5],[2,11,1,2],[3,11,2,5],[5,11,2,7],[7,11,1,8],[8,11,1,7],[9,11,2,5],[11,11,2,3],[13,11,4,1],[17,11,1,2],[18,11,1,3],[19,11,1,4],[20,11,1,7],[21,11,1,5],[22,11,1,6],[23,11,6,8],[29,11,1,5],[30,11,1,4],[1,12,1,3],[2,12,1,1],[3,12,1,4],[4,12,1,7],[5,12,1,5],[6,12,2,7],[8,12,2,5],[10,12,1,4],[11,12,2,3],[13,12,1,2],[14,12,2,1],[16,12,1,2],[17,12,1,3],[18,12,1,7],[19,12,1,5],[20,12,1,6],[21,12,1,7],[22,12,1,6],[23,12,1,8],[24,12,2,3],[26,12,1,1],[27,12,3,8],[30,12,1,4],[1,13,1,1],[2,13,1,3],[3,13,1,4],[4,13,1,6],[5,13,3,7],[8,13,1,6],[9,13,1,5],[10,13,2,4],[12,13,1,7],[13,13,1,3],[14,13,1,2],[15,13,1,1],[16,13,1,3],[17,13,2,7],[19,13,2,5],[21,13,1,6],[22,13,1,7],[23,13,1,4],[24,13,2,0],[26,13,1,8],[27,13,1,1],[28,13,2,8],[30,13,1,4],[1,14,2,1],[3,14,2,4],[5,14,2,2],[7,14,1,6],[8,14,2,5],[10,14,1,4],[11,14,2,3],[13,14,1,7],[14,14,2,3],[16,14,2,7],[18,14,1,6],[19,14,3,5],[22,14,1,1],[23,14,1,3],[24,14,1,7],[25,14,1,1],[26,14,1,0],[27,14,1,1],[28,14,1,2],[29,14,1,8],[30,14,1,3],[1,15,1,0],[2,15,1,2],[3,15,1,4],[4,15,1,1],[5,15,1,0],[6,15,1,7],[7,15,1,0],[8,15,2,5],[10,15,1,4],[11,15,1,3],[12,15,1,7],[13,15,1,2],[14,15,1,1],[15,15,1,2],[16,15,1,7],[17,15,1,8],[18,15,1,7],[19,15,1,6],[20,15,1,5],[21,15,1,4],[22,15,1,1],[23,15,1,0],[24,15,1,2],[25,15,1,7],[27,15,1,1],[28,15,1,5],[29,15,1,6],[30,15,1,2],[1,16,1,0],[2,16,1,1],[3,16,1,3],[4,16,1,0],[5,16,1,8],[6,16,2,0],[8,16,1,3],[9,16,2,4],[11,16,1,3],[12,16,1,4],[13,16,1,3],[14,16,2,2],[16,16,1,4],[17,16,1,7],[18,16,2,5],[20,16,1,6],[21,16,1,5],[22,16,1,2],[23,16,4,1],[27,16,1,7],[28,16,1,3],[29,16,1,5],[30,16,1,1],[1,17,1,0],[2,17,1,1],[3,17,1,4],[4,17,1,1],[5,17,1,0],[6,17,1,2],[7,17,1,0],[8,17,1,1],[9,17,2,3],[11,17,1,4],[12,17,2,7],[14,17,1,3],[15,17,1,0],[16,17,3,7],[19,17,2,5],[21,17,1,6],[22,17,1,4],[23,17,2,3],[25,17,3,1],[28,17,1,3],[29,17,1,5],[30,17,1,1],[1,18,1,0],[2,18,1,2],[3,18,1,4],[4,18,2,1],[6,18,1,7],[7,18,1,0],[8,18,1,1],[9,18,2,3],[11,18,1,4],[12,18,1,5],[13,18,2,7],[15,18,1,6],[16,18,1,7],[17,18,2,4],[19,18,3,5],[22,18,1,6],[23,18,2,5],[25,18,1,4],[26,18,2,2],[28,18,2,4],[30,18,1,1],[1,19,2,0],[3,19,1,3],[4,19,1,5],[5,19,1,6],[6,19,2,1],[8,19,1,0],[9,19,1,2],[10,19,1,3],[11,19,1,4],[12,19,5,7],[17,19,1,2],[18,19,1,3],[19,19,2,7],[21,19,1,6],[22,19,1,5],[23,19,1,6],[24,19,1,5],[25,19,2,4],[27,19,2,3],[29,19,1,4],[30,19,1,1],[2,20,1,0],[3,20,1,1],[4,20,1,3],[5,20,1,4],[6,20,1,1],[7,20,2,0],[9,20,1,1],[10,20,2,4],[12,20,1,3],[13,20,1,4],[14,20,1,0],[15,20,1,7],[16,20,1,0],[17,20,1,3],[18,20,2,4],[20,20,4,5],[24,20,2,4],[26,20,1,7],[27,20,2,3],[29,20,1,1],[30,20,1,0],[2,21,1,0],[3,21,2,1],[5,21,4,2],[9,21,2,3],[11,21,1,4],[12,21,1,7],[13,21,2,0],[15,21,3,7],[18,21,1,3],[19,21,2,4],[21,21,1,5],[22,21,3,4],[25,21,1,8],[26,21,1,3],[27,21,1,7],[28,21,1,3],[29,21,1,0],[2,22,2,0],[4,22,2,1],[6,22,3,2],[9,22,2,3],[11,22,2,4],[13,22,2,7],[15,22,1,8],[16,22,1,7],[17,22,1,4],[18,22,1,3],[19,22,4,4],[23,22,1,3],[24,22,2,2],[26,22,1,7],[27,22,1,3],[28,22,1,7],[29,22,1,0],[3,23,1,0],[4,23,3,1],[7,23,2,2],[9,23,2,3],[11,23,1,4],[12,23,2,7],[14,23,1,8],[15,23,2,7],[17,23,2,3],[19,23,1,4],[20,23,1,3],[21,23,2,4],[23,23,1,3],[24,23,1,7],[25,23,2,8],[27,23,2,0],[4,24,2,0],[6,24,2,1],[8,24,3,2],[11,24,2,3],[13,24,1,0],[14,24,2,7],[16,24,1,0],[17,24,1,3],[18,24,1,2],[19,24,1,7],[20,24,1,8],[21,24,3,3],[24,24,1,8],[25,24,2,7],[27,24,1,0],[4,25,2,0],[6,25,4,1],[10,25,2,2],[12,25,6,7],[18,25,1,2],[19,25,2,1],[21,25,1,8],[22,25,1,2],[23,25,3,7],[26,25,1,3],[5,26,2,0],[7,26,3,1],[10,26,1,2],[11,26,1,3],[12,26,1,7],[13,26,1,8],[14,26,4,7],[18,26,2,2],[20,26,1,7],[21,26,1,2],[22,26,1,7],[23,26,1,8],[24,26,1,1],[25,26,1,0],[26,26,1,7],[6,27,6,0],[17,27,4,0],[21,27,1,8],[22,27,1,0],[23,27,1,7],[25,27,1,7],[22,28,2,7],[19,29,1,7],[23,29,1,7]] },
    knife: { w:32, h:32, pal:["#0c0c0c", "#6c0c0c", "#cc2424", "#9c8484", "#b49c9c", "#b4b4b4", "#cccccc", "#e4cccc", "#e4e4e4"], px:[[18,2,1,8],[18,3,1,8],[17,4,1,8],[18,4,1,7],[19,4,1,4],[17,5,1,6],[18,5,1,5],[19,5,1,3],[16,6,2,6],[18,6,1,4],[19,6,1,2],[16,7,1,6],[17,7,1,5],[18,7,1,3],[19,7,1,2],[16,8,1,5],[17,8,1,4],[18,8,2,2],[15,9,1,6],[16,9,1,5],[17,9,1,3],[18,9,2,2],[15,10,2,5],[17,10,1,3],[18,10,2,2],[14,11,2,5],[16,11,1,4],[17,11,1,3],[18,11,2,2],[22,11,1,8],[14,12,1,6],[15,12,1,5],[16,12,1,3],[17,12,2,2],[19,12,1,8],[13,13,1,5],[14,13,1,6],[15,13,1,4],[16,13,1,3],[17,13,2,2],[13,14,1,6],[14,14,1,5],[15,14,1,4],[16,14,1,3],[17,14,2,2],[13,15,2,5],[15,15,1,3],[16,15,2,2],[18,15,1,1],[12,16,1,5],[13,16,1,6],[14,16,1,4],[15,16,1,3],[16,16,1,2],[17,16,1,1],[18,16,1,7],[12,17,1,6],[13,17,1,5],[14,17,2,3],[16,17,1,2],[17,17,1,1],[18,17,1,7],[11,18,2,5],[13,18,1,4],[14,18,1,3],[15,18,3,1],[18,18,1,7],[11,19,1,8],[12,19,1,7],[13,19,1,3],[14,19,1,8],[15,19,1,7],[16,19,2,1],[18,19,1,7],[10,20,2,0],[12,20,1,6],[13,20,1,4],[16,20,1,5],[17,20,1,7],[18,20,1,8],[10,21,3,0],[13,21,1,4],[16,21,1,8],[17,21,1,7],[9,22,4,0],[17,22,1,7],[9,23,4,0],[8,24,4,0],[8,25,4,0],[7,26,4,0],[7,27,4,0],[6,28,4,0],[6,29,4,0],[7,30,4,0]] },
    splatter: { w:32, h:32, pal:["#3c0c0c", "#b40c24", "#cc0c24", "#fc0c0c", "#cc0c3c", "#e40c3c", "#fc0c24", "#fc0c3c", "#fc0c54"], px:[[11,1,2,8],[15,1,3,8],[12,2,1,8],[17,2,2,8],[7,3,1,8],[10,3,3,8],[16,3,3,8],[21,3,4,8],[5,4,1,8],[8,4,3,8],[11,4,2,4],[13,4,1,8],[15,4,1,8],[16,4,1,0],[17,4,1,8],[18,4,1,7],[19,4,2,8],[21,4,1,4],[22,4,1,1],[23,4,1,8],[24,4,2,7],[26,4,1,8],[4,5,2,8],[8,5,2,8],[11,5,1,8],[12,5,1,5],[13,5,1,8],[16,5,1,0],[17,5,2,7],[19,5,1,8],[20,5,1,0],[21,5,2,6],[23,5,1,3],[24,5,1,7],[25,5,2,8],[3,6,7,8],[11,6,2,1],[13,6,1,5],[14,6,1,8],[16,6,1,4],[17,6,1,5],[18,6,1,7],[19,6,1,8],[20,6,1,0],[21,6,1,1],[22,6,1,6],[23,6,1,3],[24,6,1,7],[25,6,1,8],[28,6,1,8],[4,7,1,8],[5,7,1,0],[6,7,1,1],[7,7,4,8],[11,7,2,4],[13,7,1,1],[14,7,2,4],[16,7,1,0],[17,7,1,5],[18,7,1,6],[19,7,1,4],[20,7,2,0],[22,7,1,8],[23,7,1,6],[24,7,1,4],[28,7,1,8],[1,8,1,8],[4,8,1,8],[5,8,1,5],[6,8,1,1],[7,8,1,8],[8,8,1,1],[9,8,1,0],[10,8,1,4],[11,8,1,7],[12,8,1,5],[13,8,2,0],[15,8,1,1],[16,8,1,5],[17,8,1,6],[18,8,1,3],[19,8,1,5],[20,8,1,4],[21,8,1,0],[22,8,1,1],[23,8,1,4],[24,8,1,8],[30,8,1,8],[1,9,1,8],[2,9,2,4],[4,9,2,8],[6,9,2,4],[8,9,1,1],[9,9,1,0],[10,9,1,4],[11,9,2,5],[13,9,1,0],[14,9,2,1],[16,9,1,0],[17,9,1,6],[18,9,1,3],[19,9,3,5],[22,9,1,4],[23,9,1,8],[26,9,5,8],[0,10,2,8],[2,10,1,5],[3,10,1,8],[4,10,1,4],[5,10,1,1],[6,10,3,4],[9,10,2,1],[11,10,1,4],[12,10,4,5],[16,10,1,0],[17,10,1,2],[18,10,1,3],[19,10,1,5],[20,10,2,4],[22,10,1,1],[23,10,2,4],[25,10,1,8],[26,10,1,5],[27,10,4,8],[2,11,1,4],[3,11,1,8],[4,11,1,1],[5,11,2,0],[7,11,2,4],[9,11,1,2],[10,11,2,1],[12,11,2,8],[14,11,1,6],[15,11,1,3],[16,11,1,4],[17,11,1,7],[18,11,1,6],[19,11,1,1],[20,11,1,0],[21,11,1,2],[22,11,1,0],[23,11,1,5],[24,11,1,7],[25,11,1,5],[26,11,1,8],[30,11,1,8],[2,12,1,8],[3,12,1,4],[4,12,1,8],[5,12,1,1],[6,12,1,2],[7,12,4,1],[11,12,1,4],[12,12,2,8],[14,12,1,6],[15,12,1,3],[16,12,1,5],[17,12,1,6],[18,12,1,3],[19,12,2,0],[21,12,1,1],[22,12,1,5],[23,12,1,8],[24,12,1,7],[25,12,1,8],[3,13,1,8],[4,13,1,5],[5,13,1,4],[6,13,1,1],[7,13,1,0],[8,13,4,1],[12,13,2,7],[14,13,4,0],[18,13,1,2],[19,13,1,0],[20,13,1,1],[21,13,1,2],[22,13,2,6],[24,13,1,7],[25,13,1,8],[26,13,1,4],[27,13,2,0],[29,13,1,8],[2,14,1,8],[3,14,1,4],[4,14,3,1],[7,14,1,0],[8,14,1,1],[9,14,1,0],[10,14,1,1],[11,14,1,4],[12,14,7,0],[19,14,1,1],[20,14,1,4],[21,14,1,6],[22,14,1,3],[23,14,1,6],[24,14,1,8],[25,14,1,4],[26,14,1,0],[27,14,1,1],[28,14,2,8],[2,15,1,5],[3,15,2,1],[5,15,4,0],[9,15,1,1],[10,15,1,0],[11,15,1,1],[12,15,3,4],[15,15,5,0],[20,15,1,4],[21,15,2,3],[23,15,1,8],[24,15,2,1],[26,15,1,0],[27,15,2,8],[29,15,1,4],[30,15,1,5],[31,15,1,8],[2,16,2,4],[4,16,2,8],[6,16,1,4],[7,16,1,1],[8,16,2,0],[10,16,3,1],[13,16,2,8],[15,16,2,4],[17,16,3,0],[20,16,1,4],[21,16,3,5],[24,16,2,1],[26,16,1,0],[27,16,1,8],[28,16,1,7],[29,16,1,3],[30,16,1,6],[4,17,3,8],[7,17,1,4],[8,17,2,0],[10,17,2,1],[12,17,1,2],[13,17,1,1],[14,17,1,0],[15,17,1,4],[16,17,2,0],[18,17,4,5],[22,17,1,1],[23,17,1,4],[24,17,3,8],[27,17,1,5],[28,17,3,8],[2,18,2,8],[4,18,3,0],[7,18,2,1],[9,18,2,0],[11,18,1,1],[12,18,1,2],[13,18,1,5],[14,18,3,0],[17,18,1,2],[18,18,1,4],[19,18,7,8],[26,18,1,7],[27,18,1,5],[28,18,2,8],[1,19,1,8],[2,19,2,2],[4,19,2,1],[6,19,2,2],[8,19,3,1],[11,19,2,0],[13,19,1,1],[14,19,1,2],[15,19,3,3],[18,19,1,2],[19,19,1,3],[20,19,2,6],[22,19,2,3],[24,19,1,7],[25,19,1,8],[26,19,1,7],[27,19,1,8],[28,19,1,3],[29,19,1,8],[1,20,1,8],[2,20,1,2],[3,20,4,1],[7,20,1,2],[8,20,1,5],[9,20,1,0],[10,20,1,2],[11,20,1,1],[12,20,1,0],[13,20,1,1],[14,20,8,3],[22,20,1,1],[23,20,1,3],[24,20,1,8],[25,20,1,4],[26,20,2,1],[28,20,1,6],[29,20,1,8],[1,21,1,8],[2,21,1,5],[3,21,1,8],[4,21,2,1],[6,21,1,2],[7,21,1,1],[8,21,1,4],[9,21,1,0],[10,21,1,1],[11,21,1,2],[12,21,1,1],[13,21,1,2],[14,21,2,3],[16,21,1,1],[17,21,1,2],[18,21,1,1],[19,21,3,3],[22,21,1,1],[23,21,1,2],[24,21,1,1],[25,21,1,0],[26,21,2,1],[28,21,1,6],[29,21,1,5],[30,21,2,8],[1,22,2,8],[3,22,1,1],[4,22,1,0],[5,22,1,1],[6,22,1,3],[7,22,2,2],[9,22,1,3],[10,22,1,1],[11,22,1,4],[12,22,1,8],[13,22,1,1],[14,22,1,2],[15,22,1,0],[16,22,1,4],[17,22,2,1],[19,22,1,2],[20,22,2,3],[22,22,1,0],[23,22,1,1],[24,22,4,2],[28,22,1,3],[29,22,1,6],[30,22,2,8],[2,23,1,8],[3,23,2,0],[5,23,1,1],[6,23,4,3],[10,23,1,2],[11,23,1,0],[12,23,1,2],[13,23,2,1],[15,23,1,0],[16,23,2,1],[18,23,1,4],[19,23,1,5],[20,23,2,3],[22,23,1,2],[23,23,1,0],[24,23,1,5],[25,23,2,6],[27,23,2,3],[29,23,1,5],[30,23,2,8],[2,24,1,8],[3,24,2,4],[5,24,1,2],[6,24,1,3],[7,24,1,6],[8,24,2,0],[10,24,3,1],[13,24,3,0],[16,24,2,1],[18,24,1,2],[19,24,1,5],[20,24,1,2],[21,24,2,3],[23,24,1,4],[24,24,1,0],[25,24,1,5],[26,24,1,6],[27,24,1,7],[28,24,3,8],[5,25,1,4],[6,25,1,6],[7,25,1,7],[8,25,1,5],[9,25,1,1],[10,25,1,0],[11,25,1,4],[12,25,1,1],[13,25,1,0],[14,25,1,4],[15,25,1,0],[16,25,2,1],[18,25,1,5],[19,25,1,4],[20,25,1,5],[21,25,2,6],[23,25,2,8],[25,25,1,4],[26,25,2,8],[30,25,1,8],[5,26,1,4],[6,26,1,5],[7,26,1,4],[8,26,3,0],[11,26,1,5],[12,26,1,1],[13,26,1,0],[14,26,1,8],[15,26,2,1],[17,26,1,5],[18,26,1,8],[19,26,2,1],[21,26,1,5],[22,26,1,6],[23,26,1,8],[5,27,2,8],[7,27,1,0],[8,27,1,1],[9,27,1,0],[10,27,1,2],[11,27,1,7],[12,27,1,8],[13,27,1,0],[14,27,1,8],[15,27,1,4],[16,27,3,5],[19,27,3,8],[22,27,1,2],[23,27,2,8],[27,27,1,8],[6,28,3,8],[9,28,1,1],[10,28,2,8],[12,28,1,5],[13,28,1,0],[14,28,1,8],[15,28,1,4],[16,28,1,7],[17,28,1,0],[18,28,5,8],[23,28,1,4],[24,28,1,2],[25,28,1,5],[26,28,1,8],[9,29,5,8],[15,29,3,8],[22,29,2,8],[24,29,1,5],[25,29,1,8],[15,30,2,8]] },
  };

  function fwPixelSvg(spriteKey, size) {
    const s = SPRITE_PIXELS[spriteKey];
    if (!s) return "";
    const rects = s.px.map((p) => `<rect x="${p[0]}" y="${p[1]}" width="${p[2]}" height="1" fill="${s.pal[p[3]]}"/>`).join("");
    return `<svg viewBox="0 0 ${s.w} ${s.h}" width="${size}" height="${size}" class="fw-shape-svg" shape-rendering="crispEdges">${rects}</svg>`;
  }

  function fwEnemySvg(e, size) {
    // 敵ID → ドット絵スプライトの対応
    const SPRITE_KEY_MAP = {
      aseri: "aseri", mayoi: "mayoi", namake: "namake",
      hasami: "crab", mayotto: "char", toriimon: "torii",
      kutsune: "shoe", rama: "llama", hikari: "gem",
      miren: "ghost", aoitori: "bluebird", mametsubu: "peanut",
      karamigusa: "vine", toge: "thorn", hiyokko: "chick",
      mihari: "eyeball", tsumikasanari: "redswarm",
      shoudou: "knife", genkai: "splatter",
    };
    const key = SPRITE_KEY_MAP[e.id] || "namake";
    return fwSpriteImg(key, size); // [2026-07-28再変更] 画像があればPNG、なければドット絵に自動フォールバック
  }

  // [2026-07-28再変更] 主人公とナミダ・ユルミは、手作業のドット絵データだと形が崩れやすいため、
  // 再び img/*.png を使う方式に戻した。必要な画像ファイル:
  //   img/hero_front.png, img/hero_walk1.png, img/hero_walk2.png, img/namida.png, img/yurumi.png
  // 敵キャラ(aseri/mayoi/…splatter)は引き続き SPRITE_PIXELS のドット絵方式(画像不要)のまま。
  const SPRITE_IMG_MAP = { hero_front: "img/hero_front.png", hero_walk1: "img/hero_walk1.png", hero_walk2: "img/hero_walk2.png", namida: "img/namida.png", yurumi: "img/yurumi.png", aseri: "img/aseri.png", mayoi: "img/mayoi.png", namake: "img/namake.png", crab: "img/crab.png", gem: "img/gem.png", eyeball: "img/eyeball.png", redswarm: "img/redswarm.png", knife: "img/knife.png", splatter: "img/splatter.png", ghost: "img/ghost.png", bluebird: "img/bluebird.png", peanut: "img/peanut.png", vine: "img/vine.png", thorn: "img/thorn.png", chick: "img/chick.png", char: "img/char.png", torii: "img/torii.png", shoe: "img/shoe.png", llama: "img/llama.png" };
  function fwSpriteImg(key, size) {
    const src = SPRITE_IMG_MAP[key];
    if (src) return `<img src="${src}" width="${size}" height="${size}" class="fw-shape-img" style="image-rendering:pixelated;" alt="${key}"/>`;
    return fwPixelSvg(key, size);
  }

  /* ---- [2026-07-28追加] 起動演出: welcome → 洞窟入口を歩いて入る ---- */
  const WELCOME_MS = 2450;   // .fw-welcome-fade のアニメ時間(2.4s)と合わせる
  const ENTRANCE_MS = 2900;  // .fw-entrance-move のアニメ時間(2.8s)と合わせる
  let openSeq = 0; // 連打対策: 演出開始のたびに増やし、古いタイマーの実行を無効化する
  function fwStartWelcome(afterFn) {
    const mySeq = ++openSeq;
    fwGoView("fw-v-welcome");
    setTimeout(() => { if (mySeq === openSeq) fwStartEntrance(afterFn); }, WELCOME_MS);
  }
  function fwStartEntrance(afterFn) {
    const mySeq = openSeq;
    fwGoView("fw-v-entrance");
    const walker = document.getElementById("fw-entrance-walker");
    if (walker) {
      walker.classList.remove("fw-entrance-walk");
      void walker.offsetWidth; // reflow でアニメを再スタートさせる
      walker.classList.add("fw-walk-anim", "fw-entrance-walk");
    }
    setTimeout(() => {
      if (mySeq === openSeq && FW.open) {
        if (afterFn) afterFn();
        else { fwGoView("fw-v-home"); fwRenderHome(); }
      }
    }, ENTRANCE_MS);
  }
  // [2026-07-29変更] 起動演出(welcome→洞窟入口)は開くたびではなく、「スタート」を押したときだけ再生する
  function fwContinueWithIntro() {
    fwStartWelcome(fwContinue);
  }

  /* ---- イントロ(アンダーテール風タイプ演出) ---- */
  let introTyping = false, introStep = 0, introLines = [];
  function fwStartIntro(enemyId) {
    if (enemyId === "genkai" && !FW.dex.includes("genkai")) { fwStartCorridor(enemyId); return; }
    fwStartIntroDirect(enemyId);
  }
  function fwStartIntroDirect(enemyId) {
    FW.battle = { enemyId, playerHp: 0, playerMaxHp: 0, playerMp: 0, playerMaxMp: 0, enemyHp: 0, enemyMaxHp: 0, over: false };
    const enemy = ENEMIES.find((e) => e.id === enemyId);
    introLines = enemy.intro.concat([enemy.encounter]);
    introStep = 0;
    fwApplySceneBg(fwPickChapterBg(enemyId)); // [2026-07-28追加] 章に応じた背景に切り替え
    fwGoView("fw-v-intro");
    document.getElementById("fw-intro-text").innerHTML = "";
    fwTypeNext();
  }

  /* ---- 歩行パート:ゲンカイ前の一本廊下 ---- */
  let corridorStep = 0;
  const CORRIDOR_STEPS = 6;
  function fwStartCorridor(enemyId) {
    corridorStep = 0;
    const corridorView = document.getElementById("fw-v-corridor");
    if (corridorView) corridorView.style.backgroundImage = `linear-gradient(rgba(26,3,3,.55),rgba(26,3,3,.7)), url('${fwPickChapterBg(enemyId)}')`;
    fwGoView("fw-v-corridor");
    const walker = document.getElementById("fw-corridor-walker");
    if (walker) walker.classList.add("fw-walk-anim");
    fwCorridorRender(enemyId);
  }
  function fwCorridorRender(enemyId) {
    const quoteEl = document.getElementById("fw-corridor-quote");
    const beaten = ENEMIES.filter((e) => FW.dex.includes(e.id) && e.id !== "genkai");
    if (beaten.length && quoteEl) {
      const pick = beaten[Math.floor(Math.random() * beaten.length)];
      quoteEl.textContent = pick.quote;
      quoteEl.classList.remove("fw-flash");
      void quoteEl.offsetWidth;
      quoteEl.classList.add("fw-flash");
    }
    const track = document.getElementById("fw-corridor-track");
    if (track) track.style.transform = `translateY(${-corridorStep * (100 / CORRIDOR_STEPS)}%)`;
  }
  function fwCorridorAdvance() {
    corridorStep++;
    if (corridorStep >= CORRIDOR_STEPS) {
      fwStartIntroDirect("genkai");
      return;
    }
    fwCorridorRender("genkai");
  }
  function fwTypeNext() {
    if (introStep >= introLines.length) { setTimeout(fwStartBattleScreen, 500); return; }
    introTyping = true;
    const wrap = document.getElementById("fw-intro-text");
    const p = document.createElement("p");
    p.className = "fw-ln";
    wrap.appendChild(p);
    const text = introLines[introStep];
    let i = 0;
    const iv = setInterval(() => {
      p.textContent = text.slice(0, i + 1);
      i++;
      if (i >= text.length) {
        clearInterval(iv);
        introTyping = false;
        introStep++;
        setTimeout(fwTypeNext, introStep === introLines.length ? 700 : 220);
      }
    }, 32);
  }
  function fwSkipIntro() { /* 行送りはタップ待ちにせず自動進行のため、何もしない(誤操作防止) */ }

  /* ---- バトル ---- */
  function fwStartBattleScreen() {
    const enemy = ENEMIES.find((e) => e.id === FW.battle.enemyId);
    const eff = fwEffectiveStats(true);
    FW.battle.playerMaxHp = 50 + Math.round(eff.hp * 0.5);
    FW.battle.playerHp = FW.battle.playerMaxHp;
    FW.battle.playerMaxMp = Math.round(eff.mp * 0.5);
    FW.battle.playerMp = FW.battle.playerMaxMp;
    FW.battle.eff = eff;
    const enemyEff = fwEnemyEffective(enemy);
    FW.battle.enemyMaxHp = enemyEff.hp;
    FW.battle.enemyHp = enemyEff.hp;
    FW.battle.enemyAtk = enemyEff.atk;
    FW.battle.enemyScale = enemyEff.scale;
    FW.battle.over = false;
    FW.battle.defending = false;

    // このバトルでバフを消費する
    if (Object.keys(FW.buffs).length) {
      FW.buffs = {};
      fwSave({ fw_buffs: {} });
    }

    document.getElementById("fw-enemy-name").textContent = `${enemy.name}(${enemy.type}) Lv.${enemy.level}${enemyEff.winCount > 0 ? ` 強化+${enemyEff.winCount}` : ""}`;
    document.getElementById("fw-enemy-sprite").innerHTML = fwEnemySvg(enemy, 100);
    document.getElementById("fw-player-name").textContent = "あなた";
    document.getElementById("fw-player-lv").textContent = `Lv.${fwLevel()}`;
    document.getElementById("fw-battle-log").textContent = `* ${enemy.name}は 様子をうかがっている。`;
    document.getElementById("fw-fight-btn").disabled = false;
    document.getElementById("fw-special-btn").disabled = false;
    document.getElementById("fw-item-btn").disabled = false;
    document.getElementById("fw-defend-btn").disabled = false;
    fwCloseMenus();
    fwUpdateBattleBars();
    fwGoView("fw-v-battle");
  }

  function fwHpBarClass(ratio) {
    if (ratio <= 0.2) return "fw-bar-low";
    if (ratio <= 0.5) return "fw-bar-mid";
    return "";
  }

  function fwUpdateBattleBars() {
    const b = FW.battle;
    const enemyRatio = Math.max(0, b.enemyHp / b.enemyMaxHp);
    const playerRatio = Math.max(0, b.playerHp / b.playerMaxHp);
    const enemyFill = document.getElementById("fw-enemy-hp");
    const playerFill = document.getElementById("fw-player-hp");
    enemyFill.style.width = enemyRatio * 100 + "%";
    playerFill.style.width = playerRatio * 100 + "%";
    enemyFill.className = "fw-hpbar-fill " + fwHpBarClass(enemyRatio);
    playerFill.className = "fw-hpbar-fill fw-player-hpbar-fill " + fwHpBarClass(playerRatio);
    document.getElementById("fw-player-mp").style.width = Math.max(0, (b.playerMp / b.playerMaxMp) * 100) + "%";
    document.getElementById("fw-enemy-hp-num").textContent = `${Math.max(0, b.enemyHp)}/${b.enemyMaxHp}`;
    document.getElementById("fw-player-hp-num").textContent = `${Math.max(0, b.playerHp)}/${b.playerMaxHp}`;
    document.getElementById("fw-player-mp-num").textContent = `${Math.max(0, b.playerMp)}/${b.playerMaxMp}`;
  }

  /* ---- アイテムメニュー ---- */
  function fwOpenItemMenu() {
    const b = FW.battle;
    if (!b || b.over) return;
    const owned = ITEM_CATALOG.filter((it) => (FW.items[it.id] || 0) > 0);
    if (!owned.length) { fwToast("つかえる どうぐが ありません"); return; }
    const listEl = document.getElementById("fw-item-menu-list");
    listEl.innerHTML = owned.map((it) => `
      <button class="fw-item-menu-row" onclick="FocusWorld.act('item','${it.id}')">
        <span class="fw-item-menu-name">${it.name}<span class="fw-buff-count"> ×${FW.items[it.id]}</span></span>
        <span class="fw-item-menu-desc">${it.desc}</span>
      </button>`).join("");
    document.getElementById("fw-battle-actions").style.display = "none";
    document.getElementById("fw-item-menu").classList.add("open");
  }
  function fwCloseItemMenu() {
    const menu = document.getElementById("fw-item-menu");
    const actions = document.getElementById("fw-battle-actions");
    if (menu) menu.classList.remove("open");
    if (actions) actions.style.display = "";
  }

  /* ---- とくぎ(わざ)メニュー ---- */
  function fwOpenSkillMenu() {
    const b = FW.battle;
    if (!b || b.over) return;
    const known = FW.skills && FW.skills.length ? FW.skills : ["basic_strike"];
    const listEl = document.getElementById("fw-skill-menu-list");
    listEl.innerHTML = known.map((id) => {
      const s = SKILL_CATALOG.find((x) => x.id === id);
      if (!s) return "";
      const usable = b.playerMp >= s.mpCost;
      return `
        <button class="fw-item-menu-row" ${usable ? "" : "disabled"} onclick="FocusWorld.act('skill','${s.id}')">
          <span class="fw-item-menu-name">${s.name}${s.element ? `<span class="fw-buff-count"> [${s.element}]</span>` : ""}<span class="fw-buff-count"> MP${s.mpCost}</span></span>
          <span class="fw-item-menu-desc">${s.desc}</span>
        </button>`;
    }).join("");
    document.getElementById("fw-battle-actions").style.display = "none";
    document.getElementById("fw-skill-menu").classList.add("open");
  }
  function fwCloseSkillMenu() {
    const menu = document.getElementById("fw-skill-menu");
    const actions = document.getElementById("fw-battle-actions");
    if (menu) menu.classList.remove("open");
    if (actions) actions.style.display = "";
  }
  function fwCloseMenus() { fwCloseItemMenu(); fwCloseSkillMenu(); }

  function fwAct(kind, itemId) {
    const b = FW.battle;
    if (!b || b.over) return;
    const enemy = ENEMIES.find((e) => e.id === b.enemyId);
    const log = document.getElementById("fw-battle-log");
    const fightBtn = document.getElementById("fw-fight-btn");
    const specialBtn = document.getElementById("fw-special-btn");
    const itemBtn = document.getElementById("fw-item-btn");
    const defendBtn = document.getElementById("fw-defend-btn");
    const mercyBtn = document.getElementById("fw-mercy-btn");

    let itemDef = null;
    if (kind === "item") {
      itemDef = ITEM_CATALOG.find((it) => it.id === itemId);
      if (!itemDef || (FW.items[itemId] || 0) <= 0) return;
    }
    let skillDef = null;
    if (kind === "skill") {
      skillDef = SKILL_CATALOG.find((s) => s.id === itemId);
      if (!skillDef || b.playerMp < skillDef.mpCost) return;
    }

    fwCloseMenus();
    [fightBtn, specialBtn, itemBtn, defendBtn, mercyBtn].forEach((el) => { if (el) el.disabled = true; });
    b.defending = false;

    const steps = [];
    if (kind === "mercy") {
      // HPが25%以下まで削れていれば「みまもる」で戦闘を終わらせられる(スペア)。
      // それ以外はまだ届かず、軽くいたわるだけで敵のターンへ。
      const ratio = b.enemyHp / b.enemyMaxHp;
      if (ratio <= 0.25) {
        steps.push(() => { log.textContent = `* ${enemy.name}を そっと みまもった…`; });
        steps.push(() => {
          b.over = true;
          const next = (FW.mercyCount || 0) + 1;
          FW.mercyCount = next;
          fwSave({ fw_mercy_count: next });
          setTimeout(() => fwSpareBattle(enemy), 700);
        });
        let i = 0;
        const run = () => { if (i < steps.length) { steps[i](); i++; setTimeout(run, 750); } };
        run();
        return;
      } else {
        steps.push(() => { log.textContent = `* ${enemy.name}を みまもった。* まだ、とどいていないようだ…`; });
      }
    } else if (kind === "attack") {
      steps.push(() => { log.textContent = "* あなたの こうげき!"; });
      steps.push(() => {
        const dmg = Math.max(1, Math.round(b.eff.atk * 0.4 + (Math.random() * 6 - 3)));
        b.enemyHp = Math.max(0, b.enemyHp - dmg);
        fwUpdateBattleBars();
        log.textContent = `* ${enemy.name}に ${dmg} のダメージ!`;
      });
    } else if (kind === "skill") {
      b.playerMp -= skillDef.mpCost;
      steps.push(() => { log.textContent = `* あなたは「${skillDef.name}」を つかった!`; });
      steps.push(() => {
        let dmg = Math.max(1, Math.round(b.eff[skillDef.scaleStat] * skillDef.power + (Math.random() * 6 - 3)));
        const superEffective = skillDef.element && enemy.type === skillDef.element;
        if (superEffective) dmg = Math.round(dmg * 1.3);
        b.enemyHp = Math.max(0, b.enemyHp - dmg);
        fwUpdateBattleBars();
        log.textContent = superEffective
          ? `* こうかは ばつぐんだ! ${enemy.name}に ${dmg} のダメージ!`
          : `* ${enemy.name}に ${dmg} のダメージ!`;
      });
    } else if (kind === "item") {
      const remaining = (FW.items[itemId] || 0) - 1;
      const nextItems = Object.assign({}, FW.items, { [itemId]: remaining });
      FW.items = nextItems;
      fwSave({ fw_items: nextItems });
      steps.push(() => { log.textContent = `* ${itemDef.name}を つかった!`; });
      steps.push(() => {
        if (itemDef.heal) {
          b.playerHp = Math.min(b.playerMaxHp, b.playerHp + itemDef.heal);
          log.textContent = `* HPが ${itemDef.heal} かいふくした!`;
        } else if (itemDef.restoreMp) {
          b.playerMp = Math.min(b.playerMaxMp, b.playerMp + itemDef.restoreMp);
          log.textContent = `* MPが ${itemDef.restoreMp} かいふくした!`;
        }
        fwUpdateBattleBars();
      });
    } else if (kind === "defend") {
      b.defending = true;
      steps.push(() => { log.textContent = "* あなたは みを まもっている!"; });
      steps.push(() => {
        const regen = Math.max(1, Math.round(b.playerMaxMp * 0.08));
        b.playerMp = Math.min(b.playerMaxMp, b.playerMp + regen);
        fwUpdateBattleBars();
      });
    }

    steps.push(() => {
      if (b.enemyHp <= 0) { b.over = true; setTimeout(() => fwWinBattle(enemy), 600); return; }
      const dodgeChance = Math.min(0.35, b.eff.agi / 400);
      if (Math.random() < dodgeChance) {
        log.textContent = `* ${enemy.name}の こうげき! …しかし かわした!`;
      } else {
        let dmg = Math.max(1, Math.round(b.enemyAtk * 0.35 + (Math.random() * 4 - 2)));
        if (b.defending) {
          dmg = Math.max(1, Math.round(dmg * 0.4));
          b.playerHp = Math.max(0, b.playerHp - dmg);
          fwUpdateBattleBars();
          log.textContent = `* ${enemy.name}の こうげき! ふせいで ${dmg} のダメージに おさえた!`;
        } else {
          b.playerHp = Math.max(0, b.playerHp - dmg);
          fwUpdateBattleBars();
          log.textContent = `* ${enemy.name}の こうげき! ${dmg} のダメージを受けた。`;
        }
      }
    });
    steps.push(() => {
      if (b.playerHp <= 0) { b.over = true; setTimeout(() => fwLoseBattle(enemy), 600); return; }
      fightBtn.disabled = false;
      specialBtn.disabled = false;
      itemBtn.disabled = false;
      defendBtn.disabled = false;
      if (mercyBtn) mercyBtn.disabled = false;
    });

    let i = 0;
    const run = () => { if (i < steps.length) { steps[i](); i++; setTimeout(run, 750); } };
    run();
  }

  function fwWinBattle(enemy) {
    const firstTime = !FW.dex.includes(enemy.id);
    const reward = fwEnemyRewardEffective(enemy);
    const nextXp = FW.xp + reward.xp;
    let dropText = "なし";
    let droppedItem = null;
    if (Math.random() < 0.25) {
      // 高ランク(UR以上)の装備はガチャ専用。戦闘ドロップはSSRまでに留める
      const dropRarities = ["N", "R", "SR", "SSR"];
      const candidates = EQUIPMENT_CATALOG.filter((e) => dropRarities.includes(e.rarity) && !FW.equipment.includes(e.id));
      if (candidates.length) {
        droppedItem = candidates[Math.floor(Math.random() * candidates.length)];
        dropText = `★${droppedItem.rarity} ${droppedItem.name}`;
      }
    }
    const nextDex = firstTime ? FW.dex.concat([enemy.id]) : FW.dex;
    const nextEquipment = droppedItem ? FW.equipment.concat([droppedItem.id]) : FW.equipment;
    const nextWinCounts = Object.assign({}, FW.winCounts, { [enemy.id]: fwWinCount(enemy.id) + 1 });
    FW.xp = nextXp; FW.dex = nextDex; FW.equipment = nextEquipment; FW.winCounts = nextWinCounts;
    fwSave({ fw_xp: nextXp, fw_dex: nextDex, fw_equipment: nextEquipment, fw_win_counts: nextWinCounts });
    adjustCoins(reward.yeen);

    if (enemy.id === "genkai") { fwShowEnding(reward, firstTime); return; }

    document.getElementById("fw-result-title").textContent = `* ${enemy.name} を たおした。`;
    document.getElementById("fw-result-quote").innerHTML = `* ${enemy.name}は 小さくつぶやいた。<br>${enemy.quote}`;
    document.getElementById("fw-result-xp").textContent = `+${reward.xp}`;
    document.getElementById("fw-result-yeen").textContent = `+${reward.yeen}`;
    document.getElementById("fw-result-drop").querySelector(".fw-val").textContent = dropText;
    document.getElementById("fw-result-dex").textContent = firstTime ? `「${enemy.name}」登録` : "登録済み";
    fwGoView("fw-v-result");
  }

  // 「みまもる」でHPを削りきらずに戦闘を終えたときの処理(周回値は増やさない)
  function fwSpareBattle(enemy) {
    const firstTime = !FW.dex.includes(enemy.id);
    const reward = fwEnemyRewardEffective(enemy);
    const halfXp = Math.round(reward.xp * 0.6);
    const halfYeen = Math.round(reward.yeen * 0.6);
    const nextXp = FW.xp + halfXp;
    const nextDex = firstTime ? FW.dex.concat([enemy.id]) : FW.dex;
    FW.xp = nextXp; FW.dex = nextDex;
    fwSave({ fw_xp: nextXp, fw_dex: nextDex });
    adjustCoins(halfYeen);

    if (enemy.id === "genkai") { fwShowEnding({ xp: halfXp, yeen: halfYeen }, firstTime); return; }

    document.getElementById("fw-result-title").textContent = `* ${enemy.name}を みまもった。`;
    document.getElementById("fw-result-quote").innerHTML = `* ${enemy.name}は 静かに気配を消した。<br>${enemy.quote}`;
    document.getElementById("fw-result-xp").textContent = `+${halfXp}`;
    document.getElementById("fw-result-yeen").textContent = `+${halfYeen}`;
    document.getElementById("fw-result-drop").querySelector(".fw-val").textContent = "なし";
    document.getElementById("fw-result-dex").textContent = firstTime ? `「${enemy.name}」登録` : "登録済み";
    fwGoView("fw-v-result");
  }

  // ゲンカイ決着時、ルート判定に応じてエンディングを出し分ける
  function fwShowEnding(reward, firstTime) {
    const route = fwDetermineRoute();
    FW.route = route;
    fwSave({ fw_route: route });
    const ending = ROUTE_ENDING[route];
    document.getElementById("fw-result-title").innerHTML = ending.title;
    document.getElementById("fw-result-quote").innerHTML = ending.quote;
    document.getElementById("fw-result-xp").textContent = `+${reward.xp}`;
    document.getElementById("fw-result-yeen").textContent = `+${reward.yeen}`;
    document.getElementById("fw-result-drop").querySelector(".fw-val").textContent = "なし";
    document.getElementById("fw-result-dex").textContent = firstTime ? "「ゲンカイ」登録" : "登録済み";
    fwGoView("fw-v-result");
  }

  function fwLoseBattle(enemy) {
    document.getElementById("fw-result-title").textContent = `* ${enemy.name}に 追い返された…`;
    document.getElementById("fw-result-quote").innerHTML = `* また特訓して 出直そう。`;
    document.getElementById("fw-result-xp").textContent = "+0";
    document.getElementById("fw-result-yeen").textContent = "+0";
    document.getElementById("fw-result-drop").querySelector(".fw-val").textContent = "なし";
    document.getElementById("fw-result-dex").textContent = "-";
    fwGoView("fw-v-result");
  }

  /* ================= 公開API ================= */
  window.FocusWorld = {
    open() {
      // [2026-07-28変更] 小さいカード→全画面へゆっくり広がる演出 → welcome → 洞窟入口を歩いて入る、の順で開く
      FW.open = true;
      const overlay = document.getElementById("fw-overlay");
      const modal = overlay.querySelector(".fw-modal");
      overlay.classList.add("open");
      if (modal) {
        modal.classList.remove("fw-modal-full");
        void modal.offsetWidth; // reflow: 小さいサイズを一度確定させてからfullを付与し、transitionを発火させる
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("fw-modal-full")));
      }
      fwRenderHome(); // ホーム画面のデータは裏側で先に準備しておく
      fwGoView("fw-v-home"); // [2026-07-29変更] 開くたびの演出はやめ、直接ホームへ
    },
    close() {
      FW.open = false;
      document.getElementById("fw-overlay").classList.remove("open");
      const modal = document.querySelector("#fw-overlay .fw-modal");
      if (modal) modal.classList.remove("fw-modal-full");
    },
    showHome() { fwGoView("fw-v-home"); fwRenderHome(); },
    showChapters() { fwGoView("fw-v-chapters"); fwRenderHome(); },
    continueGame: fwContinueWithIntro,
    showEquip() { fwGoView("fw-v-equip"); fwRenderEquip(); },
    showShop() { fwGoView("fw-v-shop"); fwRenderShop(); },
    setShopTab: fwSetShopTab,
    toggleEquip: fwToggleEquip,
    gachaPull: fwGachaPull,
    buyBuff: fwBuyBuff,
    buyItem: fwBuyItem,
    learnSkill: fwLearnSkill,
    startBattle: fwStartIntro,
    skipIntro: fwSkipIntro,
    act: fwAct,
    openItemMenu: fwOpenItemMenu,
    closeItemMenu: fwCloseItemMenu,
    openSkillMenu: fwOpenSkillMenu,
    closeSkillMenu: fwCloseSkillMenu,
    talkYurumi: fwTalkYurumi,
    startNamida: fwStartNamida,
    namidaRespond: fwNamidaRespond,
    corridorAdvance: fwCorridorAdvance,
  };

  /* ================= CSS ================= */
  const FW_CSS = `
  #fw-root{ font-family:'Zen Kaku Gothic New', sans-serif; }
  .fw-launcher{
    position:fixed; right:16px; bottom:84px; z-index:9998; display:flex; align-items:center; gap:8px;
    background:var(--accent,#c1503a); color:#fff; border:none; border-radius:999px; padding:12px 18px;
    font-family:'Zen Kaku Gothic New', sans-serif; font-weight:700; font-size:13px; cursor:pointer;
    box-shadow:0 8px 24px rgba(0,0,0,.35);
  }
  .fw-launcher-icon{ font-size:16px; }
  .fw-launcher-alert{ animation:fw-pulse 1.6s ease-in-out infinite; }
  @keyframes fw-pulse{ 0%,100%{ box-shadow:0 8px 24px rgba(0,0,0,.35);} 50%{ box-shadow:0 8px 24px rgba(193,80,58,.75);} }

  .fw-overlay{ position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.6); padding:0; }
  .fw-overlay.open{ display:flex; }
  /* [2026-07-28追加] 起動時に「小さいカード→全画面」へゆっくり広がる演出。
     開いた瞬間は通常サイズで描画し、直後にJS側で .fw-modal-full を付与してこのtransitionを発火させる。 */
  .fw-modal{ position:relative; width:min(420px, calc(100vw - 40px)); height:min(720px, calc(100vh - 40px)); height:min(720px, calc(100dvh - 40px)); background:#0c0c0e; color:#f4f2ec; border-radius:20px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,.5); transition:width .9s cubic-bezier(.19,1,.22,1), height .9s cubic-bezier(.19,1,.22,1), border-radius .7s ease; }
  .fw-modal.fw-modal-full{ width:100vw; height:100vh; height:100dvh; border-radius:0; }
  .fw-view-equip, .fw-view-shop, .fw-view-chapters{ max-width:560px; margin:0 auto; }
  .fw-close{ position:absolute; top:10px; right:10px; z-index:5; background:rgba(255,255,255,.08); border:none; color:#f4f2ec; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:14px; }

  .fw-view{ position:absolute; inset:0; display:none; }
  .fw-view.active{ display:block; }
  .fw-view-equip, .fw-view-shop, .fw-view-chapters{ padding:26px 20px; overflow-y:auto; }

  /* ---- [2026-07-28追加] ホーム画面(ハブ) ---- */
  .fw-view-home{ flex-direction:column; height:100%; padding:0; max-width:560px; margin:0 auto; }
  .fw-view-home.active{ display:flex; flex-direction:column; }
  .fw-home-hub{ flex:1; overflow-y:auto; padding:26px 20px 12px; }
  .fw-hub-main{ display:flex; align-items:stretch; gap:12px; margin:6px 0 18px; }
  .fw-hub-hero{ flex:0 0 38%; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.03); padding:14px 8px; }
  .fw-hub-hero-sprite{ animation:fw-hub-idle 2.4s ease-in-out infinite; }
  @keyframes fw-hub-idle{ 0%,100%{ transform:translateY(0);} 50%{ transform:translateY(-4px);} }
  .fw-hub-hero-caption{ font-size:9px; color:#94938d; margin:8px 0 0; letter-spacing:.05em; }
  .fw-hub-status{ flex:1; min-width:0; display:flex; align-items:center; }
  .fw-hub-status .fw-stat-grid{ margin-bottom:0; width:100%; }
  .fw-btn-continue{ width:100%; border:none; background:#c1503a; color:#fff; padding:16px 0; font-size:14px; font-weight:900; letter-spacing:.05em; cursor:pointer; margin:4px 0 16px; font-family:inherit; box-shadow:0 6px 18px rgba(193,80,58,.35); }
  .fw-btn-continue:active{ transform:translateY(1px); }
  .fw-hub-navbar{ flex:0 0 auto; display:flex; border-top:1px solid rgba(255,255,255,.15); background:#0c0c0e; }
  .fw-navbar-btn{ flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; border:none; background:transparent; color:#94938d; padding:10px 0 12px; font-size:10px; cursor:pointer; font-family:inherit; }
  .fw-navbar-btn span{ font-size:16px; }
  .fw-navbar-btn:active{ color:#f4f2ec; }
  .fw-eyebrow{ font-size:9px; letter-spacing:.2em; text-transform:uppercase; color:#c1503a; margin:0 0 6px; }
  .fw-title{ font-size:17px; font-weight:900; margin:0 0 18px; }
  .fw-section-label{ font-size:10px; color:#94938d; letter-spacing:.08em; margin:20px 0 10px; }

  .fw-stat-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-bottom:16px; }
  .fw-level-block{ grid-column:1/-1; border:1px solid rgba(255,255,255,.2); padding:10px 14px; font-size:13px; font-weight:700; display:flex; justify-content:space-between; }
  .fw-level-block span{ color:#94938d; font-weight:400; font-size:11px; }
  .fw-stat-cell{ border:1px solid rgba(255,255,255,.15); padding:10px 12px; display:flex; justify-content:space-between; align-items:baseline; }
  .fw-stat-key{ font-size:10px; color:#94938d; letter-spacing:.06em; }
  .fw-stat-val{ font-family:'Space Grotesk', sans-serif; font-size:17px; }

  .fw-row-between{ display:flex; gap:10px; }
  .fw-btn-ghost{ flex:1; border:1px solid rgba(255,255,255,.3); background:transparent; color:#f4f2ec; padding:11px 0; font-size:11px; cursor:pointer; font-family:inherit; }
  .fw-btn-accent{ width:100%; border:none; background:#c1503a; color:#fff; padding:13px 0; font-size:12px; font-weight:700; cursor:pointer; margin:6px 0 4px; }
  .fw-back-btn{ margin-top:18px; }

  .fw-gate-card{ display:flex; align-items:center; gap:10px; border:1px solid rgba(255,255,255,.18); padding:10px 12px; margin-bottom:8px; cursor:pointer; }
  .fw-gate-card.fw-beaten{ opacity:.55; }
  .fw-gate-card.fw-gate-boss{ border-color:#e0435b; box-shadow:0 0 0 1px rgba(224,67,91,.35) inset; }
  .fw-gate-boss-tag{ display:inline-block; margin-left:6px; padding:1px 5px; font-size:8px; background:#e0435b; color:#fff; border-radius:3px; vertical-align:middle; }
  .fw-gate-sprite{ width:46px; height:46px; flex-shrink:0; }
  .fw-gate-info{ flex:1; }
  .fw-gate-title{ font-size:12px; font-weight:700; margin:0 0 3px; }
  .fw-gate-lv{ color:#94938d; font-weight:400; font-size:10px; }
  .fw-gate-sub{ font-size:9px; color:#94938d; margin:0; }
  .fw-gate-arrow{ color:#c1503a; }

  .fw-equip-list{ display:flex; flex-direction:column; gap:6px; }
  .fw-equip-row{ display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.18); padding:10px 12px; cursor:pointer; font-size:11px; }
  .fw-equip-row.fw-on{ border-color:#c1503a; background:rgba(193,80,58,.12); }
  .fw-rarity{ font-weight:900; font-size:10px; width:20px; }
  .fw-equip-name{ flex:1; }
  .fw-equip-bonus{ font-size:9px; color:#94938d; }
  .fw-equip-check{ font-size:9px; color:#c1503a; width:44px; text-align:right; }
  .fw-empty{ font-size:11px; color:#94938d; }
  .fw-buff-count{ color:#c1503a; }

  .fw-tabs{ display:flex; gap:8px; margin-bottom:14px; }
  .fw-tab{ flex:1; border:1px solid rgba(255,255,255,.25); background:transparent; color:#94938d; padding:9px 0; font-size:11px; cursor:pointer; font-family:inherit; }
  .fw-tab.active{ color:#f4f2ec; border-color:#c1503a; }
  .fw-shop-desc{ font-size:10px; color:#94938d; line-height:1.7; margin:0 0 4px; }
  .fw-catalog-list{ display:flex; flex-direction:column; gap:6px; }
  .fw-catalog-row{ display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.15); padding:9px 12px; font-size:10px; }
  .fw-btn-mini{ margin-left:auto; border:1px solid rgba(255,255,255,.3); background:transparent; color:#f4f2ec; font-size:9px; padding:6px 9px; cursor:pointer; font-family:inherit; white-space:nowrap; }

  .fw-view-game{ background:#000; color:#fff; font-family:'Press Start 2P', monospace; background-size:cover; background-position:center; }
  .fw-intro-wrap{ height:100%; display:flex; align-items:center; justify-content:center; padding:26px; cursor:pointer; }
  .fw-intro-text{ font-size:12px; line-height:2.3; text-align:left; }
  .fw-intro-skip{ position:absolute; bottom:20px; right:20px; font-size:8px; color:#666; }
  .fw-shape-svg{ display:block; }
  .fw-shape-img{ display:block; }

  .fw-battle-wrap{ height:100%; display:flex; flex-direction:column; }
  .fw-battle-top{ flex:1; position:relative; border-bottom:2px solid #fff; }
  .fw-enemy-tag{ position:absolute; top:16px; left:16px; font-size:9px; }
  .fw-nm{ display:block; margin-bottom:6px; }
  .fw-bar-row{ display:flex; align-items:center; gap:6px; margin-bottom:4px; }
  .fw-bar-label{ font-size:8px; color:#c8c6bd; width:16px; flex-shrink:0; letter-spacing:.05em; }
  .fw-bar-num{ font-size:8px; color:#c8c6bd; min-width:52px; font-family:'Space Grotesk', sans-serif; letter-spacing:.02em; }
  .fw-hpbar{ width:90px; height:9px; border:2px solid #fff; padding:1px; flex-shrink:0; }
  .fw-hpbar-fill{ height:100%; background:#5fae6b; width:100%; transition:width .5s steps(6), background .3s; }
  .fw-hpbar-fill.fw-bar-mid{ background:#e0b23c; }
  .fw-hpbar-fill.fw-bar-low{ background:#c1503a; animation:fw-hp-pulse 1s ease-in-out infinite; }
  @keyframes fw-hp-pulse{ 0%,100%{ opacity:1; } 50%{ opacity:.55; } }
  .fw-enemy-sprite{ position:absolute; top:50%; left:50%; transform:translate(-50%,-56%); animation:fw-float 1.6s ease-in-out infinite; }
  @keyframes fw-float{ 0%,100%{transform:translate(-50%,-56%);} 50%{transform:translate(-50%,-64%);} }
  .fw-battle-log{ position:absolute; bottom:14px; left:16px; right:16px; font-size:10px; line-height:1.9; min-height:38px; }
  .fw-battle-bottom{ min-height:220px; padding:14px 16px 18px; display:flex; flex-direction:column; justify-content:space-between; }
  .fw-player-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px; }
  .fw-player-tag{ flex:1; }
  .fw-mp-track{ width:90px; height:6px; border:2px solid #fff; padding:1px; flex-shrink:0; }
  .fw-mp-fill{ height:100%; background:#6c8ecf; width:100%; transition:width .4s; }
  .fw-lv-badge{ border:2px solid #fff; font-size:9px; padding:4px 7px; flex-shrink:0; }
  .fw-battle-actions{ display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#000; padding:6px; }
  .fw-fight-btn{ border:3px solid #fff; background:#000; color:#fff; font-family:'Press Start 2P', monospace; font-size:9px; padding:12px 4px; cursor:pointer; line-height:1.4; }
  .fw-fight-btn:disabled{ opacity:.3; cursor:default; }
  .fw-fight-btn:active:not(:disabled){ background:#fff; color:#000; }
  .fw-item-menu{ display:none; flex-direction:column; gap:6px; }
  .fw-item-menu.open{ display:flex; }
  .fw-item-menu-list{ display:flex; flex-direction:column; gap:6px; max-height:130px; overflow-y:auto; }
  .fw-item-menu-row{ display:flex; flex-direction:column; align-items:flex-start; gap:3px; border:2px solid #fff; background:transparent; color:#fff; font-family:'Press Start 2P', monospace; padding:8px 10px; cursor:pointer; text-align:left; }
  .fw-item-menu-row:active{ background:#fff; color:#000; }
  .fw-item-menu-row:disabled{ opacity:.35; cursor:not-allowed; }
  .fw-item-menu-row:disabled:active{ background:transparent; color:#fff; }
  .fw-item-menu-name{ font-size:9px; }
  .fw-item-menu-desc{ font-size:7px; color:#bbb; }
  .fw-item-menu-row:active .fw-item-menu-desc{ color:#555; }
  .fw-item-menu-back{ margin-top:0; }

  .fw-result-wrap{ height:100%; padding:28px 20px; display:flex; flex-direction:column; }
  .fw-result-title{ font-size:12px; margin:0 0 20px; text-align:center; line-height:1.6; }
  .fw-result-quote{ border:2px solid #fff; padding:14px; font-size:10px; line-height:2; margin-bottom:20px; }
  .fw-reward-row{ display:flex; justify-content:space-between; font-size:10px; padding:10px 0; border-bottom:1px solid #3a3a3a; }
  .fw-reward-row.fw-dim{ color:#8a8a8a; }
  .fw-result-btn{ margin-top:auto; border:3px solid #fff; background:#fff; color:#000; font-family:'Press Start 2P', monospace; font-size:10px; padding:13px 0; text-align:center; cursor:pointer; }

  .fw-toast{ position:fixed; left:50%; bottom:90px; transform:translate(-50%,10px); z-index:10000; background:#1a1a1a; color:#f4f2ec; border:1px solid rgba(255,255,255,.25); padding:10px 16px; font-size:11px; border-radius:8px; opacity:0; transition:opacity .25s, transform .25s; pointer-events:none; }
  .fw-toast.show{ opacity:1; transform:translate(-50%,0); }

  @media (max-width:420px){ .fw-launcher-label{ display:none; } .fw-launcher{ padding:12px; } }
  @media (max-width:700px){ .fw-launcher{ display:none !important; } }
  #fw-tabbtn{ position:relative; }
  #fw-tabbtn.fw-tabbtn-alert::after{ content:""; position:absolute; top:-2px; right:6px; width:7px; height:7px; border-radius:50%; background:var(--accent,#c1503a); }

  /* ---- 章分け(マップ代わり) ---- */
  .fw-chapter-label{ margin-top:22px; font-weight:700; }
  .fw-chapter-group{ border-left:3px solid var(--chapter-color, #444); padding-left:10px; display:flex; flex-direction:column; gap:6px; }
  .fw-gate-namida{ border-color:rgba(255,255,255,.35); background:rgba(255,255,255,.04); }

  /* ---- ユルミ相棒ウィジェット ---- */
  .fw-yurumi-box{ display:none; align-items:center; gap:10px; border:1px solid rgba(255,255,255,.18); border-radius:12px; padding:10px 12px; margin:14px 0 4px; background:rgba(255,255,255,.03); }
  .fw-yurumi-sprite{ width:40px; height:40px; flex-shrink:0; }
  .fw-yurumi-body{ flex:1; }
  .fw-yurumi-name{ font-size:11px; font-weight:700; margin:0 0 2px; color:#9bd; }
  .fw-yurumi-line{ font-size:11px; color:#c8c6bd; margin:0; }

  /* ---- ナミダ会話選択肢 ---- */
  .fw-namida-choice{ display:flex; flex-direction:column; gap:8px; margin-top:16px; }

  /* ---- 廊下(歩行パート) ---- */
  .fw-view-corridor{ background:#1a0303; overflow:hidden; cursor:pointer; }
  .fw-corridor-wrap{ position:relative; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding-bottom:60px; }
  .fw-corridor-track{ position:absolute; inset:0; background:repeating-linear-gradient(180deg, rgba(255,255,255,.05) 0px, rgba(255,255,255,.05) 2px, transparent 2px, transparent 40px); transition:transform .5s ease; }
  .fw-corridor-lane{ position:absolute; left:50%; top:0; bottom:0; width:2px; background:rgba(255,255,255,.15); transform:translateX(-50%); }
  .fw-corridor-walker{ position:relative; width:48px; height:48px; z-index:2; }
  .fw-walk-frame{ position:absolute; inset:0; opacity:0; }
  .fw-walk-anim .fw-walk-frame-1{ animation:fw-walk-toggle-1 .5s steps(1) infinite; }
  .fw-walk-anim .fw-walk-frame-2{ animation:fw-walk-toggle-2 .5s steps(1) infinite; }
  @keyframes fw-walk-toggle-1{ 0%,49%{opacity:1; transform:translateY(0);} 50%,100%{opacity:0;} }
  @keyframes fw-walk-toggle-2{ 0%,49%{opacity:0;} 50%,99%{opacity:1; transform:translateY(-2px);} 100%{opacity:0;} }
  .fw-corridor-quote{ position:relative; z-index:2; margin-top:18px; font-size:10px; color:rgba(255,255,255,.5); text-align:center; min-height:24px; opacity:0; padding:0 20px; }
  .fw-corridor-quote.fw-flash{ animation:fw-quote-flash 1.4s ease; }
  @keyframes fw-quote-flash{ 0%{opacity:0;} 20%{opacity:.9;} 80%{opacity:.9;} 100%{opacity:0;} }
  .fw-corridor-hint{ position:absolute; bottom:14px; font-size:8px; color:#666; z-index:2; }

  /* ---- [2026-07-28追加] 起動演出: welcome → 洞窟入口を歩いて入る ---- */
  .fw-view-welcome{ background:#000; }
  .fw-view-welcome.active{ display:flex; align-items:center; justify-content:center; }
  .fw-welcome-text{ font-size:22px; letter-spacing:6px; opacity:0; color:#f4f2ec; text-shadow:0 0 18px rgba(244,242,236,.5); }
  .fw-view-welcome.active .fw-welcome-text{ animation:fw-welcome-fade 2.4s ease forwards; }
  @keyframes fw-welcome-fade{ 0%{opacity:0; transform:scale(.88);} 28%{opacity:1; transform:scale(1);} 72%{opacity:1;} 100%{opacity:0;} }

  .fw-view-entrance{ background-color:#000; background-image:linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.55)), url('img/bg/entrance.png'); }
  .fw-entrance-wrap{ position:relative; height:100%; overflow:hidden; }
  .fw-entrance-walker{ position:absolute; left:50%; bottom:8%; width:84px; height:84px; transform:translate(-50%,0) scale(1.5); opacity:0; }
  .fw-entrance-walker.fw-entrance-walk{ opacity:1; animation:fw-entrance-move 2.8s cubic-bezier(.4,0,.6,1) forwards; }
  @keyframes fw-entrance-move{
    0%{ bottom:8%; transform:translate(-50%,0) scale(1.5); opacity:1; }
    60%{ bottom:14%; transform:translate(-50%,0) scale(1.4); opacity:1; }
    100%{ bottom:20%; transform:translate(-50%,0) scale(1.25); opacity:0; }
  }
  .fw-entrance-hint{ position:absolute; bottom:14px; left:0; right:0; text-align:center; font-size:8px; color:#8a8a8a; opacity:0; animation:fw-quote-flash 2.6s ease .3s; }
  `;

  /* ================= 起動 ================= */
  function fwListenCorridorKeys() {
    document.addEventListener("keydown", (ev) => {
      const view = document.getElementById("fw-v-corridor");
      if (!view || !view.classList.contains("active")) return;
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp" || ev.key === " ") {
        fwCorridorAdvance();
      }
    });
  }

  function init() {
    fwInjectFonts();
    fwInjectStyle();
    fwBuildRoot();
    fwListen();
    fwHookAddEntry();
    fwListenCorridorKeys();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();