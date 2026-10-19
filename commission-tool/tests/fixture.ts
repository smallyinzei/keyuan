// 合成测试工作簿：版式与真实季度提成表一致（月份标题、明细表头、汇总块、提成计算表、档级表、隐藏的月度成本表），
// 数据全部虚构，并故意埋入若干错误，供单元测试使用。
import * as XLSX from 'xlsx';

type Spec = number | string | { f: string; v: number | string };

function sheet(cells: Record<string, Spec>, ref: string): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = { '!ref': ref };
  for (const [addr, spec] of Object.entries(cells)) {
    if (typeof spec === 'number') ws[addr] = { t: 'n', v: spec };
    else if (typeof spec === 'string') ws[addr] = { t: 's', v: spec };
    else ws[addr] = { t: typeof spec.v === 'number' ? 'n' : 's', v: spec.v, f: spec.f };
  }
  return ws;
}

export const DETAIL = '三季度甲司明细';
export const CALC = '三季度甲司提成计算';
export const COST7 = '提成计算7月';

const HEAD = ['对接人', '日期', '规格型号', '合同数量', '含税单价', '运费', '出库（出厂）单价', '出库金额', '订单单号', '客户', '实际出库', '未发数量'];

interface O {
  p: string;
  m: string;
  q: number;
  price: number;
  no: string;
  cust: string;
  shipped: number;
  unshipped: number;
}

function orderRows(cells: Record<string, Spec>, start: number, orders: O[]) {
  orders.forEach((o, i) => {
    const r = start + i;
    cells[`A${r}`] = o.p;
    cells[`C${r}`] = o.m;
    cells[`D${r}`] = o.q;
    cells[`E${r}`] = o.price;
    cells[`F${r}`] = 0;
    cells[`G${r}`] = { f: `E${r}-F${r}`, v: o.price };
    cells[`H${r}`] = { f: `D${r}*G${r}`, v: o.q * o.price };
    cells[`I${r}`] = o.no;
    cells[`J${r}`] = o.cust;
    cells[`K${r}`] = o.shipped;
    cells[`L${r}`] = o.unshipped;
  });
}

function header(cells: Record<string, Spec>, r: number) {
  HEAD.forEach((h, i) => (cells[`${String.fromCharCode(65 + i)}${r}`] = h));
}

interface S {
  m: string;
  d: Spec;
  dv: number;
  e: number;
  h: number;
  note?: string;
}

function summary(cells: Record<string, Spec>, r: number, rows: S[]) {
  cells[`D${r}`] = '外贸销售均价';
  cells[`E${r}`] = '内贸销售均价';
  cells[`G${r}`] = '溢价提成';
  cells[`H${r}`] = '实发数量';
  rows.forEach((s, i) => {
    const rr = r + 1 + i;
    cells[`C${rr}`] = s.m;
    cells[`D${rr}`] = s.d;
    cells[`E${rr}`] = s.e;
    if (s.note) cells[`F${rr}`] = s.note;
    cells[`G${rr}`] = { f: `(D${rr}-E${rr})*10%*H${rr}`, v: (s.dv - s.e) * 0.1 * s.h };
    cells[`H${rr}`] = s.h;
  });
  const t = r + 1 + rows.length;
  cells[`F${t}`] = '合计';
  cells[`G${t}`] = { f: `SUM(G${r + 1}:G${t - 1})`, v: rows.reduce((a, s) => a + (s.dv - s.e) * 0.1 * s.h, 0) };
  cells[`H${t}`] = { f: `SUM(H${r + 1}:H${t - 1})`, v: rows.reduce((a, s) => a + s.h, 0) };
}

/** 明细表中各汇总行的位置与数值，供提成计算表引用 */
export const SUM_ROWS = {
  jul: { X100: 11, X200: 12, X300: 13, X400: 14 },
  aug: { X100: 25, X300: 26, X500: 27 },
};

