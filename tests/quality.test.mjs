// اختبارات الجودة: الحسابات (الزكاة، توزيع الختمة)، تنسيق الأرقام، سلامة البيانات، الأيام والتنبيهات
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeZakat, NISAB_GOLD_G, NISAB_SILVER_G, price24, CURRENCIES } from '../src/zakat.js';
import { distribute } from '../src/group.js';
import { num, parseNum, fmtNum, fmtPct, plural, pagesLabel, setDigits } from '../src/text.js';
import { state, sanitize, DEFAULTS } from '../src/store.js';
import { streak, countOnce, buildNotifications, buildOverlays, MAX_SCHEDULED } from '../src/services.js';
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

test('تحويل سعر الذهب من عيار ٢١ أو ١٨ إلى ٢٤، والعملات المتاحة', () => {
  assert.equal(price24(3500, 21), 4000);
  assert.equal(price24(3000, 18), 4000);
  assert.equal(price24(4000, 24), 4000);
  assert.equal(price24(4000, 99), 4000, 'عيار غير معروف يُعامل كعيار ٢٤');
  assert.equal(price24(-5, 21), 0);
  const names = CURRENCIES.map((c) => c[0]);
  assert.ok(names.indexOf('الليرة السورية الجديدة') !== -1 && names.indexOf('الدولار الأمريكي') !== -1);
});

test('الفقاعة العائمة: مواعيد أسبوع لأذكار الصباح والمساء، وتُتخطّى إذا أُتمّت أذكار اليوم', () => {
  const s = state.settings;
  s.overlay = true;
  s.notif.morning = { on: true, time: '06:30' };
  s.notif.evening = { on: true, time: '17:00' };
  s.notif.sleep = { on: false, time: '22:30' };
  state.progress = { date: dateKey(), counts: {} };
  const now = new Date(2026, 9, 31, 5, 0);
  let list = buildOverlays(now);
  assert.equal(list.length, 14);
  assert.deepEqual([list[0].at.getHours(), list[0].at.getMinutes(), list[0].route], [6, 30, '/read/morning']);
  assert.equal(new Set(list.map((o) => o.id)).size, list.length);
  // بعد السابعة صباحاً: لا موعد صباح اليوم
  list = buildOverlays(new Date(2026, 9, 31, 7, 0));
  assert.equal(list.filter((o) => o.route === '/read/morning').length, 6);
  // الإيقاف يلغي كل المواعيد
  s.overlay = false;
  assert.equal(buildOverlays(now).length, 0);
});

test('الضغط على كل إشعار يفتح مكان العمل نفسه', async () => {
  const { routeOf, KAHF_PAGE } = await import('../src/reminders.js');
  const { SURAS, PAGES } = await import('../src/data/quran-meta.js');
  assert.equal(KAHF_PAGE, 293, 'سورة الكهف تبدأ في الصفحة ٢٩٣ من مصحف المدينة');
  assert.ok(PAGES[KAHF_PAGE - 1] <= SURAS[17][2] && SURAS[17][2] < PAGES[KAHF_PAGE]);
  assert.equal(routeOf({ kind: 'kahf' }), '#/mushaf/293');
  assert.equal(routeOf({ kind: 'salawat' }), '#/read/salawat');
  assert.equal(routeOf({ kind: 'white' }), '#/journal');
  assert.equal(routeOf({ kind: 'custom' }), '#/reminders');
  state.settings.notif.morning = { on: true, time: '06:30' };
  state.settings.notif.evening = { on: true, time: '17:00' };
  state.khatma = { startedAt: '2026-10-31', perDay: 5, time: '20:00', remind: true, page: 42, startPage: 1, log: {} };
  state.reminders = [{ id: 'k', kind: 'kahf', on: true, time: '10:00', mode: 'day' }];
  const list = buildNotifications(new Date(2026, 9, 31, 1, 0));
  const by = (id) => list.find((n) => n.id === id).route;
  assert.equal(by(1), '#/read/morning');
  assert.equal(by(2), '#/read/evening');
  assert.equal(by(5), '#/mushaf/42', 'ورد الختمة يفتح الصفحة التالية للقراءة');
  assert.equal(list.find((n) => n.id >= 1000).route, '#/mushaf/293');
  state.khatma = null;
  state.reminders = [];
});

test('المدن: الأرقام المحفوظة ثابتة، وإدلب ومدن سوريا متاحة بتوقيت دمشق', async () => {
  const { CITIES, CITIES_SORTED } = await import('../src/data/cities.js');
  // مدن الإصدارات السابقة لا تتغيّر أرقامها (رقم المدينة هو المحفوظ عند المستخدم)
  const fixed = { 0: 'مكة المكرمة', 5: 'القاهرة', 15: 'بغداد', 27: 'دمشق', 28: 'حلب', 69: 'سيدني' };
  for (const [id, name] of Object.entries(fixed)) assert.equal(CITIES[id].name, name);
  const idlib = CITIES.find((c) => c.name === 'إدلب');
  assert.ok(idlib && idlib.id >= 70 && idlib.tz === 'Asia/Damascus' && idlib.method === 'mwl');
  assert.ok(CITIES.filter((c) => c.country === 'سوريا').length >= 40);
  assert.equal(new Set(CITIES.map((c) => c.name)).size, CITIES.length, 'لا تكرار في أسماء المدن');
  for (const c of CITIES) assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180, c.name);
  // في العرض: مدن سوريا متجاورة
  const idx = CITIES_SORTED.map((c) => c.country).reduce((a, c, i) => (c === 'سوريا' ? a.concat(i) : a), []);
  assert.equal(idx[idx.length - 1] - idx[0] + 1, idx.length);
  // مواقيت إدلب منطقية (بتوقيت سوريا +٣): الفجر قبل الشروق قبل الظهر
  const { computeTimes } = await import('../src/prayer.js');
  const { hmInTz } = await import('../src/dates.js');
  const t = computeTimes({ y: 2026, m: 10, d: 31 }, idlib, { method: 'mwl' });
  const h = (k) => hmInTz(t[k], 'Asia/Damascus').h;
  assert.ok(h('fajr') >= 4 && h('fajr') <= 6 && h('dhuhr') >= 11 && h('dhuhr') <= 13, `فجر ${h('fajr')} ظهر ${h('dhuhr')}`);
});

