/**
 * wallet.js — إدارة المحفظة والميزانية ومصاريف المنزل
 */

import { Database } from '../db/database.js';
import { Reports }  from './reports.js';
import { Formatter } from '../utils/formatter.js';

export const Wallet = {

  // ── صناديق المحفظة (Envelopes) ─────────────────

  async getEnvelopes() {
    return Database.getAllEnvelopes();
  },

  async addEnvelope({ name, icon = '💰', target = 0 }) {
    const id = 'env_' + Date.now();
    const env = { id, name, icon, target, balance: 0, createdAt: Date.now() };
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
   * تحويل مبلغ من الرصيد الحر إلى صندوق
   */
  async transferToEnvelope(envelopeId, amount) {
    // التحقق من الرصيد الحر أولاً
    const stats = await this.getStats();
    if (amount > 0 && stats.unallocated < amount) {
      throw new Error('الرصيد الحر لا يكفي للإيداع');
    }

    const envelopes = await this.getEnvelopes();
    const env = envelopes.find(e => e.id === envelopeId);
    if (!env) throw new Error('الصندوق غير موجود');

    env.balance += amount;
    await this.updateEnvelope(env);

    // تسجيل الحركة
    await Database.addWalletTransaction({
      type: amount > 0 ? 'deposit_to_env' : 'withdraw_from_env',
      envelopeId,
      amount: Math.abs(amount),
      timestamp: Date.now(),
      date: Formatter.todayKey()
    });
  },

  /**
   * تسجيل مصروف من صندوق معين (مثلاً مصروف منزل)
   */
  async addExpenseFromEnvelope(envelopeId, amount, note = '') {
    const envelopes = await this.getEnvelopes();
    const env = envelopes.find(e => e.id === envelopeId);
    if (!env) throw new Error('الصندوق غير موجود');

    if (env.balance < amount) throw new Error('الرصيد في الصندوق لا يكفي');

    env.balance -= amount;
    await this.updateEnvelope(env);

    // تسجيل كمصروف عام من المحفظة
    await Database.addWalletTransaction({
      type: 'envelope_expense',
      envelopeId,
      amount,
      note,
      timestamp: Date.now(),
      date: Formatter.todayKey()
    });

    // إذا كان هذا صندوق المنزل، نسجله أيضاً في مصاريف المنزل للتفصيل
    if (env.isHome) {
      await Database.addHomeExpense({
        amount,
        note,
        timestamp: Date.now(),
        date: Formatter.todayKey(),
        month: Formatter.dateKey(Date.now()).substring(0, 7) // YYYY-MM
      });
    }
  },

  /** جلب الحركات (Transactions) الخاصة بصندوق معين */
  async getTransactions(envelopeId) {
    const txs = await Database.getAllWalletTransactions();
    return txs
      .filter(t => t.envelopeId === envelopeId)
      .sort((a, b) => b.timestamp - a.timestamp); // الأحدث أولاً
  },

  /** حذف حركة من سجل الصندوق واسترجاع الرصيد */
  async deleteTransaction(txId) {
    const txs = await Database.getAllWalletTransactions();
    const tx = txs.find(t => t.id === txId);
    if (!tx) throw new Error('العملية غير موجودة');

    const envs = await this.getEnvelopes();
    const env = envs.find(e => e.id === tx.envelopeId);
    
    if (env) {
      // عكس تأثير العملية على رصيد القاصة
      if (tx.type === 'deposit_to_env') {
        env.balance -= tx.amount;
      } else if (tx.type === 'withdraw_from_env') {
        env.balance += tx.amount;
      } else if (tx.type === 'envelope_expense') {
        env.balance += tx.amount;
      }
      await this.updateEnvelope(env);
    }

    await Database.deleteWalletTransaction(txId);
  },

  // ── الإحصائيات والأرصدة ────────────────────────

  async getStats() {
    // 1. كل إحصائيات التكسي (الكلية من كل الأوقات)
    const taxiStats = await Reports.getAllTimeStats();
    
    const netProfit      = taxiStats.netProfit      || 0; // صافي الأرباح الحقيقي
    const appBalance     = taxiStats.appBalance     || 0; // رصيد بلي الذي لم يُسحب
    const totalExpenses  = taxiStats.totalExpenses  || 0;
    const totalTransfers = taxiStats.totalTransfers || 0;

    // 2. قراءة كل الصناديق
    const envelopes = await this.getEnvelopes();
    const totalInEnvelopes = envelopes.reduce((s, e) => s + (e.balance || 0), 0);

    // 3. مصاريف المحفظة (الصرف من الصناديق)
    const txs = await Database.getAllWalletTransactions();
    const totalWalletExpenses = txs
      .filter(t => t.type === 'envelope_expense')
      .reduce((s, t) => s + t.amount, 0);

    // 4. الرصيد الصافي المتاح بعد مصاريف المحفظة
    const currentPhysicalCash = netProfit - totalWalletExpenses;

    // 5. الرصيد الحر (غير الموزع على الصناديق)
    const unallocated = currentPhysicalCash - totalInEnvelopes;

    return {
      netProfit,
      appBalance,
      totalExpenses,
      totalTransfers,
      currentPhysicalCash,
      totalInEnvelopes,
      unallocated,
      envelopes,
      // للتوافق مع الكود القديم
      totalTaxiCash: netProfit,
    };
  },

  // ── إدارة مصاريف المنزل التفصيلية ──────────────

  async getHomeExpenses(year, month) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const list = await Database.getHomeExpensesByMonth(monthKey);
    return list.sort((a, b) => b.timestamp - a.timestamp); // الأحدث أولاً
  },

  async deleteHomeExpense(id) {
    // لا نعيد المبلغ للصندوق تلقائياً هنا لتجنب التعقيد، يمكن للمستخدم إضافة مبلغ يدوياً للصندوق
    return Database.deleteHomeExpense(id);
  }
};
