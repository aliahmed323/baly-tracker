/**
 * reports.js — تجميع البيانات والتقارير
 */

import { Trips }     from './trips.js';
import { Expenses }  from './expenses.js';
import { Transfers } from './transfers.js';
import { Settings, KEYS } from './settings.js';
import { Calculator } from '../utils/calculator.js';
import { Formatter }  from '../utils/formatter.js';
import { FuelWallet } from './fuelWallet.js';


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
    const [dates, pct, dailyRecords] = await Promise.all([
      Trips.getAllDates(), 
      getPercent(),
      FuelWallet.getAllDailyRecords(),
    ]);
    if (!dates.length) return [];

    return Promise.all(
      dates.map(async (dateKey) => {
        const [trips, expenses, transfers] = await Promise.all([
          Trips.getByDate(dateKey),
          Expenses.getByDate(dateKey),
          Transfers.getByDate(dateKey),
        ]);
        
        const dayKm = dailyRecords.filter(r => r.date === dateKey).reduce((s, r) => s + (r.km || 0), 0);
        
        return {
          date: dateKey,
          totalKm: dayKm,
          stats: Calculator.dayStats(trips, expenses, transfers, pct),
        };
      })
    );
  },

  /** جميع الأشهر التي تحتوي على بيانات */
  async getAllMonths() {
    const [monthGroups, pct, dailyRecords] = await Promise.all([
      Trips.getMonthGroups(), 
      getPercent(),
      FuelWallet.getAllDailyRecords(),
    ]);
    if (!monthGroups.length) return [];

    return Promise.all(
      monthGroups.map(async ({ year, month, key }) => {
        const [trips, expenses, transfers] = await Promise.all([
          Trips.getByMonth(year, month),
          Expenses.getByMonth(year, month),
          Transfers.getByMonth(year, month),
        ]);
        
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        const monthKm = dailyRecords.filter(r => r.date?.startsWith(prefix)).reduce((s, r) => s + (r.km || 0), 0);

        return {
          year, month, key,
          totalKm: monthKm,
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
