// رقم الإصدار: يجب أن يطابق versionCode وversionName في android/app/build.gradle وفي version.json (يتحقق منه اختبار)
export const VERSION = '1.3.0';
export const VERSION_CODE = 4;
// ملف وصف آخر إصدار منشور، يُقرأ للتحقق من التحديثات
export const UPDATE_URL = 'https://raw.githubusercontent.com/Hussein199800/sakina/main/version.json';
export const RELEASES_URL = 'https://github.com/Hussein199800/sakina/releases/latest';
// ملف التثبيت لأحدث إصدار (يُنزَّل ويُثبَّت من داخل التطبيق)
export const APK_URL = 'https://github.com/Hussein199800/sakina/releases/latest/download/sakina.apk';
export const VPN_NOTE = 'إن تعذّر الاتصال، شغّل VPN ثم حاول مرة أخرى؛ فبعض الدول تحجب GitHub الذي تُنشر منه التحديثات.';
