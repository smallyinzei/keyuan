// 用 ExcelJS 生成导出文件：个人贡献表（沿用原格式）、体检报告、修改说明。
import ExcelJS from 'exceljs';
import { pendingItems, type Analysis, type PersonBlock } from './analysis';
import { basisLabel, basisShortLabel, type Basis, type Line, type WaterfallRow } from './calc';
import { CATEGORY, SEV_LABEL } from './checks';
import { cnMonth } from './text';
import { PREMIUM_RATE } from './types';

const FMT_MONEY = '#,##0.00;[Red]-#,##0.00';
const FMT_QTY = '#,##0.00##';
const FMT_PRICE = '#,##0.00';
const FILL_HEAD: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF6' } };
const FILL_TITLE: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F5F8' } };
const FILL_PENDING: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
const FILL_TOTAL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
const SEV_FILL: Record<string, ExcelJS.Fill> = {
  high: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E1' } },
  medium: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1DB' } },
  low: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9F0FB' } },
};
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFBFC7D2' } },
  left: { style: 'thin', color: { argb: 'FFBFC7D2' } },
  bottom: { style: 'thin', color: { argb: 'FFBFC7D2' } },
  right: { style: 'thin', color: { argb: 'FFBFC7D2' } },
};
const FONT = 'Microsoft YaHei';

function newBook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = '外贸提成测算与体检';
  wb.created = new Date();
  return wb;
}

function safeSheetName(name: string, wb: ExcelJS.Workbook): string {
  let base = name.replace(/[:\\/?*[\]]/g, '·').slice(0, 31);
  let n = 2;
  while (wb.getWorksheet(base)) base = `${name.slice(0, 28)}(${n++})`;
  return base;
}

/** 浮点数写进公式时去掉 0.1+0.2 这类尾差 */
function lit(n: number): string {
  return String(Number(n.toPrecision(15)));
}

function styleHeader(row: ExcelJS.Row, from = 1, to = row.cellCount) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT, bold: true, size: 10 };
    cell.fill = FILL_HEAD;
    cell.border = THIN;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
}

function styleBody(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { name: FONT, size: 10, ...(cell.font ?? {}) };
    cell.border = THIN;
    cell.alignment = { vertical: 'middle', ...(cell.alignment ?? {}) };
  }
}

function noteRow(ws: ExcelJS.Worksheet, text: string, cols: number) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, cols);
  row.getCell(1).font = { name: FONT, size: 9, color: { argb: 'FF5A6472' } };
  row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  row.height = Math.max(15, Math.ceil(text.length / 70) * 14);
  return row;
}

// ───────────── 个人贡献表 ─────────────

const PERSONAL_HEAD = [null, '合同均价', '出库数量', '内贸销售均价', '部门提成单价', '出库量提成', '溢价提成', '小计', '备注'];

function lineNote(l: Line): string {
  const notes: string[] = [];
  if (l.unitComm === null) notes.push('待补单价');
  if (l.unitSource === '补录') notes.push('单价为补录');
  if (l.premium === null) notes.push(l.domestic === null ? '缺内贸均价' : '缺外贸均价');
  if (l.domSource === '补录') notes.push('内贸均价为补录');
  if (l.avgNote) notes.push(l.avgNote);
  if (l.mergedFrom.length) notes.push(`含 ${l.mergedFrom.join('、')} 的订单（人员合并）`);
  notes.push(...l.notes);
  return notes.join('；');
}

