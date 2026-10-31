// حاسبة الزكاة
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, parseNum, fmtNum, getDigits } from '../text.js';
import { computeZakat, KARATS, NISAB_GOLD_G, NISAB_SILVER_G } from '../zakat.js';
import { fullHead } from './common.js';

export const full = true;
export const tab = 'more';

const DEFAULT = { currency: '', goldPrice: 0, silverPrice: 0, basis: 'gold', cash: 0, gold: {}, silver: 0, trade: 0, receivables: 0, debts: 0 };
const data = () => { if (!state.zakat) state.zakat = JSON.parse(JSON.stringify(DEFAULT)); return state.zakat; };

const field = (key, label, hint = '') => {
  const v = key.indexOf('.') === -1 ? data()[key] : data().gold[key.split('.')[1]];
  return `<label class="z-field"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <input type="text" inputmode="decimal" data-z="${key}" value="${v ? num(v) : ''}" placeholder="${num(0)}" autocomplete="off"></label>`;
};

export function render() {
  const z = data();
  return `${fullHead('حاسبة الزكاة', 'زكاة المال والذهب والفضة والتجارة')}
    <section class="card set-card z-card">
      <h2 class="set-title">${icon('info')} الأسعار والنصاب</h2>
      <p class="muted small">أدخل سعر الغرام اليوم في بلدك (يتغيّر يومياً، والتطبيق لا يتصل بالإنترنت لجلبه).</p>
      <label class="z-field"><span>العملة <small>اختياري، مثل: ج.م، ر.س، د.ع</small></span><input type="text" data-z="currency" value="${esc(z.currency)}" maxlength="8" autocomplete="off"></label>
      ${field('goldPrice', `سعر غرام الذهب عيار ${num(24)}`)}
      ${field('silverPrice', 'سعر غرام الفضة الخالصة')}
      <div class="field"><span>النصاب المعتمد</span><div class="seg">
        <button class="seg-btn ${z.basis === 'gold' ? 'on' : ''}" data-basis="gold">الذهب (${num(NISAB_GOLD_G)} غ)</button>
        <button class="seg-btn ${z.basis === 'silver' ? 'on' : ''}" data-basis="silver">الفضة (${num(NISAB_SILVER_G)} غ)</button>
      </div><small class="muted">رجّح كثير من العلماء المعاصرين نصاب الفضة في النقود لأنه أنفع للفقراء، وأخذت جهات أخرى بالذهب. اختر ما تعتمده هيئة الفتوى في بلدك.</small></div>
    </section>

    <section class="card set-card z-card">
      <h2 class="set-title">${icon('download')} أموالك التي حال عليها الحول</h2>
      ${field('cash', 'النقود والأرصدة البنكية')}
      ${KARATS.map((k) => field(`gold.${k}`, `ذهب عيار ${num(k)} (غرام)`)).join('')}
      ${field('silver', 'فضة خالصة (غرام)')}
      ${field('trade', 'قيمة عروض التجارة', 'البضائع المعدّة للبيع بسعر السوق')}
      ${field('receivables', 'ديون لك مرجوّة السداد')}
      ${field('debts', 'ديون حالّة عليك', 'تُخصم من المال')}
    </section>

    <section class="card z-result" data-z-result></section>

    <section class="card set-card">
      <h2 class="set-title">${icon('info')} تنبيهات مهمة</h2>
      <ul class="z-notes">
        <li>تجب الزكاة إذا بلغ المال النصاب وحال عليه الحول، أي مرّت عليه سنة هجرية كاملة.</li>
        <li>مقدار الزكاة ربع العُشر، أي ${fmtNum(2.5, 1)}${getDigits() === 'arab' ? '٪' : '%'} من المال كله.</li>
        <li>الحُليّ المعدّ للاستعمال المباح فيه خلاف بين العلماء: أوجب الحنفية زكاته، ولم يوجبها الجمهور. أدخله إن كنت تأخذ بالوجوب.</li>
        <li>هذه الحاسبة للتقدير، وللحالات الخاصة (الشركات، والأسهم، والديون المتعثّرة) استشر أهل العلم.</li>
      </ul>
    </section>`;
}

function show(root) {
  const z = data();
  const r = computeZakat(z);
  const cur = z.currency ? ` ${esc(z.currency)}` : '';
  const money = (v) => `${fmtNum(v, 2)}${cur}`;
  root.querySelector('[data-z-result]').innerHTML = r.missingPrice
    ? `<p class="center muted">${icon('info')} أدخل سعر غرام ${z.basis === 'gold' ? 'الذهب' : 'الفضة'} لحساب النصاب.</p>`
    : `<div class="z-due ${r.reached ? 'yes' : ''}">
        <small>${r.reached ? 'الزكاة الواجبة' : 'لم يبلغ مالك النصاب'}</small>
        <b>${r.reached ? money(r.due) : '—'}</b>
      </div>
      <div class="z-rows">
        <div><span>صافي المال الزكوي</span><b>${money(r.net)}</b></div>
        <div><span>النصاب (${z.basis === 'gold' ? `${num(NISAB_GOLD_G)} غ ذهب` : `${num(NISAB_SILVER_G)} غ فضة`})</span><b>${money(r.nisab)}</b></div>
        ${r.goldPure ? `<div><span>الذهب بعد التحويل إلى عيار ${num(24)}</span><b>${fmtNum(r.goldPure, 2)} غ = ${money(r.goldValue)}</b></div>` : ''}
        ${r.silverValue ? `<div><span>قيمة الفضة</span><b>${money(r.silverValue)}</b></div>` : ''}
      </div>`;
}

export function mount(root) {
  root.querySelectorAll('[data-z]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.z;
      const z = data();
      if (key === 'currency') z.currency = inp.value.trim();
      else {
        const v = parseNum(inp.value);
        const val = Number.isFinite(v) && v >= 0 ? v : 0;
        if (key.indexOf('gold.') === 0) z.gold[key.slice(5)] = val; else z[key] = val;
        inp.classList.toggle('invalid', inp.value.trim() !== '' && !(Number.isFinite(v) && v >= 0));
      }
      save();
      show(root);
    });
    inp.addEventListener('blur', () => {
      if (inp.dataset.z === 'currency') return;
      const v = parseNum(inp.value);
      if (Number.isFinite(v) && v >= 0) inp.value = num(v);
    });
  });
  root.querySelectorAll('[data-basis]').forEach((b) => b.addEventListener('click', () => {
    data().basis = b.dataset.basis;
    save();
    root.querySelectorAll('[data-basis]').forEach((x) => x.classList.toggle('on', x === b));
    show(root);
  }));
  show(root);
}
