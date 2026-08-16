/**
 * zainWallet.js — محفظة زين كاش المستقلة
 * تتبع رصيد زين كاش مع سجل حركات كامل (إيداع/سحب/مصروف)
 */
import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';
import { DailyBalance } from './dailyBalance.js';

export const ZainWallet = {

  /**
   * حساب رصيد زين كاش الحالي
   * = آخر رصيد مسجل في بوابة الصباح
   * + المعاملات (إيداع يُضاف، مصروف يُطرح) منذ آخر لقطة
   */
  async getBalance() {
    const [latest, txs] = await Promise.all([
      DailyBalance.getLatest(),
      Database.getAllZainTransactions(),
    ]);

    const baseBalance = latest ? (latest.zainCashBalance || 0) : 0;
    const baseDate = latest ? latest.date : '1970-01-01';

    // احسب فقط المعاملات التي حدثت بعد آخر لقطة
    const txsAfterSnapshot = txs.filter(tx => (tx.date || '') >= baseDate);
    const txSum = txsAfterSnapshot.reduce((s, tx) => {
      if (tx.type === 'credit') return s + (tx.amount || 0);
      if (tx.type === 'debit')  return s - (tx.amount || 0);
      return s;
    }, 0);

    return baseBalance + txSum;
  },

  /** كل المعاملات مرتبة من الأحدث */
  async getTransactions() {
    const all = await Database.getAllZainTransactions();
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },

  /** إضافة معاملة */
  async addTransaction({ amount, type, note = '', date = null, category = '' }) {
    const now = Date.now();
    return Database.addZainTransaction({
      amount: Math.abs(Number(amount)),
      type, // 'credit' or 'debit'
      note,
      category,
      date: date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  /** إيداع في زين كاش (مثل تحويل من النقد) */
  async deposit({ amount, note = '', date = null }) {
    return this.addTransaction({ amount, type: 'credit', note, date, category: 'deposit' });
  },

  /** مصروف من زين كاش (مثل شراء إنترنت، إيجار بيت) */
  async expense({ amount, note = '', date = null, category = 'expense' }) {
    return this.addTransaction({ amount, type: 'debit', note, date, category });
  },

  /** حذف معاملة */
  async deleteTransaction(id) {
    return Database.deleteZainTransaction(id);
  },

  /** إحصائيات هذا الأسبوع */
  async getWeeklyStats() {
    const txs = await this.getTransactions();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoKey = weekAgo.toISOString().split('T')[0];
    const weekTxs = txs.filter(tx => (tx.date || '') >= weekAgoKey);
    const income  = weekTxs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
    const expense = weekTxs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
    return { income, expense, net: income - expense, count: weekTxs.length };
  },

  /** إحصائيات هذا الشهر */
  async getMonthlyStats() {
    const txs = await this.getTransactions();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthTxs = txs.filter(tx => (tx.date || '').startsWith(monthKey));
    const income  = monthTxs.filter(tx => tx.type === 'credit').reduce((s, tx) => s + tx.amount, 0);
    const expense = monthTxs.filter(tx => tx.type === 'debit').reduce((s, tx) => s + tx.amount, 0);
    return { income, expense, net: income - expense, count: monthTxs.length };
  },
};