function writePersonalSheet(wb: ExcelJS.Workbook, an: Analysis, basis: Basis, blocks: PersonBlock[], title: string) {
  const ws = wb.addWorksheet(safeSheetName(title, wb), { views: [{ state: 'frozen', ySplit: 2 }] });
  ws.columns = [{ width: 16 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 34 }];
  const qtyName = basis.qty === 'contract' ? '合同数量' : basis.qty === 'shipped' ? '实际出库数量' : '已回款的出库数量';
  const avgName = basis.price === 'contract' ? '合同加权均价（含未发合同）' : '出库加权均价';
  noteRow(
    ws,
    `口径：${basisLabel(basis)}。列名沿用原格式：“出库数量”列填${qtyName}，“合同均价”列填${avgName}。溢价提成 = (合同均价 − 内贸销售均价) × ${PREMIUM_RATE * 100}% × 出库数量；缺单价显示“待补单价”，不按 0 计算，合计不含待补部分。来源：${an.pw.fileName}`,
    9,
  );
  ws.addRow([]);
  for (const b of blocks) {
    const titleRow = ws.addRow([`${b.person}${b.company}${cnMonth(b.month)}`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, 9);
    titleRow.getCell(1).font = { name: FONT, bold: true, size: 11 };
    titleRow.getCell(1).fill = FILL_TITLE;
    titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    titleRow.height = 20;
    styleHeader(ws.addRow(PERSONAL_HEAD), 1, 9);
    const first = ws.rowCount + 1;
    for (const l of b.lines) {
      const r = ws.rowCount + 1;
      const amount = basis.price === 'contract' || (l.shippedQty === 0 && l.avg !== null) ? l.amountContract : l.amountShipped;
      const denom = basis.price === 'contract' || (l.shippedQty === 0 && l.avg !== null) ? l.contractQty : l.shippedQty;
      const row = ws.addRow([
        l.model,
        l.avg === null ? null : denom > 0 ? { formula: `${lit(amount)}/${lit(denom)}`, result: l.avg } : l.avg,
        l.qty,
        l.domestic,
        l.unitPrice === null ? (l.qty === 0 ? null : '待补单价') : l.unitPrice,
        l.unitPrice === null && l.qty === 0 ? 0 : { formula: `IF(ISNUMBER(E${r}),E${r}*C${r},"待补单价")`, result: l.unitComm === null ? '待补单价' : l.unitComm },
        l.premium === null ? (l.qty === 0 ? 0 : '待补') : { formula: `(B${r}-D${r})*${PREMIUM_RATE * 100}%*C${r}`, result: l.premium },
        { formula: `IF(ISNUMBER(F${r}),F${r},0)+IF(ISNUMBER(G${r}),G${r},0)`, result: l.subtotal },
        lineNote(l),
      ]);
      styleBody(row, 1, 9);
      row.getCell(2).numFmt = FMT_PRICE;
      row.getCell(3).numFmt = FMT_QTY;
      row.getCell(4).numFmt = FMT_PRICE;
      row.getCell(5).numFmt = '0.00##';
      for (const c of [6, 7, 8]) row.getCell(c).numFmt = FMT_MONEY;
      row.getCell(9).alignment = { wrapText: true, vertical: 'middle' };
      if (l.unitComm === null) for (const c of [5, 6]) row.getCell(c).fill = FILL_PENDING;
      if (l.premium === null) row.getCell(7).fill = FILL_PENDING;
    }
    const last = ws.rowCount;
    const t = b.totals;
    const pendingText = t.pendingUnit.length ? `不含待补单价部分：${t.pendingUnit.map((l) => `${l.model}（${Number(l.qty.toFixed(4))} 吨）`).join('、')}` : '';
    const total = ws.addRow([
      '合计',
      null,
      { formula: `SUM(C${first}:C${last})`, result: t.qty },
      null,
      null,
      { formula: `SUM(F${first}:F${last})`, result: t.unitComm },
      { formula: `SUM(G${first}:G${last})`, result: t.premium },
      { formula: `SUM(H${first}:H${last})`, result: t.raw },
      pendingText,
    ]);
    styleBody(total, 1, 9);
    total.font = { name: FONT, bold: true, size: 10 };
    for (let c = 1; c <= 9; c++) total.getCell(c).fill = FILL_TOTAL;
    total.getCell(3).numFmt = FMT_QTY;
    for (const c of [6, 7, 8]) total.getCell(c).numFmt = FMT_MONEY;
    total.getCell(9).alignment = { wrapText: true, vertical: 'middle' };
    if (t.coefUnit !== 1 || t.coefPremium !== 1) {
      const tr = total.number;
      const coef = an.coefs[b.company];
      const k = ws.addRow([
        '完成系数后',
        null,
        null,
        null,
        null,
        { formula: `F${tr}*${lit(t.coefUnit)}`, result: t.unitComm * t.coefUnit },
        { formula: `G${tr}*${lit(t.coefPremium)}`, result: t.premium * t.coefPremium },
        { formula: `F${tr + 1}+G${tr + 1}`, result: t.final },
        `完成率 ${coef.rate === null ? '缺' : `${(coef.rate * 100).toFixed(2)}%`} → 单价部分 ×${t.coefUnit.toFixed(4)}，溢价 ×${t.coefPremium.toFixed(4)}`,
      ]);
      styleBody(k, 1, 9);
      k.font = { name: FONT, bold: true, size: 10 };
      for (const c of [6, 7, 8]) k.getCell(c).numFmt = FMT_MONEY;
    }
    ws.addRow([]);
  }
  return ws;
}

function writePersonSummary(wb: ExcelJS.Workbook, an: Analysis) {
  const ws = wb.addWorksheet(safeSheetName('个人汇总', wb), { views: [{ state: 'frozen', ySplit: 3 }] });
  const pl = basisShortLabel(an.primary.basis);
  const cl = basisShortLabel(an.comparison.basis);
  noteRow(ws, `主口径：${basisLabel(an.primary.basis)}；对照口径：${basisLabel(an.comparison.basis)}。金额为已知部分之和，待补单价不计入（见“待补项”列）。`, 11);
  ws.addRow([]);
  const head = ws.addRow(['姓名', '公司', '月份', `${pl}·数量`, `${pl}·出库量提成`, `${pl}·溢价提成`, `${pl}·小计`, `${cl}·数量`, `${cl}·小计`, '差额（主−对照）', '待补项']);
  styleHeader(head, 1, 11);
  ws.columns = [{ width: 10 }, { width: 8 }, { width: 7 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 36 }];
  const compIdx = new Map(an.personBlocks.comparison.map((b) => [`${b.person}|${b.company}|${b.month}`, b]));
  const primIdx = new Map(an.personBlocks.primary.map((b) => [`${b.person}|${b.company}|${b.month}`, b]));
  const keys = new Set([...primIdx.keys(), ...compIdx.keys()]);
  const order = [...keys]
    .map((k) => {
      const [person, company, month] = k.split('|');
      return { k, person, company, month: Number(month) };
    })
    .sort((a, b) => an.persons.indexOf(a.person) - an.persons.indexOf(b.person) || an.pw.companies.indexOf(a.company) - an.pw.companies.indexOf(b.company) || a.month - b.month);
  const perPerson = new Map<string, { p: number; c: number; pq: number; cq: number; pu: number; pp: number }>();
  for (const o of order) {
    const p = primIdx.get(o.k);
    const c = compIdx.get(o.k);
    const pend = [...(p?.totals.pendingUnit ?? []).map((l) => `主:${l.model}`), ...(c?.totals.pendingUnit ?? []).map((l) => `对照:${l.model}`)].join('、');
    const row = ws.addRow([o.person, o.company, `${o.month}月`, p?.totals.qty ?? 0, p?.totals.unitComm ?? 0, p?.totals.premium ?? 0, p?.totals.final ?? 0, c?.totals.qty ?? 0, c?.totals.final ?? 0, (p?.totals.final ?? 0) - (c?.totals.final ?? 0), pend]);
    styleBody(row, 1, 11);
    for (const col of [4, 8]) row.getCell(col).numFmt = FMT_QTY;
    for (const col of [5, 6, 7, 9, 10]) row.getCell(col).numFmt = FMT_MONEY;
    const agg = perPerson.get(o.person) ?? { p: 0, c: 0, pq: 0, cq: 0, pu: 0, pp: 0 };
    agg.p += p?.totals.final ?? 0;
    agg.c += c?.totals.final ?? 0;
    agg.pq += p?.totals.qty ?? 0;
    agg.cq += c?.totals.qty ?? 0;
    agg.pu += (p?.totals.unitComm ?? 0) * (p?.totals.coefUnit ?? 1);
    agg.pp += (p?.totals.premium ?? 0) * (p?.totals.coefPremium ?? 1);
    perPerson.set(o.person, agg);
  }
  ws.addRow([]);
  const h2 = ws.addRow(['姓名', '合计', '', `${pl}·数量`, `${pl}·出库量提成`, `${pl}·溢价提成`, `${pl}·小计`, `${cl}·数量`, `${cl}·小计`, '差额（主−对照）', '']);
  styleHeader(h2, 1, 11);
  let sum = { p: 0, c: 0, pq: 0, cq: 0, pu: 0, pp: 0 };
  for (const person of an.persons) {
    const a = perPerson.get(person);
    if (!a) continue;
    sum = { p: sum.p + a.p, c: sum.c + a.c, pq: sum.pq + a.pq, cq: sum.cq + a.cq, pu: sum.pu + a.pu, pp: sum.pp + a.pp };
    const row = ws.addRow([person, '季度', '', a.pq, a.pu, a.pp, a.p, a.cq, a.c, a.p - a.c, '']);
    styleBody(row, 1, 11);
    for (const col of [4, 8]) row.getCell(col).numFmt = FMT_QTY;
    for (const col of [5, 6, 7, 9, 10]) row.getCell(col).numFmt = FMT_MONEY;
  }
  const tr = ws.addRow(['合计', '', '', sum.pq, sum.pu, sum.pp, sum.p, sum.cq, sum.c, sum.p - sum.c, '']);
  styleBody(tr, 1, 11);
  tr.font = { name: FONT, bold: true, size: 10 };
  for (const col of [4, 8]) tr.getCell(col).numFmt = FMT_QTY;
  for (const col of [5, 6, 7, 9, 10]) tr.getCell(col).numFmt = FMT_MONEY;
}

function writeBasisCompare(wb: ExcelJS.Workbook, an: Analysis) {
  const ws = wb.addWorksheet(safeSheetName('口径对比', wb), { views: [{ state: 'frozen', ySplit: 3 }] });
  const pl = basisShortLabel(an.primary.basis);
  const cl = basisShortLabel(an.comparison.basis);
  noteRow(ws, `部门层面：原表 vs 重算（${pl}：${basisLabel(an.primary.basis)}）vs 对照（${cl}：${basisLabel(an.comparison.basis)}），以及 Σ个人。`, 10);
  ws.addRow([]);
  const head = ws.addRow(['公司', '月份', '原表部门提成', `重算·${pl}`, '与原表差额', `对照·${cl}`, '主−对照', `Σ个人·${pl}`, '个人−部门', '待补项（主口径）']);
  styleHeader(head, 1, 10);
  ws.columns = [{ width: 8 }, { width: 7 }, { width: 15 }, { width: 15 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 15 }, { width: 13 }, { width: 40 }];
  for (const c of an.cm) {
    const row = ws.addRow([
      c.company,
      `${c.month}月`,
      c.original,
      c.primary.final,
      c.original === null ? null : c.primary.final - c.original,
      c.comparison.final,
      c.primary.final - c.comparison.final,
      c.personPrimary.final,
      c.personPrimary.final - c.primary.final,
      c.primary.pendingUnit.map((l) => `${l.model}（${Number(l.qty.toFixed(4))}吨）`).join('、'),
    ]);
    styleBody(row, 1, 10);
    for (const col of [3, 4, 5, 6, 7, 8, 9]) row.getCell(col).numFmt = FMT_MONEY;
  }
  const s = (f: (c: Analysis['cm'][number]) => number | null) => an.cm.reduce((a, c) => a + (f(c) ?? 0), 0);
  const tr = ws.addRow(['合计', '', s((c) => c.original), s((c) => c.primary.final), s((c) => (c.original === null ? null : c.primary.final - c.original)), s((c) => c.comparison.final), s((c) => c.primary.final - c.comparison.final), s((c) => c.personPrimary.final), s((c) => c.personPrimary.final - c.primary.final), '']);
  styleBody(tr, 1, 10);
  tr.font = { name: FONT, bold: true, size: 10 };
  for (const col of [3, 4, 5, 6, 7, 8, 9]) tr.getCell(col).numFmt = FMT_MONEY;
}

export function buildPersonalWorkbook(an: Analysis, wb = newBook()): ExcelJS.Workbook {
  writePersonalSheet(wb, an, an.primary.basis, an.personBlocks.primary, `个人贡献-${basisShortLabel(an.primary.basis)}`);
  writePersonalSheet(wb, an, an.comparison.basis, an.personBlocks.comparison, `个人贡献-${basisShortLabel(an.comparison.basis)}`);
  writePersonSummary(wb, an);
  writeBasisCompare(wb, an);
  return wb;
}

// ───────────── 体检报告 ─────────────

export function buildHealthWorkbook(an: Analysis, wb = newBook()): ExcelJS.Workbook {
  const ws = wb.addWorksheet(safeSheetName('体检报告', wb), { views: [{ state: 'frozen', ySplit: 3 }] });
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of an.issues) counts[i.severity]++;
  noteRow(ws, `来源：${an.pw.fileName}。共 ${an.issues.length} 条：严重 ${counts.high}、警告 ${counts.medium}、提示 ${counts.low}。影响金额按原表口径（出库数量 × 合同均价）估算对部门提成的影响，正数表示应增加；“—”表示无法估算或待补。`, 13);
  ws.addRow([]);
  const head = ws.addRow(['序号', '严重度', '类别', '公司', '月份', '型号', '位置', '原值', '应为', '影响金额', '影响说明', '问题说明', '建议']);
  styleHeader(head, 1, 13);
  ws.columns = [{ width: 6 }, { width: 7 }, { width: 10 }, { width: 8 }, { width: 6 }, { width: 14 }, { width: 28 }, { width: 30 }, { width: 30 }, { width: 12 }, { width: 28 }, { width: 46 }, { width: 30 }];
  for (const i of an.issues) {
    const row = ws.addRow([Number(i.id), SEV_LABEL[i.severity], i.category, i.company, i.month ? `${i.month}月` : '', i.model, i.location, i.original, i.expected, i.impact, i.impactNote, i.message, i.suggestion]);
    styleBody(row, 1, 13);
    row.getCell(2).fill = SEV_FILL[i.severity];
    row.getCell(10).numFmt = FMT_MONEY;
    for (const c of [6, 7, 8, 9, 11, 12, 13]) row.getCell(c).alignment = { wrapText: true, vertical: 'top' };
  }
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + an.issues.length, column: 13 } };

  const sum = wb.addWorksheet(safeSheetName('体检汇总', wb));
  sum.columns = [{ width: 14 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 18 }];
  styleHeader(sum.addRow(['类别', '严重', '警告', '提示', '合计', '可估算影响金额合计']), 1, 6);
  const cats = [...new Set(an.issues.map((i) => i.category))];
  for (const cat of cats) {
    const list = an.issues.filter((i) => i.category === cat);
    const row = sum.addRow([cat, list.filter((i) => i.severity === 'high').length, list.filter((i) => i.severity === 'medium').length, list.filter((i) => i.severity === 'low').length, list.length, list.reduce((a, i) => a + (i.impact ?? 0), 0)]);
    styleBody(row, 1, 6);
    row.getCell(6).numFmt = FMT_MONEY;
  }
  const tr = sum.addRow(['合计', counts.high, counts.medium, counts.low, an.issues.length, null]);
  styleBody(tr, 1, 6);
  tr.font = { name: FONT, bold: true, size: 10 };
  sum.addRow([]);
  noteRow(sum, '说明：各条影响金额是相对原表的单独估算，彼此可能重叠（例如两型号实发互换会各报一条），不宜直接相加作为结论；结论以“修改说明 → 部门提成对账”为准。', 6);
  return wb;
}

