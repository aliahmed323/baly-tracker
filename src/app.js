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
import { BalyBalance }           from './modules/balyBalance.js';
import { DailyBalance }          from './modules/dailyBalance.js';
import { ZainWallet }            from './modules/zainWallet.js';
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
  S.customDate   = null;

  // عرض المبلغ في النافذة
  const el = $('#confirm-amount');
  if (el) el.innerHTML = Formatter.num(amount) + ' <small>د.ع</small>';

  // تعيين الكاش الافتراضي لنفس المبلغ
  const cashInput = $('#confirm-cash');
  if (cashInput) cashInput.value = amount;

  // ضبط حقل التاريخ لليوم الحالي
  const dateInput = $('#confirm-date');
  if (dateInput) dateInput.value = Formatter.todayKey();

  openModal('confirm');
}

// لم نعد نستخدم العداد التلقائي
function startCountdown() {}
function stopCountdown() {}
function updateCountdownRing() {}

function confirmTrip() {
  commitTrip();
}

async function commitTrip() {
  closeAllModals();
  if (!S.pendingTrip) return;

  const { amount, extra, bonus } = S.pendingTrip;
  
  const cashInput = $('#confirm-cash');
  const cashReceived = cashInput && cashInput.value !== '' ? Number(cashInput.value) : amount;
  
  const tripDate = S.customDate || Formatter.todayKey();

  S.pendingTrip = null;
  S.customDate  = null;

  const trip = await Trips.addOnDate({ amount, cashReceived, extra, bonus }, tripDate);
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

  const extraRow = $('#numpad-extra-row');
  const dateContainer = $('#numpad-date-container');
  const noteContainer = $('#numpad-note-container');
  
  if (extraRow && dateContainer && noteContainer) {
    if (mode === 'expense') {
      extraRow.style.display = 'flex';
      dateContainer.style.display = 'block';
      noteContainer.style.display = 'block';
      if ($('#numpad-note')) $('#numpad-note').value = '';
      if ($('#numpad-date')) $('#numpad-date').value = Formatter.todayKey();
    } else if (mode === 'zaincash') {
      extraRow.style.display = 'flex';
      dateContainer.style.display = 'block';
      noteContainer.style.display = 'none';
      if ($('#numpad-date')) $('#numpad-date').value = Formatter.todayKey();
    } else {
      extraRow.style.display = 'none';
    }
  }

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
      
      const cashInput = $('#confirm-cash');
      if (cashInput) cashInput.value = amount;
      
      const dateInput = $('#confirm-date');
      if (dateInput) dateInput.value = S.customDate;
      openModal('confirm');
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
  const note = $('#numpad-note')?.value?.trim() || '';
  const date = $('#numpad-date')?.value || null;
  await Expenses.add({ category: S.expenseCat, amount, note, date });
  S.expenseCat = null;
  if ($('#numpad-note')) $('#numpad-note').value = '';
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
  const date = $('#numpad-date')?.value || Formatter.todayKey();
  await Transfers.add({ amount, date });
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

// ── حذف مصروف مباشرةً من البطاقة ──────────────────
async function deleteExpenseItem(expenseId) {
  if (!confirm('هل تريد حذف هذا المصروف؟')) return;
  try {
    await Expenses.delete(expenseId);
    await refreshHomeStats();
    if (S.screen === 'today') renderToday();
    if (S.viewingDate) openDay(S.viewingDate);
    flashToast('🗑️ تم حذف المصروف', '');
  } catch (e) {
    alert('حدث خطأ أثناء الحذف');
  }
}

// ── حذف تحويل زين كاش مباشرةً من البطاقة ───────────
async function deleteTransferItem(transferId) {
  if (!confirm('هل تريد حذف هذا التحويل؟')) return;
  try {
    await Transfers.delete(transferId);
    await refreshHomeStats();
    if (S.screen === 'today') renderToday();
    if (S.viewingDate) openDay(S.viewingDate);
    flashToast('🗑️ تم حذف التحويل', '');
  } catch (e) {
    alert('حدث خطأ أثناء الحذف');
  }
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
    
    const cr = t.cashReceived !== undefined ? t.cashReceived : t.amount;
    const appPaid = t.amount - cr;
    
    const badges = [
      appPaid > 0          ? `<span class="badge badge-app-pay">📱 بلي: ${Formatter.num(appPaid)}</span>` : '',
      t.extra              ? `<span class="badge badge-extra">+${Formatter.num(t.extra)}</span>` : '',
      t.bonus              ? `<span class="badge badge-bonus">🎁 ${Formatter.num(t.bonus)}</span>` : '',
      t.note               ? `<span class="badge badge-note">📝 ${t.note}</span>`                : '',
    ].filter(Boolean).join('');

    return `
      <div class="trip-card fade-up" onclick="App.editTrip('${t.id}')">
        <div class="trip-num" style="${appPaid > 0 ? 'background:var(--info-bg);color:var(--info)' : ''}">${i + 1}</div>
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
        <div class="trip-right" style="gap:6px;">
          <div class="trip-total" style="color:var(--danger)">-${Formatter.num(e.amount)}</div>
          <div class="trip-time">${Formatter.time(e.timestamp)}</div>
          <button class="small-btn" style="background:rgba(239,68,68,0.12);color:var(--danger);font-size:11px;padding:4px 10px;"
                  onclick="event.stopPropagation();App.deleteExpenseItem('${e.id}')">🗑️ حذف</button>
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
      <div class="trip-right" style="gap:6px;">
        <div class="trip-total" style="color:var(--info)">${Formatter.num(t.amount)}</div>
        <div class="trip-time">${Formatter.time(t.timestamp)}</div>
        <button class="small-btn" style="background:rgba(239,68,68,0.12);color:var(--danger);font-size:11px;padding:4px 10px;"
                onclick="event.stopPropagation();App.deleteTransferItem('${t.id}')">🗑️ حذف</button>
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

  let days = [];
  try {
    days = await Reports.getAllDays();
  } catch(e) {
    container.innerHTML = `<div style="padding:20px;color:red;text-align:center;">حدث خطأ: ${e.message}</div>`;
    console.error(e);
    return;
  }

  const addBtnHtml = `
    <div style="margin: 16px; position: relative;">
      <button class="modal-btn modal-btn-secondary" style="width: 100%; border: 2px dashed var(--primary); color: var(--primary); background: transparent;">
        📅 إضافة بيانات ليوم غير موجود بالقائمة
      </button>
      <input type="date" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" 
             onchange="if(this.value) App.openDay(this.value)">
    </div>
  `;

  if (!days.length) {
    container.innerHTML = addBtnHtml + `
      <div class="empty-state" style="margin-top: 20px;">
        <div class="empty-icon">📅</div>
        <div class="empty-text">لا يوجد سجل بعد</div>
        <div class="empty-sub">ابدأ بتسجيل رحلاتك أو أضف يوماً سابقاً من الزر أعلاه</div>
      </div>`;
    return;
  }

  container.innerHTML = addBtnHtml + '<div style="margin-top: 8px;"></div>' + days.map((day) => {
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
          <div class="history-meta">${day.stats.tripCount} رحلة · ${Formatter.num(day.stats.totalFares)} أجور${day.totalKm ? ` · ${day.totalKm} كم` : ''}</div>
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

  let months = [];
  try {
    months = await Reports.getAllMonths();
  } catch(e) {
    container.innerHTML = `<div style="padding:20px;color:red;text-align:center;">حدث خطأ: ${e.message}</div>`;
    console.error(e);
    return;
  }

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
        <div class="history-meta">${m.stats.tripCount} رحلة · ${m.stats.workDays} يوم عمل${m.totalKm ? ` · ${m.totalKm} كم` : ''}</div>
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
  const [walletStats, todayData] = await Promise.all([
    Wallet.getStats(),
    Reports.getToday(),
  ]);
  const today = todayData.stats;

  // v5.0 — Zain Cash is now DERIVED
  setEl('#w3-cash', Formatter.num(walletStats.cashInHand || 0));
  setEl('#w3-baly', Formatter.num(walletStats.balyBalance || 0));
  setEl('#w3-zain', Formatter.num(walletStats.zainCashBalance || 0));
  setEl('#w3-fuel', Formatter.num(walletStats.fuelWalletBalance || 0));
  
  // Color for baly (can be negative)
  const balyEl = $('#w3-baly');
  if (balyEl) balyEl.style.color = (walletStats.balyBalance || 0) >= 0 ? 'var(--primary)' : 'var(--danger)';
  
  // Color for zain (should be positive usually)
  const zainEl = $('#w3-zain');
  if (zainEl) zainEl.style.color = (walletStats.zainCashBalance || 0) >= 0 ? '#60a5fa' : 'var(--danger)';
  
  // Fuel color
  const fuelEl = $('#w3-fuel');
  if (fuelEl) fuelEl.style.color = (walletStats.fuelWalletBalance || 0) >= 0 ? 'var(--success)' : 'var(--danger)';
  
  const fuelData = walletStats.fuelData || {};
  setEl('#w3-fuel-km', fuelData.totalKm ? `${Formatter.num(fuelData.totalKm)} كم مقطوعة` : '');
  
  // Baly snapshot info
  const balyHint = $('#w3-baly-hint');
  if (balyHint) {
    balyHint.textContent = walletStats.hasBalySnapshot 
      ? `📅 ${walletStats.latestBalySnap?.date || ''}` 
      : '⚠️ أدخل رصيد بلي';
    balyHint.style.color = walletStats.hasBalySnapshot ? 'var(--text-muted)' : 'var(--danger)';
  }
  
  // Company bonuses
  setEl('#w5-total-bonuses', walletStats.totalCompanyBonuses > 0 ? `+${Formatter.num(walletStats.totalCompanyBonuses)}` : '0');
  
  // Load today's fuel price
  const fuelPrice = await Settings.get(KEYS.FUEL_PRICE) || 750;
  setEl('#km-fuel-price', Formatter.num(fuelPrice));
  
  // Load today's km records
  

  // ── Hero: صافي الأرباح الكلية ──
  setEl('#wallet-total-cash', Formatter.num(walletStats.netProfit));

  // ── ملخص اليوم ──
  setEl('#w-today-fares', Formatter.num(today.totalFares + today.totalExtras + today.totalBonuses));
  setEl('#w-today-fee',   Formatter.num(today.appFee));
  setEl('#w-today-exp',   Formatter.num(today.totalExpenses));
  const todayNet = today.netProfit;
  const todayNetEl = $('#w-today-net');
  if (todayNetEl) {
    todayNetEl.textContent = Formatter.num(todayNet);
    todayNetEl.className = 'stat-value ' + (todayNet >= 0 ? 'success' : 'danger');
  }

  // ── اقتراحات العزل اليومي ──
  const envsWithTarget = walletStats.envelopes.filter(e => e.dailyTarget > 0);
  const suggestionsContainer = $('#wallet-suggestions');
  const suggestionsHeader    = $('#w-suggestions-header');
  const freeWrap             = $('#w-free-wrap');

  if (envsWithTarget.length && suggestionsContainer) {
    if (suggestionsHeader) suggestionsHeader.style.display = '';
    if (freeWrap) freeWrap.style.display = '';

    let totalSuggested = 0;
    suggestionsContainer.innerHTML = envsWithTarget.map(env => {
      totalSuggested += env.dailyTarget;
      const monthly = env.monthlyTarget || env.target || 0;
      return `
        <div class="daily-suggestion-row">
          <span class="ds-icon">${env.icon}</span>
          <div class="ds-info">
            <div class="ds-name">${env.name}</div>
            <div>
              <span class="ds-amount">${Formatter.num(env.dailyTarget)}</span>
              <span class="ds-unit">د.ع / يوم</span>
            </div>
            ${monthly > 0 ? `<div class="ds-monthly">هدف الشهر: ${Formatter.num(monthly)}</div>` : ''}
          </div>
          <button class="ds-deposit-btn" onclick="App.openTransferEnv('${env.id}')">
            📥 إيداع
          </button>
        </div>`;
    }).join('');

    const freeToday = todayNet - totalSuggested;
    const freeEl = $('#w-free-today');
    if (freeEl) {
      freeEl.textContent = Formatter.num(freeToday);
      freeEl.style.color = freeToday >= 0 ? 'var(--success)' : 'var(--danger)';
    }
  } else {
    if (suggestionsHeader) suggestionsHeader.style.display = 'none';
    if (freeWrap) freeWrap.style.display = 'none';
    if (suggestionsContainer) suggestionsContainer.innerHTML = '';
  }

  // ── Unallocated badge ──
  const badge = $('#w-unallocated-badge');
  if (badge) {
    const unalloc = walletStats.unallocated;
    badge.textContent = `حر: ${Formatter.num(unalloc)}`;
    badge.style.color = unalloc >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  // ── الصناديق ──
  const container = $('#wallet-envelopes-list');
  if (!container) return;

  if (!walletStats.envelopes.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin:8px 0 16px">
        <div class="empty-icon">💼</div>
        <div class="empty-text">لا توجد صناديق بعد</div>
        <div class="empty-sub">أنشئ صندوقاً لتنظيم أموالك مثل (إيجار، بنزين، سلفة)</div>
      </div>`;
    return;
  }

  container.innerHTML = walletStats.envelopes.map((env, i) => {
    const clr = ENV_COLORS[i % ENV_COLORS.length];
    const monthly = env.monthlyTarget || env.target || 0;
    const pct = monthly > 0
      ? Math.min(100, Math.round((env.balance / monthly) * 100))
      : 0;
    const progressColor = pct >= 100 ? 'var(--success)' : clr.color;

    return `
    <div class="env-card fade-up" onclick="App.openEnvDetails('${env.id}')" style="cursor:pointer">
      <div class="env-card-top">
        <div class="env-icon-wrap" style="background:${clr.bg}">${env.icon}</div>
        <div class="env-card-body">
          <div class="env-name">${env.name}</div>
          <div class="env-balance-row">
            <span class="env-balance" style="color:${clr.color}">${Formatter.num(env.balance)}</span>
            <span class="env-currency">د.ع</span>
          </div>
          ${monthly > 0 ? `<div class="env-target-row">الهدف: ${Formatter.num(monthly)} (يومي: ${Formatter.num(env.dailyTarget || Math.round(monthly/30))})</div>` : ''}
        </div>
      </div>
      ${monthly > 0 ? `
      <div style="padding: 0 16px 12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:11px;color:var(--text-muted)">${Formatter.num(env.balance)} / ${Formatter.num(monthly)}</span>
          <span style="font-size:11px;font-weight:800;color:${progressColor}">${pct}%</span>
        </div>
        <div class="env-progress-bar" style="height:6px;border-radius:6px;margin:0;background:rgba(255,255,255,0.06);">
          <div style="width:${pct}%;height:100%;border-radius:6px;background:linear-gradient(90deg,${clr.color}88,${clr.color});transition:width 0.5s ease;"></div>
        </div>
      </div>` : ''}
      <div class="env-actions">
        <button class="env-action-btn deposit" onclick="event.stopPropagation(); App.openTransferEnv('${env.id}')">
          📥 إيداع
        </button>
        <button class="env-action-btn spend" onclick="App.openExpenseEnv('${env.id}')">
          💸 صرف
        </button>
      </div>
    </div>`;
  }).join('');
}

