import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7Ab9QcA8CciCKrzWJpV9F__XXJqBADw0",
  authDomain: "test-3f04d.firebaseapp.com",
  databaseURL: "https://test-3f04d-default-rtdb.firebaseio.com",
  projectId: "test-3f04d",
  storageBucket: "test-3f04d.firebasestorage.app",
  messagingSenderId: "938184184938",
  appId: "1:938184184938:web:fe9bee160e6f361c322613",
  measurementId: "G-4T0XZ9SBSX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "nyokki0371@gmail.com";

// DOM Elements
const loginContainer = document.getElementById("login-container");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const adminContainer = document.getElementById("admin-container");
const adminList = document.getElementById("admin-list");
const loading = document.getElementById("loading");

let unsubscribeSnapshot = null; // スナップショットの解除用

// ログイン・ログアウト処理
btnLogin.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    alert("ログインエラー: " + error.message);
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
  if (user && user.email === ADMIN_EMAIL) {
    loginContainer.style.display = "none";
    adminContainer.style.display = "block";
    initAdmin();
  } else {
    if (user) {
      alert("このアカウントには管理者権限がありません。");
      signOut(auth);
    }
    loginContainer.style.display = "block";
    adminContainer.style.display = "none";
    
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
    adminList.innerHTML = "";
  }
});

// 管理画面の初期化とデータ同期
function initAdmin() {
  if (unsubscribeSnapshot) return; // すでに初期化済みの場合はスキップ
  const q = query(
    collection(db, "orders"),
    where("delivered", "==", false)
  );

  unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
    adminList.innerHTML = "";

    if (snapshot.empty) {
      adminList.innerHTML = "<p style='text-align:center;color:#888;font-size:1.2rem;padding:20px;'>現在未配達の注文はありません。</p>";
      return;
    }

    let orders = [];
    snapshot.forEach((documentSnapshot) => {
      orders.push({
        id: documentSnapshot.id,
        data: documentSnapshot.data()
      });
    });

    // createdAtでソート (昇順)
    orders.sort((a, b) => {
      const timeA = a.data.createdAt ? a.data.createdAt.toMillis() : 0;
      const timeB = b.data.createdAt ? b.data.createdAt.toMillis() : 0;
      return timeA - timeB;
    });

    orders.forEach((order) => {
      const data = order.data;
      const id = order.id;
      const ticketNumStr = String(data.ticketNumber).padStart(4, "0");
      
      // 注文時間のフォーマット
      let timeStr = "時間不明";
      if (data.createdAt) {
        const date = data.createdAt.toDate();
        const h = String(date.getHours()).padStart(2, "0");
        const m = String(date.getMinutes()).padStart(2, "0");
        timeStr = `${h}:${m}`;
      }

      const div = document.createElement("div");
      div.className = "admin-item";

      div.innerHTML = `
        <div class="admin-item-header">
          <div class="admin-ticket">整理券: ${ticketNumStr}</div>
          <div class="admin-time">${timeStr}</div>
        </div>
        <div class="admin-details">
          <span>名前: <strong>${data.name}</strong></span>
          <span>場所: <strong>${data.location}</strong></span>
          <span>個数: <strong>${data.quantity}</strong></span>
        </div>
        <button class="btn btn-complete" data-id="${id}">配達完了</button>
      `;

      adminList.appendChild(div);
    });

    // 配達完了ボタンのイベントリスナー設定
    const completeBtns = document.querySelectorAll(".btn-complete");
    completeBtns.forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const orderId = e.target.getAttribute("data-id");
        if(confirm("配達完了にしますか？")) {
          loading.classList.remove("hidden");
          try {
            await updateDoc(doc(db, "orders", orderId), {
              delivered: true
            });
          } catch (error) {
            console.error("Error updating document: ", error);
            alert("更新に失敗しました。");
          } finally {
            loading.classList.add("hidden");
          }
        }
      });
    });
  });
}