// ───────────── 修改说明 ─────────────

const ADOPTED: Record<string, string> = {
  rowfix: '提成合计按本行重算（修正引用错行）',
  resum: '按明细重算汇总数量与均价',
  missing: '补列漏项型号（溢价）',
  exclude: '剔除关联公司订单',
  supplement: '使用补录单价/内贸均价',
  qty: '切换数量口径',
  price: '切换均价口径',
  coef: '应用完成系数',
  person: 'Σ个人与部门的均价结构差',
};

const ADOPTED_CATEGORIES = new Set<string>([CATEGORY.ref, CATEGORY.shipped, CATEGORY.avg, CATEGORY.missingModel]);

function changeRows(an: Analysis): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [];
  let n = 0;
  for (const i of an.issues) {
    if (i.severity === 'low' && !(i.impact && Math.abs(i.impact) >= 0.005)) continue;
    const adopted = ADOPTED_CATEGORIES.has(i.category) || (i.category === CATEGORY.formula && i.impact !== null && i.impact !== 0);
    const tag = adopted ? '重算已采用' : i.category === CATEGORY.missingPrice ? '待补' : i.category === CATEGORY.basis ? '口径说明' : '待确认（未采用）';
    rows.push([++n, tag, i.company, i.month ? `${i.month}月` : '', i.location, i.original, i.expected, i.impact, `${i.message}${i.impactNote ? `（${i.impactNote}）` : ''}`]);
  }
  return rows;
}

