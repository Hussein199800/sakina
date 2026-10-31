// أصوات الأذان: يُضاف الصوت بوضع ملفه في assets/adhan بالاسم المذكور هنا، فيُدمج تلقائياً عند البناء.
// لا تُضف تسجيلاً إلا بإذن صاحبه أو برخصة تسمح بإعادة نشره.
export const VOICES = [
  { id: 'kassas', name: 'محمد قصاص', file: 'kassas.mp3' },
  { id: 'kurdi', name: 'رعد الكردي', file: 'kurdi.mp3' },
  { id: 'makkah', name: 'أذان الحرم المكي', file: 'makkah.mp3' },
  { id: 'madinah', name: 'أذان المسجد النبوي', file: 'madinah.mp3' },
];

/* global __ADHAN_AVAILABLE__ */
// الأصوات الموجودة فعلاً في هذا البناء (تُحدَّد عند البناء من ملفات assets/adhan)
const available = typeof __ADHAN_AVAILABLE__ !== 'undefined' ? __ADHAN_AVAILABLE__ : [];
export const AVAILABLE_VOICES = VOICES.filter((v) => available.indexOf(v.id) !== -1);
export const voiceById = (id) => AVAILABLE_VOICES.find((v) => v.id === id) || null;
