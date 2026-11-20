// طبقة موحّدة بين الويب وأندرويد (Capacitor): اهتزاز، مشاركة، نسخ، موقع، تنبيهات، شريط الحالة
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export const isNative = Capacitor.isNativePlatform();
const isAndroid = isNative && Capacitor.getPlatform() === 'android';

// ---------- الفقاعة العائمة فوق التطبيقات (أندرويد) ----------
const Overlay = registerPlugin('SakinaOverlay');
export const overlaySupported = isAndroid;

export async function overlayGranted() {
  if (!overlaySupported) return false;
  try { return !!(await Overlay.status()).granted; } catch (e) { return false; }
}
export async function openOverlaySettings() { if (overlaySupported) await Overlay.openSettings().catch(() => {}); }
/** @param {Array<{id:number, at:Date, title:string, body:string, route:string}>} items */
export async function scheduleOverlays(items, config = {}) {
  if (!overlaySupported) return;
  try { await Overlay.schedule({ items: items.map((i) => ({ ...i, at: i.at.getTime() })), snooze: config.snooze, quiet: config.quiet, digits: config.digits, enabled: config.enabled !== false }); } catch (e) { /* غير متاح */ }
}
export async function showOverlayNow(title, body, route) {
  if (!overlaySupported) return false;
  try { await Overlay.showNow({ title, body, route }); return true; } catch (e) { return false; }
}

// ---------- ويدجت الشاشة الرئيسية (أندرويد) ----------
const Widget = registerPlugin('SakinaWidget');
/** يرسل مواقيت الويدجت؛ لا يفشل التطبيق إن لم تتوفر الإضافة */
export async function updateWidget(data) {
  if (!isAndroid) return false;
  try { await Widget.update(data); return true; } catch (e) { return false; }
}

// ---------- التحديث من داخل التطبيق (أندرويد) ----------
const Updater = registerPlugin('SakinaUpdater');
export const inAppUpdateSupported = isAndroid;
export async function canInstallUpdates() {
  try { return !!(await Updater.canInstall()).granted; } catch (e) { return false; }
}
export const openInstallSettings = () => Updater.openInstallSettings().catch(() => {});
/**
 * ينزّل التحديث ويفتح المثبّت. onProgress(نسبة ٠–١٠٠ أو -١ إن كان الحجم مجهولاً)
 * @returns {Promise<void>} يرفض برسالة عربية ورمز (NETWORK, CORRUPT, MISMATCH, NOT_NEWER...)
 */
export async function downloadAndInstall(url, onProgress) {
  const sub = await Updater.addListener('progress', (p) => onProgress && onProgress(p.percent));
  try { await Updater.downloadAndInstall({ url }); } finally { sub.remove(); }
}

/** روابط sakina://open/... من الفقاعة: تُحوَّل إلى مسار داخل التطبيق */
/**
 * يحوّل رابط sakina://open/... إلى مسار داخلي آمن، أو null.
 * يُقبل المضيف open فقط، ومسار من حروف وأرقام وفواصل محدودة.
 */
export function deepLinkRoute(url) {
  const m = /^sakina:\/\/open(\/[A-Za-z0-9_:/-]{0,80})?\/?(?:[?#].*)?$/.exec(String(url || ''));
  if (!m) return null;
  return safeRoute(`#${m[1] || '/home'}`);
}
/** مسار تطبيق داخلي صالح (#/name أو #/name/param) أو null */
export function safeRoute(route) {
  return /^#\/[a-z]{2,20}(\/[A-Za-z0-9_:-]{1,64})?$/.test(String(route || '')) ? route : null;
}

export function onDeepLink(cb) {
  if (!isNative) return;
  const handle = (url) => { const r = deepLinkRoute(url); if (r) cb(r); };
  App.addListener('appUrlOpen', (e) => handle(e && e.url));
  App.getLaunchUrl().then((r) => handle(r && r.url)).catch(() => {});
}
export { App };

export function vibrate(strong = false) {
  if (isNative) Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(strong ? [18, 40, 18] : 12);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e2) { return false; }
  }
}

/** إلغاء المستخدم لنافذة المشاركة ليس فشلاً */
export const isShareCancel = (e) => /cancel|abort/i.test(`${(e && e.name) || ''} ${(e && e.message) || ''}`);

/** @returns {Promise<'shared'|'copied'|'cancelled'|'failed'>} */
export async function shareText(text, title = 'سكينة') {
  try {
    if (isNative) { await Share.share({ title, text, dialogTitle: 'مشاركة' }); return 'shared'; }
    if (navigator.share) { await navigator.share({ title, text }); return 'shared'; }
  } catch (e) {
    return isShareCancel(e) ? 'cancelled' : 'failed';
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}

const Printer = registerPlugin('SakinaPrint');
/** طباعة صفحة HTML عبر نافذة طباعة النظام (ومنها «حفظ كملف PDF») */
export async function printHtml(html, title = 'سكينة') {
  if (isAndroid) {
    try { await Printer.print({ html, title }); return true; } catch (e) { return false; }
  }
  try {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
    document.body.appendChild(f);
    f.contentDocument.open();
    f.contentDocument.write(html);
    f.contentDocument.close();
    setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 2000); }, 300);
    return true;
  } catch (e) { return false; }
}

