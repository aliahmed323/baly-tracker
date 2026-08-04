/**
 * wallet.js — إدارة المحفظة والميزانية ومصاريف المنزل
 */

import { Database } from '../db/database.js';
import { Reports }  from './reports.js';
import { Formatter } from '../utils/formatter.js';
import { FuelWallet } from './fuelWallet.js';
import { Bonuses }     from './bonuses.js';
import { BalyBalance } from './balyBalance.js';


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
   * تحويل مبلغ من الرصيد الحر إلى صندوق
   */
  async transferToEnvelope(envelopeId, amount, note = '') {
    // التحقق من توفر النقد الحر الكافي
    const stats = await this.getStats();
    if (amount > 0 && stats.unallocated < amount) {
      throw new Error('المبلغ أكبر من النقد الحر المتوفر');
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
      note,
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
    // جلب كل البيانات معاً
    const [taxiStats, envelopes, txs, fuelData, allTransfers, allBonuses, allBalySnaps] = await Promise.all([
      Reports.getAllTimeStats(),
      this.getEnvelopes(),
      Database.getAllWalletTransactions(),
      FuelWallet.getBalance(),
      Database.getAllTransfers(),
      Database.getAllCompanyBonuses(),
      Database.getAllBalySnapshots(),
    ]);

    const allTransfersSum       = allTransfers.reduce((s,t) => s+(t.amount||0), 0);
    const totalCompanyBonuses   = allBonuses.reduce((s,b) => s+(b.amount||0), 0);
    const fuelConsumed          = fuelData.totalConsumed;
    const fuelTopupsPaid        = fuelData.totalPaid;

    // ── صافي الأرباح الحقيقي ──────────────────────────────
    // taxiStats.netProfit يشمل: أجور + زيادات + تحويلات قديمة - نسبة بلي - مصاريف (من calculator.js)
    // نضيف: مكافآت الشركة الجديدة - تكلفة الوقود المستهلك
    const adjustedNetProfit = (taxiStats.netProfit || 0) + totalCompanyBonuses - fuelConsumed;

    // ── النقد بيدك ────────────────────────────────────────
    // taxiStats.cashInHand = كاش رحلات + زيادات - مصاريف + تحويلات قديمة (من calculator)
    // نطرح: فاتورة شحن الوقود (ذهبت لمحفظة الوقود)
    // ملاحظة: مكافآت الشركة لا تذهب لجيبك مباشرة، تذهب لبلي/زين كاش
    const cashInHand = (taxiStats.cashInHand || 0) - fuelTopupsPaid;

    // ── رصيد بلي ──────────────────────────────────────────
    // إذا سجّل المستخدم رصيده من التطبيق → استخدم تلك اللقطة
    // وإلا → احسب بالطريقة القديمة (للتوافق مع البيانات القديمة)
    const latestBalySnap = allBalySnaps.length > 0
      ? allBalySnaps.sort((a, b) => b.timestamp - a.timestamp)[0]
      : null;
    const balyBalance = latestBalySnap !== null
      ? (latestBalySnap.balance || 0)
      : ((taxiStats.appBalance || 0) + allTransfersSum);

    // ── زين كاش (محسوب تلقائياً) ──────────────────────────
    // زين كاش = صافي الربح - كاش - رصيد بلي - محفظة الوقود
    const fuelWalletBalance = fuelData.balance; // = fuelTopupsPaid - fuelConsumed
    const zainCashBalance   = adjustedNetProfit - cashInHand - balyBalance - fuelWalletBalance;

    // ── صناديق الأموال ─────────────────────────────────────
    const totalInEnvelopes    = envelopes.reduce((s,e) => s+(e.balance||0), 0);
    const totalWalletExpenses = txs.filter(t=>t.type==='envelope_expense').reduce((s,t)=>s+t.amount,0);
    const currentPhysicalCash = adjustedNetProfit - totalWalletExpenses;
    const unallocated         = currentPhysicalCash - totalInEnvelopes;

    return {
      netProfit:        adjustedNetProfit,
      appBalance:       balyBalance,
      balyBalance,
      cashInHand,
      zainCashBalance,
      fuelWalletBalance,
      fuelData,
      totalInEnvelopes,
      unallocated,
      currentPhysicalCash,
      envelopes,
      totalTaxiCash:      adjustedNetProfit,
      totalExpenses:      taxiStats.totalExpenses || 0,
      totalTransfers:     allTransfersSum,
      totalCompanyBonuses,
      latestBalySnap,
      hasBalySnapshot:    latestBalySnap !== null,
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
