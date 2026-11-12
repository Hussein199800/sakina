// التبويب الثاني: مكتبة الأذكار والأدعية
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, normalize, parseNum } from '../text.js';
import { CATEGORIES } from '../data/adhkar.js';
import { FEELINGS } from '../data/spirit.js';
import { HADITH_GHAIB, HADITH_GHAIB_SRC } from '../data/loved-duas.js';
import { NOT_MEDICAL } from './feel.js';
import { catProgress, itemsOf } from '../services.js';
import { pageHead, bar, go } from './common.js';
import { openSheet, toast, dhikrText } from '../ui.js';

let query = '';
const INDEX = CATEGORIES.flatMap((c) => c.items.map((it, i) => ({ it, cat: c, i, key: normalize(`${c.title} ${it.h || ''} ${it.t}`) })));

function catCard(c, big = false) {
  const p = catProgress(c.id);
  const items = itemsOf(c.id);
  return `<button class="cat-card tone-${c.tone} ${big ? 'big' : ''}" data-act="go" data-to="#/read/${c.id}">
    <span class="cat-ic">${icon(c.icon)}</span>
    <span class="cat-txt"><b>${c.title}</b><small>${c.sub}</small></span>
    ${big ? `<span class="cat-prog">${bar(p)}<small>${p >= 1 ? 'مكتمل ✓' : `${num(items.length)} ذكراً`}</small></span>` : ''}
  </button>`;
}

const TABS = [['daily', 'اليومية'], ['awrad', 'الأوراد'], ['feel', 'صيدلية الروح'], ['loved', 'لمن تحب']];
let tab = 'daily';
const group = (g) => CATEGORIES.filter((c) => c.group === g);

function daily() {
  return `
    <section class="block">
      <div class="block-head"><h2>أذكار اليوم والليلة</h2></div>
      <div class="cat-grid">${group('daily').map((c) => catCard(c, true)).join('')}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>أذكار المواقف اليومية</h2></div>
      <div class="cat-rows">${group('moments').map((c) => catCard(c)).join('')}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>أذكار المواقف والأحوال</h2></div>
      <div class="cat-rows">${group('situations').map((c) => catCard(c)).join('')}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>الأدعية والرقية</h2></div>
      <div class="cat-rows one">${group('duas').map((c) => catCard(c)).join('')}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>خاصّتي</h2></div>
      <div class="mine-grid">
        <button class="mine-card tone-rose" data-act="go" data-to="#/read/favorites">
          <span class="cat-ic">${icon('heart')}</span><b>المفضلة</b><small>${num(state.favorites.length)} محفوظ</small>
        </button>
        <button class="mine-card tone-violet" data-act="go" data-to="#/read/custom">
          <span class="cat-ic">${icon('edit')}</span><b>أذكاري الخاصة</b><small>${num(state.custom.length)} ذكر</small>
        </button>
      </div>
      <button class="btn btn-soft wide" data-act="custom-add">${icon('plus')} إضافة ذكر أو دعاء جديد</button>
    </section>`;
}

function awrad() {
  const mine = state.mywird || [];
  return `
    <section class="block">
      <div class="block-head"><h2>أوراد مأثورة</h2><span class="muted">بنصّها ومصدرها</span></div>
      <div class="cat-grid even">${group('wird').map((c) => catCard(c, true)).join('')}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>أورادي الشخصية</h2><span class="muted">من اختيارك</span></div>
      <div class="mine-grid">
        <button class="mine-card tone-teal" data-act="go" data-to="#/read/mywird">
          <span class="cat-ic">${icon('list')}</span><b>وردي الخاص</b><small>${mine.length ? `${num(mine.length)} ذكر` : 'ابنِه من المكتبة'}</small>
        </button>
        <button class="mine-card tone-violet" data-act="go" data-to="#/read/custom">
          <span class="cat-ic">${icon('edit')}</span><b>أذكاري الخاصة</b><small>${num(state.custom.length)} ذكر</small>
        </button>
      </div>
      <button class="btn btn-soft wide" data-act="go" data-to="#/mywird">${icon('edit')} ${mine.length ? 'تعديل وردي الخاص' : 'ابنِ وردك الخاص'}</button>
      <p class="muted small">الورد الشخصي تختار أذكاره وأعداده بنفسك، ولا يُنسب إليه فضل أو عدد شرعي إلا ما ورد في الذكر نفسه.</p>
    </section>`;
}

