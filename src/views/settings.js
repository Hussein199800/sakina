// التبويب الخامس: التخصيص والأدوات
import { state, save, flush, replaceAll, clearAll, DEFAULTS, serialize } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, normalize } from '../text.js';
import { CITIES, CITIES_SORTED } from '../data/cities.js';
import { METHODS } from '../prayer.js';
import { location, deviceTz, rescheduleNotifications } from '../services.js';
import { fullHead, refresh } from './common.js';
import { restart as restartSetup } from './setup.js';
import { THEMES, openSheet, confirmSheet, toast } from '../ui.js';
import { getPosition, saveTextFile } from '../native.js';
import { timeButton, pickTime } from './pickers.js';
import { UI_FONTS, TEXT_FONTS, UI_SCALES } from '../fonts.js';

export const full = true;
export const tab = 'more';

const sw = (on, act, extra = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra}><i></i></button>`;
const row = (ic, label, sub, control) => `<div class="set-row"><span class="set-ic">${icon(ic)}</span><div class="set-txt"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>${control}</div>`;

function themes() {
  return `<div class="theme-grid">${Object.entries(THEMES).map(([k, t]) => `
    <button class="theme-card ${state.settings.theme === k ? 'on' : ''}" data-act="set-theme" data-k="${k}" aria-pressed="${state.settings.theme === k}" style="background:${t.bg};color:${t.text}">
      <span class="tc-preview" style="background:${t.card}">
        <i style="background:${t.primary}"></i><i style="background:${t.secondary}"></i><i style="background:${t.text};opacity:.25"></i>
      </span>
      <b>${t.name}</b><small style="color:${t.text}">${t.hint}</small>
      <span class="tc-check" style="background:${t.primary};color:${t.dark ? t.bg : '#fff'}">${icon('check')}</span>
    </button>`).join('')}</div>`;
}


const SNOOZE_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 120];
const minLabel = (m) => (m % 60 === 0 ? (m === 60 ? 'ساعة' : m === 120 ? 'ساعتان' : `${num(m / 60)} ساعات`) : `${num(m)} د`);
const link = (to, ic, label, sub) => `<button class="set-row link" data-act="go" data-to="${to}"><span class="set-ic">${icon(ic)}</span><div class="set-txt"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>${icon('chevron')}</button>`;

export function render() {
  const s = state.settings;
  const loc = location();
  return `${fullHead('الإعدادات', 'خصّص سكينة كما يريحك')}
    <section class="card set-card">
      <h2 class="set-title">${icon('palette')} المظهر والقراءة</h2>
      ${row('sun', 'اتباع وضع الهاتف', 'الواحة الهادئة نهاراً، والسكينة الليلية في الوضع الداكن', sw(s.followSystem, 'set-toggle', 'data-k="followSystem"'))}
      ${s.followSystem ? '' : themes()}
      <div class="set-sub"><b>${icon('type')} خط التطبيق</b>
        <div class="chips">${Object.entries(UI_FONTS).map(([k, f]) => `<button class="chip font-chip ${s.uiFont === k ? 'on' : ''}" data-act="set-uifont" data-k="${k}" style="font-family:${f.family}" aria-pressed="${s.uiFont === k}">${f.label}</button>`).join('')}</div></div>
      <div class="set-sub"><b>${icon('book')} خط الأذكار والأدعية</b>
        <div class="chips">${Object.entries(TEXT_FONTS).map(([k, f]) => `<button class="chip font-chip ${s.textFont === k ? 'on' : ''}" data-act="set-textfont" data-k="${k}" style="font-family:${f.family}" aria-pressed="${s.textFont === k}">${k === 'ruqaa' ? 'رقعة' : 'سُبْحَانَ اللَّهِ'} <small>${f.label}</small></button>`).join('')}</div></div>
      <div class="set-row"><span class="set-ic">${icon('type')}</span><div class="set-txt"><b>حجم خط التطبيق</b><small>${num(Math.round(s.uiScale * 100))}٪ للتطبيق كله</small></div>
        <div class="stepper sm"><button class="icon-btn" data-act="set-scale" data-d="-1" aria-label="تصغير خط التطبيق" ${s.uiScale <= UI_SCALES[0] ? 'disabled' : ''}>${icon('minus')}</button><button class="icon-btn" data-act="set-scale" data-d="1" aria-label="تكبير خط التطبيق" ${s.uiScale >= UI_SCALES[UI_SCALES.length - 1] ? 'disabled' : ''}>${icon('plus')}</button></div></div>
      <div class="set-row"><span class="set-ic">${icon('type')}</span><div class="set-txt"><b>حجم خط الأذكار</b><small>${num(s.fontSize)} بكسل</small></div>
        <div class="stepper sm"><button class="icon-btn" data-act="set-font" data-d="-2" aria-label="تصغير">${icon('minus')}</button><button class="icon-btn" data-act="set-font" data-d="2" aria-label="تكبير">${icon('plus')}</button></div></div>
      <p class="font-preview amiri" style="font-size:${s.fontSize}px">${s.tashkeel ? 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ' : 'سبحان الله وبحمده'}</p>
      ${row('sparkle', 'إظهار التشكيل', 'الحركات على نصوص الأذكار', sw(s.tashkeel, 'set-toggle', 'data-k="tashkeel"'))}
      ${row('focus', 'الانتقال التلقائي', 'إلى الذكر التالي عند اكتمال العدد', sw(s.autoAdvance, 'set-toggle', 'data-k="autoAdvance"'))}
      <div class="set-row"><span class="set-ic">${icon('list')}</span><div class="set-txt"><b>شكل الأرقام</b></div>
        <div class="seg sm">${[['arab', '١٢٣'], ['latn', '123']].map(([k, l]) => `<button class="seg-btn ${s.digits === k ? 'on' : ''}" data-act="set-digits" data-k="${k}" data-digit-sample>${l}</button>`).join('')}</div></div>
      ${link('#/customize', 'grid', 'تخصيص الرئيسية', 'إظهار البطاقات وإخفاؤها وترتيبها والاختصارات')}
    </section>

    <section class="card set-card">
      <h2 class="set-title">${icon('mosque')} الصلاة والموقع</h2>
      <button class="set-row link" data-act="set-city">
        <span class="set-ic">${icon('pin')}</span><div class="set-txt"><b>الموقع</b><small>${esc(loc.name)}${loc.country ? ` · ${loc.country}` : ''}${loc.gps ? ' (GPS)' : ''}</small></div>${icon('chevron')}
      </button>
      <label class="set-row"><span class="set-ic">${icon('calendar')}</span><div class="set-txt"><b>طريقة الحساب</b></div>
        <select data-sel="method">
          <option value="auto" ${s.method === 'auto' ? 'selected' : ''}>تلقائي حسب البلد (${METHODS[loc.method].name})</option>
          ${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${s.method === k ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select></label>
      <label class="set-row"><span class="set-ic">${icon('sun')}</span><div class="set-txt"><b>حساب العصر</b></div>
        <select data-sel="asr"><option value="shafi" ${s.asr === 'shafi' ? 'selected' : ''}>الجمهور (المثل)</option><option value="hanafi" ${s.asr === 'hanafi' ? 'selected' : ''}>الحنفي (المثلين)</option></select></label>
      <label class="set-row"><span class="set-ic">${icon('moon')}</span><div class="set-txt"><b>تعديل التاريخ الهجري</b><small>حسب رؤية الهلال في بلدك</small></div>
        <select data-sel="hijriAdjust">${[-2, -1, 0, 1, 2].map((v) => `<option value="${v}" ${s.hijriAdjust === v ? 'selected' : ''}>${v === 0 ? 'بدون تعديل' : `${v > 0 ? '+' : ''}${num(v)} يوم`}</option>`).join('')}</select></label>
      ${link('#/reminders', 'bell', 'تنبيهات الصلاة', 'من صفحة التذكيرات')}
    </section>

    <section class="card set-card">
      <h2 class="set-title">${icon('bell')} الأذكار والتذكيرات</h2>
      ${link('#/reminders', 'bell', 'مواعيد التذكيرات والفقاعة', 'الأذكار، الصيام، الجمعة، الختمة، وتذكيراتك الخاصة')}
      <div class="set-sub"><b>${icon('refresh')} مدد تأجيل الفقاعة</b><small>تظهر على الفقاعة عند الضغط على «تأجيل». اختر حتى ${num(4)} مدد.</small>
        <div class="chips">${SNOOZE_OPTIONS.map((m) => `<button class="chip ${s.snooze.indexOf(m) !== -1 ? 'on' : ''}" data-act="set-snooze" data-m="${m}" aria-pressed="${s.snooze.indexOf(m) !== -1}">${minLabel(m)}</button>`).join('')}</div></div>
      ${row('moon', 'ساعات الهدوء', 'لا تظهر فيها الفقاعة ولا تذكيراتك الخاصة، وتبقى تنبيهات الصلاة والأذكار', sw(s.quiet.on, 'set-quiet'))}
      ${s.quiet.on ? `<div class="quiet-row"><span>من</span>${timeButton(s.quiet.from, 'data-quiet="from"')}<span>إلى</span>${timeButton(s.quiet.to, 'data-quiet="to"')}</div>` : ''}
      ${row('volume', 'صوت النقر', 'نقرة ناعمة مع كل تسبيحة', sw(s.sound, 'set-toggle', 'data-k="sound"'))}
      ${row('vibrate', 'الاهتزاز', 'اهتزاز خفيف عند العدّ', sw(s.haptic, 'set-toggle', 'data-k="haptic"'))}
    </section>

    <section class="card set-card">
      <h2 class="set-title">${icon('shield')} البيانات والخصوصية</h2>
      <p class="muted small">كل بياناتك محفوظة على جهازك فقط، ولا يوجد حساب ولا مزامنة ولا نسخ سحابي. احفظ نسخة احتياطية قبل أي تحديث، فإن أعدت تثبيت التطبيق استرجعت منها كل شيء.</p>
      <div class="data-btns">
        <button class="btn btn-soft" data-act="data-export">${icon('download')} تصدير نسخة</button>
        <label class="btn btn-soft">${icon('upload')} استيراد نسخة<input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
      <details class="perm-info"><summary>${icon('info')} الأذونات ولماذا نطلبها</summary>
        <ul>
          <li><b>الموقع:</b> لحساب مواقيت الصلاة واتجاه القبلة والمساجد القريبة، ويمكنك اختيار مدينتك بدلاً منه.</li>
          <li><b>الإشعارات والمنبّهات الدقيقة:</b> للتذكيرات في وقتها.</li>
          <li><b>الظهور فوق التطبيقات:</b> للفقاعة العائمة فقط، وتعمل التذكيرات بدونها.</li>
          <li><b>تثبيت التطبيقات:</b> لتثبيت تحديثات سكينة من داخلها.</li>
          <li><b>الإنترنت:</b> للتحقق من التحديثات وتنزيلها والمساجد القريبة فقط، وكل ما عداها يعمل دون اتصال.</li>
        </ul></details>
      <button class="set-row link" data-act="setup-again"><span class="set-ic">${icon('sparkle')}</span><div class="set-txt"><b>إعادة التخصيص الأولي</b><small>خطوات الموقع والمظهر والقراءة والتذكيرات</small></div>${icon('chevron')}</button>
      <button class="set-row link" data-act="home-reset"><span class="set-ic">${icon('grid')}</span><div class="set-txt"><b>استعادة ترتيب الرئيسية</b><small>يعيد البطاقات والاختصارات كما كانت فقط</small></div>${icon('chevron')}</button>
      <button class="set-row link" data-act="settings-reset"><span class="set-ic">${icon('refresh')}</span><div class="set-txt"><b>إعادة ضبط الإعدادات</b><small>المظهر والقراءة والتنبيهات، دون حذف تقدّمك وبياناتك</small></div>${icon('chevron')}</button>
      <button class="set-row link danger" data-act="data-clear"><span class="set-ic">${icon('trash')}</span><div class="set-txt"><b>حذف كل البيانات</b><small>كل شيء، ولا يمكن التراجع</small></div>${icon('chevron')}</button>
    </section>`;
}

export function mount(root) {
  root.querySelectorAll('[data-quiet]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.quiet;
    const v = await pickTime(state.settings.quiet[k], k === 'from' ? 'بداية ساعات الهدوء' : 'نهاية ساعات الهدوء');
    if (!v) return;
    state.settings.quiet[k] = v;
    save();
    rescheduleNotifications();
    refresh();
  }));
  root.querySelectorAll('select[data-sel]').forEach((sel) => sel.addEventListener('change', () => {
    const k = sel.dataset.sel;
    state.settings[k] = k === 'hijriAdjust' ? +sel.value : sel.value;
    save();
    rescheduleNotifications();
    refresh();
  }));
  const imp = root.querySelector('[data-import]');
  if (imp) imp.addEventListener('change', async () => {
    const f = imp.files && imp.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await readFile(f));
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('bad');
      replaceAll(data);
      rescheduleNotifications();
      toast('تم استيراد بياناتك');
      document.dispatchEvent(new Event('app:theme'));
    } catch (e) { toast('الملف غير صالح', 'info'); }
  });
}

// FileReader بدل Blob.text() ليعمل على WebView القديم في أندرويد ٨
const readFile = (f) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsText(f);
});

/** نافذة اختيار الموقع (تُستخدم أيضاً في شاشة الترحيب) */
export function cityPicker(onDone) {
  openSheet(`<h3 class="sheet-title">اختر موقعك</h3>
    <button class="btn btn-primary wide" data-gps>${icon('location')} استخدام موقعي الحالي</button>
    <label class="search in-sheet">${icon('search')}<input type="search" placeholder="ابحث عن مدينة أو دولة…" data-q></label>
    <div class="city-list" data-list></div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => {
      const list = body.querySelector('[data-list]');
      const draw = (q) => {
        const nq = normalize(q || '');
        const sel = state.settings.location;
        list.innerHTML = CITIES_SORTED.filter((c) => !nq || normalize(`${c.name} ${c.country}`).indexOf(nq) !== -1)
          .map((c) => `<button class="city ${sel.type === 'city' && sel.cityId === c.id ? 'on' : ''}" data-city="${c.id}"><b>${c.name}</b><small>${c.country}</small></button>`).join('')
          || '<p class="muted center">لا توجد مدينة بهذا الاسم</p>';
      };
      draw('');
      body.querySelector('[data-q]').addEventListener('input', (e) => draw(e.target.value));
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-city]');
        if (!b) return;
        state.settings.location = { type: 'city', cityId: +b.dataset.city };
        save();
        rescheduleNotifications();
        close();
        toast(`تم اختيار ${CITIES[+b.dataset.city].name}`, 'pin');
        if (onDone) onDone();
        refresh();
      });
      body.querySelector('[data-gps]').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = `${icon('location')} جارٍ تحديد الموقع…`;
        try {
          const p = await getPosition();
          // نقترح طريقة الحساب من أقرب مدينة مدمجة
          let near = CITIES[0];
          let best = Infinity;
          for (const c of CITIES) { const d = (c.lat - p.lat) ** 2 + (c.lng - p.lng) ** 2; if (d < best) { best = d; near = c; } }
          state.settings.location = { type: 'gps', lat: p.lat, lng: p.lng, tz: deviceTz(), method: near.method, name: best < 1.5 ? `قرب ${near.name}` : 'موقعي الحالي' };
          save();
          rescheduleNotifications();
          close();
          toast('تم تحديد موقعك بنجاح', 'location');
          if (onDone) onDone();
          refresh();
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = `${icon('location')} استخدام موقعي الحالي`;
          toast('تعذّر تحديد الموقع، اختر مدينتك من القائمة', 'info');
        }
      });
    },
  });
}