function writeWaterfall(ws: ExcelJS.Worksheet, rows: WaterfallRow[]) {
  styleHeader(ws.addRow(['公司', '月份', '步骤', '部门提成', '本步差额', '说明', '按型号拆分']), 1, 7);
  for (const r of rows) {
    r.steps.forEach((s, i) => {
      const row = ws.addRow([
        i === 0 ? r.company : '',
        i === 0 ? `${r.month}月` : '',
        s.label,
        s.total,
        i === 0 ? null : s.delta,
        s.explain,
        s.byModel.map((m) => `${m.model} ${m.delta > 0 ? '+' : ''}${m.delta.toFixed(2)}`).join('；'),
      ]);
      styleBody(row, 1, 7);
      row.getCell(4).numFmt = FMT_MONEY;
      row.getCell(5).numFmt = FMT_MONEY;
      for (const c of [6, 7]) row.getCell(c).alignment = { wrapText: true, vertical: 'top' };
      if (Math.abs(s.delta) >= 0.005 && i > 0) row.getCell(5).font = { name: FONT, size: 10, bold: true };
    });
    if (r.pending.length) {
      const row = ws.addRow(['', '', '仍待补', null, null, r.pending.join('；'), '']);
      styleBody(row, 1, 7);
      row.getCell(6).fill = FILL_PENDING;
    }
    ws.addRow([]);
  }
}