function feel() {
  return `
    <section class="block">
      <div class="block-head"><h2>بماذا يشعر قلبك؟</h2></div>
      <div class="feel-grid">${FEELINGS.map((f) => `
        <button class="feel-card tone-${f.tone}" data-act="go" data-to="#/feel/${f.id}">
          <span class="cat-ic">${icon(f.icon)}</span><b>${f.label}</b><small>آية ودعاء${f.cat ? ' وأذكار' : ''}</small>
        </button>`).join('')}</div>
      <p class="muted small center">${NOT_MEDICAL}</p>
    </section>`;
}

function loved() {
  const n = state.loved.length;
  const designs = state.cardDesigns || [];
  return `
    <p class="lv-hadith">${HADITH_GHAIB} <small class="src">${HADITH_GHAIB_SRC}</small></p>
    <div class="lv-entries">
      <button class="lv-entry tone-rose" data-act="go" data-to="#/loved">
        <span class="cat-ic">${icon('heart')}</span><b>دعواتي</b><small>${n ? `${num(n)} ${n === 1 ? 'شخص' : 'أشخاص'} تدعو لهم` : 'من تدعو لهم بظهر الغيب'}</small>
      </button>
      <button class="lv-entry tone-teal" data-act="go" data-to="#/card/new">
        <span class="cat-ic">${icon('image')}</span><b>ادعُ لأخيك</b><small>دعوة طيبة لمن تحب، باسمهم وبأسلوبك</small>
      </button>
    </div>
    ${state.cardDraft && state.cardDraft.text ? `<button class="link-row" data-act="go" data-to="#/card">${icon('edit')} متابعة البطاقة غير المكتملة ${icon('chevron')}</button>` : ''}
    ${designs.length ? `<div class="block-head"><h2>تصاميمي</h2></div><div class="chips">${designs.slice(0, 8).map((d) => `<button class="chip" data-act="go" data-to="#/card/d:${d.id}">${icon('bookmark')} ${esc(d.title)}</button>`).join('')}</div>` : ''}
    <p class="muted small">دعواتك الخاصة على جهازك فقط. البطاقة لا تُنشر إلا حين تختار المشاركة، ولا تُضاف إليها أي بيانات أخرى.</p>`;
}

function sections() {
  return tab === 'awrad' ? awrad() : tab === 'feel' ? feel() : tab === 'loved' ? loved() : daily();
}

function results() {
  const q = normalize(query);
  const words = q.split(' ').filter(Boolean);
  const custom = state.custom.map((it, i) => ({ it, cat: { id: 'custom', title: 'أذكاري الخاصة' }, i, key: normalize(it.t) }));
  const found = INDEX.concat(custom).filter((x) => words.every((w) => x.key.indexOf(w) !== -1)).slice(0, 60);
  if (!found.length) return `<div class="empty">${icon('search')}<p>لا نتائج لـ «${esc(query)}»</p><small>جرّب كلمة أخرى، البحث يعمل بدون تشكيل</small></div>`;
  return `<p class="muted results-count">${num(found.length)} نتيجة</p>
    <div class="results">${found.map((x) => `
      <button class="result" data-act="go" data-to="#/read/${x.cat.id}:${x.i}">
        <small>${x.cat.title}${x.it.h ? ` · ${x.it.h}` : ''}</small>
        <p>${esc(dhikrText(x.it.t))}</p>
      </button>`).join('')}</div>`;
}

export function render(param) {
  if (TABS.some(([k]) => k === param)) tab = param;
  return `${pageHead('الأذكار والأدعية', 'من حصن المسلم وصحيح السنة')}
    <div class="seg tabs3" role="tablist">${TABS.map(([k, l]) => `<button class="seg-btn ${tab === k ? 'on' : ''}" data-act="lib-tab" data-k="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    ${searchable() ? `<label class="search">${icon('search')}
      <input type="search" id="lib-q" placeholder="ابحث في نص الذكر أو عنوانه…" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
      <button class="icon-btn sm ${query ? '' : 'hidden'}" data-act="lib-clear" aria-label="مسح">${icon('x')}</button>
    </label>` : ''}
    <div id="lib-body">${searchable() && query ? results() : sections()}</div>`;
}

