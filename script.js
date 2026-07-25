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
const USERNAME_KEY = "studyAppUsername"; // 自分の名前は端末ごとにlocalStorageで管理
const COLLECTION_NAME = "studyEntries";  // Firestore上のデータの置き場所の名前

// 今、アプリが持っている全員分の記録(Firestoreから自動で更新される)
let entries = [];

// 自分の名前を取得する(未登録ならnullを返す)
function getCurrentUser() {
  return localStorage.getItem(USERNAME_KEY);
}

function setCurrentUser(name) {
  localStorage.setItem(USERNAME_KEY, name);
}

function todayOffset(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ===== Firestoreとのやりとり =====

// 新しい記録をクラウドに追加する
function addEntry(name, subject, minutes) {
  db.collection(COLLECTION_NAME).add({
    name: name || getCurrentUser(),
    subject: subject,
    minutes: minutes,
    date: todayOffset(0),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
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
      entries = snapshot.docs.map((doc) => doc.data());
      renderAll();
    },
    (error) => {
      console.error("データの取得に失敗しました:", error);
    }
  );
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

  return Object.entries(totals)
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
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
  document.querySelector(`.tab-btn[data-view="${viewName}"]`).classList.add("active");

  renderAll();
}

// ===== 画面描画 =====
function renderHome() {
  const myName = getCurrentUser();
  const weekly = getWeeklyTotals(entries);

  document.getElementById("home-username").textContent = `${myName} さん`;
  document.getElementById("home-today-minutes").textContent =
    formatMinutes(getTodayTotalFor(entries, myName));
  document.getElementById("home-streak").textContent =
    `${getStreak(entries, myName)}日`;

  const myRankIndex = weekly.findIndex((r) => r.name === myName);
  document.getElementById("home-rank").textContent =
    myRankIndex === -1 ? "-" : `${myRankIndex + 1}位`;

  renderRankingList(document.getElementById("home-ranking-preview"), weekly.slice(0, 3));
}

function renderRankingList(container, list) {
  container.innerHTML = "";
  if (list.length === 0) {
    container.innerHTML = `<p class="empty">まだ記録がありません</p>`;
    return;
  }
  list.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "rank-row" + (i === 0 ? " top1" : "");
    row.innerHTML = `
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${r.name}</span>
      <span class="rank-time">${formatMinutes(r.minutes)}</span>
    `;
    container.appendChild(row);
  });
}

function renderRankingScreen() {
  const myName = getCurrentUser();
  const weekly = getWeeklyTotals(entries);
  renderRankingList(document.getElementById("ranking-list"), weekly);

  const myRankIndex = weekly.findIndex((r) => r.name === myName);
  document.getElementById("ranking-my-rank").textContent =
    myRankIndex === -1 ? "-" : `${myRankIndex + 1}位`;
}

function renderLogScreen() {
  const today = todayOffset(0);
  const todayEntries = entries.filter((e) => e.date === today);

  const list = document.getElementById("log-today-list");
  list.innerHTML = "";
  if (todayEntries.length === 0) {
    list.innerHTML = `<p class="empty">今日はまだ記録がありません</p>`;
  } else {
    todayEntries.forEach((e) => {
      const row = document.createElement("div");
      row.className = "log-entry";
      row.innerHTML = `
        <span>${e.name} / ${e.subject} ${e.minutes}分</span>
        <span class="status">完了</span>
      `;
      list.appendChild(row);
    });
  }

  // 名前の候補(datalist)を、みんなの記録から作る(友達の名前も出てくる)
  const nameList = document.getElementById("name-list");
  const uniqueNames = [...new Set(entries.map((e) => e.name))];
  nameList.innerHTML = uniqueNames.map((n) => `<option value="${n}">`).join("");
}

function renderAll() {
  renderHome();
  renderRankingScreen();
  renderLogScreen();
}

// ===== アカウント作成(初回のみ、端末ごと) =====
function handleCreateAccount() {
  const nameInput = document.getElementById("setup-name");
  const message = document.getElementById("setup-message");
  const name = nameInput.value.trim();

  if (!name) {
    message.textContent = "名前を入力してください";
    return;
  }

  setCurrentUser(name);
  goToMainApp();
}

// セットアップ画面を隠して、タブバーを表示し、クラウドの監視を開始してホーム画面へ
function goToMainApp() {
  document.getElementById("tabbar").style.display = "flex";
  startListening();
  showView("home");
}

// ===== 初期表示の出し分け =====
function initApp() {
  const myName = getCurrentUser();

  if (!myName) {
    document.getElementById("tabbar").style.display = "none";
    document.getElementById("view-setup").classList.add("active");
    document.getElementById("view-home").classList.remove("active");
  } else {
    goToMainApp();
  }
}

// ===== ボタン処理 =====
function handleAddEntry() {
  const nameInput = document.getElementById("log-name");
  const subjectInput = document.getElementById("log-subject");
  const minutesInput = document.getElementById("log-minutes");
  const message = document.getElementById("log-message");

  const name = nameInput.value.trim() || getCurrentUser();
  const subject = subjectInput.value.trim();
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

  subjectInput.value = "";
  minutesInput.value = "";
  message.textContent = "記録しました!";
  setTimeout(() => (message.textContent = ""), 2000);
}

// ===== 初期表示 =====
checkFirebaseConnection();
initApp();