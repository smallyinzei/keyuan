import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { analyze, pendingItems } from '../src/lib/analysis';
import { computeBasis, groupBy, sumLines } from '../src/lib/calc';
import { CATEGORY } from '../src/lib/checks';
import { defaultConfig } from '../src/lib/config';
import { buildAllWorkbook, buildChangeNotesWorkbook, buildHealthWorkbook, buildPersonalWorkbook, changeNotesText, workbookBytes } from '../src/lib/export';
import { parseWorkbookData } from '../src/lib/parse';
import type { RuleConfig } from '../src/lib/types';
import { CALC, DETAIL, fixtureBytes } from './fixture';

const pw = parseWorkbookData(fixtureBytes(), 'fixture.xlsx');
const cfg = (patch: Partial<RuleConfig> = {}): RuleConfig => ({ ...defaultConfig(), ...patch });
const total = (lines: ReturnType<typeof computeBasis>['dept'], month: number) => sumLines(lines.filter((l) => l.month === month));
const personTotal = (lines: ReturnType<typeof computeBasis>['person'], person: string, month: number) => sumLines(lines.filter((l) => l.person === person && l.month === month));

describe('parse (按表头定位)', () => {
  it('finds the company pair, months and blocks', () => {
    expect(pw.companies).toEqual(['甲司']);
    expect(pw.quarterLabel).toBe('三季度');
    expect(pw.sheets).toEqual([{ company: '甲司', detail: DETAIL, calc: CALC }]);
    expect(pw.orders).toHaveLength(10);
    expect(pw.orders.filter((o) => o.month === 7)).toHaveLength(6);
    expect(pw.summaries.map((s) => `${s.month}${s.model}`)).toEqual(['7X100', '7X200', '7X300', '7X400', '8X100', '8X300', '8X500']);
    expect(pw.calcRows.map((r) => `${r.month}${r.model}`)).toEqual(['7X100', '7X200', '7X300', '8X100', '8X300']);
    expect(pw.warnings).toEqual([]);
  });

  it('reads Order / Standard / TierTable fields', () => {
    const o = pw.orders[1];
    expect(o).toMatchObject({ person: '李四', model: 'X100', contractQty: 20, price: 1100, netPrice: 1100, shipped: 5, unshippedRaw: 15, customer: 'Beta Corp', contractNo: 'C-20260702-002', row: 4 });
    const st = pw.standards.find((s) => s.month === 7 && s.model === 'X200')!;
    expect(st).toMatchObject({ domesticAvg: 1950, varCost: 800, tier: 'A2', unitPrice: 10 });
    expect(st.summary?.note).toContain('参考100');
    expect(pw.calcRows[1].formulas.total).toBe('=I4*C3+J4');
    expect(pw.tierTables.map((t) => [t.month, t.unmodified])).toEqual([
      [null, false],
      [7, true],
      [8, false],
    ]);
    expect(pw.tierTables[2].lowerBounds).toMatchObject({ C2: 150, B1: 251, A2: 650 });
    expect(pw.costSources.map((c) => `${c.month}${c.model}=${c.varCost}`)).toEqual(['7X100=810', '7X200=1510', '7X300=2510']);
    expect(pw.calcTotalRows[0]).toMatchObject({ row: 8, total: 534 });
  });
});

