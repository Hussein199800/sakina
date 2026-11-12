// حالة التطبيق محفوظة في localStorage: الإعدادات، تقدّم اليوم، المفضلة، الأذكار الخاصة، المسبحة، السجل
import { dateKey } from './dates.js';
import { sanitizeBook } from './zakatlog.js';

const KEY = 'sakina.v1';

export const DEFAULTS = {
  settings: {
    theme: 'oasis',
    fontSize: 25,
    tashkeel: true,
    autoAdvance: true,
    sound: true,
    haptic: true,
    digits: 'arab',
    readMode: 'focus',
    location: { type: 'city', cityId: 0 },
    method: 'auto',
    asr: 'shafi',
    hijriAdjust: 0,
    notif: {
      morning: { on: false, time: '06:30' },
      evening: { on: false, time: '17:00' },
      sleep: { on: false, time: '22:30' },
      prayers: false,
    },
    // الفقاعة العائمة فوق التطبيقات عند تذكير الأذكار
    overlay: false,
    // اتباع وضع الهاتف: الواحة الهادئة نهاراً والسكينة الليلية في الوضع الداكن
    followSystem: false,
    // خط الواجهة وخط النصوص وحجم خط التطبيق كله
    uiFont: 'plex',
    textFont: 'amiri',
    uiScale: 1,
    // مدد تأجيل الفقاعة بالدقائق
    snooze: [5, 15, 30, 60],
    // ساعات الهدوء: لا تظهر فيها الفقاعة ولا التذكيرات المخصّصة (تبقى تنبيهات الصلاة)
    quiet: { on: false, from: '23:00', to: '05:00' },
    // تخصيص الرئيسية: ترتيب البطاقات والمخفي منها والاختصارات
    home: null,
  },
  quran: { lastPage: 0, fontSize: 27, bookmarks: [] },
  // الختمة: page = الصفحة التالية للقراءة، log = الصفحات المقروءة لكل يوم
  khatma: null,
  khatmaDone: 0,
  // تذكيرات المستخدم المخصّصة
  reminders: [],
  app: { lastSeenVersion: '', welcomed: false, autoUpdate: true, lastUpdateCheck: 0, latest: null },
  progress: { date: '', counts: {} },
  favorites: [],
  custom: [],
  // «وردي الخاص»: أذكار يختارها المستخدم من المكتبة بعدد يحدده [{id, n}]
  mywird: [],
  tasbih: { selected: 'subhan', target: 33, count: 0, rounds: 0, total: 0 },
  history: {},
};

function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(base)) return saved === undefined ? base : saved;
  const out = { ...base };
  for (const k of Object.keys(saved)) {
    out[k] = base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], saved[k]) : saved[k];
  }
  return out;
}

