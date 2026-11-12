// الحج والعمرة: المناسك خطوة بخطوة (ملخص ثم تفاصيل وذكر ومصدر)، تعمل دون إنترنت
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { UMRAH, HAJJ, HAJJ_NOTE } from '../data/hajj.js';
import { fullHead } from './common.js';
import { dhikrText } from '../ui.js';

export const full = true;
export const tab = 'more';

const TABS = [['umrah', 'العمرة'], ['hajj', 'الحج']];
let sel = 'umrah';

export function render(param) {
  if (TABS.some(([k]) => k === param)) sel = param;
  const steps = sel === 'hajj' ? HAJJ : UMRAH;
  return `${fullHead('الحج والعمرة', 'المناسك خطوة بخطوة')}
    <div class="seg" role="tablist">${TABS.map(([k, l]) => `<button class="seg-btn ${sel === k ? 'on' : ''}" data-act="go-replace" data-to="#/hajj/${k}" role="tab" aria-selected="${sel === k}">${l}</button>`).join('')}</div>
    <div class="pr-list">${steps.map((st, i) => `
      <details class="card pr-card" ${i === 0 ? 'open' : ''}>
        <summary><span class="sura-num">${num(i + 1)}</span><span class="hj-t"><b>${num(st.title)}</b><small>${esc(num(st.sum))}</small></span>${icon('down')}</summary>
        <ul class="hj-list">${st.details.map((d) => `<li>${esc(num(d))}</li>`).join('')}</ul>
        ${st.dhikr ? `<div class="hj-dhikr"><p class="dhikr-sm">${dhikrText(st.dhikr.t)}</p><small class="src">${esc(num(st.dhikr.s))}</small></div>` : ''}
      </details>`).join('')}</div>
    <p class="muted small">${HAJJ_NOTE}</p>
    <p class="muted small">${icon('info')} الشروحات المرئية تحتاج اتصالاً بالإنترنت، وستُضاف روابطها من قنوات موثوقة لاحقاً بإذن الله؛ أما النصوص هنا فتعمل دون اتصال.</p>`;
}
