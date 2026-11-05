// اختبارات دقة النصوص الدينية: كل آية تُطابَق مع نص المصحف (Tanzil)، وكل ذكر مع «حصن المسلم»
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES } from '../src/data/adhkar.js';
import { FEELINGS, DAILY_AYAT } from '../src/data/spirit.js';
import { SURAS, PAGES, JUZ } from '../src/data/quran-meta.js';
import { normalize } from '../src/text.js';
import { splitBasmala } from '../src/quran.js';
import { SURA_INFO } from '../src/data/sura-info.js';
import { NOTES } from '../src/data/sura-notes.js';

const tanzil = (f) => readFileSync(new URL(`../data/tanzil/${f}`, import.meta.url), 'utf8')
  .split('\n').map((l) => l.split('|')).filter((p) => p.length === 3);
const CLEAN = tanzil('quran-simple-clean.txt');
const UTHMANI = tanzil('quran-uthmani.txt');

// تطبيع للمقارنة: يوحّد اختلافات الإملاء التي لا تغيّر النص (الهمزة المفردة، السماوات/السموات، ﷺ)
const cmp = (s) => normalize(s.replace(/ﷺ/g, ' صلى الله عليه وسلم ').replace(/[[\]]/g, ' ')).replace(/ء/g, '').replace(/سماوات/g, 'سموات').replace(/\s+/g, ' ').trim();

const verse = CLEAN.map(([s, a, t]) => ({ s: +s, a: +a, n: cmp(t) }));
const QURAN_ALL = verse.map((v) => v.n).join(' ');
const suraByName = {};
SURAS.forEach(([name], i) => { suraByName[cmp(name)] = i + 1; });
const AR = '٠١٢٣٤٥٦٧٨٩';
const toInt = (d) => parseInt(d.replace(/[٠-٩]/g, (c) => AR.indexOf(c)), 10);

/** يحوّل مرجعاً مثل «سورة إبراهيم: ٤٠-٤١ — سورة الشعراء: ٨٠» إلى نص الآيات المشار إليها */
function refText(ref) {
  const parts = [...ref.matchAll(/(?:سورة\s+)?([^\s:—]+(?:\s[^\s:—]+)?)\s*:\s*([٠-٩0-9]+)(?:\s*-\s*([٠-٩0-9]+))?/g)];
  if (!parts.length) return null;
  return parts.map((m) => {
    const s = suraByName[cmp(m[1])];
    assert.ok(s, `اسم سورة غير معروف في المرجع: ${m[1]}`);
    const a1 = toInt(m[2]);
    const a2 = m[3] ? toInt(m[3]) : a1;
    assert.ok(a1 >= 1 && a2 <= SURAS[s - 1][1] && a1 <= a2, `رقم آية خارج السورة: ${ref}`);
    return verse.filter((v) => v.s === s && v.a >= a1 && v.a <= a2).map((v) => v.n).join(' ');
  }).join(' ');
}

const segments = (t) => [...t.matchAll(/﴿([^﴾]*)﴾/g)].map((m) => m[1]);

test('كل نص قرآني في الأذكار والأدعية مطابق حرفياً لنص المصحف ولمرجعه', () => {
  let checked = 0;
  const check = (id, text, ref) => {
    for (const seg of segments(text)) {
      const n = cmp(seg);
      assert.ok(QURAN_ALL.indexOf(n) !== -1, `${id}: النص القرآني لا يطابق المصحف «${seg.slice(0, 60)}…»`);
      const rt = ref && refText(ref);
      if (rt) assert.ok(rt.indexOf(n) !== -1, `${id}: الآية لا توافق المرجع «${ref}»`);
      checked += 1;
    }
  };
  for (const c of CATEGORIES) for (const it of c.items) check(it.id, it.t, /سورة/.test(it.s) ? it.s : '');
  for (const f of FEELINGS) check(`feeling-${f.id}`, f.ayah, f.ayahRef);
  DAILY_AYAT.forEach(([t, ref], i) => check(`daily-ayah-${i}`, `﴿${t}﴾`, ref));
  assert.ok(checked > 70, `عدد المقاطع المفحوصة قليل: ${checked}`);
});