export function buildFixture(): XLSX.WorkBook {
  const d: Record<string, Spec> = {};
  d.A1 = '甲司七月';
  header(d, 2);
  orderRows(d, 3, [
    { p: '张三', m: 'X100', q: 10, price: 1000, no: 'C-20260701-001', cust: 'ACME TRADING PVT LTD', shipped: 10, unshipped: 0 },
    { p: '李四', m: 'X100', q: 20, price: 1100, no: 'C-20260702-002', cust: 'Beta Corp', shipped: 5, unshipped: 15 },
    // 未发数量填错：应为 0
    { p: '张三', m: 'X200', q: 8, price: 2000, no: 'C-20260703-003', cust: 'Acme Trading Private Limited', shipped: 8, unshipped: 1 },
    // 同一合同号，客户名不同
    { p: '李四', m: 'X200', q: 2, price: 2100, no: 'C-20260703-003', cust: 'Delta Inc', shipped: 2, unshipped: 0 },
    { p: '王五', m: 'X300', q: 5, price: 3000, no: 'C-20260704-004', cust: 'Gamma LLC', shipped: 5, unshipped: 0 },
    // X400 有实发但不在提成计算表
    { p: '张三', m: 'X400', q: 4, price: 500, no: 'C-20260705-005', cust: 'Gamma LLC', shipped: 4, unshipped: 0 },
  ]);
  summary(d, 10, [
    { m: 'X100', d: { f: '32000/30', v: 32000 / 30 }, dv: 32000 / 30, e: 1000, h: 15 },
    // 备注参考 X100，但内贸均价与 X100 不同
    { m: 'X200', d: { f: '20200/10', v: 2020 }, dv: 2020, e: 1950, h: 10, note: '内贸无销售数据，参考100' },
    { m: 'X300', d: 3000, dv: 3000, e: 2900, h: 5 },
    { m: 'X400', d: 500, dv: 500, e: 450, h: 4 },
  ]);
  d.A17 = '甲司八月';
  header(d, 18);
  orderRows(d, 19, [
    { p: '张三', m: 'X100', q: 10, price: 1200, no: 'C-20260801-006', cust: 'ACME TRADING PVT LTD', shipped: 10, unshipped: 0 },
    { p: '李四', m: 'X300', q: 6, price: 3100, no: 'C-20260802-007', cust: 'Beta Corp', shipped: 4, unshipped: 2 },
    { p: '王五', m: 'X300', q: 4, price: 3050, no: 'C-20260803-008', cust: 'Gamma LLC', shipped: 4, unshipped: 0 },
    { p: '李四', m: 'X500', q: 3, price: 4000, no: 'C-20260804-009', cust: 'Beta Corp', shipped: 0, unshipped: 3 },
  ]);
  // 实发数量 X100 与 X300 互换（应为 10 和 8）
  summary(d, 24, [
    { m: 'X100', d: 1200, dv: 1200, e: 1150, h: 8 },
    { m: 'X300', d: { f: '30800/10', v: 3080 }, dv: 3080, e: 3000, h: 10 },
    { m: 'X500', d: 4000, dv: 4000, e: 3900, h: 0 },
  ]);
  d.A31 = '甲司七月溢价提成合计';
  d.E31 = { f: 'G15', v: 240 };

  const c: Record<string, Spec> = {};
  c.A1 = '2026年三季度外贸部门提成明细表';
  ['序号', '牌号', '出库数量（吨）', '出库均价（含税）', '出库均价（不含税）', '当月实际变动成本（不含税）', '边际贡献', '提成单价档级', '提成单价', '溢价提成', '季度销售计划完成系数', '提成合计'].forEach(
    (h, i) => (c[`${String.fromCharCode(65 + i)}2`] = h),
  );
  const calcRow = (r: number, model: string, sumRow: number, qty: number, avg: number, premium: number, cost: Spec, costV: number, tier: string, unit: number, lFormula: string, lValue: number) => {
    c[`B${r}`] = model;
    c[`C${r}`] = { f: `${DETAIL}!H${sumRow}`, v: qty };
    c[`D${r}`] = { f: `${DETAIL}!D${sumRow}`, v: avg };
    c[`E${r}`] = { f: `D${r}/1.13`, v: avg / 1.13 };
    c[`F${r}`] = cost;
    c[`G${r}`] = { f: `E${r}-F${r}`, v: avg / 1.13 - costV };
    c[`H${r}`] = tier;
    c[`I${r}`] = unit;
    c[`J${r}`] = { f: `${DETAIL}!G${sumRow}`, v: premium };
    c[`L${r}`] = { f: lFormula, v: lValue };
  };
  c.A3 = '七月';
  calcRow(3, 'X100', SUM_ROWS.jul.X100, 15, 32000 / 30, 100, { f: '810-10', v: 800 }, 800, 'C2', 1, 'I3*C3+J3', 115);
  // F4 复制了 X100 的成本公式（源表 X200 为 1510）；L4 引用了上一行的 C3
  calcRow(4, 'X200', SUM_ROWS.jul.X200, 10, 2020, 70, { f: '810-10', v: 800 }, 800, 'A2', 10, 'I4*C3+J4', 220);
  calcRow(5, 'X300', SUM_ROWS.jul.X300, 5, 3000, 50, { f: '2510-10', v: 2500 }, 2500, 'C2', 1, 'I5*C5+J5', 55);
  c.A6 = '八月';
  // 档级错：边际贡献 161.95 按 8 月修正表应为 C2
  calcRow(6, 'X100', SUM_ROWS.aug.X100, 8, 1200, 40, 900, 900, 'C1', 0.5, 'I6*C6+J6', 44);
  calcRow(7, 'X300', SUM_ROWS.aug.X300, 10, 3080, 80, 2400, 2400, 'B1', 2, 'I7*C7+J7', 100);
  c.A8 = '合计';
  c.C8 = { f: 'SUM(C3:C7)', v: 48 };
  c.J8 = { f: 'SUM(J3:J7)', v: 340 };
  c.L8 = { f: 'SUM(L3:L7)', v: 534 };
  c.B10 = '备注：';
  ['C1', 'C2', 'B1', 'B2', 'B3', 'A1', 'A2'].forEach((t, i) => (c[`${String.fromCharCode(67 + i)}12`] = t));
  c.B13 = '制度原版边际贡献';
  ['<100', '100-200', '200-300', '300-400', '400-500', '500-600', '>600'].forEach((t, i) => (c[`${String.fromCharCode(67 + i)}13`] = t));
  c.B14 = '7月按实际产量边际贡献修正';
  c.C14 = '未修正';
  c.B15 = '8月按实际产量边际贡献修正';
  ['＜150', '150-250', '251-350', '351-450', '451-550', '551-650', '＞650'].forEach((t, i) => (c[`${String.fromCharCode(67 + i)}15`] = t));

  const s: Record<string, Spec> = {};
  s.A1 = '2026年7月某部提成明细表';
  ['序号', '牌号', '出库数量（吨）', '出库均价（含税）', '出库均价（不含税）', '当月实际变动成本（不含税）'].forEach((h, i) => (s[`${String.fromCharCode(65 + i)}2`] = h));
  [
    ['X100', 810],
    ['X200', 1510],
    ['X300', 2510],
  ].forEach(([m, cost], i) => {
    s[`A${3 + i}`] = i + 1;
    s[`B${3 + i}`] = m;
    s[`F${3 + i}`] = cost;
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(s, 'A1:F5'), COST7);
  XLSX.utils.book_append_sheet(wb, sheet(d, 'A1:L31'), DETAIL);
  XLSX.utils.book_append_sheet(wb, sheet(c, 'A1:L15'), CALC);
  wb.Workbook = { Sheets: [{ name: COST7, Hidden: 1 }, { name: DETAIL, Hidden: 0 }, { name: CALC, Hidden: 0 }] };
  return wb;
}

export function fixtureBytes(): Uint8Array {
  const out = XLSX.write(buildFixture(), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}