test('المساجد القريبة: المسافة والاتجاه وتحويل النتائج ورابط المسار مشياً', async () => {
  const { distanceM, bearing, directionName, parseResults, buildQuery, routeUrl, fetchMosques } = await import('../src/mosques.js');
  const me = { lat: 35.9306, lng: 36.6339 };
  // ٠٫٠٠٩ درجة عرض ≈ ١ كم شمالاً
  const north = { lat: me.lat + 0.009, lng: me.lng };
  assert.ok(Math.abs(distanceM(me, north) - 1000) < 5);
  assert.ok(bearing(me, north) < 0.5 || bearing(me, north) > 359.5);
  assert.ok(Math.abs(bearing(me, { lat: me.lat, lng: me.lng + 0.01 }) - 90) < 0.5);
  assert.equal(directionName(10), 'شمال');
  assert.equal(directionName(135), 'جنوب شرق');
  assert.equal(directionName(-45), 'شمال غرب');
  assert.match(buildQuery(me.lat, me.lng, 2000), /around:2000,35\.93060,36\.63390/);
  const json = { elements: [
    { type: 'node', id: 1, lat: me.lat + 0.018, lon: me.lng, tags: { name: 'Far', 'name:ar': 'الجامع الكبير' } },
    { type: 'way', id: 2, center: { lat: me.lat + 0.0045, lon: me.lng }, tags: {} },
    { type: 'node', id: 3, lat: me.lat + 0.00451, lon: me.lng + 0.00001, tags: { name: 'نفسه' } }, // نقطة المسجد نفسه داخل مبناه
    { type: 'node', id: 4, tags: {} }, // بلا إحداثيات
  ] };
  const list = parseResults(json, me);
  assert.equal(list.length, 2, 'لا تكرار ولا عناصر بلا إحداثيات');
  assert.equal(list[0].name, 'نفسه', 'المبنى بلا اسم يأخذ اسم نقطته');
  assert.ok(list[0].dist < list[1].dist);
  assert.equal(list[1].name, 'الجامع الكبير', 'الاسم العربي أولاً');
  assert.equal(routeUrl(list[1]), `https://www.google.com/maps/dir/?api=1&destination=${(me.lat + 0.018).toFixed(6)},${me.lng.toFixed(6)}&travelmode=walking`);
  // إن تعطّل الخادم الأول يُجرَّب التالي
  let calls = 0;
  const fake = (url) => { calls += 1; return calls === 1 ? Promise.reject(new Error('down')) : Promise.resolve({ ok: true, json: () => Promise.resolve(json) }); };
  const got = await fetchMosques(me, 2000, { fetchImpl: fake });
  assert.equal(calls, 2);
  assert.equal(got.items.length, 2);
  assert.equal(got.limited, false);
  await assert.rejects(fetchMosques(me, 2000, { fetchImpl: () => Promise.reject(new Error('offline')) }));
});

test('LOG-01: إزالة تكرار المساجد بالمعرّف والمسافة والاسم دون دمج مسجدين متجاورين', async () => {
  const { parseResults, dedupeMosques, normName } = await import('../src/mosques.js');
  const me = { lat: 35.9306, lng: 36.6339 };
  const el = (id, lat, lng, name, type = 'node') => ({ type, id, lat, lon: lng, tags: name ? { name } : {} });
  // الإحداثيات نفسها ثلاث مرات
  assert.equal(parseResults({ elements: [el(1, 35.94, 36.64, ''), el(2, 35.94, 36.64, ''), el(3, 35.94, 36.64, '')] }, me).length, 1);
  // فرق أقل من متر عبر حدّ التقريب القديم (٤ منازل)
  assert.equal(parseResults({ elements: [el(1, 35.940049, 36.64, 'النور'), el(2, 35.940051, 36.64, 'النور')] }, me).length, 1);
  // المعرّف نفسه مكرراً
  assert.equal(parseResults({ elements: [el(7, 35.94, 36.64, 'أ'), el(7, 35.95, 36.65, 'أ')] }, me).length, 1);
  // نقطة ومبنى للمسجد نفسه على بعد ~١٥ م بالاسم نفسه (مع اختلاف الكتابة)
  const pb = parseResults({ elements: [el(1, 35.94, 36.64, 'مسجد الإيمان'), { type: 'way', id: 9, center: { lat: 35.94013, lon: 36.64 }, tags: { name: 'جامع الايمان' } }] }, me);
  assert.equal(pb.length, 1);
  // مسجدان مختلفان متجاوران (اسمان متعارضان على بعد ~٥ م) لا يُدمجان
  assert.equal(parseResults({ elements: [el(1, 35.94, 36.64, 'مسجد التقوى'), el(2, 35.940045, 36.64, 'مسجد الرحمة')] }, me).length, 2);
  // بلا اسم على بعد ~١٥ م: يبقيان منفصلين (الحد المحافظ ١٠ م)
  assert.equal(parseResults({ elements: [el(1, 35.94, 36.64, 'مسجد التقوى'), el(2, 35.94013, 36.64, '')] }, me).length, 2);
  // الاسم العربي يُفضّل على غيره
  const ar = parseResults({ elements: [el(1, 35.94, 36.64, 'Al-Huda Mosque'), el(2, 35.94, 36.64, '')] }, me);
  assert.equal(ar.length, 1);
  assert.equal(normName('المسجد  الكبيرُ'), 'الكبير');
  assert.equal(normName('جامع الإيمان'), normName('مسجد الايمان'));
  // لا دمج متسلسل: ثلاث نقاط بلا اسم كل منها على بعد ~٨ م من سابقتها
  assert.equal(dedupeMosques([{ lat: 35.94, lng: 36.64 }, { lat: 35.94007, lng: 36.64 }, { lat: 35.94014, lng: 36.64 }], me).length, 2);
});

test('LOG-01: المحفوظات القديمة المكررة تُنظّف عند التحميل', async () => {
  const { replaceAll, state } = await import('../src/store.js');
  const items = [
    { id: 'node/1', name: '', lat: 35.94, lng: 36.64, dist: 1, dir: 0 },
    { id: 'way/2', name: 'مسجد النور', lat: 35.94, lng: 36.64, dist: 1, dir: 0 },
    { id: 'node/3', name: 'مسجد الهدى', lat: 35.95, lng: 36.64, dist: 2, dir: 0 },
  ];
  replaceAll({ settings: {}, mosques: { at: 5, lat: 35.93, lng: 36.64, radius: 2000, items } });
  assert.equal(state.mosques.items.length, 2);
  assert.equal(state.mosques.items[0].name, 'مسجد النور');
  assert.ok(state.mosques.items[0].dist > 1000, 'المسافة تُعاد من موقع البحث');
  replaceAll({ settings: {} });
});

