// اختبار واجهة سريع: يفتح كل الشاشات في Chromium بحجم هاتف، ويتأكد من غياب أخطاء JavaScript، ويحفظ لقطات
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '../../www');
const OUT = path.join(__dirname, 'out');
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
    await ctx.addInitScript((t) => {
      if (!localStorage.getItem('sakina.v1')) localStorage.setItem('sakina.v1', JSON.stringify({ settings: { theme: t, location: { type: 'city', cityId: 5 } }, app: { welcomed: true, lastSeenVersion: '1.1.0', autoUpdate: false } }));
    }, theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${theme}: ${m.text()}`); });
    const routes = theme === 'oasis'
      ? ['home', 'quran', 'mushaf/1', 'mushaf/50', 'library', 'read/morning', 'read/evening:3', 'tasbih', 'more', 'journal', 'reminders', 'settings', 'qibla', 'names', 'whatsnew', 'read/favorites', 'read/custom']
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
  await browser.close();
  server.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('✓ كل الشاشات تعمل بلا أخطاء');
})();
