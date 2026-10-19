import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
import { buildPersonMap, computeLines, settingsFor, sumLines } from '../src/lib/calc';
import { defaultConfig } from '../src/lib/config';
import { parseWorkbook, parseWorkbookData } from '../src/lib/parse';
import { buildFixture } from './fixture';

describe('edge cases', () => {
  it('resolves merge chains and ignores cycles', () => {
    const m = buildPersonMap([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'X', to: 'Y' },
      { from: 'Y', to: 'X' },
    ]);
    expect(m.get('A')).toBe('C');
    expect(m.get('B')).toBe('C');
    // 循环时后设置的优先，旧的反向映射被丢弃，不会互换
    expect(m.get('Y')).toBe('X');
    expect(m.get('X')).toBeUndefined();
  });

  it('reports a friendly error for workbooks without the sheet pairs', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['hello']]), 'Sheet1');
    const pw = parseWorkbook(wb, 'x.xlsx');
    expect(pw.companies).toEqual([]);
    expect(pw.warnings[0].message).toContain('X明细');
  });

  it('works when columns are reordered and extra columns are inserted (按表头定位)', () => {
    const wb = buildFixture();
    const ws = wb.Sheets['三季度甲司明细'];
    // 把所有单元格右移一列，并在 A 列插入无关内容
    const moved: XLSX.WorkSheet = { '!ref': 'A1:N31' };
    for (const k of Object.keys(ws)) {
      if (k[0] === '!') continue;
      const { r, c } = XLSX.utils.decode_cell(k);
      moved[XLSX.utils.encode_cell({ r, c: c + 1 })] = ws[k];
    }
    moved.A2 = { t: 's', v: '备用列' };
    wb.Sheets['三季度甲司明细'] = moved;
    const bytes = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    const pw = parseWorkbookData(bytes, 'moved.xlsx');
    expect(pw.orders).toHaveLength(10);
    expect(pw.summaries).toHaveLength(7);
    expect(pw.orders[0]).toMatchObject({ person: '张三', model: 'X100', contractQty: 10, shipped: 10, customer: 'ACME TRADING PVT LTD' });
    const lines = computeLines(pw, settingsFor(defaultConfig(), { qty: 'shipped', price: 'contract' }), 'dept');
    expect(sumLines(lines.filter((l) => l.month === 7)).final).toBeCloseTo(360, 9);
  });

  it('never turns a pending unit price into zero, even with completion coefficients', () => {
    const pw = parseWorkbookData(new Uint8Array(XLSX.write(buildFixture(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer), 'f.xlsx');
    const an = analyze(pw, { ...defaultConfig(), qtyBasis: 'contract', completion: { mode: 'amount', full: 0.8, floor: 0.5, perCompany: { 甲司: { volumeRate: null, amountRate: 0.6 } } } });
    const aug = an.cm.find((c) => c.month === 8)!;
    expect(aug.primary.pendingUnit.map((l) => l.model)).toEqual(['X500']);
    // 合同口径 8 月：单价部分 X100 10×0.5 + X300 10×2 = 25（X500 待补，不计入）；溢价 50 + 80 + 30 = 160
    expect(aug.primary.unitComm).toBeCloseTo(25, 9);
    expect(aug.primary.final).toBeCloseTo(0.6 * 25 + 160, 9);
  });
});
