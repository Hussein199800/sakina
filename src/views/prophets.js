// قصص الأنبياء من القرآن: بطاقة لكل نبي (الاسم وملخص قصير)، وعند فتحها الآيات التي تحكي القصة
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { PROPHETS } from '../data/prophets.js';
import { SURAS } from '../data/quran-meta.js';
import { pageOf, indexOf } from '../quran.js';
import { fullHead } from './common.js';

export const full = true;
export const tab = 'more';

export function render() {
  return `${fullHead('قصص الأنبياء', 'كما وردت في القرآن الكريم')}
    <p class="note">${icon('info')} ملخصات موجزة من آيات القرآن نفسها، ولكل قصة الآيات التي تحكيها لتقرأها في المصحف.</p>
    <div class="pr-list">${PROPHETS.map((p, i) => `
      <details class="card pr-card">
        <summary><span class="sura-num">${num(i + 1)}</span><b>${p.name}</b>${icon('down')}</summary>
        <p class="pr-sum">${esc(p.sum)}</p>
        <div class="chips">${p.refs.map(([s, a1, a2]) => `<button class="chip" data-act="go" data-to="#/mushaf/${pageOf(indexOf(s, a1))}:${indexOf(s, a1)}">${icon('book')} ${SURAS[s - 1][0]} ${num(a1)}${a2 > a1 ? `–${num(a2)}` : ''}</button>`).join('')}</div>
      </details>`).join('')}</div>`;
}