export function buildChangeNotesWorkbook(an: Analysis, wb = newBook()): ExcelJS.Workbook {
  const ws = wb.addWorksheet(safeSheetName('修改说明', wb), { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.columns = [{ width: 6 }, { width: 15 }, { width: 8 }, { width: 7 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 13 }, { width: 60 }];
  noteRow(ws, `本表说明工具重算结果相对原表（${an.pw.fileName}）的差异来源。“重算已采用”= 已体现在工具的部门提成/个人贡献中；“待确认（未采用）”= 需业务或财务确认后再改，工具未改动；“待补”= 缺数据，金额中不含该部分；“口径说明”= 数量与均价口径的影响，可在规则配置中切换。`, 9);
  noteRow(ws, `规则：数量口径 ${basisLabel(an.primary.basis)}；对照口径 ${basisLabel(an.comparison.basis)}；完成系数 ${an.cfg.completion.mode === 'none' ? '无' : an.cfg.completion.mode === 'volume' ? '按销量' : '按金额'}；溢价${an.cfg.premiumNeedsTarget ? '需' : '不需'}达成目标；人员合并 ${an.cfg.personMerge.length} 条；关联公司剔除 ${an.cfg.relatedCustomers.length} 家。`, 9);
  ws.addRow([]);
  styleHeader(ws.addRow(['序号', '处理', '公司', '月份', '位置', '原值', '修改为', '影响金额', '说明']), 1, 9);
  for (const r of changeRows(an)) {
    const row = ws.addRow(r);
    styleBody(row, 1, 9);
    row.getCell(8).numFmt = FMT_MONEY;
    for (const c of [5, 6, 7, 9]) row.getCell(c).alignment = { wrapText: true, vertical: 'top' };
    const tag = String(r[1]);
    row.getCell(2).fill = tag === '重算已采用' || tag === '口径说明' ? SEV_FILL.low : tag === '待补' ? FILL_PENDING : SEV_FILL.medium;
  }

  const wf = wb.addWorksheet(safeSheetName('部门提成对账', wb));
  wf.columns = [{ width: 8 }, { width: 7 }, { width: 26 }, { width: 15 }, { width: 13 }, { width: 50 }, { width: 50 }];
  noteRow(wf, '逐步从“原表部门提成”走到“Σ个人贡献”，每一步只改变一个因素，差额可逐项相加。', 7);
  wf.addRow([]);
  writeWaterfall(wf, an.waterfall);
  const tot = new Map<string, number>();
  for (const r of an.waterfall) for (const s of r.steps) tot.set(s.key, (tot.get(s.key) ?? 0) + (s.key === 'orig' ? s.total : s.delta));
  styleHeader(wf.addRow(['季度合计', '', '步骤', '金额/差额', '', '', '']), 1, 7);
  for (const [k, v] of tot) {
    const label = k === 'orig' ? '原表部门提成' : ADOPTED[k] ?? k;
    const row = wf.addRow(['', '', label, v, null, '', '']);
    styleBody(row, 1, 7);
    row.getCell(4).numFmt = FMT_MONEY;
  }

  const pend = wb.addWorksheet(safeSheetName('待补事项', wb));
  pend.columns = [{ width: 8 }, { width: 7 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 30 }];
  styleHeader(pend.addRow(['公司', '月份', '型号', '主口径数量', '对照口径数量', '需补', '当前处理']), 1, 7);
  for (const p of pendingItems(an)) {
    const unit = an.cfg.supplements.unitPrice[p.key];
    const dom = an.cfg.supplements.domesticAvg[p.key];
    const row = pend.addRow([
      p.company,
      `${p.month}月`,
      p.model,
      p.primaryQty,
      p.comparisonQty,
      [p.needUnit ? '提成单价' : '', p.needDomestic ? '内贸均价' : ''].filter(Boolean).join('、'),
      unit !== undefined || dom !== undefined ? `已补录${unit !== undefined ? ` 单价 ${unit}` : ''}${dom !== undefined ? ` 内贸均价 ${dom}` : ''}` : '标记待补，不按 0 计算',
    ]);
    styleBody(row, 1, 7);
    for (const c of [4, 5]) row.getCell(c).numFmt = FMT_QTY;
  }

  const rules = wb.addWorksheet(safeSheetName('规则配置', wb));
  rules.columns = [{ width: 24 }, { width: 90 }];
  const kv: [string, string][] = [
    ['数量口径', `${an.cfg.qtyBasis}（${basisLabel(an.primary.basis)}）`],
    ['均价口径', an.cfg.priceBasis],
    ['对照口径', basisLabel(an.comparison.basis)],
    ['完成系数', `${an.cfg.completion.mode}；≥${an.cfg.completion.full * 100}% 取 1，${an.cfg.completion.floor * 100}%–${an.cfg.completion.full * 100}% 取达成率，<${an.cfg.completion.floor * 100}% 取 0`],
    ...an.pw.companies.map((c): [string, string] => [`  ${c} 系数`, `完成率 ${an.coefs[c].rate === null ? '—' : `${(an.coefs[c].rate! * 100).toFixed(2)}%（${an.coefs[c].rateSource}）`} → 单价部分 ×${an.coefs[c].unit.toFixed(4)}，溢价 ×${an.coefs[c].premium.toFixed(4)}`]),
    ['溢价是否需达成目标', an.cfg.premiumNeedsTarget ? '是：溢价同样乘完成系数' : '否：溢价不乘完成系数'],
    ['人员合并', an.cfg.personMerge.map((m) => `${m.from}→${m.to}`).join('；') || '无'],
    ['关联公司剔除', an.cfg.relatedCustomers.join('；') || '无'],
    ['缺单价处理', '标记待补（禁止按 0 计算）'],
    ['规则 JSON', JSON.stringify(an.cfg)],
  ];
  styleHeader(rules.addRow(['项目', '内容']), 1, 2);
  for (const [k, v] of kv) {
    const row = rules.addRow([k, v]);
    styleBody(row, 1, 2);
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  }
  return wb;
}

export function buildAllWorkbook(an: Analysis): ExcelJS.Workbook {
  const wb = newBook();
  buildPersonalWorkbook(an, wb);
  buildHealthWorkbook(an, wb);
  buildChangeNotesWorkbook(an, wb);
  return wb;
}

export async function workbookBytes(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

/** 纯文本版修改说明（便于粘贴到微信/邮件） */
export function changeNotesText(an: Analysis): string {
  const lines: string[] = [];
  lines.push(`【外贸提成测算与体检】${an.pw.fileName}`);
  lines.push(`主口径：${basisLabel(an.primary.basis)}；对照口径：${basisLabel(an.comparison.basis)}`);
  lines.push('');
  lines.push('一、部门提成：原表 → 重算');
  for (const c of an.cm) {
    const d = c.original === null ? null : c.primary.final - c.original;
    lines.push(`  ${c.company}${c.month}月：原表 ${c.original === null ? '—' : c.original.toFixed(2)} → 重算 ${c.primary.final.toFixed(2)}${d !== null && Math.abs(d) >= 0.005 ? `（${d > 0 ? '+' : ''}${d.toFixed(2)}）` : ''}${c.primary.pendingUnit.length ? `，待补：${c.primary.pendingUnit.map((l) => l.model).join('、')}` : ''}`);
  }
  lines.push('');
  lines.push('二、差异来源（非零步骤）');
  for (const r of an.waterfall) {
    for (const s of r.steps.slice(1)) {
      if (Math.abs(s.delta) < 0.005) continue;
      lines.push(`  ${r.company}${r.month}月 ${s.label}：${s.delta > 0 ? '+' : ''}${s.delta.toFixed(2)}（${s.byModel.map((m) => `${m.model} ${m.delta > 0 ? '+' : ''}${m.delta.toFixed(2)}`).join('，')}）`);
    }
  }
  lines.push('');
  lines.push('三、需确认 / 待补');
  for (const i of an.issues) {
    if (i.severity === 'low') continue;
    lines.push(`  [${SEV_LABEL[i.severity]}] ${i.company}${i.month ? `${i.month}月` : ''} ${i.location}：${i.message}${i.impact !== null && Math.abs(i.impact) >= 0.005 ? `，影响 ${i.impact > 0 ? '+' : ''}${i.impact.toFixed(2)}` : ''}`);
  }
  return lines.join('\n');
}