describe('calculation', () => {
  it('department commission on the original basis (出库数量 × 合同均价)', () => {
    const r = computeBasis(pw, cfg(), { qty: 'shipped', price: 'contract' });
    const jul = total(r.dept, 7);
    expect(jul.final).toBeCloseTo(360, 9);
    expect(jul.pendingUnit.map((l) => l.model)).toEqual(['X400']);
    expect(r.dept.find((l) => l.model === 'X400')).toMatchObject({ unitComm: null, unitSource: '缺失' });
    expect(total(r.dept, 8).final).toBeCloseTo(135, 9);
  });

  it('contract basis keeps missing unit prices pending, never zero', () => {
    const r = computeBasis(pw, cfg(), { qty: 'contract', price: 'contract' });
    expect(total(r.dept, 7).final).toBeCloseTo(475, 9);
    const aug = total(r.dept, 8);
    expect(aug.final).toBeCloseTo(185, 9);
    expect(aug.pendingUnit.map((l) => l.model)).toEqual(['X500']);
    // 个人合计 = 部门合计（合同口径下数量与均价一致，无结构差）
    expect(sumLines(r.person.filter((l) => l.month === 7)).final).toBeCloseTo(475, 9);
    expect(personTotal(r.person, '李四', 7).final).toBeCloseTo(270, 9);
  });

  it('personal contributions show the average-mix effect and person merge', () => {
    const r = computeBasis(pw, cfg(), { qty: 'shipped', price: 'contract' });
    expect(personTotal(r.person, '张三', 7).final).toBeCloseTo(150, 9);
    expect(personTotal(r.person, '李四', 7).final).toBeCloseTo(105, 9);
    expect(personTotal(r.person, '王五', 7).final).toBeCloseTo(55, 9);
    expect(sumLines(r.person.filter((l) => l.month === 8)).final).toBeCloseTo(131, 9);
    const merged = computeBasis(pw, cfg({ personMerge: [{ from: '王五', to: '李四' }] }), { qty: 'shipped', price: 'contract' });
    expect(personTotal(merged.person, '李四', 8).final).toBeCloseTo(80, 9);
    expect(merged.person.some((l) => l.person === '王五')).toBe(false);
    expect(sumLines(merged.person.filter((l) => l.month === 8)).final).toBeCloseTo(135, 9);
  });

  it('applies supplements, exclusions and completion coefficients', () => {
    const sup = computeBasis(pw, cfg({ supplements: { unitPrice: { '甲司|7|X400': 0.8 }, domesticAvg: {}, paid: {} } }), { qty: 'shipped', price: 'contract' });
    const jul = total(sup.dept, 7);
    expect(jul.final).toBeCloseTo(363.2, 9);
    expect(jul.pendingUnit).toHaveLength(0);

    const ex = computeBasis(pw, cfg({ relatedCustomers: ['gamma llc'] }), { qty: 'shipped', price: 'contract' });
    expect(total(ex.dept, 7).final).toBeCloseTo(285, 9);
    expect(total(ex.dept, 8).final).toBeCloseTo(103, 9);
    const ex2 = computeBasis(pw, cfg({ relatedCustomers: ['acme trading pvt. ltd.'] }), { qty: 'shipped', price: 'contract' });
    expect(ex2.dept.flatMap((l) => l.orderKeys)).toHaveLength(7);

    const k = (rate: number, premiumNeedsTarget: boolean) =>
      analyze(pw, cfg({ premiumNeedsTarget, completion: { mode: 'volume', full: 0.8, floor: 0.5, perCompany: { 甲司: { volumeRate: rate, amountRate: null } } } })).cm.find((c) => c.month === 7)!.primary.final;
    expect(k(0.7, false)).toBeCloseTo(0.7 * 120 + 240, 9);
    expect(k(0.7, true)).toBeCloseTo(0.7 * 360, 9);
    expect(k(0.4, false)).toBeCloseTo(240, 9);
    expect(k(0.85, true)).toBeCloseTo(360, 9);
  });

  it('shipped-and-paid basis counts only paid shipments', () => {
    const none = computeBasis(pw, cfg(), { qty: 'shippedPaid', price: 'contract' });
    expect(total(none.dept, 7).qty).toBe(0);
    expect(none.dept.find((l) => l.month === 7 && l.model === 'X100')?.paidUnknown).toBe(2);
    const key = pw.orders[0].key;
    const some = computeBasis(pw, cfg({ supplements: { unitPrice: {}, domesticAvg: {}, paid: { [key]: true } } }), { qty: 'shippedPaid', price: 'contract' });
    expect(some.dept.find((l) => l.month === 7 && l.model === 'X100')?.qty).toBe(10);
  });

  it('waterfall reconciles 原表 → 重算 → Σ个人 step by step', () => {
    const an = analyze(pw, cfg());
    const jul = an.waterfall.find((r) => r.month === 7)!;
    const step = (k: string) => jul.steps.find((s) => s.key === k)!;
    expect(step('orig').total).toBeCloseTo(390, 9);
    expect(step('rowfix').delta).toBeCloseTo(-50, 9);
    expect(step('rowfix').byModel).toEqual([{ model: 'X200', delta: -50 }]);
    expect(step('missing').delta).toBeCloseTo(20, 9);
    expect(step('coef').total).toBeCloseTo(360, 9);
    expect(step('person').delta).toBeCloseTo(-50, 9);
    const aug = an.waterfall.find((r) => r.month === 8)!;
    expect(aug.steps.find((s) => s.key === 'resum')!.delta).toBeCloseTo(-9, 9);
    for (const r of an.waterfall) {
      const sum = r.steps.slice(1).reduce((a, s) => a + s.delta, r.steps[0].total);
      expect(sum).toBeCloseTo(r.steps[r.steps.length - 1].total, 9);
    }
  });
});

