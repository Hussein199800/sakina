// التحقق من التحديثات: يقرأ version.json المنشور ويقارنه بالإصدار الحالي
import { state, save } from './store.js';
import { VERSION_CODE, UPDATE_URL } from './version.js';

const DAY = 86400000;

function fetchJson(url, ms = 9000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => { clearTimeout(timer); resolve(j); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/**
 * @param {boolean} manual طلب يدوي من المستخدم (يتجاهل مهلة اليوم)
 * @returns {Promise<'update'|'latest'|'offline'|'skipped'>}
 */
export async function checkForUpdate(manual = false) {
  const app = state.app;
  if (!manual && (!app.autoUpdate || Date.now() - app.lastUpdateCheck < DAY)) return 'skipped';
  try {
    const info = await fetchJson(UPDATE_URL);
    app.lastUpdateCheck = Date.now();
    if (info && Number(info.versionCode) > VERSION_CODE) {
      app.latest = { code: Number(info.versionCode), name: String(info.versionName || ''), url: String(info.url || ''), apk: String(info.apk || ''), notes: Array.isArray(info.notes) ? info.notes.map(String).slice(0, 12) : [] };
      save();
      return 'update';
    }
    app.latest = null;
    save();
    return 'latest';
  } catch (e) {
    return 'offline';
  }
}

export const updateAvailable = () => !!(state.app.latest && state.app.latest.code > VERSION_CODE);
