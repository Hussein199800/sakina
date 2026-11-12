// صيدلية الروح: صفحة الحالة (آية تواسي، ودعاء مأثور بعدّاد، ورسالة، ورابط للأذكار المناسبة)
import { save, today } from '../store.js';
import { icon } from '../icons.js';
import { num } from '../text.js';
import { CATEGORY_BY_ID } from '../data/adhkar.js';
import { FEELINGS } from '../data/spirit.js';
import { fullHead, ring } from './common.js';
import { tapFeedback, dhikrText } from '../ui.js';
import { registerText, toolsRow } from './dhikr.js';

export const full = true;
export const tab = 'library';

export const NOT_MEDICAL = 'آيات وأدعية للسكينة والتذكير بالله، وليست علاجاً طبياً ولا بديلاً عن استشارة المختص.';

export function render(param) {
  const f = FEELINGS.find((x) => x.id === param);
  if (!f) return `${fullHead('صيدلية الروح')}<div class="empty">${icon('info')}<p>هذه الحالة غير موجودة</p><button class="btn btn-soft" data-act="go" data-to="#/library/feel">العودة إلى صيدلية الروح</button></div>`;
  registerText(`mood-ayah-${f.id}`, { text: f.ayah, source: f.ayahRef, title: f.label });
  registerText(`mood-dua-${f.id}`, { text: f.dua, source: f.duaRef, title: f.label });
  const cat = f.cat && CATEGORY_BY_ID[f.cat];
  return `${fullHead('صيدلية الروح', 'بماذا يشعر قلبك؟')}
    <div class="feel-page">
      <div class="mood-head tone-${f.tone}"><span class="mood-ic big">${icon(f.icon)}</span>
        <div><small>حين تشعر بـ</small><h3>${f.label}</h3></div></div>
      <div class="mood-block card">
        <span class="eyebrow">${icon('book')} آية تواسيك</span>
        <p class="quran">${dhikrText(f.ayah)}</p>
        <div class="tile-foot"><small>${num(f.ayahRef)}</small>${toolsRow(`data-key="mood-ayah-${f.id}"`)}</div>
      </div>
      <div class="mood-block card">
        <span class="eyebrow">${icon('hands')} دعاء مأثور</span>
        <p class="dhikr-sm">${dhikrText(f.dua)}</p>
        <div class="mood-counter">
          <button class="counter-btn" data-mood-tap aria-label="عدّ">${ring(0, 76, 6)}<b data-left>${num(f.count)}</b></button>
          <div><small>${num(f.duaRef)}</small><p class="muted" data-hint>${f.count > 1 ? `يُكرَّر ${num(f.count)} مرات، اضغط العداد مع كل تكرار` : 'اضغط العداد بعد قراءته'}</p></div>
        </div>
        ${toolsRow(`data-key="mood-dua-${f.id}"`)}
      </div>
      <div class="mood-message card">
        <span class="eyebrow">${icon('leaf')} رسالة سكينة وتدبّر</span>
        <p>${f.message}</p>
      </div>
      ${cat ? `<button class="btn btn-soft wide" data-act="go" data-to="#/read/${f.cat}">${icon(cat.icon)} أذكار ${cat.title}</button>` : ''}
      <p class="muted small center">${NOT_MEDICAL}</p>
    </div>`;
}

export function mount(root, param) {
  const f = FEELINGS.find((x) => x.id === param);
  const btn = root.querySelector('[data-mood-tap]');
  if (!f || !btn) return;
  let left = f.count;
  btn.addEventListener('click', () => {
    if (left <= 0) return;
    left -= 1;
    tapFeedback(left ? 'tap' : 'item');
    root.querySelector('[data-left]').textContent = left ? num(left) : '✓';
    btn.querySelector('.ring').outerHTML = ring((f.count - left) / f.count, 76, 6);
    if (!left) {
      btn.classList.add('done');
      root.querySelector('[data-hint]').textContent = 'تقبّل الله دعاءك وأنزل على قلبك السكينة';
      today().r += f.count;
      save();
    }
  });
}
