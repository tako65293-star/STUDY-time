// ↓↓↓ ここを、Firebaseコンソールでコピーした自分のfirebaseConfigに書き換えてください ↓↓↓
const firebaseConfig = {
  apiKey: "AIzaSyBMYQo4pvLKeNf7crePtkYNY5V6EMTwSXk",
  authDomain: "study-time-8f143.firebaseapp.com",
  projectId: "study-time-8f143",
  storageBucket: "study-time-8f143.firebasestorage.app",
  messagingSenderId: "519733287330",
  appId: "1:519733287330:web:596fd4739abeec8f903afb"
};
// ↑↑↑ ここまで ↑↑↑

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();