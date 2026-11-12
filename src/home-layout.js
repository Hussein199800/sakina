// تخصيص الرئيسية: البطاقات المتاحة وترتيبها والمخفي منها، والاختصارات التي يختارها المستخدم.
// يُحفظ في state.settings.home، وقيمته null تعني الترتيب الافتراضي.
import { state, save } from './store.js';

/** بطاقات الرئيسية بالترتيب الافتراضي (العنوان والترويسة ثابتان أعلى الصفحة) */
export const HOME_CARDS = [
  { id: 'prayer', label: 'مواقيت الصلاة', icon: 'mosque' },
  { id: 'shortcuts', label: 'اختصاراتي', icon: 'grid' },
  { id: 'feelings', label: 'بماذا يشعر قلبك؟', icon: 'heart' },
  { id: 'wird', label: 'وردك الآن', icon: 'sparkle' },
  { id: 'quran', label: 'القرآن والختمة', icon: 'book' },
  { id: 'ayah', label: 'آية اليوم', icon: 'book' },
  { id: 'tasbih', label: 'المسبحة', icon: 'beads' },
  { id: 'names', label: 'اسم من أسماء الله', icon: 'star' },
  { id: 'hadith', label: 'حديث اليوم', icon: 'sparkle' },
  { id: 'mosque', label: 'أقرب مسجد', icon: 'mosque' },
  { id: 'streak', label: 'أيام الالتزام', icon: 'flame' },
];

/** الاختصارات المتاحة: كل اختصار يفتح صفحته الأصلية، دون نسخة ثانية من الميزة */
export const SHORTCUTS = [
  { id: 'morning', label: 'أذكار الصباح', icon: 'sunrise', tone: 'amber', to: '#/read/morning' },
  { id: 'evening', label: 'أذكار المساء', icon: 'sunset', tone: 'violet', to: '#/read/evening' },
  { id: 'sleep', label: 'أذكار النوم', icon: 'moon', tone: 'indigo', to: '#/read/sleep' },
  { id: 'prayer', label: 'بعد الصلاة', icon: 'mosque', tone: 'teal', to: '#/read/prayer' },
  { id: 'mushaf', label: 'المصحف', icon: 'book', tone: 'teal', to: '#/quran' },
  { id: 'suras', label: 'مداخل السور', icon: 'list', tone: 'sand', to: '#/suras' },
  { id: 'tasbih', label: 'المسبحة', icon: 'beads', tone: 'teal', to: '#/tasbih' },
  { id: 'feel', label: 'صيدلية الروح', icon: 'heart', tone: 'rose', to: '#/library/feel' },
  { id: 'card', label: 'ادعُ لأخيك', icon: 'image', tone: 'teal', to: '#/card/new' },
  { id: 'loved', label: 'دعواتي', icon: 'heart', tone: 'violet', to: '#/loved' },
  { id: 'qibla', label: 'القبلة', icon: 'compass', tone: 'indigo', to: '#/qibla' },
  { id: 'qiyam', label: 'قيام الليل', icon: 'moon', tone: 'violet', to: '#/qiyam' },
  { id: 'mosques', label: 'المساجد', icon: 'mosque', tone: 'rose', to: '#/mosques' },
  { id: 'zakat', label: 'الزكاة', icon: 'calculator', tone: 'amber', to: '#/zakat' },
  { id: 'names', label: 'أسماء الله', icon: 'star', tone: 'amber', to: '#/names' },
  { id: 'hadith', label: 'الأحاديث', icon: 'book', tone: 'teal', to: '#/hadith' },
  { id: 'prophets', label: 'قصص الأنبياء', icon: 'star', tone: 'indigo', to: '#/prophets' },
  { id: 'hajj', label: 'الحج والعمرة', icon: 'kaaba', tone: 'sand', to: '#/hajj' },
  { id: 'journal', label: 'رحلتي', icon: 'journal', tone: 'teal', to: '#/journal' },
  { id: 'reminders', label: 'التذكيرات', icon: 'bell', tone: 'amber', to: '#/reminders' },
];
export const MAX_SHORTCUTS = 8;
export const DEFAULT_SHORTCUTS = ['morning', 'evening', 'qibla', 'qiyam'];

const CARD_IDS = HOME_CARDS.map((c) => c.id);
const SC_IDS = SHORTCUTS.map((c) => c.id);

/** الترتيب الفعلي: المحفوظ أولاً (مع حذف ما لم يعد موجوداً)، ثم أي بطاقة جديدة أُضيفت في تحديث لاحق */
export function homeLayout(home = state.settings.home) {
  if (!home) return { order: CARD_IDS.slice(), hidden: [], shortcuts: DEFAULT_SHORTCUTS.slice() };
  const order = home.order.filter((id, i, a) => CARD_IDS.indexOf(id) !== -1 && a.indexOf(id) === i);
  for (const id of CARD_IDS) if (order.indexOf(id) === -1) order.push(id);
  return {
    order,
    hidden: home.hidden.filter((id) => CARD_IDS.indexOf(id) !== -1),
    shortcuts: home.shortcuts.filter((id, i, a) => SC_IDS.indexOf(id) !== -1 && a.indexOf(id) === i).slice(0, MAX_SHORTCUTS),
  };
}

export const visibleCards = (home) => { const l = homeLayout(home); return l.order.filter((id) => l.hidden.indexOf(id) === -1); };

/** يحفظ تعديلاً على التخصيص الحالي */
export function updateHome(fn) {
  const l = homeLayout();
  fn(l);
  state.settings.home = { order: l.order, hidden: l.hidden, shortcuts: l.shortcuts };
  save();
}

export function moveCard(id, delta) {
  updateHome((l) => {
    const i = l.order.indexOf(id);
    const j = i + delta;
    if (i === -1 || j < 0 || j >= l.order.length) return;
    l.order.splice(i, 1);
    l.order.splice(j, 0, id);
  });
}
