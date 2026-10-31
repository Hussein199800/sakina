// المساجد القريبة: رادار يدور مع اتجاه الهاتف + قائمة مرتبة بالمسافة + مسار مشياً إلى المسجد
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, fmtNum } from '../text.js';
import { RADII, fetchMosques, routeUrl, googleSearchUrl, directionName } from '../mosques.js';
import { fullHead, fmtDate } from './common.js';
import { toast } from '../ui.js';
import { getPosition, openExternal } from '../native.js';

export const full = true;
export const tab = 'more';

const R = 130; // نصف قطر الرادار بالبكسل
let phase = 'idle'; // idle | locating | searching | done | error
let errorMsg = '';
let handler = null;
let rootRef = null;
let heading = 0;
let active = false; // داخل الصفحة الآن (لتمييز الزيارة الجديدة عن إعادة الرسم)

const cache = () => state.mosques || null;
const radius = () => (state.settings.mosqueRadius && RADII.indexOf(state.settings.mosqueRadius) !== -1 ? state.settings.mosqueRadius : 2000);

export const fmtDistance = (m) => (m < 1000 ? `${fmtNum(Math.max(10, Math.round(m / 10) * 10))} م` : `${fmtNum(m / 1000, m % 1000 === 0 ? 0 : 1)} كم`);
const label = (m) => (m.name ? esc(m.name) : 'مسجد');

function radar(c) {
  const rad = c.radius;
  const items = c.items.filter((m) => m.dist <= rad).slice(0, 60);
  const dots = items.map((m, i) => {
    const r = (m.dist / rad) * (R - 8);
    const a = (m.dir * Math.PI) / 180;
    const x = 150 + r * Math.sin(a);
    const y = 150 - r * Math.cos(a);
    return `<g class="mq-dot ${i === 0 ? 'near' : ''}" data-mq="${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="${i === 0 ? 9 : 6}"/></g>`;
  }).join('');
  const ring = (f) => `<circle cx="150" cy="150" r="${(R * f).toFixed(1)}" class="mq-ring"/>`;
  // تسمية كل دائرة بمسافتها عند زاوية ثابتة أسفلها
  const tag = (f) => `<text x="150" y="${(150 + R * f - 4).toFixed(1)}" class="mq-tag">${fmtDistance(rad * f)}</text>`;
  return `<div class="mq-radar-wrap">
    <svg class="mq-radar" viewBox="0 0 300 300" role="img" aria-label="رادار المساجد القريبة">
      <circle cx="150" cy="150" r="${R}" class="mq-face"/>
      <g data-rot>
        ${ring(1 / 3)}${ring(2 / 3)}
        <text x="150" y="${150 - R + 16}" class="mq-n">ش</text>
        ${dots}
      </g>
      ${tag(1 / 3)}${tag(2 / 3)}${tag(1)}
      <circle cx="150" cy="150" r="7" class="mq-me"/>
    </svg>
  </div>`;
}

function list(c) {
  if (!c.items.length) {
    return `<div class="empty small-empty">${icon('mosque')}<p>لم نجد مساجد مسجّلة ضمن ${fmtDistance(c.radius)}</p>
      <small>جرّب نطاقاً أوسع، أو ابحث في خرائط جوجل</small></div>`;
  }
  return `<ol class="mq-list">${c.items.slice(0, 40).map((m, i) => `
    <li class="mq-row ${i === 0 ? 'near' : ''}" id="mq-${i}">
      <span class="mq-num">${num(i + 1)}</span>
      <span class="mq-txt"><b>${label(m)}</b><small>${fmtDistance(m.dist)} · ${directionName(m.dir)}${i === 0 ? ' · الأقرب' : ''}</small></span>
      <button class="btn btn-primary mq-go" data-act="mq-go" data-i="${i}" aria-label="مسار مشياً إلى ${label(m)}">${icon('route')} اذهب</button>
    </li>`).join('')}</ol>`;
}