/** هل كانت هناك بيانات محفوظة قبل هذا التشغيل (مستخدم قديم وليس تثبيتاً جديداً) */
export let hadData = false;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    hadData = !!raw;
    return merge(DEFAULTS, raw ? JSON.parse(raw) : {});
  } catch (e) {
    return merge(DEFAULTS, {});
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clampNum = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : def);
const oneOf = (v, list, def) => (list.indexOf(v) !== -1 ? v : def);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** تصحيح القيم التالفة أو القديمة حتى لا تتعطل الواجهة (بيانات مستوردة أو من إصدار سابق) */
export function sanitize(st) {
  const d = DEFAULTS;
  const s = st.settings;
  s.theme = oneOf(s.theme, ['oasis', 'midnight', 'dawn', 'royal', 'beige', 'olive', 'ocean', 'abyss'], d.settings.theme);
  s.uiFont = oneOf(s.uiFont, ['plex', 'cairo', 'tajawal', 'almarai', 'kufi', 'readex'], 'plex');
  s.textFont = oneOf(s.textFont, ['amiri', 'scheherazade', 'naskh', 'lateef', 'ruqaa'], 'amiri');
  s.uiScale = oneOf(+s.uiScale, [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.4], 1);
  s.fontSize = clampNum(s.fontSize, 18, 44, d.settings.fontSize);
  s.digits = oneOf(s.digits, ['arab', 'latn'], 'arab');
  s.readMode = oneOf(s.readMode, ['focus', 'list'], 'focus');
  s.asr = oneOf(s.asr, ['shafi', 'hanafi'], 'shafi');
  s.hijriAdjust = Math.round(clampNum(s.hijriAdjust, -2, 2, 0));
  for (const k of ['tashkeel', 'autoAdvance', 'sound', 'haptic', 'followSystem']) s[k] = typeof s[k] === 'boolean' ? s[k] : d.settings[k];
  if (!isObj(s.location) || (s.location.type === 'gps' ? !(Number.isFinite(s.location.lat) && Number.isFinite(s.location.lng)) : !Number.isInteger(s.location.cityId))) s.location = { ...d.settings.location };
  for (const k of ['morning', 'evening', 'sleep']) {
    if (!isObj(s.notif[k])) s.notif[k] = { ...d.settings.notif[k] };
    s.notif[k].on = !!s.notif[k].on;
    if (!TIME.test(s.notif[k].time)) s.notif[k].time = d.settings.notif[k].time;
  }
  s.notif.prayers = !!s.notif.prayers;
  s.overlay = !!s.overlay;
  s.snooze = Array.isArray(s.snooze) ? [...new Set(s.snooze.map((m) => Math.round(+m)).filter((m) => m >= 1 && m <= 720))].sort((a, b) => a - b).slice(0, 6) : [];
  if (!s.snooze.length) s.snooze = d.settings.snooze.slice();
  if (!isObj(s.quiet)) s.quiet = { ...d.settings.quiet };
  s.quiet = { on: !!s.quiet.on, from: TIME.test(s.quiet.from) ? s.quiet.from : '23:00', to: TIME.test(s.quiet.to) ? s.quiet.to : '05:00' };
  if (s.home !== null && !(isObj(s.home) && Array.isArray(s.home.order) && Array.isArray(s.home.hidden) && Array.isArray(s.home.shortcuts))) s.home = null;
  else if (s.home) for (const k of ['order', 'hidden', 'shortcuts']) s.home[k] = s.home[k].filter((x) => typeof x === 'string');
  delete s.adhanVoice; // أُلغيت ميزة صوت الأذان في الإصدار ١٫٣
  // حاسبة قيام الليل: إدخال يدوي اختياري
  if (st.qiyam !== undefined && st.qiyam !== null && !(isObj(st.qiyam) && TIME.test(st.qiyam.maghrib) && TIME.test(st.qiyam.fajr))) st.qiyam = null;
  else if (st.qiyam) st.qiyam.manual = !!st.qiyam.manual;
  // «لمن تحب»: دعواتي الخاصة، ومسودة بطاقة الدعاء، والتصاميم المحفوظة (كلها على الجهاز فقط)
  st.loved = Array.isArray(st.loved) ? st.loved.filter((p) => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim()).map((p) => ({
    id: p.id, name: p.name.slice(0, 120), form: oneOf(p.form, ['m', 'f', 'p'], 'm'),
    duas: Array.isArray(p.duas) ? p.duas.filter((d) => isObj(d) && typeof d.t === 'string' && d.t.trim() && typeof d.id === 'string').map((d) => ({ id: d.id, t: d.t.slice(0, 2000) })) : [],
    count: Math.max(0, Math.floor(clampNum(p.count, 0, 1e7, 0))), last: typeof p.last === 'string' ? p.last : '',
  })) : [];
  if (st.cardDraft !== undefined && st.cardDraft !== null && !isObj(st.cardDraft)) st.cardDraft = null;
  st.cardDesigns = Array.isArray(st.cardDesigns) ? st.cardDesigns.filter((d) => isObj(d) && typeof d.id === 'string' && isObj(d.spec)).slice(0, 30) : [];
  // سجل الزكاة والصدقات (الحسابات والمستحقون والتسليم)
  if (st.zakatBook !== undefined && st.zakatBook !== null) st.zakatBook = sanitizeBook(st.zakatBook);
  if (st.mywird !== undefined && !Array.isArray(st.mywird)) st.mywird = [];
  if (Array.isArray(st.mywird)) st.mywird = st.mywird.filter((w) => isObj(w) && typeof w.id === 'string').map((w) => ({ id: w.id, n: Math.round(clampNum(w.n, 1, 10000, 1)) }));
  for (const k of ['favorites', 'custom', 'reminders']) if (!Array.isArray(st[k])) st[k] = [];
  if (st.groups !== undefined && !Array.isArray(st.groups)) st.groups = [];
  st.favorites = st.favorites.filter((x) => typeof x === 'string');
  st.custom = st.custom.filter((c) => isObj(c) && typeof c.t === 'string' && c.t && typeof c.id === 'string').map((c) => ({ ...c, n: Math.round(clampNum(c.n, 1, 10000, 1)) }));
  st.reminders = st.reminders.filter((r) => isObj(r) && typeof r.id === 'string' && typeof r.kind === 'string').map((r) => ({ ...r, time: TIME.test(r.time) ? r.time : '20:00', days: Array.isArray(r.days) ? r.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6) : [] }));
  if (!isObj(st.progress) || !isObj(st.progress.counts)) st.progress = { date: '', counts: {} };
  if (!isObj(st.history)) st.history = {};
  const tb = st.tasbih;
  tb.target = oneOf(+tb.target, [33, 100, 1000, 0], 33);
  for (const k of ['count', 'rounds', 'total']) tb[k] = Math.max(0, Math.floor(clampNum(tb[k], 0, 1e9, 0)));
  const q = st.quran;
  q.lastPage = Math.round(clampNum(q.lastPage, 0, 604, 0));
  q.fontSize = clampNum(q.fontSize, 20, 44, d.quran.fontSize);
  q.bookmarks = Array.isArray(q.bookmarks) ? q.bookmarks.filter((i) => Number.isInteger(i) && i >= 0 && i < 6236) : [];
  const k = st.khatma;
  if (k !== null && !(isObj(k) && Number.isInteger(k.page) && k.page >= 1 && k.page <= 604 && Number.isFinite(k.perDay) && k.perDay >= 1)) st.khatma = null;
  else if (k) { if (!isObj(k.log)) k.log = {}; if (!TIME.test(k.time)) k.time = '20:00'; k.startPage = Math.round(clampNum(k.startPage, 1, k.page, 1)); }
  st.khatmaDone = Math.max(0, Math.floor(clampNum(st.khatmaDone, 0, 1e6, 0)));
  // نتائج المساجد المحفوظة: تُحذف إن كانت تالفة
  const m = st.mosques;
  if (m !== undefined && m !== null && !(isObj(m) && Number.isFinite(m.lat) && Number.isFinite(m.lng) && Number.isFinite(m.radius) && Array.isArray(m.items))) st.mosques = null;
  else if (m) m.items = m.items.filter((x) => isObj(x) && Number.isFinite(x.lat) && Number.isFinite(x.lng) && Number.isFinite(x.dist) && Number.isFinite(x.dir)).map((x) => ({ ...x, name: typeof x.name === 'string' ? x.name : '' }));
  return st;
}