test('LOG-02: مهلة فعلية وإلغاء ورفض remark وأخطاء HTTP ضمن الميزانية', async () => {
  const { fetchMosques, isAbort, OVERPASS } = await import('../src/mosques.js');
  const me = { lat: 35.9306, lng: 36.6339 };
  const okJson = { elements: [{ type: 'node', id: 1, lat: 35.94, lon: 36.64, tags: {} }] };
  const ok = () => Promise.resolve({ ok: true, json: () => Promise.resolve(okJson) });
  // خادم معلّق: يُلغى طلبه فعلياً ويُجرَّب التالي
  const aborted = [];
  let n = 0;
  const hang = (url, init) => { n += 1; if (n === 1) return new Promise((_, rej) => { init.signal.addEventListener('abort', () => { aborted.push(url); rej(new Error('aborted by signal')); }); }); return ok(); };
  const t0 = Date.now();
  const r1 = await fetchMosques(me, 1000, { fetchImpl: hang, timeoutMs: 60, budgetMs: 2000 });
  assert.equal(r1.items.length, 1);
  assert.equal(aborted.length, 1, 'الطلب المعلّق أُوقف');
  assert.ok(Date.now() - t0 < 1000);
  // 429 ثم 500 ثم remark: فشل لا قائمة فارغة
  const seq = [
    () => Promise.resolve({ ok: false, status: 429 }),
    () => Promise.resolve({ ok: false, status: 500 }),
    () => Promise.resolve({ ok: true, json: () => Promise.resolve({ elements: [], remark: 'runtime error: Query timed out' }) }),
  ];
  let i = 0;
  await assert.rejects(fetchMosques(me, 1000, { fetchImpl: () => seq[i++](), timeoutMs: 200 }), /remark/);
  assert.equal(i, OVERPASS.length);
  // JSON تالف
  await assert.rejects(fetchMosques(me, 1000, { fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) }) }));
  await assert.rejects(fetchMosques(me, 1000, { fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ nope: 1 }) }) }), /bad-response/);
  // الميزانية الكلية تحدّ الانتظار مهما كثرت الخوادم
  const t1 = Date.now();
  await assert.rejects(fetchMosques(me, 1000, { fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('x')))), timeoutMs: 1000, budgetMs: 300 }));
  assert.ok(Date.now() - t1 < 900, 'انتهت ضمن الميزانية');
  // إلغاء أثناء قراءة الجسم
  const ac = new AbortController();
  const slowBody = () => Promise.resolve({ ok: true, json: () => new Promise((res) => setTimeout(() => res(okJson), 300)) });
  const p = fetchMosques(me, 1000, { fetchImpl: slowBody, signal: ac.signal });
  setTimeout(() => ac.abort(), 20);
  await assert.rejects(p, (e) => isAbort(e));
  // حدّ الاستعلام
  const many = { elements: Array.from({ length: 200 }, (_, k) => ({ type: 'node', id: k, lat: 35.9 + k * 0.001, lon: 36.6, tags: {} })) };
  const r2 = await fetchMosques(me, 5000, { fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve(many) }) });
  assert.equal(r2.limited, true);
});

test('LOG-03: صلاحية النتائج المحفوظة ١٥ دقيقة لنفس النطاق وضمن ٢٠٠ م', async () => {
  const { cacheFresh, FRESH_MS } = await import('../src/views/mosques.js');
  const c = { at: 1000000, lat: 35.93, lng: 36.63, radius: 2000, items: [] };
  assert.equal(cacheFresh(c, 2000, { lat: 35.93, lng: 36.63 }, 1000000 + 60000), true);
  assert.equal(cacheFresh(c, 1000, { lat: 35.93, lng: 36.63 }, 1000000 + 60000), false, 'نطاق آخر');
  assert.equal(cacheFresh(c, 2000, { lat: 35.93, lng: 36.63 }, 1000000 + FRESH_MS + 1), false, 'انتهت الصلاحية');
  assert.equal(cacheFresh(c, 2000, { lat: 35.933, lng: 36.63 }, 1000000 + 60000), false, 'انتقال ~٣٣٠ م');
  assert.equal(cacheFresh(null, 2000, null), false);
});

// ---------- الإصدار ١٫٥ ----------
import { readFileSync } from 'node:fs';
import { nightParts } from '../src/views/qiyam.js';
import { inQuiet } from '../src/services.js';
import { homeLayout, visibleCards, HOME_CARDS, SHORTCUTS, MAX_SHORTCUTS, DEFAULT_SHORTCUTS } from '../src/home-layout.js';

test('قيام الليل: النصف والثلث الأخير من المغرب إلى الفجر', () => {
  const p = nightParts('17:00', '05:00');
  assert.equal(p.len, 720);
  assert.equal(p.half, '23:00');
  assert.equal(p.lastThird, '01:00');
  // ليل صيفي قصير: ١٩:٣٠ ← ٠٣:٣٠ = ٨ ساعات، والثلث الأخير يبدأ ٠٠:٥٠
  const s = nightParts('19:30', '03:30');
  assert.equal(s.len, 480);
  assert.equal(s.half, '23:30');
  assert.equal(s.lastThird, '00:50');
});

test('ساعات الهدوء: داخل الفترة وعبر منتصف الليل', () => {
  const at = (h, m = 0) => new Date(2026, 10, 11, h, m);
  const night = { on: true, from: '23:00', to: '05:00' };
  assert.equal(inQuiet(at(23, 30), night), true);
  assert.equal(inQuiet(at(2), night), true);
  assert.equal(inQuiet(at(5), night), false);
  assert.equal(inQuiet(at(22, 59), night), false);
  const day = { on: true, from: '13:00', to: '15:00' };
  assert.equal(inQuiet(at(14), day), true);
  assert.equal(inQuiet(at(16), day), false);
  assert.equal(inQuiet(at(23, 30), { ...night, on: false }), false);
});