let _newEnvEmoji = '💰';

function newEnvelope() {
  _newEnvEmoji = '💰';
  $('#ne-name').value = '';
  $('#ne-monthly').value = '';
  $('#ne-daily-hint').textContent = '';
  // reset emoji selection
  $$('.emoji-btn', $('#ne-emoji-picker')).forEach(b => b.classList.toggle('active', b.dataset.e === '💰'));
  openModal('new-envelope');
  setTimeout(() => $('#ne-name')?.focus(), 300);
}

function pickEnvEmoji(emoji) {
  _newEnvEmoji = emoji;
  $$('.emoji-btn', $('#ne-emoji-picker')).forEach(b => b.classList.toggle('active', b.dataset.e === emoji));
}

function calcDailyTarget() {
  const monthly = Number($('#ne-monthly')?.value);
  const hint = $('#ne-daily-hint');
  if (!hint) return;
  if (monthly > 0) {
    const daily = Math.round(monthly / 30);
    hint.textContent = `≈ ${Formatter.num(daily)} دينار / يوم`;
  } else {
    hint.textContent = '';
  }
}

async function saveNewEnvelope() {
  const name = $('#ne-name')?.value?.trim();
  if (!name) { alert('يرجى كتابة اسم الصندوق'); return; }
  
  const monthlyTarget = Number($('#ne-monthly')?.value) || 0;
  const dailyTarget   = monthlyTarget > 0 ? Math.round(monthlyTarget / 30) : 0;

  const env = await Wallet.addEnvelope({
    name,
    icon:  _newEnvEmoji,
    target: monthlyTarget,
    monthlyTarget,
    dailyTarget,
  });

  if (name.includes('منزل')) {
    env.isHome = true;
    await Wallet.updateEnvelope(env);
  }

  closeModal('new-envelope');
  flashToast(`✅ تم إنشاء صندوق "${name}"`, '');
  if (S.screen === 'wallet') renderWallet();
}

