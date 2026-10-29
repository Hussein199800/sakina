// قارئ المصحف: صفحة صفحة على تقسيم مصحف المدينة، مع السحب والعلامات وتقدّم الختمة
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num } from '../text.js';
import { SURAS, TOTAL_PAGES, JUZ } from '../data/quran-meta.js';
import { loadText, pageRange, refOf, suraOf, suraName, pageOf, juzOf, splitBasmala, ayahOnly } from '../quran.js';
import { pageRead, todayRange, readToday } from '../khatma.js';
import { openSheet, toast, tapFeedback } from '../ui.js';
import { registerText, toolsRow } from './dhikr.js';
import { rescheduleNotifications } from '../services.js';
import { go } from './common.js';

export const full = true;
export const tab = 'quran';

let page = 1;
let highlight = -1;
let text = null;
let rootRef;

function parse(param) {
  const [p, i] = String(param || '').split(':');
  page = Math.min(TOTAL_PAGES, Math.max(1, parseInt(p, 10) || state.quran.lastPage || 1));
  highlight = i !== undefined && i !== '' ? +i : -1;
}

function pageTitle() {
  const [a, b] = pageRange(page);
  const s1 = suraOf(a);
  const s2 = suraOf(b - 1);
  return s1 === s2 ? `سورة ${suraName(s1)}` : `${suraName(s1)} – ${suraName(s2)}`;
}

function khatmaPill() {
  const k = state.khatma;
  if (!k) return '';
  const r = todayRange(k);
  const target = Math.min(k.perDay, r.to - r.from + 1);
  const done = readToday(k);
  const onTrack = page === k.page;
  return `<span class="k-pill ${done >= target ? 'done' : ''} ${onTrack ? 'here' : ''}">${icon('flag')} ${done >= target ? 'أتممت ورد اليوم' : `الورد ${num(done)}/${num(target)}`}</span>`;
}

function pageHtml() {
  if (!text) return '<div class="mushaf-loading"><span class="spinner"></span><p>جارٍ فتح المصحف…</p></div>';
  const [a, b] = pageRange(page);
  let html = '';
  for (let i = a; i < b; i++) {
    const { s, a: ay } = refOf(i);
    const { basmala, text: body } = splitBasmala(i, text[i]);
    if (ay === 1) {
      const [name, ayas, , type] = SURAS[s - 1];
      if (html) html += '</p>';
      html += `<div class="sura-head"><span>سورة ${name}</span><small>${type === 'm' ? 'مكية' : 'مدنية'} · ${num(ayas)} آية</small></div>`;
      if (basmala) html += `<p class="basmala">${basmala}</p>`;
      html += '<p class="mushaf-text">';
    } else if (!html) html = '<p class="mushaf-text">';
    html += `<span class="ayah ${i === highlight ? 'hl' : ''} ${state.quran.bookmarks.indexOf(i) !== -1 ? 'marked' : ''}" data-ayah="${i}">${body} <span class="ayah-num" aria-label="الآية ${ay}">${num(ay)}</span></span> `;
  }
  return `${html}</p>`;
}

export function render(param) {
  parse(param);
  return `<header class="mushaf-bar">
      <button class="icon-btn" data-act="back" aria-label="رجوع">${icon('back')}</button>
      <button class="mb-title" data-act="m-jump"><b data-m-title>${pageTitle()}</b><small data-m-sub>الجزء ${num(juzOf(pageRange(page)[0]))} · الصفحة ${num(page)}</small></button>
      <button class="icon-btn" data-act="m-font" data-d="-2" aria-label="تصغير الخط"><span class="rt-a">A-</span></button>
      <button class="icon-btn" data-act="m-font" data-d="2" aria-label="تكبير الخط"><span class="rt-a">A+</span></button>
    </header>
    <article class="mushaf-page" data-page style="font-size:${state.quran.fontSize}px">${pageHtml()}</article>
    <footer class="mushaf-foot">
      <button class="nav-btn" data-act="m-prev" ${page <= 1 ? 'disabled' : ''} aria-label="الصفحة السابقة">${icon('back')}</button>
      <div class="mf-mid"><b>${num(page)}</b><small>من ${num(TOTAL_PAGES)}</small><span data-k-pill>${khatmaPill()}</span></div>
      <button class="nav-btn primary" data-act="m-next" ${page >= TOTAL_PAGES && !state.khatma ? 'disabled' : ''} aria-label="الصفحة التالية">${icon('chevron')}</button>
    </footer>`;
}

function show(root, dir) {
  const art = root.querySelector('[data-page]');
  art.innerHTML = pageHtml();
  art.classList.remove('slide-next', 'slide-prev');
  if (dir) { void art.offsetWidth; art.classList.add(`slide-${dir}`); }
  root.querySelector('[data-m-title]').textContent = pageTitle();
  root.querySelector('[data-m-sub]').textContent = `الجزء ${num(juzOf(pageRange(page)[0]))} · الصفحة ${num(page)}`;
  root.querySelector('.mf-mid b').textContent = num(page);
  root.querySelector('[data-k-pill]').innerHTML = khatmaPill();
  root.querySelector('[data-act="m-prev"]').disabled = page <= 1;
  root.querySelector('[data-act="m-next"]').disabled = page >= TOTAL_PAGES && !state.khatma;
  state.quran.lastPage = page;
  save();
  history.replaceState(null, '', `#/mushaf/${page}`);
  if (highlight >= 0) {
    const el = art.querySelector('.ayah.hl');
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  } else window.scrollTo(0, 0);
}

