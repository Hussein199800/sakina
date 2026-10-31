// تبويب القرآن الكريم: متابعة القراءة، الختمة، الفهرس (السور والأجزاء والعلامات)، البحث
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, parseNum, pagesLabel, daysLabel } from '../text.js';
import { SURAS, JUZ, PAGES } from '../data/quran-meta.js';
import { suraOf, pageOf, juzOf, refOf, suraName, searchQuran, loadText, ayahOnly } from '../quran.js';
import { PLANS, startKhatma, stopKhatma, todayRange, readToday, daysLeft, progress } from '../khatma.js';
import { pageHead, ring, refresh } from './common.js';
import { openSheet, toast, confirmSheet } from '../ui.js';
import { rescheduleNotifications } from '../services.js';
import { ensureNotifyPermission, notificationsSupported } from '../native.js';
import { GREG_MONTHS } from '../dates.js';
import { timeButton, pickTime, fmtClock } from './pickers.js';

let tab = 'suras';
let query = '';
let searchSeq = 0;

function continueCard() {
  const p = state.quran.lastPage;
  if (!p) return '';
  const s = suraOf(PAGES[p - 1]);
  return `<button class="card continue-card" data-act="go" data-to="#/mushaf/${p}">
    <span class="cc-ic">${icon('book')}</span>
    <span class="cc-txt"><small>تابع القراءة</small><b>سورة ${suraName(s)}</b><small>الصفحة ${num(p)}</small></span>
    ${icon('chevron')}
  </button>`;
}

function khatmaCard() {
  const k = state.khatma;
  if (!k) {
    return `<section class="card khatma-card empty-k">
      <div class="kc-head"><span class="kc-ic">${icon('flag')}</span><div><b>ختمة جديدة</b><small>${state.khatmaDone ? `أتممت ${num(state.khatmaDone)} ختمة، تقبّل الله منك` : 'اقرأ وردك يومياً حتى تختم القرآن'}</small></div></div>
      <div class="row-btns"><button class="btn btn-primary" data-act="k-new">${icon('plus')} ختمة فردية</button><button class="btn btn-soft" data-act="go" data-to="#/group">${icon('flag')} ختمة جماعية</button></div>
    </section>`;
  }
  const r = todayRange(k);
  const done = readToday(k);
  const target = Math.min(k.perDay, r.to - r.from + 1);
  const pct = progress(k);
  return `<section class="card khatma-card">
    <div class="kc-top">
      <div class="kc-ring">${ring(pct, 84, 7)}<b>${num(Math.round(pct * 100))}٪</b></div>
      <div class="kc-info">
        <span class="eyebrow">${icon('flag')} ختمتي</span>
        <b>ورد اليوم: الصفحات ${num(r.from)}–${num(r.to)}</b>
        <small>${done >= target ? 'أتممت ورد اليوم، بارك الله فيك' : `قرأت ${num(done)} من ${pagesLabel(target)} اليوم`}</small>
        <small class="muted">بقي ${daysLabel(daysLeft(k))} تقريباً على الختم</small>
      </div>
    </div>
    <div class="row-btns">
      <button class="btn btn-primary" data-act="go" data-to="#/mushaf/${Math.min(604, k.page)}">${icon('book')} ${done >= target ? 'اقرأ المزيد' : 'اقرأ وردك'}</button>
      <button class="btn btn-ghost" data-act="k-edit">${icon('settings')} الخطة</button>
    </div>
    <button class="link-row" data-act="go" data-to="#/group">${icon('flag')} الختمة الجماعية مع أهلك وأصحابك ${icon('chevron')}</button>
  </section>`;
}

function suraList() {
  return `<div class="sura-list">${SURAS.map(([name, ayas, start, type], i) => `
    <button class="sura-row" data-act="go" data-to="#/mushaf/${pageOf(start)}">
      <span class="sura-num">${num(i + 1)}</span>
      <span class="sura-txt"><b>${name}</b><small>${type === 'm' ? 'مكية' : 'مدنية'} · ${num(ayas)} آية</small></span>
      <span class="sura-page">${num(pageOf(start))}</span>
    </button>`).join('')}</div>`;
}

function juzList() {
  return `<div class="juz-grid">${JUZ.map((start, i) => {
    const { s, a } = refOf(start);
    return `<button class="juz-card" data-act="go" data-to="#/mushaf/${pageOf(start)}">
      <small>الجزء</small><b>${num(i + 1)}</b><span>${suraName(s)} ${num(a)}</span>
    </button>`;
  }).join('')}</div>`;
}

