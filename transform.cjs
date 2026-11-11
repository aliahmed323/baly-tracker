const fs = require('fs');
let code = fs.readFileSync('src/db/database.js', 'utf8');

code = code.replace(/update, goOnline, goOffline/, 'update, goOnline, goOffline, onValue');

const cacheCode = `
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
`;
code = code.replace(/function toArray/, cacheCode + '\nfunction toArray');

const initCalls = `
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
`;
code = code.replace(/console\.log\('🔥 Firebase Realtime Database Initialized!'\);/, 
  `console.log('🔥 Firebase Realtime Database Initialized!');` + initCalls);

code = code.replace(/await set\(/g, 'set(');
code = code.replace(/await remove\(/g, 'remove(');
code = code.replace(/await update\(/g, 'update(');

const collections = ['Trips', 'Expenses', 'Transfers', 'Envelopes', 'WalletTransactions', 'FuelTopups', 'DailyKm', 'CompanyBonuses', 'BalySnapshots', 'DailyBalances', 'ZainTransactions'];
const paths = ['trips', 'expenses', 'transfers', 'envelopes', 'wallet_transactions', 'fuel_topups', 'daily_km', 'company_bonuses', 'baly_snapshots', 'daily_balances', 'zain_transactions'];

for (let i=0; i<collections.length; i++) {
  const cName = collections[i];
  const pName = paths[i];
  const regex = new RegExp(`async getAll${cName}\\(\\)\\s*\\{[^}]*\\}`, 'g');
  code = code.replace(regex, `async getAll${cName}() { return CACHE['${pName}'] || []; }`);
}

code = code.replace(/async getTrip\(id\) \{[^}]*\}/, 
  `async getTrip(id) { const t = (CACHE['trips']||[]).find(x=>x.id===id); return t || null; }`);

code = code.replace(/async getSetting\(key\) \{[^}]*\}/, 
  `async getSetting(key) { return (CACHE['settings'] || {})[key]; }`);
code = code.replace(/async setSetting\(key, value\) \{[^}]*\}/, 
  `async setSetting(key, value) { set(ref(db, \`settings/\${key}\`), value); }`);

code = code.replace(/async getHomeExpensesByMonth\(monthKey\) \{[^}]*\}/, 
  `async getHomeExpensesByMonth(monthKey) { return (CACHE['home_expenses']||[]).filter(e => e.month === monthKey); }`);

fs.writeFileSync('src/db/database.js', code);
console.log('Done transforming database.js');
