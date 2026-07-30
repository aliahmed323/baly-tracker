/**
 * app.js — التطبيق الرئيسي
 * بلي · تتبع أرباح سائق التكسي
 */

import { Database }              from './db/database.js';
import { Trips }                 from './modules/trips.js';
import { Expenses, CATEGORIES }  from './modules/expenses.js';
import { Transfers }             from './modules/transfers.js';
import { Reports }               from './modules/reports.js';
import { Settings, KEYS }        from './modules/settings.js';
import { Wallet }                from './modules/wallet.js';
import { Formatter }             from './utils/formatter.js';

// ══════════════════════════════════════════════════
// الحالة العامة للتطبيق
// ══════════════════════════════════════════════════
const S = {
  screen:        'home',    // الشاشة الحالية
  pendingTrip:   null,      // الرحلة المعلقة قبل التأكيد
  lastTripId:    null,      // آخر رحلة محفوظة (للتراجع)
  countdown:     null,      // مؤقت الحفظ التلقائي (5 ثوانٍ)
  countdownVal:  5,
  toast:         null,      // مؤقت اختفاء Toast
  historyTab:    'days',    // تبويب السجل الحالي
  viewingDate:   null,      // اليوم المعروض في التفاصيل
  editTrip:      null,      // الرحلة قيد التعديل
  numpadValue:   '',        // قيمة الـ Numpad
  numpadMode:    null,      // وضع الـ Numpad
  expenseCat:    null,      // فئة المصروف المختارة
  selectedEnv:   null,      // الصندوق المحدد حالياً للتحويل أو الصرف
  paymentType:   'cash',    // نوع دفع الرحلة: 'cash' أو 'app'
  customDate:    null,      // تاريخ مخصص للرحلة (افتراضي: اليوم)
};