const Gallery = registerPlugin('SakinaGallery');
/** حفظ صورة PNG في معرض الصور (ألبوم سكينة) على أندرويد، أو تنزيلها في المتصفح. يعيد 'gallery' أو 'download' أو false */
export async function saveImageToGallery(dataUrl, name = 'sakina.png') {
  if (isAndroid) {
    try { await Gallery.save({ data: dataUrl.split(',')[1], name }); return 'gallery'; } catch (e) { return false; }
  }
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'download';
  } catch (e) { return false; }
}

/** مشاركة صورة PNG (dataURL) */
export async function shareImage(dataUrl, name = 'sakina.png') {
  if (isNative) {
    try {
      const { uri } = await Filesystem.writeFile({ path: `share/${name}`, data: dataUrl.split(',')[1], directory: Directory.Cache, recursive: true });
      await Share.share({ title: 'سكينة', files: [uri], dialogTitle: 'مشاركة البطاقة' });
      return 'shared';
    } catch (e) { return isShareCancel(e) ? 'cancelled' : 'failed'; }
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'سكينة' }); return 'shared'; }
  } catch (e) { if (isShareCancel(e)) return 'cancelled'; /* وإلا ننزّل الصورة */ }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
  return 'downloaded';
}

/** حفظ ملف نصي (تصدير البيانات) */
/** @returns {Promise<'shared'|'downloaded'|'cancelled'|'failed'>} */
export async function saveTextFile(name, text) {
  if (isNative) {
    try {
      const { uri } = await Filesystem.writeFile({ path: `share/${name}`, data: text, directory: Directory.Cache, encoding: 'utf8', recursive: true });
      await Share.share({ title: name, files: [uri], dialogTitle: 'حفظ نسخة البيانات' });
      return 'shared';
    } catch (e) { return isShareCancel(e) ? 'cancelled' : 'failed'; }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return 'downloaded';
  } catch (e) { return 'failed'; }
}

/** حذف ملفات المشاركة المؤقتة الأقدم من يوم (قد تحوي نسخة احتياطية) */
export async function cleanShareCache(maxAgeMs = 86400000) {
  if (!isNative) return;
  try {
    const { files } = await Filesystem.readdir({ path: 'share', directory: Directory.Cache });
    const now = Date.now();
    for (const f of files || []) {
      const name = typeof f === 'string' ? f : f.name;
      const mtime = typeof f === 'object' && f.mtime ? +f.mtime : 0;
      if (name && (!mtime || now - mtime > maxAgeMs)) await Filesystem.deleteFile({ path: `share/${name}`, directory: Directory.Cache }).catch(() => {});
    }
  } catch (e) { /* لا مجلد بعد */ }
}

/** الموقع الحالي؛ opts تغيّر المهلة والعمر الأقصى لمستدعٍ بعينه دون مساس بالافتراضي */
export async function getPosition(opts = {}) {
  const o = { enableHighAccuracy: false, timeout: opts.timeout || 15000, maximumAge: opts.maximumAge != null ? opts.maximumAge : 600000 };
  if (isNative) {
    const perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] }).catch(() => null);
    if (perm && perm.coarseLocation === 'denied' && perm.location === 'denied') throw new Error('denied');
    const p = await Geolocation.getCurrentPosition(o);
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      o,
    );
  });
}

export async function setStatusBar(color, dark) {
  if (!isNative) return;
  try {
    await StatusBar.setBackgroundColor({ color });
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch (e) { /* غير مدعوم */ }
}

// ---------- التنبيهات المحلية ----------
export const notificationsSupported = isNative;

export async function ensureNotifyPermission() {
  if (!isNative) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  } catch (e) { return false; }
}

/** عند الضغط على الإشعار: الانتقال إلى الصفحة المناسبة */
export function onNotificationTap(cb) {
  if (!isNative) return;
  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const route = e && e.notification && e.notification.extra && e.notification.extra.route;
    if (safeRoute(route)) cb(route);
  });
}

/** فتح رابط خارجي في المتصفح */
export async function openExternal(url) {
  if (isNative) { await Browser.open({ url }); return; }
  window.open(url, '_blank', 'noopener');
}

export async function exactAlarmsAllowed() {
  if (!isNative) return true;
  try { return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'; } catch (e) { return true; }
}

export async function openExactAlarmSettings() {
  try { await LocalNotifications.changeExactNotificationSetting(); } catch (e) { /* غير مدعوم */ }
}

/**
 * يعيد جدولة كل التنبيهات من الصفر.
 * @param {Array<{id:number,title:string,body:string,at?:Date,daily?:{hour:number,minute:number},weekly?:{weekday:number,hour:number,minute:number}}>} list
 * @returns {Promise<{ok:boolean, count:number, error?:string}>} حالة الجدولة الفعلية
 */
export async function scheduleAll(list) {
  if (!isNative) return { ok: true, count: 0 };
  try {
    await scheduleAllRaw(list);
    return { ok: true, count: list.length };
  } catch (e) {
    return { ok: false, count: 0, error: (e && e.message) || 'schedule-failed' };
  }
}

async function scheduleAllRaw(list) {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!list.length) return;
  await LocalNotifications.createChannel({ id: 'sakina', name: 'تذكيرات سكينة', importance: 4, visibility: 1, vibration: true }).catch(() => {});
  await LocalNotifications.schedule({
    notifications: list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      channelId: 'sakina',
      smallIcon: 'ic_stat_sakina',
      extra: n.route ? { route: n.route } : undefined,
      schedule: n.at
        ? { at: n.at, allowWhileIdle: true }
        : { on: n.weekly || n.daily, allowWhileIdle: true },
    })),
  });
}