// أذكار مصدرها «حصن المسلم» تُطابَق نصاً. والمستثنى هنا له سبب موثّق
const HISN = JSON.parse(readFileSync(new URL('./fixtures/hisn-muslim.json', import.meta.url), 'utf8')).items.map((x) => ({ ...x, n: cmp(x.text) }));
const NOT_IN_HISN = {
  // صيغ المساء: «حصن المسلم» يذكر صيغة الصباح ثم يقول «وإذا أمسى قال…» فقط
  evening: 'صيغة المساء مشتقة من صيغة الصباح كما في الحديث',
  'prayer-0': 'جمع الاستغفار ثلاثاً في نص واحد بدل كلمة «ثلاثاً»',
  'prayer-1': 'الحصن يضيف كلمة «ثلاثاً» في آخره',
  'prayer-8': 'المعوذات الثلاث في بطاقة واحدة (نص قرآني يُفحص في الاختبار السابق)',
  'sleep-0': 'المعوذات الثلاث في بطاقة واحدة',
  'sleep-14': 'الحصن يصف الفعل؛ النص هنا صيغة الاستعاذة نفسها',
  'adhan-0': 'وصف لكيفية ترديد الأذان',
  'adhan-4': 'نص الحديث مع توجيه للقارئ',
  'travel-0': 'دعاء السفر مع آية الزخرف داخل ﴿﴾',
  'travel-1': 'من حديث مسلم في النزول منزلاً، والحصن يورده في أذكار المساء',
  'sunnah-3': 'الحصن يسوق الاستخارة ضمن الحديث مع مقدمته',
  'ruqyah-10': 'الحصن يورده بلفظ الأمر «ضع يدك… وقل»',
  'ruqyah-12': 'الحصن يورده ضمن سياق الحديث',
  'salawat-1': 'صيغة مختصرة امتثالاً للأمر في آية الأحزاب، وليست نصاً مأثوراً بلفظه',
  'salawat-4': 'صيغة أبي مسعود الأنصاري في صحيح مسلم (٤٠٥)، وليست في «حصن المسلم»',
  'rain-5': 'الحصن يرسمها «وأحيي» بياءين، ولفظها في سنن أبي داود (١١٧٦) «وأحيِ» بفعل الأمر',
};
const HISN_CATS = ['morning', 'evening', 'prayer', 'sleep', 'waking', 'home', 'khala', 'wudu', 'adhan', 'mosque', 'food', 'travel', 'salawat', 'hamd',
  'anger', 'fear', 'wind', 'rain', 'distress', 'sick', 'joy', 'misc'];

test('أذكار اليوم والليلة مطابقة لنصوص «حصن المسلم»', () => {
  let checked = 0;
  for (const c of CATEGORIES.filter((x) => HISN_CATS.indexOf(x.id) !== -1)) {
    for (const it of c.items) {
      if (NOT_IN_HISN[it.id] || (c.id === 'evening' && /أمسي|أمسى|أَمْسَ/.test(it.t))) continue;
      const rest = cmp(it.t.replace(/﴿[^﴾]*﴾/g, ' ')).replace(/^اعوذ بالله من الشيطان الرجيم ?/, '').replace(/^بسم الله الرحمن الرحيم ?/, '');
      if (rest.split(' ').length < 2) continue;
      assert.ok(HISN.some((h) => h.n.indexOf(rest) !== -1), `${it.id}: النص لا يطابق «حصن المسلم»: «${it.t.slice(0, 70)}…»`);
      checked += 1;
    }
  }
  assert.ok(checked > 40, `عدد الأذكار المفحوصة قليل: ${checked}`);
});

test('أعداد التكرار في أذكار الصباح والمساء موافقة لـ«حصن المسلم»', () => {
  for (const id of ['morning', 'evening']) {
    for (const it of CATEGORIES.find((c) => c.id === id).items) {
      const rest = cmp(it.t.replace(/﴿[^﴾]*﴾/g, ' '));
      const h = HISN.find((x) => x.chapter === 'أذكار الصباح والمساء' && rest.split(' ').length > 3 && x.n.indexOf(rest) !== -1);
      if (h && h.repeat > 1) assert.equal(it.n, h.repeat, `${it.id}: العدد ${it.n} والحصن ${h.repeat}`);
    }
  }
});

test('فهرس المصحف مطابق لبيانات Tanzil', () => {
  assert.equal(SURAS.length, 114);
  assert.equal(SURAS.reduce((a, s) => a + s[1], 0), 6236);
  assert.equal(PAGES.length, 605);
  assert.equal(JUZ.length, 30);
  // نقاط معروفة في مصحف المدينة
  const at = (s, a) => SURAS[s - 1][2] + a - 1;
  assert.equal(PAGES[1], at(2, 1)); // الصفحة ٢: البقرة ١
  assert.equal(PAGES[49], at(3, 1)); // الصفحة ٥٠: آل عمران ١
  assert.equal(PAGES[581], at(78, 1)); // الصفحة ٥٨٢: النبأ ١ (جزء عمّ)
  assert.equal(JUZ[29], at(78, 1)); // الجزء ٣٠ يبدأ بالنبأ
  assert.equal(JUZ[1], at(2, 142));
  for (let i = 1; i < PAGES.length; i++) assert.ok(PAGES[i] > PAGES[i - 1]);
});