// ══════════════════════════════════════════════════
// مساعدات DOM
// ══════════════════════════════════════════════════
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ══════════════════════════════════════════════════
// إدارة الشاشات
// ══════════════════════════════════════════════════
function showScreen(id) {
  // لا تعيد تحميل نفس الشاشة إلا للتحديث الإجباري
  S.screen = id;

  $$('.screen').forEach(s => s.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  const screen = $(`#screen-${id}`);
  const navBtn  = $(`.nav-item[data-screen="${id}"]`);

  if (screen) screen.classList.add('active');
  if (navBtn)  navBtn.classList.add('active');

  switch (id) {
    case 'home':     renderHome();    break;
    case 'today':    renderToday();   break;
    case 'history':  renderHistory(); break;
    case 'wallet':   renderWallet();  break;
    case 'settings': renderSettings(); break;
  }
}

// ══════════════════════════════════════════════════
// إدارة النوافذ المنبثقة
// ══════════════════════════════════════════════════
function openModal(id) {
  const el = $(`#modal-${id}`);
  if (!el) return;
  el.classList.add('open');
}

function closeModal(id) {
  const el = $(`#modal-${id}`);
  if (el) el.classList.remove('open');
}

function closeAllModals() {
  $$('.modal-overlay').forEach(m => m.classList.remove('open'));
  stopCountdown();
}

// ══════════════════════════════════════════════════
// الشاشة الرئيسية — Home
// ══════════════════════════════════════════════════
async function renderHome() {
  // ضبط التاريخ
  const today = new Date();
  const days   = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','إبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const dateEl = $('#home-date');
  if (dateEl) dateEl.textContent = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;

  // أزرار الأسعار
  const prices = await Settings.get(KEYS.PRICE_BUTTONS);
  const grid   = $('#price-grid');
  if (grid) {
    grid.innerHTML = prices.map(p =>
      `<button class="price-btn" onclick="App.pressPrice(${p})">${Formatter.num(p)}</button>`
    ).join('');
  }

  await refreshHomeStats();
}

async function refreshHomeStats() {
  const { stats } = await Reports.getToday();
  const tripsEl  = $('#qs-trips');
  const profitEl = $('#qs-profit');
  if (tripsEl)  tripsEl.textContent  = stats.tripCount;
  if (profitEl) profitEl.textContent = Formatter.num(stats.cashInHand);
}

// ══════════════════════════════════════════════════
// نافذة تأكيد الرحلة
// ══════════════════════════════════════════════════
function pressPrice(amount) {
  S.pendingTrip  = { amount, extra: 0, bonus: 0 };
  S.paymentType  = 'cash';
  S.customDate   = null;

  // عرض المبلغ في النافذة
  const el = $('#confirm-amount');
  if (el) el.innerHTML = Formatter.num(amount) + ' <small>د.ع</small>';

  // ضبط زري نوع الدفع
  $('#pay-cash')?.classList.add('active');
  $('#pay-app')?.classList.remove('active');

  // ضبط حقل التاريخ لليوم الحالي
  const dateInput = $('#confirm-date');
  if (dateInput) dateInput.value = Formatter.todayKey();

  openModal('confirm');
  startCountdown();
}

function startCountdown() {
  S.countdownVal = 5;
  updateCountdownRing();

  S.countdown = setInterval(() => {
    S.countdownVal--;
    updateCountdownRing();
    if (S.countdownVal <= 0) {
      stopCountdown();
      commitTrip();
    }
  }, 1000);
}

function stopCountdown() {
  if (S.countdown) {
    clearInterval(S.countdown);
    S.countdown = null;
  }
}

function updateCountdownRing() {
  const ring = $('.c-progress');
  const num  = $('#countdown-num');
  if (ring) {
    const pct    = S.countdownVal / 5;
    const offset = 66 - pct * 66;
    ring.style.strokeDashoffset = offset;
  }
  if (num) num.textContent = S.countdownVal;
}

function confirmTrip() {
  stopCountdown();
  commitTrip();
}

async function commitTrip() {
  closeAllModals();
  if (!S.pendingTrip) return;

  const { amount, extra, bonus } = S.pendingTrip;
  const paymentType = S.paymentType || 'cash';
  const tripDate    = S.customDate  || Formatter.todayKey();

  S.pendingTrip = null;
  S.customDate  = null;
  S.paymentType = 'cash';

  const trip = await Trips.addOnDate({ amount, extra, bonus, paymentType }, tripDate);
  S.lastTripId = trip.id;

  await refreshHomeStats();
  if (S.screen === 'today') renderToday();

  showTripToast(amount + extra + bonus, paymentType);
}

// تغيير نوع الدفع (كاش / رصيد بلي)
function setPayType(type) {
  S.paymentType = type;
  $('#pay-cash')?.classList.toggle('active', type === 'cash');
  $('#pay-app')?.classList.toggle('active',  type === 'app');
}

// تغيير تاريخ الرحلة
function setTripDate(dateStr) {
  S.customDate = dateStr || Formatter.todayKey();
}

// ══════════════════════════════════════════════════
// نافذة الزيادة
// ══════════════════════════════════════════════════
function openExtraModal() {
  stopCountdown();
  closeModal('confirm');
  openModal('extra');
}

function pickExtra(amount) {
  if (S.pendingTrip) S.pendingTrip.extra = amount;
  closeModal('extra');
  commitTrip();
}

// ══════════════════════════════════════════════════
// نافذة المكافأة
// ══════════════════════════════════════════════════
function openBonusModal() {
  stopCountdown();
  closeModal('confirm');
  openModal('bonus');
}

function pickBonus(amount) {
  if (S.pendingTrip) S.pendingTrip.bonus = amount;
  closeModal('bonus');
  commitTrip();
}

// ══════════════════════════════════════════════════
// Numpad العام (للمبالغ المخصصة)
// ══════════════════════════════════════════════════
const NUMPAD_TITLES = {
  extra:    'زيادة من الزبون ➕',
  bonus:    'مكافأة 🎁',
  expense:  'مبلغ المصروف 💸',
  zaincash: 'تحويل زين كاش 💳',
};

function openNumpad(mode) {
  S.numpadMode  = mode;
  S.numpadValue = '';
  refreshNumpad();

  const title = $('#numpad-title');
  if (title) title.textContent = NUMPAD_TITLES[mode] || 'أدخل المبلغ';

  openModal('numpad');
}

function numpadPress(key) {
  if (key === '⌫') {
    S.numpadValue = S.numpadValue.slice(0, -1);
  } else if (key === '✓') {
    confirmNumpad();
    return;
  } else {
    if (S.numpadValue.length >= 7) return;
    S.numpadValue += key;
  }
  refreshNumpad();
}

function refreshNumpad() {
  const disp = $('#numpad-display');
  if (!disp) return;
  const val = Number(S.numpadValue);
  if (!S.numpadValue) {
    disp.textContent = '0';
    disp.classList.add('empty');
  } else {
    disp.textContent = Formatter.num(val);
    disp.classList.remove('empty');
  }
}

async function confirmNumpad() {
  const amount = Number(S.numpadValue);
  const mode   = S.numpadMode;
  closeModal('numpad');
  S.numpadValue = '';
  S.numpadMode  = null;

  if (!amount || amount <= 0) return;

  switch (mode) {
    case 'extra':
      pickExtra(amount);
      break;
    case 'bonus':
      pickBonus(amount);
      break;
    case 'expense':
      await saveExpense(amount);
      break;
    case 'zaincash':
      await saveTransfer(amount);
      break;
    case 'past_trip':
      S.pendingTrip.amount = amount;
      const el = $('#confirm-amount');
      if (el) el.innerHTML = Formatter.num(amount) + ' <small>د.ع</small>';
      $('#pay-cash')?.classList.add('active');
      $('#pay-app')?.classList.remove('active');
      const dateInput = $('#confirm-date');
      if (dateInput) dateInput.value = S.customDate;
      openModal('confirm');
      startCountdown();
      break;
  }
}

// ══════════════════════════════════════════════════
// المصاريف
// ══════════════════════════════════════════════════
function openExpenseModal() {
  openModal('expense');
}

function pickExpenseCategory(catId) {
  S.expenseCat = catId;
  closeModal('expense');
  openNumpad('expense');
}

async function saveExpense(amount) {
  if (!S.expenseCat) return;
  await Expenses.add({ category: S.expenseCat, amount });
  S.expenseCat = null;
  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
  flashToast('✅ تم حفظ المصروف', '');
}

// ══════════════════════════════════════════════════
// تحويل زين كاش
// ══════════════════════════════════════════════════
function openZainCashModal() {
  openNumpad('zaincash');
}

async function saveTransfer(amount) {
  await Transfers.add({ amount });
  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
  flashToast('💳 تم حفظ التحويل', '');
}

// ══════════════════════════════════════════════════
// Toast الإشعار
// ══════════════════════════════════════════════════
function showTripToast(total, paymentType = 'cash') {
  const toast    = $('#toast');
  const amountEl = $('#toast-amount');
  const editBtn  = $('#toast-edit');
  const undoBtn  = $('#toast-undo');

  if (amountEl) amountEl.textContent = Formatter.num(total) + ' د.ع';
  if (editBtn)  editBtn.style.display = '';
  if (undoBtn)  undoBtn.textContent   = 'تراجع';

  const textEl = $('#toast-text');
  if (textEl) textEl.textContent = paymentType === 'app'
    ? '📱 رحلة رصيد بلي — تم الحفظ'
    : '✅ تم حفظ الرحلة';

  if (toast) toast.classList.add('show');

  clearTimeout(S.toast);
  S.toast = setTimeout(hideToast, 10000);
}

function flashToast(text, amount) {
  const toast    = $('#toast');
  const amountEl = $('#toast-amount');
  const textEl   = $('#toast-text');
  const editBtn  = $('#toast-edit');

  if (textEl)   textEl.textContent   = text;
  if (amountEl) amountEl.textContent = amount;
  if (editBtn)  editBtn.style.display = 'none';

  if (toast) toast.classList.add('show');

  clearTimeout(S.toast);
  S.toast = setTimeout(hideToast, 3000);
}

function hideToast() {
  const toast = $('#toast');
  if (toast) toast.classList.remove('show');
}

// ══════════════════════════════════════════════════
// تعديل رحلة
// ══════════════════════════════════════════════════
async function openEditTrip(tripId) {
  const trip = await Trips.get(tripId);
  if (!trip) return;

  S.editTrip = trip;

  const f = n => n || '';
  $('#ea-amount').value = f(trip.amount);
  $('#ea-extra').value  = f(trip.extra);
  $('#ea-bonus').value  = f(trip.bonus);
  $('#ea-note').value   = f(trip.note);

  openModal('edit');
}

async function saveEditTrip() {
  if (!S.editTrip) return;

  const updated = {
    ...S.editTrip,
    amount: Number($('#ea-amount').value) || S.editTrip.amount,
    extra:  Number($('#ea-extra').value)  || 0,
    bonus:  Number($('#ea-bonus').value)  || 0,
    note:   $('#ea-note').value || '',
  };

  await Trips.update(updated);
  closeModal('edit');
  S.editTrip = null;

  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
  if (S.viewingDate) openDay(S.viewingDate);

  flashToast('✅ تم تعديل الرحلة', '');
}

async function deleteEditTrip() {
  if (!S.editTrip) return;
  if (!confirm('هل تريد حذف هذه الرحلة؟')) return;

  await Trips.delete(S.editTrip.id);
  closeModal('edit');

  if (S.lastTripId === S.editTrip.id) S.lastTripId = null;
  S.editTrip = null;

  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
  if (S.viewingDate) openDay(S.viewingDate);

  flashToast('🗑️ تم حذف الرحلة', '');
}

async function undoLastTrip() {
  if (!S.lastTripId) return;
  await Trips.delete(S.lastTripId);
  S.lastTripId = null;
  hideToast();
  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
}

// ══════════════════════════════════════════════════
// شاشة اليوم
// ══════════════════════════════════════════════════
async function renderToday() {
  const { stats, trips, expenses, transfers } = await Reports.getToday();

  // البطل الرئيسي
  setEl('#today-cash', Formatter.num(stats.cashInHand));
  const cashEl = $('#today-cash');
  if (cashEl) {
    cashEl.className = 'today-hero-value' + (stats.cashInHand < 0 ? ' negative' : '');
  }

  // شبكة الإحصائيات
  setEl('#td-count',     stats.tripCount);
  setEl('#td-fares',     Formatter.num(stats.totalFares));
  setEl('#td-extras',    Formatter.num(stats.totalExtras + stats.totalBonuses));
  setEl('#td-fee',       '-' + Formatter.num(stats.appFee));
  setEl('#td-expenses',  '-' + Formatter.num(stats.totalExpenses));
  setEl('#td-transfers', Formatter.num(stats.totalTransfers));
  setEl('#td-net',       Formatter.num(stats.netProfit));

  // قوائم
  renderTripCards(trips, '#today-trips-list');
  renderExpenseCards(expenses, '#today-exp-list');
  renderTransferCards(transfers, '#today-trans-list');
}

function setEl(sel, val) {
  const el = $(sel);
  if (el) el.textContent = val;
}

// ══════════════════════════════════════════════════
// بطاقات الرحلات
// ══════════════════════════════════════════════════
function renderTripCards(trips, containerSel) {
  const c = $(containerSel);
  if (!c) return;

  if (!trips.length) {
    c.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚕</div>
        <div class="empty-text">لا توجد رحلات</div>
        <div class="empty-sub">اضغط على أي مبلغ لتسجيل رحلة</div>
      </div>`;
    return;
  }

  c.innerHTML = trips.map((t, i) => {
    const total  = t.amount + (t.extra || 0) + (t.bonus || 0);
    const hasTip = (t.extra || 0) + (t.bonus || 0) > 0;
    const isApp  = t.paymentType === 'app';
    const badges = [
      isApp                ? `<span class="badge badge-app-pay">📱 رصيد بلي</span>`            : '',
      t.extra              ? `<span class="badge badge-extra">+${Formatter.num(t.extra)}</span>` : '',
      t.bonus              ? `<span class="badge badge-bonus">🎁 ${Formatter.num(t.bonus)}</span>` : '',
      t.note               ? `<span class="badge badge-note">📝 ${t.note}</span>`                : '',
    ].filter(Boolean).join('');

    return `
      <div class="trip-card fade-up" onclick="App.editTrip(${t.id})">
        <div class="trip-num" style="${isApp ? 'background:var(--info-bg);color:var(--info)' : ''}">${i + 1}</div>
        <div class="trip-info">
          <div class="trip-amount">${Formatter.num(t.amount)} <small>د.ع</small></div>
          ${badges ? `<div class="trip-badges">${badges}</div>` : ''}
        </div>
        <div class="trip-right">
          <div class="trip-total ${!hasTip ? 'same' : ''}">${Formatter.num(total)}</div>
          <div class="trip-time">${Formatter.time(t.timestamp)}</div>
        </div>
      </div>`;
  }).join('');
}

function renderExpenseCards(expenses, containerSel) {
  const c = $(containerSel);
  if (!c) return;

  if (!expenses.length) { c.innerHTML = ''; return; }

  c.innerHTML = expenses.map(e => {
    const cat = Expenses.getCategory(e.category);
    return `
      <div class="trip-card fade-up">
        <div class="trip-num" style="background:var(--danger-bg);color:var(--danger)">${cat.icon}</div>
        <div class="trip-info">
          <div class="trip-amount" style="font-size:16px">${cat.name}</div>
          ${e.note ? `<div class="trip-badges"><span class="badge badge-note">📝 ${e.note}</span></div>` : ''}
        </div>
        <div class="trip-right">
          <div class="trip-total" style="color:var(--danger)">-${Formatter.num(e.amount)}</div>
          <div class="trip-time">${Formatter.time(e.timestamp)}</div>
        </div>
      </div>`;
  }).join('');
}

function renderTransferCards(transfers, containerSel) {
  const c = $(containerSel);
  if (!c) return;

  if (!transfers.length) { c.innerHTML = ''; return; }

  c.innerHTML = transfers.map(t => `
    <div class="trip-card fade-up">
      <div class="trip-num" style="background:var(--info-bg);color:var(--info)">💳</div>
      <div class="trip-info">
        <div class="trip-amount" style="font-size:16px">زين كاش</div>
        ${t.note ? `<div class="trip-badges"><span class="badge badge-note">${t.note}</span></div>` : ''}
      </div>
      <div class="trip-right">
        <div class="trip-total" style="color:var(--info)">${Formatter.num(t.amount)}</div>
        <div class="trip-time">${Formatter.time(t.timestamp)}</div>
      </div>
    </div>`).join('');
}

// ══════════════════════════════════════════════════
// شاشة السجل
// ══════════════════════════════════════════════════
async function renderHistory() {
  // إعادة بناء محتوى السجل إذا كنا نعرض قائمة (ليس تفاصيل يوم)
  if (S.viewingDate) {
    S.viewingDate = null;
    resetHistoryContent();
  }

  const daysList    = $('#history-days-list');
  const monthsList  = $('#history-months-list');
  if (!daysList || !monthsList) return;

  if (S.historyTab === 'days') {
    daysList.style.display   = '';
    monthsList.style.display = 'none';
    renderHistoryDays(daysList);
  } else {
    daysList.style.display   = 'none';
    monthsList.style.display = '';
    renderHistoryMonths(monthsList);
  }
}

async function renderHistoryDays(container) {
  container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  const days = await Reports.getAllDays();

  if (!days.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-text">لا يوجد سجل بعد</div>
        <div class="empty-sub">ابدأ بتسجيل رحلاتك من الشاشة الرئيسية</div>
      </div>`;
    return;
  }

  container.innerHTML = days.map((day) => {
    const isToday = Formatter.isToday(day.date);
    const dotColor = isToday ? 'var(--success)' : 'var(--primary)';
    const label    = isToday
      ? '<span style="color:var(--success)">اليوم</span>'
      : `${Formatter.dateAr(day.date)} <span style="color:var(--text-muted);font-size:13px">${Formatter.dayOfWeek(day.date)}</span>`;

    return `
      <div class="history-card fade-up" onclick="App.openDay('${day.date}')">
        <div class="history-dot" style="background:${dotColor}"></div>
        <div class="history-info">
          <div class="history-date">${label}</div>
          <div class="history-meta">${day.stats.tripCount} رحلة · ${Formatter.num(day.stats.totalFares)} أجور</div>
        </div>
        <div class="history-right">
          <div class="history-amount" style="color:${day.stats.cashInHand >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${Formatter.num(day.stats.cashInHand)}
          </div>
          <div class="history-sub">معك الآن</div>
        </div>
      </div>`;
  }).join('');
}

async function renderHistoryMonths(container) {
  container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';

  const months = await Reports.getAllMonths();

  if (!months.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-text">لا يوجد سجل بعد</div>
      </div>`;
    return;
  }

  container.innerHTML = months.map(m => `
    <div class="history-card fade-up" onclick="App.openMonth(${m.year}, ${m.month})">
      <div class="history-dot" style="background:var(--info)"></div>
      <div class="history-info">
        <div class="history-date">${Formatter.monthAr(m.year, m.month)}</div>
        <div class="history-meta">${m.stats.tripCount} رحلة · ${m.stats.workDays} يوم عمل</div>
      </div>
      <div class="history-right">
        <div class="history-amount" style="color:${m.stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${Formatter.num(m.stats.netProfit)}
        </div>
        <div class="history-sub">صافي</div>
      </div>
    </div>`).join('');
}

// ── تفاصيل يوم محدد ─────────────────────────────
async function openDay(dateKey) {
  S.viewingDate = dateKey;

  const { stats, trips, expenses, transfers } = await Reports.getDay(dateKey);
  const isToday = Formatter.isToday(dateKey);

  const screen = $('#screen-history');
  const content = $('.screen-content', screen);
  if (!content) return;

  const title = isToday ? 'اليوم' : Formatter.fullDateAr(dateKey);

  content.innerHTML = `
    <div class="section-header" style="padding-top:18px">
      <button class="back-btn" onclick="App.backHistory()">→ السجل</button>
      <div class="section-title">${title}</div>
      <div></div>
    </div>

    <div class="today-hero" style="margin:0 16px 12px">
      <div class="today-hero-label">💰 المبلغ الموجود</div>
      <div class="today-hero-value ${stats.cashInHand < 0 ? 'negative' : ''}">${Formatter.num(stats.cashInHand)}</div>
      <div class="today-hero-currency">دينار عراقي</div>
    </div>

    <div class="today-stats-grid">
      <div class="stat-card"><div class="stat-label">عدد الرحلات</div><div class="stat-value primary">${stats.tripCount}</div></div>
      <div class="stat-card"><div class="stat-label">إجمالي الأجور</div><div class="stat-value">${Formatter.num(stats.totalFares)}</div></div>
      <div class="stat-card"><div class="stat-label">الزيادات والمكافآت</div><div class="stat-value success">+${Formatter.num(stats.totalExtras + stats.totalBonuses)}</div></div>
      <div class="stat-card"><div class="stat-label">نسبة بلي (15%)</div><div class="stat-value danger">-${Formatter.num(stats.appFee)}</div></div>
      <div class="stat-card"><div class="stat-label">المصاريف</div><div class="stat-value danger">-${Formatter.num(stats.totalExpenses)}</div></div>
      <div class="stat-card"><div class="stat-label">تحويلات زين كاش</div><div class="stat-value info">${Formatter.num(stats.totalTransfers)}</div></div>
      <div class="stat-card full-width"><div class="stat-label">صافي الأرباح</div><div class="stat-value success big">${Formatter.num(stats.netProfit)}</div></div>
    </div>

    <div class="section-header">
    <div class="section-header">
      <div class="section-title">الرحلات (${trips.length})</div>
      <button class="small-btn" onclick="App.openDayAddTrip('${dateKey}')">+ إضافة</button>
    </div>
    <div class="trips-list" id="day-trips-container"></div>

    ${expenses.length ? `
    <div class="section-header">
      <div class="section-title">المصاريف</div>
    </div>
    <div class="trips-list" id="day-exp-container"></div>
    ` : ''}

    <div class="spacer"></div>
  `;

  renderTripCards(trips, '#day-trips-container');
  if (expenses.length) renderExpenseCards(expenses, '#day-exp-container');
}

// فتح نافذة إضافة رحلة ليوم ماضٍ مباشرةً
function openDayAddTrip(dateKey) {
  // نحضّر الـ pending trip بصفر ونضع التاريخ المحدد
  S.pendingTrip = { amount: 0, extra: 0, bonus: 0 };
  S.paymentType = 'cash';
  S.customDate  = dateKey;

  // نفتح نافذة إدخال مبلغ مخصص (Numpad)
  S.numpadMode  = 'past_trip';
  S.numpadValue = '';
  refreshNumpad();

  const title = $('#numpad-title');
  if (title) title.textContent = `رحلة ${Formatter.dateAr(dateKey)} 🚕`;

  openModal('numpad');
}

// ── تفاصيل شهر محدد ─────────────────────────────
async function openMonth(year, month) {
  const { stats } = await Reports.getMonth(year, month);

  const screen  = $('#screen-history');
  const content = $('.screen-content', screen);
  if (!content) return;

  content.innerHTML = `
    <div class="section-header" style="padding-top:18px">
      <button class="back-btn" onclick="App.backHistory()">→ السجل</button>
      <div class="section-title">${Formatter.monthAr(year, month)}</div>
      <div></div>
    </div>

    <div class="today-hero" style="margin:0 16px 12px">
      <div class="today-hero-label">📊 صافي الأرباح الشهرية</div>
      <div class="today-hero-value ${stats.netProfit < 0 ? 'negative' : ''}">${Formatter.num(stats.netProfit)}</div>
      <div class="today-hero-currency">دينار عراقي</div>
    </div>

    <div class="today-stats-grid">
      <div class="stat-card"><div class="stat-label">عدد الرحلات</div><div class="stat-value primary">${stats.tripCount}</div></div>
      <div class="stat-card"><div class="stat-label">أيام العمل</div><div class="stat-value">${stats.workDays}</div></div>
      <div class="stat-card"><div class="stat-label">إجمالي الأجور</div><div class="stat-value">${Formatter.num(stats.totalFares)}</div></div>
      <div class="stat-card"><div class="stat-label">الزيادات والمكافآت</div><div class="stat-value success">+${Formatter.num(stats.totalExtras + stats.totalBonuses)}</div></div>
      <div class="stat-card"><div class="stat-label">نسبة بلي (15%)</div><div class="stat-value danger">-${Formatter.num(stats.appFee)}</div></div>
      <div class="stat-card"><div class="stat-label">المصاريف</div><div class="stat-value danger">-${Formatter.num(stats.totalExpenses)}</div></div>
      <div class="stat-card"><div class="stat-label">تحويلات زين كاش</div><div class="stat-value info">${Formatter.num(stats.totalTransfers)}</div></div>
      <div class="stat-card full-width"><div class="stat-label">متوسط الربح اليومي</div><div class="stat-value success big">${Formatter.num(stats.avgDailyProfit)}</div></div>
    </div>

    <div class="spacer"></div>
  `;
}

// ── العودة لقائمة السجل ──────────────────────────
function backHistory() {
  S.viewingDate = null;
  resetHistoryContent();
  renderHistory();
}

function resetHistoryContent() {
  const screen  = $('#screen-history');
  const content = $('.screen-content', screen);
  if (!content) return;

  content.innerHTML = `
    <div class="history-tabs">
      <button class="history-tab ${S.historyTab === 'days' ? 'active' : ''}" onclick="App.switchTab('days')">الأيام</button>
      <button class="history-tab ${S.historyTab === 'months' ? 'active' : ''}" onclick="App.switchTab('months')">الأشهر</button>
    </div>
    <div id="history-days-list"   class="history-list"></div>
    <div id="history-months-list" class="history-list"></div>
    <div class="spacer"></div>
  `;
}

function switchTab(tab) {
  S.historyTab = tab;
  $$('.history-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(tab === 'days' ? 'الأيام' : 'الأشهر')));
  renderHistory();
}

// ══════════════════════════════════════════════════
// شاشة المحفظة والصناديق
// ══════════════════════════════════════════════════

// ألوان الصناديق بالتناوب
const ENV_COLORS = [
  { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  { bg: 'rgba(20,184,166,0.15)',  color: '#14b8a6' },
];

async function renderWallet() {
  const stats = await Wallet.getStats();

  // تحديث بطاقتَي الرصيد
  setEl('#wallet-total-cash',  Formatter.num(stats.currentPhysicalCash));
  setEl('#wallet-unallocated', Formatter.num(stats.unallocated));

  // تلوين الرصيد الحر
  const freeEl = $('#wallet-unallocated');
  if (freeEl) freeEl.className = 'ws-amount ' + (stats.unallocated >= 0 ? 'green' : 'danger');

  const container = $('#wallet-envelopes-list');
  if (!container) return;

  if (!stats.envelopes.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin:8px 0 16px">
        <div class="empty-icon">💼</div>
        <div class="empty-text">لا توجد صناديق بعد</div>
        <div class="empty-sub">أنشئ صندوقاً لتنظيم أموالك مثل (قرض، إيجار، منزل)</div>
      </div>`;
    return;
  }

  container.innerHTML = stats.envelopes.map((env, i) => {
    const clr = ENV_COLORS[i % ENV_COLORS.length];
    const pct = env.target > 0
      ? Math.min(100, Math.round((env.balance / env.target) * 100))
      : 0;

    return `
    <div class="env-card fade-up">
      <div class="env-card-top">
        <div class="env-icon-wrap" style="background:${clr.bg}">${env.icon}</div>
        <div class="env-card-body">
          <div class="env-name">${env.name}</div>
          <div class="env-balance-row">
            <span class="env-balance" style="color:${clr.color}">${Formatter.num(env.balance)}</span>
            <span class="env-currency">د.ع</span>
          </div>
        </div>
      </div>
      ${env.target > 0 ? `
      <div class="env-progress-bar">
        <div class="env-progress-fill" style="width:${pct}%;background:${clr.color}"></div>
      </div>` : ''}
      <div class="env-actions">
        <button class="env-action-btn deposit" onclick="App.openTransferEnv('${env.id}')">
          📥 إيداع
        </button>
        <button class="env-action-btn spend" onclick="App.openExpenseEnv('${env.id}')">
          💸 صرف
        </button>
      </div>
    </div>`;
  }).join('');
}

async function newEnvelope() {
  const name = prompt('اسم الصندوق الجديد (مثلاً: مصاريف المنزل):');
  if (!name) return;
  const icon = prompt('رمز تعبيري للصندوق (اختياري):', '💰') || '💰';
  
  await Wallet.addEnvelope({ name, icon, target: 0 });
  
  // إذا كان الاسم يحتوي على كلمة "منزل"، نُعلّمه ليظهر في تقارير المنزل الخاصة
  if (name.includes('منزل')) {
    const envs = await Wallet.getEnvelopes();
    const last = envs[envs.length - 1];
    last.isHome = true;
    await Wallet.updateEnvelope(last);
  }

  renderWallet();
  flashToast('✅ تم إنشاء الصندوق', '');
}

function openTransferEnv(id) {
  S.selectedEnv = id;
  $('#env-transfer-amount').value = '';
  openModal('transfer-env');
}

async function confirmTransferEnv() {
  const amt = Number($('#env-transfer-amount').value);
  if (!amt || amt <= 0) return;

  try {
    await Wallet.transferToEnvelope(S.selectedEnv, amt);
    closeModal('transfer-env');
    S.selectedEnv = null;
    renderWallet();
    flashToast('📥 تم إيداع المبلغ في الصندوق', '');
  } catch (e) {
    alert(e.message);
  }
}

function openExpenseEnv(id) {
  S.selectedEnv = id;
  $('#env-exp-amount').value = '';
  $('#env-exp-note').value = '';
  openModal('expense-env');
}

async function confirmExpenseEnv() {
  const amt = Number($('#env-exp-amount').value);
  const note = $('#env-exp-note').value;
  if (!amt || amt <= 0) return;

  try {
    await Wallet.addExpenseFromEnvelope(S.selectedEnv, amt, note);
    closeModal('expense-env');
    S.selectedEnv = null;
    renderWallet();
    flashToast('💸 تم تسجيل مصروف الصندوق', '');
  } catch (e) {
    alert(e.message);
  }
}

// ══════════════════════════════════════════════════
// الوقود التلقائي
// ══════════════════════════════════════════════════
function openFuel() {
  $('#fuel-km').value = '';
  $('#fuel-rate').value = '';
  $('#fuel-note').value = '';
  openModal('fuel');
}

async function saveAutoFuel() {
  const km = Number($('#fuel-km').value);
  const rate = Number($('#fuel-rate').value);
  const note = $('#fuel-note').value;

  if (!km || !rate || rate <= 0) {
    alert('يرجى إدخال المسافة ومعدل الاستهلاك بشكل صحيح.');
    return;
  }

  const fuelPrice = await Settings.get(KEYS.FUEL_PRICE) || 750;
  
  // المعادلة: (المسافة المقطوعة / الاستهلاك باللتر) * سعر اللتر
  const totalCost = Math.round((km / rate) * fuelPrice);

  await Expenses.add({ 
    category: 'fuel', 
    amount: totalCost, 
    note: note ? (note + ` (${km}كم)`) : `وقود التلقائي (${km}كم)`
  });

  closeModal('fuel');
  await refreshHomeStats();
  if (S.screen === 'today') renderToday();
  flashToast('⛽ تم إضافة مصروف الوقود', Formatter.num(totalCost));
}

// ══════════════════════════════════════════════════
// الإعدادات
// ══════════════════════════════════════════════════
async function renderSettings() {
  const pct = await Settings.get(KEYS.APP_PERCENT);
  const fuelPrice = await Settings.get(KEYS.FUEL_PRICE);
  setEl('#settings-pct', pct + '%');
  setEl('#settings-fuel', Formatter.num(fuelPrice) + ' د.ع');
}

async function changePercent() {
  const current = await Settings.get(KEYS.APP_PERCENT);
  const val = prompt(`نسبة تطبيق بلي (%):\nالحالية: ${current}%`, current);
  if (val !== null && !isNaN(Number(val)) && Number(val) > 0) {
    await Settings.set(KEYS.APP_PERCENT, Number(val));
    renderSettings();
    flashToast('✅ تم تعديل النسبة', '');
  }
}

async function changeFuelPrice() {
  const current = await Settings.get(KEYS.FUEL_PRICE);
  const val = prompt(`سعر لتر الوقود (دينار):\nالحالي: ${current}`, current);
  if (val !== null && !isNaN(Number(val)) && Number(val) > 0) {
    await Settings.set(KEYS.FUEL_PRICE, Number(val));
    renderSettings();
    flashToast('✅ تم تعديل سعر الوقود', '');
  }
}

async function exportBackup() {
  try {
    const [trips, expenses, transfers] = await Promise.all([
      Trips.getToday(),
      Expenses.getToday(),
      Transfers.getToday(),
    ]);
    // تصدير كل البيانات
    const allTrips     = await (await import('./db/database.js')).Database.getAllTrips();
    const allExpenses  = await (await import('./db/database.js')).Database.getAllExpenses();
    const allTransfers = await (await import('./db/database.js')).Database.getAllTransfers();

    const data = {
      version:    '1.0',
      exportDate: new Date().toISOString(),
      trips:      allTrips,
      expenses:   allExpenses,
      transfers:  allTransfers,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `baly-backup-${Formatter.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashToast('📦 تم تصدير البيانات', '');
  } catch (e) {
    flashToast('❌ حدث خطأ في التصدير', '');
  }
}

// ══════════════════════════════════════════════════
// تهيئة التطبيق
// ══════════════════════════════════════════════════
async function init() {
  try {
    await Database.init();
  } catch (e) {
    console.error('DB init failed:', e);
  }

  // تهيئة محتوى شاشة السجل
  resetHistoryContent();

  // بدء بالشاشة الرئيسية
  showScreen('home');

  // تسجيل Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ══════════════════════════════════════════════════
// الواجهة العامة — تُستدعى من HTML
// ══════════════════════════════════════════════════
window.App = {
  // تنقل
  goto:       showScreen,

  // شاشة رئيسية
  pressPrice: (p)  => pressPrice(p),

  // تأكيد رحلة
  confirm:    ()   => confirmTrip(),
  openExtra:  ()   => openExtraModal(),
  openBonus:  ()   => openBonusModal(),
  pickExtra:  (a)  => pickExtra(a),
  pickBonus:  (a)  => pickBonus(a),
  openCustomExtra: () => { closeModal('extra'); openNumpad('extra'); },
  openCustomBonus: () => { closeModal('bonus'); openNumpad('bonus'); },
  setPayType: (t)  => setPayType(t),
  setTripDate:(d)  => setTripDate(d),
  openDayAddTrip: (d) => openDayAddTrip(d),

  // نامباد
  numpad:     (k)  => numpadPress(k),

  // مصاريف وتحويلات
  openExpense: ()       => openExpenseModal(),
  pickCat:    (id)     => pickExpenseCategory(id),
  openZain:   ()       => openZainCashModal(),

  // وقود تلقائي
  openFuel:     () => openFuel(),
  saveAutoFuel: () => saveAutoFuel(),

  // المحفظة
  newEnvelope:        () => newEnvelope(),
  openTransferEnv:    (id) => openTransferEnv(id),
  confirmTransferEnv: () => confirmTransferEnv(),
  openExpenseEnv:     (id) => openExpenseEnv(id),
  confirmExpenseEnv:  () => confirmExpenseEnv(),

  // Toast
  editLast:   ()   => { if (S.lastTripId) { hideToast(); openEditTrip(S.lastTripId); } },
  undoLast:   ()   => undoLastTrip(),
  hideToast:  ()   => hideToast(),

  // تعديل
  editTrip:   (id) => openEditTrip(id),
  saveEdit:   ()   => saveEditTrip(),
  deleteTrip: ()   => deleteEditTrip(),

  // سجل
  openDay:    (d)      => openDay(d),
  openMonth:  (y, m)   => openMonth(y, m),
  backHistory:()       => backHistory(),
  switchTab:  (t)      => switchTab(t),

  // إعدادات
  changePercent: () => changePercent(),
  changeFuelPrice: () => changeFuelPrice(),
  exportBackup:  () => exportBackup(),

  // إغلاق النوافذ
  close: () => closeAllModals(),
};

// بدء التطبيق
document.addEventListener('DOMContentLoaded', init);
