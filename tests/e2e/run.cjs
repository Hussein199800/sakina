// اختبار واجهة سريع: يفتح كل الشاشات في Chromium بحجم هاتف، ويتأكد من غياب أخطاء JavaScript، ويحفظ لقطات
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '../../www');
const OUT = path.join(__dirname, 'out');
// الإصدار الحالي حتى لا تظهر نافذة «ما الجديد» في الاختبارات التي لا تخصّها
const VERSION = fs.readFileSync(path.join(__dirname, '../../src/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/index.html`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  const shots = process.argv.includes('--shots');
  for (const theme of ['oasis', 'midnight', 'dawn', 'royal']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', timezoneId: 'Africa/Cairo', hasTouch: true });
    await ctx.addInitScript(([t, v]) => {
      if (!localStorage.getItem('sakina.v1')) localStorage.setItem('sakina.v1', JSON.stringify({ settings: { theme: t, location: { type: 'city', cityId: 5 } }, app: { welcomed: true, lastSeenVersion: v, autoUpdate: false } }));
    }, [theme, VERSION]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${theme}: ${m.text()}`); });
    const routes = theme === 'oasis'
      ? ['home', 'quran', 'mushaf/1', 'mushaf/50', 'library', 'read/morning', 'read/evening:3', 'tasbih', 'more', 'journal', 'reminders', 'settings', 'qibla', 'names', 'whatsnew', 'read/favorites', 'read/custom', 'read/salawat', 'read/hamd', 'zakat', 'group']
      : ['home', 'quran', 'mushaf/2', 'read/morning', 'more'];
    for (const r of routes) {
      await page.goto(`${base}#/${r}`);
      await page.waitForTimeout(r.startsWith('mushaf') || r === 'quran' ? 900 : 450);
      if (shots) await page.screenshot({ path: path.join(OUT, `${theme}-${r.replace(/[/:]/g, '_')}.png`), fullPage: !['read/morning', 'quran', 'mushaf/1', 'mushaf/2'].includes(r) });
    }
    if (theme === 'oasis') {
      // تفاعلات أساسية
      await page.goto(`${base}#/read/morning`);
      await page.waitForTimeout(300);
      await page.click('.big-counter');
      await page.waitForTimeout(800);
      const label = await page.textContent('[data-rb-count]');
      if (!/١ من/.test(label)) errors.push(`عدّاد القارئ لم يتقدّم: ${label}`);
      await page.click('[data-act="r-mode"]');
      await page.waitForTimeout(300);
      await page.click('.d-card:nth-child(2) .pill-counter');
      await page.goto(`${base}#/tasbih`);
      for (let i = 0; i < 5; i++) await page.click('[data-tb-tap]');
      const c = await page.textContent('[data-tb-count]');
      if (c.trim() !== '٥') errors.push(`المسبحة لم تعدّ: ${c}`);
      await page.goto(`${base}#/home`);
      await page.waitForTimeout(300);
      await page.click('[data-act="mood"]');
      await page.waitForTimeout(500);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-mood-sheet.png') });
      await page.click('[data-mood-tap]');
      await page.goto(`${base}#/library`);
      await page.fill('#lib-q', 'استغفر');
      await page.waitForTimeout(200);
      const n = await page.$$eval('.result', (els) => els.length);
      if (!n) errors.push('البحث بدون تشكيل لم يُرجع نتائج');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-search.png') });
      // حاسبة الزكاة: سعر الذهب ونقود بأرقام هندية
      await page.goto(`${base}#/zakat`);
      await page.waitForTimeout(300);
      await page.fill('[data-z="goldPrice"]', '٤٠٠٠');
      await page.fill('[data-z="cash"]', '400000');
      await page.waitForTimeout(200);
      const due = await page.textContent('.z-due b');
      if (due.trim() !== '١٠٬٠٠٠٫٠٠') errors.push(`ناتج الزكاة غير صحيح: ${due}`);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-zakat-result.png'), fullPage: true });
      // الختمة الجماعية: ثلاثة مشاركين وإتمام نصيب أحدهم
      await page.goto(`${base}#/group`);
      await page.waitForTimeout(300);
      await page.click('[data-act="g-new"]');
      await page.waitForTimeout(300);
      await page.fill('#g-name', 'ختمة العائلة');
      await page.fill('#g-members', 'محمد\nأحمد\nفاطمة');
      await page.click('[data-save]');
      await page.waitForTimeout(400);
      const rows = await page.$$eval('.gc-row small', (els) => els.map((e) => e.textContent));
      if (rows.join('|') !== 'الأجزاء ١–١٠|الأجزاء ١١–٢٠|الأجزاء ٢١–٣٠') errors.push(`توزيع الختمة الجماعية خاطئ: ${rows}`);
      await page.click('.gc-check');
      await page.waitForTimeout(300);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-group.png'), fullPage: true });
      // مصمّم بطاقة المشاركة
      await page.goto(`${base}#/read/morning`);
      await page.waitForTimeout(400);
      await page.click('[data-act="d-image"] >> nth=0');
      await page.waitForTimeout(1500);
      await page.click('[data-bg="night"]');
      await page.click('[data-size="story"]');
      await page.waitForTimeout(1500);
      const imgOk = await page.$eval('[data-cd-img]', (i) => i.naturalWidth === 1080 && i.naturalHeight === 1920);
      if (!imgOk) errors.push('بطاقة المشاركة لم تُرسم بمقاس «حالة» ١٠٨٠×١٩٢٠');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-card-designer.png') });
      // منتقي الوقت في التذكيرات
      await page.goto(`${base}#/reminders`);
      await page.waitForTimeout(300);
      await page.click('[data-act="rem-base"][data-k="morning"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="rem-base-time"][data-k="morning"]');
      await page.waitForTimeout(300);
      await page.click('[data-dh="1"]');
      await page.click('[data-mm="15"]');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-time-picker.png') });
      await page.click('[data-ok]');
      await page.waitForTimeout(400);
      const t = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).settings.notif.morning.time);
      if (t !== '07:15') errors.push(`منتقي الوقت لم يحفظ القيمة الصحيحة: ${t}`);
      await page.click('[data-act="adhan-pick"]').catch(() => {});
      await page.waitForTimeout(300);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-adhan-voices.png') });

      // الختمة: بدء ختمة ثم قراءة ٥ صفحات
      await page.goto(`${base}#/quran`);
      await page.waitForTimeout(400);
      await page.click('[data-act="k-new"]');
      await page.waitForTimeout(400);
      await page.click('[data-k-save]');
      await page.waitForTimeout(400);
      await page.goto(`${base}#/mushaf/1`);
      await page.waitForTimeout(900);
      for (let i = 0; i < 5; i++) { await page.click('[data-act="m-next"]'); await page.waitForTimeout(150); }
      await page.waitForTimeout(400);
      const k = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sakina.v1')); return s.khatma; });
      if (!k || k.page !== 6) errors.push(`الختمة لم تتقدّم كما يجب: ${JSON.stringify(k && k.page)}`);
      await page.click('.ayah');
      await page.waitForTimeout(400);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-ayah-sheet.png') });
      // تذكير جديد بصيام الاثنين والخميس
      await page.goto(`${base}#/reminders`);
      await page.waitForTimeout(300);
      await page.click('[data-act="rem-new"][data-kind="monthu"]');
      await page.waitForTimeout(400);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-reminder-editor.png') });
      await page.click('[data-save]');
      await page.waitForTimeout(400);
      const rems = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).reminders);
      if (!rems.some((r) => r.kind === 'monthu' && r.on)) errors.push('لم يُحفظ التذكير');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-reminders-after.png'), fullPage: true });
      await page.goto(`${base}#/home`);
      await page.waitForTimeout(400);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-home-after.png'), fullPage: true });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')));
      if (!saved || !saved.progress || !Object.keys(saved.progress.counts).length) errors.push('لم يُحفظ التقدّم في localStorage');
    }
    await ctx.close();
  }
  // مستخدم جديد: تظهر شاشة الترحيب دون أخطاء
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', timezoneId: 'Asia/Baghdad' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`welcome: ${e.message}`));
    await page.goto(`${base}#/home`);
    await page.waitForTimeout(1200);
    if (!(await page.$('.welcome'))) errors.push('شاشة الترحيب لم تظهر للمستخدم الجديد');
    if (shots) await page.screenshot({ path: path.join(OUT, 'welcome.png') });
    await ctx.close();
  }
  // مستخدم من الإصدار ١٫٠: تظهر «ما الجديد» مرة واحدة
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('sakina.v1', JSON.stringify({ settings: { notif: { friday: true } }, app: { autoUpdate: false } })); } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`upgrade: ${e.message}`));
    await page.goto(`${base}#/home`);
    await page.waitForTimeout(1300);
    if (!(await page.$('.wn-block'))) errors.push('«ما الجديد» لم تظهر بعد التحديث');
    if (shots) await page.screenshot({ path: path.join(OUT, 'whatsnew-sheet.png') });
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')));
    if (!st.reminders.some((r) => r.kind === 'kahf')) errors.push('لم يُرحَّل تذكير الجمعة القديم');

    await ctx.close();
  }
  // تحديث متاح: الشريط في «المزيد» ونافذة التحديث مع إرشادات النسخة الاحتياطية
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar' });
    await ctx.addInitScript((v) => localStorage.setItem('sakina.v1', JSON.stringify({ app: { welcomed: true, lastSeenVersion: v, autoUpdate: false, latest: { code: 99, name: '9.9.9', url: '', notes: ['ميزة تجريبية'] } } })), VERSION);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`update: ${e.message}`));
    await page.goto(`${base}#/more`);
    await page.waitForTimeout(600);
    await page.click('[data-act="upd-show"]');
    await page.waitForTimeout(500);
    if (!(await page.$('.upd-help [data-act="data-export"]'))) errors.push('نافذة التحديث بلا زر النسخة الاحتياطية');
    if (shots) await page.screenshot({ path: path.join(OUT, 'update-sheet.png') });
    await ctx.close();
  }
  await browser.close();
  server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('✓ كل الشاشات تعمل بلا أخطاء');
})();
