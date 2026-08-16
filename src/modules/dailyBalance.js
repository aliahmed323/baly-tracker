/**
 * dailyBalance.js — بوابة الصباح: لقطات يومية للأرصدة
 * تسجيل رصيد بلي + زين كاش كل يوم للكشف عن المكافآت والفروقات
 */
import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const DailyBalance = {

  /** تسجيل أرصدة اليوم (بوابة الصباح) */
  async recordToday({ balyBalance, zainCashBalance, note = '' }) {
    const today = Formatter.todayKey();
    const now = Date.now();
    // حذف أي إدخال سابق لنفس اليوم (تحديث)
    const existing = await this.getByDate(today);
    if (existing) {
      await Database.deleteDailyBalance(existing.id);
    }
    return Database.addDailyBalance({
      date: today,
      balyBalance: Number(balyBalance) || 0,
      zainCashBalance: Number(zainCashBalance) || 0,
      note,
      timestamp: now,
    });
  },

  /** هل تم تسجيل أرصدة اليوم؟ */
  async hasEntryForToday() {
    const today = Formatter.todayKey();
    const entry = await this.getByDate(today);
    return entry !== null;
  },

  /** آخر لقطة مسجلة (أي يوم) */
  async getLatest() {
    const all = await Database.getAllDailyBalances();
    if (!all.length) return null;
    return all.sort((a, b) => b.timestamp - a.timestamp)[0];
  },

  /** لقطة يوم محدد */
  async getByDate(dateKey) {
    return Database.getDailyBalanceByDate(dateKey);
  },

  /** كل اللقطات مرتبة من الأقدم للأحدث */
  async getAll() {
    const all = await Database.getAllDailyBalances();
    return all.sort((a, b) => a.timestamp - b.timestamp);
  },

  /**
   * حساب الفروقات المكتشفة مقارنةً بلقطة الأمس
   * يُستخدم لكشف المكافآت التي وصلت وأنت نائم
   * @returns { balyDiff, zainDiff, balyBonus, zainBonus }
   */
  async detectBonuses({ newBalyBalance, newZainCashBalance }) {
    const yesterday = this.getYesterdayKey();
    const prevEntry = await this.getByDate(yesterday);
    if (!prevEntry) return { balyDiff: 0, zainDiff: 0, balyBonus: 0, zainBonus: 0 };

    const balyDiff = newBalyBalance - prevEntry.balyBalance;
    const zainDiff = newZainCashBalance - prevEntry.zainCashBalance;

    return {
      prevBalyBalance: prevEntry.balyBalance,
      prevZainCashBalance: prevEntry.zainCashBalance,
      balyDiff,
      zainDiff,
      // الزيادة الإيجابية تُعتبر مكافأة/دخل جديد
      balyBonus: balyDiff > 0 ? balyDiff : 0,
      zainBonus: zainDiff > 0 ? zainDiff : 0,
    };
  },

  getYesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  },
};
