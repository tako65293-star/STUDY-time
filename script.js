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
          map[data.name] = { photo: data.photo || null, uid: doc.id };
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
  const ok = confirm("この記録を削除しますか?");
  if (!ok) return;

  db.collection(COLLECTION_NAME).doc(entryId).delete().catch((error) => {
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

  // 図鑑画面を開いたときは、最新の到達状況で一覧を作り直す
  if (viewName === "gallery") {
    renderGallery();
  }

  // 設定画面を開いたときは、今の表示名・写真を入れておく
  if (viewName === "settings") {
    document.getElementById("settings-name").value = getCurrentUser() || "";
    setAvatarElement(document.getElementById("settings-photo-preview"), getCurrentUser(), currentUserPhoto);
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
}

function renderAll() {
  updateDailyTopNames();
  renderHome();
  renderRankingScreen();
  renderLogScreen();
  renderTodoList();
  renderGirlGrowth();
}

// ===== 育成: ひとりの女の子が、累計の勉強時間に応じてどんどん可愛く成長していく =====
// 実在の人物や既存作品のキャラクターを模したものではなく、完全オリジナルのイラストです。
// レベル1は地味な見た目からスタートし、レベルが上がるほど髪型・服装・きらきら演出が
// どんどん華やかになっていきます。
// 12段階・約2週間(1日あたり2〜3時間ペースを想定)で最大レベルに届くように調整。
// 累計「分」の閾値: レベル1(0分)〜レベル12(2100分=35時間 ≒ 1日2.5時間×14日)
const GROWTH_THRESHOLDS_MIN = [0, 40, 90, 180, 300, 450, 650, 900, 1200, 1550, 1850, 2100];
const GROWTH_MAX_LEVEL = GROWTH_THRESHOLDS_MIN.length;

// 累計の勉強時間(分)から、今のレベル(1〜GROWTH_MAX_LEVEL)を出す
function getGrowthLevel(totalMinutes) {
  let level = 1;
  for (let i = 1; i < GROWTH_THRESHOLDS_MIN.length; i++) {
    if (totalMinutes >= GROWTH_THRESHOLDS_MIN[i]) level = i + 1;
  }
  return level;
}

// 現在のレベル内での進み具合(0〜1)や、次のレベルまでの残り時間、
// モザイクの強さ(px)をまとめて計算する。
// ・レベルに切り替わった直後(進み具合0)は少しモザイクがかかった状態でスタート
// ・そのレベルの中で75%(3/4)進んだ時点でモザイクが完全になくなる
function getLevelProgress(totalMinutes) {
  const level = getGrowthLevel(totalMinutes);
  const isMax = level >= GROWTH_MAX_LEVEL;
  const start = GROWTH_THRESHOLDS_MIN[level - 1];
  const end = isMax ? start : GROWTH_THRESHOLDS_MIN[level];
  const span = isMax ? 1 : Math.max(end - start, 1);
  const ratio = isMax ? 1 : Math.min(Math.max((totalMinutes - start) / span, 0), 1);

  const MOSAIC_CLEAR_AT = 0.75; // この割合まで進むとモザイクが消える
  const MAX_BLUR_PX = 8;
  const blurPx = isMax ? 0 : Math.max(0, MAX_BLUR_PX * (1 - ratio / MOSAIC_CLEAR_AT));

  const remainMinutes = isMax ? 0 : Math.max(end - totalMinutes, 0);

  return { level, isMax, start, end, ratio, blurPx, remainMinutes };
}

// 自分の全期間の合計勉強時間(分)を取得する
function getMyAllTimeMinutes() {
  const myName = getCurrentUser();
  const totals = getAllTimeTotals(entries);
  const mine = totals.find((t) => t.name === myName);
  return mine ? mine.minutes : 0;
}

// レベルごとの見た目パラメータ(0=最初 〜 1=最大、で徐々に華やかにしていく)
function getGrowthStageParams(level) {
  const t = (level - 1) / (GROWTH_MAX_LEVEL - 1);
  const hairColors = ["#8a8a8a", "#a9835c", "#caa06a", "#e0a96d", "#c96f6f", "#e07b39",
    "#ffd25a", "#f7a4c9", "#b19cd9", "#7ce8ff", "#ff8fab", "#ffb6de", "#ffdfef"];
  const dressColors = ["#9aa0ab", "#8fbfae", "#8fd9a8", "#7ce8ff", "#a4c9ff", "#b19cd9",
    "#d29be0", "#f7a4c9", "#ff9b9b", "#ff8fab", "#ffd25a", "#ffe9a8", "#fff0d0"];

  return {
    level,
    t,
    hair: hairColors[level - 1] || hairColors[hairColors.length - 1],
    dress: dressColors[level - 1] || dressColors[dressColors.length - 1],
    hairLong: t > 0.3,
    hasRibbon: t > 0.15,
    hasFrills: t > 0.45,
    hasCrown: t > 0.8,
    sparkles: Math.round(t * 6),
    eyeSize: 6 + t * 4.5,
    blushOpacity: 0.25 + t * 0.45,
  };
}

// 全身の女の子SVGを組み立てる(頭・髪・服・腕脚・キラキラをレベルに応じて変化させる)
function girlFullBodySvg(level) {
  const p = getGrowthStageParams(level);
  const skin = "#ffe3d1";

  const backHair = p.hairLong
    ? `<path d="M40 70 Q100 -20 160 70 L168 230 Q140 210 100 220 Q60 210 32 230 Z" fill="${p.hair}" />`
    : `<path d="M46 72 Q100 10 154 72 L158 108 Q100 94 42 108 Z" fill="${p.hair}" />`;

  const frontHair = `<path d="M44 78 Q100 40 156 78 Q150 58 100 54 Q50 58 44 78 Z" fill="${p.hair}" />`;

  const ribbon = p.hasRibbon
    ? `<circle cx="138" cy="50" r="7" fill="${p.dress}" /><circle cx="138" cy="50" r="3" fill="#fff" opacity="0.6"/>`
    : "";

  const crown = p.hasCrown
    ? `<path d="M78 34 L84 18 L92 32 L100 14 L108 32 L116 18 L122 34 Z" fill="#ffd25a" stroke="#e0a96d" stroke-width="1.5" stroke-linejoin="round" />`
    : "";

  const dressBase = `<path d="M70 116 Q100 108 130 116 L146 250 Q100 262 54 250 Z" fill="${p.dress}" />`;

  const frills = p.hasFrills
    ? `<path d="M54 250 Q77 240 100 250 Q123 240 146 250 Q123 262 100 258 Q77 262 54 250 Z" fill="${p.dress}" opacity="0.9" />
       <rect x="90" y="150" width="20" height="10" rx="3" fill="#fff" opacity="0.65" />`
    : "";

  const limbs = `
    <path d="M70 120 Q54 150 60 190" stroke="${skin}" stroke-width="12" fill="none" stroke-linecap="round" />
    <path d="M130 120 Q146 150 140 190" stroke="${skin}" stroke-width="12" fill="none" stroke-linecap="round" />
    <rect x="78" y="250" width="16" height="40" rx="6" fill="${skin}" />
    <rect x="106" y="250" width="16" height="40" rx="6" fill="${skin}" />
    <ellipse cx="86" cy="292" rx="12" ry="7" fill="#3d3d3d" />
    <ellipse cx="114" cy="292" rx="12" ry="7" fill="#3d3d3d" />
  `;

  const eyeHighlight = p.eyeSize * 0.32;
  const face = `
    <circle cx="100" cy="80" r="44" fill="${skin}" />
    <circle cx="82" cy="82" r="${p.eyeSize}" fill="#2c2c46" />
    <circle cx="118" cy="82" r="${p.eyeSize}" fill="#2c2c46" />
    <circle cx="${82 - eyeHighlight}" cy="${82 - eyeHighlight}" r="${eyeHighlight}" fill="#fff" />
    <circle cx="${118 - eyeHighlight}" cy="${82 - eyeHighlight}" r="${eyeHighlight}" fill="#fff" />
    <circle cx="76" cy="96" r="6" fill="#ff9b9b" opacity="${p.blushOpacity}" />
    <circle cx="124" cy="96" r="6" fill="#ff9b9b" opacity="${p.blushOpacity}" />
    <path d="M90 100 Q100 106 110 100" stroke="#b5654f" stroke-width="2.5" fill="none" stroke-linecap="round" />
  `;

  let sparkles = "";
  for (let i = 0; i < p.sparkles; i++) {
    const angle = (i / Math.max(p.sparkles, 1)) * Math.PI * 2;
    const cx = 100 + Math.cos(angle) * 92;
    const cy = 150 + Math.sin(angle) * 110;
    sparkles += `<text x="${cx}" y="${cy}" font-size="14" fill="#ffe9a8" opacity="0.85">✦</text>`;
  }

  return `
    <svg viewBox="0 0 200 320" class="girl-full-svg">
      ${sparkles}
      ${backHair}
      ${limbs}
      ${dressBase}
      ${frills}
      ${frontHair}
      ${face}
      ${ribbon}
      ${crown}
    </svg>
  `;
}

// ===== 画像の差し込み用設定 =====
// 一番手軽な方法: 下のGROWTH_IMAGE_URLSに、画像の「URL」を直接貼るだけでOKです。
// (GitHubにフォルダを作ったり、ファイルをアップロードしたりする必要はありません)
//
// 画像の用意のしかた(どれでもOK):
//  ・Imgurなど画像置き場にアップロードして、「画像のURLをコピー」したものを貼る
//  ・Googleドライブなら「共有リンク」を直接リンク形式に変換したものを貼る
//  ・Discordのチャンネルに画像を送って、そのURLをコピーして貼る
//
// 空文字("")のままのレベルは、今まで通りSVGのイラストが表示されます。
const GROWTH_IMAGE_URLS = {
  1: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_1838.JPG",
  2: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7203.JPG",
  3: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7213.JPG",
  4: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7205.JPG",
  5: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7212.JPG",
  6: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7204.JPG",
  7: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7202.JPG",
  8: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7201.JPG",
  9: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7206.JPG",
  10: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7209.JPG",
  11: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7211.JPG",
  12: "https://raw.githubusercontent.com/tako65293-star/STUDY-time/5eb86af93ed360edcd542969c3783b2e23d98cce/IMG_7214.JPG"
};

// (上級者向け)リポジトリ内にimages/growthフォルダを作ってファイルを置く場合はこちら
const GROWTH_IMAGE_DIR = "images/growth";
const GROWTH_IMAGE_EXT = "png"; // png / jpg / webp などに変更可

function growthImagePath(level) {
  const url = GROWTH_IMAGE_URLS[level];
  if (url) return url; // URLが指定されていればそれを最優先で使う
  return `${GROWTH_IMAGE_DIR}/level-${level}.${GROWTH_IMAGE_EXT}`;
}

// 画像があればそれを表示し、無ければ(読み込みエラーになったら)SVGにフォールバックする
// blurPx が指定されていれば、画像にモザイク(ぼかし)をかけて表示する
function girlStageMarkup(level, blurPx = 0) {
  const imgSrc = growthImagePath(level);
  const svg = girlFullBodySvg(level);
  const blurStyle = blurPx > 0 ? ` style="filter: blur(${blurPx.toFixed(1)}px); transition: filter 0.6s ease;"` : ` style="transition: filter 0.6s ease;"`;
  return `
    <div class="girl-stage-inner">
      <img src="${imgSrc}" alt="レベル${level}の女の子" class="girl-photo"${blurStyle}
           onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
      <div class="girl-svg-fallback">${svg}</div>
    </div>
  `;
}

// 次のレベルまでの残り時間を、時間単位＆「1日2〜3時間ペースなら何日」の目安に変換
function formatRemainingToNext(remainMinutes) {
  const hours = remainMinutes / 60;
  const hoursText = hours >= 1 ? `${hours.toFixed(1)}時間` : `${remainMinutes}分`;
  // 1日2.5時間ペース想定での目安日数
  const daysAtPace = Math.max(1, Math.ceil(hours / 2.5));
  return `${hoursText}(1日2〜3時間なら目安${daysAtPace}日)`;
}

function renderGirlGrowth() {
  const totalMinutes = getMyAllTimeMinutes();
  const progress = getLevelProgress(totalMinutes);
  const level = progress.level;
  const markup = girlStageMarkup(level, progress.blurPx);

  const stage = document.getElementById("girl-grow-stage");
  if (stage) stage.innerHTML = markup;

  const homePreview = document.getElementById("girl-home-preview");
  if (homePreview) homePreview.innerHTML = markup;

  document.querySelectorAll(".girl-level-label").forEach((el) => {
    el.textContent = `レベル ${level} / ${GROWTH_MAX_LEVEL}`;
  });

  // 次のレベルまでの進捗バー(視覚的に一目でわかるように)
  const barPercent = Math.round(progress.ratio * 100);
  const progressBarHtml = `
    <div class="girl-progress-bar-track" aria-hidden="true">
      <div class="girl-progress-bar-fill" style="width: ${barPercent}%;"></div>
    </div>
  `;

  const progressEl = document.getElementById("girl-grow-progress");
  if (progressEl) {
    if (progress.isMax) {
      progressEl.innerHTML = `${progressBarHtml}<span>最大レベルに到達しました!これからもずっと一緒に頑張ろう</span>`;
    } else {
      progressEl.innerHTML = `${progressBarHtml}<span>次のレベルまで あと${formatRemainingToNext(progress.remainMinutes)}(進捗${barPercent}%)</span>`;
    }
  }
}

// ===== 図鑑: 今まで到達したレベルの画像を一覧表示する =====
function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  const summary = document.getElementById("gallery-summary");
  if (!grid) return;

  const totalMinutes = getMyAllTimeMinutes();
  const reachedLevel = getGrowthLevel(totalMinutes);

  if (summary) {
    summary.textContent = `レベル1〜${reachedLevel}(全${GROWTH_MAX_LEVEL}段階中)を解放済み`;
  }

  let html = "";
  for (let level = 1; level <= reachedLevel; level++) {
    const imgSrc = growthImagePath(level);
    html += `
      <button type="button" class="gallery-item" onclick="openGalleryViewer(${level})">
        <img src="${imgSrc}" alt="レベル${level}の画像" class="gallery-thumb"
             onerror="this.closest('.gallery-item').style.display='none';">
        <span class="gallery-item-label">Lv.${level}</span>
      </button>
    `;
  }
  grid.innerHTML = html || `<p class="sub">まだ画像はありません。勉強を記録してレベルアップしよう!</p>`;
}

// 図鑑のサムネイルをタップしたときに、大きく表示する
function openGalleryViewer(level) {
  const imgSrc = growthImagePath(level);
  const viewer = document.getElementById("gallery-viewer");
  const viewerImg = document.getElementById("gallery-viewer-img");
  const viewerLabel = document.getElementById("gallery-viewer-label");
  if (!viewer || !viewerImg) return;
  viewerImg.src = imgSrc;
  if (viewerLabel) viewerLabel.textContent = `レベル ${level}`;
  viewer.classList.add("open");
}

function closeGalleryViewer() {
  const viewer = document.getElementById("gallery-viewer");
  if (viewer) viewer.classList.remove("open");
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
  const saved = localStorage.getItem(THEME_KEY) || "neon";
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

// ===== 初期表示 =====
initTheme();
initBgImage();
checkFirebaseConnection();
updateTimerDisplay();