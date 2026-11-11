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

    // الزيادات والمكافآت
    const totalExtras  = trips.reduce((s, t) => s + (t.extra   || 0), 0);
    const totalBonuses = trips.reduce((s, t) => s + (t.bonus   || 0), 0);

    // الكاش المستلم فعلياً من الرحلات
    const totalCashReceived = trips.reduce((s, t) => {
      let cr = t.amount;
      if (t.cashReceived !== undefined) {
         cr = t.cashReceived;
      } else if (t.paymentType === 'app') {
         cr = 0;
      }
      return s + (Number(cr) || 0);
    }, 0);

    // إجمالي الإيرادات
    const totalRevenue = totalFares + totalExtras + totalBonuses;

    // نسبة التطبيق (محسوبة على الأجور الأساسية فقط)
    const appFee       = this.appFee(totalFares, appPercent);

    // المصاريف
    const totalExpenses  = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    // تحويلات زين كاش (سحب من رصيد التطبيق إلى الكاش)
    const totalTransfers = transfers.reduce((s, t) => s + (t.amount || 0), 0);

    // صافي الأرباح = الإيرادات + تحويلات زين كاش (مكافآت شركة) - نسبة التطبيق - المصاريف
    // تحويلات زين كاش هي مكافآت من الشركة وتُضاف للأرباح الحقيقية
    const netProfit = totalRevenue + totalTransfers - appFee - totalExpenses;

    // التغير في رصيد بلي = (الأجرة المتبقية التي لم تُدفع كاش) - عمولة التطبيق + المكافآت - السحوبات (تحويلات)
    const appBalanceChange = (totalFares - totalCashReceived) - appFee + totalBonuses - totalTransfers;
    
    // المبلغ النقدي الفعلي = المستلم كاش + الزيادات - المصاريف + التحويلات (سحبناها كاش)
    const cashInHandChange = totalCashReceived + totalExtras - totalExpenses + totalTransfers;

    return {
      tripCount,
      totalFares,
      totalExtras,
      totalBonuses,
      totalCashReceived,
      totalRevenue,
      appFee,
      totalExpenses,
      totalTransfers,
      netProfit,
      appBalance: appBalanceChange,
      cashInHand: cashInHandChange,
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
