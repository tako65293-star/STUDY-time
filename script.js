
// ===== 接続テスト(画面に直接、成功/失敗を表示する) =====
function checkFirebaseConnection() {
  const statusEl = document.getElementById("debug-status");
  if (typeof firebase === "undefined") {
    statusEl.textContent = "エラー: firebase本体が読み込めていません(SDKのscriptタグを確認)";
    statusEl.style.color = "#ff6b6b";
    return;
  }
  if (typeof db === "undefined") {
    statusEl.textContent = "エラー: dbが読み込めていません(firebase-config.jsを確認)";
    statusEl.style.color = "#ff6b6b";
    return;
  }
  db.collection(COLLECTION_NAME).limit(1).get()
    .then(() => {
      statusEl.textContent = "Firestoreに接続できています";
      statusEl.style.color = "#7ce8ff";
      setTimeout(() => (statusEl.style.display = "none"), 2500);
    })
    .catch((error) => {
      statusEl.textContent = "接続エラー: " + error.code + " / " + error.message;
      statusEl.style.color = "#ff6b6b";
    });
}

// ===== 設定 =====
const COLLECTION_NAME = "studyEntries";
const USERS_COLLECTION = "users";
const STORIES_COLLECTION = "stories";
const TODOS_COLLECTION = "todos";
const CHEERS_COLLECTION = "cheers";
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

// ===== ゲーム内通貨(YEEN) =====
const COIN_PER_MINUTE = 10;
let currentUserCoins = 0;

// ===== オンライン状態(ハートビート方式でおおよそのオンライン判定を行う) =====
const HEARTBEAT_INTERVAL_MS = 20000;
const ONLINE_THRESHOLD_MS = 45000;
let presenceHeartbeatInterval = null;

// ===== フレームショップ(アバターの縁取り) =====
const FRAME_CATALOG = [
  { id: "normal",   name: "ノーマル",       price: 0,    cssClass: "frame-normal" },
  { id: "sunset",   name: "サンセット",     price: 1000, cssClass: "frame-sunset" },
  { id: "ocean",    name: "オーシャン",     price: 1000, cssClass: "frame-ocean" },
  { id: "mint",     name: "ミント",         price: 1000, cssClass: "frame-mint" },
  { id: "gold",     name: "ゴールド",       price: 2500, cssClass: "frame-gold" },
  { id: "neonglow", name: "ネオングロー",   price: 2500, cssClass: "frame-neonglow" },
  { id: "star",     name: "スターダスト",   price: 3500, cssClass: "frame-star" },
  { id: "rainbow",  name: "レインボー",     price: 5000, cssClass: "frame-rainbow" },
  { id: "diamond",  name: "ダイヤモンド",   price: 6000, cssClass: "frame-diamond" },
];
let currentUserOwnedFrames = ["normal"];
let currentUserEquippedFrame = "normal";

// ===== ヘッダーショップ(プロフィール上部のバナー) =====
const HEADER_CATALOG = [
  { id: "normal",   name: "ノーマル",         price: 0,    cssClass: "header-normal" },
  { id: "sakura",   name: "さくら",           price: 1500, cssClass: "header-sakura" },
  { id: "citrus",   name: "シトラス",         price: 1500, cssClass: "header-citrus" },
  { id: "mint",     name: "ミントブリーズ",   price: 1500, cssClass: "header-mint" },
  { id: "night",    name: "ナイトスカイ",     price: 3000, cssClass: "header-night" },
  { id: "goldline", name: "ゴールドライン",   price: 3000, cssClass: "header-goldline" },
  { id: "galaxy",   name: "ギャラクシー",     price: 5000, cssClass: "header-galaxy" },
  { id: "aurora",   name: "オーロラ",         price: 6500, cssClass: "header-aurora" },
  { id: "custom",   name: "カスタム画像",     price: 3000, cssClass: "header-custom", isCustom: true },
];
let currentUserOwnedHeaders = ["normal"];
let currentUserEquippedHeader = "normal";
let currentUserCustomHeaderImage = null;

// ===== 称号バッジショップ =====
const BADGE_CATALOG = [
  { id: "normal",   name: "称号なし",       price: 0,    emoji: "" },
  { id: "oni",      name: "鬼勉強家",       price: 1000, emoji: "😈" },
  { id: "tensai",   name: "天才肌",         price: 1500, emoji: "🧠" },
  { id: "syuuchuu", name: "集中の化身",     price: 2000, emoji: "🎯" },
  { id: "kotei",    name: "皇帝",           price: 3000, emoji: "👑" },
];
let currentUserOwnedBadges = ["normal"];
let currentUserEquippedBadge = "normal";

// ===== 記録演出エフェクトショップ =====
const EFFECT_CATALOG = [
  { id: "normal",   name: "エフェクトなし", price: 0,    emoji: "" },
  { id: "gold",     name: "黄金の輝き",     price: 1000, emoji: "✨" },
  { id: "confetti", name: "紙吹雪",         price: 1500, emoji: "🎉" },
  { id: "sakura",   name: "桜吹雪",         price: 1500, emoji: "🌸" },
  { id: "fire",     name: "炎のエフェクト", price: 2000, emoji: "🔥" },
];
let currentUserOwnedEffects = ["normal"];
let currentUserEquippedEffect = "normal";

// ===== やることチェックマークショップ =====
const CHECKMARK_CATALOG = [
  { id: "normal", name: "ノーマル",   price: 0 },
  { id: "star",   name: "★スター",   price: 500 },
  { id: "heart",  name: "♡ハート",   price: 500 },
  { id: "flame",  name: "🔥フレイム", price: 800 },
  { id: "crown",  name: "👑クラウン", price: 1200 },
];
let currentUserOwnedCheckmarks = ["normal"];
let currentUserEquippedCheckmark = "normal";

// ===== 記録一覧の便箋スキンショップ =====
const SKIN_CATALOG = [
  { id: "normal", name: "ノーマル",   price: 0 },
  { id: "washi",  name: "和紙",       price: 800 },
  { id: "kraft",  name: "クラフト紙", price: 800 },
  { id: "ink",    name: "墨だまり",   price: 1200 },
  { id: "gold",   name: "金箔",       price: 2000 },
];
let currentUserOwnedSkins = ["normal"];
let currentUserEquippedSkin = "normal";

// ===== YEENを増やすボーナス各種の設定 =====
const STREAK_BONUS_MILESTONES = { 3: 30, 7: 100, 30: 500 };
const TODO_BONUS = 5;
const STORY_BONUS = 20;
const LOGIN_BONUS_BASE = 10;
const LOGIN_BONUS_STEP = 2;
const LOGIN_BONUS_MAX = 60;
const WEEKLY_RANK_BONUS = 300;
const RANK_BONUS_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12時間ごと
const RANK_BONUS_AMOUNTS = { 1: 100, 2: 70, 3: 50 };

// ---- 早起き勉強ボーナス(朝6〜9時に記録すると倍率アップ) ----
const EARLY_BIRD_START_HOUR = 6;
const EARLY_BIRD_END_HOUR = 9;
const EARLY_BIRD_MULTIPLIER = 1.3;

// ---- 苦手科目ボーナス(あまり選ばれていない科目を選ぶと割増) ----
const WEAK_SUBJECT_MULTIPLIER = 1.2;
const FIXED_SUBJECTS = ["数学", "国語", "英語", "理科", "社会"];

// ---- 週替わりイベント(曜日/週替わりボーナス) ----
const EVENT_SUBJECT_MULTIPLIER = 1.5;

// ---- 友達を応援する(いいね) ----
const CHEER_SENDER_BONUS = 5;
const CHEER_RECEIVER_BONUS = 10;

// ---- 友達紹介 ----
const REFERRAL_BONUS = 200;

// ---- デイリークエスト ----
const DAILY_QUEST_DEFS = [
  {
    id: "twoSubjects",
    label: "今日は2科目以上勉強する",
    bonus: 30,
    check: (todayEntries) => new Set(todayEntries.map((e) => e.subject)).size >= 2,
  },
  {
    id: "weakSubject",
    label: "苦手科目(あまりやっていない科目)を1回やる",
    bonus: 20,
    check: (todayEntries, allMineEntries) => {
      const weak = getWeakSubject(allMineEntries);
      if (!weak) return false;
      return todayEntries.some((e) => e.subject === weak);
    },
  },
];

// ---- 週間目標 ----
const DEFAULT_WEEKLY_GOAL_MINUTES = 300;
const WEEKLY_GOAL_BONUS = 150;

// ---- デイリーくじ ----
const LOTTERY_TABLE = [
  { amount: 5, weight: 30 },
  { amount: 10, weight: 25 },
  { amount: 20, weight: 20 },
  { amount: 40, weight: 12 },
  { amount: 80, weight: 8 },
  { amount: 200, weight: 4 },
  { amount: 888, weight: 1 },
];

// ---- 管理者モード ----
const ADMIN_ACCOUNT_NAME = "YAMA";

let entries = [];
let rawEntries = []; // Firestoreから来た全ての記録(削除済みアカウント分も含む。管理者パネル用)
let usersByName = {};
let allUserDocs = []; // 全ユーザーの生データ一覧(名前が重複していても全員分残る。管理者パネル用)
let deletedUids = new Set(); // 「削除済み(非表示)」になっているアカウントのuid一覧
function refreshVisibleEntries() {
  // 削除済みアカウントに紐づく記録はランキングや通常画面からは隠す
  entries = rawEntries.filter((e) => !e.uid || !deletedUids.has(e.uid));
}
let dailyTopNames = new Set();
function updateDailyTopNames() {
  const todayRanked = withRanks(getTodayTotals(entries));
  dailyTopNames = new Set(
    todayRanked.filter((r) => r.rank === 1 && r.minutes > 0).map((r) => r.name)
  );
}

let stories = [];
let storyViewerList = [];
let storyViewerIndex = 0;
let todos = [];
let storyAddPhotoBase64 = null;
let currentUserName = null;
let currentUserPhoto = null;
let currentUserAwardedStreaks = [];
let currentUserReferralCode = null;
let currentUserReferredByCode = null;
let currentUserLoginStreak = 0;
let currentUserWeeklyGoalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES;
let currentUserWeeklyGoalAwardedWeekId = null;
let currentUserDailyQuestState = { date: null, completed: [] };
let currentUserLastLotteryDate = null;
let myCheeredTodayUids = new Set();

function getCurrentUser() {
  return currentUserName;
}

function todayOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ===== アバター(プロフィール写真)まわり =====
function isUserOnline(name) {
  const info = usersByName[name];
  if (!info || !info.lastActiveMs) return false;
  return Date.now() - info.lastActiveMs < ONLINE_THRESHOLD_MS;
}

function sendPresenceHeartbeat() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ lastActive: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
    .catch((error) => {
      console.error("オンライン状態の更新に失敗しました:", error);
    });
}

function startPresenceHeartbeat() {
  sendPresenceHeartbeat();
  if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
  presenceHeartbeatInterval = setInterval(() => {
    sendPresenceHeartbeat();
    renderAll();
    renderStoriesBar();
  }, HEARTBEAT_INTERVAL_MS);
}

function stopPresenceHeartbeat() {
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval);
    presenceHeartbeatInterval = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") sendPresenceHeartbeat();
});

function getAvatarColor(name) {
  const colors = ["#7ce8ff", "#ffd25a", "#ff9b9b", "#b19cd9", "#8fd9a8", "#f7a4c9"];
  let hash = 0;
  const str = name || "";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function setAvatarElement(el, name, photo) {
  if (!el) return;
  if (photo) {
    el.style.background = "transparent";
    el.innerHTML = `<img src="${photo}" alt="">`;
  } else {
    el.style.background = getAvatarColor(name || "");
    el.textContent = (name || "?").trim().charAt(0).toUpperCase();
  }
  el.classList.toggle("is-daily-top", dailyTopNames.has(name));
  el.classList.toggle("is-online", isUserOnline(name));
}

function avatarSpan(name, photo, sizeClass) {
  const crownClass = dailyTopNames.has(name) ? " is-daily-top" : "";
  const onlineClass = isUserOnline(name) ? " is-online" : "";
  if (photo) {
    return `<span class="avatar ${sizeClass}${crownClass}${onlineClass}"><img src="${photo}" alt=""></span>`;
  }
  const color = getAvatarColor(name || "");
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return `<span class="avatar ${sizeClass}${crownClass}${onlineClass}" style="background:${color}">${initial}</span>`;
}

function resizeImageToBase64(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height >= width && height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  const message = document.getElementById("settings-message");
  const user = auth.currentUser;
  if (!user) return;
  message.textContent = "アップロード中...";
  try {
    const base64 = await resizeImageToBase64(file, 200, 0.6);
    await db.collection(USERS_COLLECTION).doc(user.uid).set({ photo: base64 }, { merge: true });
    currentUserPhoto = base64;
    localStorage.setItem(DEVICE_PHOTO_KEY, base64);
    message.textContent = "写真を変更しました!";
    renderAll();
    setTimeout(() => (message.textContent = ""), 2500);
  } catch (error) {
    message.textContent = "アップロード失敗: " + error.message;
  }
}

function startListeningUsers() {
  db.collection(USERS_COLLECTION).onSnapshot(
    (snapshot) => {
      const map = {};
      const docsList = [];
      const delSet = new Set();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        docsList.push({
          uid: doc.id,
          name: data.name || null,
          email: data.email || null,
          photo: data.photo || null,
          coins: data.coins || 0,
          deleted: !!data.deleted,
          ownedFrames: data.ownedFrames || ["normal"],
          equippedFrame: data.equippedFrame || "normal",
          ownedHeaders: data.ownedHeaders || ["normal"],
          equippedHeader: data.equippedHeader || "normal",
          ownedBadges: data.ownedBadges || ["normal"],
          equippedBadge: data.equippedBadge || "normal",
          ownedEffects: data.ownedEffects || ["normal"],
          equippedEffect: data.equippedEffect || "normal",
          ownedCheckmarks: data.ownedCheckmarks || ["normal"],
          equippedCheckmark: data.equippedCheckmark || "normal",
          ownedSkins: data.ownedSkins || ["normal"],
          equippedSkin: data.equippedSkin || "normal",
        });
        if (data.deleted) {
          delSet.add(doc.id);
        } else if (data.name) {
          // 同じ名前のアカウントが複数ある場合、ここでは最後に読み込まれた1件だけが残る
          // (通常のランキング・友達一覧表示用)。全アカウントの一覧は allUserDocs / 管理者パネルで確認できる。
          map[data.name] = {
            photo: data.photo || null,
            uid: doc.id,
            coins: data.coins || 0,
            badge: data.equippedBadge || "normal",
            lastActiveMs: data.lastActive && data.lastActive.toMillis ? data.lastActive.toMillis() : 0,
          };
        }
        const user = auth.currentUser;
        if (user && doc.id === user.uid) {
          currentUserCoins = data.coins || 0;
          currentUserOwnedFrames = data.ownedFrames || ["normal"];
          currentUserEquippedFrame = data.equippedFrame || "normal";
          currentUserOwnedHeaders = data.ownedHeaders || ["normal"];
          currentUserEquippedHeader = data.equippedHeader || "normal";
          currentUserCustomHeaderImage = data.customHeaderImage || null;
          currentUserOwnedBadges = data.ownedBadges || ["normal"];
          currentUserEquippedBadge = data.equippedBadge || "normal";
          currentUserOwnedEffects = data.ownedEffects || ["normal"];
          currentUserEquippedEffect = data.equippedEffect || "normal";
          currentUserOwnedCheckmarks = data.ownedCheckmarks || ["normal"];
          currentUserEquippedCheckmark = data.equippedCheckmark || "normal";
          currentUserOwnedSkins = data.ownedSkins || ["normal"];
          currentUserEquippedSkin = data.equippedSkin || "normal";
          currentUserAwardedStreaks = data.awardedStreaks || [];
          currentUserReferralCode = data.referralCode || null;
          currentUserReferredByCode = data.referredByCode || null;
          currentUserLoginStreak = data.loginStreak || 0;
          currentUserWeeklyGoalMinutes = data.weeklyGoalMinutes || DEFAULT_WEEKLY_GOAL_MINUTES;
          currentUserWeeklyGoalAwardedWeekId = data.weeklyGoalAwardedWeekId || null;
          currentUserDailyQuestState = data.dailyQuestState || { date: null, completed: [] };
          currentUserLastLotteryDate = data.lastLotteryDate || null;
        }
      });
      usersByName = map;
      allUserDocs = docsList;
      deletedUids = delSet;
      refreshVisibleEntries();
      renderAll();
      renderStoriesBar();
    },
    (error) => {
      console.error("ユーザー情報の取得に失敗しました:", error);
    }
  );
}

