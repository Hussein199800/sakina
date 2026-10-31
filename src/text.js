// معالجة النص العربي: إزالة التشكيل والتطبيع للبحث، والأرقام، والتهريب

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;

export const stripTashkeel = (s) => s.replace(TASHKEEL, '');

/** تطبيع للبحث: بلا تشكيل، وتوحيد الألف والتاء المربوطة والياء */
export const normalize = (s) => stripTashkeel(s)
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/[﴿﴾«»()،,.:؛!؟۝]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
let digitStyle = 'arab';
export const setDigits = (style) => { digitStyle = style === 'latn' ? 'latn' : 'arab'; };
export const getDigits = () => digitStyle;

/**
 * يعرض الأرقام بالنظام الذي اختاره المستخدم في كل التطبيق: هندية (٠١٢) أو عربية (012).
 * يحوّل في الاتجاهين، فالنصوص المخزّنة بأي نظام تظهر بنظام واحد.
 */
export const num = (v) => (digitStyle === 'arab'
  ? String(v).replace(/[0-9]/g, (d) => AR_DIGITS[d]).replace(/[۰-۹]/g, (d) => AR_DIGITS[d.charCodeAt(0) - 0x6F0])
  : String(v).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0)));

/** قراءة رقم كتبه المستخدم بأي نظام أرقام (٠-٩ أو 0-9 أو الفارسية) وبفاصلة عشرية عربية أو لاتينية */
export function parseNum(s) {
  const t = String(s == null ? '' : s).trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6F0))
    .replace(/[٬,\s]/g, '')
    .replace(/[٫]/g, '.');
  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(t)) return NaN;
  return parseFloat(t);
}

/** رقم منسّق بفواصل الآلاف وعدد ثابت من المنازل العشرية، بنظام الأرقام المختار */
export function fmtNum(n, decimals = 0) {
  if (!Number.isFinite(n)) return num(0);
  const neg = n < 0;
  const fixed = Math.abs(n).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, digitStyle === 'arab' ? '٬' : ',');
  const out = frac ? `${grouped}${digitStyle === 'arab' ? '٫' : '.'}${frac}` : grouped;
  return num(neg ? `-${out}` : out);
}

/** صيغة العدد مع المعدود بحسب قواعد العربية: صفحة واحدة، صفحتان، ٣ صفحات، ١١ صفحة */
export function plural(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  const r = n % 100;
  return `${num(n)} ${r >= 3 && r <= 10 ? few : many}`;
}
export const pagesLabel = (n) => plural(n, ['صفحة واحدة', 'صفحتان', 'صفحات', 'صفحة']);
export const daysLabel = (n) => plural(n, ['يوم واحد', 'يومان', 'أيام', 'يوماً']);

/** نسبة مئوية بالرمز المناسب لنظام الأرقام */
export const fmtPct = (frac) => `${fmtNum(Math.round(Math.max(0, Math.min(1, frac)) * 100))}${digitStyle === 'arab' ? '٪' : '%'}`;

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