function marksList() {
  const b = state.quran.bookmarks;
  if (!b.length) return `<div class="empty">${icon('bookmark')}<p>لا علامات بعد</p><small>اضغط على أي آية في المصحف ثم «حفظ علامة»</small></div>`;
  return `<div class="sura-list">${b.map((i) => {
    const { s, a } = refOf(i);
    return `<div class="sura-row mark-row">
      <button class="mark-go" data-act="go" data-to="#/mushaf/${pageOf(i)}:${i}">
        <span class="sura-num">${icon('bookmark')}</span>
        <span class="sura-txt"><b>سورة ${suraName(s)}، الآية ${num(a)}</b><small>الصفحة ${num(pageOf(i))} · الجزء ${num(juzOf(i))}</small></span>
      </button>
      <button class="icon-btn sm" data-act="q-unmark" data-i="${i}" aria-label="حذف العلامة">${icon('trash')}</button>
    </div>`;
  }).join('')}</div>`;
}

export function render() {
  return `${pageHead('القرآن الكريم', 'برواية حفص عن عاصم · مصحف المدينة')}
    <label class="search">${icon('search')}
      <input type="search" id="q-q" placeholder="ابحث في آيات القرآن…" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
    </label>
    <div id="q-body">
      ${query.trim() ? '<div class="empty">جارٍ البحث…</div>' : `
      ${continueCard()}
      ${khatmaCard()}
      <div class="seg tabs3" role="tablist">
        ${[['suras', 'السور'], ['juz', 'الأجزاء'], ['marks', 'العلامات']].map(([k, l]) => `<button class="seg-btn ${tab === k ? 'on' : ''}" data-act="q-tab" data-k="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}
      </div>
      ${tab === 'suras' ? suraList() : tab === 'juz' ? juzList() : marksList()}`}
    </div>
    <p class="muted small center tanzil-note">نص المصحف من مشروع <b>Tanzil</b> المُدقَّق (tanzil.net)، مدمج في التطبيق دون أي تعديل.</p>`;
}

async function runSearch(el) {
  const seq = ++searchSeq;
  const body = el.querySelector('#q-body');
  const q = query.trim();
  if (!q) { refresh(); return; }
  try {
    const [hits, text] = await Promise.all([searchQuran(q), loadText()]);
    if (seq !== searchSeq) return;
    body.innerHTML = hits.length ? `<p class="muted results-count">${num(hits.length)}${hits.length >= 80 ? '+' : ''} نتيجة</p>
      <div class="results">${hits.map((i) => {
        const { s, a } = refOf(i);
        return `<button class="result" data-act="go" data-to="#/mushaf/${pageOf(i)}:${i}"><small>سورة ${suraName(s)} · الآية ${num(a)}</small><p class="quran-text">${ayahOnly(text, i)}</p></button>`;
      }).join('')}</div>` : `<div class="empty">${icon('search')}<p>لا نتائج لـ «${esc(q)}»</p><small>اكتب كلمة من الآية بدون تشكيل</small></div>`;
  } catch (e) {
    body.innerHTML = `<div class="empty">${icon('info')}<p>تعذّر تحميل نص المصحف</p></div>`;
  }
}

let typing;
export function mount(el) {
  const input = el.querySelector('#q-q');
  input.addEventListener('input', () => {
    query = input.value;
    clearTimeout(typing);
    typing = setTimeout(() => runSearch(el), 250);
  });
  if (query.trim()) runSearch(el);
}
export function unmount() { clearTimeout(typing); }

function endDate(perDay, fromPage) {
  const d = new Date(Date.now() + (Math.ceil((604 - fromPage + 1) / perDay) - 1) * 86400000);
  return `${num(d.getDate())} ${GREG_MONTHS[d.getMonth()]} ${num(d.getFullYear())}`;
}

export function khatmaSheet() {
  const k = state.khatma;
  let perDay = k ? k.perDay : 5;
  let from = k ? k.page : 1;
  const last = state.quran.lastPage;
  openSheet(`<h3 class="sheet-title">${k ? 'خطة الختمة' : 'ختمة جديدة'}</h3>
    <div class="field"><span>كم صفحة تقرأ يومياً؟</span>
      <div class="plan-grid">${PLANS.map((p) => `<button class="plan ${p.perDay === perDay ? 'on' : ''}" data-per="${p.perDay}"><b>${num(p.label)}</b><small>${daysLabel(Math.ceil(604 / p.perDay))}</small></button>`).join('')}</div>
      <div class="stepper" style="margin-top:10px"><button class="icon-btn" data-step="-1" aria-label="إنقاص">${icon('minus')}</button><input id="k-per" type="text" inputmode="numeric" value="${num(perDay)}" aria-label="عدد الصفحات يومياً"><button class="icon-btn" data-step="1" aria-label="زيادة">${icon('plus')}</button><span class="muted">صفحة يومياً</span></div>
    </div>
    ${k ? '' : `<div class="field"><span>من أين تبدأ؟</span>
      <div class="seg"><button class="seg-btn on" data-from="1">من الفاتحة</button>${last > 1 ? `<button class="seg-btn" data-from="${last}">من الصفحة ${num(last)}</button>` : ''}</div></div>`}
    <div class="set-row"><span class="set-ic">${icon('bell')}</span><div class="set-txt"><b>تذكير يومي بالورد</b><small>${notificationsSupported ? 'إشعار في الوقت الذي تختاره' : 'متاح في تطبيق أندرويد'}</small></div>
      ${timeButton(k ? k.time : '20:00', 'id="k-time"')}<button class="switch ${!k || k.remind ? 'on' : ''}" role="switch" aria-checked="${!k || k.remind}" id="k-remind"><i></i></button></div>
    <p class="note" data-k-end></p>
    <div class="row-btns"><button class="btn btn-primary" data-k-save>${icon('check')} ${k ? 'حفظ' : 'ابدأ الختمة'}</button>
      ${k ? `<button class="btn btn-danger-soft" data-k-stop>${icon('trash')} إنهاء الختمة</button>` : '<button class="btn btn-ghost" data-close>إلغاء</button>'}</div>`, {
    onMount: (body, close) => {
      const per = body.querySelector('#k-per');
      const end = body.querySelector('[data-k-end]');
      const upd = () => {
        perDay = Math.max(1, Math.min(100, Math.round(parseNum(per.value)) || 1));
        body.querySelectorAll('[data-per]').forEach((b) => b.classList.toggle('on', +b.dataset.per === perDay));
        end.innerHTML = `${icon('calendar')} ستختم بإذن الله خلال ${daysLabel(Math.ceil((604 - from + 1) / perDay))} تقريباً، في ${endDate(perDay, from)}.`;
      };
      body.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => { per.value = num(b.dataset.per); upd(); }));
      body.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { per.value = num(Math.max(1, Math.min(100, (Math.round(parseNum(per.value)) || 1) + +b.dataset.step))); upd(); }));
      per.addEventListener('input', upd);
      per.addEventListener('blur', () => { per.value = num(perDay); });
      const kt = body.querySelector('#k-time');
      kt.addEventListener('click', async () => {
        const v = await pickTime(kt.dataset.value, 'وقت تذكير الورد');
        if (v) { kt.dataset.value = v; kt.querySelector('span').textContent = fmtClock(v); }
      });
      body.querySelectorAll('[data-from]').forEach((b) => b.addEventListener('click', () => {
        from = +b.dataset.from;
        body.querySelectorAll('[data-from]').forEach((x) => x.classList.toggle('on', x === b));
        upd();
      }));
      const sw = body.querySelector('#k-remind');
      sw.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); });
      upd();
      body.querySelector('[data-k-save]').addEventListener('click', async () => {
        const remind = sw.classList.contains('on');
        if (remind && notificationsSupported) await ensureNotifyPermission();
        const time = body.querySelector('#k-time').dataset.value || '20:00';
        if (k) Object.assign(k, { perDay, remind, time }); else startKhatma({ perDay, time, remind, fromPage: from });
        save();
        rescheduleNotifications();
        close();
        toast(k ? 'تم حفظ خطة الختمة' : 'بدأت ختمتك، يسّر الله لك', 'flag');
        refresh();
      });
      const stop = body.querySelector('[data-k-stop]');
      if (stop) stop.addEventListener('click', async () => {
        close();
        if (!(await confirmSheet('إنهاء الختمة', 'سيُحذف تقدّم هذه الختمة. هل أنت متأكد؟', 'إنهاء', true))) return;
        stopKhatma();
        rescheduleNotifications();
        refresh();
      });
    },
  });
}

export const actions = {
  'q-tab': (el) => { tab = el.dataset.k; refresh(); },
  'q-unmark': (el) => {
    state.quran.bookmarks = state.quran.bookmarks.filter((i) => i !== +el.dataset.i);
    save();
    refresh();
  },
  'k-new': () => khatmaSheet(),
  'k-edit': () => khatmaSheet(),
};
