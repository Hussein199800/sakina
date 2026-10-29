// يولّد فهرس المصحف (السور والصفحات والأجزاء) من بيانات Tanzil الرسمية في data/tanzil
// يُقرأ الملف نصاً ويُحلَّل بتعابير نمطية، ولا يُنفَّذ أي كود منه.
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('data/tanzil/quran-data.js', 'utf8');
function block(name) {
  const m = src.match(new RegExp(`QuranData\\.${name} = \\[([\\s\\S]*?)\\n\\];`));
  if (!m) throw new Error(`لم يُعثر على ${name}`);
  return m[1].split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter((l) => l.startsWith('['));
}
const pairs = (name) => [...block(name).join(' ').matchAll(/\[(\d+),\s*(\d+)\]/g)].map((m) => [+m[1], +m[2]]);

const FIX = { 'ابراهيم': 'إبراهيم' }; // تصحيح إملائي لاسم سورة في بيانات Tanzil
const suraRows = block('Sura').filter((l) => /'(Meccan|Medinan)'/.test(l));
const suras = suraRows.map((l) => {
  const m = l.match(/^\[(\d+),\s*(\d+),\s*\d+,\s*\d+,\s*'([^']+)',.*'(Meccan|Medinan)'\]/);
  if (!m) throw new Error(`صف سورة غير مفهوم: ${l}`);
  return [FIX[m[3]] || m[3], +m[2], +m[1], m[4] === 'Meccan' ? 'm' : 'd'];
});
const idx = ([s, a]) => (s === 115 ? 6236 : suras[s - 1][2] + a - 1);
const pages = pairs('Page').map(idx);
const juz = pairs('Juz').map(idx);
if (pages[pages.length - 1] !== 6236) pages.push(6236);

if (suras.length !== 114 || pages.length !== 605 || juz.length < 30) throw new Error(`بيانات غير مكتملة ${suras.length} ${pages.length} ${juz.length}`);

writeFileSync('src/data/quran-meta.js', `// مولَّد تلقائياً من بيانات Tanzil (quran-data.js) بالأمر: node scripts/gen-quran-meta.mjs — لا تعدّله يدوياً
// المصدر: Tanzil Project — https://tanzil.net (CC BY 3.0)
// SURAS: [الاسم، عدد الآيات، فهرس أول آية، مكية m / مدنية d]
export const SURAS = ${JSON.stringify(suras)};
// PAGES[n-1] = فهرس أول آية في الصفحة n من مصحف المدينة (٦٠٤ صفحات + حدّ نهائي)
export const PAGES = ${JSON.stringify(pages)};
// JUZ[n-1] = فهرس أول آية في الجزء n
export const JUZ = ${JSON.stringify(juz.slice(0, 30))};
export const TOTAL_AYAT = 6236;
export const TOTAL_PAGES = 604;
`);
console.log('suras', suras.length, 'pages', pages.length - 1, 'juz', juz.length);
