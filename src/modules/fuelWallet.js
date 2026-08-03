/**
 * fuelWallet.js — محفظة الوقود وتتبع الكيلومترات
 */
import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';
import { Settings, KEYS } from './settings.js';

export const FuelWallet = {

  /** شحن محفظة الوقود (دفع نقود للمحطة) */
  async addTopup({ amount, liters = 0, date = null, note = '' }) {
    const now = Date.now();
    return Database.addFuelTopup({
      amount,
      liters,
      note,
      date: date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  /** تسجيل استهلاك يومي للوقود */
  async addDailyRecord({ km, liters, date = null, note = '' }) {
    const now = Date.now();
    const fuelPrice = (await Settings.get(KEYS.FUEL_PRICE)) || 750;
    const fuelCost  = Math.round(liters * fuelPrice);
    return Database.addDailyKm({
      km, liters, fuelPrice, fuelCost,
      note,
      date: date || Formatter.dateKey(now),
      timestamp: now,
    });
  },

  /** جلب كل سجلات الكيلومترات */
  async getAllDailyRecords() {
    return Database.getAllDailyKm();
  },

  /** جلب سجلات يوم معين */
  async getDailyRecordsByDate(dateKey) {
    const all = await Database.getAllDailyKm();
    return all.filter(r => r.date === dateKey);
  },

  /** جلب كل تحميلات الوقود */
  async getAllTopups() {
    return Database.getAllFuelTopups();
  },

  /** حذف سجل يومي */
  async deleteDailyRecord(id) {
    return Database.deleteDailyKm(id);
  },

  /** حذف تحميل */
  async deleteTopup(id) {
    return Database.deleteFuelTopup(id);
  },

  /** رصيد محفظة الوقود */
  async getBalance() {
    const [topups, dailyRecords] = await Promise.all([
      this.getAllTopups(),
      this.getAllDailyRecords(),
    ]);
    const totalPaid     = topups.reduce((s, t) => s + (t.amount || 0), 0);
    const totalConsumed = dailyRecords.reduce((s, r) => s + (r.fuelCost || 0), 0);
    const totalKm       = dailyRecords.reduce((s, r) => s + (r.km || 0), 0);
    const totalLiters   = dailyRecords.reduce((s, r) => s + (r.liters || 0), 0);
    return {
      balance: totalPaid - totalConsumed,
      totalPaid,
      totalConsumed,
      totalKm,
      totalLiters,
    };
  },

  /** إحصائيات شهر معين */
  async getMonthStats(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const [topups, daily] = await Promise.all([
      this.getAllTopups(),
      this.getAllDailyRecords(),
    ]);
    const monthTopups  = topups.filter(t => t.date?.startsWith(prefix));
    const monthDaily   = daily.filter(r => r.date?.startsWith(prefix));
    return {
      totalPaid:     monthTopups.reduce((s, t) => s + (t.amount || 0), 0),
      totalConsumed: monthDaily.reduce((s, r) => s + (r.fuelCost || 0), 0),
      totalKm:       monthDaily.reduce((s, r) => s + (r.km || 0), 0),
      totalLiters:   monthDaily.reduce((s, r) => s + (r.liters || 0), 0),
      records:       monthDaily,
      topups:        monthTopups,
    };
  },
};
