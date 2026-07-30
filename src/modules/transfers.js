/**
 * transfers.js — تحويلات زين كاش
 */

import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const Transfers = {

  async add({ amount, note = '' }) {
    const now = Date.now();
    return Database.addTransfer({
      amount, note,
      date:      Formatter.dateKey(now),
      timestamp: now,
    });
  },

  async getToday() {
    const list = await Database.getTransfersByDate(Formatter.todayKey());
    return list.sort((a, b) => a.timestamp - b.timestamp);
  },

  async getByDate(dateKey) {
    const list = await Database.getTransfersByDate(dateKey);
    return list.sort((a, b) => a.timestamp - b.timestamp);
  },

  async getByMonth(year, month) {
    const all    = await Database.getAllTransfers();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return all.filter(t => t.date?.startsWith(prefix));
  },

  async delete(id) {
    return Database.deleteTransfer(id);
  },
};
