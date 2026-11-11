// «ادعُ لأخيك»: إنشاء بطاقة دعاء في ثلاث خطوات قصيرة (لمن؟ ← الدعاء ← التصميم)، ثم المشاركة باختيار المستخدم.
// #/card متابعة المسودة، #/card/new بطاقة جديدة، #/card/p:ID لشخص من دعواتي، #/card/d:ID تصميم محفوظ
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { OCCASIONS, LOVED_DUAS, duaText, FORMS } from '../data/loved-duas.js';
import { DEFAULT_SPEC, DUA_SIZES, DUA_TEMPLATES, renderDuaCard, cardPlainText, cardHeading, sourceLine } from '../duacard.js';
import { fullHead, refresh } from './common.js';
import { openSheet, toast, dhikrText } from '../ui.js';
import { shareImage, shareText, copyText, saveImageToGallery } from '../native.js';
import { personEditor } from './loved.js';

export const full = true;
export const tab = 'library';

let step = 1;
let showAll = false;
let panel = 'template';
let lastParam = null;

const spec = () => { if (!state.cardDraft) state.cardDraft = { ...DEFAULT_SPEC }; return state.cardDraft; };
const set = (patch, rerender = true) => { Object.assign(spec(), patch); save(); if (rerender) refresh(); };
const fresh = (patch = {}) => { state.cardDraft = { ...DEFAULT_SPEC, ...patch }; step = 1; showAll = false; save(); };

const STEPS = [[1, 'لمن؟'], [2, 'الدعاء'], [3, 'التصميم']];

function stepper() {
  return `<nav class="cd-steps" aria-label="الخطوات">${STEPS.map(([n, l]) => `<button class="cd-step ${step === n ? 'on' : ''} ${step > n ? 'done' : ''}" data-act="cd-step" data-n="${n}" aria-current="${step === n}"><span>${step > n ? '✓' : num(n)}</span>${l}</button>`).join('')}</nav>`;
}

