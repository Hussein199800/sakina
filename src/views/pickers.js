// منتقيا الوقت والتاريخ: بديل عن حقول المتصفح التي تعرض أرقاماً وAM/PM إنجليزية بحسب لغة الجهاز
import { icon } from '../icons.js';
import { num } from '../text.js';
import { openSheet } from '../ui.js';
import { GREG_MONTHS, WEEKDAY_LETTERS } from '../dates.js';

const pad = (n) => String(n).padStart(2, '0');

/** «21:05» ← «٩:٠٥ م» */
export function fmtClock(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const hh = ((h || 0) % 24 + 24) % 24;
  return `${num(hh % 12 || 12)}:${num(pad(m || 0))} ${hh < 12 ? 'ص' : 'م'}`;
}

/** «2026-11-20» ← «٢٠ نوفمبر ٢٠٢٦» */
export function fmtDay(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${num(d)} ${GREG_MONTHS[m - 1]} ${num(y)}`;
}

export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** زر يعرض الوقت ويفتح المنتقي */
export const timeButton = (value, attrs = '') => `<button type="button" class="time-btn" data-value="${value}" ${attrs}>${icon('bell')}<span>${fmtClock(value)}</span></button>`;
export const dateButton = (value, attrs = '') => `<button type="button" class="time-btn" data-value="${value}" ${attrs}>${icon('calendar')}<span>${fmtDay(value)}</span></button>`;

/** يفتح منتقي الوقت ويعيد «HH:MM» أو null عند الإلغاء */
export function pickTime(value, title = 'اختر الوقت') {
  return new Promise((resolve) => {
    let [h, m] = String(value || '20:00').split(':').map(Number);
    h = Number.isFinite(h) ? h : 20;
    m = Number.isFinite(m) ? m : 0;
    let done = false;
    const draw = (body) => {
      body.querySelector('[data-h]').textContent = num(h % 12 || 12);
      body.querySelector('[data-m]').textContent = num(pad(m));
      body.querySelectorAll('[data-ap]').forEach((b) => b.classList.toggle('on', (b.dataset.ap === 'am') === (h < 12)));
      body.querySelectorAll('[data-mm]').forEach((b) => b.classList.toggle('on', +b.dataset.mm === m));
    };
    openSheet(`<h3 class="sheet-title">${title}</h3>
      <div class="tp">
        <div class="tp-col"><button class="icon-btn" data-dh="1" aria-label="زيادة الساعة">${icon('plus')}</button><b data-h class="tp-num"></b><small>الساعة</small><button class="icon-btn" data-dh="-1" aria-label="إنقاص الساعة">${icon('minus')}</button></div>
        <b class="tp-colon">:</b>
        <div class="tp-col"><button class="icon-btn" data-dm="1" aria-label="زيادة الدقيقة">${icon('plus')}</button><b data-m class="tp-num"></b><small>الدقيقة</small><button class="icon-btn" data-dm="-1" aria-label="إنقاص الدقيقة">${icon('minus')}</button></div>
        <div class="tp-ap"><button class="seg-btn" data-ap="am">صباحاً</button><button class="seg-btn" data-ap="pm">مساءً</button></div>
      </div>
      <div class="tp-quick">${[0, 15, 30, 45].map((q) => `<button class="chip" data-mm="${q}">${num(`:${pad(q)}`)}</button>`).join('')}</div>
      <div class="row-btns"><button class="btn btn-primary" data-ok>${icon('check')} تم</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
      onClose: () => { if (!done) resolve(null); },
      onMount: (body, close) => {
        body.querySelectorAll('[data-dh]').forEach((b) => b.addEventListener('click', () => { h = (h + +b.dataset.dh + 24) % 24; draw(body); }));
        body.querySelectorAll('[data-dm]').forEach((b) => b.addEventListener('click', () => { m = (m + +b.dataset.dm + 60) % 60; draw(body); }));
        body.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => { m = +b.dataset.mm; draw(body); }));
        body.querySelectorAll('[data-ap]').forEach((b) => b.addEventListener('click', () => {
          if (b.dataset.ap === 'am' && h >= 12) h -= 12;
          if (b.dataset.ap === 'pm' && h < 12) h += 12;
          draw(body);
        }));
        body.querySelector('[data-ok]').addEventListener('click', () => { done = true; resolve(`${pad(h)}:${pad(m)}`); close(); });
        draw(body);
      },
    });
  });
}

/** منتقي تاريخ بتقويم شهري (من اليوم فصاعداً) */
export function pickDate(value, title = 'اختر التاريخ') {
  return new Promise((resolve) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sel = value ? new Date(`${value}T00:00:00`) : today;
    let view = new Date(sel.getFullYear(), sel.getMonth(), 1);
    let chosen = isoDay(sel);
    let done = false;
    const draw = (body) => {
      const y = view.getFullYear();
      const mo = view.getMonth();
      body.querySelector('[data-cal-title]').textContent = `${GREG_MONTHS[mo]} ${num(y)}`;
      const first = new Date(y, mo, 1).getDay();
      const days = new Date(y, mo + 1, 0).getDate();
      let html = WEEKDAY_LETTERS.map((l) => `<span class="cal-wd">${l}</span>`).join('');
      for (let i = 0; i < first; i++) html += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const dt = new Date(y, mo, d);
        const iso = isoDay(dt);
        html += `<button class="cal-day ${iso === chosen ? 'on' : ''} ${iso === isoDay(today) ? 'today' : ''}" data-day="${iso}" ${dt < today ? 'disabled' : ''}>${num(d)}</button>`;
      }
      body.querySelector('[data-cal]').innerHTML = html;
      body.querySelector('[data-prev]').disabled = y === today.getFullYear() && mo === today.getMonth();
    };
    openSheet(`<h3 class="sheet-title">${title}</h3>
      <div class="cal-head"><button class="icon-btn" data-prev aria-label="الشهر السابق">${icon('back')}</button><b data-cal-title></b><button class="icon-btn" data-next aria-label="الشهر التالي">${icon('chevron')}</button></div>
      <div class="cal-grid" data-cal></div>
      <div class="row-btns"><button class="btn btn-primary" data-ok>${icon('check')} تم</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
      onClose: () => { if (!done) resolve(null); },
      onMount: (body, close) => {
        body.querySelector('[data-prev]').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); draw(body); });
        body.querySelector('[data-next]').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); draw(body); });
        body.querySelector('[data-cal]').addEventListener('click', (e) => {
          const b = e.target.closest('[data-day]');
          if (!b || b.disabled) return;
          chosen = b.dataset.day;
          draw(body);
        });
        body.querySelector('[data-ok]').addEventListener('click', () => { done = true; resolve(chosen); close(); });
        draw(body);
      },
    });
  });
}
