// تدقيق آلي: خلط الأرقام العربية والهندية، وتجاوز عرض الشاشات الصغيرة، في كل الصفحات وبنظامي الأرقام
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '../../www');
const VERSION = fs.readFileSync(path.join(__dirname, '../../src/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});
const ROUTES = ['home', 'quran', 'mushaf/3', 'group', 'library', 'read/morning', 'read/salawat', 'read/hamd', 'tasbih', 'more', 'journal', 'reminders', 'settings', 'qibla', 'names', 'zakat', 'whatsnew'];
const problems = [];
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/index.html`;
  const b = await chromium.launch();
  for (const digits of ['arab', 'latn']) {
    for (const width of [360, 412]) {
      const ctx = await b.newContext({ viewport: { width, height: 760 }, locale: 'ar' });
      await ctx.addInitScript(([d, ver]) => localStorage.setItem('sakina.v1', JSON.stringify({ settings: { digits: d, location: { type: 'city', cityId: 5 } }, app: { welcomed: true, lastSeenVersion: ver, autoUpdate: false }, khatma: { startedAt: '2026-10-30', perDay: 5, time: '20:00', remind: true, page: 12, startPage: 1, log: {} }, reminders: [{ id: 'r1', kind: 'white', on: true, time: '21:00', mode: 'eve' }, { id: 'r2', kind: 'custom', on: true, time: '08:15', repeat: 'once', date: '2026-11-20', title: 'موعد' }] })), [digits, VERSION]);
      const page = await ctx.newPage();
      for (const r of ROUTES) {
        await page.goto(`${base}#/${r}`); await page.waitForTimeout(r.startsWith('mushaf') ? 900 : 350);
        const res = await page.evaluate((d) => {
          const bad = d === 'arab' ? /[0-9]/ : /[٠-٩]/;
          const out = [];
          const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.textContent.trim(); if (t && bad.test(t) && !/^A[+-]$/.test(t) && !c.parentElement.closest('[data-digit-sample]')) out.push(t.slice(0, 60)); } else if (c.nodeType === 1 && !['SCRIPT', 'STYLE', 'svg'].includes(c.tagName)) walk(c); } };
          walk(document.body);
          document.querySelectorAll('input').forEach((i) => { if (i.type !== 'search' && i.type !== 'file' && i.value && bad.test(i.value)) out.push(`[input ${i.type}] ${i.value}`); });
          const over = [...document.querySelectorAll('body *')].filter((e) => { const rc = e.getBoundingClientRect(); return rc.width > 0 && (rc.right > innerWidth + 1 || rc.left < -1) && !e.closest('.mood-scroll,.sheet-wrap,.tabbar,.sky-deco,svg'); }).slice(0, 3).map((e) => `${e.tagName}.${e.className}`.slice(0, 50));
          return { mixed: [...new Set(out)].slice(0, 8), over, sw: document.documentElement.scrollWidth > innerWidth };
        }, digits);
        if (res.mixed.length || res.over.length || res.sw) problems.push(`${digits} ${width}px #/${r}: ${JSON.stringify(res)}`);
      }
      await ctx.close();
    }
  }
  await b.close(); server.close();
  if (problems.length) { console.error(`✗ مشكلات في التناسق:\n${problems.join('\n')}`); process.exit(1); }
  console.log('✓ الأرقام موحّدة ولا تجاوز لعرض الشاشة في كل الصفحات (٣٦٠ و٤١٢ بكسل، بالنظامين)');
})();