function getMyCoins() {
  return currentUserCoins;
}

function adjustCoins(amount) {
  const user = auth.currentUser;
  if (!user || !amount) return Promise.resolve();
  return adjustCoinsForUid(user.uid, amount);
}

function adjustCoinsForUid(uid, amount) {
  if (!uid || !amount) return Promise.resolve();
  const ref = db.collection(USERS_COLLECTION).doc(uid);
  return db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const current = (doc.exists && doc.data().coins) || 0;
      const next = Math.max(0, current + amount);
      tx.set(ref, { coins: next }, { merge: true });
    });
  }).catch((error) => {
    console.error("コインの更新に失敗しました:", error);
  });
}

// ===== フレーム・ヘッダーの購入/装着 =====
function buyFrame(frameId) {
  const item = FRAME_CATALOG.find((f) => f.id === frameId);
  const user = auth.currentUser;
  if (!item || !user) return;
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const coins = data.coins || 0;
      const owned = data.ownedFrames || ["normal"];
      if (owned.includes(frameId)) return;
      if (coins < item.price) throw new Error("YEENが足りません");
      tx.set(ref, {
        coins: coins - item.price,
        ownedFrames: [...owned, frameId],
        equippedFrame: frameId,
      }, { merge: true });
    });
  }).catch((error) => {
    alert(error.message || "購入に失敗しました");
  });
}

function equipFrame(frameId) {
  const user = auth.currentUser;
  if (!user || !currentUserOwnedFrames.includes(frameId)) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ equippedFrame: frameId }, { merge: true })
    .catch((error) => console.error("フレームの装着に失敗しました:", error));
}

function buyHeader(headerId) {
  const item = HEADER_CATALOG.find((h) => h.id === headerId);
  const user = auth.currentUser;
  if (!item || !user) return;
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const coins = data.coins || 0;
      const owned = data.ownedHeaders || ["normal"];
      if (owned.includes(headerId)) return;
      if (coins < item.price) throw new Error("YEENが足りません");
      tx.set(ref, {
        coins: coins - item.price,
        ownedHeaders: [...owned, headerId],
        equippedHeader: headerId,
      }, { merge: true });
    });
  }).catch((error) => {
    alert(error.message || "購入に失敗しました");
  });
}

function equipHeader(headerId) {
  const user = auth.currentUser;
  if (!user || !currentUserOwnedHeaders.includes(headerId)) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ equippedHeader: headerId }, { merge: true })
    .catch((error) => console.error("ヘッダーの装着に失敗しました:", error));
}

// ===== ヘッダー(カスタム画像) =====
let headerCustomPendingIntent = null;
function triggerHeaderCustomFile(intent) {
  headerCustomPendingIntent = intent;
  const input = document.getElementById("header-custom-file-input");
  if (input) input.click();
}

async function handleHeaderCustomFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    const base64 = await resizeImageToBase64(file, 1600, 0.6);
    if (headerCustomPendingIntent === "buy") {
      await buyCustomHeaderImage(base64);
    } else {
      await updateCustomHeaderImage(base64);
    }
  } catch (error) {
    alert("画像の設定に失敗しました: " + error.message);
  }
}

function buyCustomHeaderImage(base64) {
  const item = HEADER_CATALOG.find((h) => h.id === "custom");
  const user = auth.currentUser;
  if (!item || !user) return Promise.resolve();
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  return db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const coins = data.coins || 0;
      const owned = data.ownedHeaders || ["normal"];
      if (owned.includes("custom")) {
        tx.set(ref, { customHeaderImage: base64, equippedHeader: "custom" }, { merge: true });
        return;
      }
      if (coins < item.price) throw new Error("YEENが足りません");
      tx.set(ref, {
        coins: coins - item.price,
        ownedHeaders: [...owned, "custom"],
        equippedHeader: "custom",
        customHeaderImage: base64,
      }, { merge: true });
    });
  }).catch((error) => {
    alert(error.message || "購入に失敗しました");
  });
}

function updateCustomHeaderImage(base64) {
  const user = auth.currentUser;
  if (!user) return Promise.resolve();
  return db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ customHeaderImage: base64, equippedHeader: "custom" }, { merge: true })
    .catch((error) => {
      alert("画像の更新に失敗しました: " + error.message);
    });
}

// ===== 称号/エフェクト/チェックマーク/スキン ショップ(共通ロジック) =====
const ITEM_SHOP_TABS = {
  badge:     { catalog: BADGE_CATALOG,     ownedField: "ownedBadges",     equippedField: "equippedBadge" },
  effect:    { catalog: EFFECT_CATALOG,    ownedField: "ownedEffects",    equippedField: "equippedEffect" },
  checkmark: { catalog: CHECKMARK_CATALOG, ownedField: "ownedCheckmarks", equippedField: "equippedCheckmark" },
  skin:      { catalog: SKIN_CATALOG,      ownedField: "ownedSkins",      equippedField: "equippedSkin" },
};

function ownedListForField(field) {
  return {
    ownedBadges: currentUserOwnedBadges,
    ownedEffects: currentUserOwnedEffects,
    ownedCheckmarks: currentUserOwnedCheckmarks,
    ownedSkins: currentUserOwnedSkins,
  }[field];
}

function equippedIdForField(field) {
  return {
    equippedBadge: currentUserEquippedBadge,
    equippedEffect: currentUserEquippedEffect,
    equippedCheckmark: currentUserEquippedCheckmark,
    equippedSkin: currentUserEquippedSkin,
  }[field];
}

function buyShopItem(tabKey, itemId) {
  const cfg = ITEM_SHOP_TABS[tabKey];
  const item = cfg.catalog.find((i) => i.id === itemId);
  const user = auth.currentUser;
  if (!item || !user) return;
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const coins = data.coins || 0;
      const owned = data[cfg.ownedField] || ["normal"];
      if (owned.includes(itemId)) return;
      if (coins < item.price) throw new Error("YEENが足りません");
      tx.set(ref, {
        coins: coins - item.price,
        [cfg.ownedField]: [...owned, itemId],
        [cfg.equippedField]: itemId,
      }, { merge: true });
    });
  }).catch((error) => {
    alert(error.message || "購入に失敗しました");
  });
}

function equipShopItem(tabKey, itemId) {
  const cfg = ITEM_SHOP_TABS[tabKey];
  const user = auth.currentUser;
  const owned = ownedListForField(cfg.ownedField);
  if (!user || !owned.includes(itemId)) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ [cfg.equippedField]: itemId }, { merge: true })
    .catch((error) => console.error("装着に失敗しました:", error));
}

function itemShopPreviewHtml(tabKey, item) {
  if (tabKey === "badge") {
    return `<div class="badge-preview">${item.emoji || "—"}</div>`;
  }
  if (tabKey === "effect") {
    return `<div class="effect-preview">${item.emoji || "—"}</div>`;
  }
  if (tabKey === "checkmark") {
    return `<div class="ck-preview ck-${item.id}"></div>`;
  }
  return `<div class="skin-preview skin-${item.id}"></div>`;
}

function itemShopButtonHtml(tabKey, item, owned, equippedId) {
  const isOwned = owned.includes(item.id);
  const isEquipped = equippedId === item.id;
  if (isEquipped) {
    return `<button class="btn-mini-accent" disabled style="width:100%;">装着中</button>`;
  }
  if (isOwned) {
    return `<button class="btn-secondary" style="width:100%;" onclick="equipShopItem('${tabKey}','${item.id}')">装着する</button>`;
  }
  const affordable = currentUserCoins >= item.price;
  return `<button class="btn-accent" style="width:100%;" ${affordable ? "" : "disabled"} onclick="buyShopItem('${tabKey}','${item.id}')">${item.price} YEEN で購入</button>`;
}

let itemShopTab = "badge";
function setItemShopTab(tab) {
  itemShopTab = tab;
  Object.keys(ITEM_SHOP_TABS).forEach((t) => {
    const btn = document.getElementById("itemshop-btn-" + t);
    if (btn) btn.classList.toggle("active", t === tab);
  });
  renderItemShop();
}

function renderItemShop() {
  const grid = document.getElementById("itemshop-grid");
  if (!grid) return;
  const cfg = ITEM_SHOP_TABS[itemShopTab];
  const owned = ownedListForField(cfg.ownedField);
  const equipped = equippedIdForField(cfg.equippedField);
  grid.innerHTML = cfg.catalog.map((item) => `
    <div class="shop-item crn-frame">
      ${itemShopPreviewHtml(itemShopTab, item)}
      <p class="shop-item-name">${item.name}</p>
      ${itemShopButtonHtml(itemShopTab, item, owned, equipped)}
    </div>
  `).join("");
  const coinEl = document.getElementById("itemshop-coin-balance");
  if (coinEl) coinEl.textContent = `${getMyCoins().toLocaleString()} YEEN`;
}

// ===== 友達にYEENを送る(ギフト) =====
function populateGiftRecipientOptions() {
  const select = document.getElementById("gift-recipient-select");
  if (!select) return;
  const myName = getCurrentUser();
  const names = Object.keys(usersByName).filter((n) => n !== myName);
  select.innerHTML = names.length
    ? names.map((n) => `<option value="${n}">${n}</option>`).join("")
    : `<option value="">(まだ他のユーザーがいません)</option>`;
}

function handleSendGift() {
  const select = document.getElementById("gift-recipient-select");
  const amountInput = document.getElementById("gift-amount");
  const message = document.getElementById("gift-message");
  const user = auth.currentUser;
  const myName = getCurrentUser();
  const recipientName = select.value;
  const amount = parseInt(amountInput.value, 10);
  if (!user) return;
  if (!recipientName || recipientName === myName) {
    message.textContent = "送る相手を選んでください";
    return;
  }
  if (!amount || amount <= 0) {
    message.textContent = "金額を正しく入力してください";
    return;
  }
  const recipient = usersByName[recipientName];
  if (!recipient || !recipient.uid) {
    message.textContent = "相手が見つかりません";
    return;
  }
  const senderRef = db.collection(USERS_COLLECTION).doc(user.uid);
  const recipientRef = db.collection(USERS_COLLECTION).doc(recipient.uid);
  message.textContent = "送信中...";
  db.runTransaction((tx) => {
    return Promise.all([tx.get(senderRef), tx.get(recipientRef)]).then(([senderDoc, recipientDoc]) => {
      const senderCoins = (senderDoc.exists && senderDoc.data().coins) || 0;
      if (senderCoins < amount) throw new Error("YEENが足りません");
      const recipientCoins = (recipientDoc.exists && recipientDoc.data().coins) || 0;
      tx.set(senderRef, { coins: senderCoins - amount }, { merge: true });
      tx.set(recipientRef, { coins: recipientCoins + amount }, { merge: true });
    });
  }).then(() => {
    message.textContent = `${recipientName} さんに ${amount.toLocaleString()} YEEN 送りました!`;
    amountInput.value = "";
    setTimeout(() => (message.textContent = ""), 2500);
  }).catch((error) => {
    message.textContent = error.message || "送信に失敗しました";
  });
}

// ===== 友達を応援する(いいね。送った側・もらった側両方に少量YEEN、1日1回まで) =====
function startListeningCheers() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection(CHEERS_COLLECTION)
    .where("from", "==", user.uid)
    .where("date", "==", todayOffset(0))
    .onSnapshot(
      (snapshot) => {
        myCheeredTodayUids = new Set(snapshot.docs.map((doc) => doc.data().to));
        renderAll();
        renderStoryViewerCheerButton();
      },
      (error) => console.error("応援状況の取得に失敗しました:", error)
    );
}

