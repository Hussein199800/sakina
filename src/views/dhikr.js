// أدوات الذكر المشتركة: نسخ، مشاركة نصاً أو صورة، المفضلة
import { state, save } from '../store.js';
import { ITEM_BY_ID, CATEGORY_BY_ID } from '../data/adhkar.js';
import { copyText, shareText, shareImage } from '../native.js';
import { toast, renderShareCard, dhikrText, openSheet, CARD_BACKGROUNDS, DEFAULT_CARD, THEMES } from '../ui.js';
import { icon } from '../icons.js';
import { num } from '../text.js';

const extra = new Map();
/** تسجيل نص عابر (آية اليوم، دعاء الحالة...) ليستعمله زر نسخ/مشاركة */
export function registerText(key, data) { extra.set(key, data); return key; }

function payload(el) {
  const id = el.dataset.id;
  if (id) {
    const it = ITEM_BY_ID[id] || state.custom.find((c) => c.id === id);
    if (!it) return null;
    const cat = CATEGORY_BY_ID[it.cat];
    return { text: it.t, source: it.s || '', title: it.h || (cat ? cat.title : 'من أذكاري') };
  }
  return extra.get(el.dataset.key) || null;
}

const fullText = (p) => `${dhikrText(p.text)}${p.source ? `\n\n[${num(p.source)}]` : ''}\n\n— من تطبيق سكينة`;

export const isFav = (id) => state.favorites.indexOf(id) !== -1;

const BG_LABELS = { theme: 'ثيم التطبيق', emerald: 'زمردي', night: 'ليلي', dawn: 'رملي', lavender: 'بنفسجي', paper: 'ورقي' };
const SIZE_LABELS = { square: 'مربع', post: 'منشور', story: 'حالة' };

