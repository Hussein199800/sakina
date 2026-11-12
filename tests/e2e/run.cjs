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
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar', timezoneId: 'Africa/Cairo', hasTouch: true, geolocation: { latitude: 35.9306, longitude: 36.6339 }, permissions: ['geolocation'] });
    await ctx.addInitScript(([t, v]) => {
      if (!localStorage.getItem('sakina.v1')) localStorage.setItem('sakina.v1', JSON.stringify({ settings: { theme: t, location: { type: 'city', cityId: 5 } }, app: { welcomed: true, lastSeenVersion: v, autoUpdate: false } }));
    }, [theme, VERSION]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${theme}: ${e.message}`));
    // بيانات OpenStreetMap وهمية طوال الجلسة: لا يعتمد الاختبار على الإنترنت
    let overpassCalls = 0;
    await page.route('**/api/interpreter**', (route) => {
      overpassCalls += 1;
      route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [
        { type: 'node', id: 1, lat: 35.9336, lon: 36.6349, tags: { 'name:ar': 'الجامع الكبير' } },
        { type: 'way', id: 2, center: { lat: 35.9290, lon: 36.6300 }, tags: { name: 'جامع الروضة' } },
        { type: 'node', id: 3, lat: 35.9400, lon: 36.6200, tags: {} },
      ] }) });
    });

    // أخطاء تحميل الشبكة متوقعة في اختبار انقطاع خدمة الخرائط، ولها فحص خاص
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${theme}: ${m.text()}`); });
    const routes = theme === 'oasis'
      ? ['home', 'quran', 'mushaf/1', 'mushaf/50', 'library', 'read/morning', 'read/evening:3', 'tasbih', 'more', 'journal', 'reminders', 'settings', 'qibla', 'names', 'whatsnew', 'read/favorites', 'read/custom', 'read/salawat', 'read/hamd', 'zakat', 'group', 'mosques', 'suras', 'suras/112', 'read/anger', 'read/distress', 'library/awrad', 'library/feel', 'feel/angry', 'feel/sick', 'qiyam', 'customize', 'mywird', 'about', 'read/istighfar', 'read/mywird', 'library/loved', 'loved', 'card/new', 'zakat/people', 'zakat/log', 'hadith/nawawi', 'hadith/riyad', 'prophets', 'hajj/umrah', 'hajj/hajj']
      : ['home', 'quran', 'mushaf/2', 'read/morning', 'more', 'suras/96'];
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
      await page.click('.mood-scroll [data-to="#/feel/grateful"]');
      await page.waitForTimeout(500);
      if (!/#\/feel\/grateful$/.test(page.url())) errors.push(`بطاقة المشاعر لم تفتح صفحة الحالة: ${page.url()}`);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-feel.png') });
      await page.click('[data-mood-tap]');
      await page.goto(`${base}#/library/daily`);
      await page.fill('#lib-q', 'استغفر');
      await page.waitForTimeout(200);
      const n = await page.$$eval('.result', (els) => els.length);
      if (!n) errors.push('البحث بدون تشكيل لم يُرجع نتائج');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-search.png') });
      // حاسبة الزكاة: سعر الذهب ونقود بأرقام هندية
      await page.goto(`${base}#/zakat/calc`);
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

      // المساجد القريبة: موقع وهمي في إدلب وبيانات OpenStreetMap وهمية (لا يعتمد الاختبار على الإنترنت)
      await page.goto(`${base}#/mosques`);
      await page.waitForTimeout(500);
      overpassCalls = 0;
      await page.click('[data-act="mq-search"]');
      await page.waitForTimeout(1500);
      const mq = await page.$$eval('.mq-row b', (els) => els.map((e) => e.textContent));
      if (mq.length !== 3 || mq[0] !== 'الجامع الكبير' || mq[2] !== 'مسجد') errors.push(`قائمة المساجد غير صحيحة: ${mq}`);
      if ((await page.$$('.mq-dot')).length !== 3) errors.push('الرادار لا يعرض المساجد');
      if (overpassCalls !== 1) errors.push(`عدد طلبات البحث ${overpassCalls} بدل ١ (تكرار أو حلقة)`);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-mosques.png'), fullPage: true });
      // فشل الخدمة: رسالة واضحة دون تكرار البحث بلا نهاية
      await page.unroute('**/api/interpreter**');
      let failCalls = 0; // ٣ خوادم = ٣ محاولات لكل بحث
      await page.route('**/api/interpreter**', (route) => { failCalls += 1; route.abort(); });
      await page.click('[data-act="mq-search"]');
      await page.waitForTimeout(1500);
      if (!(await page.$('.note'))) errors.push('لا تظهر رسالة عند تعذّر البحث');
      if (failCalls > 3) errors.push(`حلقة بحث عند الخطأ: ${failCalls} طلباً`);
      if (!(await page.$('.mq-row'))) errors.push('اختفت النتائج المحفوظة عند فشل البحث');
      await page.unroute('**/api/interpreter**');
      await page.goto(`${base}#/home`);
      await page.waitForTimeout(400);
      const tile = await page.textContent('.tile-mosque b');
      if (tile !== 'الجامع الكبير') errors.push(`بطاقة الرئيسية لا تعرض أقرب مسجد: ${tile}`);

      // مداخل السور: البوابة من تبويب القرآن، وفتح سورة، والآية المستشهد بها من المصحف
      await page.goto(`${base}#/quran`);
      await page.waitForTimeout(400);
      await page.click('.si-gate');
      await page.waitForTimeout(400);
      if (!/#\/suras$/.test(page.url())) errors.push(`بوابة مداخل السور لم تُفتح: ${page.url()}`);
      const cards = await page.$$eval('.si-card', (x) => x.length);
      if (cards !== 114) errors.push(`عدد السور في مداخل السور ${cards}`);
      await page.click('#sura-2 .si-head');
      await page.waitForTimeout(900);
      const s2 = await page.textContent('#sura-2');
      for (const w of ['لماذا سُمّيت', 'متى نزلت', 'سبب نزولها', 'من مقاصد السورة', 'عدد آياتها', '٢٨٦ آية', 'بقرة']) if (s2.indexOf(w) === -1) errors.push(`بطاقة البقرة لا تحوي «${w}»`);
      const ay = await page.textContent('#sura-2 .si-ayah');
      if (!/﴿.*بَقَرَةً.*﴾/.test(ay)) errors.push(`آية التسمية لم تُعرض من المصحف: ${ay}`);
      await page.fill('[data-sq]', 'الكهف');
      await page.waitForTimeout(200);
      const found = await page.$$eval('.si-card', (x) => x.map((e) => e.id));
      if (found.join() !== 'sura-18') errors.push(`البحث في مداخل السور: ${found.join()}`);
      await page.fill('[data-sq]', '');
      await page.goto(`${base}#/quran`);
      await page.waitForTimeout(400);
      await page.click('.sura-info-btn[data-to="#/suras/112"]');
      await page.waitForTimeout(600);
      const s112 = await page.textContent('#sura-112');
      if (s112.indexOf('أُبيّ بن كعب') === -1) errors.push('زر النبذة لا يفتح سورة الإخلاص مفتوحة');
      // أذكار المواقف في تبويب الأذكار، والرابط من المشاعر
      await page.goto(`${base}#/library/daily`);
      await page.fill('#lib-q', '');
      await page.waitForTimeout(400);
      const lib = await page.textContent('#view');
      for (const w of ['أذكار المواقف والأحوال', 'عند الغضب', 'الريح والرعد', 'الهمّ والكرب']) if (lib.indexOf(w) === -1) errors.push(`تبويب الأذكار لا يعرض «${w}»`);
      // ١٫٥: تبويبات الأذكار الفرعية
      await page.click('[data-act="lib-tab"][data-k="awrad"]');
      await page.waitForTimeout(400);
      const aw = await page.textContent('#view');
      for (const w of ['ورد الاستغفار', 'ورد التكبير والتهليل', 'ورد التسبيح', 'وردي الخاص']) if (aw.indexOf(w) === -1) errors.push(`تبويب الأوراد لا يعرض «${w}»`);
      await page.click('[data-act="lib-tab"][data-k="feel"]');
      await page.waitForTimeout(400);
      const fc = await page.$$eval('.feel-card', (x) => x.length);
      if (fc < 11) errors.push(`صيدلية الروح فيها ${fc} حالات فقط`);
      // وردي الخاص: إضافة ذكر ثم قراءته
      await page.goto(`${base}#/mywird`);
      await page.waitForTimeout(300);
      await page.click('[data-act="mw-add"]');
      await page.waitForTimeout(400);
      await page.fill('.sheet [data-q]', 'سبحان الله وبحمده');
      await page.waitForTimeout(200);
      await page.click('.sheet .mw-pick [data-id]');
      await page.waitForTimeout(400);
      await page.click('[data-act="mw-n"][data-d="1"]');
      await page.waitForTimeout(300);
      const mw = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).mywird);
      if (!mw || mw.length !== 1 || !(mw[0].n > 1)) errors.push(`وردي الخاص لم يُحفظ: ${JSON.stringify(mw)}`);
      await page.goto(`${base}#/read/mywird`);
      await page.waitForTimeout(400);
      if ((await page.$$('.reader-empty')).length) errors.push('قراءة وردي الخاص تعرض صفحة فارغة');
      // تخصيص الرئيسية: إخفاء بطاقة وتحريكها وإضافة اختصار
      await page.goto(`${base}#/customize`);
      await page.waitForTimeout(300);
      await page.click('[data-act="cz-toggle"][data-id="ayah"]');
      await page.waitForTimeout(200);
      await page.click('[data-act="cz-move"][data-id="streak"][data-d="-1"]');
      await page.waitForTimeout(200);
      await page.click('[data-act="cz-sc"][data-id="zakat"]');
      await page.waitForTimeout(300);
      await page.goto(`${base}#/home`);
      await page.waitForTimeout(400);
      if (await page.$('.tile-ayah')) errors.push('بطاقة آية اليوم ما زالت ظاهرة بعد إخفائها');
      if (!(await page.$('.sc-grid [data-to="#/zakat"]'))) errors.push('الاختصار المضاف لا يظهر في الرئيسية');
      // السحب بالمقبض يغيّر الترتيب
      await page.goto(`${base}#/customize`);
      await page.waitForTimeout(300);
      const first = await page.$eval('.cz-row', (r) => r.dataset.id);
      const hb = await (await page.$('.cz-row:nth-child(1) [data-handle]')).boundingBox();
      const tb = await (await page.$('.cz-row:nth-child(4)')).boundingBox();
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(hb.x + hb.width / 2, tb.y + tb.height - 4, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const ord = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).settings.home.order);
      if (ord[0] === first) errors.push(`السحب لم يغيّر الترتيب: ${ord.slice(0, 4)}`);
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-customize.png'), fullPage: true });
      await page.click('[data-act="cz-reset"]');
      await page.waitForTimeout(400);
      await page.click('.sheet .btn-primary');
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')));
      if (after.settings.home !== null) errors.push('الاستعادة لم تُرجع الترتيب الافتراضي');
      if (!after.mywird || after.mywird.length !== 1) errors.push('استعادة الرئيسية حذفت بيانات أخرى');
      // ١٫٦: دعواتي — إضافة شخص، ودعوت الآن، ودعوة خاصة
      await page.goto(`${base}#/loved`);
      await page.waitForTimeout(300);
      await page.click('.empty [data-act="lv-add"]');
      await page.waitForTimeout(400);
      await page.fill('.sheet [data-name]', 'فاطمة بنت عبد الله بن محمد الطويل');
      await page.click('.sheet [data-form="f"]');
      await page.click('.sheet [data-save]');
      await page.waitForTimeout(500);
      if (!/#\/loved\/p-/.test(page.url())) errors.push(`إضافة شخص لم تفتح صفحته: ${page.url()}`);
      await page.click('[data-act="lv-prayed"]');
      await page.waitForTimeout(300);
      await page.click('.lv-head [data-act="lv-dua"]');
      await page.waitForTimeout(400);
      await page.fill('.sheet [data-t]', 'دعوة سرية خاصة بها');
      await page.click('.sheet [data-save]');
      await page.waitForTimeout(400);
      const lv = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).loved);
      if (!lv || lv.length !== 1 || lv[0].form !== 'f' || lv[0].count !== 1 || lv[0].duas.length !== 1) errors.push(`دعواتي لم تُحفظ كما يجب: ${JSON.stringify(lv)}`);
      // إنشاء بطاقة من صفحة الشخص: الاسم والصيغة فقط، دون الدعوة الخاصة
      await page.click('[data-to^="#/card/p:"]');
      await page.waitForTimeout(500);
      const nm = await page.inputValue('[data-f="name"]');
      if (nm !== 'فاطمة بنت عبد الله بن محمد الطويل') errors.push(`البطاقة لم تأخذ الاسم: ${nm}`);
      await page.click('[data-act="cd-next"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="cd-occ"][data-k="dead"]');
      await page.waitForTimeout(200);
      await page.click('.cd-sug >> nth=0');
      await page.waitForTimeout(300);
      let draft = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).cardDraft);
      if (draft.text.indexOf('دعوة سرية') !== -1) errors.push('الدعوة الخاصة تسرّبت إلى البطاقة');
      if (!/لَهَا/.test(draft.text) || !draft.adapted || draft.kind !== 'mathur') errors.push(`الصيغة لم تُطبَّق على الدعاء: ${JSON.stringify(draft).slice(0, 160)}`);
      // تعديل النص المأثور يجعله «بتصرّف»
      await page.fill('[data-f="text"]', `${draft.text} وارزقها الفردوس`);
      await page.waitForTimeout(300);
      draft = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).cardDraft);
      if (draft.kind !== 'edited') errors.push('تعديل النص المأثور لم يُعلَّم «بتصرّف»');
      if ((await page.textContent('.cd-kind')).indexOf('بتصرّف') === -1) errors.push('لا يظهر تنبيه «بتصرّف»');
      await page.click('[data-act="cd-next"]');
      await page.waitForTimeout(1500);
      if (!(await page.$('[data-preview] img'))) errors.push('لا تظهر معاينة البطاقة');
      if (await page.$eval('[data-act="cd-share-img"]', (b) => b.disabled)) errors.push('أزرار المشاركة معطّلة دون سبب');
      if (shots) await page.screenshot({ path: path.join(OUT, 'oasis-card.png') });
      // الصورة المصدّرة تطابق المعاينة: نفس دالة الرسم ونفس المقاس
      const sz = await page.$eval('[data-preview] img', (i) => [i.naturalWidth, i.naturalHeight]);
      if (sz.join() !== '1080,1920') errors.push(`مقاس الحالة غير صحيح: ${sz}`);
      // حفظ التصميم ثم ظهوره في «لمن تحب»
      await page.click('[data-act="cd-menu"]');
      await page.waitForTimeout(400);
      await page.click('.sheet [data-m="save"]');
      await page.waitForTimeout(400);
      // نص طويل جداً في مقاس مربع: تنبيه وتعطيل المشاركة بدل تصغير النص
      await page.click('[data-act="cd-step"][data-n="2"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="cd-occ"][data-k="own"]');
      await page.waitForTimeout(300);
      await page.fill('[data-f="text"]', 'اللهم اغفر لها وارحمها '.repeat(60));
      await page.click('[data-act="cd-next"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="cd-panel"][data-k="size"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="cd-set"][data-v="square"]');
      await page.waitForTimeout(1500);
      if (await page.$eval('[data-warn]', (e) => e.hidden)) errors.push('لا يظهر تنبيه طول النص');
      if (!(await page.$eval('[data-act="cd-share-img"]', (b) => b.disabled))) errors.push('المشاركة متاحة رغم تجاوز النص');
      await page.goto(`${base}#/library/loved`);
      await page.waitForTimeout(400);
      if (!(await page.$('[data-to^="#/card/d:"]'))) errors.push('التصميم المحفوظ لا يظهر في «لمن تحب»');
      if (await page.$('#lib-q')) errors.push('بحث الأذكار ظاهر في «لمن تحب»');
      // ١٫٧: الزكاة — حفظ الحساب، ومستحق مرتبط به، وتسليم جزئي، والسجل والطباعة
      await page.goto(`${base}#/zakat/calc`);
      await page.waitForTimeout(400);
      await page.click('[data-act="z-save"]');
      await page.waitForTimeout(300);
      const zb = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).zakatBook);
      if (!zb || zb.saves.length !== 1) errors.push(`لم يُحفظ حساب الزكاة في السجل: ${JSON.stringify(zb)}`);
      await page.click('[data-act="z-tab"][data-k="people"]');
      await page.waitForTimeout(400);
      await page.click('.z-fab');
      await page.waitForTimeout(400);
      await page.click('.sheet [data-kind="fam"]');
      await page.fill('.sheet [data-pf="name"]', 'أسرة أبي أحمد');
      await page.fill('.sheet [data-pf="amount"]', '١٥٠٠');
      await page.click('.sheet .zp-more summary');
      await page.selectOption('.sheet [data-pf="saveId"]', { index: 1 });
      await page.click('.sheet [data-save]');
      await page.waitForTimeout(400);
      await page.click('.zp-row');
      await page.waitForTimeout(400);
      await page.fill('.sheet [data-dl]', '٥٠٠');
      await page.click('.sheet [data-deliver]');
      await page.waitForTimeout(400);
      const zp = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).zakatBook.people[0]);
      if (!zp || zp.amount !== 1500 || zp.deliveries.length !== 1 || zp.deliveries[0].amount !== 500 || !zp.saveId) errors.push(`المستحق أو التسليم الجزئي غير صحيح: ${JSON.stringify(zp)}`);
      if ((await page.textContent('.zp-row')).indexOf('تسليم جزئي') === -1) errors.push('لا تظهر حالة التسليم الجزئي');
      await page.click('[data-act="z-tab"][data-k="log"]');
      await page.waitForTimeout(400);
      if (!(await page.$('.zl-total.zakat'))) errors.push('لا تظهر مجاميع الزكاة في السجل');
      await page.selectOption('[data-zf="status"]', 'done');
      await page.waitForTimeout(200);
      if (await page.$('[data-zlog] .zp-row')) errors.push('تصفية «مُسلَّم» تعرض مستحقاً لم يكتمل تسليمه');
      await page.selectOption('[data-zf="status"]', '');
      await page.waitForTimeout(200);
      await page.click('[data-act="zl-print"]');
      await page.waitForTimeout(400);
      if (!(await page.$('.sheet [data-ph]'))) errors.push('نافذة خيارات الطباعة لا تظهر');
      await page.click('.sheet [data-close]');
      await page.waitForTimeout(300);
      // ١٫٨: الأحاديث وقصص الأنبياء والحج والعمرة
      await page.goto(`${base}#/hadith/nawawi`);
      await page.waitForTimeout(900);
      const hn = await page.$$eval('.hd-card', (x) => x.length);
      if (hn !== 20) errors.push(`الأربعون النووية: تظهر ${hn} بطاقة بدل ٢٠ في الصفحة الأولى`);
      await page.click('[data-act="hd-more"]');
      await page.waitForTimeout(400);
      await page.click('[data-act="hd-more"]');
      await page.waitForTimeout(400);
      if ((await page.$$eval('.hd-card', (x) => x.length)) !== 42) errors.push('الأربعون النووية لا تكتمل ٤٢ حديثاً');
      await page.click('.hd-card[data-n="1"]');
      await page.waitForTimeout(500);
      if ((await page.textContent('.sheet .hadith-full')).indexOf('بِالنِّيَّاتِ') === -1) errors.push('الحديث الأول لا يظهر كاملاً');
      await page.click('.sheet [data-close]').catch(() => page.keyboard.press('Escape'));
      await page.waitForTimeout(300);
      await page.goto(`${base}#/hadith/riyad`);
      await page.waitForTimeout(1500);
      await page.fill('[data-hq]', 'الحياء من الايمان');
      await page.waitForTimeout(800);
      const rq = await page.$$eval('.hd-card', (x) => x.length);
      if (!rq) errors.push('البحث في رياض الصالحين بلا تشكيل لا يجد «الحياء من الإيمان»');
      await page.goto(`${base}#/prophets`);
      await page.waitForTimeout(400);
      if ((await page.$$eval('.pr-card', (x) => x.length)) !== 25) errors.push('قصص الأنبياء ليست ٢٥');
      await page.click('.pr-card:nth-child(11) summary');
      await page.waitForTimeout(200);
      await page.click('.pr-card:nth-child(11) .chip');
      await page.waitForTimeout(900);
      if (!/#\/mushaf\/\d+:\d+/.test(page.url())) errors.push(`آيات القصة لا تفتح المصحف: ${page.url()}`);
      await page.goto(`${base}#/hajj/umrah`);
      await page.waitForTimeout(400);
      await page.click('[data-to="#/hajj/hajj"]');
      await page.waitForTimeout(400);
      if ((await page.textContent('#view')).indexOf('يوم عرفة') === -1) errors.push('تبويب الحج لا يعرض يوم عرفة');
      // قيام الليل: إدخال يدوي
      await page.goto(`${base}#/qiyam`);
      await page.waitForTimeout(300);
      await page.click('[data-act="qy-mode"][data-m="manual"]');
      await page.waitForTimeout(300);
      const qy = await page.textContent('.qy-big');
      if (!/[٠-٩]/.test(qy)) errors.push(`قيام الليل لا يعرض وقتاً: ${qy}`);
      // الإعدادات: مدد التأجيل وساعات الهدوء
      await page.goto(`${base}#/settings`);
      await page.waitForTimeout(300);
      await page.click('[data-act="set-snooze"][data-m="10"]');
      await page.waitForTimeout(200);
      if ((await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).settings.snooze)).length !== 4) errors.push('أُضيفت مدة خامسة للتأجيل');
      await page.click('[data-act="set-snooze"][data-m="60"]');
      await page.waitForTimeout(200);
      await page.click('[data-act="set-snooze"][data-m="10"]');
      await page.waitForTimeout(200);
      await page.click('[data-act="set-quiet"]');
      await page.waitForTimeout(300);
      const st = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')).settings);
      if (st.snooze.join() !== '5,10,15,30') errors.push(`مدد التأجيل: ${st.snooze}`);
      if (!st.quiet.on) errors.push('ساعات الهدوء لم تُفعَّل');
      if (!(await page.$('[data-quiet="from"]'))) errors.push('لا يظهر وقت بداية الهدوء');
      await page.goto(`${base}#/home`);
      await page.waitForTimeout(400);
      await page.click('.mood-scroll [data-to="#/feel/anxious"]');
      await page.waitForTimeout(500);
      await page.click('.feel-page [data-to="#/read/fear"]');
      await page.waitForTimeout(500);
      if (!/#\/read\/fear$/.test(page.url())) errors.push(`زر الأذكار من المشاعر لم يفتح باب الخوف: ${page.url()}`);

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
    await page.waitForTimeout(1000);
    if (!(await page.$('.setup'))) errors.push('شاشة التخصيص الأولي لم تظهر للمستخدم الجديد');
    // المرور بخطوات التخصيص: الثيم الليلي، الأرقام اللاتينية، وضع القائمة، تذكير الصباح، ختمة ٥ صفحات
    const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(OUT, `setup-${n}.png`) }); };
    await shot(1);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250); await shot(2);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250);
    await page.click('[data-act="su-theme"][data-k="midnight"]'); await page.waitForTimeout(200);
    await page.click('[data-act="su-digits"][data-k="latn"]'); await page.waitForTimeout(200); await shot(3);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250);
    await page.click('[data-act="su-mode"][data-k="list"]'); await page.waitForTimeout(200); await shot(4);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250);
    await page.click('[data-act="su-notif"][data-k="morning"]'); await page.waitForTimeout(200); await shot(5);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250);
    await page.click('[data-act="su-plan"][data-p="5"]'); await page.waitForTimeout(200); await shot(6);
    await page.click('[data-act="su-next"]'); await page.waitForTimeout(250); await shot(7);
    await page.click('[data-act="su-finish"]'); await page.waitForTimeout(800);
    const st0 = await page.evaluate(() => JSON.parse(localStorage.getItem('sakina.v1')));
    const s0 = st0.settings;
    if (s0.theme !== 'midnight' || s0.digits !== 'latn' || s0.readMode !== 'list' || !s0.notif.morning.on || !st0.khatma || st0.khatma.perDay !== 5 || !st0.app.welcomed) errors.push(`خيارات التخصيص لم تُحفظ: ${JSON.stringify({ t: s0.theme, d: s0.digits, m: s0.readMode, k: st0.khatma })}`);
    if (!(await page.$('.sky'))) errors.push('لم ينتقل إلى الرئيسية بعد التخصيص');
    await shot('home');
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
