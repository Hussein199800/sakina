// «دعواتي»: أشخاص تدعو لهم بظهر الغيب، ودعواتك الخاصة لكل منهم. محفوظة على الجهاز فقط ولا تُشارَك تلقائياً.
// #/loved قائمة الأشخاص، و#/loved/ID صفحة الشخص
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { dateKey } from '../dates.js';
import { FORMS, HADITH_GHAIB, HADITH_GHAIB_SRC } from '../data/loved-duas.js';
import { fullHead, refresh, go } from './common.js';
import { openSheet, toast, confirmSheet, tapFeedback } from '../ui.js';

export const full = true;
export const tab = 'library';

const people = () => state.loved;
const byId = (id) => people().find((p) => p.id === id);
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function lastLabel(p) {
  if (!p.last) return 'لم تدعُ بعد';
  if (p.last === dateKey()) return 'دعوت اليوم';
  const [y, m, d] = p.last.split('-').map(Number);
  return `آخر دعاء ${num(`${d}/${m}/${y}`)}`;
}

function list() {
  const l = people();
  return `${fullHead('دعواتي', 'على جهازك فقط', `<button class="icon-btn" data-act="lv-add" aria-label="إضافة شخص">${icon('plus')}</button>`)}
    <div class="lv-page">
      <p class="lv-hadith">${HADITH_GHAIB} <small class="src">${HADITH_GHAIB_SRC}</small></p>
      ${l.length ? `<div class="lv-list card">${l.map((p) => `
        <button class="lv-row" data-act="go" data-to="#/loved/${p.id}">
          <span class="lv-av">${esc(p.name.trim().charAt(0))}</span>
          <span class="lv-txt"><b>${esc(p.name)}</b><small>${FORMS[p.form]} · ${num(p.duas.length)} دعوة خاصة · ${lastLabel(p)}</small></span>
          ${icon('chevron')}
        </button>`).join('')}</div>`
    : `<div class="empty">${icon('heart')}<p>لم تضف أحداً بعد</p><small>أضف من تحب لتتذكر الدعاء له بظهر الغيب</small>
        <button class="btn btn-primary" data-act="lv-add">${icon('plus')} إضافة شخص</button></div>`}
    </div>`;
}

function detail(p) {
  return `${fullHead(esc(p.name), FORMS[p.form], `<button class="icon-btn" data-act="lv-edit" data-id="${p.id}" aria-label="تعديل">${icon('edit')}</button>`)}
    <div class="lv-page">
      <section class="card lv-pray">
        <button class="counter-btn lv-tap" data-act="lv-prayed" data-id="${p.id}" aria-label="دعوت الآن">${icon('hands')}</button>
        <div><b>دعوت ${num(p.count)} ${p.count === 1 ? 'مرة' : 'مرات'}</b><small>${lastLabel(p)}</small></div>
      </section>
      <section class="card set-card">
        <div class="lv-head"><h2 class="set-title">${icon('heart')} دعواتي الخاصة</h2><button class="link-btn" data-act="lv-dua" data-id="${p.id}">${icon('plus')} إضافة</button></div>
        ${p.duas.length ? p.duas.map((d) => `<div class="lv-dua"><p>${esc(d.t)}</p>
          <button class="icon-btn sm" data-act="lv-dua" data-id="${p.id}" data-d="${d.id}" aria-label="تعديل">${icon('edit')}</button></div>`).join('')
    : '<p class="muted small">اكتب ما تحب أن تدعو به له، يبقى خاصاً على جهازك.</p>'}
      </section>
      <div class="row-btns">
        <button class="btn btn-primary" data-act="go" data-to="#/card/p:${p.id}">${icon('image')} إنشاء بطاقة دعاء</button>
        <button class="btn btn-danger-soft" data-act="lv-del" data-id="${p.id}">${icon('trash')} حذف</button>
      </div>
      <p class="muted small center">بطاقة الدعاء تأخذ الاسم والصيغة فقط، ولا تُضاف إليها دعواتك الخاصة إلا إن كتبتها بنفسك.</p>
    </div>`;
}