// البحث في الأذكار يظهر في تبويبي اليومية والأوراد فقط
const searchable = () => tab === 'daily' || tab === 'awrad';

export function mount(el) {
  const input = el.querySelector('#lib-q');
  if (!input) return;
  input.addEventListener('input', () => {
    query = input.value;
    el.querySelector('#lib-body').innerHTML = query.trim() ? results() : sections();
    el.querySelector('[data-act="lib-clear"]').classList.toggle('hidden', !query);
  });
}

/** نافذة إضافة/تعديل ذكر خاص */
export function customEditor(existing) {
  const it = existing || { t: '', n: 1, note: '' };
  openSheet(`<h3 class="sheet-title">${existing ? 'تعديل الذكر' : 'ذكر أو دعاء جديد'}</h3>
    <label class="field"><span>نص الذكر أو الدعاء</span>
      <textarea id="c-text" rows="5" placeholder="اكتب دعاءك هنا…">${esc(it.t)}</textarea></label>
    <div class="field"><span>عدد مرات التكرار</span>
      <div class="stepper">
        <button class="icon-btn" data-step="-1" aria-label="إنقاص">${icon('minus')}</button>
        <input id="c-n" type="text" inputmode="numeric" value="${num(it.n)}" aria-label="عدد مرات التكرار">
        <button class="icon-btn" data-step="1" aria-label="زيادة">${icon('plus')}</button>
      </div>
      <div class="quick-n">${[1, 3, 7, 33, 100].map((n) => `<button class="chip" data-n="${n}">${num(n)}</button>`).join('')}</div>
    </div>
    <label class="field"><span>ملاحظة (اختياري)</span><input id="c-note" type="text" value="${esc(it.note || '')}" placeholder="مثلاً: بعد صلاة الفجر"></label>
    <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} حفظ</button>
    ${existing ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} حذف</button>` : '<button class="btn btn-ghost" data-close>إلغاء</button>'}</div>`, {
    onMount: (body, close) => {
      const n = body.querySelector('#c-n');
      const count = () => Math.min(10000, Math.max(1, Math.round(parseNum(n.value)) || 1));
      body.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => { n.value = num(Math.min(10000, Math.max(1, count() + +b.dataset.step))); }));
      body.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { n.value = num(b.dataset.n); }));
      n.addEventListener('blur', () => { n.value = num(count()); });
      body.querySelector('[data-save]').addEventListener('click', () => {
        const t = body.querySelector('#c-text').value.trim();
        if (!t) { toast('اكتب نص الذكر أولاً', 'info'); return; }
        const data = { t, n: count(), note: body.querySelector('#c-note').value.trim(), s: 'من أذكاري الخاصة' };
        if (existing) Object.assign(state.custom.find((c) => c.id === existing.id), data);
        else state.custom.push({ id: `custom-${Date.now().toString(36)}`, ...data });
        save();
        close();
        toast(existing ? 'تم حفظ التعديل' : 'تمت إضافة الذكر');
        document.dispatchEvent(new Event('app:refresh'));
      });
      const del = body.querySelector('[data-del]');
      if (del) del.addEventListener('click', () => {
        state.custom = state.custom.filter((c) => c.id !== existing.id);
        state.favorites = state.favorites.filter((id) => id !== existing.id);
        delete state.progress.counts[existing.id];
        save();
        close();
        toast('تم حذف الذكر', 'trash');
        document.dispatchEvent(new Event('app:refresh'));
      });
    },
  });
}

export const actions = {
  'lib-tab': (el) => { tab = el.dataset.k; window.location.replace(`#/library/${tab}`); },
  'lib-clear': () => { query = ''; go('#/library'); document.dispatchEvent(new Event('app:refresh')); },
  'custom-add': () => customEditor(),
  'custom-edit': (el) => customEditor(state.custom.find((c) => c.id === el.dataset.id)),
};
