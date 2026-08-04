/**
 * expenses.js — إدارة المصاريف
 */

import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const CATEGORIES = {
  fuel:        { id: 'fuel',        name: 'وقود',   icon: '⛽' },
  food:        { id: 'food',        name: 'أكل',    icon: '🍔' },
  wash:        { id: 'wash',        name: 'غسيل',   icon: '🚿' },
  maintenance: { id: 'maintenance', name: 'صيانة',  icon: '🔧' },
  other:       { id: 'other',       name: 'أخرى',   icon: '📦' },
};

export const Expenses = {

  async add({ category, amount, note = '', date = null }) {
    const now = Date.now();
    return Database.addExpense({
      category, amount, note,
      date:      date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  async getToday() {
    const list = await Database.getExpensesByDate(Formatter.todayKey());
    return list.sort((a, b) => a.timestamp - b.timestamp);
  },

  async getByDate(dateKey) {
    const list = await Database.getExpensesByDate(dateKey);
    return list.sort((a, b) => a.timestamp - b.timestamp);
  },

  async getByMonth(year, month) {
    const all    = await Database.getAllExpenses();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return all.filter(e => e.date?.startsWith(prefix));
  },

  async delete(id) {
    return Database.deleteExpense(id);
  },

  getCategory(id) {
    return CATEGORIES[id] || CATEGORIES.other;
  },
};
