import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, set, get, child, push, remove, update } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCIVtRcMXG1fvsJycs1nvgyNrc2kkEjgKQ",
  authDomain: "baly-tracker.firebaseapp.com",
  databaseURL: "https://baly-tracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "baly-tracker",
  storageBucket: "baly-tracker.firebasestorage.app",
  messagingSenderId: "769210453494",
  appId: "1:769210453494:web:89ccc1f8b87c5a02944bd7",
  measurementId: "G-QCKLEXSJYZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/** تحويل بيانات Firebase إلى مصفوفة يسهل التعامل معها */
function toArray(snapshot) {
  const data = snapshot.val();
  if (!data) return [];
  return Object.keys(data).map(key => ({ id: key, ...data[key] }));
}

export const Database = {
  async init() {
    console.log("🔥 Firebase Realtime Database Initialized!");
  },

  // ── TRIPS ──────────────────────────────────────
  async addTrip(data) {
    const newRef = push(ref(db, 'trips'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },

  async getTrip(id) {
    const snap = await get(child(ref(db), `trips/${id}`));
    return snap.val() ? { id, ...snap.val() } : null;
  },

  async getTripsByDate(dateKey) {
    const all = await this.getAllTrips();
    return all.filter(t => t.date === dateKey);
  },

  async getAllTrips() {
    const snap = await get(ref(db, 'trips'));
    return toArray(snap);
  },

  async updateTrip(trip) {
    const { id, ...data } = trip;
    await update(ref(db, `trips/${id}`), data);
    return trip;
  },

  async deleteTrip(id) {
    await remove(ref(db, `trips/${id}`));
  },

  // ── EXPENSES ───────────────────────────────────
  async addExpense(data) {
    const newRef = push(ref(db, 'expenses'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },

  async getExpensesByDate(dateKey) {
    const all = await this.getAllExpenses();
    return all.filter(e => e.date === dateKey);
  },

  async getAllExpenses() {
    const snap = await get(ref(db, 'expenses'));
    return toArray(snap);
  },

  async deleteExpense(id) {
    await remove(ref(db, `expenses/${id}`));
  },

  // ── TRANSFERS (زين كاش) ────────────────────────
  async addTransfer(data) {
    const newRef = push(ref(db, 'transfers'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },

  async getTransfersByDate(dateKey) {
    const all = await this.getAllTransfers();
    return all.filter(t => t.date === dateKey);
  },

  async getAllTransfers() {
    const snap = await get(ref(db, 'transfers'));
    return toArray(snap);
  },

  async deleteTransfer(id) {
    await remove(ref(db, `transfers/${id}`));
  },

  // ── SETTINGS ───────────────────────────────────
  async getSetting(key) {
    const snap = await get(child(ref(db), `settings/${key}`));
    return snap.val();
  },

  async setSetting(key, value) {
    await set(ref(db, `settings/${key}`), value);
  },

  // ── WALLET (ENVELOPES & TRANSACTIONS) ────────
  async getAllEnvelopes() {
    const snap = await get(ref(db, 'envelopes'));
    return toArray(snap);
  },

  async putEnvelope(env) {
    await set(ref(db, `envelopes/${env.id}`), env);
  },

  async deleteEnvelope(id) {
    await remove(ref(db, `envelopes/${id}`));
  },

  async addWalletTransaction(tx) {
    const newRef = push(ref(db, 'wallet_transactions'));
    await set(newRef, tx);
    return { ...tx, id: newRef.key };
  },

  async getAllWalletTransactions() {
    const snap = await get(ref(db, 'wallet_transactions'));
    return toArray(snap);
  },

  async deleteWalletTransaction(id) {
    await remove(ref(db, `wallet_transactions/${id}`));
  },

  // ── HOME EXPENSES ──────────────────────────────
  async addHomeExpense(expense) {
    const newRef = push(ref(db, 'home_expenses'));
    await set(newRef, expense);
    return { ...expense, id: newRef.key };
  },

  async getHomeExpensesByMonth(monthKey) {
    const snap = await get(ref(db, 'home_expenses'));
    const all = toArray(snap);
    return all.filter(e => e.month === monthKey);
  },

  async deleteHomeExpense(id) {
    await remove(ref(db, `home_expenses/${id}`));
  }
};
