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
const COLLECTION_NAME = "studyEntries"; // Firestore上のデータの置き場所の名前
const USERS_COLLECTION = "users";       // ログインユーザーの表示名・写真を置く場所
const STORIES_COLLECTION = "stories";   // ストーリー投稿を置く場所
const TODOS_COLLECTION = "todos";       // やることリストを置く場所
const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000; // ストーリーが消えるまでの時間(24時間)

// ===== ゲーム内通貨(コイン) =====
// 自分の勉強を1分記録するごとに何コインもらえるか
const COIN_PER_MINUTE = 1;
// ログイン中ユーザーの現在のコイン残高(users/{uid}.coins をリアルタイムで反映)
let currentUserCoins = 0;

// ===== フレームショップ(アバターの縁取り) =====
const FRAME_CATALOG = [
  { id: "normal",   name: "ノーマル",       price: 0,   cssClass: "frame-normal" },
  { id: "sunset",   name: "サンセット",     price: 100, cssClass: "frame-sunset" },
  { id: "ocean",    name: "オーシャン",     price: 100, cssClass: "frame-ocean" },
  { id: "mint",     name: "ミント",         price: 100, cssClass: "frame-mint" },
  { id: "gold",     name: "ゴールド",       price: 250, cssClass: "frame-gold" },
  { id: "neonglow", name: "ネオングロー",   price: 250, cssClass: "frame-neonglow" },
  { id: "star",     name: "スターダスト",   price: 350, cssClass: "frame-star" },
  { id: "rainbow",  name: "レインボー",     price: 500, cssClass: "frame-rainbow" },
  { id: "diamond",  name: "ダイヤモンド",   price: 600, cssClass: "frame-diamond" },
];
let currentUserOwnedFrames = ["normal"];
let currentUserEquippedFrame = "normal";

// ===== ヘッダーショップ(プロフィール上部のバナー) =====
const HEADER_CATALOG = [
  { id: "normal",   name: "ノーマル",         price: 0,   cssClass: "header-normal" },
  { id: "sakura",   name: "さくら",           price: 150, cssClass: "header-sakura" },
  { id: "citrus",   name: "シトラス",         price: 150, cssClass: "header-citrus" },
  { id: "mint",     name: "ミントブリーズ",   price: 150, cssClass: "header-mint" },
  { id: "night",    name: "ナイトスカイ",     price: 300, cssClass: "header-night" },
  { id: "goldline", name: "ゴールドライン",   price: 300, cssClass: "header-goldline" },
  { id: "galaxy",   name: "ギャラクシー",     price: 500, cssClass: "header-galaxy" },
  { id: "aurora",   name: "オーロラ",         price: 650, cssClass: "header-aurora" },
  { id: "custom",   name: "カスタム画像",     price: 300, cssClass: "header-custom", isCustom: true },
];
let currentUserOwnedHeaders = ["normal"];
let currentUserEquippedHeader = "normal";
let currentUserCustomHeaderImage = null; // 自分で選んだヘッダー画像(base64)

// 今、アプリが持っている全員分の記録(Firestoreから自動で更新される)
let entries = [];

// 名前 -> { photo, uid } のマップ(ランキングに写真を出すために使う)
let usersByName = {};

// 今日の勉強時間1位の人の名前(複数いる場合は同点全員)。この人のアバターに王冠をつける
let dailyTopNames = new Set();

function updateDailyTopNames() {
  const todayRanked = withRanks(getTodayTotals(entries));
  dailyTopNames = new Set(
    todayRanked.filter((r) => r.rank === 1 && r.minutes > 0).map((r) => r.name)
  );
}

// Firestoreから取得した全ストーリー(まだ消えていないものだけ画面には出す)
let stories = [];

// 今開いているストーリー閲覧のリストと位置
let storyViewerList = [];
let storyViewerIndex = 0;

// 自分のやることリスト(Firestoreから自動で更新される)
let todos = [];

// ストーリー投稿フォームで選んだ写真(base64)
let storyAddPhotoBase64 = null;

// ログイン中のユーザーの表示名・写真(Firebase Authでログインしたら中身が入る)
let currentUserName = null;
let currentUserPhoto = null;

// 自分の名前を取得する(未ログインならnullを返す)
function getCurrentUser() {
  return currentUserName;
}

function todayOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // toISOString()はUTC基準になってしまい、日本時間だと日付が朝9時に変わってしまうため、
  // 必ず「今いる場所のローカル時間」の年月日を使う
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`; // "YYYY-MM-DD"
}

// ===== アバター(プロフィール写真)まわり =====

// 写真がないときの、名前から決まる背景色
function getAvatarColor(name) {
  const colors = ["#7ce8ff", "#ffd25a", "#ff9b9b", "#b19cd9", "#8fd9a8", "#f7a4c9"];
  let hash = 0;
  const str = name || "";
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// 既存のDOM要素(span.avatar)に、写真か頭文字を反映する
function setAvatarElement(el, name, photo) {
  if (!el) return;
  if (photo) {
    el.style.background = "transparent";
    el.innerHTML = `<img src="${photo}" alt="">`;
  } else {
    el.style.background = getAvatarColor(name || "");
    el.textContent = (name || "?").trim().charAt(0).toUpperCase();
  }
  // 今日の勉強時間1位なら、アバターの上に王冠をつける
  el.classList.toggle("is-daily-top", dailyTopNames.has(name));
}

// ランキング行やストーリーバーなど、テンプレート文字列の中で使うアバターHTML
function avatarSpan(name, photo, sizeClass) {
  const crownClass = dailyTopNames.has(name) ? " is-daily-top" : "";
  if (photo) {
    return `<span class="avatar ${sizeClass}${crownClass}"><img src="${photo}" alt=""></span>`;
  }
  const color = getAvatarColor(name || "");
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return `<span class="avatar ${sizeClass}${crownClass}" style="background:${color}">${initial}</span>`;
}

// 画像ファイルを、指定サイズ以下に縮小してbase64(JPEG)に変換する
// Firestoreに直接保存するので、なるべく軽くしておく
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

// 設定画面: プロフィール写真を選んだときの処理
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
    message.textContent = "写真を変更しました!";
    renderAll();
    setTimeout(() => (message.textContent = ""), 2500);
  } catch (error) {
    message.textContent = "アップロード失敗: " + error.message;
  }
}

// 名前 -> 写真 のマップを、みんなのアカウント情報から作って監視し続ける
function startListeningUsers() {
  db.collection(USERS_COLLECTION).onSnapshot(
    (snapshot) => {
      const map = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          map[data.name] = { photo: data.photo || null, uid: doc.id, coins: data.coins || 0 };
        }
        // 自分自身のドキュメントなら、コイン残高・所持アイテム・装着状況をここで拾っておく
        const user = auth.currentUser;
        if (user && doc.id === user.uid) {
          currentUserCoins = data.coins || 0;
          currentUserOwnedFrames = data.ownedFrames || ["normal"];
          currentUserEquippedFrame = data.equippedFrame || "normal";
          currentUserOwnedHeaders = data.ownedHeaders || ["normal"];
          currentUserEquippedHeader = data.equippedHeader || "normal";
          currentUserCustomHeaderImage = data.customHeaderImage || null;
        }
      });
      usersByName = map;
      renderAll();
      renderStoriesBar();
    },
    (error) => {
      console.error("ユーザー情報の取得に失敗しました:", error);
    }
  );
}

// 自分の現在のコイン残高を取得する
function getMyCoins() {
  return currentUserCoins;
}

// 自分のコイン残高を amount だけ増減させる(マイナス残高にはならないようにする)
// 勉強を記録したとき: プラスで呼ぶ / 記録を削除したとき: マイナスで呼ぶ
function adjustCoins(amount) {
  const user = auth.currentUser;
  if (!user || !amount) return Promise.resolve();

  const ref = db.collection(USERS_COLLECTION).doc(user.uid);
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

// ===== フレーム・ヘッダーの購入/ 装着 =====

// フレームを購入する(コインを消費して所持リストに追加する。トランザクションで二重購入を防ぐ)
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
      if (coins < item.price) throw new Error("コインが足りません");
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

// 所持しているフレームを装着する
function equipFrame(frameId) {
  const user = auth.currentUser;
  if (!user || !currentUserOwnedFrames.includes(frameId)) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ equippedFrame: frameId }, { merge: true })
    .catch((error) => console.error("フレームの装着に失敗しました:", error));
}

// ヘッダー(プロフィール上部バナー)を購入する
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
      if (coins < item.price) throw new Error("コインが足りません");
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

// 所持しているヘッダーを装着する
function equipHeader(headerId) {
  const user = auth.currentUser;
  if (!user || !currentUserOwnedHeaders.includes(headerId)) return;
  db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ equippedHeader: headerId }, { merge: true })
    .catch((error) => console.error("ヘッダーの装着に失敗しました:", error));
}

// ===== ヘッダー(カスタム画像) =====
// "buy": まだ持っていない状態でファイル選択 → 購入も同時に行う
// "change": すでに持っている状態でファイル選択 → 画像だけ差し替える(追加コインなし)
let headerCustomPendingIntent = null;

function triggerHeaderCustomFile(intent) {
  headerCustomPendingIntent = intent;
  const input = document.getElementById("header-custom-file-input");
  if (input) input.click();
}

async function handleHeaderCustomFileSelected(event) {
  const file = event.target.files[0];
  event.target.value = ""; // 同じファイルを選び直しても変化を検知できるようにする
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

// カスタム画像ヘッダーを購入する(初回のみコインを消費する)
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
        // 既に購入済みなら、コインは取らずに画像だけ更新する
        tx.set(ref, { customHeaderImage: base64, equippedHeader: "custom" }, { merge: true });
        return;
      }
      if (coins < item.price) throw new Error("コインが足りません");
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

// 既に持っているカスタム画像ヘッダーの中身だけを差し替える
function updateCustomHeaderImage(base64) {
  const user = auth.currentUser;
  if (!user) return Promise.resolve();
  return db.collection(USERS_COLLECTION).doc(user.uid)
    .set({ customHeaderImage: base64, equippedHeader: "custom" }, { merge: true })
    .catch((error) => {
      alert("画像の更新に失敗しました: " + error.message);
    });
}

// ショップ内の1アイテムぶんの、状態に応じたボタンHTMLを作る(所有/未所有/装着中で切り替え)
function shopItemButtonHtml(item, ownedList, equippedId, equipFnName, buyFnName) {
  const owned = ownedList.includes(item.id);
  const equipped = equippedId === item.id;

  // カスタム画像ヘッダーだけは、購入/変更の両方でファイル選択が必要なので専用の分岐にする
  if (item.isCustom) {
    if (!owned) {
      const affordable = currentUserCoins >= item.price;
      return `<button class="btn-accent" style="width:100%; margin-bottom:0;" ${affordable ? "" : "disabled"} onclick="triggerHeaderCustomFile('buy')">🪙 ${item.price} で画像を選ぶ</button>`;
    }
    return `
      ${equipped
        ? `<button class="btn-mini-accent" disabled style="width:100%; margin-bottom:6px;">装着中</button>`
        : `<button class="btn-secondary" style="width:100%; margin-bottom:6px;" onclick="${equipFnName}('${item.id}')">装着する</button>`}
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
  return `<button class="btn-accent" style="width:100%; margin-bottom:0;" ${affordable ? "" : "disabled"} onclick="${buyFnName}('${item.id}')">🪙 ${item.price} で購入</button>`;
}