// ── تفاصيل وسجل القاصة ─────────────────────────
async function openEnvDetails(envelopeId) {
  const envs = await Wallet.getEnvelopes();
  const env = envs.find(e => e.id === envelopeId);
  if (!env) return;

  S.selectedEnv = envelopeId;
  $('#env-details-title').textContent = `سجل ${env.name} ${env.icon}`;
  $('#env-details-balance').textContent = Formatter.num(env.balance);

  const txs = await Wallet.getTransactions(envelopeId);
  const container = $('#env-tx-list');
  
  if (!txs.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:20px;">
        <div class="empty-icon">📝</div>
        <div class="empty-text">لا توجد حركات بعد</div>
      </div>`;
  } else {
    container.innerHTML = txs.map(tx => {
      const isDeposit = tx.type === 'deposit_to_env';
      const color = isDeposit ? 'var(--success)' : 'var(--danger)';
      const icon = isDeposit ? '📥 إيداع' : '💸 صرف';
      const sign = isDeposit ? '+' : '-';
      
      return `
        <div class="trip-card fade-up" style="border-right: 4px solid ${color}; padding-right: 12px;">
          <div class="trip-info">
            <div class="trip-amount" style="color:${color}">${sign}${Formatter.num(tx.amount)} <small>د.ع</small></div>
            <div class="trip-badges">
              <span class="badge" style="background:var(--card-alt);color:var(--text-muted)">${icon}</span>
              ${tx.note ? `<span class="badge badge-note">📝 ${tx.note}</span>` : ''}
            </div>
          </div>
          <div class="trip-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <div class="trip-time">${Formatter.fullDateAr(tx.date || Formatter.dateKey(tx.timestamp || Date.now()))}</div>
            <button class="small-btn" style="background:rgba(239,68,68,0.1);color:var(--danger);font-size:11px;" 
                    onclick="App.deleteEnvTransaction('${tx.id}', '${envelopeId}')">حذف</button>
          </div>
        </div>`;
    }).join('');
  }

  openModal('env-details');
}

async function deleteEnvTransaction(txId, envelopeId) {
  if (!confirm('هل أنت متأكد من حذف هذه العملية؟ سيتم استرجاع المبالغ لتصحيح الأرصدة.')) return;
  
  try {
    await Wallet.deleteTransaction(txId);
    flashToast('✅ تم الحذف وتصحيح الرصيد', '');
    
    // تحديث النافذة المفتوحة
    await openEnvDetails(envelopeId);
    
    // تحديث المحفظة في الخلفية
    if (S.screen === 'wallet') renderWallet();
    await refreshHomeStats();
  } catch (e) {
    alert(e.message || 'حدث خطأ أثناء الحذف');
  }
}

// ── الإيداع في القاصة ──────────────────────────
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

// ── Fuel Wallet Functions ──────────────────────



// ── v5.0: مكافأة الشركة ────────────────────────────



// ── v5.0: رصيد بلي ─────────────────────────────────

function openBalyBalance() {
  const today = Formatter.todayKey();
  const el = $('#baly-snap-date');
  if (el) el.value = today;
  if ($('#baly-snap-balance')) $('#baly-snap-balance').value = '';
  if ($('#baly-snap-note')) $('#baly-snap-note').value = '';
  openModal('baly-snapshot');
  setTimeout(() => $('#baly-snap-balance')?.focus(), 300);
}

async function saveBalyBalance() {
  const raw     = $('#baly-snap-balance')?.value?.trim();
  const balance = Number(raw);
  const date    = $('#baly-snap-date')?.value || Formatter.todayKey();
  const note    = $('#baly-snap-note')?.value?.trim() || '';
  if (raw === '' || raw === undefined) { alert('يرجى إدخال رصيد بلي (يمكن أن يكون سالباً)'); return; }
  try {
    await BalyBalance.record({ balance, date, note });
    closeModal('baly-snapshot');
    flashToast(`📱 تم تسجيل رصيد بلي: ${Formatter.num(balance)} دينار`, '');
    if (S.screen === 'wallet') renderWallet();
  } catch(e) { alert('خطأ: ' + e.message); }
}

// ── تسوية الأرصدة ──
function openWalletAdjustment() {
  $('#adj-cash').value = '';
  $('#adj-zain').value = '';
  openModal('adjust-wallet');
}

async function saveWalletAdjustment() {
  try {
    const actualCash = $('#adj-cash').value;
    const actualZain = $('#adj-zain').value;
    
    if (actualCash !== '') {
      const cashNum = Formatter.parseArNum(actualCash);
      if (!isNaN(cashNum)) {
        const stats = await Reports.getAllTimeStats();
        const baseCash = stats.cashInHand || 0;
        await Settings.set(KEYS.CASH_ADJUST, cashNum - baseCash);
      }
    }
    
    if (actualZain !== '') {
      const zainNum = Formatter.parseArNum(actualZain);
      if (!isNaN(zainNum)) {
        const stats = await Reports.getAllTimeStats();
        const allTransfers = await Database.getAllTransfers();
        const allTransfersSum = allTransfers.reduce((s,t) => s+(t.amount||0), 0);
        const allBalySnaps = await BalyBalance.getAll();
        const latestBalySnap = allBalySnaps.length > 0 ? allBalySnaps.sort((a, b) => b.timestamp - a.timestamp)[0] : null;
        const balyBalance = latestBalySnap !== null ? (latestBalySnap.balance || 0) : ((stats.appBalance || 0) + allTransfersSum);
        
        const baseZain = (stats.netProfit || 0) - (stats.cashInHand || 0) - balyBalance;
        await Settings.set(KEYS.ZAIN_ADJUST, zainNum - baseZain);
      }
    }
    
    closeModal('adjust-wallet');
    if (S.screen === 'wallet') await renderWallet();
  } catch (e) {
    alert('خطأ أثناء الحفظ: ' + e.message);
  }
}



// ──══════════════════════════════════════════════════
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

function initBackButton() {
  window.history.pushState({ active: true }, '');
  window.addEventListener('popstate', () => {
    const openModal = document.querySelector('.modal-overlay.open');
    
    // 1. إغلاق أي نافذة مفتوحة
    if (openModal) {
      closeAllModals();
      window.history.pushState({ active: true }, '');
      return;
    }

    // 2. الرجوع من تفاصيل اليوم إلى السجل
    if (S.viewingDate) {
      backHistory();
      window.history.pushState({ active: true }, '');
      return;
    }

    // 3. الرجوع من أي شاشة إلى الشاشة الرئيسية
    if (S.screen !== 'home') {
      showScreen('home');
      window.history.pushState({ active: true }, '');
      return;
    }

    // إذا كنا في الشاشة الرئيسية ولا توجد نوافذ مفتوحة، سيسمح التطبيق بالخروج بشكل طبيعي
  });
}

// ══════════════════════════════════════════════════
// بوابة الصباح — Morning Gateway
// ══════════════════════════════════════════════════

/**
 * تفتح بوابة الصباح عند بدء يوم عمل جديد
 * تطلب رصيد بلي + زين كاش قبل السماح بتسجيل رحلات
 */
async function checkMorningGateway() {
  try {
    const hasEntry = await DailyBalance.hasEntryForToday();
    console.log('[Gateway] hasEntryForToday:', hasEntry);
    if (hasEntry) return; // تم التسجيل بالفعل

    // احضر أرقام الأمس للمقارنة
    const latest = await DailyBalance.getLatest();
    console.log('[Gateway] latest:', latest);
    const prevBaly = latest ? latest.balyBalance : null;
    const prevZain = latest ? latest.zainCashBalance : null;

    // أظهر البوابة
    openMorningGateway(prevBaly, prevZain);
  } catch(e) {
    console.error('[Gateway] Error:', e);
    // حتى لو في خطأ، افتح البوابة
    openMorningGateway(null, null);
  }
}

function openMorningGateway(prevBaly, prevZain) {
  const prevBalyEl = $('#gw-prev-baly');
  const prevZainEl = $('#gw-prev-zain');
  if (prevBalyEl) prevBalyEl.textContent = prevBaly !== null ? `الأمس: ${Formatter.num(prevBaly)} د.ع` : 'أول مرة';
  if (prevZainEl) prevZainEl.textContent = prevZain !== null ? `الأمس: ${Formatter.num(prevZain)} د.ع` : 'أول مرة';

  const balyInput = $('#gw-baly-balance');
  const zainInput = $('#gw-zain-balance');
  if (balyInput) balyInput.value = '';
  if (zainInput) zainInput.value = '';

  // إظهار البوابة
  openModal('morning-gateway');
  setTimeout(() => balyInput?.focus(), 300);
}

async function saveMorningGateway() {
  const balyRaw = $('#gw-baly-balance')?.value?.trim();
  const zainRaw = $('#gw-zain-balance')?.value?.trim();

  if (balyRaw === '' || balyRaw === undefined) {
    alert('يرجى إدخال رصيد بلي الحالي (يمكن أن يكون سالباً أو صفر)');
    return;
  }
  if (zainRaw === '' || zainRaw === undefined) {
    alert('يرجى إدخال رصيد زين كاش الحالي (يمكن أن يكون صفر)');
    return;
  }

  const balyBalance = Formatter.parseArNum(balyRaw);
  const zainCashBalance = Formatter.parseArNum(zainRaw);

  if (isNaN(balyBalance) || isNaN(zainCashBalance)) {
    alert('يرجى إدخال أرقام صحيحة');
    return;
  }

  try {
    // كشف المكافآت المحتملة
    const bonuses = await DailyBalance.detectBonuses({ newBalyBalance: balyBalance, newZainCashBalance: zainCashBalance });

    // حفظ البوابة
    await DailyBalance.recordToday({ balyBalance, zainCashBalance, note: 'بوابة الصباح' });

    closeModal('morning-gateway');

    // إذا اكتُشفت مكافآت، أبلغ المستخدم
    let bonusMsg = '';
    if (bonuses.balyBonus > 0) bonusMsg += `📱 بلي +${Formatter.num(bonuses.balyBonus)} د.ع\n`;
    if (bonuses.zainBonus > 0) bonusMsg += `💚 زين كاش +${Formatter.num(bonuses.zainBonus)} د.ع\n`;
    if (bonusMsg) {
      setTimeout(() => {
        flashToast(`🎁 اكتُشفت مكافآت! ${bonusMsg.trim()}`, '');
      }, 500);
    } else {
      flashToast('✅ تم تسجيل أرصدة اليوم — صباح الخير! 🌅', '');
    }

    if (S.screen === 'wallet') renderWallet();
  } catch (e) {
    alert('خطأ أثناء الحفظ: ' + e.message);
  }
}

// تخطي البوابة (في حالات الضرورة)
function skipMorningGateway() {
  closeModal('morning-gateway');
  flashToast('⚠️ تنبيه: أرصدة اليوم لم تُسجَّل بعد', '');
}

// ══════════════════════════════════════════════════
// محفظة زين كاش — Zain Cash Wallet
// ══════════════════════════════════════════════════

async function openZainWallet() {
  await renderZainWalletDetails();
  openModal('zain-wallet');
}

async function renderZainWalletDetails() {
  const [balance, txs, weekStats, monthStats] = await Promise.all([
    ZainWallet.getBalance(),
    ZainWallet.getTransactions(),
    ZainWallet.getWeeklyStats(),
    ZainWallet.getMonthlyStats(),
  ]);

  const balEl = $('#zw-balance');
  if (balEl) {
    balEl.textContent = Formatter.num(balance);
    balEl.style.color = balance >= 0 ? 'var(--primary)' : 'var(--danger)';
  }
  setEl('#zw-week-in',    Formatter.num(weekStats.income));
  setEl('#zw-week-out',   Formatter.num(weekStats.expense));
  setEl('#zw-month-in',   Formatter.num(monthStats.income));
  setEl('#zw-month-out',  Formatter.num(monthStats.expense));

  const listEl = $('#zw-tx-list');
  if (!listEl) return;

  if (!txs.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="margin:12px 0">
        <div class="empty-icon">💚</div>
        <div class="empty-text">لا توجد حركات بعد</div>
        <div class="empty-sub">سجّل مصاريف زين كاش أو إيداعات منها</div>
      </div>`;
    return;
  }

  listEl.innerHTML = txs.map(tx => {
    const isCredit = tx.type === 'credit';
    const color = isCredit ? 'var(--success)' : 'var(--danger)';
    const sign  = isCredit ? '+' : '-';
    const icon  = isCredit ? '📥' : '💸';
    const label = isCredit ? 'إيداع' : 'مصروف';
    return `
      <div class="trip-card fade-up" style="border-right:4px solid ${color};padding-right:12px">
        <div class="trip-num" style="background:transparent;font-size:20px">${icon}</div>
        <div class="trip-info">
          <div class="trip-amount" style="color:${color}">${sign}${Formatter.num(tx.amount)} <small>د.ع</small></div>
          <div class="trip-badges">
            <span class="badge" style="background:var(--card-alt);color:var(--text-muted)">${label}</span>
            ${tx.category && tx.category !== 'deposit' && tx.category !== 'expense' ? `<span class="badge badge-note">${tx.category}</span>` : ''}
            ${tx.note ? `<span class="badge badge-note">📝 ${tx.note}</span>` : ''}
          </div>
        </div>
        <div class="trip-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div class="trip-time">${Formatter.fullDateAr(tx.date || Formatter.dateKey(tx.timestamp || Date.now()))}</div>
          <button class="small-btn" style="background:rgba(239,68,68,0.1);color:var(--danger);font-size:11px"
                  onclick="App.deleteZainTx('${tx.id}')">حذف</button>
        </div>
      </div>`;
  }).join('');
}

