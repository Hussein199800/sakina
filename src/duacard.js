// رسم بطاقة «ادعُ لأخيك»: الاسم والدعاء محور التصميم، بهوامش آمنة، ودون تصغير النص تحت حد القراءة.
// إن لم يتسع النص أُعيد overflow=true لينبّه المصمم المستخدم، ولا يُقص الاسم أبداً.
import { num } from './text.js';
import { REMEMBER } from './data/loved-duas.js';
import { state } from './store.js';
import { TEXT_FONTS, fontFamilyName } from './fonts.js';

const textFamily = () => `'${fontFamilyName(TEXT_FONTS[state.settings.textFont] || TEXT_FONTS.amiri)}'`;

export const DUA_SIZES = {
  story: { label: 'حالة ٩:١٦', w: 1080, h: 1920 },
  square: { label: 'منشور ١:١', w: 1080, h: 1080 },
  wide: { label: 'أفقية ١٦:٩', w: 1920, h: 1080 },
};

// القوالب: [بداية التدرج، نهايته، لون النص، لون الزخرفة]
export const DUA_TEMPLATES = {
  sakina: { label: 'سكينة', c: ['#1F5E43', '#123A29', '#FFFFFF', '#D4A373'] },
  paper: { label: 'ورقي', c: ['#FBF8F1', '#EFE7D6', '#22352C', '#1F5E43'] },
  night: { label: 'ليلي', c: ['#16243A', '#070E1C', '#F3EEDF', '#E6C280'] },
  sand: { label: 'رملي', c: ['#F3E3CC', '#E2C49F', '#3A2A1C', '#8A5A36'] },
  calm: { label: 'هادئ', c: ['#EEF2EE', '#DCE6DF', '#1D2B24', '#2E7D5B'] },
};

export const DEFAULT_SPEC = {
  type: 'person', // person: دعاء لشخص | text: ذكر أو عبارة دعائية
  name: '',
  form: 'm',
  hideName: false,
  alias: 'لشخص عزيز',
  occ: 'general',
  duaId: '',
  text: '',
  kind: 'mathur', // mathur: مأثور بنصه | edited: معدّل من مأثور | own: من كتابة المستخدم
  source: '',
  adapted: false,
  template: 'sakina',
  size: 'story',
  scale: 1,
  headline: false,
  signature: '',
  brand: true,
  bgImage: '',
};

/** سطر العنوان فوق الدعاء */
export function cardHeading(spec) {
  if (spec.type !== 'person') return spec.name.trim() ? spec.name.trim() : '';
  const who = spec.hideName || !spec.name.trim() ? (spec.alias.trim() || 'لشخص عزيز') : `ل${spec.name.trim()}`;
  return `دعوة طيبة ${who}`;
}

/** ما يُكتب تحت الدعاء: المصدر للمأثور فقط، و«بتصرف» للمعدّل، ولا شيء لنص المستخدم */
export function sourceLine(spec) {
  if (spec.kind === 'mathur' && spec.source) return spec.adapted ? `${spec.source} (بتصريف الضمير)` : spec.source;
  if (spec.kind === 'edited') return 'دعاء بتصرّف';
  return '';
}

/** نص المشاركة: هو نفسه ما في البطاقة، دون أي بيانات إضافية */
export function cardPlainText(spec) {
  const parts = [];
  const h = cardHeading(spec);
  if (h) parts.push(h);
  parts.push(spec.text.trim());
  const src = sourceLine(spec);
  if (src) parts.push(src);
  if (spec.type === 'person' && spec.headline) parts.push(REMEMBER[spec.form] || REMEMBER.m);
  if (spec.signature.trim()) parts.push(`— ${spec.signature.trim()}`);
  return parts.join('\n\n');
}

function wrap(c, text, maxW) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ').filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
  }
  return lines;
}

const loadImage = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });

/**
 * يرسم البطاقة ويعيد {url, overflow, nameLines}.
 * الحد الأدنى للخط: ٣٦ بكسل للدعاء و٤٤ للاسم على عرض ١٠٨٠ (يتناسب مع المقاس).
 */