// フレームショップの画面を描画する
function renderFrameShop() {
  const grid = document.getElementById("frameshop-grid");
  if (!grid) return;
  const myName = getCurrentUser();
  const initial = (myName || "?").trim().charAt(0).toUpperCase();
  const photo = currentUserPhoto;
  const bgStyle = photo ? "" : `style="background:${getAvatarColor(myName || "")}"`;

  grid.innerHTML = FRAME_CATALOG.map((item) => `
    <div class="shop-item">
      <span class="avatar avatar-lg shop-frame-preview ${item.cssClass}" ${bgStyle}>${
        photo ? `<img src="${photo}" alt="">` : initial
      }</span>
      <p class="shop-item-name">${item.name}</p>
      ${shopItemButtonHtml(item, currentUserOwnedFrames, currentUserEquippedFrame, "equipFrame", "buyFrame")}
    </div>
  `).join("");

  const coinEl = document.getElementById("frameshop-coin-balance");
  if (coinEl) coinEl.textContent = `🪙 ${getMyCoins().toLocaleString()}`;
}

// ヘッダーショップの画面を描画する
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
        <div class="shop-item">
          <div class="shop-header-preview header-custom${hasImage ? "" : " is-empty"}" ${previewStyle}></div>
          <p class="shop-item-name">${item.name}</p>
          ${shopItemButtonHtml(item, currentUserOwnedHeaders, currentUserEquippedHeader, "equipHeader", "buyHeader")}
        </div>
      `;
    }
    return `
      <div class="shop-item">
        <div class="shop-header-preview ${item.cssClass}"></div>
        <p class="shop-item-name">${item.name}</p>
        ${shopItemButtonHtml(item, currentUserOwnedHeaders, currentUserEquippedHeader, "equipHeader", "buyHeader")}
      </div>
    `;
  }).join("");

  const coinEl = document.getElementById("headershop-coin-balance");
  if (coinEl) coinEl.textContent = `🪙 ${getMyCoins().toLocaleString()}`;
}

// ホーム/設定画面のアバターに、今装着中のフレームを反映する
function applyFrameToAvatarEl(el) {
  if (!el) return;
  FRAME_CATALOG.forEach((f) => el.classList.remove(f.cssClass));
  const item = FRAME_CATALOG.find((f) => f.id === currentUserEquippedFrame) || FRAME_CATALOG[0];
  el.classList.add(item.cssClass);
}

// ホーム/設定画面のプロフィールバナーに、今装着中のヘッダーを反映する
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

// ===== Firestoreとのやりとり =====

// 新しい記録をクラウドに追加する
function addEntry(name, subject, minutes) {
  const entryName = name || getCurrentUser();
  const user = auth.currentUser;
  const isOwnEntry = user && entryName === getCurrentUser();

  db.collection(COLLECTION_NAME).add({
    name: entryName,
    subject: subject,
    minutes: minutes,
    date: todayOffset(0),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: isOwnEntry ? user.uid : null, // コインの付与・削除時の本人確認に使う
  }).then(() => {
    // 自分の勉強として記録したときだけ、勉強した分数ぶんのコインを付与する
    if (isOwnEntry) {
      adjustCoins(minutes * COIN_PER_MINUTE);
    }
  }).catch((error) => {
    console.error("保存に失敗しました:", error);
    document.getElementById("log-message").textContent =
      "保存失敗: " + error.code + " / " + error.message;
  });
}

// クラウドのデータをリアルタイムで監視して、変化があるたびに画面を更新する
function startListening() {
  db.collection(COLLECTION_NAME).onSnapshot(
    (snapshot) => {
      entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderAll();
    },
    (error) => {
      console.error("データの取得に失敗しました:", error);
    }
  );
}

// 記録を1件削除する(自分の記録だけ削除できるようにする)
function deleteEntry(entryId) {
  const ok = confirm("この記録を削除しますか?(もらったコインも取り消されます)");
  if (!ok) return;

  const user = auth.currentUser;
  const entry = entries.find((e) => e.id === entryId);

  db.collection(COLLECTION_NAME).doc(entryId).delete().then(() => {
    // 自分がコインをもらった記録だった場合は、そのぶんのコインを取り消す
    if (entry && user && entry.uid === user.uid && entry.minutes) {
      adjustCoins(-(entry.minutes * COIN_PER_MINUTE));
    }
  }).catch((error) => {
    console.error("削除に失敗しました:", error);
    alert("削除に失敗しました: " + error.message);
  });
}

// ===== ストーリー(24時間で消える投稿) =====

// クラウドのストーリーをリアルタイムで監視する
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

// 投稿した瞬間はサーバー側の時刻がまだ入っていないことがあるので、その場合は「今」扱いにする
function getStoryTime(story) {
  return story.createdAt ? story.createdAt.toMillis() : Date.now();
}

// 24時間以内に投稿された、まだ消えていないストーリーだけを取り出す
function getActiveStories() {
  const cutoff = Date.now() - STORY_LIFETIME_MS;
  return stories.filter((s) => getStoryTime(s) > cutoff);
}

// 名前ごとにグループ化して、新しく投稿した人が先頭に来るように並べる
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

// ホーム画面のストーリーバー(アイコンが横に並ぶところ)を描画する
function renderStoriesBar() {
  updateDailyTopNames();
  const myName = getCurrentUser();
  const groups = getGroupedStories();

  // 自分のストーリーの有無を、ホーム最上部のアカウントアイコンにも反映する
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

// ホーム最上部のアカウントアバターに、ストーリーの輪っか(グラデーション)を付けるかどうかを切り替える
function updateHomeAvatarRing(hasStory) {
  const ring = document.getElementById("home-avatar-ring");
  if (!ring) return;
  ring.classList.toggle("has-story", !!hasStory);
  ring.dataset.hasStory = hasStory ? "1" : "0";
}

// ホーム最上部のアカウントアバターをタップしたとき:
// 自分のストーリーがあれば閲覧、なければ投稿画面を開く
function handleHomeAvatarClick() {
  const ring = document.getElementById("home-avatar-ring");
  const hasStory = ring && ring.dataset.hasStory === "1";
  if (hasStory) {
    openStoryViewer(getCurrentUser());
  } else {
    showView("story-add");
  }
}

// ストーリー投稿フォーム: 写真を選んだときの処理
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

// ストーリーを投稿する
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
    showView("home");
  } catch (error) {
    message.textContent = "投稿失敗: " + error.message;
  }
}

// ストーリー投稿フォームをリセットする
function resetStoryAddForm() {
  storyAddPhotoBase64 = null;
  document.getElementById("story-add-text").value = "";
  document.getElementById("story-add-photo-input").value = "";
  const preview = document.getElementById("story-add-preview");
  preview.style.display = "none";
  preview.src = "";
  document.getElementById("story-add-message").textContent = "";
}

// 指定した人のストーリーを、閲覧画面で開く
function openStoryViewer(name) {
  const groups = getGroupedStories();
  const group = groups.find((g) => g.name === name);
  if (!group) return;

  storyViewerList = group.stories;
  storyViewerIndex = 0;
  showView("story-viewer");
  renderStoryViewer();
}

// ストーリー閲覧画面を、今の位置の内容で描画する
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

// 自分のやることリストをリアルタイムで監視する(orderByは使わず、あとで並べ替える)
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

// 指定した入力欄(ホーム or タイマーパネル)の中身を、新しいやることとして追加する
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
  db.collection(TODOS_COLLECTION).doc(id).update({ done: !done });
}

function handleDeleteTodo(id) {
  db.collection(TODOS_COLLECTION).doc(id).delete();
}

// ホーム画面のカードと、PCのタイマー横パネルの両方に同じ内容を描画する
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
        <div class="todo-row${t.done ? " todo-done" : ""}">
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
  cutoff.setDate(cutoff.getDate() - 6); // 今日を含めて直近7日間
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const totals = {};
  list.forEach((e) => {
    if (e.date >= cutoffStr) {
      totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
    }
  });

  return buildTotalsWithAllUsers(totals);
}

// 今日1日の合計時間(デイリーランキング用)
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

// 全期間の合計時間(累計ランキング用)
function getAllTimeTotals(list) {
  const totals = {};
  list.forEach((e) => {
    totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
  });

  return buildTotalsWithAllUsers(totals);
}

// 記録が1件もない(勉強時間が0分の)登録ユーザーも、0分としてランキングに含める
function buildTotalsWithAllUsers(totals) {
  const merged = { ...totals };

  Object.keys(usersByName).forEach((name) => {
    if (!(name in merged)) merged[name] = 0;
  });

  // usersByNameの反映がまだの場合に備えて、自分の名前も念のため入れておく
  const myName = getCurrentUser();
  if (myName && !(myName in merged)) merged[myName] = 0;

  return Object.entries(merged)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

// 同じ分数の人には同じ順位をつける(例: 1位, 2位, 2位, 4位)
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

// ===== 画面切り替え =====
function showView(viewName) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + viewName).classList.add("active");

  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  const tabBtn = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
  if (tabBtn) tabBtn.classList.add("active");

  // 記録画面を開いたときは、名前欄が空なら自分の名前を自動で入れておく
  if (viewName === "log") {
    const nameInput = document.getElementById("log-name");
    if (!nameInput.value) {
      nameInput.value = getCurrentUser() || "";
    }
  }

  // 設定画面を開いたときは、今の表示名・写真を入れておく
  if (viewName === "settings") {
    document.getElementById("settings-name").value = getCurrentUser() || "";
    setAvatarElement(document.getElementById("settings-photo-preview"), getCurrentUser(), currentUserPhoto);
    applyFrameToAvatarEl(document.getElementById("settings-photo-preview"));
  }

  // ストーリー投稿画面を開いたときは、フォームを空にしておく
  if (viewName === "story-add") {
    resetStoryAddForm();
  }

  renderAll();
}

// ===== 画面描画 =====
function renderHome() {
  const myName = getCurrentUser();
  const weekly = withRanks(getWeeklyTotals(entries));

  setAvatarElement(document.getElementById("home-avatar"), myName, currentUserPhoto);
  applyFrameToAvatarEl(document.getElementById("home-avatar"));
  document.getElementById("home-username").textContent = `${myName} さん`;
  document.getElementById("home-today-minutes").textContent =
    formatMinutes(getTodayTotalFor(entries, myName));
  document.getElementById("home-streak").textContent =
    `${getStreak(entries, myName)}日`;

  const myRankItem = weekly.find((r) => r.name === myName);
  document.getElementById("home-rank").textContent =
    myRankItem ? `${myRankItem.rank}位` : "-";

  const coinEl = document.getElementById("home-coin-badge");
  if (coinEl) coinEl.textContent = `🪙 ${getMyCoins().toLocaleString()}`;
  const settingsCoinEl = document.getElementById("settings-coin-balance");
  if (settingsCoinEl) settingsCoinEl.textContent = `🪙 ${getMyCoins().toLocaleString()}`;

  renderRankingList(document.getElementById("home-ranking-preview"), weekly.slice(0, 3));
}

function renderRankingList(container, list) {
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<p class="empty">まだ記録がありません</p>`;
    return;
  }
  list.forEach((r) => {
    const row = document.createElement("div");
    row.className = "rank-row" + (r.rank === 1 ? " top1" : "");
    const photo = (usersByName[r.name] && usersByName[r.name].photo) || null;
    row.innerHTML = `
      <span class="rank-num">${r.rank}</span>
      ${avatarSpan(r.name, photo, "avatar-sm")}
      <span class="rank-name">${r.name}</span>
      <span class="rank-time">${formatMinutes(r.minutes)}</span>
    `;
    container.appendChild(row);
  });
}

