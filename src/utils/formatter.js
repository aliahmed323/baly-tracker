/**
 * formatter.js — تنسيق الأرقام والتواريخ
 */

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const ARABIC_DAYS = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
  'الخميس', 'الجمعة', 'السبت',
];

export const Formatter = {

  /** تنسيق المبلغ مع فواصل — بدون رمز العملة */
  num(amount) {
    if (amount == null) return '0';
    return Number(amount).toLocaleString('en-US');
  },

  /** تحويل الأرقام العربية المشرقية إلى إنجليزية، ثم تحويلها إلى رقم */
  parseArNum(val) {
    if (val == null || val === '') return NaN;
    if (typeof val === 'number') return val;
    // استبدال الأرقام الهندية/العربية
    const english = String(val).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
                               .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    return Number(english);
  },

  /** تنسيق المبلغ مع "د.ع" */
  money(amount) {
    return this.num(amount) + ' د.ع';
  },

  /** الحصول على مفتاح اليوم الحالي بصيغة YYYY-MM-DD */
  todayKey() {
    return this.dateKey(Date.now());
  },

  /** تحويل timestamp إلى مفتاح YYYY-MM-DD */
  dateKey(timestamp) {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  /** تنسيق الوقت HH:MM */
  time(timestamp) {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  /** تنسيق التاريخ بالعربي — مثل: 30 يوليو */
  dateAr(dateKey) {
    const [, m, d] = dateKey.split('-').map(Number);
    return `${d} ${ARABIC_MONTHS[m - 1]}`;
  },

  /** اسم الشهر والسنة بالعربي — مثل: يوليو 2026 */
  monthAr(year, month) {
    return `${ARABIC_MONTHS[month - 1]} ${year}`;
  },

  /** اسم اليوم بالعربي */
  dayOfWeek(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return ARABIC_DAYS[new Date(y, m - 1, d).getDay()];
  },

  /** هل هذا المفتاح هو اليوم الحالي؟ */
  isToday(dateKey) {
    return dateKey === this.todayKey();
  },

  /** الحصول على اليوم والشهر من timestamp */
  fromTimestamp(timestamp) {
    const d = new Date(timestamp);
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      day:   d.getDate(),
    };
  },

  /** تاريخ كامل للعرض — مثل: الأربعاء، 30 يوليو */
  fullDateAr(dateKey) {
    return `${this.dayOfWeek(dateKey)}، ${this.dateAr(dateKey)}`;
  },
};