export const actions = {
  'set-theme': (el) => { state.settings.theme = el.dataset.k; save(); document.dispatchEvent(new Event('app:theme')); },
  'set-font': (el) => { state.settings.fontSize = Math.max(18, Math.min(44, state.settings.fontSize + +el.dataset.d)); save(); document.dispatchEvent(new Event('app:theme')); },
  'set-toggle': (el) => {
    const k = el.dataset.k;
    state.settings[k] = !state.settings[k];
    save();
    if (k === 'followSystem') document.dispatchEvent(new Event('app:theme')); else refresh();
  },
  'set-uifont': (el) => { state.settings.uiFont = el.dataset.k; save(); document.dispatchEvent(new Event('app:theme')); },
  'set-textfont': (el) => { state.settings.textFont = el.dataset.k; save(); document.dispatchEvent(new Event('app:theme')); },
  'set-scale': (el) => {
    const i = UI_SCALES.indexOf(state.settings.uiScale);
    state.settings.uiScale = UI_SCALES[Math.max(0, Math.min(UI_SCALES.length - 1, (i === -1 ? 2 : i) + +el.dataset.d))];
    save();
    document.dispatchEvent(new Event('app:theme'));
  },
  'set-snooze': (el) => {
    const m = +el.dataset.m;
    const list = state.settings.snooze;
    const i = list.indexOf(m);
    if (i !== -1) { if (list.length === 1) { toast('اترك مدة واحدة على الأقل', 'info'); return; } list.splice(i, 1); }
    else { if (list.length >= 4) { toast('أربع مدد على الأكثر', 'info'); return; } list.push(m); list.sort((x, y) => x - y); }
    save();
    rescheduleNotifications();
    refresh();
  },
  'set-quiet': () => { state.settings.quiet.on = !state.settings.quiet.on; save(); rescheduleNotifications(); refresh(); },
  'home-reset': async () => {
    if (!(await confirmSheet('استعادة ترتيب الرئيسية', 'تعود بطاقات الرئيسية واختصاراتها إلى الترتيب الافتراضي. لا تُحذف أي بيانات ولا تتغير بقية الإعدادات.', 'استعادة'))) return;
    state.settings.home = null;
    save();
    toast('عادت الرئيسية إلى ترتيبها الافتراضي', 'grid');
  },
  'settings-reset': async () => {
    if (!(await confirmSheet('إعادة ضبط الإعدادات', 'تعود إعدادات المظهر والقراءة والصلاة والتنبيهات والفقاعة إلى الافتراضي، ويبقى موقعك. لا يُحذف تقدّمك ولا المفضلة ولا الختمة ولا تذكيراتك الخاصة ولا سجلّك.', 'إعادة الضبط'))) return;
    const keep = { location: state.settings.location, home: state.settings.home };
    Object.assign(state.settings, JSON.parse(JSON.stringify(DEFAULTS.settings)), keep);
    save();
    await rescheduleNotifications();
    toast('أُعيد ضبط الإعدادات', 'refresh');
    document.dispatchEvent(new Event('app:theme'));
  },
  'set-digits': (el) => { state.settings.digits = el.dataset.k; save(); document.dispatchEvent(new Event('app:theme')); },
  'set-city': () => cityPicker(),
  'setup-again': () => { restartSetup(); document.location.hash = '#/setup'; },
  'data-export': async () => {
    flush();
    await saveTextFile(`sakina-backup-${new Date().toISOString().slice(0, 10)}.json`, serialize(1));
    toast('تم تجهيز نسخة من بياناتك', 'download');
  },
  'data-clear': async () => {
    if (!(await confirmSheet('حذف كل البيانات', 'ستُحذف الإعدادات والتقدّم والمفضلة وأذكارك الخاصة ووردك والختمة والتذكيرات وسجلّ الالتزام. لا يمكن التراجع، فصدّر نسخة احتياطية أولاً إن أردت.', 'حذف نهائي', true))) return;
    clearAll();
    await rescheduleNotifications();
    toast('تم مسح البيانات', 'trash');
    document.dispatchEvent(new Event('app:theme'));
  },
};