// ===== ランキングの期間切り替え(今日 / 今週 / 累計) =====
let rankingPeriod = "daily"; // "daily" または "weekly" または "alltime"

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
  document.getElementById("ranking-my-rank").textContent =
    myRankItem ? `${myRankItem.rank}位` : "-";
}

// 記録した「時刻」を見やすい文字列にする(サーバー確定前は「たった今」と表示)
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
      row.className = "log-entry";
      const canDelete = e.name === myName;
      row.innerHTML = `
        <span>${formatEntryTime(e)} ・ ${e.name} / ${e.subject} ${e.minutes}分</span>
        ${canDelete
          ? `<span class="entry-delete" onclick="deleteEntry('${e.id}')">削除</span>`
          : `<span class="status">完了</span>`}
      `;
      list.appendChild(row);
    });
  }

  // 名前の候補(datalist)を、みんなの記録から作る(友達の名前も出てくる)
  const nameList = document.getElementById("name-list");
  const uniqueNames = [...new Set(entries.map((e) => e.name))];
  nameList.innerHTML = uniqueNames.map((n) => `<option value="${n}">`).join("");

  renderLogWeekChart();
}

// 指定した「daysAgo日前」の1日ぶんの勉強時間(分)を、自分の記録から合計する
function getDailyMinutesFor(list, name, daysAgo) {
  const dateStr = todayOffset(daysAgo);
  return list
    .filter((e) => e.name === name && e.date === dateStr)
    .reduce((sum, e) => sum + Number(e.minutes), 0);
}

