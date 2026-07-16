import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config (same as app)
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

// DOM elements (admin UI)
const tabOrdersAdmin = document.getElementById("tab-orders-admin");
const viewOrdersAdmin = document.getElementById("view-orders-admin");
const ordersList = document.getElementById("orders-list");
const tabInventoryAdmin = document.getElementById("tab-inventory-admin");
const viewInventoryAdmin = document.getElementById("view-inventory-admin");
const stockDisplay = document.getElementById("stock-display");
const stockInput = document.getElementById("stock-input");
const btnUpdateStock = document.getElementById("btn-update-stock");
const loginScreen = document.getElementById("login-screen");
const adminApp = document.getElementById("admin-app");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");
const adminPasswordError = document.getElementById("admin-password-error");
const btnAdminLogin = document.getElementById("btn-admin-login");
const revenueAmountSpan = document.getElementById("revenue-amount");
const tabRevenueAdmin = document.getElementById("tab-revenue-admin");
const viewRevenueAdmin = document.getElementById("view-revenue-admin");

// Email/password login using Firebase Auth
btnAdminLogin.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;
  if (!email || !password) {
    adminPasswordError.textContent = "メールアドレスとパスワードを入力してください";
    adminPasswordError.style.display = "block";
    return;
  }
  adminPasswordError.style.display = "none";
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");
    // Show revenue view by default and load it
    hideAllAdminViews();
    viewRevenueAdmin.classList.remove("hidden");
    loadRevenue();
  } catch (e) {
    console.error("Auth error:", e);
    adminPasswordError.textContent = "認証に失敗しました";
    adminPasswordError.style.display = "block";
  }
});

async function loadRevenue() {
  if (!revenueAmountSpan) return;
  revenueAmountSpan.textContent = "計算中...";
  try {
    const inventoryRef = doc(db, "system", "inventory");
    const invSnap = await getDoc(inventoryRef);
    const currentStock = invSnap.exists() ? (invSnap.data().stock ?? 0) : 0;
    const n = 200 - currentStock;
    const total = n * 200;
    revenueAmountSpan.textContent = total;
  } catch (e) {
    console.error("Error loading revenue:", e);
    revenueAmountSpan.textContent = "エラー";
  }
}

// Tab handling – only one tab for now, but keep structure for future expansion
function hideAllAdminViews() {
  viewRevenueAdmin.classList.add("hidden");
  viewOrdersAdmin.classList.add("hidden");
  viewInventoryAdmin.classList.add("hidden");
}

// Admin tab management
const adminTabs = [tabRevenueAdmin, tabOrdersAdmin, tabInventoryAdmin];
function setActiveTab(tab) {
  adminTabs.forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
}

tabRevenueAdmin.addEventListener('click', () => {
  hideAllAdminViews();
  setActiveTab(tabRevenueAdmin);
  viewRevenueAdmin.classList.remove('hidden');
  loadRevenue();
});

tabOrdersAdmin.addEventListener('click', () => {
  hideAllAdminViews();
  setActiveTab(tabOrdersAdmin);
  viewOrdersAdmin.classList.remove('hidden');
  loadOrders();
});

tabInventoryAdmin.addEventListener('click', () => {
  hideAllAdminViews();
  setActiveTab(tabInventoryAdmin);
  viewInventoryAdmin.classList.remove('hidden');
  loadInventory();
});
let unsubscribeOrders = null;
// Load orders list (real‑time)
function loadOrders() {
  if (!ordersList) return;
  
  // Unsubscribe from previous listener if active to avoid duplicates
  if (unsubscribeOrders) {
    unsubscribeOrders();
  }

  const ordersRef = collection(db, "orders");
  const q = ordersRef;
  unsubscribeOrders = onSnapshot(q, (snapshot) => {
    ordersList.innerHTML = "";
    const orders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      orders.push(data);
    });
    orders.sort((a, b) => a.ticketNumber - b.ticketNumber);
    orders.forEach(order => {
      const div = document.createElement("div");
      div.className = "admin-item";
      const delivered = order.delivered ? "✅ 完了" : "⏳ 未完了";
      
      // Calculate formatted time if available
      let timeStr = "";
      if (order.createdAt && typeof order.createdAt.toDate === "function") {
        const date = order.createdAt.toDate();
        timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else {
        timeStr = "時間不明";
      }

      div.innerHTML = `
        <div class="admin-item-header">
          <span class="admin-ticket">#${String(order.ticketNumber).padStart(3, "0")}</span>
          <span class="admin-time">${timeStr}</span>
        </div>
        <div class="admin-details">
          <span>名前: ${order.name}</span>
          <span>個数: ${order.quantity}個</span>
          <span>場所: ${order.location}</span>
          <span>状態: ${delivered}</span>
        </div>
      `;

      if (!order.delivered) {
        const btn = document.createElement("button");
        btn.textContent = "完了にする";
        btn.className = "btn btn-complete";
        btn.style.marginTop = "10px";
        btn.style.padding = "10px 16px";
        btn.style.fontSize = "1rem";
        const orderDocId = order.id;
        btn.addEventListener("click", async () => {
          try {
            await updateDoc(doc(db, "orders", orderDocId), { delivered: true });
            btn.textContent = "完了済み";
            btn.disabled = true;
          } catch (e) {
            console.error("Failed to mark delivered", e);
          }
        });
        div.appendChild(btn);
      }
      ordersList.appendChild(div);
    });
  }, (err) => console.error("Orders listener error", err));
}

// Load and display current inventory
function loadInventory() {
  const inventoryRef = doc(db, "system", "inventory");
  getDoc(inventoryRef)
    .then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const stock = data.stock ?? 0;
        if (stockDisplay) stockDisplay.textContent = stock;
        if (stockInput) stockInput.value = stock;
      }
    })
    .catch((e) => {
      console.error("Error loading inventory:", e);
    });
}

// Update stock button handler
if (btnUpdateStock) {
  btnUpdateStock.addEventListener("click", async () => {
    const newStock = parseInt(stockInput.value, 10);
    if (isNaN(newStock) || newStock < 0) {
      alert("有効な在庫数を入力してください");
      return;
    }
    try {
      const inventoryRef = doc(db, "system", "inventory");
      await setDoc(inventoryRef, { stock: newStock }, { merge: true });
      stockDisplay.textContent = newStock;
    } catch (e) {
      console.error("Failed to update stock", e);
    }
  });
}

// Live stock +/- adjustment buttons
const btnStockMinus = document.getElementById("btn-stock-minus");
const btnStockPlus = document.getElementById("btn-stock-plus");

async function changeStockByAmount(amount) {
  const currentVal = parseInt(stockDisplay.textContent, 10) || 0;
  const newVal = Math.max(0, currentVal + amount);
  
  // Apply to input field and UI immediately
  stockInput.value = newVal;
  stockDisplay.textContent = newVal;

  try {
    const inventoryRef = doc(db, "system", "inventory");
    await setDoc(inventoryRef, { stock: newVal }, { merge: true });
  } catch (e) {
    console.error("Failed to dynamically update stock:", e);
    alert("在庫のリアルタイム更新に失敗しました");
  }
}

if (btnStockMinus) {
  btnStockMinus.addEventListener("click", () => changeStockByAmount(-1));
}
if (btnStockPlus) {
  btnStockPlus.addEventListener("click", () => changeStockByAmount(1));
}