function hasCheeredToday(targetName) {
  const target = usersByName[targetName];
  if (!target || !target.uid) return false;
  return myCheeredTodayUids.has(target.uid);
}

function sendCheer(targetName) {
  const user = auth.currentUser;
  const myName = getCurrentUser();
  if (!user || !targetName || targetName === myName) return;
  const target = usersByName[targetName];
  if (!target || !target.uid) return;
  if (hasCheeredToday(targetName)) return;
  const today = todayOffset(0);
  const cheerId = `${today}_${user.uid}_${target.uid}`;
  const cheerRef = db.collection(CHEERS_COLLECTION).doc(cheerId);
  db.runTransaction((tx) => {
    return tx.get(cheerRef).then((doc) => {
      if (doc.exists) throw new Error("ALREADY");
      tx.set(cheerRef, {
        from: user.uid,
        to: target.uid,
        date: today,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  }).then(() => {
    adjustCoins(CHEER_SENDER_BONUS);
    adjustCoinsForUid(target.uid, CHEER_RECEIVER_BONUS);
  }).catch((error) => {
    if (error.message !== "ALREADY") {
      console.error("応援に失敗しました:", error);
    }
  });
}

// ===== 記録演出エフェクト(記録を送信したときに再生する) =====
function playRecordEffect() {
  const effectId = currentUserEquippedEffect;
  if (!effectId || effectId === "normal") return;
  const item = EFFECT_CATALOG.find((e) => e.id === effectId);
  if (!item) return;
  const overlay = document.getElementById("record-effect-overlay");
  if (!overlay) return;
  overlay.textContent = (item.emoji + " ").repeat(6).trim();
  overlay.className = "record-effect-overlay play effect-" + effectId;
  window.clearTimeout(overlay._effectTimer);
  overlay._effectTimer = window.setTimeout(() => {
    overlay.className = "record-effect-overlay";
  }, 1200);
}

// ===== 連続日数ボーナス =====
function checkStreakBonus(streak) {
  const user = auth.currentUser;
  if (!user) return;
  const milestone = Object.keys(STREAK_BONUS_MILESTONES)
    .map(Number)
    .sort((a, b) => a - b)
    .find((m) => streak >= m && !currentUserAwardedStreaks.includes(m));
  if (!milestone) return;
  const bonus = STREAK_BONUS_MILESTONES[milestone];
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const awarded = data.awardedStreaks || [];
      if (awarded.includes(milestone)) return;
      const coins = data.coins || 0;
      tx.set(ref, { coins: coins + bonus, awardedStreaks: [...awarded, milestone] }, { merge: true });
    });
  }).catch((error) => console.error("連続日数ボーナスの付与に失敗しました:", error));
}

// ===== デイリークエスト =====
function getTodayQuestCompletion() {
  const myName = getCurrentUser();
  const today = todayOffset(0);
  const todayEntries = entries.filter((e) => e.name === myName && e.date === today);
  const mineEntries = entries.filter((e) => e.name === myName);
  return DAILY_QUEST_DEFS.map((q) => ({
    ...q,
    done: q.check(todayEntries, mineEntries),
  }));
}

function checkDailyQuests() {
  const user = auth.currentUser;
  if (!user) return;
  const today = todayOffset(0);
  const completion = getTodayQuestCompletion();
  const alreadyRewarded =
    currentUserDailyQuestState.date === today ? currentUserDailyQuestState.completed || [] : [];
  const newlyDone = completion.filter((q) => q.done && !alreadyRewarded.includes(q.id));
  if (newlyDone.length === 0) return;
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      const state = data.dailyQuestState && data.dailyQuestState.date === today
        ? data.dailyQuestState
        : { date: today, completed: [] };
      const toAward = newlyDone.filter((q) => !state.completed.includes(q.id));
      if (toAward.length === 0) return;
      const bonusTotal = toAward.reduce((sum, q) => sum + q.bonus, 0);
      const coins = data.coins || 0;
      tx.set(ref, {
        coins: coins + bonusTotal,
        dailyQuestState: { date: today, completed: [...state.completed, ...toAward.map((q) => q.id)] },
      }, { merge: true });
    });
  }).catch((error) => console.error("デイリークエストの付与に失敗しました:", error));
}

function renderDailyQuestList() {
  const container = document.getElementById("home-quest-list");
  if (!container) return;
  const today = todayOffset(0);
  const rewarded = currentUserDailyQuestState.date === today ? currentUserDailyQuestState.completed || [] : [];
  const completion = getTodayQuestCompletion();
  container.innerHTML = completion.map((q) => {
    const isRewarded = rewarded.includes(q.id);
    const state = isRewarded ? "quest-done" : (q.done ? "quest-pending" : "");
    const mark = isRewarded ? "✓" : (q.done ? "…" : "");
    return `
      <div class="quest-row ${state}">
        <span class="quest-check">${mark}</span>
        <span class="quest-label">${q.label}</span>
        <span class="quest-bonus">+${q.bonus} YEEN</span>
      </div>
    `;
  }).join("");
}

// ===== ログインボーナス(連続ログイン日数に応じて増額) =====
function checkLoginBonus() {
  const user = auth.currentUser;
  if (!user) return;
  const today = todayOffset(0);
  const yesterday = todayOffset(1);
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.lastLoginBonusDate === today) return;
      const prevStreak = data.loginStreak || 0;
      const newStreak = data.lastLoginBonusDate === yesterday ? prevStreak + 1 : 1;
      const bonus = Math.min(LOGIN_BONUS_BASE + (newStreak - 1) * LOGIN_BONUS_STEP, LOGIN_BONUS_MAX);
      const coins = data.coins || 0;
      tx.set(ref, {
        coins: coins + bonus,
        lastLoginBonusDate: today,
        loginStreak: newStreak,
      }, { merge: true });
    });
  }).catch((error) => console.error("ログインボーナスの付与に失敗しました:", error));
}

// ===== 週間ランキング1位ボーナス =====
function getIsoWeekId(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

let weeklyRankingBonusCheckedThisSession = false;
function checkWeeklyRankingBonus() {
  if (weeklyRankingBonusCheckedThisSession) return;
  weeklyRankingBonusCheckedThisSession = true;
  const weekId = getIsoWeekId(new Date());
  const metaRef = db.collection("meta").doc("weeklyBonus");
  db.runTransaction((tx) => {
    return tx.get(metaRef).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.awardedWeekId === weekId) return false;
      tx.set(metaRef, { awardedWeekId: weekId }, { merge: true });
      return true;
    });
  }).then((shouldAward) => {
    if (!shouldAward) return;
    const weekly = withRanks(getWeeklyTotals(entries));
    const top = weekly.find((r) => r.rank === 1 && r.minutes > 0);
    if (!top || !usersByName[top.name] || !usersByName[top.name].uid) return;
    const ref = db.collection(USERS_COLLECTION).doc(usersByName[top.name].uid);
    return db.runTransaction((tx) => {
      return tx.get(ref).then((doc) => {
        const data = doc.exists ? doc.data() : {};
        const coins = data.coins || 0;
        tx.set(ref, { coins: coins + WEEKLY_RANK_BONUS }, { merge: true });
      });
    });
  }).catch((error) => console.error("週間ランキングボーナスの確認に失敗しました:", error));
}

// ===== 累計ランキング上位3名への12時間ごとのYEENボーナス =====
let periodicRankBonusCheckedThisSession = false;
function checkPeriodicRankBonus() {
  if (periodicRankBonusCheckedThisSession) return;
  periodicRankBonusCheckedThisSession = true;
  const periodId = Math.floor(Date.now() / RANK_BONUS_INTERVAL_MS);
  const metaRef = db.collection("meta").doc("periodicRankBonus");
  db.runTransaction((tx) => {
    return tx.get(metaRef).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.awardedPeriodId === periodId) return false;
      tx.set(metaRef, { awardedPeriodId: periodId }, { merge: true });
      return true;
    });
  }).then((shouldAward) => {
    if (!shouldAward) return;
    const ranked = withRanks(getAllTimeTotals(entries)).filter((r) => r.minutes > 0);
    const jobs = [1, 2, 3].map((rankNum) => {
      const top = ranked.find((r) => r.rank === rankNum);
      if (!top || !usersByName[top.name] || !usersByName[top.name].uid) return null;
      const bonus = RANK_BONUS_AMOUNTS[rankNum];
      const ref = db.collection(USERS_COLLECTION).doc(usersByName[top.name].uid);
      return db.runTransaction((tx) => {
        return tx.get(ref).then((doc) => {
          const data = doc.exists ? doc.data() : {};
          const coins = data.coins || 0;
          tx.set(ref, { coins: coins + bonus }, { merge: true });
        });
      });
    });
    return Promise.all(jobs);
  }).catch((error) => console.error("ランキングボーナス(12時間ごと)の確認に失敗しました:", error));
}

// ===== 週間目標達成ボーナス =====
function handleSetWeeklyGoal() {
  const user = auth.currentUser;
  if (!user) return;
  const input = prompt("1週間の勉強時間の目標(分)を入力してください", String(currentUserWeeklyGoalMinutes || DEFAULT_WEEKLY_GOAL_MINUTES));
  if (input === null) return;
  const minutes = parseInt(input, 10);
  if (!minutes || minutes <= 0) {
    alert("正しい分数を入力してください");
    return;
  }
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ weeklyGoalMinutes: minutes }, { merge: true })
    .catch((error) => alert("保存に失敗しました: " + error.message));
}

function checkWeeklyGoalBonus() {
  const user = auth.currentUser;
  if (!user) return;
  const myName = getCurrentUser();
  const weekId = getIsoWeekId(new Date());
  if (currentUserWeeklyGoalAwardedWeekId === weekId) return;
  const weeklyMinutes = getWeeklyTotals(entries).find((r) => r.name === myName);
  const total = weeklyMinutes ? weeklyMinutes.minutes : 0;
  const goal = currentUserWeeklyGoalMinutes || DEFAULT_WEEKLY_GOAL_MINUTES;
  if (total < goal) return;
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.weeklyGoalAwardedWeekId === weekId) return;
      const coins = data.coins || 0;
      tx.set(ref, { coins: coins + WEEKLY_GOAL_BONUS, weeklyGoalAwardedWeekId: weekId }, { merge: true });
    });
  }).catch((error) => console.error("週間目標ボーナスの付与に失敗しました:", error));
}

function renderWeeklyGoalCard() {
  const container = document.getElementById("home-weekly-goal");
  if (!container) return;
  const myName = getCurrentUser();
  const weeklyMinutes = getWeeklyTotals(entries).find((r) => r.name === myName);
  const total = weeklyMinutes ? weeklyMinutes.minutes : 0;
  const goal = currentUserWeeklyGoalMinutes || DEFAULT_WEEKLY_GOAL_MINUTES;
  const percent = Math.min(100, Math.round((total / goal) * 100));
  const weekId = getIsoWeekId(new Date());
  const achieved = total >= goal;
  const alreadyAwarded = currentUserWeeklyGoalAwardedWeekId === weekId;
  container.innerHTML = `
    <div class="goal-head">
      <span class="goal-label">今週の目標 ${goal}分${achieved ? (alreadyAwarded ? "(達成!受取済)" : "(達成!)") : ""}</span>
      <span class="goal-edit" onclick="handleSetWeeklyGoal()">目標を変更 ›</span>
    </div>
    <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${percent}%;"></div></div>
    <p class="goal-progress-text">${total} / ${goal} 分 (達成で +${WEEKLY_GOAL_BONUS} YEEN)</p>
  `;
}

function shopItemButtonHtml(item, ownedList, equippedId, equipFnName, buyFnName) {
  const owned = ownedList.includes(item.id);
  const equipped = equippedId === item.id;
  if (item.isCustom) {
    if (!owned) {
      const affordable = currentUserCoins >= item.price;
      return `<button class="btn-accent" style="width:100%; margin-bottom:0;" ${affordable ? "" : "disabled"} onclick="triggerHeaderCustomFile('buy')">${item.price} YEEN で画像を選ぶ</button>`;
    }
    return `
      ${equipped ? `<button class="btn-mini-accent" disabled style="width:100%; margin-bottom:6px;">装着中</button>` : `<button class="btn-secondary" style="width:100%; margin-bottom:6px;" onclick="${equipFnName}('${item.id}')">装着する</button>`}
      <button class="btn-secondary" style="width:100%; margin-bottom:0;" onclick="triggerHeaderCustomFile('change')">画像を変更する</button>
    `;
  }
  if (equipped) {
    return `<button class="btn-mini-accent" disabled style="width:100%;">装着中</button>`;
  }
  if (owned) {
    return `<button class="btn-secondary" style="width:100%; margin-bottom:0;" onclick="${equipFnName}('${item.id}')">装着する</button>`;
  }
  const affordable = currentUserCoins >= item.price;
  return `<button class="btn-accent" style="width:100%; margin-bottom:0;" ${affordable ? "" : "disabled"} onclick="${buyFnName}('${item.id}')">${item.price} YEEN で購入</button>`;
}

function renderFrameShop() {
  const grid = document.getElementById("frameshop-grid");
  if (!grid) return;
  const myName = getCurrentUser();
  const initial = (myName || "?").trim().charAt(0).toUpperCase();
  const photo = currentUserPhoto;
  const bgStyle = photo ? "" : `style="background:${getAvatarColor(myName || "")}"`;
  grid.innerHTML = FRAME_CATALOG.map((item) => `
    <div class="shop-item crn-frame">
      <span class="avatar avatar-lg shop-frame-preview ${item.cssClass}" ${bgStyle}>${
        photo ? `<img src="${photo}" alt="">` : initial
      }</span>
      <p class="shop-item-name">${item.name}</p>
      ${shopItemButtonHtml(item, currentUserOwnedFrames, currentUserEquippedFrame, "equipFrame", "buyFrame")}
    </div>
  `).join("");
  const coinEl = document.getElementById("frameshop-coin-balance");
  if (coinEl) coinEl.textContent = `${getMyCoins().toLocaleString()} YEEN`;
}

