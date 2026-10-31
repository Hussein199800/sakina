// منطق التطبيق المشترك: الموقع والمواقيت، الفترة الزمنية، التقدّم والعادات، جدولة التنبيهات
import { state, save, today, doneOf } from './store.js';
import { CITIES, DEFAULT_CITY } from './data/cities.js';
import { CATEGORY_BY_ID } from './data/adhkar.js';
import { computeTimes, PRAYERS } from './prayer.js';
import { ymdInTz, toHijri, addDays, dateKey } from './dates.js';
import { scheduleAll, notificationsSupported, scheduleOverlays, overlaySupported } from './native.js';
import { occurrences } from './reminders.js';
import { voiceById } from './data/adhan-voices.js';
import { num, pagesLabel } from './text.js';
import { todayRange } from './khatma.js';

export const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };

export function location() {
  const l = state.settings.location;
  if (l.type === 'gps' && Number.isFinite(l.lat)) return { name: l.name || 'موقعي الحالي', lat: l.lat, lng: l.lng, tz: l.tz || deviceTz(), method: l.method || 'mwl', gps: true };
  const c = CITIES[l.cityId] || DEFAULT_CITY;
  return { name: c.name, country: c.country, lat: c.lat, lng: c.lng, tz: c.tz, method: c.method };
}

export const methodKey = () => (state.settings.method === 'auto' ? location().method : state.settings.method);

export const localToday = (now = new Date()) => ymdInTz(now, location().tz);
export const hijriOf = (g) => toHijri(g, state.settings.hijriAdjust);

export function timesFor(g) {
  const loc = location();
  return computeTimes(g, loc, { method: methodKey(), asr: state.settings.asr, ramadan: hijriOf(g).m === 9 });
}

const FIVE = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** الصلاة القادمة (من الخمس) مع وقتها، والسابقة */
export function nextPrayer(now = new Date()) {
  const g = localToday(now);
  const t = timesFor(g);
  for (const k of FIVE) if (t[k] > now) return { key: k, at: t[k], times: t, tomorrow: false };
  const t2 = timesFor(addDays(g, 1));
  return { key: 'fajr', at: t2.fajr, times: t, tomorrow: true };
}

/** فترة اليوم لتلوين السماء واقتراح الورد */
export function dayPeriod(now = new Date()) {
  const t = timesFor(localToday(now));
  if (now < t.fajr) return 'night';
  if (now < t.sunrise) return 'fajr';
  if (now < t.asr) return 'day';
  if (now < t.maghrib) return 'asr';
  if (now < new Date(t.isha.getTime() + 30 * 60000)) return 'maghrib';
  return 'night';
}

export const GREETINGS = {
  fajr: { title: 'صباح النور والسكينة', sub: 'أشرق يومك بذكر الله' },
  day: { title: 'نهارك مبارك', sub: 'ألا بذكر الله تطمئن القلوب' },
  asr: { title: 'طاب عصرك بذكر الله', sub: 'وقت أذكار المساء قد أقبل' },
  maghrib: { title: 'مساء الخير والسكينة', sub: 'أمسينا وأمسى الملك لله' },
  night: { title: 'ليلة هادئة مطمئنة', sub: 'باسمك ربي وضعت جنبي' },
};

/** الورد المقترح الآن حسب الوقت وما أُنجز */
export function suggestedWird(now = new Date()) {
  const t = timesFor(localToday(now));
  const h = today();
  if (now >= t.fajr && now < t.dhuhr) return 'morning';
  if (now >= t.dhuhr && now < t.asr) return h.m ? 'prayer' : 'morning';
  if (now >= t.asr && now < t.isha) return 'evening';
  if (now >= t.isha) return h.e ? 'sleep' : 'evening';
  return 'sleep';
}

// ---------- التقدّم ----------
export function itemsOf(catId) {
  if (catId === 'custom') return state.custom.map((c) => ({ ...c, cat: 'custom' }));
  if (catId === 'favorites') {
    return state.favorites.map((id) => {
      if (id.startsWith('custom-')) { const c = state.custom.find((x) => x.id === id); return c && { ...c, cat: 'custom' }; }
      const [cat] = id.split('-');
      return CATEGORY_BY_ID[cat] && CATEGORY_BY_ID[cat].items.find((x) => x.id === id);
    }).filter(Boolean);
  }
  return CATEGORY_BY_ID[catId] ? CATEGORY_BY_ID[catId].items : [];
}

export function catProgress(catId) {
  const items = itemsOf(catId);
  if (!items.length) return 0;
  return items.reduce((s, it) => s + Math.min(doneOf(it.id), it.n) / it.n, 0) / items.length;
}

const HABIT_FLAG = { morning: 'm', evening: 'e', prayer: 'p' };

/** تسجيل تكرار واحد لذكر. يعيد {itemDone, catDone} */
export function countOnce(item, catId) {
  const h = today();
  const done = doneOf(item.id);
  if (done >= item.n) return { itemDone: true, catDone: false, already: true };
  state.progress.counts[item.id] = done + 1;
  h.r += 1;
  const itemDone = done + 1 >= item.n;
  let catDone = false;
  if (itemDone) {
    catDone = itemsOf(catId).every((it) => doneOf(it.id) >= it.n);
    // يُحتسب إتمام التصنيف الأصلي للذكر أيضاً (مثلاً عند قراءة أذكار الصباح من المفضلة)
    for (const c of new Set([catId, item.cat])) {
      if (HABIT_FLAG[c] && (c === catId ? catDone : itemsOf(c).every((it) => doneOf(it.id) >= it.n))) h[HABIT_FLAG[c]] = 1;
    }
  }
  save();
  return { itemDone, catDone };
}

