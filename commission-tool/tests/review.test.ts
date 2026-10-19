// 针对代码复核发现的问题的回归测试（合成数据）
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
import { buildPersonMap, cleanMerges, coefficients, computeLines, settingsFor, sumLines } from '../src/lib/calc';
import { CATEGORY } from '../src/lib/checks';
import { defaultConfig, normalizeConfig } from '../src/lib/config';
import { buildPersonalWorkbook, workbookBytes } from '../src/lib/export';
import { parseWorkbookData } from '../src/lib/parse';
import { parseTierRow, tierOf } from '../src/lib/tiers';
import { TIERS, type RuleConfig } from '../src/lib/types';
import { CALC, DETAIL, buildFixture } from './fixture';

type Patch = (wb: XLSX.WorkBook) => void;
const load = (patch?: Patch) => {
  const wb = buildFixture();
  patch?.(wb);
  return parseWorkbookData(new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 'r.xlsx');
};
const cfg = (p: Partial<RuleConfig> = {}): RuleConfig => ({ ...defaultConfig(), ...p });
const setCell = (ws: XLSX.WorkSheet, a: string, v: number | string | null, f?: string) => {
  if (v === null && !f) delete ws[a];
  else ws[a] = { t: typeof v === 'number' ? 'n' : 's', v: v ?? '', ...(f ? { f } : {}) };
};

