// تخصيص الرئيسية: إظهار البطاقات وإخفاؤها، وترتيبها بالسحب أو بزرّي الأعلى والأسفل، واختيار الاختصارات
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num } from '../text.js';
import { HOME_CARDS, SHORTCUTS, MAX_SHORTCUTS, homeLayout, updateHome, moveCard } from '../home-layout.js';
import { fullHead, refresh } from './common.js';
import { toast, confirmSheet } from '../ui.js';

export const full = true;
export const tab = 'home';

const cardOf = (id) => HOME_CARDS.find((c) => c.id === id);

function rows() {
  const l = homeLayout();
  return l.order.map((id, i) => {
    const c = cardOf(id);
    const on = l.hidden.indexOf(id) === -1;
    return `<li class="cz-row ${on ? '' : 'off'}" data-id="${id}">
      <span class="cz-handle" data-handle aria-label="اسحب لتغيير الترتيب">${icon('list')}</span>
      <b class="cz-label">${c.label}</b>
      <button class="icon-btn sm" data-act="cz-move" data-id="${id}" data-d="-1" aria-label="تحريك ${c.label} لأعلى" ${i === 0 ? 'disabled' : ''}>${icon('chevron-up')}</button>
      <button class="icon-btn sm" data-act="cz-move" data-id="${id}" data-d="1" aria-label="تحريك ${c.label} لأسفل" ${i === l.order.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="إظهار ${c.label}" data-act="cz-toggle" data-id="${id}"><i></i></button>
    </li>`;
  }).join('');
}

export function render() {
  const l = homeLayout();
  return `${fullHead('تخصيص الرئيسية', 'اختر ما يظهر وبأي ترتيب')}
    <div class="cz-page">
      <section class="card set-card">
        <h2 class="set-title">${icon('grid')} البطاقات</h2>
        <p class="muted small">اسحب من المقبض لتغيير الترتيب، أو استخدم السهمين. البطاقة المخفية تبقى بياناتها كما هي.</p>
        <ul class="cz-list" data-list>${rows()}</ul>
      </section>
      <section class="card set-card">
        <h2 class="set-title">${icon('star')} اختصاراتي</h2>
        <p class="muted small">اختر حتى ${num(MAX_SHORTCUTS)} اختصارات، بالترتيب الذي تضغطها به. كل اختصار يفتح صفحته الأصلية.</p>
        <div class="chips">${SHORTCUTS.map((x) => {
    const i = l.shortcuts.indexOf(x.id);
    return `<button class="chip ${i !== -1 ? 'on' : ''}" data-act="cz-sc" data-id="${x.id}" aria-pressed="${i !== -1}">${icon(x.icon)} ${x.label}${i !== -1 ? ` <small>${num(i + 1)}</small>` : ''}</button>`;
  }).join('')}</div>
      </section>
      <button class="btn btn-ghost wide" data-act="cz-reset">${icon('refresh')} استعادة الترتيب الافتراضي</button>
      <p class="muted small center">الاستعادة تعيد البطاقات والاختصارات فقط، ولا تحذف أي بيانات ولا تغيّر بقية الإعدادات.</p>
    </div>`;
}

/** السحب بالإصبع أو الفأرة من المقبض: يتحرك الصف مع المؤشر ويُحفظ الترتيب عند الإفلات */
export function mount(root) {
  const list = root.querySelector('[data-list]');
  if (!list) return;
  let drag = null;
  list.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-handle]');
    if (!h) return;
    const row = h.closest('.cz-row');
    e.preventDefault();
    drag = { row, id: row.dataset.id };
    row.classList.add('dragging');
    if (h.setPointerCapture) try { h.setPointerCapture(e.pointerId); } catch (err) { /* تجاهل */ }
  });
  list.addEventListener('pointermove', (e) => {
    if (!drag) return;
    e.preventDefault();
    const others = [...list.querySelectorAll('.cz-row:not(.dragging)')];
    const after = others.find((r) => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (after) list.insertBefore(drag.row, after); else list.appendChild(drag.row);
  });
  const end = () => {
    if (!drag) return;
    drag.row.classList.remove('dragging');
    const order = [...list.querySelectorAll('.cz-row')].map((r) => r.dataset.id);
    drag = null;
    updateHome((l) => { l.order = order; });
    refresh();
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);
}

export const actions = {
  'cz-move': (el) => { moveCard(el.dataset.id, +el.dataset.d); refresh(); },
  'cz-toggle': (el) => {
    const id = el.dataset.id;
    updateHome((l) => {
      const i = l.hidden.indexOf(id);
      if (i === -1) l.hidden.push(id); else l.hidden.splice(i, 1);
    });
    refresh();
  },
  'cz-sc': (el) => {
    const id = el.dataset.id;
    let full = false;
    updateHome((l) => {
      const i = l.shortcuts.indexOf(id);
      if (i !== -1) l.shortcuts.splice(i, 1);
      else if (l.shortcuts.length >= MAX_SHORTCUTS) full = true;
      else l.shortcuts.push(id);
    });
    if (full) toast(`${num(MAX_SHORTCUTS)} اختصارات على الأكثر`, 'info');
    refresh();
  },
  'cz-reset': async () => {
    if (!(await confirmSheet('استعادة الترتيب الافتراضي', 'تعود بطاقات الرئيسية واختصاراتها كما كانت. لا تُحذف أي بيانات ولا تتغير بقية الإعدادات.', 'استعادة'))) return;
    state.settings.home = null;
    save();
    toast('عادت الرئيسية إلى ترتيبها الافتراضي', 'grid');
    refresh();
  },
};
