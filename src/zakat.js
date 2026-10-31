// حساب زكاة المال: النقود والذهب والفضة وعروض التجارة
// النصاب: ٨٥ غراماً من الذهب الخالص (عشرون مثقالاً) أو ٥٩٥ غراماً من الفضة الخالصة (مئتا درهم)، والمقدار ربع العشر (٢٫٥٪)

export const NISAB_GOLD_G = 85;
export const NISAB_SILVER_G = 595;
export const RATE = 0.025;
export const KARATS = [24, 22, 21, 18];

const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * @param {object} i
 * @param {number} i.goldPrice سعر غرام الذهب عيار ٢٤
 * @param {number} i.silverPrice سعر غرام الفضة الخالصة
 * @param {'gold'|'silver'} i.basis النصاب المعتمد
 * @param {number} i.cash النقود والأرصدة
 * @param {Record<number, number>} i.gold غرامات الذهب حسب العيار
 * @param {number} i.silver غرامات الفضة الخالصة
 * @param {number} i.trade قيمة عروض التجارة
 * @param {number} i.receivables ديون مرجوّة السداد لك
 * @param {number} i.debts ديون حالّة عليك
 */
export function computeZakat(i) {
  const goldPure = KARATS.reduce((sum, k) => sum + n(i.gold && i.gold[k]) * (k / 24), 0);
  const goldValue = goldPure * n(i.goldPrice);
  const silverValue = n(i.silver) * n(i.silverPrice);
  const assets = n(i.cash) + goldValue + silverValue + n(i.trade) + n(i.receivables);
  const net = Math.max(0, assets - n(i.debts));
  const basis = i.basis === 'silver' ? 'silver' : 'gold';
  const price = basis === 'gold' ? n(i.goldPrice) : n(i.silverPrice);
  const nisab = price ? (basis === 'gold' ? NISAB_GOLD_G : NISAB_SILVER_G) * price : 0;
  const reached = nisab > 0 && net >= nisab;
  // التقريب إلى أقرب جزء من مئة لتجنّب أخطاء الكسور العشرية في العرض
  const round = (v) => Math.round(v * 100) / 100;
  return {
    goldPure: round(goldPure),
    goldValue: round(goldValue),
    silverValue: round(silverValue),
    assets: round(assets),
    net: round(net),
    nisab: round(nisab),
    missingPrice: !price,
    reached,
    due: reached ? round(net * RATE) : 0,
  };
}