test('ساعات الهدوء تمنع الفقاعة والتذكيرات المخصّصة ولا تمنع الصلاة', () => {
  const saved = JSON.stringify(state.settings);
  const savedRem = state.reminders;
  try {
    state.settings.overlay = true;
    state.settings.notif.morning = { on: true, time: '06:30' };
    state.settings.notif.evening = { on: false, time: '17:00' };
    state.settings.notif.sleep = { on: false, time: '22:30' };
    state.reminders = [{ id: 'r1', kind: 'qiyam', on: true, time: '03:30', mode: 'day' }];
    const now = new Date(2026, 10, 11, 12, 0);
    const before = buildOverlays(now).length;
    const remBefore = buildNotifications(now).filter((n) => n.route === '#/quran').length;
    assert.ok(before > 0 && remBefore > 0);
    state.settings.notif.prayers = true;
    const allBefore = buildNotifications(now).filter((n) => n.route !== '#/quran').length;
    state.settings.quiet = { on: true, from: '02:00', to: '07:00' };
    assert.equal(buildOverlays(now).length, 0, 'الفقاعة في ساعات الهدوء');
    assert.equal(buildNotifications(now).filter((n) => n.route !== '#/quran').length, allBefore, 'تنبيهات الصلاة والأذكار لا تتأثر بساعات الهدوء');
    assert.equal(buildNotifications(now).filter((n) => n.route === '#/quran').length, 0, 'تذكير قيام الليل في ساعات الهدوء');
  } finally {
    Object.assign(state.settings, JSON.parse(saved));
    state.reminders = savedRem;
  }
});

test('تخصيص الرئيسية: الترتيب والإخفاء والاختصارات وبطاقات التحديثات الجديدة', () => {
  const def = homeLayout(null);
  assert.deepEqual(def.order, HOME_CARDS.map((c) => c.id));
  assert.deepEqual(def.shortcuts, DEFAULT_SHORTCUTS);
  // ترتيب محفوظ قديم ينقصه بطاقة وفيه معرّف لم يعد موجوداً
  const l = homeLayout({ order: ['streak', 'gone', 'prayer'], hidden: ['ayah', 'gone'], shortcuts: ['qibla', 'qibla', 'nope', ...SHORTCUTS.map((x) => x.id)] });
  assert.deepEqual(l.order.slice(0, 2), ['streak', 'prayer']);
  assert.equal(l.order.length, HOME_CARDS.length);
  assert.deepEqual(l.hidden, ['ayah']);
  assert.equal(l.shortcuts[0], 'qibla');
  assert.equal(l.shortcuts.length, MAX_SHORTCUTS);
  assert.equal(new Set(l.shortcuts).size, l.shortcuts.length);
  assert.ok(visibleCards({ order: [], hidden: ['ayah'], shortcuts: [] }).indexOf('ayah') === -1);
  // كل اختصار يفتح صفحة موجودة في التطبيق
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const s of SHORTCUTS) {
    const route = s.to.replace(/^#\//, '').split('/')[0];
    assert.ok(new RegExp(`\\b${route}\\b`).test(main.match(/const ROUTES = \{[^}]*\}/)[0]) || route === 'read', `اختصار ${s.id} يفتح صفحة غير موجودة`);
  }
});

test('سلامة إعدادات ١٫٥: التأجيل والهدوء والتخصيص والورد الخاص', () => {
  const st = sanitize(JSON.parse(JSON.stringify({ ...DEFAULTS, settings: { ...DEFAULTS.settings, snooze: [0, 15, 15, 'x', 9999, 5], quiet: { on: 1, from: '25:00', to: '05:00' }, home: { order: 'bad' } }, mywird: [{ id: 'morning-0', n: 0 }, { n: 3 }, 'x'], qiyam: { manual: 1, maghrib: '17:00', fajr: 'x' } })));
  assert.deepEqual(st.settings.snooze, [5, 15]);
  assert.deepEqual(st.settings.quiet, { on: true, from: '23:00', to: '05:00' });
  assert.equal(st.settings.home, null);
  assert.deepEqual(st.mywird, [{ id: 'morning-0', n: 1 }]);
  assert.equal(st.qiyam, null);
  const empty = sanitize(JSON.parse(JSON.stringify({ ...DEFAULTS, settings: { ...DEFAULTS.settings, snooze: [] } })));
  assert.deepEqual(empty.settings.snooze, [5, 15, 30, 60]);
});

// ---------- الإصدار ١٫٦: «ادعُ لأخيك» ----------
import { cardHeading, sourceLine, cardPlainText, DEFAULT_SPEC } from '../src/duacard.js';
import { duaText, LOVED_DUAS } from '../src/data/loved-duas.js';

test('بطاقة الدعاء: العنوان والاسم المخفي والصيغة والمصدر ونص المشاركة', () => {
  const base = { ...DEFAULT_SPEC, name: 'عبد الرحمن بن محمد بن عبد الله الطويل', text: 'جَزَاكَ اللَّهُ خَيْرًا.', source: 'رواه الترمذي', kind: 'mathur' };
  // الاسم الطويل كاملاً دون قص
  assert.equal(cardHeading(base), 'دعوة طيبة لعبد الرحمن بن محمد بن عبد الله الطويل');
  // إخفاء الاسم: لا يظهر في العنوان ولا في نص المشاركة
  const hidden = { ...base, hideName: true };
  assert.equal(cardHeading(hidden), 'دعوة طيبة لشخص عزيز');
  assert.ok(cardPlainText(hidden).indexOf('عبد الرحمن') === -1);
  // المأثور يُنسب لمصدره، والمعدّل «بتصرّف» دون مصدر، ونص المستخدم بلا نسبة
  assert.equal(sourceLine(base), 'رواه الترمذي');
  assert.equal(sourceLine({ ...base, kind: 'edited' }), 'دعاء بتصرّف');
  assert.equal(sourceLine({ ...base, kind: 'own' }), '');
  assert.equal(sourceLine({ ...base, adapted: true }), 'رواه الترمذي (بتصريف الضمير)');
  // «لا تنسوه/تنسوها/تنسوهم» بحسب الصيغة، فقط عند تفعيلها
  assert.ok(cardPlainText(base).indexOf('لا تنسوه') === -1);
  assert.ok(cardPlainText({ ...base, headline: true, form: 'f' }).indexOf('لا تنسوها من دعائكم') !== -1);
  assert.ok(cardPlainText({ ...base, headline: true, form: 'p' }).indexOf('لا تنسوهم من دعائكم') !== -1);
  // بطاقة ذكر: الاسم اختياري
  assert.equal(cardHeading({ ...base, type: 'text', name: '' }), '');
  // نص المشاركة لا يحوي غير ما في البطاقة
  const txt = cardPlainText({ ...base, signature: 'أخوك' });
  assert.deepEqual(txt.split('\n\n'), ['دعوة طيبة لعبد الرحمن بن محمد بن عبد الله الطويل', 'جَزَاكَ اللَّهُ خَيْرًا.', 'رواه الترمذي', '— أخوك']);
});

