import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  getDoc,
  updateDoc,
  runTransaction,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCm_0NlWGzuzpOjY2bDreyQCcfwA-1y5Vw",
  authDomain: "festival-b86ed.firebaseapp.com",
  projectId: "festival-b86ed",
  storageBucket: "festival-b86ed.firebasestorage.app",
  messagingSenderId: "894749507915",
  appId: "1:894749507915:web:ec6cad2bc47131358d68ce",
  measurementId: "G-SS7Y58CG6L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const loginContainer = document.getElementById("login-container");
const adminContainer = document.getElementById("admin-container");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const loginError = document.getElementById("login-error");
const adminList = document.getElementById("admin-list");
const loading = document.getElementById("loading");

let unsubscribeSnapshot = null; // スナップショットの解除用

// ログイン処理
btnLogin.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if (!email || !password) {
    loginError.textContent = "メールアドレスとパスワードを入力してください。";
    loginError.style.display = "block";
    return;
  }

  loading.classList.remove("hidden");
  loginError.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login error: ", error);
    loginError.textContent = "ログインに失敗しました。メールアドレスまたはパスワードが正しくありません。";
    loginError.style.display = "block";
  } finally {
    loading.classList.add("hidden");
  }
});

// ログアウト処理
btnLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error: ", error);
    alert("ログアウトに失敗しました。");
  }
});

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginContainer.style.display = "none";
    adminContainer.style.display = "block";
    emailInput.value = "";
    passwordInput.value = "";
    loginError.style.display = "none";
    initAdmin();
  } else {
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

  // 在庫リアルタイム表示
  const inventoryRef = doc(db, "system", "inventory");
  onSnapshot(inventoryRef, (snap) => {
    const stock = snap.data()?.stock ?? 0;
    const adminStockDiv = document.getElementById("admin-stock");
    if (adminStockDiv) adminStockDiv.textContent = `在庫: ${stock}`;
  });

  // 在庫リセット・更新ボタンのハンドラ
  const resetBtn = document.getElementById("reset-stock-btn");
  const updateBtn = document.getElementById("update-stock-btn");
  const stockInput = document.getElementById("stock-input");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
        if (!resetBtn.dataset.confirmed) {
          if (!confirm("在庫を200にリセットしますか？")) return;
          resetBtn.dataset.confirmed = "true";
          alert("再度クリックするとリセットが実行されます");
          return;
        }
        loading.classList.remove("hidden");
        try {
          await updateDoc(inventoryRef, { stock: 200 });
        } catch (e) {
          console.error("在庫リセット失敗", e);
          alert("在庫リセットに失敗しました。");
        } finally {
          loading.classList.add("hidden");
          delete resetBtn.dataset.confirmed;
        }
      });
  }
  if (updateBtn) {
    updateBtn.addEventListener("click", async () => {
      const newStock = parseInt(stockInput.value, 10);
      if (isNaN(newStock) || newStock < 0) {
        alert("有効な在庫数を入力してください。");
        return;
      }
      loading.classList.remove("hidden");
      try {
        await updateDoc(inventoryRef, { stock: newStock });
      } catch (e) {
        console.error("在庫更新失敗", e);
        alert("在庫更新に失敗しました。");
      } finally {
        loading.classList.add("hidden");
      }
    });
  }
  // 在庫を-1減らすボタンハンドラ
const decrementBtn = document.getElementById("decrement-stock-btn");
if (decrementBtn) {
  decrementBtn.addEventListener("click", async () => {
    loading.classList.remove("hidden");
    try {
      await runTransaction(db, async (transaction) => {
        const invRef = doc(db, "system", "inventory");
        const invSnap = await transaction.get(invRef);
        const curStock = invSnap.data()?.stock ?? 0;
        if (curStock <= 0) {
          throw new Error("在庫がありません");
        }
        transaction.update(invRef, { stock: curStock - 1 });
      });
    } catch (e) {
      console.error("在庫減少失敗", e);
      alert("在庫を減らすことができませんでした");
    } finally {
      loading.classList.add("hidden");
    }
  });
}


  const q = query(collection(db, "orders"), where("delivered", "==", false));
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