export function render(param) {
  if (param) {
    const p = byId(param);
    if (p) return detail(p);
  }
  return list();
}

/** نافذة إضافة شخص أو تعديله؛ تعيد الشخص عند الحفظ */
export function personEditor(existing, preset = {}) {
  return new Promise((resolve) => {
    let form = existing ? existing.form : preset.form || 'm';
    openSheet(`<h3 class="sheet-title">${existing ? 'تعديل' : 'إضافة شخص'}</h3>
      <label class="field"><span>الاسم</span><input type="text" data-name maxlength="120" value="${esc(existing ? existing.name : preset.name || '')}" placeholder="الاسم كما تحب أن تذكره"></label>
      <div class="field"><span>الصيغة</span><div class="seg">${Object.entries(FORMS).map(([k, l]) => `<button class="seg-btn ${form === k ? 'on' : ''}" data-form="${k}">${l}</button>`).join('')}</div></div>
      <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} حفظ</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
      onClose: () => resolve(null),
      onMount: (body, close) => {
        body.querySelectorAll('[data-form]').forEach((b) => b.addEventListener('click', () => {
          form = b.dataset.form;
          body.querySelectorAll('[data-form]').forEach((x) => x.classList.toggle('on', x === b));
        }));
        body.querySelector('[data-save]').addEventListener('click', () => {
          const name = body.querySelector('[data-name]').value.trim();
          if (!name) { toast('اكتب الاسم أولاً', 'info'); return; }
          let p = existing;
          if (p) Object.assign(p, { name, form });
          else { p = { id: uid('p'), name, form, duas: [], count: 0, last: '' }; state.loved.push(p); }
          save();
          resolve(p);
          close();
        });
      },
    });
  });
}

export const actions = {
  'lv-add': async () => { const p = await personEditor(); if (p) go(`#/loved/${p.id}`); },
  'lv-edit': async (el) => { const p = byId(el.dataset.id); if (p && await personEditor(p)) refresh(); },
  'lv-prayed': (el) => {
    const p = byId(el.dataset.id);
    if (!p) return;
    p.count += 1;
    p.last = dateKey();
    save();
    tapFeedback('item');
    toast('تقبّل الله دعاءك، ولك بمثل', 'heart');
    refresh();
  },
  'lv-dua': (el) => {
    const p = byId(el.dataset.id);
    if (!p) return;
    const d = el.dataset.d ? p.duas.find((x) => x.id === el.dataset.d) : null;
    openSheet(`<h3 class="sheet-title">${d ? 'تعديل الدعوة' : 'دعوة خاصة'}</h3>
      <label class="field"><span>نص الدعاء</span><textarea rows="5" data-t maxlength="2000" placeholder="اللهم…">${esc(d ? d.t : '')}</textarea></label>
      <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} حفظ</button>
      ${d ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} حذف</button>` : '<button class="btn btn-ghost" data-close>إلغاء</button>'}</div>`, {
      onMount: (body, close) => {
        body.querySelector('[data-save]').addEventListener('click', () => {
          const t = body.querySelector('[data-t]').value.trim();
          if (!t) { toast('اكتب الدعاء أولاً', 'info'); return; }
          if (d) d.t = t; else p.duas.push({ id: uid('d'), t });
          save();
          close();
          refresh();
        });
        const del = body.querySelector('[data-del]');
        if (del) del.addEventListener('click', () => { p.duas = p.duas.filter((x) => x !== d); save(); close(); refresh(); });
      },
    });
  },
  'lv-del': async (el) => {
    const p = byId(el.dataset.id);
    if (!p || !(await confirmSheet('حذف من دعواتي', `سيُحذف «${esc(p.name)}» ودعواتك الخاصة له من جهازك. لا تتأثر بطاقات الدعاء المحفوظة.`, 'حذف', true))) return;
    state.loved = state.loved.filter((x) => x !== p);
    save();
    go('#/loved');
  },
};
