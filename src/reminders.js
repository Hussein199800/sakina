// التذكيرات المخصّصة: أنواع جاهزة (الصيام، الجمعة، القيام...) وتذكير حرّ يكتبه المستخدم.
// تُحوَّل كل تذكير إلى مواعيد محددة خلال الأيام القادمة، لأن بعضها مرتبط بالتقويم الهجري ولا يتكرر بانتظام.
import { toHijri, HIJRI_MONTHS } from './dates.js';

export const KINDS = {
  monthu: {
    title: 'صيام الاثنين والخميس', icon: 'calendar', tone: 'teal', time: '21:00', mode: 'eve', modes: true,
    desc: '«تُعرض الأعمال يوم الاثنين والخميس، فأحب أن يُعرض عملي وأنا صائم» رواه الترمذي.',
  },
  white: {
    title: 'صيام الأيام البيض', icon: 'moon', tone: 'indigo', time: '21:00', mode: 'eve', modes: true,
    desc: 'الثالث عشر والرابع عشر والخامس عشر من كل شهر هجري، وصيامها كصيام الدهر.',
  },
  occasions: {
    title: 'الأيام الفاضلة', icon: 'star', tone: 'amber', time: '20:00', mode: 'eve', modes: true,
    desc: 'تاسوعاء وعاشوراء، وبداية العشر من ذي الحجة، ويوم عرفة، والعشر الأواخر من رمضان، وست شوال.',
  },
  kahf: {
    title: 'سورة الكهف يوم الجمعة', icon: 'book', tone: 'violet', time: '10:00', mode: 'day', modes: true,
    desc: 'يبدأ وقتها من غروب شمس الخميس إلى غروب شمس الجمعة.', eveLabel: 'ليلة الجمعة', dayLabel: 'يوم الجمعة',
  },
  salawat: {
    title: 'الصلاة على النبي ﷺ يوم الجمعة', icon: 'sparkle', tone: 'rose', time: '12:00', mode: 'day',
    desc: '«أكثروا عليّ من الصلاة يوم الجمعة وليلة الجمعة» رواه البيهقي وحسّنه الألباني.',
  },
  qiyam: {
    title: 'قيام الليل', icon: 'moon', tone: 'indigo', time: '03:30', mode: 'day',
    desc: '«أفضل الصلاة بعد الفريضة صلاة الليل» رواه مسلم.',
  },
  duha: {
    title: 'صلاة الضحى', icon: 'sun', tone: 'amber', time: '09:00', mode: 'day',
    desc: 'وقتها من ارتفاع الشمس قيد رمح بعد الشروق إلى قبيل الظهر. «يصبح على كل سُلامى من أحدكم صدقة… ويجزئ من ذلك ركعتان يركعهما من الضحى» رواه مسلم.',
  },
  custom: { title: 'تذكير مخصّص', icon: 'edit', tone: 'sand', time: '20:00', mode: 'day', desc: 'اكتب ما تريد أن نذكّرك به، واختر وقته وتكراره.' },
};

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// المناسبات التي يُذكَّر بها: [شهر هجري، يوم، النص]
const OCCASION_DAYS = [
  [1, 9, 'صيام تاسوعاء', 'يُستحب صيام التاسع مع العاشر من المحرّم.'],
  [1, 10, 'صيام عاشوراء', 'صيامه يكفّر السنة التي قبله. رواه مسلم.'],
  [12, 1, 'العشر الأوائل من ذي الحجة', 'أفضل أيام الدنيا، أكثر فيها من التكبير والتهليل والعمل الصالح.'],
  [12, 9, 'صيام يوم عرفة', 'صيامه يكفّر السنة الماضية والباقية. رواه مسلم.'],
  [9, 21, 'العشر الأواخر من رمضان', 'التمس ليلة القدر، وأكثر من: اللهم إنك عفو تحب العفو فاعفُ عني.'],
  [10, 2, 'صيام ست من شوال', 'من صام رمضان ثم أتبعه ستاً من شوال كان كصيام الدهر. رواه مسلم.'],
];

