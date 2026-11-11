// حاسبة قيام الليل: الليل من المغرب إلى الفجر، ونصفه وثلثه الأخير، من مواقيت المدينة المختارة أو بإدخال يدوي
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc } from '../text.js';
import { hmInTz, addDays } from '../dates.js';
import { location, timesFor, localToday } from '../services.js';
import { fullHead, refresh } from './common.js';
import { timeButton, pickTime, fmtClock } from './pickers.js';

export const full = true;
export const tab = 'more';

const pad = (n) => String(n).padStart(2, '0');
const toHM = (m) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/** المغرب والفجر لليلة الحالية بتوقيت الموقع (إن كنا بعد منتصف الليل وقبل الفجر فالليلة هي التي بدأت أمس) */
export function nightFromTimes(now = new Date()) {
  const tz = location().tz;
  const g = localToday(now);
  const t = timesFor(g);
  const before = now < t.fajr;
  const maghrib = before ? timesFor(addDays(g, -1)).maghrib : t.maghrib;
  const fajr = before ? t.fajr : timesFor(addDays(g, 1)).fajr;
  const hm = (d) => { const x = hmInTz(d, tz); return `${pad(x.h)}:${pad(x.min)}`; };
  return { maghrib: hm(maghrib), fajr: hm(fajr) };
}

/** حساب أجزاء الليل من وقتين «HH:MM» */
export function nightParts(maghrib, fajr) {
  const s = toMin(maghrib);
  let e = toMin(fajr);
  if (e <= s) e += 1440;
  const len = e - s;
  return { len, half: toHM(s + len / 2), lastThird: toHM(e - len / 3), firstThirdEnd: toHM(s + len / 3) };
}

function current() {
  const q = state.qiyam;
  if (q && q.manual) return { maghrib: q.maghrib, fajr: q.fajr, manual: true };
  return { ...nightFromTimes(), manual: false };
}

export function render() {
  const c = current();
  const p = nightParts(c.maghrib, c.fajr);
  const hours = Math.floor(p.len / 60);
  const mins = p.len % 60;
  return `${fullHead('قيام الليل', 'نصف الليل والثلث الأخير')}
    <div class="qy-page">
      <section class="card qy-hero">
        <span class="eyebrow">${icon('moon')} الثلث الأخير من الليل يبدأ</span>
        <b class="qy-big">${fmtClock(p.lastThird)}</b>
        <small>وينتهي بأذان الفجر ${fmtClock(c.fajr)}</small>
      </section>
      <div class="qy-grid">
        <div class="qy-cell"><small>بداية الليل (المغرب)</small><b>${fmtClock(c.maghrib)}</b></div>
        <div class="qy-cell"><small>نهاية الليل (الفجر)</small><b>${fmtClock(c.fajr)}</b></div>
        <div class="qy-cell"><small>منتصف الليل</small><b>${fmtClock(p.half)}</b></div>
        <div class="qy-cell"><small>طول الليل</small><b>${num(hours)} س ${num(mins)} د</b></div>
      </div>
      <section class="card set-card">
        <h2 class="set-title">${icon('settings')} المدخلات</h2>
        <div class="seg">
          <button class="seg-btn ${c.manual ? '' : 'on'}" data-act="qy-mode" data-m="auto">من المواقيت</button>
          <button class="seg-btn ${c.manual ? 'on' : ''}" data-act="qy-mode" data-m="manual">إدخال يدوي</button>
        </div>
        ${c.manual ? `<div class="quiet-row"><span>المغرب</span>${timeButton(c.maghrib, 'data-qy="maghrib"')}<span>الفجر</span>${timeButton(c.fajr, 'data-qy="fajr"')}</div>`
    : `<p class="muted small">${icon('pin')} حسب مواقيت ${esc(location().name)}، ويمكنك تغيير المدينة من الإعدادات دون الحاجة إلى إذن الموقع.</p>`}
      </section>
      <section class="card set-card">
        <h2 class="set-title">${icon('info')} طريقة الحساب</h2>
        <p class="qy-note">الليل من غروب الشمس (أذان المغرب) إلى طلوع الفجر الصادق (أذان الفجر). يُقسَم طوله على ثلاثة، فيبدأ الثلث الأخير قبل الفجر بثلث طول الليل، ومنتصف الليل بعد المغرب بنصف طوله. والأوقات تقريبية بحسب طريقة حساب المواقيت المختارة.</p>
        <p class="qy-note">قال ﷺ: «ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر، يقول: من يدعوني فأستجيب له، من يسألني فأعطيه، من يستغفرني فأغفر له». <small class="src">رواه البخاري ومسلم</small></p>
      </section>
      <button class="btn btn-soft wide" data-act="go" data-to="#/reminders">${icon('bell')} تذكير بقيام الليل</button>
    </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-qy]').forEach((b) => b.addEventListener('click', async () => {
    const k = b.dataset.qy;
    const v = await pickTime(state.qiyam[k], k === 'maghrib' ? 'وقت المغرب' : 'وقت الفجر');
    if (!v) return;
    state.qiyam[k] = v;
    save();
    refresh();
  }));
}

export const actions = {
  'qy-mode': (el) => {
    const manual = el.dataset.m === 'manual';
    const base = state.qiyam && state.qiyam.maghrib ? state.qiyam : nightFromTimes();
    state.qiyam = { manual, maghrib: base.maghrib, fajr: base.fajr };
    save();
    refresh();
  },
};
