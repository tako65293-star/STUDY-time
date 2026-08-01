// STUDY-time 用の簡易サービスワーカー
// 目的: ホーム画面に追加したとき、アプリの外側(HTML/CSS/JS)だけを
// キャッシュしておき、電波が悪い/オフラインでも真っ白にならず開けるようにする。
// 勉強記録やランキングなどのデータはFirestore経由なので、通信がない間は
// 最新情報には更新されません(その点はご了承ください)。

const CACHE_NAME = "study-time-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./game.js",
  "./firebase-config.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Firebase(Firestore/Auth)へのリクエストは素通し(常に最新のネットワークを使う)
  if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("googleapis.com")) {
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});