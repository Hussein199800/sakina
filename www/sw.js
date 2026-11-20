// عامل خدمة بسيط لتشغيل نسخة الويب بلا إنترنت (لا يُستخدم داخل تطبيق أندرويد)
// اسم المخزن يحمل رقم الإصدار (يتحقق اختبار من مطابقته لـ src/version.js) فيُستبدل مع كل إصدار
const PREFIX = 'sakina-';
const CACHE = `${PREFIX}1.5.1`;
const SHELL = ['./', './index.html', './build/main.js', './build/styles.css', './build/fonts.css', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  // الهيكل الأساسي يُحفظ مسبقاً ليعمل التطبيق بلا إنترنت من أول زيارة
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // لا يُحذف إلا مخازن سكينة القديمة، لا أي مخزن آخر على النطاق نفسه
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.indexOf(PREFIX) === 0 && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // الشبكة أولاً ثم النسخة المحفوظة، حتى تصل التحديثات فوراً
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => {
    if (r) return r;
    // صفحة التطبيق بديلاً للتنقل فقط؛ لا تُعاد HTML مكان صورة أو JSON مفقود
    if (e.request.mode === 'navigate') return caches.match('./index.html');
    return new Response('', { status: 504, statusText: 'offline' });
  })));
});