function step1() {
  const s = spec();
  const person = s.type === 'person';
  const loved = state.loved;
  return `<section class="card set-card cd-sec">
      <div class="seg">${[['person', 'دعاء لشخص'], ['text', 'ذكر أو عبارة']].map(([k, l]) => `<button class="seg-btn ${s.type === k ? 'on' : ''}" data-act="cd-type" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="field"><span>${person ? 'اسم من تحب' : 'عنوان البطاقة (اختياري)'}</span>
        <input type="text" data-f="name" maxlength="120" value="${esc(s.name)}" placeholder="${person ? 'الاسم كاملاً، ولو كان طويلاً' : 'مثلاً: ذكر اليوم'}" autocomplete="off"></label>
      ${person && loved.length ? `<div class="chips cd-from">${loved.slice(0, 6).map((p) => `<button class="chip" data-act="cd-pick" data-id="${p.id}">${icon('heart')} ${esc(p.name)}</button>`).join('')}</div>` : ''}
      ${person ? `<div class="field"><span>الصيغة</span><div class="seg">${Object.entries(FORMS).map(([k, l]) => `<button class="seg-btn ${s.form === k ? 'on' : ''}" data-act="cd-form" data-k="${k}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><span class="set-ic">${icon('shield')}</span><div class="set-txt"><b>إخفاء الاسم</b><small>يظهر بدلاً منه عبارة عامة</small></div><button class="switch ${s.hideName ? 'on' : ''}" role="switch" aria-checked="${s.hideName}" data-act="cd-hide"><i></i></button></div>
      ${s.hideName ? `<input type="text" data-f="alias" maxlength="40" value="${esc(s.alias)}" class="cd-alias" aria-label="العبارة البديلة">` : ''}` : ''}
    </section>`;
}

function suggestion(d, s) {
  const { t, adapted } = duaText(d, s.form);
  const on = s.duaId === d.id;
  return `<button class="cd-sug ${on ? 'on' : ''}" data-act="cd-dua" data-id="${d.id}" aria-pressed="${on}">
    <p>${dhikrText(t)}</p><small>${esc(num(d.s))}${adapted ? ' · بتصريف الضمير' : ''}</small></button>`;
}

function step2() {
  const s = spec();
  const list = LOVED_DUAS.filter((d) => d.occ === s.occ);
  const shown = showAll ? list : list.slice(0, 3);
  return `<div class="cd-occ" role="list">${OCCASIONS.map((o) => `<button class="chip ${s.occ === o.id ? 'on' : ''}" data-act="cd-occ" data-k="${o.id}" role="listitem">${icon(o.icon)} ${o.label}</button>`).join('')}</div>
    ${s.occ === 'own' ? '' : `<div class="cd-sugs">${shown.map((d) => suggestion(d, s)).join('')}
      ${list.length > 3 ? `<button class="link-btn" data-act="cd-more">${showAll ? 'عرض أقل' : `عرض المزيد (${num(list.length - 3)})`}</button>` : ''}</div>`}
    ${s.occ === 'own' || s.duaId ? `<section class="card set-card cd-sec">
      <label class="field"><span>${s.occ === 'own' ? 'اكتب دعاءك' : 'النص (يمكنك تعديله)'}</span>
        <textarea rows="4" data-f="text" maxlength="600" placeholder="اللهم…">${esc(s.text)}</textarea></label>
      <div class="cd-kind">${s.kind === 'mathur' ? `${icon('check')} نص مأثور كما ورد: ${esc(num(sourceLine(s)))}` : s.kind === 'edited' ? `${icon('edit')} عدّلت نصاً مأثوراً، فسيُكتب «دعاء بتصرّف» دون نسبته للمصدر` : `${icon('edit')} دعاء من كتابتك، دون نسبة أو مصدر`}</div>
      <div class="row-btns">
        ${s.kind === 'own' && s.type === 'person' && s.name.trim() && !s.hideName ? `<button class="btn btn-soft" data-act="cd-insert">${icon('plus')} أدرج الاسم في دعائي</button>` : ''}
        ${s.kind === 'edited' ? `<button class="btn btn-ghost" data-act="cd-restore">${icon('refresh')} النص الأصلي</button>` : ''}
      </div>
    </section>` : ''}`;
}

const PANELS = [['template', 'القالب'], ['size', 'المقاس'], ['text', 'النص'], ['more', 'تخصيص أكثر']];

function panelHtml() {
  const s = spec();
  if (panel === 'size') return `<div class="chips">${Object.entries(DUA_SIZES).map(([k, v]) => `<button class="chip ${s.size === k ? 'on' : ''}" data-act="cd-set" data-k="size" data-v="${k}">${v.label}</button>`).join('')}</div>`;
  if (panel === 'text') {
    return `<div class="cd-row"><span>حجم الخط</span><div class="stepper sm"><button class="icon-btn" data-act="cd-scale" data-d="-0.1" aria-label="تصغير">${icon('minus')}</button><b>${num(Math.round(s.scale * 100))}٪</b><button class="icon-btn" data-act="cd-scale" data-d="0.1" aria-label="تكبير">${icon('plus')}</button></div></div>
      <div class="row-btns"><button class="btn btn-ghost" data-act="cd-step" data-n="1">${icon('edit')} الاسم</button><button class="btn btn-ghost" data-act="cd-step" data-n="2">${icon('edit')} الدعاء</button></div>`;
  }
  if (panel === 'more') {
    return `<div class="cd-row"><span>صورة خلفية من جهازك</span><label class="btn btn-soft sm-btn">${icon('image')} ${s.bgImage ? 'تغيير' : 'اختيار'}<input type="file" accept="image/*" data-bg hidden></label>${s.bgImage ? `<button class="icon-btn sm" data-act="cd-set" data-k="bgImage" data-v="" aria-label="إزالة الصورة">${icon('x')}</button>` : ''}</div>
      ${s.type === 'person' ? `<div class="cd-row"><span>عبارة «${s.form === 'f' ? 'لا تنسوها' : s.form === 'p' ? 'لا تنسوهم' : 'لا تنسوه'} من دعائكم»</span><button class="switch ${s.headline ? 'on' : ''}" role="switch" aria-checked="${s.headline}" data-act="cd-toggle" data-k="headline"><i></i></button></div>` : ''}
      <div class="cd-row"><span>اسم التطبيق</span><button class="switch ${s.brand ? 'on' : ''}" role="switch" aria-checked="${s.brand}" data-act="cd-toggle" data-k="brand"><i></i></button></div>
      <input type="text" data-f="signature" maxlength="40" value="${esc(s.signature)}" placeholder="توقيعك (اختياري)" class="cd-alias" aria-label="التوقيع">`;
  }
  return `<div class="cd-tpls">${Object.entries(DUA_TEMPLATES).map(([k, v]) => `<button class="cd-tpl ${s.template === k && !s.bgImage ? 'on' : ''}" data-act="cd-set" data-k="template" data-v="${k}" style="background:linear-gradient(135deg,${v.c[0]},${v.c[1]});color:${v.c[2]}" aria-label="${v.label}">${v.label}</button>`).join('')}</div>`;
}

function step3() {
  return `<div class="cd-preview" data-preview><span class="spinner"></span></div>
    <p class="cd-warn" data-warn hidden>${icon('info')} النص أطول من مساحة هذا المقاس. قصّر الدعاء، أو صغّر الخط قليلاً، أو اختر مقاس «حالة».</p>
    <div class="seg cd-panels">${PANELS.map(([k, l]) => `<button class="seg-btn ${panel === k ? 'on' : ''}" data-act="cd-panel" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="cd-panel">${panelHtml()}</div>`;
}

function footer() {
  if (step < 3) {
    return `<div class="cd-foot">${step > 1 ? `<button class="btn btn-ghost" data-act="cd-step" data-n="${step - 1}">السابق</button>` : '<span></span>'}
      <button class="btn btn-primary" data-act="cd-next">التالي</button></div>`;
  }
  return `<div class="cd-foot cd-actions">
      <button class="btn btn-primary" data-act="cd-share-img" data-out>${icon('share')} مشاركة الصورة</button>
      <button class="btn btn-soft" data-act="cd-share-txt" data-out>${icon('copy')} مشاركة النص</button>
      <button class="btn btn-soft" data-act="cd-save-img" data-out>${icon('download')} حفظ الصورة</button>
      <button class="icon-btn" data-act="cd-menu" aria-label="المزيد">${icon('grid')}</button>
    </div>`;
}

export function render(param) {
  if (param !== lastParam) {
    lastParam = param;
    if (param === 'new') fresh();
    else if (param && param.startsWith('p:')) {
      const p = state.loved.find((x) => x.id === param.slice(2));
      if (p) fresh({ type: 'person', name: p.name, form: p.form });
    } else if (param && param.startsWith('d:')) {
      const d = state.cardDesigns.find((x) => x.id === param.slice(2));
      if (d) { state.cardDraft = { ...DEFAULT_SPEC, ...d.spec }; step = 3; save(); }
    }
  }
  return `${fullHead('ادعُ لأخيك', 'دعوة طيبة لمن تحب، باسمهم وبأسلوبك', `<button class="icon-btn" data-act="cd-new" aria-label="بطاقة جديدة">${icon('plus')}</button>`)}
    ${stepper()}
    <div class="cd-body">${step === 1 ? step1() : step === 2 ? step2() : step3()}</div>
    ${footer()}`;
}

let renderSeq = 0;
let lastOut = null;
async function drawPreview(root) {
  const box = root.querySelector('[data-preview]');
  if (!box) return;
  const seq = ++renderSeq;
  const out = await renderDuaCard(spec());
  if (seq !== renderSeq) return;
  lastOut = out;
  box.innerHTML = `<img src="${out.url}" alt="معاينة البطاقة: ${esc(cardHeading(spec()))}">`;
  root.querySelector('[data-warn]').hidden = !out.overflow;
  root.querySelectorAll('[data-out]').forEach((b) => { b.disabled = out.overflow; });
}

/** تصغير صورة الخلفية قبل حفظها في المسودة حتى لا تمتلئ ذاكرة التطبيق */
function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function mount(root) {
  root.querySelectorAll('[data-f]').forEach((el) => el.addEventListener('input', () => {
    const k = el.dataset.f;
    const patch = { [k]: el.value };
    // تعديل نص مأثور يجعله «بتصرّف» فلا يُنسب للمصدر
    if (k === 'text' && spec().kind === 'mathur' && spec().duaId) {
      const d = LOVED_DUAS.find((x) => x.id === spec().duaId);
      if (d && el.value.trim() !== duaText(d, spec().form).t) patch.kind = 'edited';
    }
    const kindChanged = patch.kind && patch.kind !== spec().kind;
    set(patch, false);
    // تحديث التنبيه دون إعادة رسم الصفحة حتى لا يفقد حقل الكتابة تركيزه
    const kindEl = root.querySelector('.cd-kind');
    if (kindChanged && kindEl) kindEl.innerHTML = `${icon('edit')} عدّلت نصاً مأثوراً، فسيُكتب «دعاء بتصرّف» دون نسبته للمصدر`;
  }));
  const bg = root.querySelector('[data-bg]');
  if (bg) bg.addEventListener('change', async () => {
    const f = bg.files && bg.files[0];
    if (!f) return;
    try { set({ bgImage: await readImage(f) }); } catch (e) { toast('تعذّر فتح الصورة', 'info'); }
  });
  drawPreview(root);
}

const fileName = () => `sakina-dua-${Date.now()}.png`;
const ready = async () => { const out = await renderDuaCard(spec()); if (out.overflow) { toast('النص أطول من البطاقة، عدّله أولاً', 'info'); return null; } return out; };

function validStep(n) {
  const s = spec();
  if (n >= 2 && s.type === 'person' && !s.name.trim() && !s.hideName) { toast('اكتب اسم من تحب، أو فعّل إخفاء الاسم', 'info'); return 1; }
  if (n >= 3 && !s.text.trim()) { toast('اختر دعاءً أو اكتب دعاءك', 'info'); return 2; }
  return n;
}

export const actions = {
  'cd-step': (el) => { step = validStep(+el.dataset.n); refresh(); },
  'cd-next': () => { step = validStep(step + 1); refresh(); },
  'cd-new': () => { fresh(); refresh(); },
  'cd-type': (el) => set({ type: el.dataset.k, occ: el.dataset.k === 'text' ? 'dhikr' : spec().occ === 'dhikr' ? 'general' : spec().occ }),
  'cd-form': (el) => {
    const s = spec();
    const patch = { form: el.dataset.k };
    // تحديث نص الدعاء المأثور المختار بحسب الصيغة (ما لم يعدّله المستخدم)
    const d = s.kind === 'mathur' && LOVED_DUAS.find((x) => x.id === s.duaId);
    if (d) Object.assign(patch, { text: duaText(d, el.dataset.k).t, adapted: duaText(d, el.dataset.k).adapted });
    set(patch);
  },
  'cd-hide': () => set({ hideName: !spec().hideName }),
  'cd-pick': (el) => { const p = state.loved.find((x) => x.id === el.dataset.id); if (p) set({ name: p.name, form: p.form }); },
  'cd-occ': (el) => { showAll = false; set(el.dataset.k === 'own' ? { occ: 'own', duaId: '', kind: 'own', source: '', adapted: false, text: spec().kind === 'own' ? spec().text : '' } : { occ: el.dataset.k }); },
  'cd-more': () => { showAll = !showAll; refresh(); },
  'cd-dua': (el) => {
    const d = LOVED_DUAS.find((x) => x.id === el.dataset.id);
    if (!d) return;
    const { t, adapted } = duaText(d, spec().form);
    set({ duaId: d.id, text: t, kind: 'mathur', source: d.s, adapted });
  },
  'cd-restore': () => actions['cd-dua']({ dataset: { id: spec().duaId } }),
  'cd-insert': () => {
    const s = spec();
    const name = s.name.trim();
    // يُدرج الاسم كما هو في نص المستخدم فقط، ولا يُدرج في نص مأثور
    set({ text: s.text.trim() ? `${s.text.trim()} ${name}` : name });
  },
  'cd-panel': (el) => { panel = el.dataset.k; refresh(); },
  'cd-set': (el) => set({ [el.dataset.k]: el.dataset.v }),
  'cd-toggle': (el) => set({ [el.dataset.k]: !spec()[el.dataset.k] }),
  'cd-scale': (el) => set({ scale: Math.round(Math.max(0.8, Math.min(1.3, spec().scale + +el.dataset.d)) * 10) / 10 }),
  'cd-share-img': async () => { const out = await ready(); if (out) await shareImage(out.url, fileName()); },
  'cd-share-txt': async () => { if (await ready()) { const r = await shareText(cardPlainText(spec())); if (r === 'copied') toast('نُسخ النص'); } },
  'cd-save-img': async () => {
    const out = await ready();
    if (!out) return;
    const r = await saveImageToGallery(out.url, fileName());
    toast(r === 'gallery' ? 'حُفظت الصورة في معرض الصور، ألبوم «سكينة»' : r === 'download' ? 'نُزّلت الصورة' : 'تعذّر حفظ الصورة', r ? 'download' : 'info');
  },
  'cd-menu': () => {
    const s = spec();
    const canAdd = s.type === 'person' && s.name.trim() && !state.loved.some((p) => p.name.trim() === s.name.trim());
    openSheet(`<h3 class="sheet-title">خيارات أخرى</h3>
      <button class="set-row link" data-m="copy"><span class="set-ic">${icon('copy')}</span><div class="set-txt"><b>نسخ النص</b></div></button>
      <button class="set-row link" data-m="save"><span class="set-ic">${icon('bookmark')}</span><div class="set-txt"><b>حفظ التصميم</b><small>لإعادة استخدامه لاحقاً</small></div></button>
      ${canAdd ? `<button class="set-row link" data-m="add"><span class="set-ic">${icon('heart')}</span><div class="set-txt"><b>إضافة «${esc(s.name.trim())}» إلى دعواتي</b></div></button>` : ''}`, {
      onMount: (body, close) => body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        close();
        if (b.dataset.m === 'copy') { await copyText(cardPlainText(spec())); toast('نُسخ النص'); }
        if (b.dataset.m === 'save') {
          const { bgImage, ...rest } = spec(); // لا تُحفظ صورة الخلفية في التصاميم لتوفير المساحة
          state.cardDesigns.unshift({ id: `c-${Date.now().toString(36)}`, at: Date.now(), title: cardHeading(spec()) || 'بطاقة', spec: rest });
          state.cardDesigns = state.cardDesigns.slice(0, 30);
          save();
          toast(bgImage ? 'حُفظ التصميم (دون صورة الخلفية)' : 'حُفظ التصميم', 'bookmark');
        }
        if (b.dataset.m === 'add') { const p = await personEditor(null, { name: s.name.trim(), form: s.form }); if (p) toast('أُضيف إلى دعواتي', 'heart'); }
      }),
    });
  },
};
