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

// 全期間の合計時間(累計ランキング用)
function getAllTimeTotals(list) {
  const totals = {};
  list.forEach((e) => {
    totals[e.name] = (totals[e.name] || 0) + Number(e.minutes);
  });

  return Object.entries(totals)
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

  // 設定画面を開いたときは、今の表示名を入れておく
  if (viewName === "settings") {
    document.getElementById("settings-name").value = getCurrentUser() || "";
  }

  renderAll();
}

// ===== 画面描画 =====
function renderHome() {
  const myName = getCurrentUser();
  const weekly = withRanks(getWeeklyTotals(entries));

  document.getElementById("home-username").textContent = `${myName} さん`;
  document.getElementById("home-today-minutes").textContent =
    formatMinutes(getTodayTotalFor(entries, myName));
  document.getElementById("home-streak").textContent =
    `${getStreak(entries, myName)}日`;

  const myRankItem = weekly.find((r) => r.name === myName);
  document.getElementById("home-rank").textContent =
    myRankItem ? `${myRankItem.rank}位` : "-";

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
    row.innerHTML = `
      <span class="rank-num">${r.rank}</span>
      <span class="rank-name">${r.name}</span>
      <span class="rank-time">${formatMinutes(r.minutes)}</span>
    `;
    container.appendChild(row);
  });
}

// ===== ランキングの期間切り替え(今週 / 累計) =====
let rankingPeriod = "weekly"; // "weekly" または "alltime"

function setRankingPeriod(period) {
  rankingPeriod = period;
  document.getElementById("ranking-btn-weekly").classList.toggle("active", period === "weekly");
  document.getElementById("ranking-btn-alltime").classList.toggle("active", period === "alltime");
  renderRankingScreen();
}

function renderRankingScreen() {
  const myName = getCurrentUser();
  const totals = rankingPeriod === "alltime" ? getAllTimeTotals(entries) : getWeeklyTotals(entries);
  const ranked = withRanks(totals);
  renderRankingList(document.getElementById("ranking-list"), ranked);

  const myRankItem = ranked.find((r) => r.name === myName);
  document.getElementById("ranking-my-rank").textContent =
    myRankItem ? `${myRankItem.rank}位` : "-";
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

// ===== 科目選択(9教科 + その他) =====
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

// ===== タイマー / ポモドーロ =====
const POMODORO_WORK_SECONDS = 25 * 60; // 勉強25分
const POMODORO_BREAK_SECONDS = 5 * 60; // 休憩5分

let timerMode = "normal";       // "normal" または "pomodoro"
let timerIntervalId = null;
let timerRunning = false;

let normalElapsedSeconds = 0;   // 通常タイマー: 数え上げた秒数

let pomodoroPhase = "work";     // "work" または "break"
let pomodoroPhaseRemaining = POMODORO_WORK_SECONDS; // フェーズの残り秒数
let pomodoroStudySeconds = 0;   // ポモドーロで貯まった「勉強した秒数」の合計

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
  document.getElementById("timer-phase").style.display = mode === "pomodoro" ? "block" : "none";
  resetTimerState();
  updateTimerDisplay();
}

function resetTimerState() {
  normalElapsedSeconds = 0;
  pomodoroPhase = "work";
  pomodoroPhaseRemaining = POMODORO_WORK_SECONDS;
  pomodoroStudySeconds = 0;
}

function updateTimerDisplay() {
  const display = document.getElementById("timer-display");
  const phaseLabel = document.getElementById("timer-phase");

  if (timerMode === "normal") {
    display.textContent = formatClock(normalElapsedSeconds);
  } else {
    display.textContent = formatClock(pomodoroPhaseRemaining);
    phaseLabel.textContent = pomodoroPhase === "work" ? "勉強タイム 🔥" : "休憩タイム ☕";
  }
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  document.getElementById("timer-start-btn").disabled = true;
  document.getElementById("timer-pause-btn").disabled = false;

  timerIntervalId = setInterval(() => {
    if (timerMode === "normal") {
      normalElapsedSeconds++;
    } else {
      pomodoroPhaseRemaining--;
      if (pomodoroPhaseRemaining <= 0) {
        if (pomodoroPhase === "work") {
          pomodoroStudySeconds += POMODORO_WORK_SECONDS;
          pomodoroPhase = "break";
          pomodoroPhaseRemaining = POMODORO_BREAK_SECONDS;
          alert("お疲れさま!5分休憩しよう ☕");
        } else {
          pomodoroPhase = "work";
          pomodoroPhaseRemaining = POMODORO_WORK_SECONDS;
          alert("休憩終わり!また25分がんばろう 🔥");
        }
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  if (!timerRunning) return;
  clearInterval(timerIntervalId);
  timerRunning = false;
  document.getElementById("timer-start-btn").disabled = false;
  document.getElementById("timer-pause-btn").disabled = true;
}

// タイマーを止めて、勉強した分数を「勉強時間(分)」欄に自動で入れる
function stopAndRecordTimer() {
  pauseTimer();

  let totalSeconds = 0;
  if (timerMode === "normal") {
    totalSeconds = normalElapsedSeconds;
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

  resetTimerState();
  updateTimerDisplay();
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

// ===== アカウント設定 =====
function handleSaveSettings() {
  const nameInput = document.getElementById("settings-name");
  const message = document.getElementById("settings-message");
  const newName = nameInput.value.trim();

  if (!newName) {
    message.textContent = "名前を入力してください";
    return;
  }

  setCurrentUser(newName);
  message.textContent = "保存しました!(これから記録する分から新しい名前になります)";
  renderAll();
  setTimeout(() => (message.textContent = ""), 3000);
}

function handleResetAccount() {
  const ok = confirm("アカウントをリセットすると、この端末に保存されている自分の名前の情報が消えます。よろしいですか?");
  if (!ok) return;

  localStorage.removeItem(USERNAME_KEY);
  location.reload();
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

// ===== 初期表示 =====
checkFirebaseConnection();
initApp();
updateTimerDisplay();