// 今日を含む直近7日間の、日ごとの勉強時間の並び(古い日→今日の順)を作る
function getLast7DaysSeries(list, name) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push({ dateStr: todayOffset(i), minutes: getDailyMinutesFor(list, name, i) });
  }
  return days;
}

// 記録画面: 最近7日間の勉強時間を、シンプルな棒グラフで描画する
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

// フルスクリーンタイマー内の教科select(記録画面のselectとは別で、終了時に反映する)
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
// 画面が消えたりアプリがバックグラウンドになると setInterval は止まってしまう
// (これはブラウザの仕様で、JS側からはどうしても防げない部分がある)。
// そこで「経過秒数を数える」のではなく「開始した時刻(タイムスタンプ)との差」で
// 常に計算し直す方式にして、画面がオフになっていた間もサボらず正確に進んだ扱いになるようにしている。
// あわせて、可能な端末では画面が自動で消えないようにする(Wake Lock)機能も使う。
const POMODORO_WORK_SECONDS = 25 * 60; // 勉強25分
const POMODORO_BREAK_SECONDS = 5 * 60; // 休憩5分

let timerMode = "normal";       // "normal" または "pomodoro" または "custom"
let timerIntervalId = null;
let timerRunning = false;
let timerAnchorMs = null;       // 今動いている区間がスタートした時刻(Date.now())。停止中はnull

