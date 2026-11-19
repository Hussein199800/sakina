// حالة التطبيق محفوظة في localStorage: الإعدادات، تقدّم اليوم، المفضلة، الأذكار الخاصة، المسبحة، السجل
import { dateKey } from './dates.js';
import { sanitizeBook } from './zakatlog.js';
import { dedupeMosques } from './mosques.js';

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

// مفاتيح قد تلوّث النماذج الأولية للكائنات عند دمج بيانات مستوردة
const BAD_KEYS = { __proto__: 1, constructor: 1, prototype: 1 };
const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** نسخة عميقة مستقلة لقيمة JSON (بديل structuredClone المتوافق مع WebView أندرويد ٨) */
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** حالة افتراضية جديدة مستقلة تماماً عن DEFAULTS: تعديلها لا يغيّر الافتراضيات */
export const createDefaultState = () => clone(DEFAULTS);

/**
 * دمج المحفوظ فوق الافتراضي دون مشاركة أي مرجع مع أيٍّ منهما.
 * إن كان الافتراضي كائناً والمحفوظ ليس كائناً (null، رقم، مصفوفة) يُعتمد الافتراضي.
 */
function merge(base, saved) {
  if (plain(base)) {
    const out = clone(base);
    if (!plain(saved)) return out;
    for (const k of Object.keys(saved)) {
      if (BAD_KEYS[k]) continue;
      out[k] = k in base ? merge(base[k], saved[k]) : clone(saved[k]);
    }
    return out;
  }
  return saved === undefined ? clone(base) : clone(saved);
}

/** هل كانت هناك بيانات محفوظة قبل هذا التشغيل (مستخدم قديم وليس تثبيتاً جديداً) */
export let hadData = false;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    hadData = !!raw;
    const data = raw ? JSON.parse(raw) : {};
    return sanitize(merge(DEFAULTS, data));
  } catch (e) {
    // بيانات تالفة لا يمكن إصلاحها: تُحفظ نسختها الخام جانباً (لا تُحذف) ويعمل التطبيق بحالة نظيفة
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(`${KEY}.corrupt`, raw); } catch (err) { /* تجاهل */ }
    return sanitize(createDefaultState());
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const clampNum = (v, lo, hi, def) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : def);
const oneOf = (v, list, def) => (list.indexOf(v) !== -1 ? v : def);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// كل معرّف داخلي يُقبل بهذا النمط فقط: لا مسافات ولا علامات HTML ولا اقتباسات
export const SAFE_ID = /^[A-Za-z0-9_:-]{1,64}$/;
const safeId = (v) => typeof v === 'string' && SAFE_ID.test(v);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
/** يبقي أول عنصر لكل معرّف ويحذف المكرر */
const uniqBy = (list, key) => { const seen = {}; return list.filter((x) => { const k = key(x); if (seen[k]) return false; seen[k] = 1; return true; }); };