test('فصل البسملة عن الآية الأولى للعرض لا يغيّر أي حرف', () => {
  let n = 0;
  UTHMANI.forEach(([, , t], i) => {
    const { basmala, text } = splitBasmala(i, t);
    if (!basmala) return;
    n += 1;
    assert.equal(`${basmala} ${text}`, t);
    assert.equal(cmp(basmala).replace(/ /g, ''), 'بسماللهالرحمنالرحيم');
  });
  assert.equal(n, 112); // كل السور عدا الفاتحة والتوبة
  assert.equal(splitBasmala(0, UTHMANI[0][2]).basmala, ''); // الفاتحة: البسملة آية مستقلة
});

// ---------- مداخل السور ----------
const MUKH = JSON.parse(readFileSync(new URL('../data/mukhtasar/maqasid.json', import.meta.url), 'utf8')).items;
const TANZIL_ROWS = [...readFileSync(new URL('../data/tanzil/quran-data.js', import.meta.url), 'utf8')
  .matchAll(/\[(\d+), (\d+), (\d+), (\d+), '([^']+)', "[^"]*", '[^']*', '(Meccan|Medinan)'\]/g)];

test('مداخل السور: المكي والمدني والمقاصد بنص «المختصر»، وترتيب النزول من Tanzil', () => {
  assert.equal(SURA_INFO.length, 114);
  assert.equal(TANZIL_ROWS.length, 114);
  SURA_INFO.forEach(([place, order, maqasid], i) => {
    const m = MUKH[i];
    assert.equal(m.s, i + 1);
    assert.equal(maqasid, m.maqasid, `السورة ${i + 1}: المقاصد لا تطابق «المختصر»`);
    assert.ok(m.header.endsWith(place === 'm' ? 'مكية' : 'مدنية'), `السورة ${i + 1}: المكي والمدني لا يطابق «المختصر»`);
    assert.equal(order, +TANZIL_ROWS[i][3], `السورة ${i + 1}: ترتيب النزول لا يطابق Tanzil`);
  });
  assert.deepEqual(SURA_INFO.map((x) => x[1]).sort((a, b) => a - b), Array.from({ length: 114 }, (_, i) => i + 1));
  // نقاط معروفة: العلق أول ما نزل، والفاتحة الخامسة، والنصر من آخر ما نزل
  assert.equal(SURA_INFO[95][1], 1);
  assert.equal(SURA_INFO[0][1], 5);
  assert.equal(SURA_INFO[109][1], 114);
});

test('مداخل السور: الآيات المستشهد بها مطابقة، واسم السورة وارد في الآية المذكورة', () => {
  for (let s = 1; s <= 114; s++) assert.ok(NOTES[s] && NOTES[s].name && NOTES[s].name.w, `السورة ${s}: لا يوجد سبب تسمية`);
  for (const [k, n] of Object.entries(NOTES)) {
    const s = +k;
    const texts = [n.name.w, n.sabab && n.sabab.t, n.when && n.when.t].filter(Boolean);
    for (const t of texts) {
      for (const seg of segments(t)) assert.ok(QURAN_ALL.indexOf(cmp(seg)) !== -1, `السورة ${s}: النص القرآني لا يطابق المصحف «${seg}»`);
    }
    if (n.name.ref) {
      const [rs, ra] = n.name.ref;
      assert.equal(rs, s, `السورة ${s}: مرجع التسمية من سورة أخرى`);
      assert.ok(ra >= 1 && ra <= SURAS[s - 1][1]);
      const v = verse.find((x) => x.s === rs && x.a === ra);
      const flat = (t) => cmp(t).replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      assert.ok(flat(v.n).indexOf(flat(n.name.kw)) !== -1, `السورة ${s}: الكلمة «${n.name.kw}» ليست في الآية ${ra}`);
    }
    if (n.name.src === 'المختصر') {
      const plain = (t) => cmp(t).replace(/[()٠-٩0-9]/g, '').replace(/\s+/g, ' ');
      const src = MUKH[s - 1].naming;
      assert.ok(src && plain(src).indexOf(plain(n.name.w)) !== -1, `السورة ${s}: سبب التسمية المنسوب للمختصر لا يطابق نصه`);
    }
    for (const part of [n.sabab, n.when]) if (part) assert.ok(/رواه/.test(part.src), `السورة ${s}: سبب أو ملاحظة بلا تخريج`);
  }
});
