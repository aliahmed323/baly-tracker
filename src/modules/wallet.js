/**
 * wallet.js — إدارة المحفظة الذكية الشاملة v7.0
 * صناديق + زين كاش + بلي + بوابة الصباح
 */

import { Database } from '../db/database.js';
import { Reports }  from './reports.js';
import { Formatter } from '../utils/formatter.js';
import { BalyBalance } from './balyBalance.js';
import { Settings, KEYS } from './settings.js';
import { DailyBalance } from './dailyBalance.js';
import { ZainWallet } from './zainWallet.js';

export const Wallet = {

  // ── صناديق المحفظة (Envelopes) ─────────────────

  async getEnvelopes() {
    return Database.getAllEnvelopes();
  },

  async addEnvelope({ name, icon = '💰', target = 0, monthlyTarget = 0, dailyTarget = 0 }) {
    const id = 'env_' + Date.now();
    const env = {
      id, name, icon,
      target: monthlyTarget || target,
      monthlyTarget: monthlyTarget || target,
      dailyTarget,
      balance: 0,
      createdAt: Date.now()
    };
    await Database.putEnvelope(env);
    return env;
  },

  async updateEnvelope(env) {
    return Database.putEnvelope(env);
  },

  async deleteEnvelope(id) {
    return Database.deleteEnvelope(id);
  },

  // ── حركة الأموال ─────────────────────────────

  /**
   * تحويل مبلغ من الرصيد إلى صندوق
   * allowNegative = true → يسمح حتى لو رصيد الصندوق سيصبح موجباً بعد عملية السحب من خارج
   */
  async transferToEnvelope(envelopeId, amount, note = '', allowNegativeSource = true) {
    const envelopes = await this.getEnvelopes();
    const env = envelopes.find(e => e.id === envelopeId);
    if (!env) throw new Error('الصندوق غير موجود');

    env.balance += amount;
    await this.updateEnvelope(env);

    await Database.addWalletTransaction({
      type: 'deposit_to_env',
      envelopeId,
      amount: Math.abs(amount),
      note,
      timestamp: Date.now(),
      date: Formatter.todayKey()
    });
  },

  /**
   * تسجيل مصروف من صندوق معين — يسمح بالسالب (دين)
   */
  async addExpenseFromEnvelope(envelopeId, amount, note = '') {
    const envelopes = await this.getEnvelopes();
    const env = envelopes.find(e => e.id === envelopeId);
    if (!env) throw new Error('الصندوق غير موجود');

    // مسموح بالرصيد السالب (دين على الصندوق)
    env.balance -= amount;
    await this.updateEnvelope(env);

    await Database.addWalletTransaction({
      type: 'envelope_expense',
      envelopeId,
      amount,
      note,
      timestamp: Date.now(),
      date: Formatter.todayKey()
    });

    if (env.isHome) {
      await Database.addHomeExpense({
        amount, note,
        timestamp: Date.now(),
        date: Formatter.todayKey(),
        month: Formatter.dateKey(Date.now()).substring(0, 7)
      });
    }
  },

  /** جلب الحركات الخاصة بصندوق معين مع إحصائيات */
  async getTransactions(envelopeId) {
    const txs = await Database.getAllWalletTransactions();
    return txs
      .filter(t => t.envelopeId === envelopeId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  /** إحصائيات صندوق معين: أسبوعي، شهري */
  async getEnvelopeStats(envelopeId) {
    const txs = await this.getTransactions(envelopeId);
    const now = new Date();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoKey = weekAgo.toISOString().split('T')[0];

    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const weekTxs  = txs.filter(tx => (tx.date || '') >= weekAgoKey);
    const monthTxs = txs.filter(tx => (tx.date || '').startsWith(monthKey));

    const sum = (list, type) => list.filter(tx => tx.type === type).reduce((s, tx) => s + (tx.amount || 0), 0);

    return {
      weekly: {
        deposited: sum(weekTxs, 'deposit_to_env'),
        spent:     sum(weekTxs, 'envelope_expense'),
        count:     weekTxs.length,
      },
      monthly: {
        deposited: sum(monthTxs, 'deposit_to_env'),
        spent:     sum(monthTxs, 'envelope_expense'),
        count:     monthTxs.length,
      },
      total: {
        deposited: sum(txs, 'deposit_to_env'),
        spent:     sum(txs, 'envelope_expense'),
      }
    };
  },

  /** حذف حركة من سجل الصندوق واسترجاع الرصيد */
  async deleteTransaction(txId) {
    const txs = await Database.getAllWalletTransactions();
    const tx = txs.find(t => t.id === txId);
    if (!tx) throw new Error('العملية غير موجودة');

    const envs = await this.getEnvelopes();
    const env = envs.find(e => e.id === tx.envelopeId);

    if (env) {
      if (tx.type === 'deposit_to_env') {
        env.balance -= tx.amount;
      } else if (tx.type === 'envelope_expense') {
        env.balance += tx.amount;
      }
      await this.updateEnvelope(env);
    }

    await Database.deleteWalletTransaction(txId);
  },

  // ── الإحصائيات والأرصدة الكاملة ────────────────────

  async getStats() {
    const [taxiStats, envelopes, txs, allBalySnaps, allTransfers, cashAdj, zainAdj, zainTxs] = await Promise.all([
      Reports.getAllTimeStats(),
      this.getEnvelopes(),
      Database.getAllWalletTransactions(),
      BalyBalance.getAll(),
      Database.getAllTransfers(),
      Settings.get(KEYS.CASH_ADJUST),
      Settings.get(KEYS.ZAIN_ADJUST),
      Database.getAllZainTransactions()
    ]);

    const allTransfersSum = allTransfers.reduce((s, t) => s + (t.amount || 0), 0);
    const adjustedNetProfit = (taxiStats.netProfit || 0);
    const cashInHand = (taxiStats.cashInHand || 0) + (cashAdj || 0);

    // ── رصيد بلي ──
    const latestBalySnap = allBalySnaps.length > 0
      ? allBalySnaps.sort((a, b) => b.timestamp - a.timestamp)[0]
      : null;
    const balyBalance = latestBalySnap !== null
      ? (latestBalySnap.balance || 0)
      : ((taxiStats.appBalance || 0) + allTransfersSum);

    // ── رصيد زين كاش ──
    const baseZainCash = adjustedNetProfit - (taxiStats.cashInHand || 0) - balyBalance;
    const txSum = zainTxs.reduce((s, tx) => {
      if (tx.type === 'credit') return s + (tx.amount || 0);
      if (tx.type === 'debit')  return s - (tx.amount || 0);
      return s;
    }, 0);
    const zainCashBalance = baseZainCash + (zainAdj || 0) + txSum;

    // ── صناديق الأموال ──
    const totalInEnvelopes = envelopes.reduce((s, e) => s + (e.balance || 0), 0);
    const totalWalletExpenses = txs.filter(t => t.type === 'envelope_expense').reduce((s, t) => s + t.amount, 0);
    const currentPhysicalCash = cashInHand - totalWalletExpenses;
    const unallocated = currentPhysicalCash - totalInEnvelopes;

    return {
      netProfit:          adjustedNetProfit,
      appBalance:         balyBalance,
      balyBalance,
      cashInHand,
      zainCashBalance,
      totalInEnvelopes,
      unallocated,
      currentPhysicalCash,
      envelopes,
      totalTaxiCash:      adjustedNetProfit,
      totalExpenses:      taxiStats.totalExpenses || 0,
      totalTransfers:     allTransfersSum,
      latestDailyBalance: null,
      hasBalySnapshot:    latestBalySnap !== null,
    };
  },

  async getHomeExpenses(year, month) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const list = await Database.getHomeExpensesByMonth(monthKey);
    return list.sort((a, b) => b.timestamp - a.timestamp);
  },

  async deleteHomeExpense(id) {
    return Database.deleteHomeExpense(id);
  }
};
