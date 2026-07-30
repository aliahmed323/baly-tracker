/**
 * trips.js — إدارة الرحلات
 */

import { Database } from '../db/database.js';
import { Formatter } from '../utils/formatter.js';

export const Trips = {

  /** إضافة رحلة جديدة لليوم الحالي */
  async add({ amount, extra = 0, bonus = 0, note = '', paymentType = 'cash' }) {
    const now     = Date.now();
    const dateKey = Formatter.dateKey(now);
    return Database.addTrip({ amount, extra, bonus, note, paymentType, date: dateKey, timestamp: now });
  },

  /** إضافة رحلة بتاريخ محدد (اليوم أو أي يوم ماض) */
  async addOnDate({ amount, extra = 0, bonus = 0, note = '', paymentType = 'cash' }, dateKey) {
    const now = Date.now();
    return Database.addTrip({ amount, extra, bonus, note, paymentType, date: dateKey, timestamp: now });
  },

  /** جلب رحلة بالمعرّف */
  async get(id) {
    return Database.getTrip(id);
  },

  /** رحلات اليوم الحالي */
  async getToday() {
    const trips = await Database.getTripsByDate(Formatter.todayKey());
    return trips.sort((a, b) => a.timestamp - b.timestamp);
  },

  /** رحلات يوم محدد */
  async getByDate(dateKey) {
    const trips = await Database.getTripsByDate(dateKey);
    return trips.sort((a, b) => a.timestamp - b.timestamp);
  },

  /** رحلات شهر محدد */
  async getByMonth(year, month) {
    const all    = await Database.getAllTrips();
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return all.filter(t => t.date?.startsWith(prefix));
  },

  /** تعديل رحلة */
  async update(trip) {
    return Database.updateTrip(trip);
  },

  /** حذف رحلة */
  async delete(id) {
    return Database.deleteTrip(id);
  },

  /** جميع التواريخ التي تحتوي على رحلات (من الأحدث) */
  async getAllDates() {
    const trips = await Database.getAllTrips();
    const dates = [...new Set(trips.map(t => t.date))];
    return dates.sort((a, b) => b.localeCompare(a));
  },

  /** مجموعات الأشهر (من الأحدث) */
  async getMonthGroups() {
    const trips  = await Database.getAllTrips();
    const groups = {};

    for (const trip of trips) {
      if (!trip.date) continue;
      const [y, m] = trip.date.split('-');
      const key    = `${y}-${m}`;
      if (!groups[key]) groups[key] = { year: +y, month: +m, key, count: 0 };
      groups[key].count++;
    }

    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  },
};