function openZainDeposit() {
  $('#zd-amount').value = '';
  $('#zd-note').value = '';
  openModal('zain-deposit');
}

async function confirmZainDeposit() {
  const amount = Formatter.parseArNum($('#zd-amount')?.value);
  const note   = $('#zd-note')?.value?.trim() || '';
  if (!amount || amount <= 0) { alert('يرجى إدخال المبلغ'); return; }
  try {
    await ZainWallet.deposit({ amount, note });
    closeModal('zain-deposit');
    flashToast(`💚 تم إيداع ${Formatter.num(amount)} في زين كاش`, '');
    await renderZainWalletDetails();
    if (S.screen === 'wallet') renderWallet();
  } catch(e) { alert(e.message); }
}

function openZainExpense() {
  $('#ze-amount').value = '';
  $('#ze-note').value = '';
  $('#ze-category').value = '';
  openModal('zain-expense');
}

async function confirmZainExpense() {
  const amount   = Formatter.parseArNum($('#ze-amount')?.value);
  const note     = $('#ze-note')?.value?.trim() || '';
  const category = $('#ze-category')?.value?.trim() || 'expense';
  if (!amount || amount <= 0) { alert('يرجى إدخال المبلغ'); return; }
  try {
    await ZainWallet.expense({ amount, note, category });
    closeModal('zain-expense');
    flashToast(`💸 تم تسجيل مصروف ${Formatter.num(amount)} من زين كاش`, '');
    await renderZainWalletDetails();
    if (S.screen === 'wallet') renderWallet();
  } catch(e) { alert(e.message); }
}