describe('code review regressions', () => {
  it('a blank 含税单价 makes the average pending instead of 0', () => {
    const pw = load((wb) => {
      setCell(wb.Sheets[DETAIL], 'E4', null);
      setCell(wb.Sheets[DETAIL], 'G4', 0, 'E4-F4');
    });
    expect(pw.orders[1].priceMissing).toBe(true);
    expect(pw.warnings.some((w) => w.level === 'error' && w.message.includes('缺含税单价'))).toBe(true);
    const lines = computeLines(pw, settingsFor(cfg(), { qty: 'shipped', price: 'contract' }), 'dept');
    const x100 = lines.find((l) => l.month === 7 && l.model === 'X100')!;
    expect(x100.avg).toBeNull();
    expect(x100.premium).toBeNull();
    expect(x100.avgNote).toContain('缺含税单价');
    const an = analyze(pw, cfg());
    expect(an.issues.some((i) => i.category === CATEGORY.avg && i.model === 'X100' && i.month === 7)).toBe(false);
  });

  it('a wrong-row 出库均价 reference is not marked adopted and the tier check uses the right average', () => {
    const pw = load((wb) => {
      // D3 指向 X300 的汇总行（3000），档级改成 A2、单价 10
      const c = wb.Sheets[CALC];
      setCell(c, 'D3', 3000, `${DETAIL}!D13`);
      setCell(c, 'H3', 'A2');
    });
    const an = analyze(pw, cfg());
    const ref = an.issues.find((i) => i.category === CATEGORY.ref && i.location.endsWith('!D3'))!;
    expect(ref.adopted).toBe(false);
    const tier = an.issues.find((i) => i.category === CATEGORY.tier && i.model === 'X100' && i.month === 7)!;
    expect(tier.expected).toBe('C2');
    expect(tier.message).toContain('按明细重算均价');
  });

  it('flags duplicate models and treats conflicting unit prices as pending', () => {
    const pw = load((wb) => {
      const c = wb.Sheets[CALC];
      // 第 5 行改成重复的 X100，单价不同
      setCell(c, 'B5', 'X100');
      setCell(c, 'I5', 3);
    });
    expect(pw.duplicates).toEqual([expect.objectContaining({ kind: 'calc', model: 'X100', month: 7, rows: [3, 5], conflict: expect.arrayContaining(['提成单价']) })]);
    const an = analyze(pw, cfg());
    expect(an.issues.some((i) => i.category === CATEGORY.duplicate && i.severity === 'high')).toBe(true);
    const x100 = an.primary.dept.find((l) => l.month === 7 && l.model === 'X100')!;
    expect(x100.unitPrice).toBeNull();
    expect(x100.unitComm).toBeNull();
  });

  it('person merges never swap people', () => {
    const { list, dropped } = cleanMerges([
      { from: '王五', to: '李四' },
      { from: '李四', to: '王五' },
    ]);
    expect(list).toEqual([{ from: '李四', to: '王五' }]);
    expect(dropped).toHaveLength(1);
    const m = buildPersonMap([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ]);
    expect(new Set([m.get('A') ?? 'A', m.get('B') ?? 'B', m.get('C') ?? 'C']).size).toBe(1);
    expect(normalizeConfig({ personMerge: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }] }).notes.some((n) => n.includes('循环'))).toBe(true);
  });

  it('person summary export uses after-coefficient amounts in monthly rows', async () => {
    const pw = load();
    const an = analyze(pw, cfg({ completion: { mode: 'volume', full: 0.8, floor: 0.5, perCompany: { 甲司: { volumeRate: 0.7, amountRate: null } } } }));
    const wb = XLSX.read(await workbookBytes(buildPersonalWorkbook(an)), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['个人汇总'], { header: 1, defval: null });
    for (const r of rows.filter((x) => typeof x[2] === 'string' && /月$/.test(x[2] as string))) {
      expect((r[4] as number) + (r[5] as number)).toBeCloseTo(r[6] as number, 6);
    }
  });

  it('reconciles the stated 合计 with the sum of rows', () => {
    const pw = load((wb) => setCell(wb.Sheets[CALC], 'L8', 434, 'SUM(L3:L6)'));
    const an = analyze(pw, cfg());
    const t = an.issues.find((i) => i.category === CATEGORY.total)!;
    expect(t.impact).toBeCloseTo(100, 9);
    expect(t.location).toBe(`${CALC}!L8`);
  });

  it('range-checks completion rates', () => {
    const pw = load();
    const c = coefficients(pw, cfg({ completion: { mode: 'volume', full: 0.8, floor: 0.5, perCompany: { 甲司: { volumeRate: 60, amountRate: null } } } }));
    expect(c['甲司'].rate).toBeCloseTo(0.6, 9);
    expect(c['甲司'].unit).toBeCloseTo(0.6, 9);
    expect(c['甲司'].note).toContain('百分数');
    const n = normalizeConfig({ completion: { perCompany: { 甲司: { volumeRate: 71.26, amountRate: -1 } } }, supplements: { unitPrice: { a: -2 } } });
    expect(n.config.completion.perCompany['甲司']).toEqual({ volumeRate: 0.7126, amountRate: null });
    expect(n.config.supplements.unitPrice).toEqual({});
    expect(n.notes.length).toBeGreaterThanOrEqual(3);
  });

  it('does not treat absolute references as wrong rows', () => {
    const pw = load((wb) => {
      const c = wb.Sheets[CALC];
      setCell(c, 'M1', 1.13);
      setCell(c, 'E3', (32000 / 30) / 1.13, 'D3/$M$1');
    });
    const an = analyze(pw, cfg());
    expect(an.issues.some((i) => i.category === CATEGORY.ref && i.location.endsWith('!E3'))).toBe(false);
  });

  it('counts a month without calc rows as original 0 consistently', () => {
    const pw = load((wb) => {
      const c = wb.Sheets[CALC];
      for (const a of ['A6', 'B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6', 'L6', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7', 'I7', 'J7', 'L7']) delete c[a];
    });
    const an = analyze(pw, cfg());
    const aug = an.cm.find((c) => c.month === 8)!;
    expect(aug.hasOriginal).toBe(false);
    expect(aug.original).toBe(0);
  });

  it('handles bare-number tier tables without overlaps', () => {
    const t = parseTierRow({ company: '甲', label: '制度原版', sheet: 's', row: 1, cells: TIERS.map((tier, i) => ({ tier, raw: [100, 100, 200, 300, 400, 500, 600][i], addr: '' })), extras: [] });
    expect(tierOf(600, t)).toMatchObject({ tier: 'A2', ambiguous: false });
    expect(tierOf(250, t)).toMatchObject({ tier: 'B1', ambiguous: false });
  });

  it('skips month subtotal rows and reads month blocks without a repeated header', () => {
    const pw = load((wb) => {
      const c = wb.Sheets[CALC];
      // 在八月前插入“七月合计”行：把第 6 行移到空位不现实，这里直接把 A6 改成“七月合计”，B6 置空，第 7 行接着是八月数据
      setCell(c, 'A6', '七月合计');
      for (const a of ['B6', 'C6', 'D6', 'E6', 'F6', 'G6', 'H6', 'I6', 'J6', 'L6']) delete c[a];
      setCell(c, 'A7', '八月');
      const d = wb.Sheets[DETAIL];
      // 八月块去掉表头行
      for (const col of 'ABCDEFGHIJKL') delete d[`${col}18`];
    });
    expect(pw.calcRows.map((r) => `${r.month}${r.model}`)).toEqual(['7X100', '7X200', '7X300', '8X300']);
    expect(pw.orders.filter((o) => o.month === 8)).toHaveLength(4);
    expect(pw.warnings.some((w) => w.message.includes('没有重复表头'))).toBe(true);
  });

  it('supplements only fill gaps and never override table values', () => {
    const pw = load();
    const sup = { unitPrice: { '甲司|7|X100': 99, '甲司|7|X400': 0.8 }, domesticAvg: {}, paid: {} };
    const lines = computeLines(pw, settingsFor(cfg({ supplements: sup }), { qty: 'shipped', price: 'contract' }), 'dept');
    expect(lines.find((l) => l.month === 7 && l.model === 'X100')).toMatchObject({ unitPrice: 1, unitSource: '表内' });
    expect(lines.find((l) => l.month === 7 && l.model === 'X400')).toMatchObject({ unitPrice: 0.8, unitSource: '补录' });
  });

  it('surfaces shipments with unknown payment under the shipped-and-paid basis', () => {
    const pw = load();
    const an = analyze(pw, cfg({ qtyBasis: 'shippedPaid' }));
    expect(an.issues.some((i) => i.category === CATEGORY.paid)).toBe(true);
    expect(an.cm.find((c) => c.month === 7)!.primary.paidUnknown).toBe(6);
    expect(an.waterfall.find((w) => w.month === 7)!.pending.some((p) => p.includes('缺回款'))).toBe(true);
  });

  it('accepts a 提成合计 that applies the row completion coefficient', () => {
    const pw = load((wb) => {
      const c = wb.Sheets[CALC];
      setCell(c, 'K3', 0.8);
      setCell(c, 'L3', 0.8 * 15 + 100, 'I3*C3*K3+J3');
    });
    const an = analyze(pw, cfg());
    expect(an.issues.some((i) => i.category === CATEGORY.formula && i.location.endsWith('!L3'))).toBe(false);
    expect(an.issues.some((i) => i.category === CATEGORY.coef && i.message.includes('完成系数'))).toBe(true);
    const jul = an.waterfall.find((w) => w.month === 7)!;
    expect(jul.steps.find((s) => s.key === 'rowfix')!.byModel.some((m) => m.model === 'X100')).toBe(false);
    expect(sumLines(an.primary.dept.filter((l) => l.month === 7)).final).toBeCloseTo(360, 9);
  });
});