test('الصيغة: له ولها ولهم تُطبَّق على أدعية الغائب فقط', () => {
  const dead = LOVED_DUAS.find((d) => d.id === 'd-tathbit');
  assert.deepEqual(duaText(dead, 'f'), { t: dead.tf, adapted: true });
  assert.deepEqual(duaText(dead, 'p'), { t: dead.tp, adapted: true });
  assert.deepEqual(duaText(dead, 'm'), { t: dead.t, adapted: false });
  const ayah = LOVED_DUAS.find((d) => d.id === 'p-irham');
  assert.deepEqual(duaText(ayah, 'f'), { t: ayah.t, adapted: false });
});

test('سلامة بيانات «لمن تحب»: الأشخاص والدعوات والتصاميم', () => {
  const st = sanitize(JSON.parse(JSON.stringify({ ...DEFAULTS, loved: [{ id: 'p1', name: 'أحمد', form: 'x', duas: [{ id: 'd1', t: 'اللهم' }, { t: '' }, 'x'], count: -3 }, { id: 'p2', name: '  ' }, 'bad'], cardDraft: 'bad', cardDesigns: [{ id: 'c1', spec: {} }, { spec: 1 }] })));
  assert.equal(st.loved.length, 1);
  assert.equal(st.loved[0].form, 'm');
  assert.deepEqual(st.loved[0].duas, [{ id: 'd1', t: 'اللهم' }]);
  assert.equal(st.loved[0].count, 0);
  assert.equal(st.cardDraft, null);
  assert.equal(st.cardDesigns.length, 1);
});

test('الخطوط والثيمات وحجم التطبيق: قيم صالحة فقط، والقديم يعود للافتراضي', () => {
  const st = sanitize(JSON.parse(JSON.stringify({ ...DEFAULTS, settings: { ...DEFAULTS.settings, theme: 'abyss', uiFont: 'comic', textFont: 'ruqaa', uiScale: 5 } })));
  assert.equal(st.settings.theme, 'abyss');
  assert.equal(st.settings.uiFont, 'plex');
  assert.equal(st.settings.textFont, 'ruqaa');
  assert.equal(st.settings.uiScale, 1);
  // كل خط اختياري له ملفاته في الحزمة
  const fonts = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
  assert.ok(/UI_FONTS, TEXT_FONTS/.test(fonts));
});

// ---------- سجل الزكاة والصدقات ----------
import { statusOf, delivered, remaining, totals, allocatedFor, filterPeople, addDelivery, sanitizeBook } from '../src/zakatlog.js';

test('سجل الزكاة: التسليم الجزئي والكامل، وفصل الزكاة عن الصدقة والعملات', () => {
  const a = { id: 'a', name: 'أسرة أبي محمد', kind: 'fam', type: 'zakat', group: 'الأقارب', amount: 100, currency: '$', deliveries: [], saveId: 's1' };
  const b = { id: 'b', name: 'يتيم', kind: 'ind', type: 'sadaqa', group: 'عام', amount: 50, currency: '$', deliveries: [] };
  const c = { id: 'c', name: 'جار', kind: 'ind', type: 'zakat', group: 'عام', amount: 200000, currency: 'ل.س', deliveries: [], saveId: 's1' };
  assert.equal(statusOf(a), 'none');
  assert.ok(addDelivery(a, 40));
  assert.equal(statusOf(a), 'partial');
  assert.equal(remaining(a), 60);
  // لا يُسلَّم أكثر من المتبقي
  assert.ok(addDelivery(a, 1000));
  assert.equal(delivered(a), 100);
  assert.equal(statusOf(a), 'done');
  assert.equal(addDelivery(a, 5), false);
  const t = totals([a, b, c]);
  assert.equal(t.length, 3, 'الزكاة بالدولار والصدقة بالدولار والزكاة بالليرة مجاميع منفصلة');
  assert.deepEqual(t.map((x) => [x.type, x.currency]), [['zakat', '$'], ['zakat', 'ل.س'], ['sadaqa', '$']]);
  assert.equal(t[0].delivered, 100);
  assert.equal(t[2].remaining, 50);
  // المخصّص من حساب محفوظ: الزكاة المرتبطة به فقط
  assert.equal(allocatedFor('s1', [a, b, c]), 200100);
  assert.equal(allocatedFor('s2', [a, b, c]), 0);
  assert.deepEqual(filterPeople([a, b, c], { type: 'sadaqa' }).map((x) => x.id), ['b']);
  assert.deepEqual(filterPeople([a, b, c], { status: 'done' }).map((x) => x.id), ['a']);
  assert.deepEqual(filterPeople([a, b, c], { group: 'عام', q: 'جار' }).map((x) => x.id), ['c']);
});

test('سجل الزكاة: تصحيح البيانات التالفة دون فقد الصالحة', () => {
  const b = sanitizeBook({ groups: ['الأقارب', '', 5], saves: [{ id: 's1', due: -4 }, 'x'], people: [
    { id: 'p1', name: 'أحمد', type: 'x', kind: 'y', group: 'غير موجودة', amount: '12.345', deliveries: [{ amount: 5 }, { amount: -1 }], dueDate: 'غد' },
    { id: 'p2', name: '' }, null] });
  assert.deepEqual(b.groups, ['عام', 'الأقارب']);
  assert.equal(b.saves.length, 1);
  assert.equal(b.saves[0].due, 0);
  assert.equal(b.people.length, 1);
  const p = b.people[0];
  assert.deepEqual([p.type, p.kind, p.group, p.amount, p.dueDate, p.deliveries.length], ['zakat', 'ind', 'عام', 12.35, '', 1]);
  assert.equal(sanitizeBook('bad'), null);
});

test('تقرير الزكاة للطباعة: عربي منسّق، والهاتف والملاحظات لا تظهر إلا باختيار المستخدم', async () => {
  const { reportHtml } = await import('../src/views/zakat.js');
  const people = [{ id: 'a', name: 'أسرة <b>س</b>', kind: 'fam', type: 'zakat', group: 'عام', amount: 100, currency: '$', phone: '0999123456', note: 'حي الميدان', deliveries: [{ amount: 40 }] }];
  const plain = reportHtml(people, []);
  assert.ok(/dir="rtl"/.test(plain) && /سجل الزكاة والصدقات/.test(plain));
  assert.ok(plain.indexOf('0999123456') === -1 && plain.indexOf('حي الميدان') === -1);
  assert.ok(plain.indexOf('<b>س</b>') === -1, 'الأسماء تُهرَّب');
  const full = reportHtml(people, [], { phone: true, notes: true });
  assert.ok(full.indexOf('0999123456') !== -1 && full.indexOf('حي الميدان') !== -1);
});

