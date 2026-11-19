// المساجد القريبة من بيانات OpenStreetMap المجانية (خدمة Overpass)، بلا مفتاح خرائط

// خوادم Overpass بالترتيب: إن تعذّر أحدها جُرّب التالي
export const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
export const RADII = [1000, 2000, 5000];

const rad = (d) => (d * Math.PI) / 180;

/** المسافة بالمتر بين نقطتين (صيغة هافرساين) */
export function distanceM(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** الاتجاه من الشمال باتجاه عقارب الساعة (٠–٣٦٠) */
export function bearing(a, b) {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const DIRS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
export const directionName = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** أقصى عدد عناصر يطلبه الاستعلام؛ بلوغه يعني أن النتائج قد تكون جزئية */
export const QUERY_LIMIT = 200;

/** استعلام Overpass: أماكن العبادة الإسلامية ومباني المساجد ضمن نصف قطر */
export function buildQuery(lat, lng, radius) {
  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:10];(nwr["amenity"="place_of_worship"]["religion"="muslim"]${around};nwr["building"="mosque"]${around};);out center tags ${QUERY_LIMIT};`;
}

/** اسم مطبّع للمقارنة فقط: بلا تشكيل، وبتوحيد الألف والياء والتاء المربوطة، ودون كلمتي «مسجد/جامع» */
export function normName(name) {
  return String(name || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^0-9a-z\u00C0-\u024F\u0621-\u064A\u0660-\u0669\u06A9\u06AF\u06CC]+/g, ' ')
    .replace(/(^| )(ال)?(مسجد|جامع|mosque|masjid|masjed|jami|cami)(?= |$)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

const hasArabic = (t) => /[؀-ۿ]/.test(t);

/** هل العنصران المسجد نفسه؟ يُقارن دائماً بالعنصر الممثل كي لا يتسع الدمج تدريجياً */
export function sameMosque(a, b) {
  if (a.id && a.id === b.id) return true;
  const na = normName(a.name);
  const nb = normName(b.name);
  if (na && nb && na !== nb) return false; // اسمان متعارضان: مسجدان مختلفان مهما تقاربا
  const d = distanceM(a, b);
  if (d <= 1) return true;
  if (na && nb) return d <= 25; // نقطة ومبنى بالاسم نفسه
  return d <= 10; // أحدهما بلا اسم: حدّ محافظ
}

/**
 * إزالة التكرار وإعادة حساب المسافة والاتجاه من الموقع المعطى، مرتبة بالمسافة.
 * تُستخدم لنتائج الشبكة وللنتائج المحفوظة القديمة معاً.
 */
export function dedupeMosques(items, from) {
  const reps = [];
  for (const m of items || []) {
    if (!m || !Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
    const name = typeof m.name === 'string' ? m.name.trim() : '';
    const it = { id: typeof m.id === 'string' ? m.id : '', name, lat: m.lat, lng: m.lng };
    const rep = reps.find((r) => sameMosque(r, it));
    if (!rep) { reps.push(it); continue; }
    // الممثل ثابت (الأول)، ويأخذ الاسم الأفضل: العربي، ثم أي اسم
    if (!rep.name || (!hasArabic(rep.name) && hasArabic(name))) rep.name = name;
  }
  return reps.map((m) => ({ ...m, dist: Math.round(distanceM(from, m)), dir: bearing(from, m) }))
    .sort((a, b) => a.dist - b.dist || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** تحويل استجابة Overpass إلى قائمة مرتبة بالمسافة، بلا تكرار */
export function parseResults(json, from) {
  const raw = [];
  for (const e of (json && json.elements) || []) {
    const lat = e.lat != null ? e.lat : e.center && e.center.lat;
    const lng = e.lon != null ? e.lon : e.center && e.center.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const t = e.tags || {};
    raw.push({ id: `${e.type}/${e.id}`, name: String(t['name:ar'] || t.name || '').trim(), lat, lng });
  }
  return dedupeMosques(raw, from);
}

/** رابط مسار مشياً من الموقع الحالي إلى المسجد في خرائط جوجل */
export const routeUrl = (m) => `https://www.google.com/maps/dir/?api=1&destination=${m.lat.toFixed(6)},${m.lng.toFixed(6)}&travelmode=walking`;
/** بحث احتياطي عن «مسجد» حول موقع في خرائط جوجل */
export const googleSearchUrl = (p) => `https://www.google.com/maps/search/${encodeURIComponent('مسجد')}/@${p.lat.toFixed(5)},${p.lng.toFixed(5)},15z`;

/** خطأ إلغاء: لا يُعرض للمستخدم كفشل */
export const isAbort = (e) => !!e && (e.name === 'AbortError' || e.message === 'aborted');
const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };

/**
 * يجرّب خوادم Overpass بالتتابع ضمن ميزانية زمنية كلية، ويوقف كل طلب فعلياً عند المهلة أو الإلغاء.
 * يعيد { items, limited } — limited: بلغ الاستعلام حدّه فقد لا تكون كل المساجد.
 */
export async function fetchMosques(from, radius, opts = {}) {
  const { fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null), signal, timeoutMs = 7000, budgetMs = 18000 } = opts;
  if (!fetchImpl) throw new Error('offline');
  const q = encodeURIComponent(buildQuery(from.lat, from.lng, radius));
  const deadline = Date.now() + budgetMs;
  let lastErr;
  for (const url of OVERPASS) {
    if (signal && signal.aborted) throw abortErr();
    const left = deadline - Date.now();
    if (left < 500) break;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    let onAbort;
    try {
      const json = await new Promise((resolve, reject) => {
        timer = setTimeout(() => { if (ctrl) ctrl.abort(); reject(new Error('timeout')); }, Math.min(timeoutMs, left));
        if (signal) {
          onAbort = () => { if (ctrl) ctrl.abort(); reject(abortErr()); };
          signal.addEventListener('abort', onAbort);
        }
        Promise.resolve(fetchImpl(`${url}?data=${q}`, ctrl ? { signal: ctrl.signal } : undefined))
          .then((r) => (r && r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r ? r.status : 0}`))))
          .then(resolve, reject);
      });
      if (!json || typeof json !== 'object' || !Array.isArray(json.elements)) throw new Error('bad-response');
      // remark: الخادم قطع الاستعلام (مهلة أو ذاكرة)؛ ليست «لا مساجد»
      if (typeof json.remark === 'string' && /error|timed out|runtime/i.test(json.remark)) throw new Error('remark');
      return { items: parseResults(json, from), limited: json.elements.length >= QUERY_LIMIT };
    } catch (e) {
      if (isAbort(e) || (signal && signal.aborted)) throw abortErr();
      lastErr = e;
    } finally {
      clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr || new Error('timeout');
}