async function deleteZainTx(id) {
  if (!confirm('هل تريد حذف هذه العملية؟')) return;
  try {
    await ZainWallet.deleteTransaction(id);
    flashToast('✅ تم الحذف', '');
    await renderZainWalletDetails();
    if (S.screen === 'wallet') renderWallet();
  } catch(e) { alert(e.message); }
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
  initBackButton();

  // تسجيل Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // فحص بوابة الصباح بعد لحظة
  setTimeout(() => checkMorningGateway(), 1200);
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
  stopCountdown: () => stopCountdown(),
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
  openFuelTopup: () => openFuelTopup(),
  saveFuelTopup: () => saveFuelTopup(),
  saveDailyKm:   () => saveDailyKm(),
  newEnvelope:        () => newEnvelope(),
  pickEnvEmoji:   (e)    => pickEnvEmoji(e),
  calcDailyTarget:()     => calcDailyTarget(),
  saveNewEnvelope:()     => saveNewEnvelope(),
  openTransferEnv:    (id) => openTransferEnv(id),
  confirmTransferEnv: () => confirmTransferEnv(),
  openExpenseEnv:     (id) => openExpenseEnv(id),
  confirmExpenseEnv:  () => confirmExpenseEnv(),
  openEnvDetails:     (id) => openEnvDetails(id),
  deleteEnvTransaction: (txId, envId) => deleteEnvTransaction(txId, envId),

  // Mini Bank v8.0 - النظام المالي الكامل للقاصات
  switchEnvTab:    (tab)  => switchEnvTab(tab),
  envBankAdd:      (type) => envBankAdd(type),
  pickEnvCat:      (cat)  => pickEnvCat(cat),
  confirmEnvBankAdd: () => confirmEnvBankAdd(),

  // حذف مباشر من البطاقات
  deleteExpenseItem:  (id) => deleteExpenseItem(id),
  deleteTransferItem: (id) => deleteTransferItem(id),

  // helper للـ EnvDetails
  getSelectedEnv: () => S.selectedEnv,

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

  // v5.0 — مكافآت الشركة + رصيد بلي
  openCompanyBonus: () => openCompanyBonus(),
  saveCompanyBonus: () => saveCompanyBonus(),
  openBalyBalance:  () => openBalyBalance(),
  saveBalyBalance:  () => saveBalyBalance(),
  openWalletAdjustment: () => openWalletAdjustment(),
  saveWalletAdjustment: () => saveWalletAdjustment(),

  // إغلاق النوافذ
  close: () => closeAllModals(),

  // بوابة الصباح
  saveMorningGateway: () => saveMorningGateway(),
  skipMorningGateway: () => skipMorningGateway(),
  openMorningGateway: () => checkMorningGateway(),

  // محفظة زين كاش
  openZainWallet:      () => openZainWallet(),
  openZainDeposit:     () => openZainDeposit(),
  confirmZainDeposit:  () => confirmZainDeposit(),
  openZainExpense:     () => openZainExpense(),
  confirmZainExpense:  () => confirmZainExpense(),
  deleteZainTx:        (id) => deleteZainTx(id),
};

// بدء التطبيق
document.addEventListener('DOMContentLoaded', init);