function renderHeaderShop() {
  const grid = document.getElementById("headershop-grid");
  if (!grid) return;
  grid.innerHTML = HEADER_CATALOG.map((item) => {
    if (item.isCustom) {
      const hasImage = !!currentUserCustomHeaderImage;
      const previewStyle = hasImage
        ? `style="background-image:url('${currentUserCustomHeaderImage}'); background-size:cover; background-position:center;"`
        : "";
      return `
        <div class="shop-item crn-frame">
          <div class="shop-header-preview header-custom${hasImage ? "" : " is-empty"}" ${previewStyle}></div>
          <p class="shop-item-name">${item.name}</p>
          ${shopItemButtonHtml(item, currentUserOwnedHeaders, currentUserEquippedHeader, "equipHeader", "buyHeader")}
        </div>
      `;
    }
    return `
      <div class="shop-item crn-frame">
        <div class="shop-header-preview ${item.cssClass}"></div>
        <p class="shop-item-name">${item.name}</p>
        ${shopItemButtonHtml(item, currentUserOwnedHeaders, currentUserEquippedHeader, "equipHeader", "buyHeader")}
      </div>
    `;
  }).join("");
  const coinEl = document.getElementById("headershop-coin-balance");
  if (coinEl) coinEl.textContent = `${getMyCoins().toLocaleString()} YEEN`;
}

function applyFrameToAvatarEl(el) {
  if (!el) return;
  FRAME_CATALOG.forEach((f) => el.classList.remove(f.cssClass));
  const item = FRAME_CATALOG.find((f) => f.id === currentUserEquippedFrame) || FRAME_CATALOG[0];
  el.classList.add(item.cssClass);
}

function renderProfileBanners() {
  const item = HEADER_CATALOG.find((h) => h.id === currentUserEquippedHeader) || HEADER_CATALOG[0];
  document.querySelectorAll(".profile-banner").forEach((el) => {
    HEADER_CATALOG.forEach((h) => el.classList.remove(h.cssClass));
    el.classList.remove("is-empty");
    el.classList.add(item.cssClass);
    if (item.isCustom && currentUserCustomHeaderImage) {
      el.style.backgroundImage = `url('${currentUserCustomHeaderImage}')`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    } else {
      el.style.backgroundImage = "";
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      if (item.isCustom) el.classList.add("is-empty");
    }
  });
}

// ===== 苦手科目(あまり選ばれていない科目)を判定する =====
function getWeakSubject(mineEntries) {
  const counts = {};
  FIXED_SUBJECTS.forEach((s) => (counts[s] = 0));
  mineEntries.forEach((e) => {
    if (FIXED_SUBJECTS.includes(e.subject)) {
      counts[e.subject] += Number(e.minutes) || 0;
    }
  });
  let weak = null;
  let min = Infinity;
  FIXED_SUBJECTS.forEach((s) => {
    if (counts[s] < min) {
      min = counts[s];
      weak = s;
    }
  });
  return weak;
}

// ===== 期間限定イベント(週替わりで対象科目にボーナス倍率がつく) =====
function getWeeklyEventSubject() {
  const weekId = getIsoWeekId(new Date());
  const weekNum = parseInt(weekId.split("-W")[1], 10) || 0;
  return FIXED_SUBJECTS[weekNum % FIXED_SUBJECTS.length];
}

// ===== Firestoreとのやりとり =====
function addEntry(name, subject, minutes) {
  const entryName = name || getCurrentUser();
  const user = auth.currentUser;
  const isOwnEntry = user && entryName === getCurrentUser();
  let bonusNote = [];
  let coinsEarned = minutes * COIN_PER_MINUTE;
  if (isOwnEntry) {
    const hour = new Date().getHours();
    if (hour >= EARLY_BIRD_START_HOUR && hour < EARLY_BIRD_END_HOUR) {
      coinsEarned = Math.round(coinsEarned * EARLY_BIRD_MULTIPLIER);
      bonusNote.push("早起きボーナス");
    }
    const mineEntries = entries.filter((e) => e.name === entryName);
    const weakSubject = getWeakSubject(mineEntries);
    if (weakSubject && subject === weakSubject) {
      coinsEarned = Math.round(coinsEarned * WEAK_SUBJECT_MULTIPLIER);
      bonusNote.push("苦手科目ボーナス");
    }
    if (subject === getWeeklyEventSubject()) {
      coinsEarned = Math.round(coinsEarned * EVENT_SUBJECT_MULTIPLIER);
      bonusNote.push("今週のイベント");
    }
  }
  db.collection(COLLECTION_NAME).add({
    name: entryName,
    subject: subject,
    minutes: minutes,
    date: todayOffset(0),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: isOwnEntry ? user.uid : null,
    coinsEarned: isOwnEntry ? coinsEarned : null,
  }).then(() => {
    if (isOwnEntry) {
      adjustCoins(coinsEarned);
      playRecordEffect();
      if (bonusNote.length) {
        setTimeout(() => {
          const message = document.getElementById("log-message");
          if (message) message.textContent = `${bonusNote.join(" / ")} 発動中!(+${coinsEarned}YEEN)`;
        }, 250);
      }
    }
  }).catch((error) => {
    console.error("保存に失敗しました:", error);
    document.getElementById("log-message").textContent = "保存失敗: " + error.code + " / " + error.message;
  });
}

function startListening() {
  db.collection(COLLECTION_NAME).onSnapshot(
    (snapshot) => {
      rawEntries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      refreshVisibleEntries();
      renderAll();
    },
    (error) => {
      console.error("データの取得に失敗しました:", error);
    }
  );
}

function deleteEntry(entryId) {
  const ok = confirm("この記録を削除しますか?(もらったコインも取り消されます)");
  if (!ok) return;
  const entry = rawEntries.find((e) => e.id === entryId);
  db.collection(COLLECTION_NAME).doc(entryId).delete().then(() => {
    if (entry && entry.uid) {
      const refund = entry.coinsEarned != null ? entry.coinsEarned : entry.minutes * COIN_PER_MINUTE;
      adjustCoinsForUid(entry.uid, -refund);
    }
  }).catch((error) => {
    console.error("削除に失敗しました:", error);
    alert("削除に失敗しました: " + error.message);
  });
}

// ===== ストーリー(24時間で消える投稿) =====
function startListeningStories() {
  db.collection(STORIES_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(200)
    .onSnapshot(
      (snapshot) => {
        stories = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderStoriesBar();
      },
      (error) => {
        console.error("ストーリーの取得に失敗しました:", error);
      }
    );
}

function getStoryTime(story) {
  return story.createdAt ? story.createdAt.toMillis() : Date.now();
}

function getActiveStories() {
  const cutoff = Date.now() - STORY_LIFETIME_MS;
  return stories.filter((s) => getStoryTime(s) > cutoff);
}

function getGroupedStories() {
  const active = getActiveStories();
  const groups = {};
  active.forEach((s) => {
    if (!groups[s.name]) groups[s.name] = [];
    groups[s.name].push(s);
  });
  return Object.entries(groups)
    .map(([name, list]) => ({
      name,
      stories: list.sort((a, b) => getStoryTime(a) - getStoryTime(b)),
      latest: Math.max(...list.map(getStoryTime)),
    }))
    .sort((a, b) => b.latest - a.latest);
}

function renderStoriesBar() {
  updateDailyTopNames();
  const myName = getCurrentUser();
  const groups = getGroupedStories();
  updateHomeAvatarRing(groups.some((g) => g.name === myName));
  const bar = document.getElementById("story-bar");
  if (!bar) return;
  let html = `
    <div class="story-item story-add" onclick="showView('story-add')">
      ${avatarSpan(myName, currentUserPhoto, "avatar-md")}
      <span class="story-plus">+</span>
      <p class="story-label">追加</p>
    </div>
  `;
  groups.forEach((g) => {
    const photo = (usersByName[g.name] && usersByName[g.name].photo) || null;
    const safeName = g.name.replace(/'/g, "\\'");
    html += `
      <div class="story-item" onclick="openStoryViewer('${safeName}')">
        <span class="story-ring">${avatarSpan(g.name, photo, "avatar-md")}</span>
        <p class="story-label">${g.name === myName ? "自分" : g.name}</p>
      </div>
    `;
  });
  bar.innerHTML = html;
}

function updateHomeAvatarRing(hasStory) {
  const ring = document.getElementById("home-avatar-ring");
  if (!ring) return;
  ring.classList.toggle("has-story", !!hasStory);
  ring.dataset.hasStory = hasStory ? "1" : "0";
}

function handleHomeAvatarClick() {
  const ring = document.getElementById("home-avatar-ring");
  const hasStory = ring && ring.dataset.hasStory === "1";
  if (hasStory) {
    openStoryViewer(getCurrentUser());
  } else {
    showView("story-add");
  }
}

async function handleStoryPhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    storyAddPhotoBase64 = await resizeImageToBase64(file, 480, 0.6);
    const preview = document.getElementById("story-add-preview");
    preview.src = storyAddPhotoBase64;
    preview.style.display = "block";
  } catch (error) {
    document.getElementById("story-add-message").textContent = "画像の読み込みに失敗しました";
  }
}

async function handlePostStory() {
  const textInput = document.getElementById("story-add-text");
  const message = document.getElementById("story-add-message");
  const text = textInput.value.trim();
  const user = auth.currentUser;
  if (!user) return;
  if (!text && !storyAddPhotoBase64) {
    message.textContent = "写真かひとことのどちらかを入れてください";
    return;
  }
  message.textContent = "投稿中...";
  try {
    await db.collection(STORIES_COLLECTION).add({
      uid: user.uid,
      name: getCurrentUser(),
      photo: storyAddPhotoBase64 || null,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    resetStoryAddForm();
    awardStoryBonusIfFirstToday();
    showView("home");
  } catch (error) {
    message.textContent = "投稿失敗: " + error.message;
  }
}

function awardStoryBonusIfFirstToday() {
  const user = auth.currentUser;
  if (!user) return;
  const today = todayOffset(0);
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.lastStoryBonusDate === today) return;
      const coins = data.coins || 0;
      tx.set(ref, { coins: coins + STORY_BONUS, lastStoryBonusDate: today }, { merge: true });
    });
  }).catch((error) => console.error("投稿ボーナスの付与に失敗しました:", error));
}

function resetStoryAddForm() {
  storyAddPhotoBase64 = null;
  document.getElementById("story-add-text").value = "";
  document.getElementById("story-add-photo-input").value = "";
  const preview = document.getElementById("story-add-preview");
  preview.style.display = "none";
  preview.src = "";
  document.getElementById("story-add-message").textContent = "";
}

function openStoryViewer(name) {
  const groups = getGroupedStories();
  const group = groups.find((g) => g.name === name);
  if (!group) return;
  storyViewerList = group.stories;
  storyViewerIndex = 0;
  showView("story-viewer");
  renderStoryViewer();
}