export async function renderDuaCard(spec, { measureOnly = false } = {}) {
  const s = { ...DEFAULT_SPEC, ...spec };
  const size = DUA_SIZES[s.size] || DUA_SIZES.story;
  const W = size.w;
  const H = size.h;
  const k = Math.min(W, H) / 1080; // أساس التناسب
  const big = s.size === 'story' ? 1.18 : 1; // الحالة الطويلة تتسع لخط أكبر
  const [c1, c2, ink0, accent0] = (DUA_TEMPLATES[s.template] || DUA_TEMPLATES.sakina).c;
  let ink = ink0;
  let accent = accent0;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  try { await Promise.all([document.fonts.load(`700 48px ${textFamily()}`), document.fonts.load('600 30px "IBM Plex Sans Arabic"')]); } catch (e) { /* خط النظام */ }

  if (s.bgImage) {
    try {
      const img = await loadImage(s.bgImage);
      const r = Math.max(W / img.width, H / img.height);
      c.drawImage(img, (W - img.width * r) / 2, (H - img.height * r) / 2, img.width * r, img.height * r);
      c.fillStyle = 'rgba(8,16,12,0.55)'; // طبقة داكنة لتباين مريح
      c.fillRect(0, 0, W, H);
      ink = '#FFFFFF';
      accent = '#F1D4A8';
    } catch (e) { s.bgImage = ''; }
  }
  if (!s.bgImage) {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // زخرفة خفيفة جداً في الزاوية
    c.globalAlpha = 0.08;
    c.strokeStyle = accent;
    c.lineWidth = 2 * k;
    for (let r = 140 * k; r < Math.max(W, H) * 0.55; r += 64 * k) { c.beginPath(); c.arc(W, 0, r, 0, Math.PI * 2); c.stroke(); }
    c.globalAlpha = 1;
  }

  c.direction = 'rtl';
  c.textAlign = 'center';
  const safe = Math.round(90 * k); // هامش آمن
  // سطر مريح للقراءة: لا يتجاوز ١٤٠٠ بكسل حتى في البطاقة الأفقية
  const maxW = Math.min(W - safe * 2, 1400 * k);
  let y = safe + 30 * k;

  // العنوان: «دعوة طيبة لـ…» — يلتف على أسطر ولا يُقص
  const heading = cardHeading(s);
  let nameLines = [];
  if (heading) {
    c.font = `500 ${Math.round(34 * k)}px "IBM Plex Sans Arabic", sans-serif`;
    c.fillStyle = accent;
    if (s.type === 'person') { c.fillText('دعوة طيبة', W / 2, y + 34 * k); y += 70 * k; }
    const nameText = s.type === 'person' ? heading.replace(/^دعوة طيبة /, '') : heading;
    let ns = Math.round(70 * k * big * s.scale);
    const minName = Math.round(44 * k);
    for (; ns >= minName; ns -= 2) {
      c.font = `700 ${ns}px "IBM Plex Sans Arabic", sans-serif`;
      nameLines = wrap(c, nameText, maxW);
      if (nameLines.length <= 2) break;
    }
    ns = Math.max(ns, minName);
    c.font = `700 ${ns}px "IBM Plex Sans Arabic", sans-serif`;
    nameLines = wrap(c, nameText, maxW);
    c.fillStyle = ink;
    for (const l of nameLines) { y += ns * 1.35; if (!measureOnly) c.fillText(l, W / 2, y); }
    y += 30 * k;
    // فاصل
    c.strokeStyle = accent;
    c.globalAlpha = 0.6;
    c.lineWidth = 3 * k;
    c.beginPath(); c.moveTo(W / 2 - 60 * k, y); c.lineTo(W / 2 + 60 * k, y); c.stroke();
    c.globalAlpha = 1;
    y += 40 * k;
  }

  // التذييل يُحسب أولاً لنعرف المساحة المتبقية للدعاء
  const foot = [];
  const src = sourceLine(s);
  if (src) foot.push({ t: num(src), f: `400 ${Math.round(28 * k)}px "IBM Plex Sans Arabic", sans-serif`, color: ink, a: 0.8 });
  if (s.type === 'person' && s.headline) foot.push({ t: REMEMBER[s.form] || REMEMBER.m, f: `600 ${Math.round(32 * k)}px "IBM Plex Sans Arabic", sans-serif`, color: accent, a: 1 });
  if (s.signature.trim()) foot.push({ t: `— ${s.signature.trim()}`, f: `500 ${Math.round(30 * k)}px "IBM Plex Sans Arabic", sans-serif`, color: ink, a: 0.9 });
  if (s.brand) foot.push({ t: 'سكينة', f: `600 ${Math.round(26 * k)}px "IBM Plex Sans Arabic", sans-serif`, color: accent, a: 0.85 });
  const footH = foot.length * 48 * k + (foot.length ? 20 * k : 0);
  const bodyTop = y;
  const bodyBottom = H - safe - footH;

  // الدعاء: أكبر خط يتسع، دون النزول تحت ٣٦
  const minBody = Math.round(36 * k);
  let bs = Math.round(66 * k * big * s.scale);
  let lines = [];
  let overflow = false;
  for (; bs >= minBody; bs -= 2) {
    c.font = `700 ${bs}px ${textFamily()}, Amiri, serif`;
    lines = wrap(c, s.text.trim() || ' ', maxW);
    if (lines.length * bs * 1.8 <= bodyBottom - bodyTop) break;
  }
  if (bs < minBody) {
    bs = minBody;
    c.font = `700 ${bs}px ${textFamily()}, Amiri, serif`;
    lines = wrap(c, s.text.trim() || ' ', maxW);
    overflow = true;
  }
  const lh = bs * 1.8;
  let by = bodyTop + Math.max(0, (bodyBottom - bodyTop - lines.length * lh) / 2) + bs;
  c.fillStyle = ink;
  for (const l of lines) { if (by > bodyBottom + bs) { overflow = true; break; } c.fillText(l, W / 2, by); by += lh; }
  if (heading && nameLines.length > 3) overflow = true;

  let fy = H - safe - footH + 44 * k;
  for (const f of foot) {
    c.font = f.f;
    c.fillStyle = f.color;
    c.globalAlpha = f.a;
    for (const l of wrap(c, f.t, maxW).slice(0, 2)) { c.fillText(l, W / 2, fy); }
    c.globalAlpha = 1;
    fy += 48 * k;
  }
  return { url: measureOnly ? '' : cv.toDataURL('image/png'), overflow, w: W, h: H };
}
