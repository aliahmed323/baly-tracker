const initializeApp = () => ({});
const getDatabase=()=>({}), ref=()=>({}), set=()=>({}), get=()=>({}), child=()=>({}), push=()=>({key:1}), remove=()=>({}), update=()=>({}), goOnline=()=>({}), goOffline=()=>({}), onValue=()=>({});

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

// إصلاح مشكلة انقطاع الاتصال عند ترك التطبيق في الخلفية لفترة طويلة (PWAs)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    goOnline(db);
  } else {
    goOffline(db);
  }
});


const CACHE = {};
function initSync(path) {
  CACHE[path] = [];
  onValue(ref(db, path), snap => {
    CACHE[path] = toArray(snap);
  });
}
function initSyncObject(path) {
  CACHE[path] = {};
  onValue(ref(db, path), snap => {
    CACHE[path] = snap.val() || {};
  });
}

function toArray(snapshot) {
  const data = snapshot.val();
  if (!data) return [];
  return Object.keys(data).map(key => ({ id: key, ...data[key] }));
}

export const Database = {
  async init() {
    console.log('🔥 Firebase Realtime Database Initialized!');
    initSync('trips');
    initSync('expenses');
    initSync('transfers');
    initSyncObject('settings');
    initSync('envelopes');
    initSync('wallet_transactions');
    initSync('home_expenses');
    initSync('fuel_topups');
    initSync('daily_km');
    initSync('company_bonuses');
    initSync('baly_snapshots');
    initSync('daily_balances');
    initSync('zain_transactions');

  },

  // ── TRIPS ──────────────────────────────────────
  async addTrip(data) {
    const newRef = push(ref(db, 'trips'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getTrip(id) {
    const t = (CACHE['trips'] || []).find(x => x.id === id);
    return t || null;
  },
  async getTripsByDate(dateKey) {
    const all = await this.getAllTrips();
    return all.filter(t => t.date === dateKey);
  },
  async getAllTrips() { return CACHE['trips'] || []; },
  async updateTrip(trip) {
    const { id, ...data } = trip;
    update(ref(db, `trips/${id}`), data);
    return trip;
  },
  async deleteTrip(id) {
    remove(ref(db, `trips/${id}`));
  },

  // ── EXPENSES ───────────────────────────────────
  async addExpense(data) {
    const newRef = push(ref(db, 'expenses'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getExpensesByDate(dateKey) {
    const all = await this.getAllExpenses();
    return all.filter(e => e.date === dateKey);
  },
  async getAllExpenses() { return CACHE['expenses'] || []; },
  async deleteExpense(id) {
    remove(ref(db, `expenses/${id}`));
  },

  // ── TRANSFERS (زين كاش القديم) ─────────────────
  async addTransfer(data) {
    const newRef = push(ref(db, 'transfers'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getTransfersByDate(dateKey) {
    const all = await this.getAllTransfers();
    return all.filter(t => t.date === dateKey);
  },
  async getAllTransfers() { return CACHE['transfers'] || []; },
  async deleteTransfer(id) {
    remove(ref(db, `transfers/${id}`));
  },

  // ── SETTINGS ───────────────────────────────────
  async getSetting(key) {
    return (CACHE['settings'] || {})[key];
  },
  async setSetting(key, value) {
    set(ref(db, `settings/${key}`), value);
  },

  // ── WALLET (ENVELOPES & TRANSACTIONS) ──────────
  async getAllEnvelopes() { return CACHE['envelopes'] || []; },
  async putEnvelope(env) {
    set(ref(db, `envelopes/${env.id}`), env);
  },
  async deleteEnvelope(id) {
    remove(ref(db, `envelopes/${id}`));
  },
  async addWalletTransaction(tx) {
    const newRef = push(ref(db, 'wallet_transactions'));
    set(newRef, tx);
    return { ...tx, id: newRef.key };
  },
  async getAllWalletTransactions() { return CACHE['wallet_transactions'] || []; },
  async deleteWalletTransaction(id) {
    remove(ref(db, `wallet_transactions/${id}`));
  },

  // ── HOME EXPENSES ──────────────────────────────
  async addHomeExpense(expense) {
    const newRef = push(ref(db, 'home_expenses'));
    set(newRef, expense);
    return { ...expense, id: newRef.key };
  },
  async getHomeExpensesByMonth(monthKey) { return (CACHE['home_expenses']||[]).filter(e => e.month === monthKey); },
  async deleteHomeExpense(id) {
    remove(ref(db, `home_expenses/${id}`));
  },

  // ── FUEL TOPUPS ────────────────────────────────
  async addFuelTopup(data) {
    const newRef = push(ref(db, 'fuel_topups'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllFuelTopups() { return CACHE['fuel_topups'] || []; },
  async deleteFuelTopup(id) {
    remove(ref(db, `fuel_topups/${id}`));
  },

  // ── DAILY KM RECORDS ───────────────────────────
  async addDailyKm(data) {
    const newRef = push(ref(db, 'daily_km'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllDailyKm() { return CACHE['daily_km'] || []; },
  async deleteDailyKm(id) {
    remove(ref(db, `daily_km/${id}`));
  },

  // ── COMPANY BONUSES ────────────────────────────
  async addCompanyBonus(data) {
    const newRef = push(ref(db, 'company_bonuses'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllCompanyBonuses() { return CACHE['company_bonuses'] || []; },
  async deleteCompanyBonus(id) {
    remove(ref(db, `company_bonuses/${id}`));
  },

  // ── BALY BALANCE SNAPSHOTS (القديمة - للتوافق) ─
  async addBalySnapshot(data) {
    const newRef = push(ref(db, 'baly_snapshots'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllBalySnapshots() { return CACHE['baly_snapshots'] || []; },
  async deleteBalySnapshot(id) {
    remove(ref(db, `baly_snapshots/${id}`));
  },

  // ── DAILY BALANCES (لقطة الصباح الجديدة) ───────
  // كل يوم نسجّل: رصيد بلي + رصيد زين كاش الفعليين من التطبيق
  async addDailyBalance(data) {
    const newRef = push(ref(db, 'daily_balances'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllDailyBalances() { return CACHE['daily_balances'] || []; },
  async deleteDailyBalance(id) {
    remove(ref(db, `daily_balances/${id}`));
  },
  async getDailyBalanceByDate(dateKey) {
    const all = await this.getAllDailyBalances();
    return all.find(b => b.date === dateKey) || null;
  },

  // ── ZAIN TRANSACTIONS (محفظة زين كاش المستقلة) ─
  // type: 'credit' (إيداع/مكافأة) | 'debit' (مصروف من زين)
  async addZainTransaction(data) {
    const newRef = push(ref(db, 'zain_transactions'));
    set(newRef, data);
    return { ...data, id: newRef.key };
  },
  async getAllZainTransactions() { return CACHE['zain_transactions'] || []; },
  async deleteZainTransaction(id) {
    remove(ref(db, `zain_transactions/${id}`));
  },
};
