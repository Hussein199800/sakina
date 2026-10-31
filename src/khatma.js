// الختمة: خطة قراءة يومية بعدد صفحات ثابت من مصحف المدينة (٦٠٤ صفحات)
import { state, save } from './store.js';
import { dateKey } from './dates.js';
import { TOTAL_PAGES } from './data/quran-meta.js';

export const PLANS = [
  { perDay: 5, label: '5 صفحات يومياً' },
  { perDay: 10, label: '10 صفحات (نصف جزء)' },
  { perDay: 20, label: 'جزء يومياً' },
  { perDay: 40, label: 'جزءان يومياً' },
];

export function startKhatma({ perDay, time, remind, fromPage = 1 }) {
  state.khatma = { startedAt: dateKey(), perDay, time, remind, page: fromPage, startPage: fromPage, log: {} };
  save();
}

export const stopKhatma = () => { state.khatma = null; save(); };

/** الصفحات المقروءة اليوم */
export const readToday = (k = state.khatma) => (k && k.log[dateKey()]) || 0;

/** ورد اليوم: من الصفحة … إلى الصفحة … */
export function todayRange(k = state.khatma) {
  if (!k) return null;
  const from = Math.max(1, k.page - readToday(k));
  return { from, to: Math.min(TOTAL_PAGES, from + k.perDay - 1) };
}

/** الأيام المتبقية لإتمام الختمة بالمعدّل الحالي */
export const daysLeft = (k = state.khatma) => (k ? Math.ceil((TOTAL_PAGES - k.page + 1) / k.perDay) : 0);

export const progress = (k = state.khatma) => (k ? Math.min(1, (k.page - k.startPage) / (TOTAL_PAGES - k.startPage + 1)) : 0);

/**
 * يُستدعى عند الانتقال من صفحة إلى التالية: إن كانت الصفحة المقروءة هي صفحة الختمة الحالية تتقدّم الختمة.
 * @returns {'advanced'|'finished'|null}
 */
export function pageRead(p) {
  const k = state.khatma;
  if (!k || p !== k.page) return null;
  k.page += 1;
  const d = dateKey();
  k.log[d] = (k.log[d] || 0) + 1;
  if (k.page > TOTAL_PAGES) {
    state.khatmaDone = (state.khatmaDone || 0) + 1;
    state.khatma = null;
    save();
    return 'finished';
  }
  save();
  return 'advanced';
}
