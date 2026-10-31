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
export async function scheduleOverlays(items) {
  if (!overlaySupported) return;
  try { await Overlay.schedule({ items: items.map((i) => ({ ...i, at: i.at.getTime() })) }); } catch (e) { /* غير متاح */ }
}
export async function showOverlayNow(title, body, route) {
  if (!overlaySupported) return false;
  try { await Overlay.showNow({ title, body, route }); return true; } catch (e) { return false; }
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
export function onDeepLink(cb) {
  if (!isNative) return;
  const handle = (url) => {
    const m = /^sakina:\/\/open(\/[^?#]*)?/.exec(url || '');
    if (m) cb(`#${m[1] || '/home'}`);
  };
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
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export async function shareText(text, title = 'سكينة') {
  try {
    if (isNative) { await Share.share({ title, text, dialogTitle: 'مشاركة' }); return true; }
    if (navigator.share) { await navigator.share({ title, text }); return true; }
  } catch (e) {
    return false;
  }
  return copyText(text).then(() => 'copied');
}

/** مشاركة صورة PNG (dataURL) */
export async function shareImage(dataUrl, name = 'sakina.png') {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: dataUrl.split(',')[1], directory: Directory.Cache });
    await Share.share({ title: 'سكينة', files: [uri], dialogTitle: 'مشاركة البطاقة' });
    return true;
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'سكينة' }); return true; }
  } catch (e) { /* ننزّل الصورة بدلاً من ذلك */ }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
  return 'downloaded';
}

/** حفظ ملف نصي (تصدير البيانات) */
export async function saveTextFile(name, text) {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: 'utf8' });
    await Share.share({ title: name, files: [uri], dialogTitle: 'حفظ نسخة البيانات' });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function getPosition() {
  if (isNative) {
    const perm = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] }).catch(() => null);
    if (perm && perm.coarseLocation === 'denied' && perm.location === 'denied') throw new Error('denied');
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
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
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
}

/** عند الضغط على الإشعار: الانتقال إلى الصفحة المناسبة */
export function onNotificationTap(cb) {
  if (!isNative) return;
  LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const route = e && e.notification && e.notification.extra && e.notification.extra.route;
    if (route) cb(route);
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
 */
export async function scheduleAll(list) {
  if (!isNative) return;
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
