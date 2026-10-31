// شاشة التخصيص عند أول تثبيت: خطوات قصيرة يختار فيها المستخدم ما يناسبه، وكلها قابلة للتخطي والتعديل لاحقاً
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, setDigits } from '../text.js';
import { THEMES, applyTheme, toast, dhikrText } from '../ui.js';
import { location, methodKey, rescheduleNotifications } from '../services.js';
import { METHODS } from '../prayer.js';
import { startKhatma } from '../khatma.js';
import { cityPicker } from './settings.js';
import { timeButton, pickTime } from './pickers.js';
import { go } from './common.js';
import { notificationsSupported, ensureNotifyPermission, overlaySupported, overlayGranted, openOverlaySettings } from '../native.js';

export const full = true;
export const tab = 'home';

const STEPS = ['welcome', 'location', 'look', 'reading', 'reminders', 'quran', 'done'];
let step = 0;
let khatmaPlan = 0;

const sw = (on, act, extra = '') => `<button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra}><i></i></button>`;
const row = (ic, title, sub, control) => `<div class="set-row"><span class="set-ic">${icon(ic)}</span><div class="set-txt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${control}</div>`;

function body() {
  const s = state.settings;
  switch (STEPS[step]) {
    case 'welcome':
      return `<div class="su-hero"><div class="about-logo big">${icon('sparkle')}</div>
        <h1>أهلاً بك في سكينة</h1>
        <p>رفيقك الروحي اليومي: أذكار، وقرآن، ومواقيت صلاة، ومسبحة، وكل شيء يعمل على هاتفك بدون إنترنت.</p>
        <p class="muted">لنخصّص التطبيق لك في دقيقة واحدة. يمكنك تخطي أي خطوة وتعديلها لاحقاً من الإعدادات.</p></div>`;
    case 'location': {
      const loc = location();
      return `<h2 class="su-title">${icon('pin')} موقعك</h2>
        <p class="su-sub">لحساب مواقيت الصلاة واتجاه القبلة بدقة.</p>
        <section class="card su-loc"><b>${loc.name}</b><small>${loc.country || ''}</small><small class="muted">طريقة الحساب: ${METHODS[methodKey()].name}</small></section>
        <button class="btn btn-primary wide" data-act="su-city">${icon('location')} تحديد الموقع أو اختيار المدينة</button>`;
    }
    case 'look':
      return `<h2 class="su-title">${icon('palette')} المظهر</h2>
        <p class="su-sub">اختر الألوان التي تريح عينك.</p>
        <div class="theme-grid">${Object.entries(THEMES).map(([k, t]) => `
          <button class="theme-card ${s.theme === k ? 'on' : ''}" data-act="su-theme" data-k="${k}" style="background:${t.bg};color:${t.text}">
            <span class="tc-preview" style="background:${t.card}"><i style="background:${t.primary}"></i><i style="background:${t.secondary}"></i></span>
            <b>${t.name}</b><small style="color:${t.text}">${t.hint}</small>
            <span class="tc-check" style="background:${t.primary};color:${t.dark ? t.bg : '#fff'}">${icon('check')}</span>
          </button>`).join('')}</div>
        <section class="card set-card su-card">
          <div class="set-row"><span class="set-ic">${icon('list')}</span><div class="set-txt"><b>شكل الأرقام</b></div>
            <div class="seg sm">${[['arab', '١٢٣'], ['latn', '123']].map(([k, l]) => `<button class="seg-btn ${s.digits === k ? 'on' : ''}" data-act="su-digits" data-k="${k}" data-digit-sample>${l}</button>`).join('')}</div></div>
          <div class="set-row"><span class="set-ic">${icon('type')}</span><div class="set-txt"><b>حجم خط الأذكار</b></div>
            <div class="stepper sm"><button class="icon-btn" data-act="su-font" data-d="-2" aria-label="تصغير">${icon('minus')}</button><button class="icon-btn" data-act="su-font" data-d="2" aria-label="تكبير">${icon('plus')}</button></div></div>
          <p class="font-preview amiri" style="font-size:${s.fontSize}px">${dhikrText('سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ')}</p>
        </section>`;
    case 'reading':
      return `<h2 class="su-title">${icon('book')} طريقة القراءة</h2>
        <p class="su-sub">كيف تحب أن تقرأ الأذكار؟</p>
        <div class="su-modes">
          <button class="su-mode ${s.readMode === 'focus' ? 'on' : ''}" data-act="su-mode" data-k="focus">${icon('focus')}<b>وضع التركيز</b><small>ذكر واحد في بطاقة كبيرة، تضغط عليها للعدّ</small></button>
          <button class="su-mode ${s.readMode === 'list' ? 'on' : ''}" data-act="su-mode" data-k="list">${icon('list')}<b>وضع القائمة</b><small>كل الأذكار تحت بعضها مع عدّاد لكل ذكر</small></button>
        </div>
        <section class="card set-card su-card">
          ${row('sparkle', 'إظهار التشكيل', 'الحركات على نصوص الأذكار', sw(s.tashkeel, 'su-flag', 'data-k="tashkeel"'))}
          ${row('focus', 'الانتقال التلقائي', 'إلى الذكر التالي عند اكتمال العدد', sw(s.autoAdvance, 'su-flag', 'data-k="autoAdvance"'))}
          ${row('volume', 'صوت النقر', 'نقرة ناعمة مع كل تسبيحة', sw(s.sound, 'su-flag', 'data-k="sound"'))}
          ${row('vibrate', 'الاهتزاز', 'اهتزاز خفيف عند العدّ', sw(s.haptic, 'su-flag', 'data-k="haptic"'))}
        </section>`;
    case 'reminders': {
      const n = s.notif;
      const r = (k, ic, label) => `<div class="set-row"><span class="set-ic">${icon(ic)}</span><div class="set-txt"><b>${label}</b></div>
        ${timeButton(n[k].time, `data-act="su-time" data-k="${k}" ${n[k].on ? '' : 'disabled'}`)}${sw(n[k].on, 'su-notif', `data-k="${k}"`)}</div>`;
      return `<h2 class="su-title">${icon('bell')} التذكيرات</h2>
        <p class="su-sub">نذكّرك بوردك في الوقت الذي تختاره.</p>
        <section class="card set-card su-card">
          ${r('morning', 'sunrise', 'أذكار الصباح')}
          ${r('evening', 'sunset', 'أذكار المساء')}
          ${r('sleep', 'moon', 'أذكار النوم')}
          ${row('mosque', 'دخول وقت الصلاة', 'إشعار عند كل أذان', sw(n.prayers, 'su-prayers'))}
          ${overlaySupported ? row('bubble', 'فقاعة عائمة فوق التطبيقات', 'دائرة صغيرة تظهر فوق أي تطبيق في وقت الأذكار', sw(s.overlay, 'su-overlay')) : ''}
        </section>
        ${notificationsSupported ? '' : `<p class="note">${icon('info')} التذكيرات تعمل في تطبيق أندرويد.</p>`}`;
    }
    case 'quran':
      return `<h2 class="su-title">${icon('quran')} ورد القرآن</h2>
        <p class="su-sub">هل تريد أن تبدأ ختمة بورد يومي؟</p>
        <div class="plan-grid su-plans">
          ${[[0, 'ليس الآن', 'يمكنك البدء لاحقاً'], [5, '٥ صفحات يومياً', 'ختمة كل ٤ أشهر تقريباً'], [10, '١٠ صفحات يومياً', 'ختمة كل شهرين'], [20, 'جزء يومياً', 'ختمة كل شهر']].map(([p, l, sub]) => `
            <button class="plan ${khatmaPlan === p ? 'on' : ''}" data-act="su-plan" data-p="${p}"><b>${num(l)}</b><small>${num(sub)}</small></button>`).join('')}
        </div>
        ${state.khatma ? `<p class="note">${icon('flag')} لديك ختمة قائمة، ولن تتغيّر.</p>` : ''}`;
    default:
      return `<div class="su-hero"><div class="done-glow">${icon('check')}</div>
        <h1>كل شيء جاهز</h1>
        <p>نسأل الله أن يجعل سكينة عوناً لك على ذكره وشكره وحسن عبادته.</p>
        <p class="muted">يمكنك تعديل كل ما اخترته في أي وقت من «المزيد ← الإعدادات».</p></div>`;
  }
}

