/**
 * reports.js — تجميع البيانات والتقارير
 */

import { Trips }     from './trips.js';
import { Expenses }  from './expenses.js';
import { Transfers } from './transfers.js';
import { Settings, KEYS } from './settings.js';
import { Calculator } from '../utils/calculator.js';
import { Formatter }  from '../utils/formatter.js';
import { Database }   from '../db/database.js';



async function getPercent() {
  return Settings.get(KEYS.APP_PERCENT);
}

export const Reports = {

  /** إحصائيات اليوم الحالي */
  async getToday() {
    const [trips, expenses, transfers, pct] = await Promise.all([
      Trips.getToday(),
      Expenses.getToday(),
      Transfers.getToday(),
      getPercent(),
    ]);
    return {
      date: Formatter.todayKey(),
      trips, expenses, transfers,
      stats: Calculator.dayStats(trips, expenses, transfers, pct),
    };
  },

  /** إحصائيات يوم محدد */
  async getDay(dateKey) {
    const [trips, expenses, transfers, pct] = await Promise.all([
      Trips.getByDate(dateKey),
      Expenses.getByDate(dateKey),
      Transfers.getByDate(dateKey),
      getPercent(),
    ]);
    return {
      date: dateKey,
      trips, expenses, transfers,
      stats: Calculator.dayStats(trips, expenses, transfers, pct),
    };
  },

  /** إحصائيات شهر محدد */
  async getMonth(year, month) {
    const [trips, expenses, transfers, pct] = await Promise.all([
      Trips.getByMonth(year, month),
      Expenses.getByMonth(year, month),
      Transfers.getByMonth(year, month),
      getPercent(),
    ]);
    return {
      year, month,
      trips, expenses, transfers,
      stats: Calculator.monthStats(trips, expenses, transfers, pct),
    };
  },

  /** جميع الأيام التي تحتوي على بيانات (للسجل) */
  async getAllDays() {
    const [allTrips, allExp, allTrans, pct, dailyRecords] = await Promise.all([
      Database.getAllTrips(),
      Database.getAllExpenses(),
      Database.getAllTransfers(),
      getPercent(),
    ]);

    const datesSet = new Set();
    allTrips.forEach(t => { if (t.date) datesSet.add(t.date); });
    allExp.forEach(e => { if (e.date) datesSet.add(e.date); });
    allTrans.forEach(t => { if (t.date) datesSet.add(t.date); });
    
    const dates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
    if (!dates.length) return [];

    return dates.map(dateKey => {
      const trips = allTrips.filter(t => t.date === dateKey);
      const expenses = allExp.filter(e => e.date === dateKey);
      const transfers = allTrans.filter(t => t.date === dateKey);
      
      return {
        date: dateKey,
        stats: Calculator.dayStats(trips, expenses, transfers, pct),
      };
    });
  },

  /** جميع الأشهر التي تحتوي على بيانات */
  async getAllMonths() {
    const [allTrips, allExp, allTrans, pct] = await Promise.all([
      Database.getAllTrips(),
      Database.getAllExpenses(),
      Database.getAllTransfers(),
      getPercent(),
    ]);

    const groups = {};
    const addMonth = (dateStr) => {
      if (!dateStr) return;
      const monthPrefix = dateStr.substring(0, 7); // YYYY-MM
      if (!groups[monthPrefix]) groups[monthPrefix] = true;
    };

    allTrips.forEach(t => addMonth(t.date));
    allExp.forEach(e => addMonth(e.date));
    allTrans.forEach(t => addMonth(t.date));

    const monthKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    if (!monthKeys.length) return [];

    return monthKeys.map(monthStr => {
      const trips = allTrips.filter(t => t.date?.startsWith(monthStr));
      const expenses = allExp.filter(e => e.date?.startsWith(monthStr));
      const transfers = allTrans.filter(t => t.date?.startsWith(monthStr));

      const [y, m] = monthStr.split('-');
      return {
        year: parseInt(y),
        month: parseInt(m),
        stats: Calculator.monthStats(trips, expenses, transfers, pct),
      };
    });
  },

  /** إحصائيات كل الأوقات (للمحفظة) */
  async getAllTimeStats() {
    const [trips, expenses, transfers, pct] = await Promise.all([
      import('./trips.js').then(m => m.Trips).then(t => import('../db/database.js').then(db => db.Database.getAllTrips())),
      import('./expenses.js').then(m => m.Expenses).then(e => import('../db/database.js').then(db => db.Database.getAllExpenses())),
      import('./transfers.js').then(m => m.Transfers).then(t => import('../db/database.js').then(db => db.Database.getAllTransfers())),
      getPercent(),
    ]);

    return Calculator.monthStats(trips, expenses, transfers, pct); // monthStats handles raw arrays exactly like all-time
  },
};
