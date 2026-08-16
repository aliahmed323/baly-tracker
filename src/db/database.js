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

function toArray(snapshot) {
  const data = snapshot.val();
  if (!data) return [];
  return Object.keys(data).map(key => ({ id: key, ...data[key] }));
}

export const Database = {
  async init() {
    console.log('🔥 Firebase Realtime Database Initialized!');
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

  // ── TRANSFERS (زين كاش القديم) ─────────────────
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

  // ── WALLET (ENVELOPES & TRANSACTIONS) ──────────
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
  },

  // ── FUEL TOPUPS ────────────────────────────────
  async addFuelTopup(data) {
    const newRef = push(ref(db, 'fuel_topups'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllFuelTopups() {
    const snap = await get(ref(db, 'fuel_topups'));
    return toArray(snap);
  },
  async deleteFuelTopup(id) {
    await remove(ref(db, `fuel_topups/${id}`));
  },

  // ── DAILY KM RECORDS ───────────────────────────
  async addDailyKm(data) {
    const newRef = push(ref(db, 'daily_km'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllDailyKm() {
    const snap = await get(ref(db, 'daily_km'));
    return toArray(snap);
  },
  async deleteDailyKm(id) {
    await remove(ref(db, `daily_km/${id}`));
  },

  // ── COMPANY BONUSES ────────────────────────────
  async addCompanyBonus(data) {
    const newRef = push(ref(db, 'company_bonuses'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllCompanyBonuses() {
    const snap = await get(ref(db, 'company_bonuses'));
    return toArray(snap);
  },
  async deleteCompanyBonus(id) {
    await remove(ref(db, `company_bonuses/${id}`));
  },

  // ── BALY BALANCE SNAPSHOTS (القديمة - للتوافق) ─
  async addBalySnapshot(data) {
    const newRef = push(ref(db, 'baly_snapshots'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllBalySnapshots() {
    const snap = await get(ref(db, 'baly_snapshots'));
    return toArray(snap);
  },
  async deleteBalySnapshot(id) {
    await remove(ref(db, `baly_snapshots/${id}`));
  },

  // ── DAILY BALANCES (لقطة الصباح الجديدة) ───────
  // كل يوم نسجّل: رصيد بلي + رصيد زين كاش الفعليين من التطبيق
  async addDailyBalance(data) {
    const newRef = push(ref(db, 'daily_balances'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllDailyBalances() {
    const snap = await get(ref(db, 'daily_balances'));
    return toArray(snap);
  },
  async deleteDailyBalance(id) {
    await remove(ref(db, `daily_balances/${id}`));
  },
  async getDailyBalanceByDate(dateKey) {
    const all = await this.getAllDailyBalances();
    return all.find(b => b.date === dateKey) || null;
  },

  // ── ZAIN TRANSACTIONS (محفظة زين كاش المستقلة) ─
  // type: 'credit' (إيداع/مكافأة) | 'debit' (مصروف من زين)
  async addZainTransaction(data) {
    const newRef = push(ref(db, 'zain_transactions'));
    await set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllZainTransactions() {
    const snap = await get(ref(db, 'zain_transactions'));
    return toArray(snap);
  },
  async deleteZainTransaction(id) {
    await remove(ref(db, `zain_transactions/${id}`));
  },
};