/** مصمّم بطاقة المشاركة: معاينة حيّة مع اختيار الخلفية والمقاس وحجم الخط */
function cardDesigner(p) {
  const opt = { ...DEFAULT_CARD, ...(state.app.card || {}) };
  let seq = 0;
  let current = '';
  const swatch = (k) => {
    const c = CARD_BACKGROUNDS[k] || [(THEMES[state.settings.theme] || THEMES.oasis).primary, '#000', '#fff', (THEMES[state.settings.theme] || THEMES.oasis).secondary];
    return `<button class="cd-bg ${opt.bg === k ? 'on' : ''}" data-bg="${k}" style="background:linear-gradient(135deg, ${c[0]}, ${c[1]})" aria-label="${BG_LABELS[k]}"><span style="color:${c[3]}">${icon('check')}</span></button>`;
  };
  openSheet(`<h3 class="sheet-title">${icon('image')} تصميم بطاقة المشاركة</h3>
    <div class="cd-preview"><img data-cd-img alt="معاينة البطاقة"><span class="spinner" data-cd-wait></span></div>
    <div class="field"><span>الخلفية</span><div class="cd-bgs">${Object.keys(CARD_BACKGROUNDS).map(swatch).join('')}</div></div>
    <div class="field"><span>المقاس</span><div class="seg">${Object.keys(SIZE_LABELS).map((k) => `<button class="seg-btn ${opt.size === k ? 'on' : ''}" data-size="${k}">${SIZE_LABELS[k]}</button>`).join('')}</div></div>
    <div class="set-row"><span class="set-ic">${icon('type')}</span><div class="set-txt"><b>حجم الخط</b></div>
      <div class="stepper sm"><button class="icon-btn" data-scale="-0.1" aria-label="تصغير">${icon('minus')}</button><button class="icon-btn" data-scale="0.1" aria-label="تكبير">${icon('plus')}</button></div></div>
    <div class="set-row"><span class="set-ic">${icon('info')}</span><div class="set-txt"><b>إظهار المصدر</b></div><button class="switch ${opt.source ? 'on' : ''}" role="switch" aria-checked="${opt.source}" data-flag="source"><i></i></button></div>
    <div class="set-row"><span class="set-ic">${icon('sparkle')}</span><div class="set-txt"><b>الزخرفة</b></div><button class="switch ${opt.ornament ? 'on' : ''}" role="switch" aria-checked="${opt.ornament}" data-flag="ornament"><i></i></button></div>
    <div class="set-row"><span class="set-ic">${icon('star')}</span><div class="set-txt"><b>اسم التطبيق</b></div><button class="switch ${opt.brand ? 'on' : ''}" role="switch" aria-checked="${opt.brand}" data-flag="brand"><i></i></button></div>
    <div class="row-btns"><button class="btn btn-primary" data-cd-share>${icon('share')} مشاركة</button><button class="btn btn-ghost" data-close>إغلاق</button></div>`, {
    cls: 'sheet-tall',
    onMount: (body) => {
      const img = body.querySelector('[data-cd-img]');
      const wait = body.querySelector('[data-cd-wait]');
      const draw = async () => {
        const my = ++seq;
        wait.hidden = false;
        state.app.card = { ...opt };
        save();
        try {
          const url = await renderShareCard(p, opt);
          if (my !== seq) return;
          current = url;
          img.src = url;
        } catch (e) { toast('تعذّر إنشاء البطاقة', 'info'); }
        wait.hidden = true;
      };
      body.querySelectorAll('[data-bg]').forEach((b) => b.addEventListener('click', () => { opt.bg = b.dataset.bg; body.querySelectorAll('[data-bg]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
      body.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => { opt.size = b.dataset.size; body.querySelectorAll('[data-size]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
      body.querySelectorAll('[data-scale]').forEach((b) => b.addEventListener('click', () => { opt.scale = Math.round(Math.max(0.7, Math.min(1.4, opt.scale + +b.dataset.scale)) * 10) / 10; draw(); }));
      body.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.flag;
        opt[k] = !opt[k];
        b.classList.toggle('on', opt[k]);
        b.setAttribute('aria-checked', opt[k]);
        draw();
      }));
      body.querySelector('[data-cd-share]').addEventListener('click', async () => {
        if (!current) return;
        try {
          const r = await shareImage(current);
          if (r === 'downloaded') toast('تم حفظ البطاقة كصورة', 'download');
        } catch (e) { toast('تعذّرت المشاركة', 'info'); }
      });
      draw();
    },
  });
}

/** شريط أدوات البطاقة */
export function toolsRow(attr, { fav = null, extraBtns = '' } = {}) {
  return `<div class="tools-row">
    <button class="tool" data-act="d-copy" ${attr} aria-label="نسخ">${icon('copy')}</button>
    <button class="tool" data-act="d-share" ${attr} aria-label="مشاركة">${icon('share')}</button>
    <button class="tool" data-act="d-image" ${attr} aria-label="مشاركة كصورة">${icon('image')}</button>
    ${fav ? `<button class="tool ${isFav(fav) ? 'on' : ''}" data-act="d-fav" data-id="${fav}" aria-label="المفضلة" aria-pressed="${isFav(fav)}">${icon('heart')}</button>` : ''}
    ${extraBtns}
  </div>`;
}

export const actions = {
  'd-copy': async (el) => {
    const p = payload(el);
    if (p && (await copyText(fullText(p)))) toast('تم نسخ الذكر بنجاح');
  },
  'd-share': async (el) => {
    const p = payload(el);
    if (!p) return;
    const r = await shareText(fullText(p));
    if (r === 'copied') toast('تم نسخ النص لمشاركته');
  },
  'd-image': (el) => {
    const p = payload(el);
    if (p) cardDesigner(p);
  },
  'd-fav': (el) => {
    const id = el.dataset.id;
    const i = state.favorites.indexOf(id);
    if (i === -1) state.favorites.push(id); else state.favorites.splice(i, 1);
    save();
    const on = i === -1;
    document.querySelectorAll(`[data-act="d-fav"][data-id="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    toast(on ? 'أُضيف إلى المفضلة' : 'أُزيل من المفضلة', 'heart');
  },
};
