// التبويب الأول: الرئيسية (السكينة)
import { state, save, today } from '../store.js';
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { HIJRI_MONTHS, GREG_MONTHS, WEEKDAYS, WEEKDAY_LETTERS } from '../dates.js';
import { PRAYERS, METHODS } from '../prayer.js';
import { CATEGORY_BY_ID } from '../data/adhkar.js';
import { FEELINGS, DAILY_AYAT, DAILY_AHADITH, TASBIHAT } from '../data/spirit.js';
import { NAMES } from '../data/names.js';
import { homeLayout, visibleCards, SHORTCUTS } from '../home-layout.js';
import { location, localToday, hijriOf, nextPrayer, dayPeriod, GREETINGS, suggestedWird, catProgress, lastWeek, streak, methodKey } from '../services.js';
import { fmtTime, fmtCountdown, ring, bar, pct, daily, refresh } from './common.js';
import { toast, THEMES, activeTheme, dhikrText } from '../ui.js';
import { registerText, toolsRow } from './dhikr.js';
import { todayRange, readToday, progress as khatmaProgress } from '../khatma.js';
import { suraOf, suraName } from '../quran.js';
import { PAGES } from '../data/quran-meta.js';
import { fmtDistance } from './mosques.js';

function mosqueTile() {
  const c = state.mosques;
  const near = c && c.items && c.items[0];
  return `<button class="tile tile-mosque span2" data-act="go" data-to="#/mosques">
    <span class="tq-ic">${icon('mosque')}</span>
    <span class="tq-txt"><span class="eyebrow">${icon('pin')} المساجد القريبة</span>
      <b>${near ? esc(near.name || 'مسجد') : 'اعرف المساجد حولك'}</b>
      <small>${near ? `الأقرب إليك · ${fmtDistance(near.dist)}` : 'رادار ومسار مشياً إلى المسجد'}</small></span>
    ${icon('chevron')}
  </button>`;
}

