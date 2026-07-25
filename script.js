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
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
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
  renderGirlCollection();
}

// ===== かわいい女の子コレクション(累計の勉強時間が増えるほど、仲間が増えていく) =====
// ここに出てくる女の子は実在の人物・既存のキャラクターを模したものではなく、
// 色違いで生成する完全オリジナルの簡易チビキャラ(SVG)です。
const GIRL_THRESHOLDS_MIN = [15, 30, 60, 120, 180, 300, 480, 600, 900, 1200, 1800, 2400];

const GIRL_PALETTES = [
  { skin: "#ffe3d1", hair: "#3b2f2f", ribbon: "#ff8fab" },
  { skin: "#ffe9dc", hair: "#7a4b2a", ribbon: "#7ce8ff" },
  { skin: "#ffe3d1", hair: "#e8c15a", ribbon: "#b19cd9" },
  { skin: "#f7dcc6", hair: "#e07b39", ribbon: "#8fd9a8" },
  { skin: "#ffe3d1", hair: "#2c2c46", ribbon: "#ffd25a" },
  { skin: "#ffe9dc", hair: "#b56576", ribbon: "#f7a4c9" },
  { skin: "#f7dcc6", hair: "#5c4b99", ribbon: "#7ce8ff" },
  { skin: "#ffe3d1", hair: "#8f5e99", ribbon: "#ff9b9b" },
  { skin: "#ffe9dc", hair: "#4a6fa5", ribbon: "#ffd25a" },
  { skin: "#f7dcc6", hair: "#c96f6f", ribbon: "#b19cd9" },
  { skin: "#ffe3d1", hair: "#3d3d3d", ribbon: "#8fd9a8" },
  { skin: "#ffe9dc", hair: "#a15c38", ribbon: "#7ce8ff" },
];

// 自分の全期間の合計勉強時間(分)を取得する
function getMyAllTimeMinutes() {
  const myName = getCurrentUser();
  const totals = getAllTimeTotals(entries);
  const mine = totals.find((t) => t.name === myName);
  return mine ? mine.minutes : 0;
}

function girlSvg(index, unlocked) {
  const p = GIRL_PALETTES[index % GIRL_PALETTES.length];
  if (!unlocked) {
    return `
      <svg viewBox="0 0 100 100" class="girl-svg locked">
        <circle cx="50" cy="50" r="46" fill="#20232c" />
        <text x="50" y="61" font-size="32" text-anchor="middle" fill="#555b6e">?</text>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 100 100" class="girl-svg">
      <circle cx="50" cy="53" r="45" fill="${p.skin}" />
      <path d="M6 45 Q50 -8 94 45 L94 68 Q50 40 6 68 Z" fill="${p.hair}" />
      <circle cx="36" cy="55" r="4.5" fill="#2c2c46" />
      <circle cx="64" cy="55" r="4.5" fill="#2c2c46" />
      <circle cx="35" cy="67" r="5" fill="#ff9b9b" opacity="0.55" />
      <circle cx="65" cy="67" r="5" fill="#ff9b9b" opacity="0.55" />
      <path d="M42 71 Q50 77 58 71" stroke="#b5654f" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <circle cx="50" cy="17" r="7" fill="${p.ribbon}" />
    </svg>
  `;
}

function renderGirlCollection() {
  const container = document.getElementById("girl-collection-grid");
  const progressEl = document.getElementById("girl-collection-progress");
  if (!container) return;

  const totalMinutes = getMyAllTimeMinutes();
  const unlockedCount = GIRL_THRESHOLDS_MIN.filter((t) => totalMinutes >= t).length;

  container.innerHTML = GIRL_THRESHOLDS_MIN
    .map((threshold, i) => girlSvg(i, totalMinutes >= threshold))
    .join("");

  if (!progressEl) return;
  if (unlockedCount >= GIRL_THRESHOLDS_MIN.length) {
    progressEl.textContent = `全員仲間になりました!(${unlockedCount}/${GIRL_THRESHOLDS_MIN.length}人)`;
  } else {
    const next = GIRL_THRESHOLDS_MIN[unlockedCount];
    const remain = next - totalMinutes;
    progressEl.textContent =
      `あと${formatMinutes(remain)}勉強すると、新しい子が仲間になります(${unlockedCount}/${GIRL_THRESHOLDS_MIN.length}人)`;
  }
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
const POMODORO_WORK_SECONDS = 25 * 60; // 勉強25分
const POMODORO_BREAK_SECONDS = 5 * 60; // 休憩5分

let timerMode = "normal";       // "normal" または "pomodoro" または "custom"
let timerIntervalId = null;
let timerRunning = false;

let normalElapsedSeconds = 0;   // 通常タイマー: 数え上げた秒数

let customTotalSeconds = 0;     // 好きな分数タイマー: 設定した合計秒数
let customRemainingSeconds = 0; // 好きな分数タイマー: 残り秒数

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
  document.getElementById("mode-btn-custom").classList.toggle("active", mode === "custom");
  document.getElementById("timer-phase").style.display = mode === "pomodoro" ? "block" : "none";
  document.getElementById("tf-custom-minutes-row").style.display = mode === "custom" ? "block" : "none";
  resetTimerState();
  updateTimerDisplay();
}

function resetTimerState() {
  normalElapsedSeconds = 0;
  customTotalSeconds = 0;
  customRemainingSeconds = 0;
  const customInput = document.getElementById("tf-custom-minutes");
  if (customInput) customInput.disabled = false;
  pomodoroPhase = "work";
  pomodoroPhaseRemaining = POMODORO_WORK_SECONDS;
  pomodoroStudySeconds = 0;
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

function startTimer() {
  if (timerRunning) return;

  // 好きな分数タイマーは、初回スタート時だけ入力欄の値を読み込んで残り時間にする
  if (timerMode === "custom" && customRemainingSeconds <= 0) {
    const customInput = document.getElementById("tf-custom-minutes");
    const minutes = Math.max(1, Math.round(Number(customInput.value)) || 30);
    customTotalSeconds = minutes * 60;
    customRemainingSeconds = customTotalSeconds;
  }
  if (timerMode === "custom") {
    document.getElementById("tf-custom-minutes").disabled = true;
  }

  timerRunning = true;
  document.getElementById("timer-start-btn").disabled = true;
  document.getElementById("timer-pause-btn").disabled = false;

  timerIntervalId = setInterval(() => {
    if (timerMode === "normal") {
      normalElapsedSeconds++;
    } else if (timerMode === "custom") {
      customRemainingSeconds--;
      if (customRemainingSeconds <= 0) {
        customRemainingSeconds = 0;
        pauseTimer();
        updateTimerDisplay();
        alert("タイマー終了!お疲れさま!");
        return;
      }
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