export function render() {
  const last = step === STEPS.length - 1;
  return `<div class="setup">
    <header class="su-top">
      ${step > 0 && !last ? `<button class="icon-btn" data-act="su-back" aria-label="السابق">${icon('back')}</button>` : '<span class="icon-btn-space"></span>'}
      <div class="su-dots">${STEPS.map((_, i) => `<i class="${i === step ? 'on' : i < step ? 'past' : ''}"></i>`).join('')}</div>
      ${last ? '<span class="icon-btn-space"></span>' : '<button class="su-skip" data-act="su-finish">تخطٍّ</button>'}
    </header>
    <main class="su-body">${body()}</main>
    <footer class="su-foot"><button class="btn btn-primary wide" data-act="${last ? 'su-finish' : 'su-next'}">${last ? `${icon('check')} ابدأ` : step === 0 ? 'لنبدأ' : `التالي ${icon('chevron')}`}</button></footer>
  </div>`;
}

const rerender = () => document.dispatchEvent(new Event('app:refresh'));

async function finish() {
  const s = state.settings;
  if (khatmaPlan && !state.khatma) startKhatma({ perDay: khatmaPlan, time: '20:00', remind: true, fromPage: 1 });
  const wantsNotif = s.notif.morning.on || s.notif.evening.on || s.notif.sleep.on || s.notif.prayers || (khatmaPlan && notificationsSupported);
  if (wantsNotif && notificationsSupported) await ensureNotifyPermission();
  state.app.welcomed = true;
  save();
  await rescheduleNotifications();
  step = 0;
  khatmaPlan = 0;
  go('#/home');
}

