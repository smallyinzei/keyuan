import { describe, expect, it } from 'vitest';
import { completionFactor } from '../src/lib/calc';
import { defaultConfig, normalizeConfig } from '../src/lib/config';
import { leadingConstant, parseRefs } from '../src/lib/sheet';
import { isMonthTitle, modelKey, monthFromContractNo, normCustomer, parseCnInt, parseMonth, sameCustomer, toNumber } from '../src/lib/text';
import { boundaryProblems, parseRangeText, parseTierRow, tableFor, tierOf } from '../src/lib/tiers';
import { TIERS } from '../src/lib/types';

describe('text', () => {
  it('parses Chinese and Arabic months', () => {
    expect(parseCnInt('七')).toBe(7);
    expect(parseCnInt('十二')).toBe(12);
    expect(parseCnInt('二十一')).toBe(21);
    expect(parseMonth('生物七月')).toBe(7);
    expect(parseMonth('九月')).toBe(9);
    expect(parseMonth('9月按实际产量边际贡献修正（实际产量10000）')).toBe(9);
    expect(parseMonth('三季度')).toBeNull();
    expect(parseMonth('提成计算2月2')).toBe(2);
  });

  it('recognises month titles but not total rows', () => {
    expect(isMonthTitle('高科八月')).toBe(true);
    expect(isMonthTitle('2026年7月')).toBe(true);
    expect(isMonthTitle('生物七月溢价提成合计')).toBe(false);
    expect(isMonthTitle('7月按实际产量边际贡献修正')).toBe(false);
  });

  it('normalises customers and detects spelling variants', () => {
    expect(normCustomer('ORION  POLYMERS PVT LTD')).toBe('ORION POLYMERS PRIVATE LIMITED');
    expect(normCustomer('ORION POLYMERS PRIVATE LIMITD')).toBe('ORION POLYMERS PRIVATE LIMITED');
    expect(normCustomer('NOVA ELECTRONICS PVT.LTD')).toBe('NOVA ELECTRONICS PRIVATE LIMITED');
    expect(sameCustomer(normCustomer('Zenith Industriez'), normCustomer('Zenith Industries'))).toBe(true);
    expect(sameCustomer(normCustomer('甲城某广'), normCustomer('乙城某广贸易有限公司'))).toBe(false);
    expect(sameCustomer(normCustomer('QT POLYMERS INDIA LLP'), normCustomer('PRIMO PLASTMART PRIVATE LIMITED'))).toBe(false);
  });

  it('parses numbers and contract-number months', () => {
    expect(toNumber('1,234.5')).toBe(1234.5);
    expect(toNumber('合同取消')).toBeNull();
    expect(monthFromContractNo('ABC-20260706-030')).toBe(7);
    expect(modelKey(' san  900 ')).toBe('SAN900');
  });
});

describe('formula references', () => {
  it('finds same-sheet and cross-sheet references', () => {
    const refs = parseRefs('=I4*C3+J4');
    expect(refs.map((r) => `${r.col}${r.row}`)).toEqual(['I4', 'C3', 'J4']);
    const x = parseRefs('=三季度生物明细!H19');
    expect(x[0]).toMatchObject({ sheet: '三季度生物明细', col: 'H', row: 19 });
    const q = parseRefs("='Sheet 1'!$AB$12+LOG10(A1)");
    expect(q.map((r) => `${r.sheet ?? ''}!${r.col}${r.row}`)).toEqual(['Sheet 1!AB12', '!A1']);
    expect(parseRefs('=SUM(G19:G23)')[0].end?.row).toBe(23);
    expect(parseRefs('=IF(ISNUMBER(E3),E3*C3,"C9 待补")').map((r) => `${r.col}${r.row}`)).toEqual(['E3', 'E3', 'C3']);
  });

  it('extracts the leading constant of a cost formula', () => {
    expect(leadingConstant('=12345.678-(1000.5/8000*10000)')).toBeCloseTo(12345.678, 9);
    expect(leadingConstant('=D3/1.13')).toBeNull();
  });
});

