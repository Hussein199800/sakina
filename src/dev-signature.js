// توقيع المطوّر: مكوّن مستقل قابل للنقل إلى أي تطبيق (ملف واحد، بلا اعتماديات، ويحقن تنسيقاته بنفسه).
// الاستخدام:  import { devSignature } from './dev-signature.js';   el.innerHTML = devSignature();
// يأخذ ألوانه من متغيرات التطبيق المضيف إن وُجدت (--primary, --secondary, --text, --muted, --card, --bg, --line)
// فيحافظ على شخصية كل تطبيق، ويعمل في الوضعين الفاتح والداكن. يمكن تخصيصه بالمتغيرات:
//   --sig-name-font (خط الاسم)، --sig-text-font (خط الدعاء)، --sig-accent (لون الزخرفة)

export const DEVELOPER = {
  role: 'تطوير وتصميم',
  name: 'حسين محمد علي الطويل',
  dua: 'اللهم بارك في علمه وعمله، ووفّقه لما تحب وترضى، واغفر له ولوالديه، واجعل كل نفعٍ قدّمه للناس في ميزان حسناته، واجعل هذا العمل أثراً طيباً يبقى، وأجراً لا ينقطع.',
  quote: '«لا تنسَ المطوّر ووالديه من دعوة صادقة بظهر الغيب».',
  contactTitle: 'تواصل مع المطوّر',
  links: [
    { id: 'telegram', label: 'Telegram', href: 'https://t.me/HUSSEIN_TAWEEL', color: '#2AABEE' },
    { id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/963958700900', color: '#25D366' },
    { id: 'gmail', label: 'Gmail', href: 'mailto:husseintaweel2022@gmail.com', color: '#EA4335' },
  ],
};

const ICONS = {
  telegram: '<path d="M21.5 3.5 2.8 10.7c-.7.3-.7 1.2 0 1.5l4.6 1.7 1.8 5.6c.2.6.9.8 1.4.4l2.7-2.3 4.6 3.4c.5.4 1.3.1 1.4-.5L22.6 4.6c.2-.8-.5-1.4-1.1-1.1Z"/><path d="m7.4 13.9 10.3-6.6-7.4 7.9"/>',
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z"/><path d="M8.6 8.2c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6c-.1.2-.1.4 0 .5.5.9 1.300 1.700 2.300 2.200.2.1.4.1.5-.1l.6-.7c.2-.2.4-.2.6-.1l1.600.8c.2.1.4.3.3.5 0 .9-.800 1.700-1.700 1.700-3.400 0-6.800-3.300-6.800-6.700 0-.3.1-.6.200-.8Z"/>',
  gmail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.500 6 8.500-6"/>',
};

const CSS = `
.sig{position:relative;margin:6px 0 22px;padding:34px 20px 24px;text-align:center;overflow:hidden;border-radius:32px;
  color:var(--text,#18241E);border:1px solid var(--line,rgba(0,0,0,.08));
  background:radial-gradient(120% 90% at 50% -10%,var(--primary-soft,rgba(31,94,67,.09)),transparent 62%),var(--card,#fff)}
.sig *{box-sizing:border-box}
.sig::before,.sig::after{content:"";position:absolute;width:210px;height:210px;border-radius:50%;pointer-events:none;
  border:1px solid var(--sig-accent,var(--secondary,#D4A373));opacity:.22}
.sig::before{top:-120px;inset-inline-start:-90px}
.sig::after{bottom:-140px;inset-inline-end:-100px;width:260px;height:260px;opacity:.14}
.sig-seal{position:relative;width:62px;height:62px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;border-radius:50%;
  font:700 30px/1 var(--sig-name-font,'Aref Ruqaa','Amiri',serif);color:var(--primary,#1F5E43);
  background:var(--card,#fff);box-shadow:0 0 0 1px var(--sig-accent,var(--secondary,#D4A373)),0 0 0 6px var(--primary-soft,rgba(31,94,67,.09))}
.sig-seal::after{content:"";position:absolute;inset:-11px;border-radius:50%;border:1px dashed var(--sig-accent,var(--secondary,#D4A373));opacity:.55;animation:sig-spin 40s linear infinite}
.sig-role{display:flex;align-items:center;justify-content:center;gap:12px;font-size:12.5px;letter-spacing:.5px;color:var(--muted,rgba(0,0,0,.55))}
.sig-role::before,.sig-role::after{content:"";width:34px;height:1px;background:linear-gradient(90deg,transparent,var(--sig-accent,var(--secondary,#D4A373)))}
.sig-role::before{transform:scaleX(-1)}
.sig-name{margin:6px 0 0;font:700 34px/1.5 var(--sig-name-font,'Aref Ruqaa','Amiri',serif);color:var(--primary,#1F5E43);overflow-wrap:anywhere}
.sig-flourish{display:block;width:min(240px,74%);height:22px;margin:-4px auto 12px;color:var(--sig-accent,var(--secondary,#D4A373))}
.sig-flourish path{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-dasharray:420;stroke-dashoffset:420;animation:sig-draw 1.6s .2s ease-out forwards}
.sig-dua{margin:0 auto;max-width:520px;font:400 18.5px/2.05 var(--sig-text-font,'Amiri','Scheherazade New',serif);color:var(--text,#18241E)}
.sig-quote{margin:12px auto 0;max-width:460px;font-size:13px;line-height:1.8;color:var(--muted,rgba(0,0,0,.55))}
.sig-sep{display:flex;align-items:center;justify-content:center;gap:10px;margin:20px 0 14px;font-size:13.5px;font-weight:600;color:var(--primary,#1F5E43)}
.sig-sep::before,.sig-sep::after{content:"";flex:1;max-width:70px;height:1px;background:var(--line,rgba(0,0,0,.1))}
.sig-links{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}
.sig-link{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:84px;padding:4px 6px;text-decoration:none;color:var(--text,#18241E);font-size:12.5px;font-weight:500;-webkit-tap-highlight-color:transparent}
.sig-ic{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--c);
  background:var(--card,#fff);border:1.5px solid var(--c);box-shadow:0 6px 16px -8px var(--c);transition:transform .18s ease,background .18s ease,color .18s ease}
.sig-ic svg{width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.sig-link:active .sig-ic,.sig-link:focus-visible .sig-ic{transform:scale(.92);background:var(--c);color:#fff}
.sig-link:focus-visible{outline:none}
@media (hover:hover){.sig-link:hover .sig-ic{transform:translateY(-3px);background:var(--c);color:#fff}}
@keyframes sig-draw{to{stroke-dashoffset:0}}
@keyframes sig-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sig-flourish path{animation:none;stroke-dashoffset:0}.sig-seal::after{animation:none}}
`;

function injectCss() {
  if (typeof document === 'undefined' || document.getElementById('dev-signature-css')) return;
  const st = document.createElement('style');
  st.id = 'dev-signature-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** يعيد HTML التوقيع. داخل تطبيق أصلي تُفتح الروابط في تطبيقاتها مباشرة، وفي المتصفح في تبويب جديد */
export function devSignature(dev = DEVELOPER) {
  injectCss();
  const native = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform();
  const target = native ? '' : ' target="_blank" rel="noopener noreferrer"';
  return `<section class="sig" dir="rtl" aria-label="${escHtml(dev.role)}: ${escHtml(dev.name)}">
    <div class="sig-seal" aria-hidden="true">${escHtml(dev.name.trim().charAt(0))}</div>
    <div class="sig-role">${escHtml(dev.role)}</div>
    <h2 class="sig-name">${escHtml(dev.name)}</h2>
    <svg class="sig-flourish" viewBox="0 0 240 22" aria-hidden="true"><path d="M4 14c38-12 70-12 104-3 22 6 38 7 54 1 12-5 22-9 34-7 16 3 26 8 40 2"/></svg>
    <p class="sig-dua">${escHtml(dev.dua)}</p>
    <p class="sig-quote">${escHtml(dev.quote)}</p>
    <div class="sig-sep">${escHtml(dev.contactTitle)}</div>
    <nav class="sig-links" aria-label="${escHtml(dev.contactTitle)}">${dev.links.map((l) => `
      <a class="sig-link" href="${escHtml(l.href)}"${l.href.indexOf('mailto:') === 0 ? '' : target} style="--c:${escHtml(l.color)}" data-sig="${escHtml(l.id)}">
        <span class="sig-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[l.id] || ''}</svg></span><span dir="ltr">${escHtml(l.label)}</span>
      </a>`).join('')}</nav>
  </section>`;
}
