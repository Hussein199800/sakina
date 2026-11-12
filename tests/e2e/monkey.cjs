// اختبار «الضغط على كل شيء»: يفتح كل صفحة ويضغط كل زر فيها (وكل زر في النافذة التي تُفتح)، ويفشل عند أي استثناء.
// يكشف الأعطال التي لا تغطيها المسارات المكتوبة يدوياً. التشغيل: node tests/e2e/monkey.cjs
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../www');
const VERSION = fs.readFileSync(path.join(__dirname, '../../src/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const ROUTES = ['home', 'quran', 'mushaf/3', 'suras', 'suras/2', 'group', 'library/daily', 'library/awrad', 'library/feel', 'library/loved', 'feel/angry', 'read/morning', 'read/mywird', 'read/custom', 'read/favorites',
  'tasbih', 'more', 'about', 'whatsnew', 'journal', 'reminders', 'settings', 'customize', 'mywird', 'loved', 'card/new', 'qibla', 'qiyam', 'names', 'zakat/calc', 'zakat/people', 'zakat/log',
  'mosques', 'hadith/nawawi', 'hadith/riyad', 'prophets', 'hajj/umrah', 'hajj/hajj', 'setup'];
// أزرار تغادر التطبيق أو تمسح حالة الاختبار عمداً
const SKIP = ['app-share', 'data-export', 'upd-check', 'setup-again', 'back'];

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const SEED = {
  settings: { theme: 'oasis', location: { type: 'city', cityId: 5 } },
  app: { welcomed: true, lastSeenVersion: VERSION, autoUpdate: false },
  custom: [{ id: 'custom-a1', t: 'اللهم اغفر لي', n: 3, note: '' }],
  favorites: ['morning-0', 'custom-a1'],
  mywird: [{ id: 'morning-1', n: 3 }, { id: 'custom-a1', n: 7 }],
  loved: [{ id: 'p-1', name: 'أحمد بن محمد', form: 'm', duas: [{ id: 'd-1', t: 'اللهم احفظه' }], count: 2, last: '' }],
  zakat: { currency: '$', goldKarat: 24, goldPrice: 80, silverPrice: 1, basis: 'gold', cash: 12000, gold: {}, silver: 0, trade: 0, receivables: 0, debts: 0 },
  zakatBook: { groups: ['عام', 'الأقارب'], saves: [{ id: 's1', at: '2026-11-01T10:00:00.000Z', label: 'حساب', currency: '$', basis: 'gold', net: 12000, nisab: 6800, due: 300, reached: true }],
    people: [{ id: 'z1', name: 'أسرة', kind: 'fam', type: 'zakat', group: 'عام', amount: 100, currency: '$', phone: '', note: '', dueDate: '', saveId: 's1', deliveries: [{ id: 'x', at: '2026-11-02T10:00:00.000Z', amount: 40 }] }] },
  reminders: [{ id: 'r1', kind: 'custom', on: true, time: '20:00', mode: 'day', title: 'تذكير', body: '', repeat: 'daily', days: [] }],
  khatma: { page: 5, perDay: 5, startPage: 1, time: '20:00', remind: true, log: {}, startedAt: '2026-11-01' },
  groups: [],
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const errors = [];
  let clicks = 0;
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ar', hasTouch: true, geolocation: { latitude: 35.93, longitude: 36.63 }, permissions: ['geolocation'] });
    await ctx.addInitScript((seed) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sakina.v1', JSON.stringify(seed)); sessionStorage.setItem('seeded', '1'); } }, SEED);
    await ctx.route(/overpass|maps\.mail\.ru|raw\.githubusercontent/, (r) => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"elements":[]}' }));
    const page = await ctx.newPage();
    let where = route;
    page.on('pageerror', (e) => errors.push(`#/${where}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(`#/${where} (console): ${m.text().slice(0, 200)}`); });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const open = async () => { await page.goto(`${base}#/${route}`); await page.waitForTimeout(route.startsWith('mushaf') || route.startsWith('hadith') ? 900 : 350); };
    await open();
    const sig = (el) => el.evaluate((e) => `${e.dataset.act || ''}|${e.dataset.k || e.dataset.id || e.dataset.to || e.dataset.n || e.dataset.i || ''}|${e.className}`);
    const targets = await page.$$eval('#view [data-act], #view summary', (els) => els.length);
    for (let i = 0; i < Math.min(targets, 45); i++) {
      // إعادة فتح الصفحة قبل كل زر حتى لا تتأثر النتيجة بما سبق
      if (!page.url().endsWith(`#/${route}`) || await page.$('.sheet')) await open();
      const els = await page.$$('#view [data-act], #view summary');
      const el = els[i];
      if (!el) break;
      const s = await sig(el).catch(() => '');
      if (SKIP.some((k) => s.startsWith(`${k}|`))) continue;
      if (!(await el.isVisible().catch(() => false)) || !(await el.isEnabled().catch(() => false))) continue;
      where = `${route} ← ${s.slice(0, 60)}`;
      await el.click({ timeout: 2000 }).catch(() => {});
      clicks += 1;
      await page.waitForTimeout(260);
      // أزرار النافذة السفلية إن فُتحت (دون أزرار الحذف النهائي)
      const sheetBtns = await page.$$('.sheet button:not([data-close]), .sheet summary');
      for (let j = 0; j < Math.min(sheetBtns.length, 12); j++) {
        const b = (await page.$$('.sheet button:not([data-close]), .sheet summary'))[j];
        if (!b || !(await b.isVisible().catch(() => false))) continue;
        const bs = await b.evaluate((e) => e.outerHTML.slice(0, 70)).catch(() => '');
        where = `${route} ← ${s.slice(0, 40)} ← نافذة: ${bs}`;
        await b.click({ timeout: 1500 }).catch(() => {});
        clicks += 1;
        await page.waitForTimeout(160);
        if (!(await page.$('.sheet'))) break;
      }
      where = route;
      await open();
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  const uniq = [...new Set(errors)];
  if (uniq.length) { console.error(`✗ ${uniq.length} خطأ بعد ${clicks} ضغطة:\n${uniq.join('\n')}`); process.exit(1); }
  console.log(`✓ ${clicks} ضغطة على ${ROUTES.length} صفحة دون أي استثناء`);
})();
