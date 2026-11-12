// حاسبة الزكاة
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, parseNum, fmtNum, getDigits } from '../text.js';
import { computeZakat, KARATS, NISAB_GOLD_G, NISAB_SILVER_G, CURRENCIES, price24 } from '../zakat.js';
import { fullHead, refresh } from './common.js';
import { openSheet, toast, confirmSheet } from '../ui.js';
import { isoDay } from './pickers.js';
import { book, KINDS, TYPES, STATUS, statusOf, delivered, remaining, totals, allocatedFor, filterPeople, addDelivery, uid } from '../zakatlog.js';
import { printHtml } from '../native.js';

export const full = true;
export const tab = 'more';

const DEFAULT = { currency: '', goldKarat: 24, goldPrice: 0, silverPrice: 0, basis: 'gold', cash: 0, gold: {}, silver: 0, trade: 0, receivables: 0, debts: 0 };
const data = () => { if (!state.zakat) state.zakat = JSON.parse(JSON.stringify(DEFAULT)); return state.zakat; };

const field = (key, label, hint = '') => {
  const v = key.indexOf('.') === -1 ? data()[key] : data().gold[key.split('.')[1]];
  return `<label class="z-field"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
    <input type="text" inputmode="decimal" data-z="${key}" value="${v ? num(v) : ''}" placeholder="${num(0)}" autocomplete="off"></label>`;
};

let ztab = 'calc';
const ZTABS = [['calc', 'الحساب'], ['people', 'المستحقون'], ['log', 'السجل']];

export function render(param) {
  if (ZTABS.some(([k]) => k === param)) ztab = param;
  return `${fullHead('حاسبة الزكاة', 'الحساب والمستحقون والسجل')}
    <div class="seg tabs3" role="tablist">${ZTABS.map(([k, l]) => `<button class="seg-btn ${ztab === k ? 'on' : ''}" data-act="z-tab" data-k="${k}" role="tab" aria-selected="${ztab === k}">${l}</button>`).join('')}</div>
    ${ztab === 'people' ? peopleTab() : ztab === 'log' ? logTab() : calcTab()}`;
}

function calcTab() {
  const z = data();
  const priced = z.goldPrice || z.silverPrice;
  return `<details class="card set-card z-card z-fold" ${priced ? '' : 'open'}>
      <summary class="set-title">${icon('info')} الأسعار والنصاب <small class="muted">${priced ? `آخر سعر أدخلته: ${z.priceDate ? num(z.priceDate.split('-').reverse().join('/')) : 'غير معروف'}` : 'أدخل السعر أولاً'}</small></summary>
      <p class="muted small">أدخل سعر الغرام اليوم في بلدك يدوياً؛ التطبيق لا يجلب الأسعار، ولا يعتبر أي سعر قديم سعراً حالياً.</p>
      <div class="field"><span>العملة</span>
        <div class="cur-chips">${CURRENCIES.map(([name, sym]) => `<button class="chip ${z.currency === sym ? 'on' : ''}" data-cur="${esc(sym)}">${name}</button>`).join('')}</div>
        <label class="z-field slim"><span><small>أو اكتب رمز عملة أخرى</small></span><input type="text" data-z="currency" value="${esc(z.currency)}" maxlength="8" autocomplete="off"></label>
      </div>
      <div class="field"><span>سعر الغرام الذي تعرفه بعيار</span><div class="seg">${[24, 21, 18].map((k) => `<button class="seg-btn ${(z.goldKarat || 24) === k ? 'on' : ''}" data-karat="${k}">${num(k)}</button>`).join('')}</div></div>
      ${field('goldPrice', `سعر غرام الذهب عيار ${num(z.goldKarat || 24)}`)}
      <p class="muted small z-conv" data-z-conv></p>
      ${field('silverPrice', 'سعر غرام الفضة الخالصة')}
      <div class="field"><span>النصاب المعتمد</span><div class="seg">
        <button class="seg-btn ${z.basis === 'gold' ? 'on' : ''}" data-basis="gold">الذهب (${num(NISAB_GOLD_G)} غ)</button>
        <button class="seg-btn ${z.basis === 'silver' ? 'on' : ''}" data-basis="silver">الفضة (${num(NISAB_SILVER_G)} غ)</button>
      </div><small class="muted">رجّح كثير من العلماء المعاصرين نصاب الفضة في النقود لأنه أنفع للفقراء، وأخذت جهات أخرى بالذهب. اختر ما تعتمده هيئة الفتوى في بلدك.</small></div>

    </details>

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
    <button class="btn btn-primary wide" data-act="z-save">${icon('bookmark')} حفظ الحساب في السجل</button>

    <details class="card set-card z-fold">
      <summary class="set-title">${icon('info')} تنبيهات مهمة</summary>
      <ul class="z-notes">
        <li>تجب الزكاة إذا بلغ المال النصاب وحال عليه الحول، أي مرّت عليه سنة هجرية كاملة.</li>
        <li>مقدار الزكاة ربع العُشر، أي ${fmtNum(2.5, 1)}${getDigits() === 'arab' ? '٪' : '%'} من المال كله.</li>
        <li>الحُليّ المعدّ للاستعمال المباح فيه خلاف بين العلماء: أوجب الحنفية زكاته، ولم يوجبها الجمهور. أدخله إن كنت تأخذ بالوجوب.</li>
        <li>هذه الحاسبة للتقدير، وللحالات الخاصة (الشركات، والأسهم، والديون المتعثّرة) استشر أهل العلم.</li>
      </ul>
    </details>`;
}

