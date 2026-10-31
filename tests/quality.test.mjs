// اختبارات الجودة: الحسابات (الزكاة، توزيع الختمة)، تنسيق الأرقام، سلامة البيانات، الأيام والتنبيهات
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeZakat, NISAB_GOLD_G, NISAB_SILVER_G } from '../src/zakat.js';
import { distribute } from '../src/group.js';
import { num, parseNum, fmtNum, fmtPct, plural, pagesLabel, setDigits } from '../src/text.js';
import { state, sanitize, DEFAULTS } from '../src/store.js';
import { streak, countOnce, buildNotifications, MAX_SCHEDULED } from '../src/services.js';
import { CATEGORY_BY_ID } from '../src/data/adhkar.js';
import { dateKey } from '../src/dates.js';

test('الزكاة: النصاب والمقدار والتحويل بين العيارات', () => {
  const base = { goldPrice: 4000, silverPrice: 50, basis: 'gold', cash: 0, gold: {}, silver: 0, trade: 0, receivables: 0, debts: 0 };
  // النصاب بالذهب = ٨٥ × ٤٠٠٠ = ٣٤٠٬٠٠٠
  let r = computeZakat({ ...base, cash: 339999.99 });
  assert.equal(r.nisab, NISAB_GOLD_G * 4000);
  assert.equal(r.reached, false);
  assert.equal(r.due, 0);
  r = computeZakat({ ...base, cash: 340000 });
  assert.equal(r.reached, true);
  assert.equal(r.due, 8500); // ٢٫٥٪
  // ٢١ غراماً من عيار ٢١ = ١٨٫٣٧٥ غراماً من الخالص
  r = computeZakat({ ...base, gold: { 21: 21 } });
  assert.equal(r.goldPure, 18.38);
  assert.equal(r.goldValue, 73500);
  // نصاب الفضة = ٥٩٥ × ٥٠ = ٢٩٬٧٥٠
  r = computeZakat({ ...base, basis: 'silver', cash: 30000 });
  assert.equal(r.nisab, NISAB_SILVER_G * 50);
  assert.equal(r.due, 750);
  // الديون تُخصم، ولا يصير المال سالباً
  r = computeZakat({ ...base, cash: 1000, debts: 5000 });
  assert.equal(r.net, 0);
  // قيم غير صالحة تُعامل صفراً، ولا نصاب بلا سعر
  r = computeZakat({ ...base, goldPrice: 0, cash: -50, trade: NaN, gold: { 24: 'x' } });
  assert.equal(r.missingPrice, true);
  assert.equal(r.due, 0);
  assert.equal(r.net, 0);
  // الكسور العشرية تُقرَّب إلى جزء من مئة
  r = computeZakat({ ...base, cash: 400000.333 });
  assert.equal(r.due, 10000.01);
});

test('الختمة الجماعية: توزيع متصل ومتساوٍ يغطي الأجزاء الثلاثين', () => {
  for (let n = 1; n <= 30; n++) {
    const d = distribute(n);
    assert.equal(d.length, n);
    assert.equal(d[0].from, 1);
    assert.equal(d[n - 1].to, 30);
    for (let i = 1; i < n; i++) assert.equal(d[i].from, d[i - 1].to + 1);
    const sizes = d.map((x) => x.to - x.from + 1);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `عدم تساوٍ عند ${n}`);
  }
  assert.equal(distribute(50).length, 30, 'الحد الأعلى ٣٠ مشاركاً');
  assert.equal(distribute(0).length, 1);
});

test('تنسيق الأرقام موحّد في الاتجاهين وقراءة أي نظام أرقام', () => {
  setDigits('arab');
  assert.equal(num('الآية 255 من ٢٨٦'), 'الآية ٢٥٥ من ٢٨٦');
  assert.equal(fmtNum(1234567.5, 2), '١٬٢٣٤٬٥٦٧٫٥٠');
  assert.equal(fmtPct(0.456), '٤٦٪');
  setDigits('latn');
  assert.equal(num('الآية ٢٥٥ من 286'), 'الآية 255 من 286');
  assert.equal(fmtNum(1234567.5, 2), '1,234,567.50');
  assert.equal(fmtPct(1.5), '100%');
  assert.equal(fmtPct(-0.2), '0%');
  setDigits('arab');
  assert.equal(parseNum('١٢٫٥'), 12.5);
  assert.equal(parseNum('١٬٢٥٠'), 1250);
  assert.equal(parseNum('۴۵'), 45);
  assert.ok(Number.isNaN(parseNum('١٢ب')));
  assert.ok(Number.isNaN(parseNum('')));
  assert.equal(pagesLabel(1), 'صفحة واحدة');
  assert.equal(pagesLabel(2), 'صفحتان');
  assert.equal(pagesLabel(5), '٥ صفحات');
  assert.equal(pagesLabel(20), '٢٠ صفحة');
  assert.equal(plural(103, ['', '', 'أيام', 'يوماً']), '١٠٣ أيام');
});

