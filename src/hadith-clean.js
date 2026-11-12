// تنظيف نصوص الأحاديث من المصادر الرقمية دون المساس بالمتن.
// الأقواس [] في المصدر نوعان:
//   • تخريج: [رواه البخاري]، [ومسلم]، [رَوَاهُ مُسْلِمٌ] ← يبقى نصه بلا أقواس
//   • أرقام مراجع [رقم:13] [2/746] وزيادات المحرّر داخل المتن ← تُحذف
// وما بعد <br> تكرار للتخريج يُلحق فقط إن لم يُذكر التخريج قبله.
const NARRATORS = /رَوَاهُ|رواه|مُسْلِمٌ|مسلم|الْبُخَارِيُّ|البخاري|التِّرْمِذِيُّ|الترمذي|أَبُو دَاوُد|أبو داود|النَّسَائِيّ|النسائي|ابْنُ مَاجَهْ|ابن ماجه|أَحْمَدُ|أحمد|الدَّارَقُطْنِيّ|الدارقطني|الْبَيْهَقِيُّ|البيهقي|الطَّبَرَانِيُّ|الطبراني|الْحَاكِمُ|الحاكم|مَالِكٌ|مالك|مُتَّفَقٌ|متفق/;
const TAKHRIJ = /رَوَاهُ|رواه|حَدِيثٌ|حديث|متفق|مُتَّفَقٌ/;

function brackets(t) {
  return t.replace(/\[([^\]]*)\]/g, (all, inner) => {
    if (/[0-9٠-٩]/.test(inner) || /^\s*رقم/.test(inner)) return '';
    return NARRATORS.test(inner) ? ` ${inner.trim()} ` : '';
  });
}

const tidy = (t) => t
  .replace(/[‎‏‪-‮]/g, '')
  .replace(/\s*\n\s*/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/ ([.،,:؛])/g, '$1')
  .replace(/([،,])(?=\S)/g, '$1 ')
  .replace(/\n+/g, '\n')
  .replace(/[\n ]*\.$/, '.')
  .trim();

export function cleanHadith(t) {
  const [main, ...rest] = String(t || '').split('<br>');
  let out = tidy(brackets(main));
  const tail = tidy(brackets(rest.join(' ')));
  if (tail && !TAKHRIJ.test(out)) out = `${out.replace(/\.$/, '')}.\n${tail}`;
  return out;
}