// ---------- تدقيق ١٫٥: أخطاء أُصلحت ولا يجوز أن تعود ----------
import { serialize } from '../src/store.js';

test('الحفظ: صورة خلفية البطاقة لا تُكتب في التخزين ولا في النسخة الاحتياطية، وبقية المسودة تبقى', () => {
  const saved = state.cardDraft;
  try {
    state.cardDraft = { name: 'أحمد', text: 'دعاء', bgImage: `data:image/jpeg;base64,${'A'.repeat(200000)}` };
    const out = serialize();
    assert.ok(out.length < 150000, 'الصورة تسرّبت إلى التخزين');
    const back = JSON.parse(out).cardDraft;
    assert.deepEqual([back.name, back.text, back.bgImage], ['أحمد', 'دعاء', '']);
    assert.ok(state.cardDraft.bgImage.length > 1000, 'الصورة يجب أن تبقى في الذاكرة أثناء الجلسة');
  } finally { state.cardDraft = saved; }
});

test('التنسيقات: كل ارتفاع بوحدة vh مقسوم على نسبة تكبير الخط حتى لا تتجاوز النوافذ الشاشة', () => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const all = css.match(/\d+vh/g) || [];
  const safe = css.match(/calc\(\d+vh \/ var\(--zoom, 1\)\)/g) || [];
  assert.ok(all.length > 5);
  assert.equal(all.length, safe.length, 'يوجد vh غير مقسوم على --zoom');
});

// ---------- توقيع المطوّر ----------
import { devSignature, DEVELOPER } from '../src/dev-signature.js';

test('توقيع المطوّر: المحتوى المعتمد وروابط التواصل الثلاثة صحيحة، والنص مهرَّب', () => {
  const html = devSignature();
  for (const t of ['تطوير وتصميم', 'حسين محمد علي الطويل', 'اللهم بارك في علمه وعمله', 'وأجراً لا ينقطع.', '«لا تنسَ المطوّر ووالديه من دعوة صادقة بظهر الغيب».', 'تواصل مع المطوّر']) assert.ok(html.indexOf(t) !== -1, `ينقص: ${t}`);
  assert.deepEqual(DEVELOPER.links.map((l) => l.href), ['https://t.me/HUSSEIN_TAWEEL', 'https://wa.me/963958700900', 'mailto:husseintaweel2022@gmail.com']);
  for (const l of DEVELOPER.links) assert.ok(html.indexOf(`href="${l.href}"`) !== -1);
  assert.ok(devSignature({ ...DEVELOPER, name: '<b>x</b>' }).indexOf('<b>x</b>') === -1);
});

// ---------- خطة التدقيق: المرحلة ١ ----------
import { replaceAll, clearAll, createDefaultState } from '../src/store.js';

test('SEC-01: الحذف يعيد حالة نظيفة مستقلة، والافتراضيات لا تتلوث', () => {
  const backup = serialize();
  try {
    const before = JSON.stringify(DEFAULTS);
    clearAll();
    state.history['2026-01-01'] = { m: 1, e: 1, p: 0, r: 5, t: 0, pr: [0, 0, 0, 0, 0] };
    state.favorites.push('morning-0');
    state.tasbih.total = 99;
    state.settings.notif.morning.on = true;
    assert.equal(JSON.stringify(DEFAULTS), before, 'تعديل الحالة غيّر الافتراضيات');
    clearAll();
    assert.deepEqual(state.history, {});
    assert.deepEqual(state.favorites, []);
    assert.equal(state.tasbih.total, 0);
    assert.equal(state.settings.notif.morning.on, false);
    const a = createDefaultState();
    const b = createDefaultState();
    a.history.x = 1;
    a.settings.snooze.push(99);
    assert.deepEqual(b.history, {});
    assert.deepEqual(b.settings.snooze, [5, 15, 30, 60]);
  } finally { replaceAll(JSON.parse(backup)); }
});

test('SEC-02: بيانات مستوردة تالفة لا تعطّل التطبيق ولا تستبدل الحالة جزئياً', () => {
  const backup = serialize();
  try {
    // أشكال تالفة لكن بإعدادات صالحة: تُصلَح دون استثناء
    for (const bad of [{ settings: {}, quran: null }, { settings: {}, tasbih: 5 }, { settings: {}, app: [] }, { settings: { notif: null } }, { settings: {}, history: { 'x<b>': 1, '2026-01-02': 'x' } }]) {
      replaceAll(bad);
      assert.ok(state.quran && typeof state.tasbih.count === 'number' && typeof state.app === 'object' && state.settings.notif.morning);
      assert.deepEqual(Object.keys(state.history), []);
    }
    // ملفات ليست نسخة من سكينة: ترمي خطأً ولا تمسّ الحالة
    state.favorites = ['morning-1'];
    for (const bad of [null, [], 5, 'x', { settings: null }, { quran: {} }]) {
      assert.throws(() => replaceAll(bad));
      assert.deepEqual(state.favorites, ['morning-1']);
    }
    // تلويث النماذج الأولية مرفوض
    replaceAll(JSON.parse('{"settings":{},"__proto__":{"polluted":1},"quran":{"constructor":{"x":1}}}'));
    assert.equal({}.polluted, undefined);
    // معرّفات بعلامات HTML أو مكررة تُحذف
    replaceAll({ settings: {}, favorites: ['morning-0', 'morning-0', '"><img src=x onerror=alert(1)>'], custom: [{ id: 'custom-a', t: 'x' }, { id: 'custom-a', t: 'y' }, { id: 'a b', t: 'z' }],
      loved: [{ id: 'p"x', name: 'أ' }, { id: 'p-1', name: 'ب', last: '<b>' }], reminders: [{ id: 'r1', kind: 'custom', title: 5 }, { id: 'r1', kind: 'monthu' }], mywird: [{ id: '<x>', n: 3 }] });
    assert.deepEqual(state.favorites, ['morning-0']);
    assert.deepEqual(state.custom.map((c) => c.t), ['x']);
    assert.deepEqual(state.loved.map((p) => [p.id, p.last]), [['p-1', '']]);
    assert.deepEqual(state.reminders.map((r) => [r.id, r.title]), [['r1', '']]);
    assert.deepEqual(state.mywird, []);
    assert.equal(state.schema, 2);
  } finally { replaceAll(JSON.parse(backup)); }
});

