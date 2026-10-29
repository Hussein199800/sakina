// تحميل نص المصحف عند الحاجة فقط، وأدوات التنقل بين الآيات والصفحات والأجزاء
import { SURAS, PAGES, JUZ, TOTAL_AYAT } from './data/quran-meta.js';
import { normalize } from './text.js';

let textP = null;
let searchP = null;

function load(file) {
  return fetch(`build/${file}`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

/**
 * في نص Tanzil تبدأ الآية الأولى من كل سورة (عدا الفاتحة والتوبة) بالبسملة.
 * نفصل الكلمات الأربع الأولى للعرض فقط، دون تغيير أي حرف من النص.
 * @returns {{basmala: string, text: string}}
 */
export function splitBasmala(i, t) {
  const s = suraOf(i);
  if (s === 1 || s === 9 || i !== SURAS[s - 1][2]) return { basmala: '', text: t };
  let cut = -1;
  for (let n = 0; n < 4; n++) { cut = t.indexOf(' ', cut + 1); if (cut === -1) return { basmala: '', text: t }; }
  return { basmala: t.slice(0, cut), text: t.slice(cut + 1) };
}

/** نص آية واحدة دون البسملة الملحقة بها */
export const ayahOnly = (text, i) => splitBasmala(i, text[i]).text;

/** نص الآيات بالرسم العثماني (٦٢٣٦ آية) */
export function loadText() {
  if (!textP) textP = load('quran.json').then((j) => j.v).catch((e) => { textP = null; throw e; });
  return textP;
}

/** نص بلا تشكيل للبحث، مطبَّع مسبقاً */
export function loadSearch() {
  if (!searchP) searchP = load('quran-search.json').then((j) => j.v.map((t, i) => normalize(splitBasmala(i, t).text))).catch((e) => { searchP = null; throw e; });
  return searchP;
}

// بحث ثنائي: أكبر عنصر في المصفوفة لا يتجاوز القيمة
function floorIndex(arr, v, get = (x) => x) {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (get(arr[mid]) <= v) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** رقم السورة (١..١١٤) للآية ذات الفهرس العام i */
export const suraOf = (i) => floorIndex(SURAS, i, (s) => s[2]) + 1;
/** رقم الصفحة (١..٦٠٤) */
export const pageOf = (i) => floorIndex(PAGES.slice(0, 604), i) + 1;
/** رقم الجزء (١..٣٠) */
export const juzOf = (i) => floorIndex(JUZ, i) + 1;

/** {s, a} من الفهرس العام */
export function refOf(i) {
  const s = suraOf(i);
  return { s, a: i - SURAS[s - 1][2] + 1 };
}
export const indexOf = (s, a) => SURAS[s - 1][2] + a - 1;
export const suraName = (s) => SURAS[s - 1][0];
export const suraStartPage = (s) => pageOf(SURAS[s - 1][2]);

/** فهارس آيات صفحة معيّنة [من، إلى) */
export const pageRange = (p) => [PAGES[p - 1], PAGES[p]];

/** بحث في آيات القرآن بلا تشكيل؛ يعيد فهارس الآيات */
export async function searchQuran(q, limit = 80) {
  const words = normalize(q).split(' ').filter((w) => w.length > 1);
  if (!words.length) return [];
  const all = await loadSearch();
  const out = [];
  for (let i = 0; i < TOTAL_AYAT && out.length < limit; i++) {
    if (words.every((w) => all[i].indexOf(w) !== -1)) out.push(i);
  }
  return out;
}
