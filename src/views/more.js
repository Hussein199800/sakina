// تبويب «المزيد»: مجموعات الأدوات والمعرفة والتنظيم الشخصي، ثم الإعدادات و«عن التطبيق» والمشاركة
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, daysLabel, fmtPct } from '../text.js';
import { VERSION, RELEASES_URL, APK_URL, VPN_NOTE } from '../version.js';
import { CHANGELOG } from '../data/changelog.js';
import { checkForUpdate, updateAvailable } from '../updates.js';
import { streak } from '../services.js';
import { pageHead, fullHead, refresh, fmtDate } from './common.js';
import { openSheet, toast } from '../ui.js';
import { shareText, openExternal, inAppUpdateSupported, canInstallUpdates, openInstallSettings, downloadAndInstall } from '../native.js';

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

const group = (title, html) => `<section class="block"><div class="block-head"><h2>${title}</h2></div><div class="more-grid">${html}</div></section>`;

export function render() {
  const s = streak();
  return `${pageHead('المزيد', 'أدوات ومعرفة وتنظيمك الشخصي')}
    ${updateBanner()}
    ${group('الأدوات والحاسبات', `
      ${tile('#/zakat', 'calculator', 'amber', 'حاسبة الزكاة', 'المال والذهب والفضة')}
      ${tile('#/qiyam', 'moon', 'indigo', 'قيام الليل', 'الثلث الأخير ونصف الليل')}
      ${tile('#/qibla', 'compass', 'teal', 'بوصلة القبلة', 'اتجاه الكعبة المشرّفة')}
      ${tile('#/mosques', 'mosque', 'rose', 'المساجد القريبة', 'رادار ومسار مشياً')}`)}
    ${group('المعرفة', `
      ${tile('#/names', 'star', 'violet', 'أسماء الله الحسنى', `${num(99)} اسماً ومعانيها`)}
      ${tile('#/suras', 'list', 'sand', 'مداخل السور', 'تعريف بكل سورة')}`)}
    ${group('التنظيم الشخصي', `
      ${tile('#/journal', 'journal', 'teal', 'رحلتي', s ? `التزام: ${daysLabel(s)}` : 'عاداتك والأيام المهمة')}
      ${tile('#/reminders', 'bell', 'amber', 'التذكيرات', `${num(state.reminders.filter((r) => r.on).length)} تذكير مفعّل`)}`)}
    <section class="card set-card">
      ${row('data-act="go" data-to="#/settings"', 'settings', 'الإعدادات', 'المظهر، الصلاة، التذكيرات، البيانات')}
      ${row('data-act="go" data-to="#/about"', 'info', 'عن التطبيق', `الإصدار ${num(VERSION)}، ما الجديد، التحديثات`, updateAvailable() ? `<span class="dot-badge">جديد</span>${icon('chevron')}` : '')}
      ${row('data-act="app-share"', 'share', 'شارك التطبيق', 'الدال على الخير كفاعله')}
    </section>`;
}