test('SEC-04: الروابط العميقة تقبل المضيف open ومسارات آمنة فقط', async () => {
  const { deepLinkRoute, safeRoute } = await import('../src/native.js');
  assert.equal(deepLinkRoute('sakina://open/read/morning'), '#/read/morning');
  assert.equal(deepLinkRoute('sakina://open'), '#/home');
  assert.equal(deepLinkRoute('sakina://open/mushaf/293:2140'), '#/mushaf/293:2140');
  for (const bad of ['sakina://open-other/home', 'sakina://evil/home', 'https://open/home', 'sakina://open/read/<x>', 'sakina://open/../../x', 'sakina://open/home/a/b', '', null]) assert.equal(deepLinkRoute(bad), null, String(bad));
  assert.equal(safeRoute('#/zakat/log'), '#/zakat/log');
  assert.equal(safeRoute('javascript:alert(1)'), null);
});

test('LOG-05: تذكير الليلة السابقة يطرح يوماً تقويمياً حتى عند تغيّر التوقيت الصيفي', async () => {
  const { occurrences } = await import('../src/reminders.js');
  // الاثنين ٣٠ مارس ٢٠٢٦ (بعد بدء التوقيت الصيفي في لندن ليلة ٢٩): التذكير مساء الأحد ٢٩
  const r = { id: 'a', kind: 'monthu', on: true, time: '20:00', mode: 'eve' };
  const occ = occurrences(r, new Date(2026, 2, 27, 12, 0), 5);
  const mon = occ.find((o) => /الاثنين/.test(o.title));
  assert.ok(mon, 'وُجد تذكير الاثنين');
  assert.equal(mon.at.getDate(), 29);
  assert.equal(mon.at.getDay(), 0);
  assert.equal(mon.at.getHours(), 20);
  // نهاية التوقيت الصيفي: الخميس ٢٩ أكتوبر ٢٠٢٦ بعد ليلة ٢٥ أكتوبر؛ والاثنين ٢٦ ← الأحد ٢٥
  const occ2 = occurrences(r, new Date(2026, 9, 24, 12, 0), 3);
  const mon2 = occ2.find((o) => /الاثنين/.test(o.title));
  assert.equal(mon2.at.getDate(), 25);
  assert.equal(mon2.at.getHours(), 20);
});

test('LOG-05: الموعد الأحادي يجب أن يكون تاريخاً صالحاً في المستقبل', async () => {
  const { onceValid } = await import('../src/views/reminders.js');
  const now = new Date(2026, 5, 10, 12, 0);
  assert.equal(onceValid({ date: '2026-06-11', time: '08:00' }, now), true);
  assert.equal(onceValid({ date: '2026-06-10', time: '11:59' }, now), false, 'مضى');
  assert.equal(onceValid({ date: '2026-02-30', time: '08:00' }, now), false, 'تاريخ غير موجود');
  assert.equal(onceValid({ date: '', time: '08:00' }, now), false);
});

test('LOG-08: الأوقات غير المتاحة في خطوط العرض القصوى تكون null لا Invalid Date', async () => {
  const { computeTimes, PRAYERS } = await import('../src/prayer.js');
  const tromso = { lat: 69.65, lng: 18.96 };
  for (const date of [{ y: 2026, m: 6, d: 21 }, { y: 2026, m: 12, d: 21 }]) {
    const t = computeTimes(date, tromso, { method: 'mwl' });
    for (const p of PRAYERS) assert.ok(t[p.key] === null || Number.isFinite(t[p.key].getTime()), `${p.key} ${date.m}`);
    assert.equal(t.sunrise, null, 'لا شروق ولا غروب في منتصف الصيف/الشتاء القطبي');
    assert.ok(t.dhuhr instanceof Date, 'الظهر متاح دائماً');
  }
  const { fmtTime } = await import('../src/views/common.js');
  assert.equal(fmtTime(null, 'UTC'), '—');
  // موقع عادي: كل الأوقات متاحة
  const t2 = computeTimes({ y: 2026, m: 6, d: 21 }, { lat: 35.93, lng: 36.63 }, { method: 'mwl' });
  for (const p of PRAYERS) assert.ok(t2[p.key] instanceof Date);
});

test('LOG-09: نافذة شهر للصلوات، والحد ٣٠٠ بترتيب زمني، والأحادي البعيد لا يضيع', () => {
  const now = new Date(2026, 9, 31, 1, 0);
  state.settings.notif.prayers = true;
  // صلوات وحدها: شهر كامل تقريباً
  let list = buildNotifications(now);
  const prayers = list.filter((n) => n.title.indexOf('حان وقت صلاة') === 0);
  assert.ok(prayers.length >= 145, `صلوات ${prayers.length}`);
  assert.ok(prayers[prayers.length - 1].at - now > 28 * 86400000, 'تمتد قرابة شهر');
  // تذكيرات كثيرة جداً: لا تجاوز للحد، وصلوات الأسبوع الأول محفوظة، والمختار هو الأقرب زمناً
  state.reminders = Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, kind: 'qiyam', on: true, time: '03:30' }));
  list = buildNotifications(now);
  assert.equal(list.length, MAX_SCHEDULED);
  assert.ok(list.filter((n) => n.title.indexOf('حان وقت صلاة') === 0 && n.at - now < 7 * 86400000).length >= 34);
  const timed = list.filter((n) => n.at);
  const latest = Math.max(...timed.map((n) => n.at.getTime()));
  assert.ok(latest - now < 20 * 86400000, 'المواعيد البعيدة تسقط قبل القريبة');
  assert.equal(new Set(list.map((n) => n.id)).size, list.length);
  // موعد أحادي بعد شهرين
  state.settings.notif.prayers = false;
  state.reminders = [{ id: 'once', kind: 'custom', on: true, time: '09:00', repeat: 'once', date: '2026-12-31', title: 'موعد', body: '', mode: 'day', days: [] }];
  list = buildNotifications(now);
  assert.equal(list.length, 1);
  assert.equal(list[0].at.getMonth(), 11);
  state.reminders = [];
});