let normalElapsedSeconds = 0;   // 通常タイマー: 経過秒数(表示用に毎回計算し直す)
let normalBaseSeconds = 0;      // 通常タイマー: 一時停止するまでに貯まっていた秒数

let customTotalSeconds = 0;     // 好きな分数タイマー: 設定した合計秒数
let customRemainingSeconds = 0; // 好きな分数タイマー: 残り秒数(表示用に毎回計算し直す)
let customBaseElapsedSeconds = 0; // 好きな分数タイマー: 一時停止するまでに経過していた秒数

let pomodoroPhase = "work";     // "work" または "break"(表示用に毎回計算し直す)
let pomodoroPhaseRemaining = POMODORO_WORK_SECONDS; // フェーズの残り秒数(表示用)
let pomodoroStudySeconds = 0;   // ポモドーロで貯まった「勉強した秒数」の合計(表示用)
let pomodoroSessionElapsedSeconds = 0; // ポモドーロ全体(勉強+休憩)の経過秒数
let pomodoroSessionBaseSeconds = 0;    // 一時停止するまでに貯まっていた分

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

// ポモドーロの「セッション開始からの合計経過秒数」から、今のフェーズ・残り秒数・
// 完了した勉強フェーズの合計秒数を割り出す(バックグラウンドで何フェーズ分
// 時間が経っていても、ここでまとめて追いつく)
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

// 今動いている区間の経過秒数(タイマーが止まっていれば0)
function getRunningElapsedSeconds() {
  if (!timerRunning || timerAnchorMs === null) return 0;
  return Math.max(0, Math.floor((Date.now() - timerAnchorMs) / 1000));
}

// 現在時刻をもとに、表示用の各変数(normalElapsedSeconds など)を計算し直す。
// タイマー動作中に1秒ごと、また画面が復帰したタイミング(visibilitychange/focus)でも呼ぶことで、
// 画面が消えていた間もズレなく追いつく。
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

const TF_RING_CIRCUMFERENCE = 565.48; // 2 * PI * 90(SVGのrの値と合わせる)

