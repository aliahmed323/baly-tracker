/**
 * database.js — طبقة IndexedDB المجردة
 *
 * هذه الطبقة تُخفي تفاصيل IndexedDB.
 * لاستبدالها بـ Firebase مستقبلاً، استبدل تنفيذ كل دالة
 * مع الإبقاء على نفس الواجهة (Interface).
 */

const DB_NAME    = 'baly_db';
const DB_VERSION = 1;

const STORES = {
  TRIPS:     'trips',
  EXPENSES:  'expenses',
  TRANSFERS: 'transfers',
  SETTINGS:  'settings',
  ENVELOPES: 'envelopes',
  WALLET_TX: 'wallet_transactions',
  HOME_EXPENSES: 'home_expenses',
};

let _db = null;

/** فتح قاعدة البيانات وإنشاء الجداول عند الحاجة */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error);
    req.onsuccess = () => { _db = req.result; resolve(_db); };

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Trips
      if (!db.objectStoreNames.contains(STORES.TRIPS)) {
        const store = db.createObjectStore(STORES.TRIPS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date',      'date',      { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Expenses
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const store = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date',      'date',      { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // ZainCash Transfers
      if (!db.objectStoreNames.contains(STORES.TRANSFERS)) {
        const store = db.createObjectStore(STORES.TRANSFERS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date',      'date',      { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Settings (key-value)
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // Envelopes (Wallet Buckets)
      if (!db.objectStoreNames.contains(STORES.ENVELOPES)) {
        const store = db.createObjectStore(STORES.ENVELOPES, { keyPath: 'id' });
        // id: 'loan', 'rent', 'home', 'maintenance', etc.
      }

      // Wallet Transactions
      if (!db.objectStoreNames.contains(STORES.WALLET_TX)) {
        const store = db.createObjectStore(STORES.WALLET_TX, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Home Expenses
      if (!db.objectStoreNames.contains(STORES.HOME_EXPENSES)) {
        const store = db.createObjectStore(STORES.HOME_EXPENSES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('month', 'month', { unique: false }); // Format: YYYY-MM
      }
    };
  });
}

/** دالة مساعدة: تحويل IDBRequest إلى Promise */
function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror  = () => reject(request.error);
  });
}

/** الحصول على جميع السجلات بقيمة Index محددة */
function getAllByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const store = _db.transaction(storeName, 'readonly').objectStore(storeName);
    const index = store.index(indexName);
    const req   = index.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

/** الحصول على objectStore بوضع القراءة أو الكتابة */
function getStore(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

// ══════════════════════════════════════════════════
// الواجهة العامة — Public Interface
// ══════════════════════════════════════════════════
export const Database = {

  /** تهيئة قاعدة البيانات — استدعِها مرة واحدة عند بدء التطبيق */
  async init() {
    await openDatabase();
  },

  // ── TRIPS ──────────────────────────────────────

  async addTrip(data) {
    const store = getStore(STORES.TRIPS, 'readwrite');
    const id    = await wrap(store.add(data));
    return { ...data, id };
  },

  async getTrip(id) {
    return wrap(getStore(STORES.TRIPS).get(id));
  },

  async getTripsByDate(dateKey) {
    return getAllByIndex(STORES.TRIPS, 'date', dateKey);
  },

  async getAllTrips() {
    return wrap(getStore(STORES.TRIPS).getAll());
  },

  async updateTrip(trip) {
    return wrap(getStore(STORES.TRIPS, 'readwrite').put(trip));
  },

  async deleteTrip(id) {
    return wrap(getStore(STORES.TRIPS, 'readwrite').delete(id));
  },

  // ── EXPENSES ───────────────────────────────────

  async addExpense(data) {
    const store = getStore(STORES.EXPENSES, 'readwrite');
    const id    = await wrap(store.add(data));
    return { ...data, id };
  },

  async getExpensesByDate(dateKey) {
    return getAllByIndex(STORES.EXPENSES, 'date', dateKey);
  },

  async getAllExpenses() {
    return wrap(getStore(STORES.EXPENSES).getAll());
  },

  async deleteExpense(id) {
    return wrap(getStore(STORES.EXPENSES, 'readwrite').delete(id));
  },

  // ── TRANSFERS (زين كاش) ────────────────────────

  async addTransfer(data) {
    const store = getStore(STORES.TRANSFERS, 'readwrite');
    const id    = await wrap(store.add(data));
    return { ...data, id };
  },

  async getTransfersByDate(dateKey) {
    return getAllByIndex(STORES.TRANSFERS, 'date', dateKey);
  },

  async getAllTransfers() {
    return wrap(getStore(STORES.TRANSFERS).getAll());
  },

  async deleteTransfer(id) {
    return wrap(getStore(STORES.TRANSFERS, 'readwrite').delete(id));
  },

  // ── SETTINGS ───────────────────────────────────

  async getSetting(key) {
    const record = await wrap(getStore(STORES.SETTINGS).get(key));
    return record ? record.value : null;
  },

  async setSetting(key, value) {
    return wrap(getStore(STORES.SETTINGS, 'readwrite').put({ key, value }));
  },

  // ── WALLET (ENVELOPES & TRANSACTIONS) ────────

  async getAllEnvelopes() {
    return wrap(getStore(STORES.ENVELOPES).getAll());
  },

  async putEnvelope(env) {
    return wrap(getStore(STORES.ENVELOPES, 'readwrite').put(env));
  },

  async deleteEnvelope(id) {
    return wrap(getStore(STORES.ENVELOPES, 'readwrite').delete(id));
  },

  async addWalletTransaction(tx) {
    const store = getStore(STORES.WALLET_TX, 'readwrite');
    return wrap(store.add(tx));
  },

  async getAllWalletTransactions() {
    return wrap(getStore(STORES.WALLET_TX).getAll());
  },

  // ── HOME EXPENSES ──────────────────────────────

  async addHomeExpense(expense) {
    const store = getStore(STORES.HOME_EXPENSES, 'readwrite');
    return wrap(store.add(expense));
  },

  async getHomeExpensesByMonth(monthKey) {
    return getAllByIndex(STORES.HOME_EXPENSES, 'month', monthKey);
  },

  async deleteHomeExpense(id) {
    return wrap(getStore(STORES.HOME_EXPENSES, 'readwrite').delete(id));
  }
};