describe('tiers', () => {
  const t = (raws: unknown[], label = '制度原版边际贡献') =>
    parseTierRow({ company: '甲', label, sheet: 's', row: 1, cells: TIERS.map((tier, i) => ({ tier, raw: raws[i] ?? null, addr: `C${i}` })), extras: [] });

  it('parses range texts including full-width signs and bare numbers', () => {
    expect(parseRangeText('＜100', 'C1', true, false, 'C1')).toMatchObject({ lo: null, hi: 100, hiInclusive: false });
    expect(parseRangeText('101-200', 'C2', false, false, 'D1')).toMatchObject({ lo: 101, hi: 200 });
    expect(parseRangeText('＞600', 'A2', false, true, 'I1')).toMatchObject({ lo: 600, hi: null });
    expect(parseRangeText(220, 'C1', true, false, 'C1')).toMatchObject({ hi: 220 });
    expect(parseRangeText(220, 'C1', true, false, 'C1')?.formatNote).toBeTruthy();
  });

  it('looks up tiers and flags boundary overlaps and gaps', () => {
    const base = t(['＜100', '100-200', '200-300', '300-400', '400-500', '500-600', '＞600']);
    expect(tierOf(250, base).tier).toBe('B1');
    expect(tierOf(-50, base).tier).toBe('C1');
    const edge = tierOf(200, base);
    expect(edge.tier).toBe('B1');
    expect(edge.ambiguous).toBe(true);
    const probs = boundaryProblems(base);
    expect(probs.filter((p) => p.kind === 'overlap').map((p) => p.zone?.[0])).toEqual([200, 300, 400, 500]);
    const gappy = t(['＜100', '101-200', '201-300', '301-400', '401-500', '501-600', '＞600']);
    expect(boundaryProblems(gappy).filter((p) => p.kind === 'gap')).toHaveLength(5);
    expect(tierOf(100.5, gappy)).toMatchObject({ tier: 'C1', ambiguous: true });
  });

  it('chooses the monthly table, honours “未修正” and exceptions', () => {
    const base = t(['＜100', '100-200', '200-300', '300-400', '400-500', '500-600', '＞600']);
    const jul = t(['未修正'], '7月按实际产量边际贡献修正');
    const sep = parseTierRow({
      company: '甲',
      label: '9月按实际产量边际贡献修正',
      sheet: 's',
      row: 2,
      cells: TIERS.map((tier, i) => ({ tier, raw: ['＜150', '150-300', '300-450', '451-600', '601-750', '751-900', '＞900'][i], addr: '' })),
      extras: ['2010除外'],
    });
    const all = [base, jul, sep];
    expect(jul.unmodified).toBe(true);
    expect(tableFor(all, '甲', 7).table).toBe(base);
    expect(tableFor(all, '甲', 9, 'Y200').table).toBe(sep);
    expect(tableFor(all, '甲', 9, 'Z CT2010').table).toBe(base);
  });
});

describe('config', () => {
  it('validates imported JSON and keeps missing-price handling fixed', () => {
    const { config, notes } = normalizeConfig({ qtyBasis: 'contract', priceBasis: 'bogus', missingUnitPrice: 'zero', completion: { mode: 'amount', full: 0.9, floor: 0.6 }, personMerge: [{ from: 'A', to: 'B' }, { from: 1 }], supplements: { unitPrice: { 'x|9|Y': 2, bad: 'x' } } });
    expect(config.qtyBasis).toBe('contract');
    expect(config.priceBasis).toBe('contract');
    expect(config.missingUnitPrice).toBe('pending');
    expect(config.completion).toMatchObject({ mode: 'amount', full: 0.9, floor: 0.6 });
    expect(config.personMerge).toEqual([{ from: 'A', to: 'B' }]);
    expect(config.supplements.unitPrice).toEqual({ 'x|9|Y': 2 });
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(normalizeConfig(null).config).toEqual(defaultConfig());
  });

  it('computes the completion factor', () => {
    expect(completionFactor(0.85, 0.8, 0.5)).toBe(1);
    expect(completionFactor(0.7, 0.8, 0.5)).toBe(0.7);
    expect(completionFactor(0.5, 0.8, 0.5)).toBe(0.5);
    expect(completionFactor(0.49, 0.8, 0.5)).toBe(0);
  });
});
