import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

const out = 'www/build';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/fonts`, { recursive: true });

// الخطوط مدمجة داخل التطبيق ليعمل بلا إنترنت: الحروف العربية واللاتينية فقط لتصغير الحجم
const fonts = [
  ['amiri', 'amiri-arabic-400-normal'], ['amiri', 'amiri-arabic-700-normal'], ['amiri', 'amiri-latin-400-normal'],
  ['amiri-quran', 'amiri-quran-arabic-400-normal'],
  ...[300, 400, 500, 600, 700].flatMap((w) => [
    ['ibm-plex-sans-arabic', `ibm-plex-sans-arabic-arabic-${w}-normal`],
    ['ibm-plex-sans-arabic', `ibm-plex-sans-arabic-latin-${w}-normal`],
  ]),
];
for (const [pkg, file] of fonts) cpSync(`node_modules/@fontsource/${pkg}/files/${file}.woff2`, `${out}/fonts/${file}.woff2`);

// خطوط اختيارية يختارها المستخدم من الإعدادات: وزنان (٤٠٠ و٧٠٠) للحروف العربية واللاتينية
const { UI_FONTS, TEXT_FONTS, fontFamilyName } = await import('../src/fonts.js');
const AR_RANGE = 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC';
const LAT_RANGE = 'U+0000-00FF, U+2000-206F, U+20AC, U+2212';
let extra = '';
for (const f of [...Object.values(UI_FONTS), ...Object.values(TEXT_FONTS)].filter((x) => x.pkg)) {
  for (const w of [400, 700]) {
    for (const [sub, range] of [['arabic', AR_RANGE], ['latin', LAT_RANGE]]) {
      const file = `${f.pkg}-${sub}-${w}-normal`;
      cpSync(`node_modules/@fontsource/${f.pkg}/files/${file}.woff2`, `${out}/fonts/${file}.woff2`);
      extra += `@font-face{font-family:'${fontFamilyName(f)}';font-weight:${w};font-display:swap;src:url(fonts/${file}.woff2) format('woff2');unicode-range:${range}}\n`;
    }
  }
}
writeFileSync(`${out}/fonts.css`, extra);

// نص القرآن من Tanzil كما هو دون أي تعديل، في ملف منفصل لا يُحمَّل إلا عند فتح تبويب القرآن
function tanzil(file) {
  const raw = readFileSync(`data/tanzil/${file}`, 'utf8');
  const verses = [];
  const notice = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('#')) { notice.push(line.replace(/^#\s?/, '')); continue; }
    const parts = line.split('|');
    if (parts.length === 3) verses.push(parts[2].replace(/\r$/, ''));
  }
  if (verses.length !== 6236) throw new Error(`${file}: ${verses.length} آية بدل ٦٢٣٦`);
  return { notice: notice.join('\n').trim(), v: verses };
}
writeFileSync(`${out}/quran.json`, JSON.stringify(tanzil('quran-uthmani.txt')));
writeFileSync(`${out}/quran-search.json`, JSON.stringify(tanzil('quran-simple-clean.txt')));

await build({
  entryPoints: ['src/main.js', 'src/styles.css'],
  bundle: true,
  minify: true,
  format: 'iife',
  // يعمل على WebView أندرويد 8 (Chrome 61+) بتحويل الصياغات الحديثة
  target: ['chrome61'],
  outdir: out,
  external: ['fonts/*'],
  logLevel: 'info',
});
