/**
 * reports.js — تجميع البيانات والتقارير
 */

import { Trips }     from './trips.js';
import { Expenses }  from './expenses.js';
import { Transfers } from './transfers.js';
import { Settings, KEYS } from './settings.js';
import { Calculator } from '../utils/calculator.js';
import { Formatter }  from '../utils/formatter.js';

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
    const [dates, pct] = await Promise.all([Trips.getAllDates(), getPercent()]);
    if (!dates.length) return [];

    return Promise.all(
      dates.map(async (dateKey) => {
        const [trips, expenses, transfers] = await Promise.all([
          Trips.getByDate(dateKey),
          Expenses.getByDate(dateKey),
          Transfers.getByDate(dateKey),
        ]);
        return {
          date: dateKey,
          stats: Calculator.dayStats(trips, expenses, transfers, pct),
        };
      })
    );
  },

  /** جميع الأشهر التي تحتوي على بيانات */
  async getAllMonths() {
    const [monthGroups, pct] = await Promise.all([Trips.getMonthGroups(), getPercent()]);
    if (!monthGroups.length) return [];

    return Promise.all(
      monthGroups.map(async ({ year, month, key }) => {
        const [trips, expenses, transfers] = await Promise.all([
          Trips.getByMonth(year, month),
          Expenses.getByMonth(year, month),
          Transfers.getByMonth(year, month),
        ]);
        return {
          year, month, key,
          stats: Calculator.monthStats(trips, expenses, transfers, pct),
        };
      })
    );
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