test('LOG-11: سعر كل معدن مملوك مطلوب، والعملة تتطابق مع الحساب، ولا يقل المبلغ عن المسلَّم', async () => {
  const { computeZakat } = await import('../src/zakat.js');
  const { allocatedFor, personError, sanitizeBook } = await import('../src/zakatlog.js');
  // نصاب الفضة وذهب مملوك بلا سعر
  let r = computeZakat({ basis: 'silver', silverPrice: 1, gold: { 24: 100 }, goldPrice: 0, cash: 10000 });
  assert.equal(r.missingPrice, true);
  assert.deepEqual(r.missing, ['gold']);
  assert.equal(r.reached, false);
  // والعكس: نصاب الذهب وفضة مملوكة بلا سعر
  r = computeZakat({ basis: 'gold', goldPrice: 100, silver: 500, silverPrice: 0, cash: 100000 });
  assert.deepEqual(r.missing, ['silver']);
  // مكتمل
  r = computeZakat({ basis: 'gold', goldPrice: 100, silver: 500, silverPrice: 1, cash: 100000 });
  assert.equal(r.missingPrice, false);
  assert.equal(r.reached, true);
  // العملات لا تُجمع في المخصص لحساب
  const saves = [{ id: 's1', currency: '$', due: 100 }];
  const people = [
    { id: 'a', type: 'zakat', saveId: 's1', currency: '$', amount: 40, deliveries: [] },
    { id: 'b', type: 'zakat', saveId: 's1', currency: '€', amount: 30, deliveries: [] },
  ];
  assert.equal(allocatedFor('s1', people, saves), 40);
  assert.match(personError(null, { type: 'zakat', saveId: 's1', currency: '€', amount: 10 }, saves), /عملة/);
  assert.equal(personError(null, { type: 'zakat', saveId: 's1', currency: '$', amount: 10 }, saves), '');
  // تسليم جزئي ثم خفض المبلغ أو تغيير العملة
  const p = { id: 'c', type: 'zakat', currency: '$', amount: 50, deliveries: [{ amount: 30 }] };
  assert.match(personError(p, { type: 'zakat', currency: '$', amount: 20, saveId: '' }, saves), /سُلِّم/);
  assert.match(personError(p, { type: 'zakat', currency: '€', amount: 50, saveId: '' }, saves), /العملة/);
  assert.match(personError(p, { type: 'sadaqa', currency: '$', amount: 50, saveId: '' }, saves), /النوع/);
  // نسخة مستوردة متناقضة تُصحّح
  const fixed = sanitizeBook({ saves, people: [{ id: 'd', name: 'س', type: 'zakat', currency: '€', saveId: 's1', amount: 5, deliveries: [{ id: 'x', amount: 20 }] }] });
  assert.equal(fixed.people[0].amount, 20);
  assert.equal(fixed.people[0].saveId, '');
});

test('LOG-12: حذف ذكر خاص يزيل مراجعه من المفضلة والورد والتقدّم', async () => {
  const { removeCustom, state: st } = await import('../src/store.js');
  st.custom = [{ id: 'custom-x', t: 'سبحان الله', n: 3 }];
  st.favorites = ['custom-x', 'm1'];
  st.mywird = [{ id: 'custom-x', n: 3 }, { id: 'm1', n: 1 }];
  st.progress.counts['custom-x'] = 2;
  removeCustom('custom-x');
  assert.equal(st.custom.length, 0);
  assert.deepEqual(st.favorites, ['m1']);
  assert.deepEqual(st.mywird.map((w) => w.id), ['m1']);
  assert.equal(st.progress.counts['custom-x'], undefined);
  st.favorites = []; st.mywird = [];
});

test('LOG-12: shareText يميّز النسخ الفاشل والإلغاء', async () => {
  const { shareText, isShareCancel } = await import('../src/native.js');
  assert.equal(isShareCancel({ message: 'Share canceled' }), true);
  assert.equal(isShareCancel({ name: 'AbortError' }), true);
  assert.equal(isShareCancel(new Error('boom')), false);
  const nav = globalThis.navigator;
  const doc = globalThis.document;
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: () => Promise.reject(new Error('denied')) } }, configurable: true });
  globalThis.document = { createElement: () => { throw new Error('no dom'); } };
  try {
    assert.equal(await shareText('x'), 'failed', 'لا «نُسخ» زائفة عند فشل النسخ');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    globalThis.document = doc;
  }
});

test('BLD-07: مخزن عامل الخدمة باسم الإصدار، والحذف محصور بمخازن سكينة، وبديل HTML للتنقل فقط', async () => {
  const { VERSION } = await import('../src/version.js');
  const sw = readFileSync(new URL('../www/sw.js', import.meta.url), 'utf8');
  assert.ok(sw.indexOf(`const CACHE = \`\${PREFIX}${VERSION}\``) !== -1, 'اسم المخزن يطابق الإصدار');
  assert.match(sw, /k\.indexOf\(PREFIX\) === 0/);
  assert.match(sw, /e\.request\.mode === 'navigate'/);
});

test('BLD-02: لا Object.fromEntries ولا flatMap في شيفرة التطبيق (WebView أندرويد ٨)', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
  const files = walk(new URL('../src', import.meta.url).pathname);
  for (const f of files) {
    const s = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/Object\.fromEntries|\.flatMap\(|\.flat\(\)/.test(s), f);
  }
});

test('FEAT-04: بيانات الويدجت مرتبة لشهر، وتبدأ بآخر صلاة مضت، وتحمل الورد المناسب', async () => {
  const { widgetData } = await import('../src/services.js');
  const now = new Date(2026, 9, 31, 13, 0);
  const d = widgetData(now);
  assert.ok(d.items.length >= 145 && d.items.length <= 160, `${d.items.length}`);
  for (let i = 1; i < d.items.length; i++) assert.ok(d.items[i].at > d.items[i - 1].at);
  assert.ok(d.items[0].at <= now.getTime() && d.items[1].at > now.getTime(), 'الأول آخر صلاة مضت');
  const byK = Object.fromEntries(d.items.map((x) => [x.k, x.wird]));
  assert.deepEqual(byK, { fajr: 'morning', dhuhr: 'morning', asr: 'evening', maghrib: 'evening', isha: 'sleep' });
  assert.ok(typeof d.city === 'string' && typeof d.tz === 'string');
  assert.ok(d.items.every((x) => /^#?/.test(x.wird) && /^[a-z]+$/.test(x.wird)), 'مسار الورد آمن للرابط العميق');
});
