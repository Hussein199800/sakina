// «مداخل السور»: صفحة واحدة بكل سور القرآن بالترتيب، وكل سورة بطاقة تُفتح على: سبب التسمية، ووقت النزول،
// وسبب النزول، ومقاصد السورة، وعدد الآيات. #/suras أو #/suras/18 لفتح سورة بعينها
import { icon } from '../icons.js';
import { num, esc, normalize } from '../text.js';
import { SURAS } from '../data/quran-meta.js';
import { SURA_INFO } from '../data/sura-info.js';
import { NOTES, NO_SABAB, PENDING, DISCLAIMER, SOURCES } from '../data/sura-notes.js';
import { suraStartPage, loadText, ayahOnly, indexOf } from '../quran.js';
import { fullHead } from './common.js';
import { dhikrText } from '../ui.js';

export const full = true;
export const tab = 'quran';

const open = new Set();
let query = '';

const placeName = (p) => (p === 'm' ? 'مكية' : 'مدنية');
/** نص فيه آيات بين ﴿﴾: تُعرض الآيات بخط المصحف داخل السطر */
const rich = (t) => dhikrText(t).replace(/﴿[^﴾]*﴾/g, (q) => `<span class="q-inline">${q}</span>`);
/** السورة التي نزلت قبل هذه في ترتيب النزول */
const BY_ORDER = [];
SURA_INFO.forEach(([, order], i) => { BY_ORDER[order] = i + 1; });

function when(s) {
  const [place, order] = SURA_INFO[s - 1];
  const tanzil = SURAS[s - 1][3];
  const prev = BY_ORDER[order - 1];
  const n = NOTES[s] && NOTES[s].when;
  return `<p><b>${placeName(place)}</b>، ${place === 'm' ? 'أي نزلت قبل الهجرة' : 'أي نزلت بعد الهجرة'}${tanzil !== place ? `، وعدّها بعضهم ${placeName(tanzil)}` : ''}.</p>
    <p>ترتيبها في النزول: ${num(order)}${prev ? `، نزلت بعد سورة ${SURAS[prev - 1][0]}` : '، وهي أول ما نزل'} <small class="muted">(على الترتيب المشهور، وهو تقريبي اجتهادي)</small>.</p>
    ${n ? `<p>${rich(n.t)} <small class="src">${n.src}</small></p>` : ''}`;
}

function nameWhy(s) {
  const n = NOTES[s];
  if (!n) return `<p class="muted">${PENDING}</p>`;
  const r = n.name.ref;
  return `<p>${rich(n.name.w)}${n.name.src ? ` <small class="src">${n.name.src}</small>` : ''}</p>
    ${r ? `<p class="quran-text si-ayah" data-ayah="${indexOf(r[0], r[1])}">…</p><small class="muted">سورة ${SURAS[r[0] - 1][0]}: ${num(r[1])}</small>` : ''}`;
}

function sabab(s) {
  const n = NOTES[s];
  if (!n) return `<p class="muted">${PENDING}</p>`;
  if (!n.sabab) return `<p class="muted">${NO_SABAB}</p>`;
  return `<p>${rich(n.sabab.t)} <small class="src">${n.sabab.src}</small></p>`;
}

function body(s) {
  const [name, ayas] = SURAS[s - 1];
  const sec = (k, ic, title, html) => `<div class="si-sec"><span class="si-k">${num(k)}</span><div><b class="si-t">${icon(ic)} ${title}</b>${html}</div></div>`;
  return `<div class="si-body">
    ${sec(1, 'info', 'لماذا سُمّيت بهذا الاسم؟', nameWhy(s))}
    ${sec(2, 'calendar', 'متى نزلت؟', when(s))}
    ${sec(3, 'book', 'سبب نزولها', sabab(s))}
    ${sec(4, 'list', 'من مقاصد السورة', `<p>${esc(SURA_INFO[s - 1][2])} <small class="src">المختصر</small></p>`)}
    ${sec(5, 'quran', 'عدد آياتها', `<p>${num(ayas)} آية</p>`)}
    <button class="btn btn-soft wide" data-act="go" data-to="#/mushaf/${suraStartPage(s)}">${icon('book')} اقرأ سورة ${name}</button>
  </div>`;
}

function card(s) {
  const [name, ayas] = SURAS[s - 1];
  const isOpen = open.has(s);
  return `<article class="si-card ${isOpen ? 'open' : ''}" id="sura-${s}">
    <button class="si-head" data-act="si-toggle" data-s="${s}" aria-expanded="${isOpen}">
      <span class="sura-num">${num(s)}</span>
      <span class="sura-txt"><b>سورة ${name}</b><small>${placeName(SURA_INFO[s - 1][0])} · ${num(ayas)} آية</small></span>
      <span class="si-chev">${icon('down')}</span>
    </button>
    ${isOpen ? body(s) : ''}
  </article>`;
}

function list() {
  const q = normalize(query.trim());
  const all = SURAS.map((_, i) => i + 1);
  const shown = q ? all.filter((s) => normalize(SURAS[s - 1][0]).indexOf(q) !== -1 || String(s) === q.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))) : all;
  return shown.length ? shown.map(card).join('') : `<div class="empty">${icon('search')}<p>لا توجد سورة بهذا الاسم</p></div>`;
}

export function render(param) {
  const s = +param;
  if (s >= 1 && s <= 114) open.add(s);
  return `${fullHead('مداخل السور', 'تعريف موجز بكل سورة من سور القرآن')}
    <div class="si-page">
      <p class="note">${icon('info')} ${DISCLAIMER}</p>
      <label class="search">${icon('search')}<input type="search" placeholder="ابحث باسم السورة أو رقمها…" data-sq value="${esc(query)}" autocomplete="off"></label>
      <div class="si-list" data-list>${list()}</div>
      <details class="si-sources"><summary>المصادر</summary><ul>${SOURCES.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
    </div>`;
}

/** يملأ الآيات المستشهد بها من نص المصحف المدمج (Tanzil) */
async function fillAyat(root) {
  const els = root.querySelectorAll('[data-ayah]');
  if (!els.length) return;
  try {
    const text = await loadText();
    els.forEach((el) => { el.innerHTML = `﴿${ayahOnly(text, +el.dataset.ayah)}﴾`; el.removeAttribute('data-ayah'); });
  } catch (e) {
    els.forEach((el) => { el.remove(); });
  }
}

let rootEl;
export function mount(root, param) {
  rootEl = root;
  const input = root.querySelector('[data-sq]');
  input.addEventListener('input', () => { query = input.value; root.querySelector('[data-list]').innerHTML = list(); fillAyat(root); });
  fillAyat(root);
  const s = +param;
  if (s >= 1 && s <= 114) {
    setTimeout(() => {
      const el = root.querySelector(`#sura-${s}`);
      const head = document.querySelector('.full-head');
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (head ? head.offsetHeight : 0) - 10);
    }, 30);
  }
}
export function unmount() { rootEl = null; }

export const actions = {
  'si-toggle': (el) => {
    const s = +el.dataset.s;
    if (open.has(s)) open.delete(s); else open.add(s);
    const art = el.closest('.si-card');
    if (!art || !rootEl) return;
    art.outerHTML = card(s);
    fillAyat(rootEl);
  },
};