function show(root) {
  if (!root.querySelector('[data-z-result]')) return;
  const z = data();
  const r = computeZakat({ ...z, goldPrice: price24(z.goldPrice, z.goldKarat || 24) });
  const conv = root.querySelector('[data-z-conv]');
  if (conv) conv.textContent = (z.goldKarat || 24) !== 24 && z.goldPrice ? `يعادل سعر غرام عيار ${num(24)}: ${fmtNum(price24(z.goldPrice, z.goldKarat), 2)}${z.currency ? ` ${z.currency}` : ''}` : '';
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
  mountPeople(root);
  root.querySelectorAll('[data-z]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const key = inp.dataset.z;
      const z = data();
      if (key === 'currency') {
        z.currency = inp.value.trim();
        root.querySelectorAll('[data-cur]').forEach((x) => x.classList.toggle('on', x.dataset.cur === z.currency));
      }
      else {
        const v = parseNum(inp.value);
        const val = Number.isFinite(v) && v >= 0 ? v : 0;
        if (key.indexOf('gold.') === 0) z.gold[key.slice(5)] = val; else z[key] = val;
        if (key === 'goldPrice' || key === 'silverPrice') z.priceDate = isoDay(new Date());
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
  root.querySelectorAll('[data-cur]').forEach((b) => b.addEventListener('click', () => {
    data().currency = b.dataset.cur;
    save();
    root.querySelector('[data-z="currency"]').value = b.dataset.cur;
    root.querySelectorAll('[data-cur]').forEach((x) => x.classList.toggle('on', x === b));
    show(root);
  }));
  root.querySelectorAll('[data-karat]').forEach((b) => b.addEventListener('click', () => {
    data().goldKarat = +b.dataset.karat;
    save();
    document.dispatchEvent(new Event('app:refresh'));
  }));
  root.querySelectorAll('[data-basis]').forEach((b) => b.addEventListener('click', () => {
    data().basis = b.dataset.basis;
    save();
    root.querySelectorAll('[data-basis]').forEach((x) => x.classList.toggle('on', x === b));
    show(root);
  }));
  show(root);
}

// ---------- المستحقون ----------
let filter = { q: '', group: '', type: '', status: '' };
const cur = (c) => (c ? ` ${esc(c)}` : '');
const money2 = (v, c) => `${fmtNum(v, 2)}${cur(c)}`;
const STATUS_TONE = { none: 'amber', partial: 'violet', done: 'teal' };

function personRow(p) {
  const st = statusOf(p);
  return `<button class="zp-row" data-act="zp-open" data-id="${p.id}">
    <span class="zp-main"><b>${esc(p.name)}</b><small>${KINDS[p.kind]} · ${esc(p.group)}${p.dueDate ? ` · موعد ${num(p.dueDate.split('-').reverse().join('/'))}` : ''}</small></span>
    <span class="zp-side"><span class="zp-type ${p.type}">${TYPES[p.type]}</span><b>${money2(p.amount, p.currency)}</b><small class="tone-${STATUS_TONE[st]} zp-st">${STATUS[st]}${st === 'partial' ? ` · بقي ${money2(remaining(p), p.currency)}` : ''}</small></span>
  </button>`;
}

function peopleTab() {
  const b = book();
  const list = filterPeople(b.people, { group: filter.group });
  return `<div class="chips zp-groups">
      <button class="chip ${filter.group ? '' : 'on'}" data-act="zp-group" data-g="">الكل ${num(b.people.length)}</button>
      ${b.groups.map((g) => `<button class="chip ${filter.group === g ? 'on' : ''}" data-act="zp-group" data-g="${esc(g)}">${esc(g)} ${num(b.people.filter((p) => p.group === g).length)}</button>`).join('')}
      <button class="chip ghost" data-act="zp-newgroup">${icon('plus')} مجموعة</button>
    </div>
    ${list.length ? `<div class="card zp-list">${list.map(personRow).join('')}</div>`
    : `<div class="empty">${icon('hands')}<p>لا مستحقين ${filter.group ? 'في هذه المجموعة' : 'بعد'}</p><small>أضف الأسر والأفراد لمتابعة المبالغ وتسليمها</small></div>`}
    <p class="muted small">تسجيل الاسم هنا للمتابعة فقط، ولا يعني التحقق الشرعي من استحقاق الزكاة.</p>
    <button class="btn btn-primary wide z-fab" data-act="zp-open">${icon('plus')} إضافة مستحق</button>`;
}

function personSheet(existing) {
  const b = book();
  const z = data();
  const p = existing || { id: '', name: '', kind: 'fam', type: 'zakat', group: filter.group || 'عام', amount: 0, currency: z.currency || '', phone: '', note: '', dueDate: '', saveId: '', deliveries: [] };
  let kind = p.kind;
  let type = p.type;
  let group = p.group;
  const saves = b.saves;
  openSheet(`<h3 class="sheet-title">${existing ? 'المستحق' : 'إضافة مستحق زكاة أو صدقة'}</h3>
    <div class="seg">${Object.entries(TYPES).map(([k, l]) => `<button class="seg-btn ${type === k ? 'on' : ''}" data-type="${k}">${l}</button>`).join('')}</div>
    <div class="seg">${Object.entries(KINDS).map(([k, l]) => `<button class="seg-btn ${kind === k ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}</div>
    <div class="chips">${b.groups.map((g) => `<button class="chip ${group === g ? 'on' : ''}" data-grp="${esc(g)}">${esc(g)}</button>`).join('')}</div>
    <label class="field"><span>اسم المستحق أو الأسرة</span><input type="text" data-pf="name" maxlength="120" value="${esc(p.name)}"></label>
    <div class="zp-two"><label class="field"><span>المبلغ المخصص</span><input type="text" inputmode="decimal" data-pf="amount" value="${p.amount ? num(p.amount) : ''}" placeholder="${num(0)}"></label>
      <label class="field"><span>العملة</span><input type="text" data-pf="currency" maxlength="8" value="${esc(p.currency)}"></label></div>
    <details class="zp-more" ${p.phone || p.note || p.dueDate || p.saveId ? 'open' : ''}><summary>${icon('plus')} هاتف وملاحظات وموعد (اختياري)</summary>
      <label class="field"><span>رقم الهاتف</span><input type="tel" data-pf="phone" maxlength="30" value="${esc(p.phone)}" dir="ltr"></label>
      <label class="field"><span>ملاحظات أو العنوان</span><input type="text" data-pf="note" maxlength="500" value="${esc(p.note)}"></label>
      <label class="field"><span>موعد التسليم</span><input type="date" data-pf="dueDate" value="${esc(p.dueDate)}"></label>
      ${saves.length ? `<label class="field"><span>من حساب زكاة محفوظ</span><select data-pf="saveId"><option value="">غير مرتبط</option>${saves.map((x) => `<option value="${x.id}" ${p.saveId === x.id ? 'selected' : ''}>${esc(x.label)} · ${money2(x.due, x.currency)}</option>`).join('')}</select></label>` : ''}
    </details>
    ${existing ? `<div class="zp-deliv"><b>التسليم: ${money2(delivered(p), p.currency)} من ${money2(p.amount, p.currency)}</b>
      ${(p.deliveries || []).map((d) => `<small>${num(d.at.slice(0, 10).split('-').reverse().join('/'))} · ${money2(d.amount, p.currency)}</small>`).join('')}
      ${remaining(p) > 0 ? `<div class="zp-two"><input type="text" inputmode="decimal" data-dl value="${num(remaining(p))}" aria-label="المبلغ المسلَّم"><button class="btn btn-soft" data-deliver>${icon('check')} تسجيل تسليم</button></div>` : `<small class="tone-teal zp-st">${STATUS.done}</small>`}</div>` : ''}
    <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} حفظ</button>
      ${existing ? `<button class="btn btn-danger-soft" data-del>${icon('trash')} حذف</button>` : '<button class="btn btn-ghost" data-close>إلغاء</button>'}</div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => {
      const pick = (attr, setv) => body.querySelectorAll(`[${attr}]`).forEach((x) => x.addEventListener('click', () => { setv(x.getAttribute(attr)); body.querySelectorAll(`[${attr}]`).forEach((y) => y.classList.toggle('on', y === x)); }));
      pick('data-type', (v) => { type = v; });
      pick('data-kind', (v) => { kind = v; });
      pick('data-grp', (v) => { group = v; });
      const val = (k) => body.querySelector(`[data-pf="${k}"]`) ? body.querySelector(`[data-pf="${k}"]`).value.trim() : '';
      body.querySelector('[data-save]').addEventListener('click', () => {
        const name = val('name');
        const amount = parseNum(val('amount'));
        if (!name) { toast('اكتب الاسم أولاً', 'info'); return; }
        if (!(Number.isFinite(amount) && amount >= 0)) { toast('المبلغ غير صحيح', 'info'); return; }
        const patch = { name, kind, type, group, amount: Math.round(amount * 100) / 100, currency: val('currency'), phone: val('phone'), note: val('note'), dueDate: val('dueDate'), saveId: type === 'zakat' ? val('saveId') : '' };
        if (existing) Object.assign(existing, patch); else b.people.push({ id: uid('zp'), deliveries: [], ...patch });
        save();
        close();
        refresh();
      });
      const dl = body.querySelector('[data-deliver]');
      if (dl) dl.addEventListener('click', () => {
        const a = parseNum(body.querySelector('[data-dl]').value);
        if (!(a > 0)) { toast('اكتب المبلغ المسلَّم', 'info'); return; }
        addDelivery(existing, a);
        close();
        toast(statusOf(existing) === 'done' ? 'اكتمل التسليم، تقبّل الله' : 'سُجّل تسليم جزئي', 'check');
        refresh();
      });
      const del = body.querySelector('[data-del]');
      if (del) del.addEventListener('click', async () => {
        close();
        if (!(await confirmSheet('حذف المستحق', `سيُحذف «${esc(existing.name)}» وسجل تسليمه.`, 'حذف', true))) return;
        b.people = b.people.filter((x) => x !== existing);
        save();
        refresh();
      });
    },
  });
}