function updateTimerDisplay() {
  const display = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("timer-phase");
  const ring = document.getElementById("tf-ring-progress");

  let progress = 0; // 0〜1

  if (timerMode === "normal") {
    display.textContent = formatClock(normalElapsedSeconds);
    // 通常タイマーは60秒で1周する見た目にする(演出目的)
    progress = (normalElapsedSeconds % 60) / 60;
  } else if (timerMode === "custom") {
    display.textContent = formatClock(customRemainingSeconds);
    progress = customTotalSeconds > 0
      ? (customTotalSeconds - customRemainingSeconds) / customTotalSeconds
      : 0;
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

// 対応端末では画面が自動で消えないようにする(できない端末では黙って諦める)
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

// ===== Focus Flight: 搭乗券を切り離してスタートする演出(「分数を決める」モードのみ) =====

// スタートボタンが押されたとき: 初回スタートのときだけ搭乗券を見せる。再開のときは今まで通りすぐ動かす
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

// 搭乗券に、今回のタイマー内容(教科・分数・時刻)を入れて表示する
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

// キャンセルされたとき: タイマーは始めず、搭乗券だけ閉じる
function closeBoardingPass() {
  document.getElementById("boarding-pass-overlay").classList.remove("open");
}

function resetBoardingPassSwipe() {
  const card = document.getElementById("boarding-pass-card");
  const fill = document.getElementById("bp-swipe-fill");
  const knob = document.getElementById("bp-swipe-knob");
  if (card) card.classList.remove("bp-tearing");
  if (fill) fill.style.width = "0px";
  if (knob) knob.style.left = "0px";
}

// スワイプで最後まで引っ張られたとき: 搭乗券がちぎれるアニメーションのあと、実際にタイマーを開始する
function confirmBoardingPassSwipe() {
  const card = document.getElementById("boarding-pass-card");
  if (card) card.classList.add("bp-tearing");
  setTimeout(() => {
    document.getElementById("boarding-pass-overlay").classList.remove("open");
    startTimer();
  }, 450);
}

let bpDragging = false;
let bpTrackWidth = 0;
let bpKnobWidth = 0;

// 搭乗券の「スワイプして切り離す」つまみを、マウス/タッチ両方で動かせるようにする
function initBoardingPassSwipe() {
  const knob = document.getElementById("bp-swipe-knob");
  const track = document.getElementById("bp-swipe-track");
  const fill = document.getElementById("bp-swipe-fill");
  if (!knob || !track || !fill) return;

  const onPointerDown = (e) => {
    bpDragging = true;
    bpTrackWidth = track.clientWidth;
    bpKnobWidth = knob.clientWidth;
    if (knob.setPointerCapture && e.pointerId != null) {
      knob.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e) => {
    if (!bpDragging) return;
    const rect = track.getBoundingClientRect();
    let x = e.clientX - rect.left - bpKnobWidth / 2;
    const maxX = bpTrackWidth - bpKnobWidth;
    x = Math.max(0, Math.min(maxX, x));
    knob.style.left = x + "px";
    fill.style.width = (x + bpKnobWidth / 2) + "px";

    if (x >= maxX - 2) {
      bpDragging = false;
      confirmBoardingPassSwipe();
    }
  };

  const onPointerUp = () => {
    if (!bpDragging) return;
    bpDragging = false;
    // 最後まで届かなかったら、つまみを元の位置に戻す
    knob.style.transition = "left 0.2s ease";
    knob.style.left = "0px";
    fill.style.width = "0px";
    setTimeout(() => { knob.style.transition = ""; }, 200);
  };

  knob.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function startTimer() {
  if (timerRunning) return;

  // 好きな分数タイマーは、初回スタート時だけ入力欄の値を読み込んで残り時間にする
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

  // 動いていた区間を、それぞれの「ベース」秒数にたたみ込んでおく
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

// 画面が復帰した(ロック解除・アプリを開き直した・タブに戻ってきたなど)ときに、
// 止まっていた分をまとめて追いつかせる
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

// タイマータブが押されたとき: 直接フルスクリーンを開く
function handleTimerTabClick() {
  setActiveTabButton("timer");
  openFullscreenTimer();
}

// タブボタンの見た目(active)を切り替える
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

  // PCの横並びレイアウトのときは常設パネルなので、端末全体を占有するフルスクリーンAPIは呼ばない
  if (isDesktopSideBySideLayout()) return;

  // 実際に端末をフルスクリーン表示にする(対応ブラウザのみ。iPhone Safariは非対応なので失敗しても無視する)
  const el = document.getElementById("timer-fullscreen");
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  }
}

function closeFullscreenTimer() {
  // PCの横並びレイアウトのときは常設パネルなので、閉じる操作をしても隠さない
  if (!isDesktopSideBySideLayout()) {
    document.getElementById("timer-fullscreen").classList.remove("open");
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  // タイマータブを離れるので、今いる画面のタブをアクティブに戻す
  const activeView = document.querySelector(".view.active");
  if (activeView) {
    setActiveTabButton(activeView.id.replace("view-", ""));
  }
}

// 縦画面レイアウト / 横画面レイアウトを切り替える(端末の向きではなく、見た目の並びを切り替える)
function setTimerLayout(layout) {
  const el = document.getElementById("timer-fullscreen");
  el.classList.toggle("landscape", layout === "landscape");
  document.getElementById("tf-layout-btn-portrait").classList.toggle("active", layout === "portrait");
  document.getElementById("tf-layout-btn-landscape").classList.toggle("active", layout === "landscape");
}

// タイマーを止めて、記録画面の入力欄(教科・分数)に自動で反映してから閉じる
function finishFullscreenTimer() {
  pauseTimer();

  let totalSeconds = 0;
  if (timerMode === "normal") {
    totalSeconds = normalElapsedSeconds;
  } else if (timerMode === "custom") {
    totalSeconds = customTotalSeconds - customRemainingSeconds;
  } else {
    totalSeconds = pomodoroStudySeconds;
    // ポモドーロの「勉強タイム」の途中で止めた分もカウントする
    if (pomodoroPhase === "work") {
      totalSeconds += (POMODORO_WORK_SECONDS - pomodoroPhaseRemaining);
    }
  }

  const minutes = Math.round(totalSeconds / 60);
  if (minutes > 0) {
    document.getElementById("log-minutes").value = minutes;
  }

  // フルスクリーン内で選んだ教科を、記録画面の教科selectにも反映する
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
    // カスタム以外のテーマに切り替えたら、上書きしていたアクセントカラーを解除する
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--accent-text");
  }
}

// 明るさを見て、白文字/黒文字どちらが読みやすいか判定する
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

// ===== 背景画像 =====
const BG_IMAGE_KEY = "studyAppBgImage";

async function handleBgImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("bg-image-status");
  statusEl.textContent = "設定中...";

  try {
    // 背景画像なので、アバター写真より少し大きめ・高画質でリサイズする
    const base64 = await resizeImageToBase64(file, 1600, 0.75);
    localStorage.setItem(BG_IMAGE_KEY, base64);
    applyBgImage(base64);
    statusEl.textContent = "背景画像を設定しました";
  } catch (error) {
    statusEl.textContent = "設定に失敗しました: " + error.message;
  }
}

function applyBgImage(base64) {
  document.body.classList.add("has-custom-bg");
  document.body.style.setProperty("--custom-bg-image", `url("${base64}")`);
  const statusEl = document.getElementById("bg-image-status");
  if (statusEl) statusEl.textContent = "背景画像を設定済みです";
}

function removeBgImage() {
  localStorage.removeItem(BG_IMAGE_KEY);
  document.body.classList.remove("has-custom-bg");
  document.body.style.removeProperty("--custom-bg-image");
  const statusEl = document.getElementById("bg-image-status");
  if (statusEl) statusEl.textContent = "まだ設定されていません";
}

function initBgImage() {
  const saved = localStorage.getItem(BG_IMAGE_KEY);
  if (saved) applyBgImage(saved);
}

let setupMode = "signup"; // "signup" または "login"

function setSetupMode(mode) {
  setupMode = mode;
  document.getElementById("setup-btn-signup").classList.toggle("active", mode === "signup");
  document.getElementById("setup-btn-login").classList.toggle("active", mode === "login");
  document.getElementById("setup-name-field").style.display = mode === "signup" ? "block" : "none";
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
    auth.createUserWithEmailAndPassword(email, password)
      .then((cred) => db.collection(USERS_COLLECTION).doc(cred.user.uid).set({ name: name, email: email }))
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

// セットアップ画面を隠して、タブバーを表示し、クラウドの監視を開始してホーム画面へ
function goToMainApp() {
  document.getElementById("tabbar").style.display = "flex";
  startListening();
  startListeningUsers();
  startListeningStories();
  startListeningTodos();
  showView("home");
}

// ===== ログイン状態の監視(ページを開いたときや、ログイン/ログアウトのたびに呼ばれる) =====
auth.onAuthStateChanged((user) => {
  if (user) {
    db.collection(USERS_COLLECTION).doc(user.uid).get().then((doc) => {
      const data = doc.exists ? doc.data() : {};
      currentUserName = data.name || (user.email || "名無し");
      currentUserPhoto = data.photo || null;
      goToMainApp();
    });
  } else {
    currentUserName = null;
    currentUserPhoto = null;
    document.getElementById("tabbar").style.display = "none";
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById("view-setup").classList.add("active");
  }
});

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

  auth.signOut();
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
    return;
  }
  if (!minutes || minutes <= 0) {
    message.textContent = "勉強時間を正しく入力してください";
    return;
  }

  addEntry(name, subject, minutes);

  document.getElementById("log-subject-custom").value = "";
  minutesInput.value = "";
  message.textContent = "記録しました!";
  setTimeout(() => (message.textContent = ""), 2000);
}

// 設定画面の説明文を、実際のコインレート定数と一致させておく
function initCoinRateText() {
  const el = document.getElementById("settings-coin-rate");
  if (el) el.textContent = `勉強を記録すると1分につき${COIN_PER_MINUTE}コインもらえます`;
}

// ===== 初期表示 =====
initTheme();
initBgImage();
initCoinRateText();
initBoardingPassSwipe();
checkFirebaseConnection();
updateTimerDisplay();