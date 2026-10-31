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

/** استعلام Overpass: أماكن العبادة الإسلامية ومباني المساجد ضمن نصف قطر */
export function buildQuery(lat, lng, radius) {
  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lng.toFixed(5)})`;
  return `[out:json][timeout:25];(nwr["amenity"="place_of_worship"]["religion"="muslim"]${around};nwr["building"="mosque"]${around};);out center tags 200;`;
}

/** تحويل استجابة Overpass إلى قائمة مرتبة بالمسافة، بلا تكرار */
export function parseResults(json, from) {
  const seen = new Set();
  const out = [];
  for (const e of (json && json.elements) || []) {
    const lat = e.lat != null ? e.lat : e.center && e.center.lat;
    const lng = e.lon != null ? e.lon : e.center && e.center.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const t = e.tags || {};
    // مبنى مسجد مرسوم مع نقطة المسجد نفسه: نعدّهما مسجداً واحداً إن تقاربا جداً
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = { lat, lng };
    out.push({
      id: `${e.type}/${e.id}`,
      name: (t['name:ar'] || t.name || '').trim(),
      lat,
      lng,
      dist: Math.round(distanceM(from, p)),
      dir: bearing(from, p),
    });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** رابط مسار مشياً من الموقع الحالي إلى المسجد في خرائط جوجل */
export const routeUrl = (m) => `https://www.google.com/maps/dir/?api=1&destination=${m.lat.toFixed(6)},${m.lng.toFixed(6)}&travelmode=walking`;
/** بحث احتياطي عن «مسجد» حول موقع في خرائط جوجل */
export const googleSearchUrl = (p) => `https://www.google.com/maps/search/${encodeURIComponent('مسجد')}/@${p.lat.toFixed(5)},${p.lng.toFixed(5)},15z`;

/** يجرّب خوادم Overpass بالترتيب حتى ينجح أحدها */
export async function fetchMosques(from, radius, fetchImpl = fetch, ms = 25000) {
  const q = encodeURIComponent(buildQuery(from.lat, from.lng, radius));
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const json = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        fetchImpl(`${url}?data=${q}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((j) => { clearTimeout(timer); resolve(j); }, (e) => { clearTimeout(timer); reject(e); });
      });
      return parseResults(json, from);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('offline');
}