/** تصحيح القيم التالفة أو القديمة حتى لا تتعطل الواجهة (بيانات مستوردة أو من إصدار سابق) */
export function sanitize(st) {
  const d = DEFAULTS;
  // الفروع الأساسية يجب أن تكون كائنات، وإلا تُستبدل بالافتراضي قبل قراءة أي حقل منها
  for (const k of ['settings', 'quran', 'app', 'progress', 'tasbih', 'history']) if (!isObj(st[k])) st[k] = clone(d[k]);
  if (!isObj(st.settings.notif)) st.settings.notif = clone(d.settings.notif);
  st.schema = 2; // إصدار بنية البيانات في النسخ الاحتياطية الجديدة؛ النسخ القديمة بلا هذا الحقل مقبولة
  const ap = st.app;
  ap.lastSeenVersion = str(ap.lastSeenVersion, 20);
  for (const key of ['welcomed', 'autoUpdate', 'overlayPending']) ap[key] = !!ap[key];
  ap.lastUpdateCheck = Number.isFinite(ap.lastUpdateCheck) ? ap.lastUpdateCheck : 0;
  if (ap.latest !== null && !(isObj(ap.latest) && Number.isInteger(ap.latest.code) && typeof ap.latest.name === 'string' && Array.isArray(ap.latest.notes))) ap.latest = null;
  else if (ap.latest) ap.latest = { code: ap.latest.code, name: str(ap.latest.name, 20), url: str(ap.latest.url, 300), apk: str(ap.latest.apk, 300), notes: ap.latest.notes.filter((x) => typeof x === 'string').map((x) => x.slice(0, 300)).slice(0, 20) };
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
  const L = s.location;
  const gpsOk = isObj(L) && L.type === 'gps' && Number.isFinite(L.lat) && Number.isFinite(L.lng) && Math.abs(L.lat) <= 90 && Math.abs(L.lng) <= 180;
  const cityOk = isObj(L) && L.type === 'city' && Number.isInteger(L.cityId) && L.cityId >= 0 && L.cityId < 1000;
  if (gpsOk) s.location = { type: 'gps', lat: L.lat, lng: L.lng, tz: str(L.tz, 64), method: str(L.method, 20), name: str(L.name, 80) };
  else if (cityOk) s.location = { type: 'city', cityId: L.cityId };
  else s.location = { ...d.settings.location };
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
  st.loved = Array.isArray(st.loved) ? uniqBy(st.loved.filter((p) => isObj(p) && safeId(p.id) && typeof p.name === 'string' && p.name.trim()), (p) => p.id).map((p) => ({
    id: p.id, name: p.name.slice(0, 120), form: oneOf(p.form, ['m', 'f', 'p'], 'm'),
    duas: Array.isArray(p.duas) ? uniqBy(p.duas.filter((d) => isObj(d) && typeof d.t === 'string' && d.t.trim() && safeId(d.id)), (d) => d.id).map((d) => ({ id: d.id, t: d.t.slice(0, 2000) })) : [],
    count: Math.max(0, Math.floor(clampNum(p.count, 0, 1e7, 0))), last: DATE.test(p.last) ? p.last : '',
  })) : [];
  if (st.cardDraft !== undefined && st.cardDraft !== null && !isObj(st.cardDraft)) st.cardDraft = null;
  st.cardDesigns = Array.isArray(st.cardDesigns) ? uniqBy(st.cardDesigns.filter((d) => isObj(d) && safeId(d.id) && isObj(d.spec)), (d) => d.id).slice(0, 30).map((d) => ({ id: d.id, at: Number.isFinite(d.at) ? d.at : 0, title: str(d.title, 140), spec: d.spec })) : [];
  // سجل الزكاة والصدقات (الحسابات والمستحقون والتسليم)
  if (st.zakatBook !== undefined && st.zakatBook !== null) st.zakatBook = sanitizeBook(st.zakatBook);
  if (st.mywird !== undefined && !Array.isArray(st.mywird)) st.mywird = [];
  if (Array.isArray(st.mywird)) st.mywird = uniqBy(st.mywird.filter((w) => isObj(w) && safeId(w.id)), (w) => w.id).map((w) => ({ id: w.id, n: Math.round(clampNum(w.n, 1, 10000, 1)) }));
  for (const k of ['favorites', 'custom', 'reminders']) if (!Array.isArray(st[k])) st[k] = [];
  // الختمة الجماعية: مجموعات صالحة فقط، وأعضاء بأسماء وأجزاء ضمن ١–٣٠
  st.groups = Array.isArray(st.groups) ? uniqBy(st.groups.filter((g) => isObj(g) && safeId(g.id) && typeof g.name === 'string' && Array.isArray(g.members)), (g) => g.id).map((g) => ({
    id: g.id, name: g.name.slice(0, 120), created: Number.isFinite(g.created) ? g.created : 0,
    members: g.members.filter((m) => isObj(m) && typeof m.name === 'string' && Number.isInteger(m.from) && Number.isInteger(m.to) && m.from >= 1 && m.to <= 30 && m.from <= m.to)
      .map((m) => ({ name: m.name.slice(0, 120), from: m.from, to: m.to, done: !!m.done })),
  })) : [];
  st.favorites = uniqBy(st.favorites.filter(safeId), (x) => x);
  st.custom = uniqBy(st.custom.filter((c) => isObj(c) && typeof c.t === 'string' && c.t && safeId(c.id)), (c) => c.id)
    .map((c) => {
      const out = { id: c.id, t: c.t.slice(0, 5000), n: Math.round(clampNum(c.n, 1, 10000, 1)) };
      if (typeof c.note === 'string') out.note = c.note.slice(0, 300);
      if (typeof c.s === 'string') out.s = c.s.slice(0, 120);
      return out;
    });
  st.reminders = uniqBy(st.reminders.filter((r) => isObj(r) && safeId(r.id) && typeof r.kind === 'string' && /^[a-z]{2,20}$/.test(r.kind)), (r) => r.id).map((r) => ({
    id: r.id, kind: r.kind, on: !!r.on, time: TIME.test(r.time) ? r.time : '20:00', mode: oneOf(r.mode, ['eve', 'day'], 'day'),
    title: str(r.title, 120), body: str(r.body, 300), repeat: oneOf(r.repeat, ['daily', 'weekly', 'once'], 'daily'), date: DATE.test(r.date) ? r.date : '',
    days: Array.isArray(r.days) ? r.days.filter((x, i, a) => Number.isInteger(x) && x >= 0 && x <= 6 && a.indexOf(x) === i) : [],
  }));
  if (!isObj(st.progress) || !isObj(st.progress.counts)) st.progress = { date: '', counts: {} };
  for (const id of Object.keys(st.progress.counts)) if (!safeId(id) || !Number.isFinite(st.progress.counts[id]) || st.progress.counts[id] < 0) delete st.progress.counts[id];
  if (!isObj(st.history)) st.history = {};
  for (const day of Object.keys(st.history)) if (!DATE.test(day) || !isObj(st.history[day])) delete st.history[day];
  const tb = st.tasbih;
  tb.target = oneOf(+tb.target, [33, 100, 1000, 0], 33);
  for (const k of ['count', 'rounds', 'total']) tb[k] = Math.max(0, Math.floor(clampNum(tb[k], 0, 1e9, 0)));
  const q = st.quran;
  q.lastPage = Math.round(clampNum(q.lastPage, 0, 604, 0));
  q.fontSize = clampNum(q.fontSize, 20, 44, d.quran.fontSize);
  q.bookmarks = Array.isArray(q.bookmarks) ? q.bookmarks.filter((i) => Number.isInteger(i) && i >= 0 && i < 6236) : [];
  const k = st.khatma;
  if (k !== undefined && k !== null && !(isObj(k) && Number.isInteger(k.page) && k.page >= 1 && k.page <= 604 && Number.isFinite(k.perDay) && k.perDay >= 1)) st.khatma = null;
  else if (k) { if (!isObj(k.log)) k.log = {}; for (const day of Object.keys(k.log)) if (!DATE.test(day) || !Number.isFinite(k.log[day])) delete k.log[day]; if (!TIME.test(k.time)) k.time = '20:00'; k.startPage = Math.round(clampNum(k.startPage, 1, k.page, 1)); }
  st.khatmaDone = Math.max(0, Math.floor(clampNum(st.khatmaDone, 0, 1e6, 0)));
  // نتائج المساجد المحفوظة: تُحذف إن كانت تالفة
  const m = st.mosques;
  if (m !== undefined && m !== null && !(isObj(m) && Number.isFinite(m.lat) && Number.isFinite(m.lng) && Number.isFinite(m.radius) && Array.isArray(m.items))) st.mosques = null;
  else if (m) {
    // المحفوظات القديمة قد تحوي تكراراً من التقريب السابق: تُزال بالقاعدة نفسها وتُعاد المسافة من موقع البحث
    st.mosques = { at: Number.isFinite(m.at) ? m.at : 0, lat: m.lat, lng: m.lng, radius: m.radius, limited: !!m.limited,
      items: dedupeMosques(m.items.filter((x) => isObj(x) && Number.isFinite(x.lat) && Number.isFinite(x.lng)).map((x) => ({ id: str(x.id, 40), name: str(x.name, 200), lat: x.lat, lng: x.lng })), m).slice(0, 60) };
  }
  return st;
}

export const state = load();

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

/** استبدال الحالة كلها بنسخة مستوردة بعد التحقق منها؛ يرمي خطأً ولا يمسّ الحالة الحالية إن كانت غير صالحة */
export function replaceAll(data) {
  if (!plain(data) || !plain(data.settings)) throw new Error('invalid-backup');
  const next = sanitize(merge(DEFAULTS, data));
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
  flush();
}

export function clearAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* تجاهل */ }
  replaceAll({ settings: {} });
}