function quranTile() {
  const k = state.khatma;
  const last = state.quran.lastPage;
  if (k) {
    const r = todayRange(k);
    const target = Math.min(k.perDay, r.to - r.from + 1);
    const done = readToday(k);
    return `<button class="tile tile-quran span2" data-act="go" data-to="#/mushaf/${Math.min(604, k.page)}">
      <span class="tq-ic">${icon('quran')}</span>
      <span class="tq-txt"><span class="eyebrow">${icon('flag')} وردك من القرآن</span>
        <b>${done >= target ? 'أتممت ورد اليوم ✓' : `الصفحات ${num(r.from)}–${num(r.to)}`}</b>
        ${bar(khatmaProgress(k))}<small>${pct(khatmaProgress(k))} من الختمة</small></span>
      ${icon('chevron')}
    </button>`;
  }
  return `<button class="tile tile-quran span2" data-act="go" data-to="${last ? `#/mushaf/${last}` : '#/quran'}">
    <span class="tq-ic">${icon('quran')}</span>
    <span class="tq-txt"><span class="eyebrow">${icon('book')} القرآن الكريم</span>
      <b>${last ? `تابع: سورة ${suraName(suraOf(PAGES[last - 1]))}` : 'افتح المصحف'}</b>
      <small>${last ? `الصفحة ${num(last)}` : 'ابدأ ختمة بخمس صفحات يومياً'}</small></span>
    ${icon('chevron')}
  </button>`;
}

let timer;

/** اختصار النص على حدود الكلمات حتى لا تنفصل الحركات عن حروفها */
const shorten = (t, words) => { const w = t.split(' '); return w.length > words ? `${w.slice(0, words).join(' ').replace(/[،,]$/, '')}…` : t; };

function sky(period) {
  const stars = period === 'night' || period === 'fajr'
    ? `<div class="stars">${Array.from({ length: 14 }, (_, i) => `<i style="top:${(i * 37) % 70 + 6}%;right:${(i * 53) % 92 + 3}%;animation-delay:${(i % 5) * 0.7}s"></i>`).join('')}</div>` : '';
  return `<div class="sky-deco">${stars}<span class="orb"></span><span class="haze"></span></div>`;
}

function prayerCard() {
  const loc = location();
  const np = nextPrayer();
  const t = np.times;
  const nextKey = np.tomorrow ? null : np.key;
  const nextName = PRAYERS.find((p) => p.key === np.key).name;
  return `<section class="card prayer-card">
    <div class="pc-head">
      <h2>مواقيت الصلاة</h2>
      <button class="chip chip-outline" data-act="go" data-to="#/settings">${icon('pin')}<span>${esc(loc.name)}</span></button>
    </div>
    <div class="pc-grid">${PRAYERS.map((p) => `
      <div class="pc-cell ${p.key === nextKey || (np.tomorrow && p.key === 'fajr') ? 'next' : ''} ${p.key === 'sunrise' ? 'sunrise' : ''}">
        ${icon(p.icon)}<span class="pc-name">${p.name}</span><b class="pc-time">${fmtTime(t[p.key])}</b>
      </div>`).join('')}
    </div>
    <div class="countdown">
      <span class="cd-ic">${icon('bell')}</span>
      <span>باقي على أذان ${nextName}</span>
      <b data-countdown="${np.at.getTime()}">${fmtCountdown(np.at - Date.now())}</b>
    </div>
    <p class="pc-method">${METHODS[methodKey()].name}</p>
  </section>`;
}

function feelingsCard() {
  return `<section class="block feel-home">
    <div class="block-head"><h2>بماذا يشعر قلبك؟</h2><button class="link-btn" data-act="go" data-to="#/library/feel">صيدلية الروح ${icon('chevron')}</button></div>
    <div class="mood-scroll">${FEELINGS.map((f) => `
      <button class="mood tone-${f.tone}" data-act="go" data-to="#/feel/${f.id}">
        <span class="mood-ic">${icon(f.icon)}</span><span>${f.label}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function shortcutsCard() {
  const ids = homeLayout().shortcuts;
  const list = ids.map((id) => SHORTCUTS.find((x) => x.id === id)).filter(Boolean);
  return `<section class="block">
    <div class="block-head"><h2>اختصاراتي</h2><button class="link-btn" data-act="go" data-to="#/customize">تعديل ${icon('chevron')}</button></div>
    ${list.length ? `<div class="sc-grid">${list.map((x) => `<button class="sc tone-${x.tone}" data-act="go" data-to="${x.to}"><span class="cat-ic">${icon(x.icon)}</span><b>${x.label}</b></button>`).join('')}</div>`
    : `<button class="btn btn-soft wide" data-act="go" data-to="#/customize">${icon('plus')} أضف اختصارات</button>`}
  </section>`;
}

/** بطاقات الرئيسية: tile = تُعرض داخل شبكة البطاقات */
const CARDS = {
  prayer: () => ({ html: prayerCard() }),
  shortcuts: () => ({ html: shortcutsCard() }),
  feelings: () => ({ html: feelingsCard() }),
  wird: () => {
    const wird = suggestedWird();
    const cat = CATEGORY_BY_ID[wird];
    const prog = catProgress(wird);
    return { tile: true, html: `<button class="tile tile-wird span2" data-act="go" data-to="#/read/${wird}">
      <div class="tw-main">
        <span class="eyebrow">${icon('sparkle')} وردك الآن</span>
        <h3>${cat.title}</h3>
        <p>${prog >= 1 ? 'أتممته اليوم، تقبّل الله منك' : prog > 0 ? 'تابع من حيث توقفت' : cat.sub}</p>
        <div class="tw-bars">
          <span><small>الصباح</small>${bar(catProgress('morning'))}</span>
          <span><small>المساء</small>${bar(catProgress('evening'))}</span>
        </div>
      </div>
      <div class="tw-ring">${ring(prog, 92, 7)}<b>${pct(prog)}</b></div>
    </button>` };
  },
  quran: () => ({ tile: true, html: quranTile() }),
  ayah: () => {
    const [ayah, ayahRef] = daily(DAILY_AYAT);
    registerText('ayah-today', { text: `﴿${ayah}﴾`, source: `سورة ${ayahRef}`, title: 'آية اليوم' });
    return { tile: true, html: `<article class="tile tile-ayah span2">
      <span class="eyebrow">${icon('book')} آية اليوم</span>
      <p class="quran">﴿${dhikrText(ayah)}﴾</p>
      <div class="tile-foot"><small>سورة ${num(ayahRef)}</small>${toolsRow('data-key="ayah-today"')}</div>
    </article>` };
  },
  tasbih: () => {
    const tb = TASBIHAT.find((x) => x.id === state.tasbih.selected) || TASBIHAT[0];
    return { tile: true, html: `<button class="tile tile-mini tone-teal" data-act="go" data-to="#/tasbih">
      <span class="mini-ic">${icon('beads')}</span>
      <b>المسبحة</b>
      <small>${esc(dhikrText(shorten(tb.t, 3)))}</small>
      <span class="mini-num">${num(today().t)} <small>اليوم</small></span>
    </button>` };
  },
  names: () => {
    const name = daily(NAMES, 3);
    return { tile: true, html: `<button class="tile tile-mini tone-amber" data-act="go" data-to="#/names">
      <span class="mini-ic">${icon('star')}</span>
      <b>أسماء الله الحسنى</b>
      <small>اسم اليوم</small>
      <span class="mini-name">${name[0]}</span>
    </button>` };
  },
  hadith: () => {
    const [hadith, hadithRef] = daily(DAILY_AHADITH, 11);
    registerText('hadith-today', { text: `«${hadith}»`, source: hadithRef, title: 'حديث اليوم' });
    return { tile: true, html: `<article class="tile tile-hadith span2">
      <span class="eyebrow">${icon('sparkle')} حديث اليوم</span>
      <p class="hadith">«${dhikrText(hadith)}»</p>
      <div class="tile-foot"><small>${num(hadithRef)}</small>${toolsRow('data-key="hadith-today"')}</div>
    </article>` };
  },
  mosque: () => ({ tile: true, html: mosqueTile() }),
  streak: () => {
    const week = lastWeek();
    const n = streak();
    return { tile: true, html: `<button class="tile tile-streak span2" data-act="go" data-to="#/journal">
      <div><span class="eyebrow">${icon('flame')} أيام الالتزام</span><b class="streak-num">${num(n)}</b><small>${n === 1 ? 'يوم التزام' : 'أيام التزام متتالية'}</small></div>
      <div class="week-stars">${week.map((d) => `<span class="ws ${d.rec.m && d.rec.e ? 'full' : d.rec.m || d.rec.e ? 'half' : ''} ${d.isToday ? 'today' : ''}">${icon('star')}<small>${WEEKDAY_LETTERS[d.date.getDay()]}</small></span>`).join('')}</div>
    </button>` };
  },
};

/** يبني الرئيسية بالترتيب المحفوظ؛ البطاقات المتجاورة من نوع tile تُجمع في شبكة واحدة */
function cardsHtml() {
  let out = '';
  let tiles = '';
  const flush = () => { if (tiles) { out += `<section class="bento">${tiles}</section>`; tiles = ''; } };
  for (const id of visibleCards()) {
    const c = CARDS[id] && CARDS[id]();
    if (!c || !c.html) continue;
    if (c.tile) tiles += c.html; else { flush(); out += c.html; }
  }
  flush();
  return out;
}

export function render() {
  const period = dayPeriod();
  const g = localToday();
  const hj = hijriOf(g);
  const greet = GREETINGS[period];
  const wird = suggestedWird();
  const theme = THEMES[activeTheme()];
  return `<section class="sky sky-${period}">
      ${sky(period)}
      <div class="sky-top">
        <span class="brand">${icon('sparkle')} سكينة</span>
        <button class="icon-glass" data-act="theme-cycle" aria-label="تغيير الثيم: ${theme.name}">${icon(theme.dark ? 'sun' : 'moon')}</button>
      </div>
      <div class="greet">
        <p class="greet-date">${WEEKDAYS[g.wd]} · ${num(hj.d)} ${HIJRI_MONTHS[hj.m - 1]} ${num(hj.y)} هـ</p>
        <h1>${greet.title}</h1>
        <p class="greet-sub">${greet.sub}</p>
        <p class="greet-greg">${num(g.d)} ${GREG_MONTHS[g.m - 1]} ${num(g.y)} م</p>
      </div>
      <button class="suggest" data-act="go" data-to="#/read/${wird}">
        <span class="suggest-ic">${icon(CATEGORY_BY_ID[wird].icon)}</span>
        <span class="suggest-txt"><small>الأنسب لك الآن</small><b>${CATEGORY_BY_ID[wird].title}</b></span>
        <span class="suggest-go">${icon('chevron')}</span>
      </button>
    </section>
    <div class="home-body">
      ${cardsHtml()}
      <button class="customize-link" data-act="go" data-to="#/customize">${icon('grid')} تخصيص الرئيسية</button>
      <p class="dua-credit">دعوة لحسين محمد علي الطويل</p>
    </div>`;
}

export function mount(el) {
  clearInterval(timer);
  timer = setInterval(() => {
    const cd = el.querySelector('[data-countdown]');
    if (!cd) return;
    const left = +cd.dataset.countdown - Date.now();
    if (left <= 0) { refresh(); return; }
    cd.textContent = fmtCountdown(left);
  }, 1000);
}
export function unmount() { clearInterval(timer); }

export const actions = {
  mood: (el) => { window.location.hash = `#/feel/${el.dataset.id}`; },
  'theme-cycle': () => {
    const keys = Object.keys(THEMES);
    state.settings.theme = keys[(keys.indexOf(activeTheme()) + 1) % keys.length];
    state.settings.followSystem = false;
    save();
    document.dispatchEvent(new Event('app:theme'));
    toast(`ثيم ${THEMES[state.settings.theme].name}`, 'palette');
  },
};
