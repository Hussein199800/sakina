// تبويب «المزيد»: رحلتي، التذكيرات، أسماء الله، القبلة، الإعدادات، ما الجديد، التحديثات، حول التطبيق
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, daysLabel } from '../text.js';
import { VERSION, RELEASES_URL } from '../version.js';
import { CHANGELOG } from '../data/changelog.js';
import { checkForUpdate, updateAvailable } from '../updates.js';
import { streak, location } from '../services.js';
import { pageHead, fullHead, refresh, fmtDate } from './common.js';
import { openSheet, toast } from '../ui.js';
import { shareText, openExternal, getPosition } from '../native.js';

const SHARE_TEXT = 'سكينة: رفيقك الروحي اليومي 🌙\nأذكار الصباح والمساء كاملة بالتشكيل والمصدر، والقرآن الكريم، ومواقيت الصلاة، والمسبحة، وبوصلة القبلة. يعمل بدون إنترنت، مجاني وبلا إعلانات.';

// لا نفتح إلا روابط المستودع الرسمي حتى لو تغيّر ملف التحديث
const safeUrl = (u) => (/^https:\/\/github\.com\/Hussein199800\/sakina\//.test(u || '') ? u : RELEASES_URL);

const tile = (to, ic, tone, title, sub) => `<button class="more-tile tone-${tone}" data-act="go" data-to="${to}">
  <span class="cat-ic">${icon(ic)}</span><b>${title}</b><small>${sub}</small></button>`;

const row = (act, ic, title, sub, extra = '') => `<button class="set-row link" ${act}>
  <span class="set-ic">${icon(ic)}</span><div class="set-txt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${extra || icon('chevron')}</button>`;

export function devCard() {
  return `<div class="dev-card">
    <small>تطوير وتصميم</small>
    <b class="dev-name">حسين محمد علي الطويل</b>
    <p class="dev-dua amiri">اللَّهُمَّ اغْفِرْ لِعَبْدِكَ حسين محمد علي الطويل وَلِوَالِدَيْهِ، وَارْحَمْهُمَا كَمَا رَبَّيَاهُ صَغِيرًا، وَاجْعَلْ هَٰذَا الْعَمَلَ صَدَقَةً جَارِيَةً فِي مِيزَانِ حَسَنَاتِهِمْ، وَاجْمَعْهُمْ فِي الْفِرْدَوْسِ الْأَعْلَى مِنَ الْجَنَّةِ.</p>
    <p class="muted small">إن نفعك هذا التطبيق، فلا تنسَ مطوّره ووالديه من دعوة صادقة بظهر الغيب؛ فإن الملَك يقول: «ولك بمثل».</p>
  </div>`;
}

function updateBanner() {
  if (!updateAvailable()) return '';
  const l = state.app.latest;
  return `<button class="card update-banner" data-act="upd-show">
    <span class="ub-ic">${icon('download')}</span>
    <span class="cc-txt"><b>تحديث جديد متاح: ${esc(l.name)}</b><small>اضغط لمعرفة الجديد وتنزيله</small></span>${icon('chevron')}
  </button>`;
}

export function render() {
  const s = streak();
  return `${pageHead('المزيد', 'أدوات ورحلتك مع سكينة')}
    ${updateBanner()}
    <div class="more-grid">
      ${tile('#/journal', 'journal', 'teal', 'رحلتي', s ? `التزام: ${daysLabel(s)}` : 'عاداتك والأيام المهمة')}
      ${tile('#/reminders', 'bell', 'amber', 'التذكيرات', `${num(state.reminders.filter((r) => r.on).length)} تذكير مفعّل`)}
      ${tile('#/names', 'star', 'violet', 'أسماء الله الحسنى', `${num(99)} اسماً ومعانيها`)}
      ${tile('#/qibla', 'compass', 'indigo', 'بوصلة القبلة', 'اتجاه الكعبة المشرّفة')}
      ${tile('#/zakat', 'calculator', 'amber', 'حاسبة الزكاة', 'المال والذهب والفضة')}
      <button class="more-tile tone-teal" data-act="mosques"><span class="cat-ic">${icon('mosque')}</span><b>المساجد القريبة</b><small>على الخريطة (يحتاج إنترنت)</small></button>
    </div>
    <section class="card set-card">
      ${row('data-act="go" data-to="#/settings"', 'settings', 'الإعدادات', 'الثيم، القراءة، المواقيت، التنبيهات، البيانات')}
      ${row('data-act="go" data-to="#/whatsnew"', 'sparkle', 'ما الجديد', `الإصدار الحالي ${num(VERSION)}`)}
      ${row('data-act="upd-check"', 'refresh', 'التحقق من التحديثات', state.app.lastUpdateCheck ? `آخر تحقق: ${fmtDate(new Date(state.app.lastUpdateCheck))}` : 'لم يتم التحقق بعد', '<span class="upd-state" data-upd-state></span>')}
      ${row('data-act="app-share"', 'share', 'شارك التطبيق', 'الدال على الخير كفاعله')}
    </section>
    <section class="card about">
      <div class="about-logo">${icon('sparkle')}</div>
      <h2>سكينة</h2>
      <p class="muted">رفيقك الروحي اليومي · الإصدار ${num(VERSION)}</p>
      <p>أذكار وأدعية من صحيح السنة مطابقة لـ«حصن المسلم»، والقرآن الكريم بنص مشروع Tanzil المُدقَّق، ومواقيت صلاة دقيقة. يعمل بالكامل بدون إنترنت، مجاناً وبلا إعلانات.</p>
      ${devCard()}
    </section>`;
}

export function whatsNewHtml(onlyLatest = false) {
  return (onlyLatest ? CHANGELOG.slice(0, 1) : CHANGELOG).map((c) => `
    <section class="wn-block">
      <div class="wn-head"><b>الإصدار ${num(c.version)}</b><small>${num(c.date)}</small></div>
      ${c.items.map(([ic, t, d]) => `<div class="wn-item"><span class="set-ic">${icon(ic)}</span><div><b>${t}</b><p>${num(d)}</p></div></div>`).join('')}
    </section>`).join('');
}

/** إرشادات التحديث: نسخة احتياطية أولاً، وحذف النسخة القديمة إن تعذّر التثبيت فوقها */
export function updateHelp() {
  return `<div class="upd-help">
    <p class="upd-help-title">${icon('info')} قبل التحديث</p>
    <ol>
      <li><b>خذ نسخة احتياطية</b> إن كانت لديك أذكار خاصة أو مفضلة أو ختمة أو تذكيرات أو إعدادات تهمّك.
        <button class="btn btn-soft wide sm-btn" data-act="data-export">${icon('download')} حفظ نسخة احتياطية الآن</button></li>
      <li>افتح ملف التحديث بعد تنزيله وثبّته؛ في الغالب يُثبَّت فوق النسخة الحالية وتبقى بياناتك كما هي.</li>
      <li>إن ظهرت رسالة مثل «لم يتم تثبيت التطبيق» أو «تعارض مع حزمة موجودة»، أو حدثت مشكلة بعد التحديث: <b>احذف النسخة القديمة من الهاتف ثم ثبّت الجديدة</b>.</li>
      <li>بعد التثبيت افتح <b>المزيد ← الإعدادات ← البيانات ← استيراد نسخة</b> واختر ملف النسخة الاحتياطية لاسترجاع كل شيء.</li>
    </ol>
  </div>`;
}

export function showUpdateSheet() {
  const l = state.app.latest;
  if (!l) return;
  openSheet(`<div class="center"><div class="about-logo">${icon('download')}</div>
    <h3 class="sheet-title">تحديث جديد: الإصدار ${esc(l.name)}</h3></div>
    ${l.notes.length ? `<ul class="upd-notes">${l.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${updateHelp()}
    <div class="row-btns"><button class="btn btn-primary" data-dl>${icon('download')} تنزيل التحديث</button><button class="btn btn-ghost" data-close>لاحقاً</button></div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => body.querySelector('[data-dl]').addEventListener('click', () => { close(); openExternal(safeUrl(l.url)); }),
  });
}

export const actions = {
  'upd-show': () => showUpdateSheet(),
  'upd-check': async (el) => {
    const st = el.querySelector('[data-upd-state]');
    if (st) st.innerHTML = '<span class="spinner sm"></span>';
    const r = await checkForUpdate(true);
    if (st) st.textContent = '';
    if (r === 'update') { refresh(); showUpdateSheet(); } else if (r === 'latest') { toast(`أنت على أحدث إصدار (${num(VERSION)})`); refresh(); } else toast('تعذّر التحقق، تأكد من اتصالك بالإنترنت', 'info');
  },
  // المساجد القريبة: نفتح الخريطة على موقع المستخدم بحثاً عن «مسجد» (لا يحتاج التطبيق إلى مفتاح خرائط)
  mosques: async () => {
    toast('جارٍ تحديد موقعك…', 'location');
    let p;
    try { p = await getPosition(); } catch (e) { const l = location(); p = { lat: l.lat, lng: l.lng }; toast(`تعذّر تحديد موقعك، سنبحث قرب ${l.name}`, 'info'); }
    openExternal(`https://www.google.com/maps/search/${encodeURIComponent('مسجد')}/@${p.lat.toFixed(5)},${p.lng.toFixed(5)},15z`);
  },
  'app-share': async () => {
    const r = await shareText(SHARE_TEXT);
    if (r === 'copied') toast('تم نسخ نص المشاركة');
  },
};

// صفحة «ما الجديد» الكاملة
export const whatsnew = {
  full: true,
  tab: 'more',
  render: () => `${fullHead('ما الجديد', `الإصدار الحالي ${num(VERSION)}`)}<div class="wn-page">${whatsNewHtml()}<section class="wn-block"><div class="wn-head"><b>طريقة التحديث</b></div>${updateHelp()}</section></div>`,
};

/** يُعرض مرة واحدة بعد كل تحديث */
export function maybeShowWhatsNew(isUpgrade) {
  if (state.app.lastSeenVersion === VERSION) return false;
  const show = isUpgrade;
  state.app.lastSeenVersion = VERSION;
  save();
  if (show) openSheet(`<h3 class="sheet-title">${icon('sparkle')} الجديد في سكينة ${num(VERSION)}</h3>${whatsNewHtml(true)}
    <button class="btn btn-primary wide" data-close>رائع، لنبدأ</button>`, { cls: 'sheet-tall' });
  return show;
}