describe('health checks', () => {
  const an = analyze(pw, cfg());
  const find = (cat: string, pred: (i: (typeof an.issues)[number]) => boolean = () => true) => an.issues.filter((i) => i.category === cat && pred(i));

  it('flags wrong-row references with the corrected formula and impact', () => {
    const [ref] = find(CATEGORY.ref);
    expect(ref).toMatchObject({ severity: 'high', model: 'X200', location: `${CALC}!L4`, expected: '=I4*C4+J4' });
    expect(ref.impact).toBeCloseTo(-50, 9);
  });

  it('recomputes summary shipments and detects the swap', () => {
    const sw = find(CATEGORY.shipped);
    expect(sw.map((i) => i.model).sort()).toEqual(['X100', 'X300']);
    expect(sw.every((i) => i.message.includes('互换'))).toBe(true);
    expect(sw.reduce((a, i) => a + (i.impact ?? 0), 0)).toBeCloseTo(-9, 9);
  });

  it('checks 未发 = 合同 − 实发', () => {
    const [u] = find(CATEGORY.unshipped);
    expect(u).toMatchObject({ location: `${DETAIL}!L5`, original: '1', expected: '0' });
  });

  it('identifies a copied variable cost from the monthly source sheet', () => {
    const [c] = find(CATEGORY.cost);
    expect(c.model).toBe('X200');
    expect(c.message).toContain('与 X100 相同');
    expect(c.expected).toBe('1500');
    expect(c.impact).toBeCloseTo(-80, 9);
  });

  it('checks tiers against the monthly table, boundaries and “参考” notes', () => {
    const [t] = find(CATEGORY.tier, (i) => i.severity === 'high');
    expect(t).toMatchObject({ model: 'X100', month: 8, original: 'C1', expected: 'C2' });
    expect(t.impact).toBeCloseTo(4, 9);
    const b = find(CATEGORY.boundary);
    expect(b.map((i) => i.month)).toEqual([null, 8]);
    const [n] = find(CATEGORY.note);
    expect(n.model).toBe('X200');
    expect(n.impact).toBeCloseTo(950, 9);
  });

  it('flags missing models / unit prices and customer inconsistencies', () => {
    const miss = find(CATEGORY.missingModel);
    expect(miss.map((i) => i.model)).toEqual(['X400']);
    expect(miss[0].impact).toBeCloseTo(20, 9);
    const price = find(CATEGORY.missingPrice);
    expect(price.map((i) => `${i.model}:${i.severity}`)).toEqual(['X400:high', 'X500:medium']);
    expect(price.every((i) => i.impact === null)).toBe(true);
    expect(find(CATEGORY.customer)[0].original).toContain('ACME TRADING PVT LTD');
    expect(find(CATEGORY.contract)[0]).toMatchObject({ severity: 'medium' });
  });

  it('lists pending items for the supplement form', () => {
    expect(pendingItems(an).map((p) => `${p.month}${p.model}:${p.primaryQty}/${p.comparisonQty}`)).toEqual(['7X400:4/4', '8X500:null/3']);
  });
});

describe('export', () => {
  const an = analyze(pw, cfg());

  it('writes the personal sheet in the original format with pending markers', async () => {
    const bytes = await workbookBytes(buildPersonalWorkbook(an));
    const wb = XLSX.read(bytes, { type: 'array', cellFormula: true });
    expect(wb.SheetNames).toEqual(['个人贡献-出库口径', '个人贡献-合同口径', '个人汇总', '口径对比']);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['个人贡献-出库口径'], { header: 1, defval: null });
    const titleIdx = rows.findIndex((r) => r[0] === '张三甲司七月');
    expect(rows[titleIdx + 1]).toEqual([null, '合同均价', '出库数量', '内贸销售均价', '部门提成单价', '出库量提成', '溢价提成', '小计', '备注']);
    const x400 = rows.find((r) => r[0] === 'X400')!;
    expect(x400[4]).toBe('待补单价');
    expect(x400[5]).toBe('待补单价');
    const totalRow = rows.slice(titleIdx).find((r) => r[0] === '合计')!;
    expect(totalRow[7]).toBeCloseTo(150, 6);
    expect(String(totalRow[8])).toContain('X400');
  });

  it('writes health report and change notes', async () => {
    const h = XLSX.read(await workbookBytes(buildHealthWorkbook(an)), { type: 'array' });
    expect(h.SheetNames).toEqual(['体检报告', '体检汇总']);
    const hr = XLSX.utils.sheet_to_json<unknown[]>(h.Sheets['体检报告'], { header: 1, defval: null });
    expect(hr[2]).toEqual(['序号', '严重度', '类别', '公司', '月份', '型号', '位置', '原值', '应为', '影响金额', '影响说明', '问题说明', '建议']);
    expect(hr.length - 3).toBe(an.issues.length);
    const n = XLSX.read(await workbookBytes(buildChangeNotesWorkbook(an)), { type: 'array' });
    expect(n.SheetNames).toEqual(['修改说明', '部门提成对账', '待补事项', '规则配置']);
    const all = XLSX.read(await workbookBytes(buildAllWorkbook(an)), { type: 'array' });
    expect(all.SheetNames).toHaveLength(10);
    expect(changeNotesText(an)).toContain('甲司7月：原表 390.00 → 重算 360.00（-30.00）');
  });

  it('keeps department totals consistent between analysis and grouping helpers', () => {
    const byMonth = groupBy(an.primary.dept, (l) => String(l.month));
    expect(sumLines(byMonth.get('7')!).final).toBeCloseTo(an.cm.find((c) => c.month === 7)!.primary.final, 9);
  });
});
