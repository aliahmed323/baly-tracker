/**
 * settings.js — إدارة الإعدادات
 */

import { Database } from '../db/database.js';

export const KEYS = {
  APP_PERCENT:    'app_percent',
  PRICE_BUTTONS:  'price_buttons',
  APP_NAME:       'app_name',
  FUEL_PRICE:     'fuel_price',
};

export const DEFAULTS = {
  [KEYS.APP_PERCENT]:   15,
  [KEYS.PRICE_BUTTONS]: [750, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000, 5250, 5500, 5750, 6000],
  [KEYS.APP_NAME]:      'بلي',
  [KEYS.FUEL_PRICE]:    750, // سعر لتر البنزين الافتراضي
};

export const Settings = {
  async get(key) {
    const val = await Database.getSetting(key);
    return val !== null && val !== undefined ? val : DEFAULTS[key];
  },

  async set(key, value) {
    return Database.setSetting(key, value);
  },

  async getAll() {
    const result = {};
    for (const key of Object.values(KEYS)) {
      result[key] = await this.get(key);
    }
    return result;
  },
};