export function render() {
  const c = cache();
  const busy = phase === 'locating' || phase === 'searching';
  return `${fullHead('المساجد القريبة', 'من خرائط OpenStreetMap المجانية')}
    <div class="seg" role="radiogroup" aria-label="نطاق البحث">${RADII.map((r) => `<button class="seg-btn ${radius() === r ? 'on' : ''}" data-act="mq-radius" data-r="${r}" role="radio" aria-checked="${radius() === r}">${fmtDistance(r)}</button>`).join('')}</div>
    ${busy ? `<div class="card mq-status"><span class="spinner"></span><p>${phase === 'locating' ? 'جارٍ تحديد موقعك…' : 'جارٍ البحث عن المساجد القريبة…'}</p></div>` : ''}
    ${phase === 'error' ? `<p class="note">${icon('info')} ${errorMsg}</p>` : ''}
    ${c && !busy ? `${radar(c)}
      <p class="muted small center mq-when">${c.at ? `آخر بحث: ${fmtDate(new Date(c.at))}` : ''}${phase !== 'done' ? ' · نتائج محفوظة' : ''}</p>
      ${list(c)}` : ''}
    ${!c && !busy && phase !== 'error' ? `<div class="empty">${icon('mosque')}<p>اعرف المساجد حولك</p><small>نحتاج موقعك واتصالاً بالإنترنت للبحث</small></div>` : ''}
    <div class="row-btns">
      <button class="btn btn-primary" data-act="mq-search" ${busy ? 'disabled' : ''}>${icon('refresh')} ${c ? 'تحديث البحث' : 'ابحث الآن'}</button>
      <button class="btn btn-soft" data-act="mq-google">${icon('search')} في خرائط جوجل</button>
    </div>
    <p class="muted small center mq-privacy">يُرسَل موقعك التقريبي إلى خدمة OpenStreetMap عند البحث فقط، ولا يُحفظ في أي مكان آخر. قد لا تكون كل المساجد مسجّلة في الخريطة.</p>`;
}

const rerender = () => document.dispatchEvent(new Event('app:refresh'));

async function search() {
  phase = 'locating';
  rerender();
  let pos;
  try { pos = await getPosition(); } catch (e) {
    phase = 'error';
    errorMsg = 'تعذّر تحديد موقعك. فعّل خدمة الموقع واسمح لسكينة باستخدامها، ثم حاول مرة أخرى.';
    rerender();
    return;
  }
  phase = 'searching';
  rerender();
  try {
    const items = await fetchMosques(pos, radius());
    state.mosques = { at: Date.now(), lat: pos.lat, lng: pos.lng, radius: radius(), items: items.slice(0, 60) };
    save();
    phase = 'done';
  } catch (e) {
    phase = 'error';
    errorMsg = 'تعذّر الاتصال بخدمة الخرائط. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى، أو ابحث في خرائط جوجل.';
  }
  rerender();
}

function rotate() {
  const g = rootRef && rootRef.querySelector('[data-rot]');
  if (g) g.setAttribute('transform', `rotate(${(-heading).toFixed(1)} 150 150)`);
}

export function mount(root) {
  rootRef = root;
  // زيارة جديدة للصفحة: لا نُبقي خطأً قديماً من بحث انتهى بعد مغادرتها
  if (!active) {
    active = true;
    if (phase === 'error' || phase === 'done') phase = 'idle';
  }
  // أول فتح للصفحة دون نتائج محفوظة: نبحث مباشرة
  if (!cache() && phase === 'idle') { search(); return; }
  root.querySelectorAll('[data-mq]').forEach((d) => d.addEventListener('click', () => {
    const el = root.querySelector(`#mq-${d.dataset.mq}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
  }));
  // الرادار يدور مع اتجاه الهاتف مثل البوصلة
  if (!handler) {
    handler = (e) => {
      let h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
      if (h === null) return;
      const screen = (window.screen && window.screen.orientation && window.screen.orientation.angle) || window.orientation || 0;
      heading = (h + screen + 360) % 360;
      rotate();
    };
    window.addEventListener('deviceorientationabsolute', handler, true);
    window.addEventListener('deviceorientation', handler, true);
  }
  rotate();
}

export function unmount() {
  if (handler) {
    window.removeEventListener('deviceorientationabsolute', handler, true);
    window.removeEventListener('deviceorientation', handler, true);
    handler = null;
  }
  // إعادة الرسم (نفس الصفحة) لا تُعيد الحالة؛ وإلا تكرّر البحث بلا نهاية عند الخطأ
  if (!/^#\/mosques/.test(window.location.hash)) active = false;
  rootRef = null;
}

export const actions = {
  'mq-search': () => search(),
  'mq-radius': (el) => {
    state.settings.mosqueRadius = +el.dataset.r;
    save();
    search();
  },
  'mq-go': (el) => {
    const c = cache();
    const m = c && c.items[+el.dataset.i];
    if (m) openExternal(routeUrl(m));
  },
  'mq-google': async () => {
    const c = cache();
    let p = c ? { lat: c.lat, lng: c.lng } : null;
    if (!p) { try { p = await getPosition(); } catch (e) { toast('تعذّر تحديد موقعك', 'info'); return; } }
    openExternal(googleSearchUrl(p));
  },
};