export const state = sanitize(load());

// ترحيل بيانات الإصدار ١٫٠: تذكير الجمعة صار ضمن التذكيرات المخصّصة
if (state.settings.notif.friday) {
  delete state.settings.notif.friday;
  if (!state.reminders.some((r) => r.kind === 'kahf')) state.reminders.push({ id: 'r-kahf', kind: 'kahf', on: true, time: '10:00', mode: 'day' });
}

let timer;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 250);
}
export function flush() {
  clearTimeout(timer);
  try {
    localStorage.setItem(KEY, serialize());
    saveFailed = false;
  } catch (e) {
    // التخزين ممتلئ أو محجوب: يُنبَّه المستخدم مرة واحدة بدل ضياع التغييرات بصمت
    if (!saveFailed && typeof document !== 'undefined') document.dispatchEvent(new Event('app:save-failed'));
    saveFailed = true;
  }
}
let saveFailed = false;
/** نص الحفظ والنسخة الاحتياطية: صورة خلفية بطاقة الدعاء تبقى في الذاكرة فقط لأنها كبيرة */
export const serialize = (space) => JSON.stringify(state, (k, v) => (k === 'bgImage' ? '' : v), space);

/** تقدّم اليوم يُصفَّر تلقائياً مع بداية يوم جديد */
export function today() {
  const k = dateKey();
  if (state.progress.date !== k) state.progress = { date: k, counts: {} };
  if (!state.history[k]) state.history[k] = { m: 0, e: 0, p: 0, r: 0, t: 0, pr: [0, 0, 0, 0, 0] };
  return state.history[k];
}

export const doneOf = (id) => (today(), state.progress.counts[id] || 0);

export function replaceAll(data) {
  const next = sanitize(merge(DEFAULTS, data));
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
  flush();
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* تجاهل */ }
  replaceAll({});
}
