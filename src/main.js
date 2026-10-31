import { state, flush, today } from './store.js';
import { applyTheme, hasSheet, closeSheet, closeAllSheets, toast } from './ui.js';
import { setDigits } from './text.js';
import { icon } from './icons.js';
import { App, isNative, onNotificationTap, onDeepLink, overlayGranted } from './native.js';
import { rescheduleNotifications } from './services.js';
import { state as appState, hadData, save } from './store.js';
import { checkForUpdate, updateAvailable } from './updates.js';
import { VERSION } from './version.js';
import * as home from './views/home.js';
import * as library from './views/library.js';
import * as reader from './views/reader.js';
import * as tasbih from './views/tasbih.js';
import * as journal from './views/journal.js';
import * as settings from './views/settings.js';
import * as qibla from './views/qibla.js';
import * as names from './views/names.js';
import * as quran from './views/quran.js';
import * as mushaf from './views/mushaf.js';
import * as more from './views/more.js';
import * as reminders from './views/reminders.js';
import * as zakat from './views/zakat.js';
import * as group from './views/group.js';
import * as setup from './views/setup.js';
import { actions as commonActions } from './views/common.js';
import { actions as dhikrActions } from './views/dhikr.js';

const TABS = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'quran', label: 'القرآن', icon: 'quran' },
  { id: 'library', label: 'الأذكار', icon: 'book' },
  { id: 'tasbih', label: 'المسبحة', icon: 'beads' },
  { id: 'more', label: 'المزيد', icon: 'grid' },
];
const ROUTES = { setup, home, quran, mushaf, group, library, read: reader, tasbih, more, journal, reminders, settings, qibla, names, zakat, whatsnew: more.whatsnew };
const ACTIONS = Object.assign({}, commonActions, dhikrActions, ...Object.values(ROUTES).map((v) => v.actions || {}));
const TAB_IDS = TABS.map((t) => t.id);

const root = document.getElementById('app');
root.innerHTML = `<main id="view" class="view"></main>
  <nav class="tabbar" aria-label="التبويبات">${TABS.map((t) => `
    <a href="#/${t.id}" class="tab" data-tab="${t.id}">
      <span class="tab-ic">${icon(t.icon)}</span><span class="tab-label">${t.label}</span>
    </a>`).join('')}</nav>`;
const viewEl = document.getElementById('view');

let current = null;
let currentKey = '';

function parse() {
  const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES[name] ? name : 'home', param: param ? decodeURIComponent(param) : '' };
}

export function render(keepScroll = false) {
  const { name, param } = parse();
  const view = ROUTES[name];
  const key = `${name}/${param}`;
  const same = key === currentKey;
  if (!same && !keepScroll) closeAllSheets();
  const y = window.scrollY;
  if (current && current.unmount) current.unmount();
  current = view;
  currentKey = key;
  today();
  viewEl.innerHTML = view.render(param);
  viewEl.className = `view ${view.full ? 'is-full' : ''} ${same ? '' : 'enter'}`;
  document.body.classList.toggle('no-tabbar', !!view.full);
  const tab = view.tab || name;
  root.querySelectorAll('.tab').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === tab);
    if (a.dataset.tab === 'more') a.classList.toggle('badge', updateAvailable());
  });
  if (view.mount) view.mount(viewEl, param);
  window.scrollTo(0, same || keepScroll ? y : 0);
}

window.addEventListener('hashchange', () => render());
document.addEventListener('app:refresh', () => render(true));
document.addEventListener('app:theme', () => { applyTheme(); setDigits(state.settings.digits); render(true); });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// زر الرجوع في أندرويد: يغلق اللوح المفتوح، ثم يرجع للصفحة السابقة، ثم للرئيسية، ثم يخرج
if (isNative) {
  App.addListener('backButton', () => {
    if (hasSheet()) { closeSheet(); return; }
    const { name } = parse();
    if (current && current.full) { if (history.length > 1) history.back(); else location.hash = '#/home'; return; }
    if (name !== 'home') { location.hash = '#/home'; return; }
    App.exitApp();
  });
  App.addListener('resume', async () => {
    // العودة من صفحة إذن الفقاعة: تُفعَّل تلقائياً إن مُنح الإذن
    if (appState.app.overlayPending) {
      appState.app.overlayPending = false;
      if (await overlayGranted()) { appState.settings.overlay = true; toast('تم تفعيل الفقاعة العائمة', 'bubble'); }
      save();
    }
    render(true);
    rescheduleNotifications();
  });
  App.addListener('pause', flush);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); else render(true); });
window.addEventListener('pagehide', flush);

applyTheme();
setDigits(state.settings.digits);
if (!location.hash) history.replaceState(null, '', '#/home');
render();
rescheduleNotifications();
onNotificationTap((route) => { location.hash = route; });
onDeepLink((route) => { location.hash = route; });

// أول تشغيل: شاشة ترحيب لتحديد الموقع؛ وبعد كل تحديث: «ما الجديد» مرة واحدة
if (!hadData && !appState.app.welcomed) {
  // تثبيت جديد: شاشة التخصيص الأولي، ولا تظهر «ما الجديد»
  appState.app.lastSeenVersion = VERSION;
  save();
  location.hash = '#/setup';
} else {
  if (!appState.app.welcomed) { appState.app.welcomed = true; save(); }
  setTimeout(() => more.maybeShowWhatsNew(true), 700);
}
// التحقق من التحديثات مرة يومياً في الخلفية
setTimeout(() => checkForUpdate(false).then((r) => {
  if (r !== 'update') return;
  render(true);
  if (!hasSheet()) more.showUpdateSheet();
}), 3000);

if (!isNative && 'serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