const DAY = 86400000;
const ymd = (d) => ({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), wd: d.getDay() });
const atTime = (date, time) => {
  const [h, m] = String(time || '20:00').split(':').map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0, 0, 0);
};

/** وصف قصير لوقت التذكير ونمطه */
export function describe(r) {
  const k = KINDS[r.kind] || KINDS.custom;
  if (r.kind === 'custom') {
    if (r.repeat === 'once') return `مرة واحدة · ${r.date || ''}`;
    if (r.repeat === 'weekly') return `أسبوعياً · ${(r.days || []).map((d) => DAY_NAMES[d]).join('، ') || 'لم تُحدَّد أيام'}`;
    return 'يومياً';
  }
  if (!k.modes) return ['qiyam', 'duha'].indexOf(r.kind) !== -1 ? 'يومياً' : 'كل جمعة';
  if (r.kind === 'kahf') return r.mode === 'eve' ? k.eveLabel : k.dayLabel;
  return r.mode === 'eve' ? 'في الليلة السابقة' : 'صباح اليوم نفسه';
}

/**
 * مواعيد تذكير واحد خلال الأيام القادمة.
 * @param {object} r التذكير
 * @param {Date} now
 * @param {number} days عدد الأيام القادمة
 * @param {number} hijriAdjust تعديل التاريخ الهجري
 * @returns {Array<{at: Date, title: string, body: string}>}
 */
export function occurrences(r, now, days = 21, hijriAdjust = 0) {
  if (!r || !r.on) return [];
  const out = [];
  const eve = r.mode === 'eve';
  const push = (target, title, body) => {
    const at = atTime(eve ? new Date(target.getTime() - DAY) : target, r.time);
    if (at > now) out.push({ at, title, body });
  };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // نبدأ من الغد عند التذكير في الليلة السابقة ليشمل صيام الغد
  for (let i = 0; i <= days; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const g = ymd(day);
    const when = eve ? 'غداً' : 'اليوم';
    switch (r.kind) {
      case 'monthu':
        if (g.wd === 1 || g.wd === 4) push(day, `${when} ${DAY_NAMES[g.wd]}: صيام مستحب`, KINDS.monthu.desc);
        break;
      case 'white': {
        const h = toHijri(g, hijriAdjust);
        if (h.d >= 13 && h.d <= 15) push(day, `${when} من الأيام البيض (${h.d} ${HIJRI_MONTHS[h.m - 1]})`, 'صيام ثلاثة أيام من كل شهر صيام الدهر كله. رواه البخاري ومسلم.');
        break;
      }
      case 'occasions': {
        const h = toHijri(g, hijriAdjust);
        const o = OCCASION_DAYS.find(([m, d]) => m === h.m && d === h.d);
        if (o) push(day, `${when}: ${o[2]}`, `${o[3]} (بتقويم أم القرى، فتحقّق من إعلان بلدك)`);
        break;
      }
      case 'kahf':
        if (g.wd === 5) push(day, eve ? 'ليلة الجمعة: سورة الكهف' : 'جمعة مباركة: سورة الكهف', '«من قرأ سورة الكهف في يوم الجمعة أضاء له من النور ما بين الجمعتين» رواه الحاكم وصحّحه الألباني.');
        break;
      case 'salawat':
        if (g.wd === 5) push(day, 'الصلاة على النبي ﷺ', KINDS.salawat.desc);
        break;
      case 'qiyam':
        push(day, 'قيام الليل', '«ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر يقول: من يدعوني فأستجيب له» رواه البخاري ومسلم.');
        break;
      case 'duha':
        push(day, 'صلاة الضحى', 'ركعتان من الضحى تجزئ عن صدقات مفاصلك كلها.');
        break;
      case 'custom': {
        const title = r.title || 'تذكير';
        if (r.repeat === 'once') {
          if (r.date && r.date === `${g.y}-${String(g.m).padStart(2, '0')}-${String(g.d).padStart(2, '0')}`) push(day, title, r.body || '');
        } else if (r.repeat === 'weekly') {
          if ((r.days || []).indexOf(g.wd) !== -1) push(day, title, r.body || '');
        } else push(day, title, r.body || '');
        break;
      }
      default:
    }
  }
  return out;
}
