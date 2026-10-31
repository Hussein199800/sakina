// الختمة الجماعية: توزيع الأجزاء الثلاثين على المشاركين بالتساوي وبترتيب متصل
export const MAX_MEMBERS = 30;

/**
 * @param {number} count عدد المشاركين (١..٣٠)
 * @returns {Array<{from: number, to: number}>} نطاق الأجزاء لكل مشارك
 */
export function distribute(count) {
  const n = Math.max(1, Math.min(MAX_MEMBERS, Math.floor(count)));
  const base = Math.floor(30 / n);
  const extra = 30 % n;
  const out = [];
  let juz = 1;
  for (let i = 0; i < n; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push({ from: juz, to: juz + size - 1 });
    juz += size;
  }
  return out;
}