function renderStoryViewer() {
  if (storyViewerList.length === 0) {
    showView("home");
    return;
  }
  const story = storyViewerList[storyViewerIndex];
  const photo = (usersByName[story.name] && usersByName[story.name].photo) || null;
  document.getElementById("viewer-name").textContent = story.name;
  setAvatarElement(document.getElementById("viewer-avatar"), story.name, photo);
  const img = document.getElementById("viewer-photo");
  if (story.photo) {
    img.src = story.photo;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
  const textEl = document.getElementById("viewer-text");
  textEl.textContent = story.text || "";
  textEl.style.display = story.text ? "block" : "none";
  const dots = document.getElementById("viewer-dots");
  dots.innerHTML = storyViewerList
    .map((_, i) => `<span class="viewer-dot${i === storyViewerIndex ? " active" : ""}"></span>`)
    .join("");
  renderStoryViewerCheerButton();
}

function renderStoryViewerCheerButton() {
  const btn = document.getElementById("viewer-cheer-btn");
  if (!btn) return;
  const story = storyViewerList[storyViewerIndex];
  const myName = getCurrentUser();
  if (!story || story.name === myName) {
    btn.style.display = "none";
    return;
  }
  btn.style.display = "inline-flex";
  const cheered = hasCheeredToday(story.name);
  btn.disabled = cheered;
  btn.textContent = cheered ? "応援済み ♡" : "応援する ♡";
}

function handleViewerCheerClick() {
  const story = storyViewerList[storyViewerIndex];
  if (!story) return;
  sendCheer(story.name);
  setTimeout(renderStoryViewerCheerButton, 400);
}

function storyViewerNext() {
  if (storyViewerIndex < storyViewerList.length - 1) {
    storyViewerIndex++;
    renderStoryViewer();
  } else {
    showView("home");
  }
}

function storyViewerPrev() {
  if (storyViewerIndex > 0) {
    storyViewerIndex--;
    renderStoryViewer();
  }
}

// ===== やることリスト(TODO) =====
function startListeningTodos() {
  const me = auth.currentUser;
  if (!me) return;
  db.collection(TODOS_COLLECTION)
    .where("uid", "==", me.uid)
    .onSnapshot(
      (snapshot) => {
        todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        todos.sort((a, b) => getTodoTime(a) - getTodoTime(b));
        renderTodoList();
      },
      (error) => {
        console.error("やることリストの取得に失敗しました:", error);
      }
    );
}

function getTodoTime(todo) {
  return todo.createdAt && typeof todo.createdAt.toMillis === "function" ? todo.createdAt.toMillis() : 0;
}

function handleAddTodoFrom(inputId) {
  const input = document.getElementById(inputId);
  const me = auth.currentUser;
  if (!input || !me) return;
  const text = input.value.trim();
  if (!text) return;
  db.collection(TODOS_COLLECTION).add({
    uid: me.uid,
    text: text,
    done: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  input.value = "";
}

function handleToggleTodo(id, done) {
  const newDone = !done;
  const ref = db.collection(TODOS_COLLECTION).doc(id);
  if (!newDone) {
    ref.update({ done: false });
    return;
  }
  ref.get().then((doc) => {
    const alreadyRewarded = doc.exists && doc.data().rewarded;
    const updates = { done: true };
    if (!alreadyRewarded) updates.rewarded = true;
    ref.update(updates).then(() => {
      if (!alreadyRewarded) adjustCoins(TODO_BONUS);
    });
  }).catch((error) => console.error("やることの更新に失敗しました:", error));
}

function handleDeleteTodo(id) {
  db.collection(TODOS_COLLECTION).doc(id).delete();
}

function renderTodoList() {
  const html = buildTodoListHtml();
  const containers = [
    document.getElementById("todo-list-home"),
    document.getElementById("todo-list-timer"),
  ];
  containers.forEach((el) => {
    if (el) el.innerHTML = html;
  });
}

function buildTodoListHtml() {
  if (todos.length === 0) {
    return `<p class="empty">やることがありません</p>`;
  }
  return todos
    .map(
      (t) => `
    <div class="todo-row ck-${currentUserEquippedCheckmark}${t.done ? " todo-done" : ""}">
      <input type="checkbox" class="todo-checkbox" ${t.done ? "checked" : ""} onchange="handleToggleTodo('${t.id}', ${t.done})">
      <span class="todo-text">${t.text}</span>
      <span class="todo-delete" onclick="handleDeleteTodo('${t.id}')">×</span>
    </div>
  `
    )
    .join("");
}

// ===== 集計ロジック =====
function getWeeklyTotals(list) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const totals = {};
  list.forEach((e) => {
    if (e.date >= cutoffStr) {
      totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
    }
  });
  return buildTotalsWithAllUsers(totals);
}

function getTodayTotals(list) {
  const today = todayOffset(0);
  const totals = {};
  list.forEach((e) => {
    if (e.date === today) {
      totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
    }
  });
  return buildTotalsWithAllUsers(totals);
}

function getAllTimeTotals(list) {
  const totals = {};
  list.forEach((e) => {
    totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
  });
  return buildTotalsWithAllUsers(totals);
}

function buildTotalsWithAllUsers(totals) {
  const merged = { ...totals };
  Object.keys(usersByName).forEach((name) => {
    if (!(name in merged)) merged[name] = 0;
  });
  const myName = getCurrentUser();
  if (myName && !(myName in merged)) merged[myName] = 0;
  return Object.entries(merged)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

function withRanks(sortedList) {
  let rank = 0;
  let prevMinutes = null;
  return sortedList.map((item, index) => {
    if (item.minutes !== prevMinutes) {
      rank = index + 1;
      prevMinutes = item.minutes;
    }
    return { ...item, rank };
  });
}

function getTodayTotalFor(list, name) {
  const today = todayOffset(0);
  return list
    .filter((e) => e.name === name && e.date === today)
    .reduce((sum, e) => sum + Number(e.minutes), 0);
}

function getStreak(list, name) {
  const dates = new Set(list.filter((e) => e.name === name).map((e) => e.date));
  let streak = 0;
  let i = 0;
  while (dates.has(todayOffset(i))) {
    streak++;
    i++;
  }
  return streak;
}

function formatMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ===== タリーマーク(正の字/棒線)のHTML生成 =====
function tallyMarksHtml(count) {
  if (!count || count <= 0) return `<span class="tally-empty">-</span>`;
  const groups = Math.floor(count / 5);
  const remainder = count % 5;
  const xs = [3, 7, 11, 15];
  let html = "";
  for (let i = 0; i < groups; i++) {
    html += `<svg class="tally-group" viewBox="0 0 18 20">
      <line x1="3" y1="1" x2="3" y2="18"></line>
      <line x1="7" y1="1" x2="7" y2="18"></line>
      <line x1="11" y1="1" x2="11" y2="18"></line>
      <line x1="15" y1="1" x2="15" y2="18"></line>
      <line class="tally-slash" x1="1" y1="17" x2="17" y2="1"></line>
    </svg>`;
  }
  if (remainder > 0) {
    let lines = "";
    for (let i = 0; i < remainder; i++) {
      lines += `<line x1="${xs[i]}" y1="1" x2="${xs[i]}" y2="18"></line>`;
    }
    html += `<svg class="tally-group" viewBox="0 0 18 20">${lines}</svg>`;
  }
  return html;
}

// ===== 画面切り替え =====
function showView(viewName) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
    v.style.display = "none";
  });
  const target = document.getElementById("view-" + viewName);
  target.classList.add("active");
  target.style.display = "block";
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const tabBtn = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
  if (tabBtn) tabBtn.classList.add("active");
  if (viewName === "log") {
    const nameInput = document.getElementById("log-name");
    if (!nameInput.value) {
      nameInput.value = getCurrentUser() || "";
    }
  }
  if (viewName === "settings") {
    document.getElementById("settings-name").value = getCurrentUser() || "";
    setAvatarElement(document.getElementById("settings-photo-preview"), getCurrentUser(), currentUserPhoto);
    applyFrameToAvatarEl(document.getElementById("settings-photo-preview"));
    const adminLinkGroup = document.getElementById("settings-admin-link-group");
    if (adminLinkGroup) adminLinkGroup.style.display = isAdminUser() ? "block" : "none";
  }
  if (viewName === "story-add") {
    resetStoryAddForm();
  }
  if (viewName === "gift") {
    populateGiftRecipientOptions();
    document.getElementById("gift-message").textContent = "";
  }
  if (viewName === "admin") {
    if (!isAdminUser()) {
      showView("settings");
      return;
    }
    renderAdminPanel();
  }
  renderAll();
}

// ===== 画面描画 =====
function renderHome() {
  const myName = getCurrentUser();
  const weekly = withRanks(getWeeklyTotals(entries));
  const streak = getStreak(entries, myName);
  setAvatarElement(document.getElementById("home-avatar"), myName, currentUserPhoto);
  applyFrameToAvatarEl(document.getElementById("home-avatar"));
  const myBadge = BADGE_CATALOG.find((b) => b.id === currentUserEquippedBadge);
  const badgeText = myBadge && myBadge.emoji ? ` ${myBadge.emoji}` : "";
  document.getElementById("home-username").textContent = `${myName}${badgeText} さん`;
  document.getElementById("home-today-minutes").textContent = formatMinutes(getTodayTotalFor(entries, myName));
  const tallyEl = document.getElementById("home-streak-tally");
  if (tallyEl) tallyEl.innerHTML = tallyMarksHtml(streak);
  document.getElementById("home-streak-num").textContent = `${streak}日`;
  checkStreakBonus(streak);
  checkDailyQuests();
  checkWeeklyGoalBonus();
  const myRankItem = weekly.find((r) => r.name === myName);
  document.getElementById("home-rank").textContent = myRankItem ? `${myRankItem.rank}位` : "-";
  const coinEl = document.getElementById("home-coin-badge");
  if (coinEl) coinEl.textContent = `${getMyCoins().toLocaleString()} YEEN`;
  const settingsCoinEl = document.getElementById("settings-coin-balance");
  if (settingsCoinEl) settingsCoinEl.textContent = `${getMyCoins().toLocaleString()} YEEN`;
  renderRankingList(document.getElementById("home-ranking-preview"), weekly.slice(0, 3));
}

function badgeSuffixFor(name) {
  const info = usersByName[name];
  if (!info || !info.badge || info.badge === "normal") return "";
  const item = BADGE_CATALOG.find((b) => b.id === info.badge);
  return item && item.emoji ? ` ${item.emoji}` : "";
}

