// فحص تكبير خط التطبيق (١٤٠٪): النوافذ السفلية لا تتجاوز الشاشة، والسحب في تخصيص الرئيسية يعمل، ولا تمرير أفقي.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../www');
const VERSION = fs.readFileSync(path.join(__dirname, '../../src/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
  const browser = await chromium.launch();
  const errors = [];
  for (const scale of [0.85, 1.4]) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, locale: 'ar' });
    await ctx.addInitScript(([v, sc]) => { if (!localStorage.getItem('sakina.v1')) localStorage.setItem('sakina.v1', JSON.stringify({ settings: { uiScale: sc, location: { type: 'city', cityId: 5 } }, app: { welcomed: true, lastSeenVersion: v, autoUpdate: false } })); }, [VERSION, scale]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${scale}: ${e.message}`));
    // نافذة طويلة: اختيار المدينة، ونافذة اسم من أسماء الله
    for (const [route, act] of [['settings', '[data-act="set-city"]'], ['names', '.name-card']]) {
      await page.goto(`${base}#/${route}`);
      await page.waitForTimeout(400);
      await page.click(act);
      await page.waitForTimeout(600);
      const box = await page.$eval('.sheet', (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: window.innerHeight }; });
      if (box.top < -1) errors.push(`${scale} #/${route}: النافذة تتجاوز أعلى الشاشة (${Math.round(box.top)})`);
      if (box.bottom > box.vh + 2) errors.push(`${scale} #/${route}: النافذة تتجاوز أسفل الشاشة`);
    }
    for (const route of ['home', 'quran', 'library/daily', 'library/awrad', 'library/feel', 'library/loved', 'more', 'about', 'settings', 'customize', 'reminders', 'journal', 'tasbih', 'zakat/calc', 'zakat/people', 'card/new', 'loved', 'read/morning', 'mushaf/2', 'suras', 'qiyam', 'hadith/nawawi', 'prophets', 'hajj/hajj', 'names', 'mywird']) {
      await page.goto(`${base}#/${route}`);
      await page.waitForTimeout(500);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (sw) errors.push(`${scale} #/${route}: تمرير أفقي`);
    }
    // السحب بالمقبض مع التكبير
    await page.goto(`${base}#/customize`);
    await page.waitForTimeout(400);
    const first = await page.$eval('.cz-row', (r) => r.dataset.id);
    const hb = await (await page.$('.cz-row:nth-child(1) [data-handle]')).boundingBox();
    const tb = await (await page.$('.cz-row:nth-child(3)')).boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, tb.y + tb.height - 3, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const order = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('sakina.v1')).settings.home; return s && s.order; });
    if (!order || order[0] === first || order.indexOf(first) !== 2) errors.push(`${scale}: السحب مع التكبير وضع البطاقة في موضع خاطئ: ${order && order.slice(0, 4)}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  if (errors.length) { console.error(`✗ مشكلات مع تكبير الخط:\n${errors.join('\n')}`); process.exit(1); }
  console.log('✓ تكبير الخط (٨٥٪ و١٤٠٪): النوافذ داخل الشاشة، والسحب يعمل، ولا تمرير أفقي');
})();
