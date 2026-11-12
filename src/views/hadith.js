// الأحاديث النبوية: الأربعون النووية ورياض الصالحين، تُحمَّل عند فتح الصفحة فقط وتعمل دون إنترنت
import { icon } from '../icons.js';
import { num, esc, normalize } from '../text.js';
import { fullHead } from './common.js';
import { openSheet, dhikrText } from '../ui.js';
import { registerText, toolsRow } from './dhikr.js';

export const full = true;
export const tab = 'more';

const BOOKS = [['nawawi', 'الأربعون النووية'], ['riyad', 'رياض الصالحين']];
const PAGE = 20;
let book = 'nawawi';
let riyadBook = -1; // -1 = كل الكتب
let query = '';
let shown = PAGE;
const cache = {};

function load(file) {
  if (!cache[file]) cache[file] = fetch(`build/${file}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).catch((e) => { delete cache[file]; throw e; });
  return cache[file];
}

/** معاينة البطاقة: تبدأ من قول النبي ﷺ (بعد أول علامة تنصيص أو «قال:») وتُقطع عند حدّ كلمة */
function firstLine(t) {
  let s = t.replace(/\n/g, ' ');
  const q = s.search(/["«]/);
  const said = s.search(/قَالَ:|قال:/);
  const from = q !== -1 && q < 260 ? q + 1 : said !== -1 && said < 260 ? s.indexOf(':', said) + 1 : 0;
  s = s.slice(from).trim();
  if (s.length <= 120) return s;
  const cut = s.lastIndexOf(' ', 120);
  return `${s.slice(0, cut > 60 ? cut : 120)}…`;
}

export function render(param) {
  if (BOOKS.some(([k]) => k === param)) { if (book !== param) { query = ''; shown = PAGE; } book = param; }
  return `${fullHead('الأحاديث النبوية', book === 'nawawi' ? 'للإمام يحيى بن شرف النووي' : 'للإمام النووي · ترقيم sunnah.com')}
    <div class="seg" role="tablist">${BOOKS.map(([k, l]) => `<button class="seg-btn ${book === k ? 'on' : ''}" data-act="hd-book" data-k="${k}" role="tab" aria-selected="${book === k}">${l}</button>`).join('')}</div>
    <label class="search">${icon('search')}<input type="search" data-hq value="${esc(query)}" placeholder="ابحث في الأحاديث بلا تشكيل…" autocomplete="off"></label>
    <div data-hd-books></div>
    <div class="hd-list" data-hd><div class="empty"><span class="spinner"></span></div></div>`;
}

function filterList(list) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return list;
  return list.filter((h) => { const k = h.key || (h.key = normalize(h.t)); return words.every((w) => k.indexOf(w) !== -1); });
}

async function draw(root) {
  const box = root.querySelector('[data-hd]');
  const booksBox = root.querySelector('[data-hd-books]');
  try {
    let list;
    if (book === 'nawawi') {
      const d = await load('nawawi.json');
      list = d.map(([n, t]) => ({ n, t, src: `الأربعون النووية: ${n}` }));
      booksBox.innerHTML = '';
    } else {
      const d = await load('riyad.json');
      booksBox.innerHTML = `<div class="cd-occ">${[{ id: -1, title: 'كل الكتب' }, ...d.books].map((b) => `<button class="chip ${riyadBook === b.id ? 'on' : ''}" data-act="hd-rbook" data-id="${b.id}">${esc(b.title.replace(/ـ+/g, ''))}</button>`).join('')}</div>`;
      list = d.h.filter((h) => riyadBook === -1 || h[1] === riyadBook).map(([n, , t]) => ({ n, t, src: `رياض الصالحين: ${n}` }));
    }
    const found = filterList(list);
    const page = found.slice(0, shown);
    box.innerHTML = found.length ? `${query ? `<p class="muted results-count">${num(found.length)} حديثاً</p>` : ''}
      ${page.map((h) => `<button class="hd-card" data-act="hd-open" data-n="${h.n}"><span class="sura-num">${num(h.n)}</span><p>${esc(dhikrText(firstLine(h.t)))}</p></button>`).join('')}
      ${found.length > shown ? `<button class="btn btn-soft wide" data-act="hd-more">عرض المزيد (${num(found.length - shown)})</button>` : ''}`
      : `<div class="empty">${icon('search')}<p>لا نتائج</p></div>`;
    root.hdList = list;
  } catch (e) {
    box.innerHTML = `<div class="empty">${icon('info')}<p>تعذّر تحميل الأحاديث</p></div>`;
  }
}

let rootEl;
export function mount(root) {
  rootEl = root;
  const q = root.querySelector('[data-hq]');
  let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { query = q.value; shown = PAGE; draw(root); }, 200); });
  draw(root);
}

export const actions = {
  'hd-book': (el) => { window.location.replace(`#/hadith/${el.dataset.k}`); },
  'hd-rbook': (el) => { riyadBook = +el.dataset.id; shown = PAGE; if (rootEl) draw(rootEl); },
  'hd-more': () => { shown += PAGE; if (rootEl) draw(rootEl); },
  'hd-open': (el) => {
    const list = rootEl && rootEl.hdList;
    const h = list && list.find((x) => x.n === +el.dataset.n);
    if (!h) return;
    const key = `hadith-${book}-${h.n}`;
    registerText(key, { text: h.t, source: h.src, title: book === 'nawawi' ? 'الأربعون النووية' : 'رياض الصالحين' });
    openSheet(`<div class="hd-sheet"><small class="muted">${esc(num(h.src))}</small>
      <p class="hadith-full">${esc(dhikrText(h.t)).replace(/\n/g, '<br>')}</p>
      ${toolsRow(`data-key="${key}"`)}</div>`, { cls: 'sheet-tall' });
  },
};