// صفحة «عن التطبيق»: التعريف والإصدار وما الجديد والتحديثات والمصادر وبيانات المطور
export const about = {
  full: true,
  tab: 'more',
  render: () => `${fullHead('عن التطبيق', `سكينة · الإصدار ${num(VERSION)}`)}
    <section class="card about">
      <div class="about-logo">${icon('sparkle')}</div>
      <h2>سكينة</h2>
      <p class="muted">رفيقك الروحي اليومي · الإصدار ${num(VERSION)}</p>
      <p>أذكار وأدعية من صحيح السنة مطابقة لـ«حصن المسلم»، والقرآن الكريم بنص مشروع Tanzil المُدقَّق، ومواقيت صلاة دقيقة. يعمل بالكامل بدون إنترنت، مجاناً وبلا إعلانات.</p>
    </section>
    ${updateBanner()}
    <section class="card set-card">
      ${row('data-act="go" data-to="#/whatsnew"', 'sparkle', 'ما الجديد', `الإصدار الحالي ${num(VERSION)}`)}
      ${row('data-act="upd-check"', 'refresh', 'التحقق من التحديثات', state.app.lastUpdateCheck ? `آخر تحقق: ${fmtDate(new Date(state.app.lastUpdateCheck))}` : 'لم يتم التحقق بعد', '<span class="upd-state" data-upd-state></span>')}
      <div class="set-row"><span class="set-ic">${icon('refresh')}</span><div class="set-txt"><b>التحقق التلقائي من التحديثات</b><small>مرة يومياً عند الاتصال بالإنترنت</small></div><button class="switch ${state.app.autoUpdate ? 'on' : ''}" role="switch" aria-checked="${state.app.autoUpdate}" data-act="set-autoupd"><i></i></button></div>
      <p class="vpn-note">${icon('info')} ${VPN_NOTE}</p>
    </section>
    <section class="card set-card">
      <h2 class="set-title">${icon('book')} المصادر والتراخيص</h2>
      <ul class="src-list">
        <li>نص المصحف وبياناته: مشروع <b>Tanzil</b> (tanzil.net)، بترخيص ${num("CC BY 3.0")} ودون أي تعديل.</li>
        <li>الأذكار والأدعية: مطابقة لكتاب «حصن المسلم» للشيخ سعيد بن علي القحطاني رحمه الله.</li>
        <li>مقاصد السور والمكي والمدني: «المختصر في تفسير القرآن الكريم»، مركز تفسير للدراسات القرآنية.</li>
        <li>المساجد القريبة: بيانات OpenStreetMap المفتوحة (ODbL).</li>
        <li>الخطوط: IBM Plex Sans Arabic وAmiri، بترخيص SIL Open Font License.</li>
      </ul>
    </section>
    <section class="card about">${devCard()}</section>`,
};

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
      <li>اضغط «تنزيل وتثبيت»؛ يُنزَّل التحديث داخل سكينة ثم يفتح المثبّت، وتبقى بياناتك كما هي.</li>
      <li>إن ظهرت رسالة مثل «لم يتم تثبيت التطبيق» أو «تعارض مع حزمة موجودة»، أو حدثت مشكلة بعد التحديث: <b>احذف النسخة القديمة من الهاتف ثم ثبّت الجديدة</b>.</li>
      <li>بعد التثبيت افتح <b>المزيد ← الإعدادات ← البيانات والخصوصية ← استيراد نسخة</b> واختر ملف النسخة الاحتياطية لاسترجاع كل شيء.</li>
    </ol>
  </div>`;
}

// لا نقبل إلا ملفات إصدارات المستودع الرسمي (ويتحقق أندرويد من التوقيع أيضاً)
const safeApk = (u) => (/^https:\/\/github\.com\/Hussein199800\/sakina\/releases\/(latest\/)?download\//.test(u || '') ? u : APK_URL);

export function showUpdateSheet() {
  const l = state.app.latest;
  if (!l) return;
  openSheet(`<div class="center"><div class="about-logo">${icon('download')}</div>
    <h3 class="sheet-title">تحديث جديد: الإصدار ${esc(num(l.name))}</h3></div>
    ${l.notes.length ? `<ul class="upd-notes">${l.notes.map((n) => `<li>${esc(num(n))}</li>`).join('')}</ul>` : ''}
    <div data-upd-box></div>
    ${updateHelp()}
    <div class="row-btns"><button class="btn btn-primary" data-dl>${icon('download')} ${inAppUpdateSupported ? 'تنزيل وتثبيت' : 'تنزيل التحديث'}</button><button class="btn btn-ghost" data-close>لاحقاً</button></div>`, {
    cls: 'sheet-tall',
    onMount: (body) => {
      const box = body.querySelector('[data-upd-box]');
      const btn = body.querySelector('[data-dl]');
      const show = (html) => { box.innerHTML = html; };
      btn.addEventListener('click', async () => {
        if (!inAppUpdateSupported) { openExternal(safeUrl(l.url)); return; }
        // أول مرة: يطلب أندرويد السماح لسكينة بتثبيت التطبيقات
        if (!(await canInstallUpdates())) {
          show(`<div class="upd-state-box"><b>${icon('shield')} خطوة واحدة قبل التثبيت</b>
            <p>اسمح لسكينة بتثبيت التحديثات: اضغط «السماح» ثم فعّل الخيار وارجع، واضغط «تنزيل وتثبيت» مرة أخرى.</p>
            <button class="btn btn-soft wide" data-allow>${icon('settings')} السماح</button></div>`);
          box.querySelector('[data-allow]').addEventListener('click', () => openInstallSettings());
          return;
        }
        btn.disabled = true;
        show(`<div class="upd-state-box"><b data-upd-label>جارٍ التنزيل…</b><span class="bar"><i data-upd-bar style="width:0%"></i></span></div>`);
        const label = box.querySelector('[data-upd-label]');
        const bar = box.querySelector('[data-upd-bar]');
        try {
          await downloadAndInstall(safeApk(l.apk), (p) => {
            if (p >= 0) { label.textContent = `جارٍ التنزيل… ${fmtPct(p / 100)}`; bar.style.width = `${p}%`; } else label.textContent = 'جارٍ التنزيل…';
          });
          label.textContent = 'اكتمل التنزيل، اتبع خطوات المثبّت';
          bar.style.width = '100%';
        } catch (e) {
          const msg = (e && e.message) || 'تعذّر تنزيل التحديث';
          show(`<div class="upd-state-box err"><b>${icon('info')} ${esc(msg)}</b>${e && e.code === 'NETWORK' ? `<p>${VPN_NOTE}</p>` : ''}</div>`);
        }
        btn.disabled = false;
      });
    },
  });
}

export const actions = {
  'upd-show': () => showUpdateSheet(),
  'set-autoupd': () => { state.app.autoUpdate = !state.app.autoUpdate; save(); refresh(); },
  'upd-check': async (el) => {
    const st = el.querySelector('[data-upd-state]');
    if (st) st.innerHTML = '<span class="spinner sm"></span>';
    const r = await checkForUpdate(true);
    if (st) st.textContent = '';
    if (r === 'update') { refresh(); showUpdateSheet(); } else if (r === 'latest') { toast(`أنت على أحدث إصدار (${num(VERSION)})`); refresh(); } else {
      openSheet(`<div class="center"><div class="about-logo">${icon('info')}</div><h3 class="sheet-title">تعذّر التحقق من التحديثات</h3></div>
        <p class="sheet-text">تأكد من اتصالك بالإنترنت. ${VPN_NOTE}</p>
        <div class="row-btns"><button class="btn btn-primary" data-retry>${icon('refresh')} إعادة المحاولة</button><button class="btn btn-ghost" data-close>إغلاق</button></div>`, {
        onMount: (body, close) => body.querySelector('[data-retry]').addEventListener('click', () => { close(); setTimeout(() => actions['upd-check'](el), 200); }),
      });
    }
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
