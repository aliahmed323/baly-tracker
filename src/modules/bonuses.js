/**
 * bonuses.js — مكافآت الشركة اليومية
 */
import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const Bonuses = {

  /** تسجيل مكافأة شركة */
  async add({ amount, date = null, note = '' }) {
    const now = Date.now();
    return Database.addCompanyBonus({
      amount,
      note,
      date: date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  async getByDate(dateKey) {
    const all = await Database.getAllCompanyBonuses();
    return all.filter(b => b.date === dateKey);
  },

  async getAll() {
    return Database.getAllCompanyBonuses();
  },

  async delete(id) {
    return Database.deleteCompanyBonus(id);
  },
};