function mountPeople(root) {
  const q = root.querySelector('[data-zq]');
  if (q) q.addEventListener('input', () => { filter.q = q.value; root.querySelector('[data-zlog]').innerHTML = logList(); });
  root.querySelectorAll('[data-zf]').forEach((sel) => sel.addEventListener('change', () => { filter[sel.dataset.zf] = sel.value; root.querySelector('[data-zlog]').innerHTML = logList(); }));
}

// ---------- السجل ----------
function totalsHtml(people) {
  const t = totals(people);
  if (!t.length) return '';
  return `<div class="zl-totals">${t.map((x) => `<div class="zl-total ${x.type}"><small>${TYPES[x.type]}${x.currency ? ` · ${esc(x.currency)}` : ''} · ${num(x.count)}</small>
    <b>${money2(x.allocated, x.currency)}</b><span>مُسلَّم ${money2(x.delivered, x.currency)} · متبقٍّ ${money2(x.remaining, x.currency)}</span></div>`).join('')}</div>`;
}

function logList() {
  const list = filterPeople(book().people, filter);
  return `${totalsHtml(list)}${list.length ? `<div class="card zp-list">${list.map(personRow).join('')}</div>` : '<p class="muted center">لا نتائج</p>'}`;
}

function logTab() {
  const b = book();
  return `${b.saves.length ? `<details class="card set-card z-fold" open><summary class="set-title">${icon('bookmark')} حسابات الزكاة المحفوظة <small class="muted">${num(b.saves.length)}</small></summary>
      ${b.saves.map((x) => {
    const alloc = allocatedFor(x.id);
    return `<div class="zl-save"><div><b>${esc(x.label)}</b><small>${num(x.at.slice(0, 10).split('-').reverse().join('/'))} · نصاب ${x.basis === 'silver' ? 'الفضة' : 'الذهب'} · صافي ${money2(x.net, x.currency)}</small></div>
          <div class="zl-nums"><b>${money2(x.due, x.currency)}</b><small>خُصّص منها ${money2(alloc, x.currency)} · غير مخصّص ${money2(Math.max(0, x.due - alloc), x.currency)}</small></div>
          <button class="icon-btn sm" data-act="zl-delsave" data-id="${x.id}" aria-label="حذف الحساب">${icon('trash')}</button></div>`;
  }).join('')}</details>` : ''}
    <div class="zl-filters">
      <label class="search">${icon('search')}<input type="search" data-zq value="${esc(filter.q)}" placeholder="ابحث بالاسم أو الملاحظة…" autocomplete="off"></label>
      <div class="zl-sel">
        <select data-zf="group" aria-label="المجموعة"><option value="">كل المجموعات</option>${b.groups.map((g) => `<option ${filter.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
        <select data-zf="type" aria-label="النوع"><option value="">زكاة وصدقة</option>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${filter.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select data-zf="status" aria-label="حالة التسليم"><option value="">كل الحالات</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${filter.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
    </div>
    <div data-zlog>${logList()}</div>
    <button class="btn btn-soft wide" data-act="zl-print">${icon('download')} طباعة أو حفظ PDF</button>`;
}

/** تقرير HTML عربي منسّق للطباعة أو الحفظ PDF من نافذة طباعة النظام */
export function reportHtml(people, saves, { phone = false, notes = false } = {}) {
  const e = (t) => esc(String(t || ''));
  const m = (v, c) => `${fmtNum(v, 2)}${c ? ` ${e(c)}` : ''}`;
  const rows = people.map((p, i) => `<tr><td>${num(i + 1)}</td><td>${e(p.name)}</td><td>${KINDS[p.kind]}</td><td>${e(p.group)}</td><td>${TYPES[p.type]}</td><td>${m(p.amount, p.currency)}</td><td>${m(delivered(p), p.currency)}</td><td>${m(remaining(p), p.currency)}</td><td>${STATUS[statusOf(p)]}</td>${phone ? `<td dir="ltr">${e(p.phone)}</td>` : ''}${notes ? `<td>${e(p.note)}</td>` : ''}</tr>`).join('');
  const t = totals(people).map((x) => `<li>${TYPES[x.type]}${x.currency ? ` (${e(x.currency)})` : ''}: مخصّص ${m(x.allocated, x.currency)}، مُسلَّم ${m(x.delivered, x.currency)}، متبقٍّ ${m(x.remaining, x.currency)}</li>`).join('');
  const sv = saves.map((x) => `<li>${e(x.label)}: الزكاة الواجبة ${m(x.due, x.currency)}، خُصّص منها ${m(allocatedFor(x.id, people), x.currency)}</li>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سجل الزكاة والصدقات</title>
<style>body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;color:#18241E;margin:24px;font-size:12px}h1{font-size:20px;color:#1F5E43;margin:0 0 4px}p{margin:0 0 12px;color:#555}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #cfd8d3;padding:6px 8px;text-align:right;vertical-align:top}th{background:#eef4f0}ul{padding-right:18px}
@page{size:A4 landscape;margin:12mm}</style></head><body>
<h1>سجل الزكاة والصدقات</h1><p>سكينة · ${num(new Date().toISOString().slice(0, 10).split('-').reverse().join('/'))}</p>
${sv ? `<h3>حسابات الزكاة المحفوظة</h3><ul>${sv}</ul>` : ''}${t ? `<h3>المجاميع</h3><ul>${t}</ul>` : ''}
<table><thead><tr><th>#</th><th>الاسم</th><th>النوع</th><th>المجموعة</th><th>زكاة/صدقة</th><th>المخصّص</th><th>المُسلَّم</th><th>المتبقي</th><th>الحالة</th>${phone ? '<th>الهاتف</th>' : ''}${notes ? '<th>ملاحظات</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
}

export const actions = {
  'z-tab': (el) => { ztab = el.dataset.k; window.location.replace(`#/zakat/${ztab}`); },
  'z-save': async () => {
    const z = data();
    const r = computeZakat({ ...z, goldPrice: price24(z.goldPrice, z.goldKarat || 24) });
    if (r.missingPrice) { toast('أدخل سعر النصاب أولاً', 'info'); return; }
    const today = isoDay(new Date());
    book().saves.unshift({ id: uid('zs'), at: new Date().toISOString(), label: `حساب ${num(today.split('-').reverse().join('/'))}`, currency: z.currency || '', basis: z.basis, net: r.net, nisab: r.nisab, due: r.due, reached: r.reached, priceDate: z.priceDate || '' });
    save();
    toast(r.reached ? 'حُفظ الحساب في السجل' : 'حُفظ الحساب (لم يبلغ النصاب)', 'bookmark');
  },
  'zp-open': (el) => personSheet(el.dataset.id ? book().people.find((p) => p.id === el.dataset.id) : null),
  'zp-group': (el) => { filter.group = el.dataset.g; refresh(); },
  'zp-newgroup': () => {
    openSheet(`<h3 class="sheet-title">مجموعة جديدة</h3><label class="field"><span>اسم المجموعة</span><input type="text" data-g maxlength="40" placeholder="مثلاً: الأقارب"></label>
      <div class="row-btns"><button class="btn btn-primary" data-ok>${icon('check')} إضافة</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
      onMount: (body, close) => body.querySelector('[data-ok]').addEventListener('click', () => {
        const g = body.querySelector('[data-g]').value.trim();
        if (!g) return;
        if (book().groups.indexOf(g) === -1) book().groups.push(g);
        filter.group = g;
        save();
        close();
        refresh();
      }),
    });
  },
  'zl-delsave': async (el) => {
    if (!(await confirmSheet('حذف الحساب المحفوظ', 'يُحذف الحساب من السجل، ويبقى المستحقون المرتبطون به دون ربط.', 'حذف', true))) return;
    const b = book();
    b.saves = b.saves.filter((x) => x.id !== el.dataset.id);
    b.people.forEach((p) => { if (p.saveId === el.dataset.id) p.saveId = ''; });
    save();
    refresh();
  },
  'zl-print': () => {
    const people = filterPeople(book().people, filter);
    if (!people.length && !book().saves.length) { toast('السجل فارغ', 'info'); return; }
    openSheet(`<h3 class="sheet-title">طباعة السجل أو حفظه PDF</h3>
      <p class="sheet-text">يُطبع ما يظهر حسب التصفية الحالية (${num(people.length)} مستحق). اختر من نافذة الطباعة «حفظ كملف PDF».</p>
      <label class="set-row"><span class="set-txt"><b>إظهار أرقام الهواتف</b></span><input type="checkbox" data-ph></label>
      <label class="set-row"><span class="set-txt"><b>إظهار الملاحظات والعناوين</b></span><input type="checkbox" data-nt></label>
      <div class="row-btns"><button class="btn btn-primary" data-go>${icon('download')} متابعة</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
      onMount: (body, close) => body.querySelector('[data-go]').addEventListener('click', async () => {
        const html = reportHtml(people, book().saves, { phone: body.querySelector('[data-ph]').checked, notes: body.querySelector('[data-nt]').checked });
        close();
        if (!(await printHtml(html, 'سجل الزكاة والصدقات'))) toast('تعذّر فتح نافذة الطباعة', 'info');
      }),
    });
  },
};
