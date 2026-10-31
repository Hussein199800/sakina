// صفحة التذكيرات: أذكار اليوم والصلاة + تذكيرات مخصّصة (صيام، جمعة، قيام، ضحى، أو تذكير حرّ)
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { KINDS, describe, occurrences } from '../reminders.js';
import { WEEKDAYS, WEEKDAY_LETTERS, dateKey } from '../dates.js';
import { fullHead, refresh } from './common.js';
import { timeButton, dateButton, pickTime, pickDate, fmtClock, fmtDay } from './pickers.js';
import { openSheet, toast, confirmSheet } from '../ui.js';
import { rescheduleNotifications } from '../services.js';
import { notificationsSupported, ensureNotifyPermission, exactAlarmsAllowed, openExactAlarmSettings, isNative, overlaySupported, overlayGranted, openOverlaySettings, showOverlayNow } from '../native.js';

export const full = true;
export const tab = 'more';

const sw = (on, act, extra = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra}><i></i></button>`;

function baseRow(key, ic, label) {
  const n = state.settings.notif[key];
  return `<div class="set-row">
    <span class="set-ic">${icon(ic)}</span>
    <div class="set-txt"><b>${label}</b><small>${n.on ? 'يومياً' : 'متوقف'}</small></div>
    ${timeButton(n.time, `data-act="rem-base-time" data-k="${key}" aria-label="وقت ${label}" ${n.on ? '' : 'disabled'}`)}
    ${sw(n.on, 'rem-base', `data-k="${key}"`)}
  </div>`;
}

function nextLabel(r) {
  const o = occurrences(r, new Date(), 45, state.settings.hijriAdjust)[0];
  if (!o) return r.on ? 'لا موعد قريب' : '';
  const d = o.at;
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(new Date().setHours(0, 0, 0, 0))) / 86400000);
  const when = days === 0 ? 'اليوم' : days === 1 ? 'غداً' : `${WEEKDAYS[d.getDay()]} ${num(d.getDate())}/${num(d.getMonth() + 1)}`;
  return `القادم: ${when} ${fmtClock(`${d.getHours()}:${d.getMinutes()}`)}`;
}

export function render() {
  const list = state.reminders;
  return `${fullHead('التذكيرات', 'نذكّرك بما تحب في وقته')}
    ${notificationsSupported ? '' : `<p class="note">${icon('info')} التذكيرات تصل كإشعارات في تطبيق أندرويد. في المتصفح يمكنك إعدادها لتعمل عند تثبيت التطبيق.</p>`}
    ${isNative ? '<p class="note" data-exact hidden></p>' : ''}
    <section class="card set-card">
      <h2 class="set-title">${icon('sun')} الأذكار والصلاة</h2>
      ${baseRow('morning', 'sunrise', 'أذكار الصباح')}
      ${baseRow('evening', 'sunset', 'أذكار المساء')}
      ${baseRow('sleep', 'moon', 'أذكار النوم')}
      ${overlaySupported ? `<div class="set-row"><span class="set-ic">${icon('bubble')}</span><div class="set-txt"><b>فقاعة عائمة فوق التطبيقات</b><small>دائرة صغيرة تظهر فوق أي تطبيق في وقت أذكار الصباح والمساء والنوم</small></div>${sw(state.settings.overlay, 'rem-overlay')}</div>
      ${state.settings.overlay ? `<button class="link-row" data-act="rem-overlay-test">${icon('sparkle')} جرّب الفقاعة الآن ${icon('chevron')}</button>` : ''}` : ''}
      <div class="set-row"><span class="set-ic">${icon('mosque')}</span><div class="set-txt"><b>دخول وقت الصلاة</b><small>إشعار عند كل أذان</small></div>${sw(state.settings.notif.prayers, 'rem-prayers')}</div>
    </section>

    <section class="block">
      <div class="block-head"><h2>تذكيراتي</h2><button class="chip" data-act="rem-add">${icon('plus')} إضافة</button></div>
      ${list.length ? `<div class="rem-list">${list.map((r) => {
        const k = KINDS[r.kind] || KINDS.custom;
        return `<div class="rem-card tone-${k.tone} ${r.on ? '' : 'off'}">
          <button class="rem-main" data-act="rem-edit" data-id="${r.id}">
            <span class="cat-ic">${icon(k.icon)}</span>
            <span class="cat-txt"><b>${esc(r.kind === 'custom' ? r.title || 'تذكير' : k.title)}</b><small>${describe(r)} · ${fmtClock(r.time)}</small><small class="rem-next">${nextLabel(r)}</small></span>
          </button>
          ${sw(r.on, 'rem-toggle', `data-id="${r.id}"`)}
        </div>`;
      }).join('')}</div>` : `<div class="empty small-empty">${icon('bell')}<p>لا تذكيرات بعد</p><small>أضف تذكيراً بصيام الاثنين والخميس، أو الأيام البيض، أو أي شيء تريده</small></div>`}
    </section>

    <section class="block">
      <div class="block-head"><h2>اقتراحات</h2></div>
      <div class="sugg-grid">${Object.entries(KINDS).filter(([k]) => k !== 'custom' && !list.some((r) => r.kind === k)).map(([k, v]) => `
        <button class="sugg tone-${v.tone}" data-act="rem-new" data-kind="${k}"><span class="cat-ic">${icon(v.icon)}</span><b>${v.title}</b>${icon('plus')}</button>`).join('')}
        <button class="sugg tone-sand" data-act="rem-new" data-kind="custom"><span class="cat-ic">${icon('edit')}</span><b>تذكير مخصّص</b>${icon('plus')}</button>
      </div>
    </section>`;
}

export function mount(root) {
  const exact = root.querySelector('[data-exact]');
  if (exact) exactAlarmsAllowed().then((ok) => {
    if (ok) return;
    exact.hidden = false;
    exact.innerHTML = `${icon('info')} لتصل التذكيرات في وقتها بالضبط، اسمح للتطبيق بـ«المنبّهات والتذكيرات». <button class="link-btn" data-act="exact-open">فتح الإعدادات</button>`;
  });
}

async function permitted() {
  if (!notificationsSupported) return true;
  if (await ensureNotifyPermission()) return true;
  toast('اسمح للتطبيق بإرسال الإشعارات من إعدادات الهاتف', 'info');
  return false;
}

function editor(existing, kind) {
  const r = existing ? { ...existing } : { id: `r-${Date.now().toString(36)}`, kind, on: true, time: KINDS[kind].time, mode: KINDS[kind].mode, repeat: 'daily', days: [5], date: dateKey(new Date(Date.now() + 86400000)), title: '', body: '' };
  const k = KINDS[r.kind];
  const custom = r.kind === 'custom';
  const modeSeg = k.modes ? `<div class="field"><span>متى نذكّرك؟</span><div class="seg">
      <button class="seg-btn ${r.mode === 'eve' ? 'on' : ''}" data-mode="eve">${r.kind === 'kahf' ? k.eveLabel : 'الليلة السابقة'}</button>
      <button class="seg-btn ${r.mode === 'day' ? 'on' : ''}" data-mode="day">${r.kind === 'kahf' ? k.dayLabel : 'صباح اليوم'}</button></div></div>` : '';
  openSheet(`<div class="mood-head tone-${k.tone}"><span class="mood-ic big">${icon(k.icon)}</span><div><small>${existing ? 'تعديل تذكير' : 'تذكير جديد'}</small><h3>${k.title}</h3></div></div>
    <p class="sheet-text small">${k.desc}</p>
    ${custom ? `<label class="field"><span>عنوان التذكير</span><input type="text" id="r-title" value="${esc(r.title)}" placeholder="مثلاً: صلة الرحم، قراءة سورة الملك…" maxlength="60"></label>
      <label class="field"><span>نص إضافي (اختياري)</span><input type="text" id="r-body" value="${esc(r.body)}" maxlength="140"></label>
      <div class="field"><span>التكرار</span><div class="seg">${[['daily', 'يومياً'], ['weekly', 'أيام محددة'], ['once', 'مرة واحدة']].map(([v, l]) => `<button class="seg-btn ${r.repeat === v ? 'on' : ''}" data-rep="${v}">${l}</button>`).join('')}</div></div>
      <div class="field" data-days-wrap ${r.repeat === 'weekly' ? '' : 'hidden'}><span>الأيام</span><div class="days-pick">${WEEKDAYS.map((d, i) => `<button class="day-btn ${r.days.indexOf(i) !== -1 ? 'on' : ''}" data-day="${i}" aria-label="${d}">${WEEKDAY_LETTERS[i]}</button>`).join('')}</div></div>
      <div class="field" data-date-wrap ${r.repeat === 'once' ? '' : 'hidden'}><span>التاريخ</span>${dateButton(r.date, 'id="r-date"')}</div>` : modeSeg}
    <div class="field"><span>الوقت</span>${timeButton(r.time, 'id="r-time"')}</div>
    <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} حفظ</button>
      ${existing ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} حذف</button>` : '<button class="btn btn-ghost" data-close>إلغاء</button>'}</div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => {
      const pick = (sel, attr, cb) => body.querySelectorAll(sel).forEach((b) => b.addEventListener('click', () => {
        body.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b));
        cb(b.getAttribute(attr));
      }));
      pick('[data-mode]', 'data-mode', (v) => { r.mode = v; });
      pick('[data-rep]', 'data-rep', (v) => {
        r.repeat = v;
        body.querySelector('[data-days-wrap]').hidden = v !== 'weekly';
        body.querySelector('[data-date-wrap]').hidden = v !== 'once';
      });
      body.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => {
        const d = +b.dataset.day;
        const i = r.days.indexOf(d);
        if (i === -1) r.days.push(d); else r.days.splice(i, 1);
        b.classList.toggle('on', i === -1);
      }));
      const tb = body.querySelector('#r-time');
      tb.addEventListener('click', async () => {
        const v = await pickTime(r.time);
        if (v) { r.time = v; tb.dataset.value = v; tb.querySelector('span').textContent = fmtClock(v); }
      });
      const db = body.querySelector('#r-date');
      if (db) db.addEventListener('click', async () => {
        const v = await pickDate(r.date);
        if (v) { r.date = v; db.dataset.value = v; db.querySelector('span').textContent = fmtDay(v); }
      });
      body.querySelector('[data-save]').addEventListener('click', async () => {
        if (custom) {
          r.title = body.querySelector('#r-title').value.trim();
          r.body = body.querySelector('#r-body').value.trim();
          if (!r.title) { toast('اكتب عنوان التذكير', 'info'); return; }
          if (r.repeat === 'weekly' && !r.days.length) { toast('اختر يوماً واحداً على الأقل', 'info'); return; }
        }
        if (r.on && !(await permitted())) return;
        const i = state.reminders.findIndex((x) => x.id === r.id);
        if (i === -1) state.reminders.push(r); else state.reminders[i] = r;
        save();
        await rescheduleNotifications();
        close();
        const first = occurrences(r, new Date(), 45, state.settings.hijriAdjust)[0];
        toast(first ? 'تم حفظ التذكير' : 'تم الحفظ، لكن لا يوجد موعد خلال الأيام القادمة', 'bell');
        refresh();
      });
      const del = body.querySelector('[data-del]');
      if (del) del.addEventListener('click', async () => {
        close();
        if (!(await confirmSheet('حذف التذكير', 'هل تريد حذف هذا التذكير؟', 'حذف', true))) return;
        state.reminders = state.reminders.filter((x) => x.id !== r.id);
        save();
        await rescheduleNotifications();
        refresh();
      });
    },
  });
}

function addSheet() {
  openSheet(`<h3 class="sheet-title">بماذا نذكّرك؟</h3>
    <div class="pick-list">${Object.entries(KINDS).map(([k, v]) => `
      <button class="pick" data-kind="${k}"><b class="kind-title">${icon(v.icon)} ${v.title}</b><small>${v.desc}</small></button>`).join('')}</div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => body.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { close(); setTimeout(() => editor(null, b.dataset.kind), 250); })),
  });
}

