// سجل الزكاة والصدقات: الحسابات المحفوظة، والمستحقون، والتسليم الكامل والجزئي.
// الزكاة والصدقة منفصلتان في كل المجاميع، ولا تُدمج مبالغ حسابات مختلفة ضمنياً.
import { state, save } from './store.js';

export const KINDS = { ind: 'فرد', fam: 'أسرة' };
export const TYPES = { zakat: 'زكاة', sadaqa: 'صدقة' };
export const STATUS = { none: 'لم يُسلَّم', partial: 'تسليم جزئي', done: 'مُسلَّم' };
const round2 = (v) => Math.round(v * 100) / 100;

export function book() {
  if (!state.zakatBook) state.zakatBook = { saves: [], people: [], groups: ['عام'] };
  return state.zakatBook;
}

export const delivered = (p) => round2((p.deliveries || []).reduce((s, d) => s + d.amount, 0));
export const remaining = (p) => round2(Math.max(0, p.amount - delivered(p)));
export function statusOf(p) {
  const d = delivered(p);
  if (d <= 0) return 'none';
  return d + 0.004 >= p.amount ? 'done' : 'partial';
}

/** مجاميع منفصلة للزكاة والصدقة، مجمّعة حسب العملة حتى لا تُجمع عملات مختلفة */
export function totals(people) {
  const out = {};
  for (const p of people) {
    const k = `${p.type}|${p.currency || ''}`;
    if (!out[k]) out[k] = { type: p.type, currency: p.currency || '', allocated: 0, delivered: 0, remaining: 0, count: 0 };
    const t = out[k];
    t.allocated = round2(t.allocated + p.amount);
    t.delivered = round2(t.delivered + delivered(p));
    t.remaining = round2(t.remaining + remaining(p));
    t.count += 1;
  }
  return Object.values(out).sort((a, b) => (a.type === b.type ? a.currency.localeCompare(b.currency) : a.type === 'zakat' ? -1 : 1));
}

/** ما خُصّص من حساب زكاة محفوظ بعينه (من المستحقين المرتبطين به فقط) */
export function allocatedFor(saveId, people = book().people) {
  return round2(people.filter((p) => p.saveId === saveId && p.type === 'zakat').reduce((s, p) => s + p.amount, 0));
}

export function filterPeople(people, { q = '', group = '', type = '', status = '' } = {}) {
  const nq = q.trim();
  return people.filter((p) => (!group || p.group === group) && (!type || p.type === type) && (!status || statusOf(p) === status)
    && (!nq || `${p.name} ${p.note || ''} ${p.group}`.indexOf(nq) !== -1));
}

export const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function addDelivery(p, amount, at = new Date()) {
  const a = round2(Math.min(amount, remaining(p)));
  if (!(a > 0)) return false;
  p.deliveries = p.deliveries || [];
  p.deliveries.push({ id: uid('dl'), at: at.toISOString(), amount: a });
  save();
  return true;
}

/** تصحيح بيانات السجل المحفوظة أو المستوردة */
export function sanitizeBook(b) {
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const n = (v) => (Number.isFinite(+v) && +v >= 0 ? round2(+v) : 0);
  if (!isObj(b)) return null;
  const groups = Array.isArray(b.groups) ? [...new Set(b.groups.filter((g) => typeof g === 'string' && g.trim()).map((g) => g.trim().slice(0, 40)))] : [];
  if (groups.indexOf('عام') === -1) groups.unshift('عام');
  const saves = Array.isArray(b.saves) ? b.saves.filter((x) => isObj(x) && typeof x.id === 'string').map((x) => ({ ...x, due: n(x.due), net: n(x.net), nisab: n(x.nisab) })) : [];
  const people = Array.isArray(b.people) ? b.people.filter((p) => isObj(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim()).map((p) => ({
    id: p.id, name: p.name.slice(0, 120), kind: KINDS[p.kind] ? p.kind : 'ind', type: TYPES[p.type] ? p.type : 'zakat',
    group: groups.indexOf(p.group) !== -1 ? p.group : 'عام', amount: n(p.amount), currency: typeof p.currency === 'string' ? p.currency.slice(0, 8) : '',
    phone: typeof p.phone === 'string' ? p.phone.slice(0, 30) : '', note: typeof p.note === 'string' ? p.note.slice(0, 500) : '',
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate || '') ? p.dueDate : '', saveId: typeof p.saveId === 'string' ? p.saveId : '',
    deliveries: Array.isArray(p.deliveries) ? p.deliveries.filter((d) => isObj(d) && n(d.amount) > 0).map((d) => ({ id: String(d.id || uid('dl')), at: String(d.at || ''), amount: n(d.amount) })) : [],
  })) : [];
  return { saves, people, groups };
}
