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
  const STAT_PER_MIN = 100 / 600;
  const BASE_STAT = 100;

  const GACHA_COST = 300;

  const EQUIPMENT_CATALOG = [
    { id: "wood_sword", name: "木刀", rarity: "N", bonus: { atk: 5 } },
    { id: "cloth_cape", name: "布のマント", rarity: "N", bonus: { hp: 8 } },
    { id: "vocab_card", name: "単語帳のお守り", rarity: "N", bonus: { int: 5 } },
    { id: "run_shoes", name: "運動靴", rarity: "N", bonus: { agi: 6 } },
    { id: "iron_sword", name: "鉄の剣", rarity: "R", bonus: { atk: 12 } },
    { id: "swift_boots", name: "俊足のブーツ", rarity: "R", bonus: { agi: 15 } },
    { id: "focus_ring", name: "集中の指輪", rarity: "R", bonus: { int: 12, mp: 8 } },
    { id: "guard_charm", name: "守りのお札", rarity: "R", bonus: { hp: 16 } },
    { id: "sage_staff", name: "賢者の杖", rarity: "SR", bonus: { int: 25, mp: 15 } },
    { id: "fight_gauntlet", name: "闘志のガントレット", rarity: "SR", bonus: { atk: 22, hp: 10 } },
    { id: "gale_scarf", name: "疾風のマフラー", rarity: "SR", bonus: { agi: 25, atk: 8 } },
  ];
  const RARITY_WEIGHT = { N: 60, R: 32, SR: 8 };
  const RARITY_COLOR = { N: "#8a8a8a", R: "#6c8ecf", SR: "#d1a324" };
  const MAX_EQUIPPED = 3;

  const BUFF_CATALOG = [
    { id: "buff_atk", name: "気合いドリンク", desc: "次のバトルでATK+20", bonus: { atk: 20 }, price: 150 },
    { id: "buff_int", name: "集中サプリ", desc: "次のバトルでINT+20", bonus: { int: 20 }, price: 150 },
    { id: "buff_agi", name: "俊敏エキス", desc: "次のバトルでAGI+20", bonus: { agi: 20 }, price: 150 },
    { id: "buff_hp", name: "体力ゼリー", desc: "次のバトルでHP+30", bonus: { hp: 30 }, price: 180 },
    { id: "buff_all", name: "万能エナジー", desc: "次のバトルで全ステータス+10", bonus: { hp: 10, mp: 10, agi: 10, atk: 10, int: 10 }, price: 400 },
  ];

  const ENEMIES = [
    {
      id: "aseri", name: "あせり", type: "HONOO", level: 3, hp: 90, atk: 14,
      color1: "#c1503a", color2: "#e8b6a8", color3: "#5c2419",
      intro: ["* 集中の世界", "* 何かの気配がする…", "* 気配は3つ。うち1つが近づいてくる。"],
      encounter: "* あせりが あらわれた!",
      quote: "「…ただ、認められたかっただけ。」",
      reward: { xp: 24, yeen: 120 },
    },
    {
      id: "mayoi", name: "まよい", type: "YAMI", level: 5, hp: 120, atk: 18,
      color1: "#2b2740", color2: "#8a6fd1", color3: "#c94b4b",
      intro: ["* 集中の世界", "* 静かな気配…", "* 影がゆらりと動いた。"],
      encounter: "* まよいが あらわれた!",
      quote: "「自分を、信じられなかった。ただ、それだけなんだ。」",
      reward: { xp: 36, yeen: 180 },
    },
    {
      id: "namake", name: "なまけ", type: "YUME", level: 7, hp: 150, atk: 22,
      color1: "#d8c39a", color2: "#c1503a", color3: "#8a7658",
      intro: ["* 集中の世界", "* とても眠たい気配がする…", "* 何かが、あくびをした。"],
      encounter: "* なまけが あらわれた!",
      quote: "「少しくらい、休んでもいいと思ったんだ。」",
      reward: { xp: 50, yeen: 240 },
    },
  ];

  /* ================= 状態 ================= */
  const FW = {
    stats: { hp: BASE_STAT, mp: BASE_STAT, agi: BASE_STAT, atk: BASE_STAT, int: BASE_STAT },
    xp: 0,
    equipment: [],
    equipped: [],
    buffs: {},
    dex: [],
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
      fw_xp: 0, fw_equipment: [], fw_equipped: [], fw_buffs: {}, fw_dex: [],
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
        FW.dex = d.fw_dex || [];
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

          <div class="fw-view fw-view-home active" id="fw-v-home">
            <div class="fw-home-scroll">
              <p class="fw-eyebrow">FOCUS WORLD</p>
              <h2 class="fw-title">集中の世界</h2>
              <div class="fw-stat-grid" id="fw-stat-grid"></div>
              <div class="fw-row-between">
                <button class="fw-btn-ghost" onclick="FocusWorld.showEquip()">装備を選ぶ</button>
                <button class="fw-btn-ghost" onclick="FocusWorld.showShop()">ショップへ</button>
              </div>
              <p class="fw-section-label">敵の気配</p>
              <div id="fw-enemy-list"></div>
            </div>
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
              <button class="fw-tab" id="fw-tab-buff" onclick="FocusWorld.setShopTab('buff')">バフ</button>
            </div>
            <div id="fw-shop-body"></div>
            <button class="fw-btn-ghost fw-back-btn" onclick="FocusWorld.showHome()">← もどる</button>
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
                  <div class="fw-hpbar"><div class="fw-hpbar-fill" id="fw-enemy-hp"></div></div>
                </div>
                <div class="fw-enemy-sprite" id="fw-enemy-sprite"></div>
                <p class="fw-battle-log" id="fw-battle-log"></p>
              </div>
              <div class="fw-battle-bottom">
                <div class="fw-player-row">
                  <div class="fw-player-tag">
                    <span class="fw-nm" id="fw-player-name"></span>
                    <div class="fw-hpbar"><div class="fw-hpbar-fill fw-player-hpbar-fill" id="fw-player-hp"></div></div>
                    <div class="fw-mp-track"><div class="fw-mp-fill" id="fw-player-mp"></div></div>
                  </div>
                  <div class="fw-lv-badge" id="fw-player-lv"></div>
                </div>
                <div class="fw-battle-actions">
                  <button class="fw-fight-btn" id="fw-fight-btn" onclick="FocusWorld.act('attack')">たたかう</button>
                  <button class="fw-fight-btn" id="fw-special-btn" onclick="FocusWorld.act('special')">とくぎ(MP15)</button>
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
    const btn = document.getElementById("fw-launcher");
    if (!btn) return;
    const undefeated = ENEMIES.some((e) => !FW.dex.includes(e.id));
    btn.classList.toggle("fw-launcher-alert", undefeated);
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
      list.innerHTML = ENEMIES.map((e) => {
        const beaten = FW.dex.includes(e.id);
        return `
          <div class="fw-gate-card ${beaten ? "fw-beaten" : ""}" onclick="FocusWorld.startBattle('${e.id}')">
            <div class="fw-gate-sprite">${fwEnemySvg(e, 46)}</div>
            <div class="fw-gate-info">
              <p class="fw-gate-title">${e.name} <span class="fw-gate-lv">Lv.${e.level}</span></p>
              <p class="fw-gate-sub">${beaten ? "討伐ずみ・再戦できます" : "未討伐"}</p>
            </div>
            <span class="fw-gate-arrow">→</span>
          </div>`;
      }).join("");
    }
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
    document.getElementById("fw-tab-buff").classList.toggle("active", FW.shopTab === "buff");
    const body = document.getElementById("fw-shop-body");
    if (!body) return;
    if (FW.shopTab === "gacha") {
      body.innerHTML = `
        <p class="fw-shop-desc">1回 ${GACHA_COST} YEEN。装備がランダムで手に入ります(すでに持っている場合は半額のYEENを返却)。</p>
        <button class="fw-btn-accent" onclick="FocusWorld.gachaPull()">ガチャを引く</button>
        <p class="fw-section-label">ラインナップ</p>
        <div class="fw-catalog-list">
          ${EQUIPMENT_CATALOG.map((item) => `
            <div class="fw-catalog-row">
              <span class="fw-rarity" style="color:${RARITY_COLOR[item.rarity]}">${item.rarity}</span>
              <span class="fw-equip-name">${item.name}</span>
              <span class="fw-equip-bonus">${Object.keys(item.bonus).map((k) => `${STAT_LABEL[k]}+${item.bonus[k]}`).join(" ")}</span>
            </div>`).join("")}
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
      const refund = Math.round(GACHA_COST / 2);
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

  /* ---- 敵SVG(画像を使わず図形で表現) ---- */
  function fwEnemySvg(e, size) {
    if (e.id === "aseri") {
      return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="fw-shape-svg">
        <ellipse cx="50" cy="62" rx="26" ry="24" fill="${e.color1}"/>
        <polygon points="50,10 34,46 66,46" fill="${e.color1}"/>
        <polygon points="50,22 40,46 60,46" fill="${e.color2}"/>
        <ellipse cx="50" cy="70" rx="14" ry="12" fill="${e.color2}"/>
        <circle cx="41" cy="58" r="4" fill="#fff"/><circle cx="59" cy="58" r="4" fill="#fff"/>
        <circle cx="41" cy="58" r="2" fill="${e.color3}"/><circle cx="59" cy="58" r="2" fill="${e.color3}"/>
        <polygon points="24,70 12,60 20,80" fill="${e.color1}"/>
        <polygon points="76,70 88,60 80,80" fill="${e.color1}"/>
      </svg>`;
    }
    if (e.id === "mayoi") {
      return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="fw-shape-svg">
        <polygon points="50,14 20,90 80,90" fill="${e.color1}"/>
        <polygon points="50,30 34,84 66,84" fill="${e.color3}20"/>
        <circle cx="42" cy="52" r="4.5" fill="${e.color3}"/><circle cx="58" cy="52" r="4.5" fill="${e.color3}"/>
        <polygon points="12,86 20,50 30,86" fill="${e.color1}" opacity="0.8"/>
        <polygon points="88,86 80,50 70,86" fill="${e.color1}" opacity="0.8"/>
        <polygon points="40,86 50,66 60,86" fill="${e.color2}" opacity="0.5"/>
      </svg>`;
    }
    // namake
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="fw-shape-svg">
      <ellipse cx="50" cy="58" rx="34" ry="30" fill="${e.color1}"/>
      <ellipse cx="50" cy="74" rx="20" ry="14" fill="#fff5e6"/>
      <polygon points="50,54 40,66 60,66" fill="${e.color2}"/>
      <path d="M32 46 q8 -6 16 0" stroke="${e.color3}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M52 46 q8 -6 16 0" stroke="${e.color3}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="20" cy="56" rx="9" ry="14" fill="${e.color1}" transform="rotate(-20 20 56)"/>
      <ellipse cx="80" cy="56" rx="9" ry="14" fill="${e.color1}" transform="rotate(20 80 56)"/>
    </svg>`;
  }

  function fwHeroSvg(size) {
    return `<svg viewBox="0 0 60 80" width="${size}" height="${size * 80 / 60}" class="fw-shape-svg">
      <circle cx="30" cy="18" r="13" fill="#f4c9a0"/>
      <rect x="14" y="30" width="32" height="30" rx="6" fill="var(--accent, #c1503a)"/>
      <rect x="10" y="60" width="14" height="18" rx="3" fill="#3a3a3a"/>
      <rect x="36" y="60" width="14" height="18" rx="3" fill="#3a3a3a"/>
      <rect x="6" y="32" width="10" height="20" rx="4" fill="#f4c9a0"/>
      <rect x="44" y="32" width="10" height="20" rx="4" fill="#f4c9a0"/>
    </svg>`;
  }

  /* ---- イントロ(アンダーテール風タイプ演出) ---- */
  let introTyping = false, introStep = 0, introLines = [];
  function fwStartIntro(enemyId) {
    FW.battle = { enemyId, playerHp: 0, playerMaxHp: 0, playerMp: 0, playerMaxMp: 0, enemyHp: 0, enemyMaxHp: 0, over: false };
    const enemy = ENEMIES.find((e) => e.id === enemyId);
    introLines = enemy.intro.concat([enemy.encounter]);
    introStep = 0;
    fwGoView("fw-v-intro");
    document.getElementById("fw-intro-text").innerHTML = "";
    fwTypeNext();
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
    FW.battle.enemyMaxHp = enemy.hp;
    FW.battle.enemyHp = enemy.hp;
    FW.battle.over = false;

    // このバトルでバフを消費する
    if (Object.keys(FW.buffs).length) {
      FW.buffs = {};
      fwSave({ fw_buffs: {} });
    }

    document.getElementById("fw-enemy-name").textContent = `${enemy.name}(${enemy.type}) Lv.${enemy.level}`;
    document.getElementById("fw-enemy-sprite").innerHTML = fwEnemySvg(enemy, 100);
    document.getElementById("fw-player-name").textContent = "あなた";
    document.getElementById("fw-player-lv").textContent = `Lv.${fwLevel()}`;
    document.getElementById("fw-battle-log").textContent = `* ${enemy.name}は 様子をうかがっている。`;
    document.getElementById("fw-fight-btn").disabled = false;
    document.getElementById("fw-special-btn").disabled = FW.battle.playerMp < 15;
    fwUpdateBattleBars();
    fwGoView("fw-v-battle");
  }

  function fwUpdateBattleBars() {
    const b = FW.battle;
    document.getElementById("fw-enemy-hp").style.width = Math.max(0, (b.enemyHp / b.enemyMaxHp) * 100) + "%";
    document.getElementById("fw-player-hp").style.width = Math.max(0, (b.playerHp / b.playerMaxHp) * 100) + "%";
    document.getElementById("fw-player-mp").style.width = Math.max(0, (b.playerMp / b.playerMaxMp) * 100) + "%";
  }

  function fwAct(kind) {
    const b = FW.battle;
    if (!b || b.over) return;
    const enemy = ENEMIES.find((e) => e.id === b.enemyId);
    const log = document.getElementById("fw-battle-log");
    const fightBtn = document.getElementById("fw-fight-btn");
    const specialBtn = document.getElementById("fw-special-btn");
    if (kind === "special" && b.playerMp < 15) return;
    fightBtn.disabled = true; specialBtn.disabled = true;

    const steps = [];
    if (kind === "attack") {
      steps.push(() => { log.textContent = "* あなたの こうげき!"; });
      steps.push(() => {
        const dmg = Math.max(1, Math.round(b.eff.atk * 0.4 + (Math.random() * 6 - 3)));
        b.enemyHp = Math.max(0, b.enemyHp - dmg);
        fwUpdateBattleBars();
        log.textContent = `* ${enemy.name}に ${dmg} のダメージ!`;
      });
    } else {
      b.playerMp -= 15;
      steps.push(() => { log.textContent = "* あなたは とくぎを つかった!"; });
      steps.push(() => {
        const dmg = Math.max(1, Math.round(b.eff.int * 0.55 + (Math.random() * 6 - 3)));
        b.enemyHp = Math.max(0, b.enemyHp - dmg);
        fwUpdateBattleBars();
        log.textContent = `* 会心の一撃! ${enemy.name}に ${dmg} のダメージ!`;
      });
    }
    steps.push(() => {
      if (b.enemyHp <= 0) { b.over = true; setTimeout(() => fwWinBattle(enemy), 600); return; }
      const dodgeChance = Math.min(0.35, b.eff.agi / 400);
      if (Math.random() < dodgeChance) {
        log.textContent = `* ${enemy.name}の こうげき! …しかし かわした!`;
      } else {
        const dmg = Math.max(1, Math.round(enemy.atk * 0.35 + (Math.random() * 4 - 2)));
        b.playerHp = Math.max(0, b.playerHp - dmg);
        fwUpdateBattleBars();
        log.textContent = `* ${enemy.name}の こうげき! ${dmg} のダメージを受けた。`;
      }
    });
    steps.push(() => {
      if (b.playerHp <= 0) { b.over = true; setTimeout(() => fwLoseBattle(enemy), 600); return; }
      fightBtn.disabled = false;
      specialBtn.disabled = b.playerMp < 15;
    });

    let i = 0;
    const run = () => { if (i < steps.length) { steps[i](); i++; setTimeout(run, 750); } };
    run();
  }

  function fwWinBattle(enemy) {
    const firstTime = !FW.dex.includes(enemy.id);
    const nextXp = FW.xp + enemy.reward.xp;
    let dropText = "なし";
    let droppedItem = null;
    if (Math.random() < 0.25) {
      const candidates = EQUIPMENT_CATALOG.filter((e) => !FW.equipment.includes(e.id));
      if (candidates.length) {
        droppedItem = candidates[Math.floor(Math.random() * candidates.length)];
        dropText = `★${droppedItem.rarity} ${droppedItem.name}`;
      }
    }
    const nextDex = firstTime ? FW.dex.concat([enemy.id]) : FW.dex;
    const nextEquipment = droppedItem ? FW.equipment.concat([droppedItem.id]) : FW.equipment;
    FW.xp = nextXp; FW.dex = nextDex; FW.equipment = nextEquipment;
    fwSave({ fw_xp: nextXp, fw_dex: nextDex, fw_equipment: nextEquipment });
    adjustCoins(enemy.reward.yeen);

    document.getElementById("fw-result-title").textContent = `* ${enemy.name} を たおした。`;
    document.getElementById("fw-result-quote").innerHTML = `* ${enemy.name}は 小さくつぶやいた。<br>${enemy.quote}`;
    document.getElementById("fw-result-xp").textContent = `+${enemy.reward.xp}`;
    document.getElementById("fw-result-yeen").textContent = `+${enemy.reward.yeen}`;
    document.getElementById("fw-result-drop").querySelector(".fw-val").textContent = dropText;
    document.getElementById("fw-result-dex").textContent = firstTime ? `「${enemy.name}」登録` : "登録済み";
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
      FW.open = true;
      document.getElementById("fw-overlay").classList.add("open");
      fwGoView("fw-v-home");
      fwRenderHome();
    },
    close() {
      FW.open = false;
      document.getElementById("fw-overlay").classList.remove("open");
    },
    showHome() { fwGoView("fw-v-home"); fwRenderHome(); },
    showEquip() { fwGoView("fw-v-equip"); fwRenderEquip(); },
    showShop() { fwGoView("fw-v-shop"); fwRenderShop(); },
    setShopTab: fwSetShopTab,
    toggleEquip: fwToggleEquip,
    gachaPull: fwGachaPull,
    buyBuff: fwBuyBuff,
    startBattle: fwStartIntro,
    skipIntro: fwSkipIntro,
    act: fwAct,
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

  .fw-overlay{ position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.6); padding:20px; }
  .fw-overlay.open{ display:flex; }
  .fw-modal{ position:relative; width:100%; max-width:420px; height:min(720px, 92vh); background:#0c0c0e; color:#f4f2ec; border-radius:20px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,.5); }
  .fw-close{ position:absolute; top:10px; right:10px; z-index:5; background:rgba(255,255,255,.08); border:none; color:#f4f2ec; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:14px; }

  .fw-view{ position:absolute; inset:0; display:none; }
  .fw-view.active{ display:block; }
  .fw-view-home, .fw-view-equip, .fw-view-shop{ padding:26px 20px; overflow-y:auto; }
  .fw-home-scroll{ padding-bottom:10px; }
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

  .fw-view-game{ background:#000; color:#fff; font-family:'Press Start 2P', monospace; }
  .fw-intro-wrap{ height:100%; display:flex; align-items:center; justify-content:center; padding:26px; cursor:pointer; }
  .fw-intro-text{ font-size:12px; line-height:2.3; text-align:left; }
  .fw-intro-skip{ position:absolute; bottom:20px; right:20px; font-size:8px; color:#666; }
  .fw-shape-svg{ display:block; }

  .fw-battle-wrap{ height:100%; display:flex; flex-direction:column; }
  .fw-battle-top{ flex:1; position:relative; border-bottom:2px solid #fff; }
  .fw-enemy-tag{ position:absolute; top:16px; left:16px; font-size:9px; }
  .fw-nm{ display:block; margin-bottom:6px; }
  .fw-hpbar{ width:110px; height:8px; border:2px solid #fff; padding:1px; }
  .fw-hpbar-fill{ height:100%; background:#8a8a8a; width:100%; transition:width .5s steps(6); }
  .fw-player-hpbar-fill{ background:#c1503a; }
  .fw-enemy-sprite{ position:absolute; top:50%; left:50%; transform:translate(-50%,-56%); animation:fw-float 1.6s ease-in-out infinite; }
  @keyframes fw-float{ 0%,100%{transform:translate(-50%,-56%);} 50%{transform:translate(-50%,-64%);} }
  .fw-battle-log{ position:absolute; bottom:14px; left:16px; right:16px; font-size:10px; line-height:1.9; min-height:38px; }
  .fw-battle-bottom{ height:190px; padding:14px 16px 18px; display:flex; flex-direction:column; justify-content:space-between; }
  .fw-player-row{ display:flex; align-items:center; justify-content:space-between; }
  .fw-mp-track{ width:110px; height:5px; border:2px solid #fff; padding:1px; margin-top:6px; }
  .fw-mp-fill{ height:100%; background:#6c8ecf; width:100%; transition:width .4s; }
  .fw-lv-badge{ border:2px solid #fff; font-size:9px; padding:4px 7px; }
  .fw-battle-actions{ display:flex; gap:8px; }
  .fw-fight-btn{ flex:1; border:3px solid #fff; background:transparent; color:#fff; font-family:'Press Start 2P', monospace; font-size:10px; padding:13px 0; cursor:pointer; }
  .fw-fight-btn:disabled{ opacity:.3; cursor:default; }
  .fw-fight-btn:active:not(:disabled){ background:#fff; color:#000; }

  .fw-result-wrap{ height:100%; padding:28px 20px; display:flex; flex-direction:column; }
  .fw-result-title{ font-size:12px; margin:0 0 20px; text-align:center; line-height:1.6; }
  .fw-result-quote{ border:2px solid #fff; padding:14px; font-size:10px; line-height:2; margin-bottom:20px; }
  .fw-reward-row{ display:flex; justify-content:space-between; font-size:10px; padding:10px 0; border-bottom:1px solid #3a3a3a; }
  .fw-reward-row.fw-dim{ color:#8a8a8a; }
  .fw-result-btn{ margin-top:auto; border:3px solid #fff; background:#fff; color:#000; font-family:'Press Start 2P', monospace; font-size:10px; padding:13px 0; text-align:center; cursor:pointer; }

  .fw-toast{ position:fixed; left:50%; bottom:90px; transform:translate(-50%,10px); z-index:10000; background:#1a1a1a; color:#f4f2ec; border:1px solid rgba(255,255,255,.25); padding:10px 16px; font-size:11px; border-radius:8px; opacity:0; transition:opacity .25s, transform .25s; pointer-events:none; }
  .fw-toast.show{ opacity:1; transform:translate(-50%,0); }

  @media (max-width:420px){ .fw-launcher-label{ display:none; } .fw-launcher{ padding:12px; } }
  `;

  /* ================= 起動 ================= */
  function init() {
    fwInjectFonts();
    fwInjectStyle();
    fwBuildRoot();
    fwListen();
    fwHookAddEntry();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();