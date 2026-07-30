/**
 * calculator.js — حسابات الأرباح
 *
 * منطق الحسابات المالية لسائق التكسي.
 * جميع الأرقام بالدينار العراقي.
 */

export const Calculator = {

  /**
   * حساب نسبة التطبيق (بلي افتراضياً 15%)
   * @param {number} totalFares - مجموع أجور الرحلات (بدون زيادات ومكافآت)
   * @param {number} percent    - النسبة المئوية
   */
  appFee(totalFares, percent = 15) {
    return Math.round((totalFares * percent) / 100);
  },

  /**
   * حساب إحصائيات يوم كامل
   *
   * @param {Array}  trips      - مصفوفة الرحلات
   * @param {Array}  expenses   - مصفوفة المصاريف
   * @param {Array}  transfers  - مصفوفة تحويلات زين كاش
   * @param {number} appPercent - نسبة التطبيق
   * @returns {DayStats}
   */
  dayStats(trips = [], expenses = [], transfers = [], appPercent = 15) {
    const tripCount   = trips.length;

    // مجموع الأجور الأساسية فقط (تُستخدم لحساب نسبة بلي)
    const totalFares   = trips.reduce((s, t) => s + (t.amount  || 0), 0);

    // الزيادات والمكافآت (لا تدخل في حساب نسبة بلي)
    const totalExtras  = trips.reduce((s, t) => s + (t.extra   || 0), 0);
    const totalBonuses = trips.reduce((s, t) => s + (t.bonus   || 0), 0);

    // إجمالي الإيرادات
    const totalRevenue = totalFares + totalExtras + totalBonuses;

    // نسبة التطبيق (محسوبة على الأجور الأساسية فقط)
    const appFee       = this.appFee(totalFares, appPercent);

    // المصاريف
    const totalExpenses  = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // تحويلات زين كاش
    const totalTransfers = transfers.reduce((s, t) => s + (t.amount || 0), 0);

    // صافي الأرباح = الإيرادات - نسبة التطبيق - المصاريف
    const netProfit = totalRevenue - appFee - totalExpenses;

    // المبلغ الموجود فعلياً = صافي الأرباح - التحويلات
    const cashInHand = netProfit - totalTransfers;

    return {
      tripCount,
      totalFares,
      totalExtras,
      totalBonuses,
      totalRevenue,
      appFee,
      totalExpenses,
      totalTransfers,
      netProfit,
      cashInHand,
    };
  },

  /**
   * حساب إحصائيات شهر كامل
   *
   * @param {Array}  trips
   * @param {Array}  expenses
   * @param {Array}  transfers
   * @param {number} appPercent
   * @returns {MonthStats}
   */
  monthStats(trips = [], expenses = [], transfers = [], appPercent = 15) {
    const base = this.dayStats(trips, expenses, transfers, appPercent);

    // عدد أيام العمل الفعلية
    const workDays = new Set(trips.map(t => t.date)).size;

    // متوسط الربح اليومي
    const avgDailyProfit = workDays > 0
      ? Math.round(base.netProfit / workDays)
      : 0;

    return {
      ...base,
      workDays,
      avgDailyProfit,
    };
  },
};
