// شاشة الترحيب عند أول تشغيل: تحديد الموقع لمواقيت صحيحة واختيار الثيم
import { state, save } from '../store.js';
import { icon } from '../icons.js';
import { openSheet } from '../ui.js';
import { THEMES } from '../ui.js';
import { location } from '../services.js';
import { cityPicker } from './settings.js';

export function welcome(onDone) {
  const done = () => { state.app.welcomed = true; save(); if (onDone) onDone(); };
  openSheet(`<div class="welcome">
    <div class="about-logo big">${icon('sparkle')}</div>
    <h2>أهلاً بك في سكينة</h2>
    <p class="muted">رفيقك الروحي اليومي: أذكار، وقرآن، ومواقيت صلاة، ومسبحة. كل شيء يعمل على هاتفك بدون إنترنت.</p>
    <div class="welcome-step">
      <span class="set-ic">${icon('pin')}</span>
      <div class="set-txt"><b>موقعك لحساب مواقيت الصلاة</b><small data-w-loc>${location().name}</small></div>
      <button class="btn btn-soft" data-w-city>تحديد</button>
    </div>
    <div class="welcome-themes">${Object.entries(THEMES).map(([k, t]) => `<button class="wt ${state.settings.theme === k ? 'on' : ''}" data-w-theme="${k}" style="background:${t.bg};border-color:${t.primary}" aria-label="${t.name}"><i style="background:${t.primary}"></i><i style="background:${t.secondary}"></i></button>`).join('')}</div>
    <button class="btn btn-primary wide" data-close>${icon('check')} ابدأ</button>
  </div>`, {
    onClose: done,
    onMount: (body) => {
      body.querySelector('[data-w-city]').addEventListener('click', () => cityPicker(() => {
        const el = document.querySelector('[data-w-loc]');
        if (el) el.textContent = location().name;
      }));
      body.querySelectorAll('[data-w-theme]').forEach((b) => b.addEventListener('click', () => {
        state.settings.theme = b.dataset.wTheme;
        save();
        body.querySelectorAll('[data-w-theme]').forEach((x) => x.classList.toggle('on', x === b));
        document.dispatchEvent(new Event('app:theme'));
      }));
    },
  });
}