function renderRankingList(container, list) {
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<p class="empty">まだ記録がありません</p>`;
    return;
  }
  const myName = getCurrentUser();
  list.forEach((r) => {
    const row = document.createElement("div");
    row.className = "rank-row" + (r.rank === 1 ? " top1" : "") + (r.rank <= 3 ? " crn-frame" : "");
    const photo = (usersByName[r.name] && usersByName[r.name].photo) || null;
    const coins = (usersByName[r.name] && usersByName[r.name].coins) || 0;
    const safeName = r.name.replace(/'/g, "\\'");
    const cheered = hasCheeredToday(r.name);
    const cheerHtml = r.name === myName
      ? ""
      : `<span class="rank-cheer-btn${cheered ? " cheered" : ""}" onclick="sendCheer('${safeName}')" title="応援する">${cheered ? "♥" : "♡"}</span>`;
    row.innerHTML = `
      <span class="rank-num">${r.rank}</span>
      ${avatarSpan(r.name, photo, "avatar-sm")}
      <span class="rank-name">${r.name}${badgeSuffixFor(r.name)}<span class="rank-yeen">${coins.toLocaleString()} YEEN</span></span>
      <span class="rank-time">${formatMinutes(r.minutes)}</span>
      ${cheerHtml}
    `;
    container.appendChild(row);
  });
}

// ===== ランキングの期間切り替え(今日 / 今週 / 累計) =====
let rankingPeriod = "daily";
function setRankingPeriod(period) {
  rankingPeriod = period;
  document.getElementById("ranking-btn-daily").classList.toggle("active", period === "daily");
  document.getElementById("ranking-btn-weekly").classList.toggle("active", period === "weekly");
  document.getElementById("ranking-btn-alltime").classList.toggle("active", period === "alltime");
  renderRankingScreen();
}

function renderRankingScreen() {
  const myName = getCurrentUser();
  let totals;
  if (rankingPeriod === "alltime") {
    totals = getAllTimeTotals(entries);
  } else if (rankingPeriod === "weekly") {
    totals = getWeeklyTotals(entries);
  } else {
    totals = getTodayTotals(entries);
  }
  const ranked = withRanks(totals);
  renderRankingList(document.getElementById("ranking-list"), ranked);
  const myRankItem = ranked.find((r) => r.name === myName);
  document.getElementById("ranking-my-rank").textContent = myRankItem ? `${myRankItem.rank}位` : "-";
}

function formatEntryTime(entry) {
  if (entry.createdAt && typeof entry.createdAt.toDate === "function") {
    const d = entry.createdAt.toDate();
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return "たった今";
}

function renderLogScreen() {
  const today = todayOffset(0);
  const myName = getCurrentUser();
  const todayEntries = entries.filter((e) => e.date === today);
  const list = document.getElementById("log-today-list");
  list.innerHTML = "";
  if (todayEntries.length === 0) {
    list.innerHTML = `<p class="empty">今日はまだ記録がありません</p>`;
  } else {
    todayEntries.forEach((e) => {
      const row = document.createElement("div");
      const canDelete = e.name === myName || isAdminUser();
      row.className = "log-entry" + (canDelete ? ` skin-${currentUserEquippedSkin}` : "");
      row.innerHTML = `
        <span>${formatEntryTime(e)} ・ ${e.name} / ${e.subject} ${e.minutes}分</span>
        ${canDelete ? `<span class="entry-delete" onclick="deleteEntry('${e.id}')">削除</span>` : `<span class="status">完了</span>`}
      `;
      list.appendChild(row);
    });
  }
  const nameList = document.getElementById("name-list");
  const uniqueNames = [...new Set(entries.map((e) => e.name))];
  nameList.innerHTML = uniqueNames.map((n) => `<option value="${n}">`).join("");
  renderLogWeekChart();
}

function getDailyMinutesFor(list, name, daysAgo) {
  const dateStr = todayOffset(daysAgo);
  return list
    .filter((e) => e.name === name && e.date === dateStr)
    .reduce((sum, e) => sum + Number(e.minutes), 0);
}

function getLast7DaysSeries(list, name) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push({ dateStr: todayOffset(i), minutes: getDailyMinutesFor(list, name, i) });
  }
  return days;
}

function renderLogWeekChart() {
  const container = document.getElementById("log-week-chart");
  if (!container) return;
  const myName = getCurrentUser();
  const series = getLast7DaysSeries(entries, myName);
  const maxMinutes = Math.max(1, ...series.map((d) => d.minutes));
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  container.innerHTML = series.map((d, idx) => {
    const isToday = idx === series.length - 1;
    const heightPercent = Math.round((d.minutes / maxMinutes) * 100);
    const barHeight = d.minutes > 0 ? Math.max(heightPercent, 4) : 0;
    const weekday = weekdayLabels[new Date(d.dateStr + "T00:00:00").getDay()];
    return `
      <div class="week-chart-col${isToday ? " is-today" : ""}">
        <p class="week-chart-value">${d.minutes > 0 ? d.minutes : ""}</p>
        <div class="week-chart-bar-track">
          <div class="week-chart-bar" style="height:${barHeight}%;"></div>
        </div>
        <p class="week-chart-label">${weekday}</p>
      </div>
    `;
  }).join("");
}

function renderAll() {
  updateDailyTopNames();
  renderHome();
  renderRankingScreen();
  renderLogScreen();
  renderTodoList();
  renderProfileBanners();
  renderFrameShop();
  renderHeaderShop();
  renderItemShop();
  renderDailyQuestList();
  renderWeeklyGoalCard();
  renderLotterySection();
  renderEventBanner();
  renderReferralSection();
  const adminLinkGroup = document.getElementById("settings-admin-link-group");
  if (adminLinkGroup) adminLinkGroup.style.display = isAdminUser() ? "block" : "none";
  if (isAdminUser()) renderAdminPanel();
}

function renderEventBanner() {
  const subject = getWeeklyEventSubject();
  document.querySelectorAll(".event-banner").forEach((el) => {
    el.textContent = `🎉 今週のイベント: 「${subject}」の記録が${EVENT_SUBJECT_MULTIPLIER}倍!`;
  });
}

function copyReferralCode() {
  if (!currentUserReferralCode) return;
  const msgEl = document.getElementById("settings-referral-message");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(currentUserReferralCode).then(() => {
      if (msgEl) {
        msgEl.textContent = "コピーしました!";
        setTimeout(() => (msgEl.textContent = ""), 2000);
      }
    }).catch(() => {
      if (msgEl) msgEl.textContent = currentUserReferralCode;
    });
  } else if (msgEl) {
    msgEl.textContent = currentUserReferralCode;
  }
}

function renderReferralSection() {
  const el = document.getElementById("settings-referral-code");
  if (el) el.textContent = currentUserReferralCode || "-";
}

function handleSubjectSelectChange() {
  const select = document.getElementById("log-subject-select");
  const customInput = document.getElementById("log-subject-custom");
  if (select.value === "その他") {
    customInput.style.display = "block";
    customInput.focus();
  } else {
    customInput.style.display = "none";
    customInput.value = "";
  }
}

function getSelectedSubject() {
  const select = document.getElementById("log-subject-select");
  const customInput = document.getElementById("log-subject-custom");
  if (select.value === "その他") {
    return customInput.value.trim();
  }
  return select.value;
}

function handleTfSubjectSelectChange() {
  const select = document.getElementById("tf-subject-select");
  const customInput = document.getElementById("tf-subject-custom");
  if (select.value === "その他") {
    customInput.style.display = "block";
    customInput.focus();
  } else {
    customInput.style.display = "none";
    customInput.value = "";
  }
}

function getTfSelectedSubject() {
  const select = document.getElementById("tf-subject-select");
  const customInput = document.getElementById("tf-subject-custom");
  if (select.value === "その他") {
    return customInput.value.trim();
  }
  return select.value;
}

// ===== タイマー / ポモドーロ =====
const POMODORO_WORK_SECONDS = 25 * 60;
const POMODORO_BREAK_SECONDS = 5 * 60;
let timerMode = "normal";
let timerIntervalId = null;
let timerRunning = false;
let timerAnchorMs = null;
let normalElapsedSeconds = 0;
let normalBaseSeconds = 0;
let customTotalSeconds = 0;
let customRemainingSeconds = 0;
let customBaseElapsedSeconds = 0;
let pomodoroPhase = "work";
let pomodoroPhaseRemaining = POMODORO_WORK_SECONDS;
let pomodoroStudySeconds = 0;
let pomodoroSessionElapsedSeconds = 0;
let pomodoroSessionBaseSeconds = 0;
let wakeLockSentinel = null;

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function setTimerMode(mode) {
  if (timerRunning) {
    alert("タイマーを止めてからモードを変えてね");
    return;
  }
  timerMode = mode;
  document.getElementById("mode-btn-normal").classList.toggle("active", mode === "normal");
  document.getElementById("mode-btn-pomodoro").classList.toggle("active", mode === "pomodoro");
  document.getElementById("mode-btn-custom").classList.toggle("active", mode === "custom");
  document.getElementById("timer-phase").style.display = mode === "pomodoro" ? "block" : "none";
  document.getElementById("tf-custom-minutes-row").style.display = mode === "custom" ? "block" : "none";
  resetTimerState();
  updateTimerDisplay();
}

function resetTimerState() {
  timerAnchorMs = null;
  normalElapsedSeconds = 0;
  normalBaseSeconds = 0;
  customTotalSeconds = 0;
  customRemainingSeconds = 0;
  customBaseElapsedSeconds = 0;
  const customInput = document.getElementById("tf-custom-minutes");
  if (customInput) customInput.disabled = false;
  pomodoroPhase = "work";
  pomodoroPhaseRemaining = POMODORO_WORK_SECONDS;
  pomodoroStudySeconds = 0;
  pomodoroSessionElapsedSeconds = 0;
  pomodoroSessionBaseSeconds = 0;
}

function derivePomodoroState(sessionElapsedSeconds) {
  let remaining = sessionElapsedSeconds;
  let phase = "work";
  let phaseTotal = POMODORO_WORK_SECONDS;
  let studySeconds = 0;
  while (remaining >= phaseTotal) {
    remaining -= phaseTotal;
    if (phase === "work") studySeconds += POMODORO_WORK_SECONDS;
    phase = phase === "work" ? "break" : "work";
    phaseTotal = phase === "work" ? POMODORO_WORK_SECONDS : POMODORO_BREAK_SECONDS;
  }
  return { phase, phaseRemaining: phaseTotal - remaining, studySeconds };
}

function getRunningElapsedSeconds() {
  if (!timerRunning || timerAnchorMs === null) return 0;
  return Math.max(0, Math.floor((Date.now() - timerAnchorMs) / 1000));
}

function syncTimerFromClock(opts = {}) {
  const notify = opts.notify !== false;
  if (!timerRunning || timerAnchorMs === null) return;
  const runningElapsed = getRunningElapsedSeconds();
  if (timerMode === "normal") {
    normalElapsedSeconds = normalBaseSeconds + runningElapsed;
  } else if (timerMode === "custom") {
    const elapsedTotal = customBaseElapsedSeconds + runningElapsed;
    const justFinished = customRemainingSeconds > 0 && elapsedTotal >= customTotalSeconds;
    customRemainingSeconds = Math.max(customTotalSeconds - elapsedTotal, 0);
    if (justFinished) {
      pauseTimer({ skipSync: true });
      updateTimerDisplay();
      if (notify) alert("タイマー終了!お疲れさま!");
      return;
    }
  } else {
    const prevPhase = pomodoroPhase;
    pomodoroSessionElapsedSeconds = pomodoroSessionBaseSeconds + runningElapsed;
    const derived = derivePomodoroState(pomodoroSessionElapsedSeconds);
    pomodoroPhase = derived.phase;
    pomodoroPhaseRemaining = derived.phaseRemaining;
    pomodoroStudySeconds = derived.studySeconds;
    if (notify && derived.phase !== prevPhase) {
      alert(derived.phase === "break" ? "お疲れさま!5分休憩しよう ☕" : "休憩終わり!また25分がんばろう 🔥");
    }
  }
}

const TF_RING_CIRCUMFERENCE = 565.48;
function updateTimerDisplay() {
  const display = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("timer-phase");
  const ring = document.getElementById("tf-ring-progress");
  let progress = 0;
  if (timerMode === "normal") {
    display.textContent = formatClock(normalElapsedSeconds);
    progress = (normalElapsedSeconds % 60) / 60;
  } else if (timerMode === "custom") {
    display.textContent = formatClock(customRemainingSeconds);
    progress = customTotalSeconds > 0 ? (customTotalSeconds - customRemainingSeconds) / customTotalSeconds : 0;
  } else {
    display.textContent = formatClock(pomodoroPhaseRemaining);
    phaseLabel.textContent = pomodoroPhase === "work" ? "勉強タイム 🔥" : "休憩タイム ☕";
    const total = pomodoroPhase === "work" ? POMODORO_WORK_SECONDS : POMODORO_BREAK_SECONDS;
    progress = (total - pomodoroPhaseRemaining) / total;
  }
  if (ring) {
    ring.style.strokeDashoffset = TF_RING_CIRCUMFERENCE * (1 - progress);
  }
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
  } catch (e) {
    // 非対応端末やユーザー操作外からの要求は失敗することがあるが、
    // その場合もタイムスタンプ方式で経過時間はズレずに追いつくので問題ない
  }
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

// ===== Study Letter: 手紙をポストへ投函してスタートする演出(「分数を決める」モードのみ) =====
function handleTimerStartButtonClick() {
  if (timerMode === "custom" && customRemainingSeconds <= 0) {
    openBoardingPass();
  } else {
    startTimer();
  }
}

function formatBpTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatBpDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

function openBoardingPass() {
  const customInput = document.getElementById("tf-custom-minutes");
  const minutes = Math.max(1, Math.round(Number(customInput.value)) || 30);
  const subject = getTfSelectedSubject() || "勉強";
  const now = new Date();
  const arrival = new Date(now.getTime() + minutes * 60000);
  document.getElementById("bp-code-from").textContent = formatBpTime(now);
  document.getElementById("bp-code-to").textContent = formatBpTime(arrival);
  document.getElementById("bp-subject").textContent = subject;
  document.getElementById("bp-duration").textContent = `${minutes}分`;
  document.getElementById("bp-boarding-time").textContent = formatBpTime(now);
  document.getElementById("bp-date").textContent = formatBpDate(now);
  resetBoardingPassSwipe();
  document.getElementById("boarding-pass-overlay").classList.add("open");
}

function closeBoardingPass() {
  document.getElementById("boarding-pass-overlay").classList.remove("open");
}

function resetBoardingPassSwipe() {
  const card = document.getElementById("boarding-pass-card");
  const fill = document.getElementById("bp-swipe-fill");
  const knob = document.getElementById("bp-swipe-knob");
  if (card) card.classList.remove("bp-tearing");
  if (fill) fill.style.height = "0px";
  if (knob) knob.style.top = "0px";
}

function confirmBoardingPassSwipe() {
  const card = document.getElementById("boarding-pass-card");
  if (card) card.classList.add("bp-tearing");
  setTimeout(() => {
    document.getElementById("boarding-pass-overlay").classList.remove("open");
    startTimer();
  }, 450);
}

let bpDragging = false;
let bpTrackHeight = 0;
let bpKnobHeight = 0;
function initBoardingPassSwipe() {
  const knob = document.getElementById("bp-swipe-knob");
  const track = document.getElementById("bp-swipe-track");
  const fill = document.getElementById("bp-swipe-fill");
  if (!knob || !track || !fill) return;
  const onPointerDown = (e) => {
    bpDragging = true;
    bpTrackHeight = track.clientHeight;
    bpKnobHeight = knob.clientHeight;
    if (knob.setPointerCapture && e.pointerId != null) {
      knob.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    if (!bpDragging) return;
    const rect = track.getBoundingClientRect();
    let y = e.clientY - rect.top - bpKnobHeight / 2;
    const maxY = bpTrackHeight - bpKnobHeight;
    y = Math.max(0, Math.min(maxY, y));
    knob.style.top = y + "px";
    fill.style.height = (y + bpKnobHeight / 2) + "px";
    if (y >= maxY - 2) {
      bpDragging = false;
      confirmBoardingPassSwipe();
    }
  };
  const onPointerUp = () => {
    if (!bpDragging) return;
    bpDragging = false;
    knob.style.transition = "top 0.2s ease";
    knob.style.top = "0px";
    fill.style.height = "0px";
    setTimeout(() => {
      knob.style.transition = "";
    }, 200);
  };
  knob.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function startTimer() {
  if (timerRunning) return;
  if (timerMode === "custom" && customRemainingSeconds <= 0) {
    const customInput = document.getElementById("tf-custom-minutes");
    const minutes = Math.max(1, Math.round(Number(customInput.value)) || 30);
    customTotalSeconds = minutes * 60;
    customRemainingSeconds = customTotalSeconds;
    customBaseElapsedSeconds = 0;
  }
  if (timerMode === "custom") {
    document.getElementById("tf-custom-minutes").disabled = true;
  }
  timerRunning = true;
  timerAnchorMs = Date.now();
  document.getElementById("timer-start-btn").disabled = true;
  document.getElementById("timer-pause-btn").disabled = false;
  requestWakeLock();
  timerIntervalId = setInterval(() => {
    syncTimerFromClock();
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function pauseTimer(opts = {}) {
  if (!timerRunning) return;
  if (!opts.skipSync) syncTimerFromClock({ notify: false });
  if (timerMode === "normal") {
    normalBaseSeconds = normalElapsedSeconds;
  } else if (timerMode === "custom") {
    customBaseElapsedSeconds = customTotalSeconds - customRemainingSeconds;
  } else {
    pomodoroSessionBaseSeconds = pomodoroSessionElapsedSeconds;
  }
  clearInterval(timerIntervalId);
  timerRunning = false;
  timerAnchorMs = null;
  document.getElementById("timer-start-btn").disabled = false;
  document.getElementById("timer-pause-btn").disabled = true;
  releaseWakeLock();
}

function handleTimerVisibilityResume() {
  if (!timerRunning) return;
  syncTimerFromClock();
  updateTimerDisplay();
  requestWakeLock();
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  handleTimerVisibilityResume();
});
window.addEventListener("focus", handleTimerVisibilityResume);
window.addEventListener("pageshow", handleTimerVisibilityResume);

function handleTimerTabClick() {
  setActiveTabButton("timer");
  openFullscreenTimer();
}

function setActiveTabButton(viewName) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === viewName)
  );
}

// ===== フルスクリーン タイマーの開閉 =====
function isDesktopSideBySideLayout() {
  return window.matchMedia("(min-width: 900px)").matches;
}

function openFullscreenTimer() {
  document.getElementById("timer-fullscreen").classList.add("open");
  if (isDesktopSideBySideLayout()) return;
  const el = document.getElementById("timer-fullscreen");
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

function closeFullscreenTimer() {
  document.getElementById("timer-fullscreen").classList.remove("open");
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  const activeView = document.querySelector(".view.active");
  if (activeView) {
    setActiveTabButton(activeView.id.replace("view-", ""));
  }
}

function setTimerLayout(layout) {
  const el = document.getElementById("timer-fullscreen");
  el.classList.toggle("landscape", layout === "landscape");
  document.getElementById("tf-layout-btn-portrait").classList.toggle("active", layout === "portrait");
  document.getElementById("tf-layout-btn-landscape").classList.toggle("active", layout === "landscape");
}

function finishFullscreenTimer() {
  pauseTimer();
  let totalSeconds = 0;
  if (timerMode === "normal") {
    totalSeconds = normalElapsedSeconds;
  } else if (timerMode === "custom") {
    totalSeconds = customTotalSeconds - customRemainingSeconds;
  } else {
    totalSeconds = pomodoroStudySeconds;
    if (pomodoroPhase === "work") {
      totalSeconds += (POMODORO_WORK_SECONDS - pomodoroPhaseRemaining);
    }
  }
  const minutes = Math.round(totalSeconds / 60);
  if (minutes > 0) {
    document.getElementById("log-minutes").value = minutes;
  }
  const tfSubject = getTfSelectedSubject();
  if (tfSubject) {
    const logSelect = document.getElementById("log-subject-select");
    const optionExists = [...logSelect.options].some((o) => o.value === tfSubject);
    if (optionExists) {
      logSelect.value = tfSubject;
      handleSubjectSelectChange();
    } else {
      logSelect.value = "その他";
      handleSubjectSelectChange();
      document.getElementById("log-subject-custom").value = tfSubject;
    }
  }
  resetTimerState();
  updateTimerDisplay();
  closeFullscreenTimer();
  showView("log");
}

// ===== 背景テーマ =====
const THEME_KEY = "studyAppTheme";
const CUSTOM_ACCENT_KEY = "studyAppCustomAccent";
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  document.querySelectorAll(".theme-swatch-btn").forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("theme-btn-" + theme);
  if (btn) btn.classList.add("active");
  const customRow = document.getElementById("custom-color-row");
  if (customRow) customRow.style.display = theme === "custom" ? "block" : "none";
  if (theme === "custom") {
    const saved = localStorage.getItem(CUSTOM_ACCENT_KEY) || "#7ce8ff";
    document.getElementById("custom-color-input").value = saved;
    setCustomAccent(saved);
  } else {
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-text");
  }
}

function getReadableTextColor(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1c1c1e" : "#ffffff";
}

function setCustomAccent(color) {
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-text", getReadableTextColor(color));
  localStorage.setItem(CUSTOM_ACCENT_KEY, color);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "shu";
  applyTheme(saved);
}

let setupMode = "signup";
function setSetupMode(mode) {
  setupMode = mode;
  document.getElementById("setup-btn-signup").classList.toggle("active", mode === "signup");
  document.getElementById("setup-btn-login").classList.toggle("active", mode === "login");
  document.getElementById("setup-name-field").style.display = mode === "signup" ? "block" : "none";
  const referralField = document.getElementById("setup-referral-field");
  if (referralField) referralField.style.display = mode === "signup" ? "block" : "none";
  document.getElementById("setup-title").textContent = mode === "signup" ? "アカウントを作ろう" : "おかえりなさい";
  document.getElementById("setup-submit-btn").textContent = mode === "signup" ? "はじめる" : "ログイン";
  document.getElementById("setup-message").textContent = "";
}

function handleSetupSubmit() {
  const email = document.getElementById("setup-email").value.trim();
  const password = document.getElementById("setup-password").value;
  const message = document.getElementById("setup-message");
  if (!email || !password) {
    message.textContent = "メールアドレスとパスワードを入力してください";
    return;
  }
  if (setupMode === "signup") {
    const name = document.getElementById("setup-name").value.trim();
    if (!name) {
      message.textContent = "名前を入力してください";
      return;
    }
    const referralInput = document.getElementById("setup-referral-code");
    const enteredCode = referralInput ? referralInput.value.trim().toUpperCase() : "";
    auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => {
        const myReferralCode = cred.user.uid.slice(0, 6).toUpperCase();
        return db.collection(USERS_COLLECTION).doc(cred.user.uid).set({
          name: name,
          email: email,
          referralCode: myReferralCode,
          referredByCode: enteredCode || null,
        }).then(() => {
          if (enteredCode) awardReferralBonus(enteredCode, cred.user.uid);
        });
      })
      .catch((error) => {
        message.textContent = "登録失敗: " + error.message;
      });
  } else {
    auth.signInWithEmailAndPassword(email, password)
      .catch((error) => {
        message.textContent = "ログイン失敗: " + error.message;
      });
  }
}

// ===== 友達紹介ボーナス =====
function awardReferralBonus(enteredCode, newUid) {
  db.collection(USERS_COLLECTION).where("referralCode", "==", enteredCode).limit(1).get()
    .then((snapshot) => {
      if (snapshot.empty) return;
      const referrerDoc = snapshot.docs[0];
      if (referrerDoc.id === newUid) return;
      return adjustCoinsForUid(referrerDoc.id, REFERRAL_BONUS);
    })
    .catch((error) => console.error("紹介ボーナスの付与に失敗しました:", error));
}

let hasEnteredApp = false;
let isLoggingOut = false;
const DEVICE_LOGIN_KEY = "studyAppDeviceLoggedIn";
const DEVICE_NAME_KEY = "studyAppDeviceLastName";
const DEVICE_PHOTO_KEY = "studyAppDeviceLastPhoto";

function goToMainApp() {
  hasEnteredApp = true;
  localStorage.setItem(DEVICE_LOGIN_KEY, "1");
  // 注意: ここでは currentUserName をlocalStorageに保存しない。
  // この時点ではまだFirestoreから正しい名前を取得できていない(プレースホルダーの
  // 可能性がある)ため、確定した名前は loadCurrentUserProfile() 側でのみ保存する。
  document.getElementById("tabbar").style.display = "flex";
  startListening();
  startListeningUsers();
  startListeningStories();
  startListeningTodos();
  startListeningCheers();
  startPresenceHeartbeat();
  checkLoginBonus();
  setTimeout(checkWeeklyRankingBonus, 3000);
  setTimeout(checkPeriodicRankBonus, 3500);
  showView("home");
}

function showSetupScreen(message) {
  document.getElementById("tabbar").style.display = "none";
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
    v.style.display = "none";
  });
  const setupEl = document.getElementById("view-setup");
  setupEl.classList.add("active");
  setupEl.style.display = "block";
  const messageEl = document.getElementById("setup-message");
  if (messageEl) messageEl.textContent = message || "";
}

// ===== ログイン状態の監視 =====
// ログイン状態をブラウザに保存し、再読み込みしてもログインし直さなくて済むようにする
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((error) => {
  console.error("ログイン状態の保存設定に失敗しました:", error);
});

auth.onAuthStateChanged((user) => {
  if (user) {
    // Firestoreの読み込みを待たずに、まず先にメイン画面へ入れる。
    // (Firestore側の応答が遅い/失敗した場合に、ログイン画面から
    //  ずっと進めなくなってしまうのを防ぐため)
    // ここでメールアドレスを名前として使ってしまうと、通信が不安定なときに
    // 画面上の名前が「メールアドレスのまま」になってしまうバグの原因になるため、
    // 前回表示していた名前(端末に保存済み)があればそれを一時的に使い、
    // なければ「読み込み中…」を出す(メールアドレスは絶対に名前として使わない)。
    const cachedName = localStorage.getItem(DEVICE_NAME_KEY);
    currentUserName = cachedName || "読み込み中…";
    currentUserPhoto = localStorage.getItem(DEVICE_PHOTO_KEY) || null;
    goToMainApp();
    loadCurrentUserProfile(user, 0);
    return;
  }

  // ---- ここから user が null(=Firebase的には未ログイン)の場合 ----

  // すでにホームなどアプリ内の画面を開いている場合、
  // 明示的なログアウト以外ではログイン画面に戻さない(画面が勝手に切り替わるのを防ぐ)
  if (hasEnteredApp && !isLoggingOut) {
    console.warn("ログイン状態の確認で一時的な問題が起きましたが、今の画面のまま続行します。");
    return;
  }

  if (isLoggingOut) {
    // 本人が「ログアウトする」を押した場合だけ、本当にログイン画面を出す
    localStorage.removeItem(DEVICE_LOGIN_KEY);
    localStorage.removeItem(DEVICE_NAME_KEY);
    localStorage.removeItem(DEVICE_PHOTO_KEY);
    currentUserName = null;
    currentUserPhoto = null;
    hasEnteredApp = false;
    isLoggingOut = false;
    showSetupScreen();
    return;
  }

  // 以前この端末でログインした形跡がある場合は、
  // Firebase側の状態確認が今回うまくいかなくても、ログイン画面を強制的に出さない。
  const wasLoggedInBefore = localStorage.getItem(DEVICE_LOGIN_KEY) === "1";
  if (wasLoggedInBefore) {
    currentUserName = localStorage.getItem(DEVICE_NAME_KEY) || "名無し";
    currentUserPhoto = localStorage.getItem(DEVICE_PHOTO_KEY) || null;
    goToMainApp();
    return;
  }

  // 本当に一度もログインしたことがない場合だけ、ログイン画面を出す
  currentUserName = null;
  currentUserPhoto = null;
  hasEnteredApp = false;
  showSetupScreen();
});

// Firestoreから本当のユーザー名を取得する。通信が不安定な端末でも
// メールアドレス表示のまま固まらないように、失敗時は少し待って自動で再試行する。
function loadCurrentUserProfile(user, retryCount) {
  db.collection(USERS_COLLECTION).doc(user.uid).get().then((doc) => {
    const data = doc.exists ? doc.data() : {};
    if (data.deleted) {
      // このアカウントは削除(非表示)状態 → メイン画面には入れず、復元用の画面を出す
      showAccountDeletedScreen();
      return;
    }
    if (data.name) {
      currentUserName = data.name;
    } else if (!doc.exists) {
      // 何らかの理由でユーザー情報(名前など)が保存されていないアカウント。
      // このままだと管理者モードの一覧にも出てこないので、最低限のプロフィールを作っておく。
      // (このとき、まだ正しい名前が取得できていない可能性があるのでメールアドレスは使わない)
      const fallbackName = currentUserName === "読み込み中…" ? "名無し" : currentUserName;
      currentUserName = fallbackName;
      db.collection(USERS_COLLECTION).doc(user.uid).set(
        { name: fallbackName, email: user.email || null },
        { merge: true }
      ).catch((error) => {
        console.error("プロフィールの自動作成に失敗しました:", error);
      });
    }
    currentUserPhoto = data.photo || null;
    localStorage.setItem(DEVICE_NAME_KEY, currentUserName);
    if (currentUserPhoto) {
      localStorage.setItem(DEVICE_PHOTO_KEY, currentUserPhoto);
    } else {
      localStorage.removeItem(DEVICE_PHOTO_KEY);
    }
    renderAll();
  }).catch((error) => {
    console.error("ユーザー情報の取得に失敗しました:", error);
    if (retryCount < 3) {
      // 通信が不安定なだけの可能性が高いので、少し待って自動で再試行する
      setTimeout(() => loadCurrentUserProfile(user, retryCount + 1), 1500 * (retryCount + 1));
      return;
    }
    // 何度試しても取得できない場合は、キャッシュされた名前のまま(メールアドレスにはしない)続行する
    renderAll();
  });
}

// 万が一Firebaseから応答が全く来ない場合の保険。
// 一定時間たっても読み込み中画面のままなら、ログイン画面(または前回ログイン情報があればホーム)を表示する。
setTimeout(() => {
  const loadingView = document.getElementById("view-loading");
  if (loadingView && loadingView.classList.contains("active")) {
    if (localStorage.getItem(DEVICE_LOGIN_KEY) === "1") {
      currentUserName = localStorage.getItem(DEVICE_NAME_KEY) || "名無し";
      currentUserPhoto = localStorage.getItem(DEVICE_PHOTO_KEY) || null;
      goToMainApp();
    } else {
      showSetupScreen("サーバーへの接続に時間がかかっています。通信環境を確認するか、ページを再読み込みしてください。");
    }
  }
}, 8000);


// ===== アカウント設定 =====
function handleSaveSettings() {
  const nameInput = document.getElementById("settings-name");
  const message = document.getElementById("settings-message");
  const newName = nameInput.value.trim();
  const user = auth.currentUser;
  if (!newName) {
    message.textContent = "名前を入力してください";
    return;
  }
  if (!user) return;
  db.collection(USERS_COLLECTION).doc(user.uid).set({ name: newName, email: user.email }, { merge: true })
    .then(() => {
      currentUserName = newName;
      message.textContent = "保存しました!(これから記録する分から新しい名前になります)";
      renderAll();
      setTimeout(() => (message.textContent = ""), 3000);
    })
    .catch((error) => {
      message.textContent = "保存失敗: " + error.message;
    });
}

function handleLogout() {
  const ok = confirm("ログアウトしますか?");
  if (!ok) return;
  isLoggingOut = true;
  stopPresenceHeartbeat();
  auth.signOut().catch((error) => {
    console.error("ログアウトに失敗しました:", error);
    alert("ログアウトに失敗しました: " + error.message);
  });
  // 保険: 上のsignOut()がうまく反応しない/時間がかかる場合でも、
  // 少し待って画面が切り替わっていなければ強制的にログイン画面に戻す。
  setTimeout(() => {
    if (isLoggingOut) {
      localStorage.removeItem(DEVICE_LOGIN_KEY);
      localStorage.removeItem(DEVICE_NAME_KEY);
      localStorage.removeItem(DEVICE_PHOTO_KEY);
      currentUserName = null;
      currentUserPhoto = null;
      hasEnteredApp = false;
      isLoggingOut = false;
      showSetupScreen();
    }
  }, 2500);
}

// ===== 管理者モード(アカウント名が「YAMA」のときだけ使える) =====
function isAdminUser() {
  return getCurrentUser() === ADMIN_ACCOUNT_NAME;
}

// あるユーザーのアプリ内データ(記録・やることリスト・ストーリー・ユーザー情報)を全て削除する
async function deleteAllUserData(uid, name) {
  const jobs = [];
  jobs.push(db.collection(USERS_COLLECTION).doc(uid).delete());
  const entrySnap = await db.collection(COLLECTION_NAME).where("uid", "==", uid).get();
  entrySnap.docs.forEach((doc) => jobs.push(doc.ref.delete()));
  const todoSnap = await db.collection(TODOS_COLLECTION).where("uid", "==", uid).get();
  todoSnap.docs.forEach((doc) => jobs.push(doc.ref.delete()));
  const storySnap = await db.collection(STORIES_COLLECTION).where("uid", "==", uid).get();
  storySnap.docs.forEach((doc) => jobs.push(doc.ref.delete()));
  await Promise.all(jobs);
}

// ---- 管理者: 他のアカウントのデータを「非表示(削除)」にする。あとで復元できる。パスワード不要。 ----
async function adminSoftDeleteUser(uid, label) {
  if (!isAdminUser()) return;
  const ok = confirm(`${label} のデータを削除(非表示に)しますか?\n(ランキングや一覧から見えなくなりますが、あとで復元できます)`);
  if (!ok) return;
  try {
    await db.collection(USERS_COLLECTION).doc(uid).set(
      { deleted: true, deletedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    renderAdminPanel();
  } catch (error) {
    alert("削除に失敗しました: " + error.message);
  }
}

// ---- 管理者: 「非表示(削除)」になっているアカウントを元に戻す。パスワード不要。 ----
async function adminRestoreUser(uid, label) {
  if (!isAdminUser()) return;
  try {
    await db.collection(USERS_COLLECTION).doc(uid).set(
      { deleted: false, deletedAt: null },
      { merge: true }
    );
    alert(`${label} を復元しました`);
    renderAdminPanel();
  } catch (error) {
    alert("復元に失敗しました: " + error.message);
  }
}

// ---- 管理者: アプリ内データを完全に削除する(元に戻せない)。Firebase認証自体は削除されない。 ----
async function adminHardDeleteUser(uid, label) {
  if (!isAdminUser()) return;
  const ok = confirm(`${label} のデータを完全に削除しますか?この操作は取り消せません。\n(記録・YEEN・アイテムなど全て消えます。ログイン用のアカウント自体は残ります)`);
  if (!ok) return;
  try {
    await deleteAllUserData(uid, label);
    alert(`${label} のデータを完全に削除しました`);
    renderAdminPanel();
  } catch (error) {
    alert("削除に失敗しました: " + error.message);
  }
}

// ---- 誰でも使える: 自分のアカウントを削除する(非表示にする。あとで同じメール/パスワードでログインすれば復元できる) ----
async function handleDeleteAccount() {
  const user = auth.currentUser;
  if (!user) return;
  const ok = confirm(
    "アカウントを削除しますか?\n記録・YEEN・アイテムなどはランキングや一覧から見えなくなります。\n(ログイン情報は残るので、また同じメールアドレスとパスワードでログインすれば復元できます)"
  );
  if (!ok) return;
  try {
    await db.collection(USERS_COLLECTION).doc(user.uid).set(
      { deleted: true, deletedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    stopPresenceHeartbeat();
    isLoggingOut = true;
    await auth.signOut();
  } catch (error) {
    alert("削除に失敗しました: " + error.message);
  }
}

// ---- 誰でも使える: ログイン後、自分のアカウントが削除(非表示)状態だった場合に自分で復元する ----
function handleRestoreOwnAccount() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection(USERS_COLLECTION).doc(user.uid).set(
    { deleted: false, deletedAt: null },
    { merge: true }
  ).then(() => {
    document.getElementById("tabbar").style.display = "flex";
    showView("home");
  }).catch((error) => {
    alert("復元に失敗しました: " + error.message);
  });
}

// ---- ログイン中のアカウントが削除(非表示)状態のときに出す画面 ----
function showAccountDeletedScreen() {
  document.getElementById("tabbar").style.display = "none";
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
    v.style.display = "none";
  });
  const el = document.getElementById("view-account-deleted");
  if (!el) return;
  el.classList.add("active");
  el.style.display = "block";
}

// ---- 管理者: 購入アイテムを取り消す ----
let adminExpandedUid = null;
const ADMIN_ITEM_CATEGORIES = [
  { label: "フレーム", catalog: FRAME_CATALOG, ownedField: "ownedFrames", equippedField: "equippedFrame" },
  { label: "ヘッダー", catalog: HEADER_CATALOG, ownedField: "ownedHeaders", equippedField: "equippedHeader" },
  { label: "称号", catalog: BADGE_CATALOG, ownedField: "ownedBadges", equippedField: "equippedBadge" },
  { label: "エフェクト", catalog: EFFECT_CATALOG, ownedField: "ownedEffects", equippedField: "equippedEffect" },
  { label: "チェックマーク", catalog: CHECKMARK_CATALOG, ownedField: "ownedCheckmarks", equippedField: "equippedCheckmark" },
  { label: "便箋", catalog: SKIN_CATALOG, ownedField: "ownedSkins", equippedField: "equippedSkin" },
];

function adminToggleItemPanel(uid) {
  adminExpandedUid = adminExpandedUid === uid ? null : uid;
  renderAdminPanel();
}

function renderAdminItemPanel(u) {
  const sections = ADMIN_ITEM_CATEGORIES.map((cat) => {
    const owned = (u[cat.ownedField] || ["normal"]).filter((id) => id !== "normal");
    if (owned.length === 0) return "";
    const rows = owned.map((id) => {
      const item = cat.catalog.find((c) => c.id === id);
      const itemName = item ? item.name : id;
      const safeName = itemName.replace(/'/g, "\\'");
      const isEquipped = u[cat.equippedField] === id;
      return `
        <div class="list-row" style="border-bottom:none;">
          <span class="lr-label" style="flex:1;">${itemName}${isEquipped ? "(装備中)" : ""}</span>
          <button class="btn-mini-accent" style="border-color:var(--accent); color:var(--accent);" onclick="adminRevokeItem('${u.uid}','${cat.ownedField}','${cat.equippedField}','${id}','${safeName}')">取り消す</button>
        </div>
      `;
    }).join("");
    return `<p class="list-group-label" style="margin-top:10px;">${cat.label}</p>${rows}`;
  }).join("");
  return `<div class="list-group crn-frame" style="margin-top:6px;">${sections || '<p class="empty">購入したアイテムはありません</p>'}</div>`;
}

async function adminRevokeItem(uid, ownedField, equippedField, itemId, itemLabel) {
  if (!isAdminUser()) return;
  const ok = confirm(`「${itemLabel}」を取り消しますか?(コインの返金はされません)`);
  if (!ok) return;
  try {
    const docRef = db.collection(USERS_COLLECTION).doc(uid);
    const snap = await docRef.get();
    const data = snap.exists ? snap.data() : {};
    const owned = (data[ownedField] || ["normal"]).filter((id) => id !== itemId);
    const update = { [ownedField]: owned.length ? owned : ["normal"] };
    if (data[equippedField] === itemId) {
      update[equippedField] = "normal";
      if (ownedField === "ownedHeaders" && itemId === "custom") {
        update.customHeaderImage = null;
      }
    }
    await docRef.update(update);
    alert(`「${itemLabel}」を取り消しました`);
    renderAdminPanel();
  } catch (error) {
    alert("取り消しに失敗しました: " + error.message);
  }
}

// ---- 管理者パネルの描画 ----
function renderAdminPanel() {
  const list = document.getElementById("admin-user-list");
  if (list) {
    const myUid = auth.currentUser ? auth.currentUser.uid : null;
    // 名前ではなくuidごとに一覧化するので、同じ名前・同じメールの重複アカウントも全て表示される
    const sorted = [...allUserDocs].sort((a, b) => {
      const an = a.name || "";
      const bn = b.name || "";
      return an.localeCompare(bn, "ja");
    });
    if (sorted.length === 0) {
      list.innerHTML = `<p class="empty">まだユーザーがいません</p>`;
    } else {
      list.innerHTML = sorted.map((u) => {
        const displayName = u.name || "(名前なし)";
        const safeName = displayName.replace(/'/g, "\\'");
        const isSelf = u.uid === myUid;
        const deletedTag = u.deleted
          ? `<span class="lr-note" style="color:var(--accent);">削除済み(非表示)</span>`
          : "";
        const emailNote = u.email ? `<span class="lr-note">${u.email}</span>` : "";
        let actions = `<button class="btn-mini-accent" onclick="adminToggleItemPanel('${u.uid}')">${adminExpandedUid === u.uid ? "閉じる" : "アイテム"}</button>`;
        if (!isSelf) {
          if (u.deleted) {
            actions += `
              <button class="btn-mini-accent" onclick="adminRestoreUser('${u.uid}','${safeName}')">復元</button>
              <button class="btn-mini-accent" style="border-color:var(--accent); color:var(--accent);" onclick="adminHardDeleteUser('${u.uid}','${safeName}')">完全削除</button>
            `;
          } else {
            actions += `<button class="btn-mini-accent" style="border-color:var(--accent); color:var(--accent);" onclick="adminSoftDeleteUser('${u.uid}','${safeName}')">削除</button>`;
          }
        }
        const itemPanel = adminExpandedUid === u.uid ? renderAdminItemPanel(u) : "";
        return `
          <div class="list-row">
            ${avatarSpan(displayName, u.photo, "avatar-sm")}
            <span class="lr-label" style="flex:1; margin-left:10px;">${displayName}${isSelf ? "(自分)" : ""}${deletedTag}<span class="lr-note">${(u.coins || 0).toLocaleString()} YEEN ・ ID:${u.uid.slice(0, 6)}</span>${emailNote}</span>
            ${actions}
          </div>
          ${itemPanel}
        `;
      }).join("");
    }
  }
  const entryList = document.getElementById("admin-entry-list");
  if (entryList) {
    // 削除済みアカウント分の記録も含め、全ての記録を表示する(重複アカウントの整理用)
    const recent = [...rawEntries].sort((a, b) => (getTodoTime(b) - getTodoTime(a))).slice(0, 60);
    entryList.innerHTML = recent.length
      ? recent.map((e) => `
          <div class="log-entry">
            <span>${e.date} ・ ${e.name} / ${e.subject} ${e.minutes}分${e.uid && deletedUids.has(e.uid) ? " (削除済みアカウント)" : ""}</span>
            <span class="entry-delete" onclick="deleteEntry('${e.id}')">削除</span>
          </div>
        `).join("")
      : `<p class="empty">記録がありません</p>`;
  }
}

// ===== ボタン処理 =====
function handleAddEntry() {
  const nameInput = document.getElementById("log-name");
  const minutesInput = document.getElementById("log-minutes");
  const message = document.getElementById("log-message");
  const name = nameInput.value.trim() || getCurrentUser();
  const subject = getSelectedSubject();
  const minutes = parseInt(minutesInput.value, 10);
  if (!subject) {
    message.textContent = "科目を入力してください";
    return false;
  }
  if (!minutes || minutes <= 0) {
    message.textContent = "勉強時間を正しく入力してください";
    return false;
  }
  addEntry(name, subject, minutes);
  document.getElementById("log-subject-custom").value = "";
  minutesInput.value = "";
  message.textContent = "記録しました!";
  setTimeout(() => (message.textContent = ""), 2000);
  return true;
}

// ===== YEENバッジ: 触ると回転するギミック(全てのYEEN表示に共通) =====
function spinYeenBadge(el) {
  if (!el) return;
  el.classList.remove("yeen-spin");
  void el.offsetWidth; // reflow させてアニメーションを再スタートさせる
  el.classList.add("yeen-spin");
}

// ===== 記録画面: 「記録する」横スワイプ =====
let lsDragging = false;
let lsTrackWidth = 0;
let lsKnobWidth = 0;
function resetLetterSendSwipe() {
  const fill = document.getElementById("letter-send-fill");
  const knob = document.getElementById("letter-send-knob");
  if (fill) fill.style.width = "0px";
  if (knob) {
    knob.style.transition = "";
    knob.style.left = "0px";
  }
}
function initLetterSendSwipe() {
  const knob = document.getElementById("letter-send-knob");
  const track = document.getElementById("letter-send-track");
  const fill = document.getElementById("letter-send-fill");
  if (!knob || !track || !fill) return;
  const onPointerDown = (e) => {
    lsDragging = true;
    lsTrackWidth = track.clientWidth;
    lsKnobWidth = knob.clientWidth;
    if (knob.setPointerCapture && e.pointerId != null) {
      knob.setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e) => {
    if (!lsDragging) return;
    const rect = track.getBoundingClientRect();
    let x = e.clientX - rect.left - lsKnobWidth / 2;
    const maxX = lsTrackWidth - lsKnobWidth;
    x = Math.max(0, Math.min(maxX, x));
    knob.style.left = x + "px";
    fill.style.width = (x + lsKnobWidth / 2) + "px";
    if (x >= maxX - 2) {
      lsDragging = false;
      const sent = handleAddEntry();
      if (!sent) {
        knob.style.transition = "left 0.2s ease";
        knob.style.left = "0px";
        fill.style.width = "0px";
        setTimeout(() => (knob.style.transition = ""), 200);
      } else {
        setTimeout(resetLetterSendSwipe, 350);
      }
    }
  };
  const onPointerUp = () => {
    if (!lsDragging) return;
    lsDragging = false;
    knob.style.transition = "left 0.2s ease";
    knob.style.left = "0px";
    fill.style.width = "0px";
    setTimeout(() => {
      knob.style.transition = "";
    }, 200);
  };
  knob.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

// ===== デイリーくじ =====
function pickLotteryAmount() {
  const totalWeight = LOTTERY_TABLE.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of LOTTERY_TABLE) {
    if (r < item.weight) return item.amount;
    r -= item.weight;
  }
  return LOTTERY_TABLE[0].amount;
}

function handleDailyLottery() {
  const user = auth.currentUser;
  if (!user) return;
  const today = todayOffset(0);
  if (currentUserLastLotteryDate === today) return;
  const amount = pickLotteryAmount();
  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
  db.runTransaction((tx) => {
    return tx.get(ref).then((doc) => {
      const data = doc.exists ? doc.data() : {};
      if (data.lastLotteryDate === today) throw new Error("ALREADY");
      const coins = data.coins || 0;
      tx.set(ref, { coins: coins + amount, lastLotteryDate: today }, { merge: true });
    });
  }).then(() => {
    const resultEl = document.getElementById("lottery-result");
    if (resultEl) {
      resultEl.textContent = amount >= 500 ? `🎉 大当たり!! +${amount} YEEN !!` : `くじの結果: +${amount} YEEN`;
    }
    renderLotterySection();
  }).catch((error) => {
    if (error.message !== "ALREADY") console.error("くじの抽選に失敗しました:", error);
  });
}

function renderLotterySection() {
  const btn = document.getElementById("lottery-draw-btn");
  if (!btn) return;
  const today = todayOffset(0);
  const drawnToday = currentUserLastLotteryDate === today;
  btn.disabled = drawnToday;
  btn.textContent = drawnToday ? "本日は引き済みです" : "デイリーくじを引く";
}

function initCoinRateText() {
  const el = document.getElementById("settings-coin-rate");
  if (el) el.textContent = `勉強を記録すると1分につき${COIN_PER_MINUTE}YEENもらえます。累計ランキング1位は12時間ごとに${RANK_BONUS_AMOUNTS[1]}YEEN、2位は${RANK_BONUS_AMOUNTS[2]}YEEN、3位は${RANK_BONUS_AMOUNTS[3]}YEENもらえます`;
}

// ===== 初期表示 =====
initTheme();
initCoinRateText();
initBoardingPassSwipe();
initLetterSendSwipe();
checkFirebaseConnection();
updateTimerDisplay();