export function resetCat(catId) {
  for (const it of itemsOf(catId)) delete state.progress.counts[it.id];
  save();
}

// ---------- العادات ----------
const dayRec = (k) => state.history[k] || { m: 0, e: 0, p: 0, r: 0, t: 0, pr: [0, 0, 0, 0, 0] };
export const lit = (k) => { const r = dayRec(k); return r.m || r.e ? (r.m && r.e ? 2 : 1) : 0; };

// الرجوع يوماً تقويمياً (لا ٢٤ ساعة) حتى لا يُقفز يوم عند تغيّر التوقيت الصيفي
const prevDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);

export function streak(now = new Date()) {
  today();
  let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!lit(dateKey(d))) d = prevDay(d);
  let n = 0;
  while (lit(dateKey(d)) && n < 3650) { n += 1; d = prevDay(d); }
  return n;
}

/** آخر ٧ أيام (الأقدم أولاً) */
export function lastWeek() {
  today();
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
    const k = dateKey(d);
    out.push({ key: k, date: d, rec: dayRec(k), isToday: i === 0 });
  }
  return out;
}

export const palms = () => Object.keys(state.history).filter((k) => lit(k) === 2).length;

// ---------- التنبيهات ----------
const parseTime = (s) => { const [h, m] = s.split(':').map(Number); return { hour: h || 0, minute: m || 0 }; };

// الجدولة متسلسلة: نداءان متزامنان (مثلاً عند العودة للتطبيق مع تغيير إعداد) لا يتداخلان
let scheduling = Promise.resolve();
export function rescheduleNotifications() {
  scheduling = scheduling.then(doReschedule, doReschedule);
  return scheduling;
}

// حدّ أعلى لعدد الإشعارات المجدولة (أندرويد يرفض أكثر من ٥٠٠ منبّه للتطبيق)
export const MAX_SCHEDULED = 300;

export function buildNotifications(now = new Date()) {
  const n = state.settings.notif;
  const list = [];
  if (n.morning.on) list.push({ id: 1, title: 'أذكار الصباح', body: 'أصبحنا وأصبح الملك لله، حان وقت وردك الصباحي', daily: parseTime(n.morning.time), route: '#/read/morning' });
  if (n.evening.on) list.push({ id: 2, title: 'أذكار المساء', body: 'أمسينا وأمسى الملك لله، لا تنسَ أذكار المساء', daily: parseTime(n.evening.time), route: '#/read/evening' });
  if (n.sleep.on) list.push({ id: 3, title: 'أذكار النوم', body: 'باسمك ربي وضعت جنبي، اختم يومك بذكر الله', daily: parseTime(n.sleep.time), route: '#/read/sleep' });
  const k = state.khatma;
  if (k && k.remind) {
    const r = todayRange(k);
    list.push({ id: 5, title: 'وردك من القرآن', body: `${pagesLabel(k.perDay)} اليوم، ابدأ من الصفحة ${num(r.from)}. «اقرؤوا القرآن فإنه يأتي يوم القيامة شفيعاً لأصحابه»`, daily: parseTime(k.time), route: '#/quran' });
  }
  // الصلوات أولاً حتى لا يُسقطها الحدّ الأعلى
  if (n.prayers) {
    const voice = voiceById(state.settings.adhanVoice);
    let g = localToday(now);
    for (let day = 0; day < 6; day++) {
      const t = timesFor(g);
      FIVE.forEach((key, i) => {
        if (t[key] > now) {
          const name = PRAYERS.find((p) => p.key === key).name;
          list.push({ id: 100 + day * 10 + i, title: `حان وقت صلاة ${name}`, body: `حيّ على الصلاة، حيّ على الفلاح — ${location().name}`, at: t[key], route: '#/home', channel: voice ? `adhan_${voice.id}` : '', channelName: voice ? `الأذان بصوت ${voice.name}` : '' });
        }
      });
      g = addDays(g, 1);
    }
  }
  // التذكيرات المخصّصة: مواعيد محددة لثلاثة أسابيع، وتُجدَّد عند كل فتح للتطبيق
  let rid = 1000;
  for (const r of state.reminders) {
    for (const o of occurrences(r, now, 21, state.settings.hijriAdjust).slice(0, 25)) list.push({ id: rid++, title: o.title, body: o.body, at: o.at, route: '#/reminders' });
  }
  return list.slice(0, MAX_SCHEDULED);
}

/**
 * مواعيد الفقاعة العائمة لأسبوع: لأذكار الصباح والمساء والنوم المفعّلة.
 * يُتخطّى موعد اليوم إن كانت الأذكار قد أُتمّت قبله.
 */
const BUBBLES = [
  ['morning', 1, 'أذكار الصباح', 'أصبحنا وأصبح الملك لله'],
  ['evening', 2, 'أذكار المساء', 'أمسينا وأمسى الملك لله'],
  ['sleep', 3, 'أذكار النوم', 'باسمك ربي وضعت جنبي'],
];
export function buildOverlays(now = new Date()) {
  if (!state.settings.overlay) return [];
  const out = [];
  for (const [key, slot, title, body] of BUBBLES) {
    const n = state.settings.notif[key];
    if (!n || !n.on) continue;
    const { hour, minute } = parseTime(n.time);
    for (let d = 0; d < 7; d++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, minute, 0, 0);
      if (at <= now) continue;
      if (d === 0 && catProgress(key) >= 1) continue;
      out.push({ id: 7000 + slot * 10 + d, at, title, body, route: `/read/${key}` });
    }
  }
  return out;
}

async function doReschedule() {
  if (overlaySupported) await scheduleOverlays(buildOverlays());
  if (!notificationsSupported) return;
  try { await scheduleAll(buildNotifications()); } catch (e) { /* تجاهل أخطاء الجدولة */ }
}