export const actions = {
  'rem-add': () => addSheet(),
  'rem-new': (el) => editor(null, el.dataset.kind),
  'rem-edit': (el) => editor(state.reminders.find((r) => r.id === el.dataset.id)),
  'rem-toggle': async (el) => {
    const r = state.reminders.find((x) => x.id === el.dataset.id);
    if (!r.on && !(await permitted())) return;
    r.on = !r.on;
    save();
    await rescheduleNotifications();
    refresh();
  },
  'rem-base': async (el) => {
    const n = state.settings.notif[el.dataset.k];
    if (!n.on && !(await permitted())) return;
    n.on = !n.on;
    save();
    await rescheduleNotifications();
    refresh();
  },
  'rem-overlay': async () => {
    const s = state.settings;
    if (s.overlay) { s.overlay = false; save(); await rescheduleNotifications(); refresh(); return; }
    if (await overlayGranted()) { s.overlay = true; save(); await rescheduleNotifications(); toast('ستظهر الفقاعة في أوقات الأذكار', 'bubble'); refresh(); return; }
    openSheet(`<div class="center"><div class="about-logo">${icon('bubble')}</div><h3 class="sheet-title">إذن الظهور فوق التطبيقات</h3></div>
      <p class="sheet-text">لتظهر الفقاعة فوق أي تطبيق تستخدمه، يحتاج أندرويد إلى إذن «الظهور فوق التطبيقات الأخرى».</p>
      <ol class="upd-help-list"><li>اضغط «منح الإذن» لتفتح صفحة الإعداد.</li><li>فعّل الخيار بجانب «سكينة».</li><li>ارجع إلى التطبيق، وستُفعَّل الفقاعة تلقائياً.</li></ol>
      <p class="muted small">لا يستخدم التطبيق هذا الإذن إلا لإظهار الفقاعة في أوقات التذكير التي تختارها.</p>
      <div class="row-btns"><button class="btn btn-primary" data-grant>${icon('settings')} منح الإذن</button><button class="btn btn-ghost" data-close>لاحقاً</button></div>`, {
      onMount: (body, close) => body.querySelector('[data-grant]').addEventListener('click', async () => {
        state.app.overlayPending = true;
        save();
        close();
        await openOverlaySettings();
      }),
    });
  },
  'rem-overlay-test': async () => {
    const ok = await showOverlayNow('أذكار الصباح', 'هكذا ستظهر الفقاعة في وقت التذكير', '/read/morning');
    if (!ok) toast('امنح إذن الظهور فوق التطبيقات أولاً', 'info');
  },
  'rem-prayers': async () => {
    const n = state.settings.notif;
    if (!n.prayers && !(await permitted())) return;
    n.prayers = !n.prayers;
    save();
    await rescheduleNotifications();
    refresh();
  },
  'exact-open': () => openExactAlarmSettings(),
  'rem-base-time': async (el) => {
    const n = state.settings.notif[el.dataset.k];
    const v = await pickTime(n.time);
    if (!v) return;
    n.time = v;
    save();
    await rescheduleNotifications();
    toast('تم تحديث وقت التذكير', 'bell');
    refresh();
  },
};
