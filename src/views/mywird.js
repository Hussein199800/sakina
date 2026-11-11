// بناء «وردي الخاص»: اختيار أذكار من المكتبة أو من أذكاري الخاصة، وتحديد عدد كل منها، وترتيبها
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, normalize } from '../text.js';
import { CATEGORIES, ITEM_BY_ID, CATEGORY_BY_ID } from '../data/adhkar.js';
import { fullHead, refresh } from './common.js';
import { openSheet, toast, dhikrText } from '../ui.js';

export const full = true;
export const tab = 'library';
const MAX = 40;

const list = () => { if (!Array.isArray(state.mywird)) state.mywird = []; return state.mywird; };
const itemOf = (id) => (id.startsWith('custom-') ? state.custom.find((c) => c.id === id) : ITEM_BY_ID[id]);
const sourceOf = (id) => (id.startsWith('custom-') ? 'من أذكاري الخاصة' : (CATEGORY_BY_ID[ITEM_BY_ID[id].cat] || {}).title);
const short = (t) => { const w = dhikrText(t).replace(/\n+/g, ' ').split(' '); return w.length > 14 ? `${w.slice(0, 14).join(' ')}…` : w.join(' '); };

export function render() {
  const l = list().filter((w) => itemOf(w.id));
  return `${fullHead('وردي الخاص', 'ورد شخصي من اختيارك')}
    <div class="mw-page">
      <p class="note">${icon('info')} اختر أذكاراً من المكتبة وحدّد عدد تكرار كل منها. الأعداد هنا من اختيارك، والفضل والمصدر يبقيان كما في الذكر الأصلي.</p>
      ${l.length ? `<ul class="mw-list">${l.map((w, i) => {
    const it = itemOf(w.id);
    return `<li class="mw-row card">
        <div class="mw-txt"><small>${esc(sourceOf(w.id))}</small><p>${esc(short(it.t))}</p></div>
        <div class="mw-ctl">
          <div class="stepper sm"><button class="icon-btn" data-act="mw-n" data-i="${i}" data-d="-1" aria-label="إنقاص">${icon('minus')}</button><b class="mw-n">${num(w.n)}</b><button class="icon-btn" data-act="mw-n" data-i="${i}" data-d="1" aria-label="زيادة">${icon('plus')}</button></div>
          <button class="icon-btn sm" data-act="mw-move" data-i="${i}" data-d="-1" aria-label="لأعلى" ${i === 0 ? 'disabled' : ''}>${icon('chevron-up')}</button>
          <button class="icon-btn sm" data-act="mw-move" data-i="${i}" data-d="1" aria-label="لأسفل" ${i === l.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="icon-btn sm" data-act="mw-del" data-i="${i}" aria-label="حذف">${icon('trash')}</button>
        </div>
      </li>`;
  }).join('')}</ul>` : `<div class="empty">${icon('list')}<p>وردك فارغ</p><small>أضف أول ذكر من المكتبة</small></div>`}
      <div class="row-btns">
        <button class="btn btn-primary" data-act="mw-add">${icon('plus')} إضافة ذكر</button>
        ${l.length ? `<button class="btn btn-soft" data-act="go" data-to="#/read/mywird">${icon('book')} اقرأ وردي</button>` : ''}
      </div>
    </div>`;
}

const INDEX = () => CATEGORIES.flatMap((c) => c.items.map((it) => ({ id: it.id, title: c.title, t: it.t, key: normalize(`${c.title} ${it.h || ''} ${it.t}`) })))
  .concat(state.custom.map((c) => ({ id: c.id, title: 'أذكاري الخاصة', t: c.t, key: normalize(c.t) })));

export const actions = {
  'mw-add': () => {
    if (list().length >= MAX) { toast(`${num(MAX)} ذكراً على الأكثر`, 'info'); return; }
    const all = INDEX();
    openSheet(`<h3 class="sheet-title">أضف ذكراً إلى وردك</h3>
      <label class="search in-sheet">${icon('search')}<input type="search" placeholder="ابحث في الأذكار…" data-q></label>
      <div class="mw-pick" data-list></div>`, {
      cls: 'sheet-tall',
      onMount: (body, close) => {
        const box = body.querySelector('[data-list]');
        const draw = (q) => {
          const words = normalize(q || '').split(' ').filter(Boolean);
          const have = list().map((w) => w.id);
          const found = all.filter((x) => have.indexOf(x.id) === -1 && words.every((w) => x.key.indexOf(w) !== -1)).slice(0, 60);
          box.innerHTML = found.map((x) => `<button class="result" data-id="${x.id}"><small>${esc(x.title)}</small><p>${esc(short(x.t))}</p></button>`).join('') || '<p class="muted center">لا نتائج</p>';
        };
        draw('');
        body.querySelector('[data-q]').addEventListener('input', (e) => draw(e.target.value));
        box.addEventListener('click', (e) => {
          const b = e.target.closest('[data-id]');
          if (!b) return;
          const it = itemOf(b.dataset.id);
          list().push({ id: b.dataset.id, n: it ? it.n : 1 });
          save();
          close();
          toast('أُضيف إلى وردك');
          refresh();
        });
      },
    });
  },
  'mw-n': (el) => {
    const w = list()[+el.dataset.i];
    if (!w) return;
    // خطوات شائعة للتكرار: ١، ٣، ٧، ١٠، ٣٣، ١٠٠، ١٠٠٠
    const steps = [1, 3, 7, 10, 33, 100, 1000];
    if (+el.dataset.d > 0) w.n = steps.find((x) => x > w.n) || Math.min(10000, w.n + 1000);
    else { const lower = steps.filter((x) => x < w.n); w.n = lower.length ? lower[lower.length - 1] : 1; }
    save();
    refresh();
  },
  'mw-move': (el) => {
    const l = list();
    const i = +el.dataset.i;
    const j = i + +el.dataset.d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    save();
    refresh();
  },
  'mw-del': (el) => { list().splice(+el.dataset.i, 1); save(); refresh(); },
};
