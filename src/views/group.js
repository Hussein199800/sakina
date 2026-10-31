// الختمة الجماعية: توزيع الأجزاء على المشاركين، ومشاركة التوزيع، ومتابعة من أتمّ نصيبه
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { num, esc, fmtPct, plural } from '../text.js';

const juzCount = (n) => plural(n, ['جزءاً واحداً', 'جزأين', 'أجزاء', 'جزءاً']);
import { JUZ } from '../data/quran-meta.js';
import { pageOf } from '../quran.js';
import { distribute, MAX_MEMBERS } from '../group.js';
import { fullHead, refresh } from './common.js';
import { openSheet, toast, confirmSheet, tapFeedback } from '../ui.js';
import { shareText } from '../native.js';

export const full = true;
export const tab = 'quran';

const groups = () => { if (!Array.isArray(state.groups)) state.groups = []; return state.groups; };
const juzLabel = (m) => (m.from === m.to ? `الجزء ${num(m.from)}` : `الأجزاء ${num(m.from)}–${num(m.to)}`);

function shareMessage(g) {
  const lines = g.members.map((m, i) => `${num(i + 1)}. ${m.name}: ${juzLabel(m)}${m.done ? ' ✓' : ''}`);
  return `📖 ختمة جماعية: ${g.name}\n\n${lines.join('\n')}\n\nمن أتمّ نصيبه فليُخبرنا، ولا تنسونا من صالح دعائكم.\n— من تطبيق سكينة`;
}

function groupCard(g) {
  const done = g.members.filter((m) => m.done).length;
  const frac = g.members.length ? done / g.members.length : 0;
  return `<section class="card group-card">
    <div class="gc-head">
      <div><b>${esc(g.name)}</b><small>${num(g.members.length)} مشاركين · أتمّ ${num(done)}</small></div>
      <span class="gc-pct">${fmtPct(frac)}</span>
    </div>
    <span class="bar"><i style="width:${Math.round(frac * 100)}%"></i></span>
    <ol class="gc-list">${g.members.map((m, i) => `
      <li class="gc-row ${m.done ? 'done' : ''}">
        <button class="gc-check" data-act="g-toggle" data-g="${g.id}" data-i="${i}" aria-pressed="${!!m.done}" aria-label="أتمّ ${esc(m.name)} نصيبه">${icon('check')}</button>
        <span class="gc-name"><b>${esc(m.name)}</b><small>${juzLabel(m)}</small></span>
        <button class="icon-btn sm" data-act="go" data-to="#/mushaf/${pageOf(JUZ[m.from - 1])}" aria-label="افتح ${juzLabel(m)}">${icon('book')}</button>
      </li>`).join('')}</ol>
    ${done === g.members.length && g.members.length ? `<p class="note">${icon('sparkle')} اكتملت الختمة الجماعية، تقبّل الله منكم جميعاً.</p>` : ''}
    <div class="row-btns">
      <button class="btn btn-primary" data-act="g-share" data-g="${g.id}">${icon('share')} مشاركة التوزيع</button>
      <button class="btn btn-danger-soft" data-act="g-del" data-g="${g.id}">${icon('trash')} حذف</button>
    </div>
  </section>`;
}

export function render() {
  const list = groups();
  return `${fullHead('الختمة الجماعية', 'وزّع الأجزاء على أهلك وأصحابك')}
    <section class="card khatma-card">
      <div class="kc-head"><span class="kc-ic">${icon('flag')}</span><div><b>ختمة مع من تحب</b><small>اكتب أسماء المشاركين، فيوزّع التطبيق الأجزاء الثلاثين عليهم بالتساوي، ثم شارك التوزيع في مجموعتكم.</small></div></div>
      <button class="btn btn-primary wide" data-act="g-new">${icon('plus')} ختمة جماعية جديدة</button>
    </section>
    ${list.length ? list.map(groupCard).join('') : ''}`;
}

function newSheet() {
  openSheet(`<h3 class="sheet-title">ختمة جماعية جديدة</h3>
    <label class="field"><span>اسم الختمة</span><input type="text" id="g-name" maxlength="50" placeholder="مثلاً: ختمة العائلة، ختمة رمضان"></label>
    <label class="field"><span>أسماء المشاركين (اسم في كل سطر، حتى ${num(MAX_MEMBERS)} مشاركاً)</span>
      <textarea id="g-members" rows="6" class="plain" placeholder="محمد\nأحمد\nفاطمة"></textarea></label>
    <p class="muted small" data-g-preview></p>
    <div class="row-btns"><button class="btn btn-primary" data-save>${icon('check')} وزّع الأجزاء</button><button class="btn btn-ghost" data-close>إلغاء</button></div>`, {
    cls: 'sheet-tall',
    onMount: (body, close) => {
      const ta = body.querySelector('#g-members');
      const names = () => ta.value.split('\n').map((x) => x.trim()).filter(Boolean);
      const prev = body.querySelector('[data-g-preview]');
      const upd = () => {
        const n = names().length;
        if (!n) { prev.textContent = ''; return; }
        if (n > MAX_MEMBERS) { prev.textContent = `العدد ${num(n)} أكبر من ${num(MAX_MEMBERS)}؛ قسّمهم على ختمتين.`; return; }
        const lo = Math.floor(30 / n);
        const hi = lo + (30 % n ? 1 : 0);
        prev.textContent = n === 1 ? 'سيقرأ المشارك القرآن كاملاً.' : `سيأخذ كل مشارك ${juzCount(lo)}${hi !== lo ? ` أو ${juzCount(hi)}` : ''}.`;
      };
      ta.addEventListener('input', upd);
      body.querySelector('[data-save]').addEventListener('click', () => {
        const list = names();
        const name = body.querySelector('#g-name').value.trim() || 'ختمة جماعية';
        if (!list.length) { toast('اكتب اسم مشارك واحد على الأقل', 'info'); return; }
        if (list.length > MAX_MEMBERS) { toast(`الحد الأعلى ${num(MAX_MEMBERS)} مشاركاً`, 'info'); return; }
        const parts = distribute(list.length);
        groups().unshift({ id: `g-${Date.now().toString(36)}`, name, created: Date.now(), members: list.map((m, i) => ({ name: m, ...parts[i], done: false })) });
        save();
        close();
        toast('تم توزيع الأجزاء', 'flag');
        refresh();
      });
    },
  });
}

const find = (id) => groups().find((g) => g.id === id);

export const actions = {
  'g-new': () => newSheet(),
  'g-toggle': (el) => {
    const g = find(el.dataset.g);
    if (!g) return;
    const m = g.members[+el.dataset.i];
    m.done = !m.done;
    save();
    tapFeedback(m.done ? 'item' : 'tap');
    refresh();
  },
  'g-share': async (el) => {
    const g = find(el.dataset.g);
    if (!g) return;
    const r = await shareText(shareMessage(g), g.name);
    if (r === 'copied') toast('تم نسخ التوزيع لمشاركته');
  },
  'g-del': async (el) => {
    const g = find(el.dataset.g);
    if (!g || !(await confirmSheet('حذف الختمة الجماعية', `هل تريد حذف «${esc(g.name)}»؟`, 'حذف', true))) return;
    state.groups = groups().filter((x) => x.id !== g.id);
    save();
    refresh();
  },
};

export { shareMessage };
