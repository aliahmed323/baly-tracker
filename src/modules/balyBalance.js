/**
 * balyBalance.js — لقطات رصيد بلي
 */
import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const BalyBalance = {

  /** تسجيل رصيد بلي الحالي */
  async record({ balance, date = null, note = '' }) {
    const now = Date.now();
    return Database.addBalySnapshot({
      balance,
      note,
      date: date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  /** آخر رصيد مسجّل */
  async getLatest() {
    const all = await Database.getAllBalySnapshots();
    if (!all.length) return null;
    return all.sort((a, b) => b.timestamp - a.timestamp)[0];
  },

  async getAll() {
    return Database.getAllBalySnapshots();
  },

  async delete(id) {
    return Database.deleteBalySnapshot(id);
  },
};
