// يولّد بيانات «مداخل السور» الثابتة من مصدرين موثّقين، دون أي صياغة يدوية:
//   ١) ترتيب النزول وعدد الآيات: من بيانات Tanzil (data/tanzil/quran-data.js)، تُقرأ نصاً ولا تُنفَّذ
//   ٢) المكي والمدني و«من مقاصد السورة»: بنصّها من «المختصر في تفسير القرآن الكريم» (data/mukhtasar/maqasid.json)
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('data/tanzil/quran-data.js', 'utf8');
const rows = [...src.matchAll(/\[(\d+), (\d+), (\d+), (\d+), '([^']+)', "[^"]*", '[^']*', '(Meccan|Medinan)'\]/g)];
if (rows.length !== 114) throw new Error(`عدد السور في Tanzil ${rows.length}`);

const mukh = JSON.parse(readFileSync('data/mukhtasar/maqasid.json', 'utf8')).items;
if (mukh.length !== 114) throw new Error(`عدد السور في المختصر ${mukh.length}`);

const info = rows.map((r, i) => {
  const m = mukh[i];
  if (m.s !== i + 1) throw new Error(`ترتيب غير متوقع في المختصر عند ${i + 1}`);
  const place = /مكية$/.test(m.header) ? 'm' : /مدنية$/.test(m.header) ? 'd' : null;
  if (!place) throw new Error(`لم يُعرف المكي والمدني في: ${m.header}`);
  return [place, +r[3], m.maqasid];
});

const order = info.map((x) => x[1]).sort((a, b) => a - b);
if (order.some((o, i) => o !== i + 1)) throw new Error('ترتيب النزول غير مكتمل');

writeFileSync('src/data/sura-info.js', `// مولَّد تلقائياً بالأمر: node scripts/gen-sura-info.mjs — لا تعدّله يدوياً
// SURA_INFO[n-1] = [مكية m / مدنية d بحسب «المختصر»، ترتيب النزول بحسب Tanzil، «من مقاصد السورة» بنص «المختصر»]
// المصادر: «المختصر في تفسير القرآن الكريم» (مركز تفسير للدراسات القرآنية)، ومشروع Tanzil (tanzil.net)
export const SURA_INFO = ${JSON.stringify(info, null, 0).replace(/\],\[/g, '],\n  [').replace(/^\[\[/, '[\n  [').replace(/\]\]$/, '],\n]')};
`);
console.log('sura-info', info.length);