function finishedSheet() {
  tapFeedback('done');
  openSheet(`<div class="done-screen in-sheet">
    <div class="done-glow">${icon('check')}</div>
    <h2>مبارك، أتممت ختمة القرآن الكريم</h2>
    <p>هذه ختمتك رقم ${num(state.khatmaDone)}. جعله الله شفيعاً لك وحجة لك لا عليك.</p>
    <p class="muted small">ويُستحب الدعاء عند الختم؛ فقد كان أنس بن مالك رضي الله عنه إذا ختم القرآن جمع أهله فدعا. رواه الدارمي.</p>
    <div class="row-btns"><button class="btn btn-primary" data-new>${icon('flag')} ختمة جديدة</button><button class="btn btn-ghost" data-close>لاحقاً</button></div>
  </div>`, {
    onMount: (body, close) => body.querySelector('[data-new]').addEventListener('click', () => { close(); go('#/quran'); setTimeout(() => import('./quran.js').then((m) => m.khatmaSheet()), 300); }),
  });
}

function next(root) {
  const res = pageRead(page);
  if (res === 'finished') { rescheduleNotifications(); finishedSheet(); return; }
  if (res === 'advanced') {
    const k = state.khatma;
    const r = todayRange(k);
    if (readToday(k) === Math.min(k.perDay, r.to - r.from + 1)) { tapFeedback('item'); toast('أتممت ورد اليوم، تقبّل الله منك', 'flag'); }
    rescheduleNotifications();
  }
  if (page >= TOTAL_PAGES) return;
  page += 1;
  highlight = -1;
  show(root, 'next');
}

function prev(root) {
  if (page <= 1) return;
  page -= 1;
  highlight = -1;
  show(root, 'prev');
}

function ayahSheet(i) {
  const { s, a } = refOf(i);
  const ref = `سورة ${suraName(s)}: ${a}`;
  registerText(`ayah-${i}`, { text: `﴿${ayahOnly(text, i)}﴾`, source: ref, title: 'آية' });
  const marked = state.quran.bookmarks.indexOf(i) !== -1;
  openSheet(`<span class="eyebrow">${icon('book')} سورة ${suraName(s)} · الآية ${num(a)}</span>
    <p class="quran-text big">${ayahOnly(text, i)} <span class="ayah-num">${num(a)}</span></p>
    <p class="muted small">الصفحة ${num(pageOf(i))} · الجزء ${num(juzOf(i))}</p>
    ${toolsRow(`data-key="ayah-${i}"`)}
    <button class="btn ${marked ? 'btn-danger-soft' : 'btn-soft'} wide" data-mark>${icon('bookmark')} ${marked ? 'إزالة العلامة' : 'حفظ علامة عند هذه الآية'}</button>`, {
    onMount: (body, close) => body.querySelector('[data-mark]').addEventListener('click', () => {
      const b = state.quran.bookmarks;
      const at = b.indexOf(i);
      if (at === -1) b.unshift(i); else b.splice(at, 1);
      save();
      close();
      toast(at === -1 ? 'حُفظت العلامة' : 'أُزيلت العلامة', 'bookmark');
      const el = rootRef.querySelector(`[data-ayah="${i}"]`);
      if (el) el.classList.toggle('marked', at === -1);
    }),
  });
}

export function mount(root) {
  rootRef = root;
  const art = root.querySelector('[data-page]');
  if (!text) {
    loadText().then((t) => { text = t; if (rootRef === root) show(root); })
      .catch(() => { art.innerHTML = `<div class="empty">${icon('info')}<p>تعذّر فتح المصحف</p></div>`; });
  } else {
    state.quran.lastPage = page;
    save();
    if (highlight >= 0) { const el = art.querySelector('.ayah.hl'); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 60); }
  }
  art.addEventListener('click', (e) => {
    const el = e.target.closest('[data-ayah]');
    if (el && text) ayahSheet(+el.dataset.ayah);
  });
  // السحب: إلى اليمين للصفحة التالية (اتجاه تقليب المصحف)، وإلى اليسار للسابقة
  let x0 = null;
  let y0 = 0;
  art.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  art.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx > 0) next(root); else prev(root); }
  }, { passive: true });
}
export function unmount() { rootRef = null; }

function jumpSheet() {
  openSheet(`<h3 class="sheet-title">انتقل إلى</h3>
    <div class="field"><span>رقم الصفحة (١–٦٠٤)</span>
      <div class="stepper"><input id="m-page" type="number" min="1" max="604" value="${page}" inputmode="numeric"><button class="btn btn-primary" data-goto>${icon('chevron')} انتقل</button></div></div>
    <div class="field"><span>الجزء</span><div class="juz-chips">${JUZ.map((st, j) => `<button class="chip" data-p="${pageOf(st)}">${num(j + 1)}</button>`).join('')}</div></div>`, {
    onMount: (body, close) => {
      const goto = (p) => { close(); page = Math.min(604, Math.max(1, p)); highlight = -1; show(rootRef); };
      body.querySelector('[data-goto]').addEventListener('click', () => goto(parseInt(body.querySelector('#m-page').value, 10) || 1));
      body.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => goto(+b.dataset.p)));
    },
  });
}

export const actions = {
  'm-next': () => next(rootRef),
  'm-prev': () => prev(rootRef),
  'm-jump': () => jumpSheet(),
  'm-font': (el) => {
    state.quran.fontSize = Math.max(20, Math.min(44, state.quran.fontSize + +el.dataset.d));
    save();
    rootRef.querySelector('[data-page]').style.fontSize = `${state.quran.fontSize}px`;
  },
};