test('سلامة البيانات: تصحيح القيم التالفة دون فقد الصالحة', () => {
  const bad = JSON.parse(JSON.stringify(DEFAULTS));
  Object.assign(bad.settings, { fontSize: 'كبير', theme: 'غير موجود', hijriAdjust: 9, digits: 'x' });
  bad.settings.notif.morning = { on: 1, time: '25:99' };
  bad.favorites = 'نص';
  bad.custom = [{ id: 'c1', t: 'دعائي', n: 0 }, { t: 'بلا معرّف' }];
  bad.quran = { lastPage: 900, fontSize: 1, bookmarks: [3, 'x', 7000] };
  bad.khatma = { page: 0, perDay: 5 };
  bad.reminders = [{ id: 'r', kind: 'custom', time: '7:5', days: [1, 9, 'x'] }];
  const s = sanitize(bad);
  assert.equal(s.settings.fontSize, 25);
  assert.equal(s.settings.theme, 'oasis');
  assert.equal(s.settings.hijriAdjust, 2);
  assert.equal(s.settings.digits, 'arab');
  assert.deepEqual(s.settings.notif.morning, { on: true, time: '06:30' });
  assert.deepEqual(s.favorites, []);
  assert.deepEqual(s.custom, [{ id: 'c1', t: 'دعائي', n: 1 }]);
  assert.deepEqual(s.quran, { lastPage: 604, fontSize: 20, bookmarks: [3] });
  assert.equal(s.khatma, null);
  assert.deepEqual(s.reminders[0].days, [1]);
  assert.equal(s.reminders[0].time, '20:00');
});

test('أيام الالتزام لا تنقطع عند تغيّر التوقيت الصيفي', () => {
  state.history = {};
  // يوم قصير (٢٣ ساعة) في الوسط: يجب أن تُحسب الأيام الثلاثة متتالية
  for (const k of ['2026-03-28', '2026-03-29', '2026-03-30']) state.history[k] = { m: 1, e: 0, p: 0, r: 0, t: 0, pr: [0, 0, 0, 0, 0] };
  assert.equal(streak(new Date(2026, 2, 30, 0, 30)), 3);
  assert.equal(streak(new Date(2026, 2, 31, 9, 0)), 3, 'اليوم الحالي غير مكتمل بعد فيُحسب من الأمس');
  assert.equal(streak(new Date(2026, 3, 2, 9, 0)), 0);
});

test('إتمام أذكار الصباح من المفضلة يُسجَّل في رحلتي', () => {
  const items = CATEGORY_BY_ID.morning.items;
  state.progress = { date: dateKey(), counts: {} };
  state.history = {};
  state.favorites = [items[items.length - 1].id];
  for (const it of items.slice(0, -1)) state.progress.counts[it.id] = it.n;
  const last = items[items.length - 1];
  for (let i = 0; i < last.n; i++) countOnce(last, 'favorites');
  assert.equal(state.history[dateKey()].m, 1);
});

test('التنبيهات: الصلوات لها الأولوية ولا يتجاوز العدد الحد', () => {
  state.settings.notif.prayers = true;
  state.reminders = Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, kind: 'qiyam', on: true, time: '03:30' }));
  const list = buildNotifications(new Date(2026, 9, 31, 1, 0));
  assert.ok(list.length <= MAX_SCHEDULED);
  assert.ok(list.filter((n) => n.title.indexOf('حان وقت صلاة') === 0).length >= 25, 'الصلوات محفوظة رغم كثرة التذكيرات');
  assert.equal(new Set(list.map((n) => n.id)).size, list.length, 'لا تكرار في معرّفات الإشعارات');
  state.reminders = [];
  state.settings.notif.prayers = false;
});
