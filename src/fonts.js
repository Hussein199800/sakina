// الخطوط المدمجة (تعمل دون إنترنت، بترخيص SIL Open Font License)
// UI_FONTS لواجهة التطبيق، و TEXT_FONTS لنصوص الأذكار والأدعية والآيات في البطاقات (المصحف يبقى بخطه)
export const UI_FONTS = {
  plex: { label: 'IBM Plex', family: "'IBM Plex Sans Arabic'" },
  cairo: { label: 'Cairo', family: "'Cairo'", pkg: 'cairo' },
  tajawal: { label: 'Tajawal', family: "'Tajawal'", pkg: 'tajawal' },
  almarai: { label: 'Almarai', family: "'Almarai'", pkg: 'almarai' },
  kufi: { label: 'Noto Kufi', family: "'Noto Kufi Arabic'", pkg: 'noto-kufi-arabic' },
  readex: { label: 'Readex Pro', family: "'Readex Pro'", pkg: 'readex-pro' },
};
export const TEXT_FONTS = {
  amiri: { label: 'Amiri', family: "'Amiri'" },
  scheherazade: { label: 'Scheherazade', family: "'Scheherazade New'", pkg: 'scheherazade-new' },
  naskh: { label: 'Noto Naskh', family: "'Noto Naskh Arabic'", pkg: 'noto-naskh-arabic' },
  lateef: { label: 'Lateef', family: "'Lateef'", pkg: 'lateef' },
  ruqaa: { label: 'Aref Ruqaa', family: "'Aref Ruqaa'", pkg: 'aref-ruqaa' },
};
// حجم خط التطبيق كله (تكبير الواجهة)
export const UI_SCALES = [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.4];
export const fontFamilyName = (f) => f.family.replace(/'/g, '');