export const actions = {
  'su-next': () => { step = Math.min(STEPS.length - 1, step + 1); rerender(); window.scrollTo(0, 0); },
  'su-back': () => { step = Math.max(0, step - 1); rerender(); },
  'su-finish': () => finish(),
  'su-city': () => cityPicker(() => rerender()),
  'su-theme': (el) => { state.settings.theme = el.dataset.k; save(); applyTheme(); rerender(); },
  'su-digits': (el) => { state.settings.digits = el.dataset.k; setDigits(el.dataset.k); save(); rerender(); },
  'su-font': (el) => { state.settings.fontSize = Math.max(18, Math.min(44, state.settings.fontSize + +el.dataset.d)); save(); applyTheme(); rerender(); },
  'su-mode': (el) => { state.settings.readMode = el.dataset.k; save(); rerender(); },
  'su-flag': (el) => { const k = el.dataset.k; state.settings[k] = !state.settings[k]; save(); rerender(); },
  'su-notif': (el) => { const n = state.settings.notif[el.dataset.k]; n.on = !n.on; save(); rerender(); },
  'su-time': async (el) => {
    const n = state.settings.notif[el.dataset.k];
    const v = await pickTime(n.time);
    if (v) { n.time = v; save(); rerender(); }
  },
  'su-prayers': () => { state.settings.notif.prayers = !state.settings.notif.prayers; save(); rerender(); },
  'su-overlay': async () => {
    const s = state.settings;
    if (s.overlay) { s.overlay = false; save(); rerender(); return; }
    if (await overlayGranted()) { s.overlay = true; save(); rerender(); return; }
    toast('فعّل «الظهور فوق التطبيقات» لسكينة ثم ارجع', 'bubble');
    state.app.overlayPending = true;
    save();
    await openOverlaySettings();
  },
  'su-plan': (el) => { khatmaPlan = +el.dataset.p; rerender(); },
};

/** لإعادة التخصيص من الإعدادات */
export const restart = () => { step = 0; khatmaPlan = 0; };
