// 读取季度提成 Excel：按表头文字定位列，不依赖固定行号。
import type * as XLSX from 'xlsx';
import { SheetGrid, addr, colName, readWorkbook, sheetHidden, type Cell } from './sheet';
import { isMonthTitle, modelKey, normHeader, normText, parseMonth, toNumber } from './text';
import { parseTierRow } from './tiers';
import {
  TIERS,
  type CalcField,
  type CalcRow,
  type CompanySheets,
  type CompletionData,
  type CostSource,
  type Order,
  type OrderField,
  type ParseWarning,
  type ParsedWorkbook,
  type RowRole,
  type Standard,
  type SummaryField,
  type SummaryRow,
  type Tier,
  type TierTable,
} from './types';

interface Matcher<F extends string> {
  field: F;
  any?: string[];
  exact?: string[];
  not?: string[];
}

// 匹配顺序有意义：先认更具体的表头（如“提成单价档级”先认作档级，再认“提成单价”）
const ORDER_MATCHERS: Matcher<OrderField>[] = [
  { field: 'unshipped', any: ['未发'] },
  { field: 'shipped', any: ['实际出库', '实发', '出库数量', '已发'], not: ['单价', '金额', '均价'] },
  { field: 'netPrice', any: ['出厂单价', '出库(出厂)单价', '出库单价'] },
  { field: 'price', any: ['含税单价'], exact: ['单价', '合同单价', '销售单价'] },
  { field: 'freight', any: ['运费'] },
  { field: 'amount', any: ['金额'], not: ['回款'] },
  { field: 'contractQty', any: ['合同数量', '合同量', '签约数量'], exact: ['数量'] },
  { field: 'contractNo', any: ['单号', '合同号', '订单号', '合同编号'] },
  { field: 'customer', any: ['客户', '单位名称', '买方'] },
  { field: 'person', any: ['对接人', '业务员', '销售员', '负责人', '经办人'] },
  { field: 'model', any: ['规格型号', '型号', '牌号', '产品规格', '规格'] },
  { field: 'date', any: ['日期'] },
  { field: 'paid', any: ['回款'] },
];

const SUMMARY_MATCHERS: Matcher<SummaryField>[] = [
  { field: 'foreignAvg', any: ['外贸销售均价', '外贸均价'] },
  { field: 'domesticAvg', any: ['内贸销售均价', '内贸均价'] },
  { field: 'premium', any: ['溢价'] },
  { field: 'shippedQty', any: ['实发', '出库数量', '实际出库'] },
];

const CALC_MATCHERS: Matcher<CalcField>[] = [
  { field: 'tier', any: ['档级', '档位'] },
  { field: 'avgNet', any: ['不含税'], not: ['成本', '边际'] },
  { field: 'avgTax', any: ['均价'], not: ['不含税', '成本'] },
  { field: 'varCost', any: ['变动成本', '成本'] },
  { field: 'margin', any: ['边际贡献', '边际'] },
  { field: 'coef', any: ['系数'] },
  { field: 'unitPrice', any: ['提成单价', '单价'] },
  { field: 'premium', any: ['溢价'] },
  { field: 'total', any: ['提成合计', '合计', '提成金额'] },
  { field: 'qty', any: ['出库数量', '数量', '实发'] },
  { field: 'model', any: ['牌号', '规格型号', '型号'] },
  { field: 'seq', any: ['序号', '月份'] },
  { field: 'remark', any: ['备注'] },
];

type ColMap<F extends string> = Partial<Record<F, number>>;

function matchHeaders<F extends string>(cells: Cell[], matchers: Matcher<F>[]): ColMap<F> {
  const out: ColMap<F> = {};
  const usedCols = new Set<number>();
  for (const m of matchers) {
    for (const cell of cells) {
      if (usedCols.has(cell.c) || typeof cell.v !== 'string') continue;
      const h = normHeader(cell.v);
      if (!h || h.length > 20) continue;
      if (m.not?.some((k) => h.includes(normHeader(k)))) continue;
      const hit = m.exact?.some((k) => h === normHeader(k)) || m.any?.some((k) => h.includes(normHeader(k)));
      if (hit) {
        out[m.field] = cell.c;
        usedCols.add(cell.c);
        break;
      }
    }
  }
  return out;
}

function colsToLetters<F extends string>(m: ColMap<F>): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const k of Object.keys(m) as F[]) out[k] = colName(m[k] as number);
  return out;
}

const SHEET_RE = /^\s*((?:[一二三四1-4]\s*季度)|Q[1-4])?\s*(.+?)\s*(明细|提成计算)\s*$/i;

interface Ctx {
  warnings: ParseWarning[];
  rowRoles: Record<string, Record<number, RowRole>>;
}

function setRole(ctx: Ctx, sheet: string, row: number, role: RowRole) {
  (ctx.rowRoles[sheet] ??= {})[row] = role;
}

const PAID_TRUE = new Set(['是', '已回款', '已收', '已收款', '回款', 'Y', 'YES', '√', '✓', '✔', 'TRUE', '1', 'OK']);

function parsePaid(
  grid: SheetGrid,
  r: number,
  col: number | undefined,
  header: string,
  shipped: number,
  netPrice: number,
): number | null {
  if (col === undefined) return null;
  const cell = grid.get(r, col);
  if (!cell || cell.v === null || cell.v === undefined || normText(cell.v) === '') return null;
  const n = toNumber(cell.v);
  const h = normHeader(header);
  if (n !== null && h.includes('数量')) return Math.max(0, Math.min(shipped, n));
  if (n !== null && h.includes('金额')) return netPrice > 0 ? Math.max(0, Math.min(shipped, n / netPrice)) : null;
  const t = normText(cell.v).toUpperCase();
  if (PAID_TRUE.has(t) || cell.t === 'd' || (n !== null && n > 0 && h.includes('日期'))) return shipped;
  if (['否', '未回款', '未收', 'N', 'NO', '×', 'FALSE', '0'].includes(t)) return 0;
  return null;
}

function parseDetail(grid: SheetGrid, company: string, ctx: Ctx, orders: Order[], summaries: SummaryRow[], totals: ParsedWorkbook['summaryTotalRows']) {
  let month: number | null = null;
  let orderCols: ColMap<OrderField> | null = null;
  let paidHeader = '';
  let summaryCols: ColMap<SummaryField> | null = null;
  let summaryModelCol: number | undefined;
  let mode: 'idle' | 'orders' | 'summary' = 'idle';
  const occurrences = new Map<string, number>();
  const pendingNoMonth: Order[] = [];

  for (const r of grid.rowIndex) {
    const cells = grid.rowCells(r);
    if (!cells.length) continue;
    const rowNo = r + 1;
    const stringCells = cells.filter((c) => typeof c.v === 'string');

    if (cells.length <= 3 && stringCells.length && isMonthTitle(stringCells[0].v)) {
      month = parseMonth(stringCells[0].v);
      mode = 'idle';
      continue;
    }

    const om = matchHeaders(cells, ORDER_MATCHERS);
    if (om.model !== undefined && om.contractQty !== undefined && (om.person !== undefined || om.customer !== undefined)) {
      orderCols = om;
      paidHeader = om.paid !== undefined ? normText(grid.get(r, om.paid)?.v) : '';
      mode = 'orders';
      continue;
    }

    const sm = matchHeaders(cells, SUMMARY_MATCHERS);
    if (sm.foreignAvg !== undefined && sm.domesticAvg !== undefined) {
      summaryCols = sm;
      summaryModelCol = orderCols?.model;
      if (summaryModelCol === undefined || summaryModelCol >= (sm.foreignAvg as number)) {
        summaryModelCol = Math.max(0, (sm.foreignAvg as number) - 1);
      }
      mode = 'summary';
      if (month === null) {
        ctx.warnings.push({ level: 'error', message: `${company}：汇总块找不到所属月份标题`, loc: { sheet: grid.name, addr: addr(r, 0) } });
      }
      continue;
    }

    const rowText = stringCells.map((c) => normText(c.v)).join(' ');

    if (mode === 'orders' && orderCols) {
      const oc = orderCols;
      if (/合计|小计|总计/.test(rowText)) continue;
      const model = grid.text(r, oc.model);
      const contractQty = grid.num(r, oc.contractQty);
      if (!model) {
        if (contractQty !== null) {
          ctx.warnings.push({ level: 'warn', message: `${company}：第 ${rowNo} 行有合同数量但没有规格型号，已跳过`, loc: { sheet: grid.name, addr: addr(r, oc.model as number) } });
        }
        continue;
      }
      const freight = grid.num(r, oc.freight) ?? 0;
      let price = grid.num(r, oc.price);
      const netCell = grid.num(r, oc.netPrice);
      if (price === null && netCell !== null) price = netCell + freight;
      if (price === null) {
        ctx.warnings.push({ level: 'error', message: `${company}：第 ${rowNo} 行 ${model} 缺含税单价，按 0 读入，均价会失真`, loc: { sheet: grid.name, addr: addr(r, (oc.price ?? oc.netPrice ?? oc.model) as number) } });
        price = 0;
      }
      let shipped = grid.num(r, oc.shipped);
      if (shipped === null) {
        if (oc.shipped !== undefined && grid.text(r, oc.shipped)) {
          ctx.warnings.push({ level: 'warn', message: `${company}：第 ${rowNo} 行实际出库不是数字（${grid.text(r, oc.shipped)}），按 0 处理`, loc: { sheet: grid.name, addr: addr(r, oc.shipped) } });
        }
        shipped = 0;
      }
      const unshippedNum = grid.num(r, oc.unshipped);
      const unshippedText = grid.text(r, oc.unshipped);
      const contractNo = grid.text(r, oc.contractNo);
      const netPrice = price - freight;
      const occKey = `${company}|${month}|${contractNo}|${modelKey(model)}`;
      const n = (occurrences.get(occKey) ?? 0) + 1;
      occurrences.set(occKey, n);
      const formulas: Partial<Record<OrderField, string>> = {};
      for (const f of ['contractQty', 'shipped', 'price', 'unshipped'] as OrderField[]) {
        const fm = grid.formula(r, oc[f]);
        if (fm) formulas[f] = fm;
      }
      const order: Order = {
        key: `${occKey}|${n}`,
        company,
        month: month ?? 0,
        person: grid.text(r, oc.person) || '（未填对接人）',
        model,
        modelKey: modelKey(model),
        contractQty: contractQty ?? 0,
        price,
        freight,
        netPrice,
        shipped,
        unshippedRaw: unshippedNum ?? (unshippedText || null),
        customer: grid.text(r, oc.customer),
        contractNo,
        paidQty: parsePaid(grid, r, oc.paid, paidHeader, shipped, netPrice),
        sheet: grid.name,
        row: rowNo,
        cols: colsToLetters(oc),
        formulas,
      };
      if (contractQty === null) {
        ctx.warnings.push({ level: 'warn', message: `${company}：第 ${rowNo} 行 ${model} 合同数量为空，按 0 处理`, loc: { sheet: grid.name, addr: addr(r, oc.contractQty as number) } });
      }
      if (!grid.text(r, oc.person)) {
        ctx.warnings.push({ level: 'warn', message: `${company}：第 ${rowNo} 行 ${model} 未填对接人`, loc: { sheet: grid.name, addr: addr(r, (oc.person ?? oc.model) as number) } });
      }
      if (month === null) pendingNoMonth.push(order);
      orders.push(order);
      setRole(ctx, grid.name, rowNo, { kind: 'order', model, modelKey: order.modelKey, month: order.month, company });
      continue;
    }

    if (mode === 'summary' && summaryCols) {
      const sc = summaryCols;
      if (/合计|小计|总计/.test(rowText)) {
        totals.push({ company, month: month ?? 0, sheet: grid.name, row: rowNo, premium: grid.num(r, sc.premium), shippedQty: grid.num(r, sc.shippedQty) });
        mode = 'idle';
        continue;
      }
      const model = grid.text(r, summaryModelCol);
      if (!model) continue;
      const known = new Set([summaryModelCol, ...Object.values(sc)]);
      const noteCells = stringCells.filter((c) => !known.has(c.c));
      const formulas: Partial<Record<SummaryField, string>> = {};
      for (const f of Object.keys(sc) as SummaryField[]) {
        const fm = grid.formula(r, sc[f]);
        if (fm) formulas[f] = fm;
      }
      const s: SummaryRow = {
        company,
        month: month ?? 0,
        model,
        modelKey: modelKey(model),
        foreignAvg: grid.num(r, sc.foreignAvg),
        domesticAvg: grid.num(r, sc.domesticAvg),
        premium: grid.num(r, sc.premium),
        shippedQty: grid.num(r, sc.shippedQty),
        note: noteCells.map((c) => normText(c.v)).join('；'),
        sheet: grid.name,
        row: rowNo,
        cols: { ...colsToLetters(sc), model: colName(summaryModelCol as number), ...(noteCells[0] ? { note: colName(noteCells[0].c) } : {}) },
        formulas,
      };
      summaries.push(s);
      setRole(ctx, grid.name, rowNo, { kind: 'summary', model, modelKey: s.modelKey, month: s.month, company });
    }
  }

  if (pendingNoMonth.length) {
    ctx.warnings.push({ level: 'error', message: `${company}明细：${pendingNoMonth.length} 行订单找不到月份标题（如“${company}七月”），月份记为 0`, loc: { sheet: grid.name, addr: `A${pendingNoMonth[0].row}` } });
  }
}

function parseCalc(
  grid: SheetGrid,
  company: string,
  quarterLabel: string,
  ctx: Ctx,
  calcRows: CalcRow[],
  tierTables: TierTable[],
  completion: CompletionData[],
  calcTotalRows: ParsedWorkbook['calcTotalRows'],
) {
  let header: ColMap<CalcField> | null = null;
  let headerRow = -1;
  for (const r of grid.rowIndex) {
    const m = matchHeaders(grid.rowCells(r), CALC_MATCHERS);
    if (m.model !== undefined && m.unitPrice !== undefined && (m.qty !== undefined || m.total !== undefined)) {
      header = m;
      headerRow = r;
      break;
    }
  }
  if (!header) {
    ctx.warnings.push({ level: 'error', message: `${company}提成计算：找不到含“牌号/提成单价”的表头行`, loc: { sheet: grid.name, addr: 'A1' } });
  } else {
    const h = header;
    const monthCol = h.seq ?? 0;
    const lastHeaderCol = Math.max(...(Object.values(h) as number[]));
    let month: number | null = null;
    for (const r of grid.rowIndex) {
      if (r <= headerRow) continue;
      const label = grid.text(r, monthCol);
      const model = grid.text(r, h.model);
      if (/合计|总计/.test(label) || /合计|总计/.test(model)) {
        calcTotalRows.push({ company, sheet: grid.name, row: r + 1, total: grid.num(r, h.total), addr: addr(r, h.total ?? 0) });
        break;
      }
      // 没有“合计”行时，遇到备注或档级表即视为表格结束
      if (/备注|边际贡献|修正|制度/.test(model) || grid.rowCells(r).filter((c) => (TIERS as readonly string[]).includes(normHeader(c.v))).length >= 5) break;
      const m = parseMonth(label);
      if (m !== null) month = m;
      if (!model) continue;
      if (month === null) {
        ctx.warnings.push({ level: 'error', message: `${company}提成计算：第 ${r + 1} 行 ${model} 找不到月份（序号列应写“七月”等）`, loc: { sheet: grid.name, addr: addr(r, monthCol) } });
        continue;
      }
      const formulas: Partial<Record<CalcField, string>> = {};
      const rawText: Partial<Record<CalcField, string>> = {};
      for (const f of Object.keys(h) as CalcField[]) {
        const fm = grid.formula(r, h[f]);
        if (fm) formulas[f] = fm;
        const t = grid.text(r, h[f]);
        if (t) rawText[f] = t;
      }
      const remarkCells = grid
        .rowCells(r)
        .filter((c) => (h.remark !== undefined ? c.c === h.remark : c.c > lastHeaderCol) && typeof c.v === 'string');
      const row: CalcRow = {
        company,
        month,
        model,
        modelKey: modelKey(model),
        qty: grid.num(r, h.qty),
        avgTax: grid.num(r, h.avgTax),
        avgNet: grid.num(r, h.avgNet),
        varCost: grid.num(r, h.varCost),
        margin: grid.num(r, h.margin),
        tier: grid.text(r, h.tier) ? grid.text(r, h.tier).toUpperCase() : null,
        unitPrice: grid.num(r, h.unitPrice),
        premium: grid.num(r, h.premium),
        coef: grid.num(r, h.coef),
        total: grid.num(r, h.total),
        remark: remarkCells.map((c) => normText(c.v)).join('；'),
        sheet: grid.name,
        row: r + 1,
        cols: colsToLetters(h),
        formulas,
        rawText,
      };
      calcRows.push(row);
      setRole(ctx, grid.name, r + 1, { kind: 'calc', model, modelKey: row.modelKey, month, company });
    }
  }

  parseTierTables(grid, company, ctx, tierTables);
  parseCompletion(grid, company, quarterLabel, completion);
}

function parseTierTables(grid: SheetGrid, company: string, ctx: Ctx, tierTables: TierTable[]) {
  let tierCols: Partial<Record<Tier, number>> | null = null;
  for (const r of grid.rowIndex) {
    const cells = grid.rowCells(r);
    const found: Partial<Record<Tier, number>> = {};
    for (const c of cells) {
      const h = normHeader(c.v);
      if ((TIERS as readonly string[]).includes(h)) found[h as Tier] = c.c;
    }
    if (Object.keys(found).length >= 5) {
      tierCols = found;
      continue;
    }
    if (!tierCols) continue;
    const firstTierCol = Math.min(...(Object.values(tierCols) as number[]));
    const lastTierCol = Math.max(...(Object.values(tierCols) as number[]));
    const labelCell = cells.find((c) => c.c < firstTierCol && typeof c.v === 'string');
    const hasTierValues = TIERS.some((t) => tierCols![t] !== undefined && grid.get(r, tierCols![t]!) !== undefined);
    if (!labelCell || !hasTierValues) {
      if (!labelCell && !hasTierValues) tierCols = null;
      continue;
    }
    const label = normText(labelCell.v);
    const extras = cells.filter((c) => c.c > lastTierCol && typeof c.v === 'string').map((c) => normText(c.v));
    const table = parseTierRow({
      company,
      label,
      sheet: grid.name,
      row: r + 1,
      cells: TIERS.map((t) => {
        const c = tierCols![t];
        const cell = c === undefined ? undefined : grid.get(r, c);
        return { tier: t, raw: cell?.v ?? null, addr: c === undefined ? '' : addr(r, c) };
      }),
      extras,
    });
    if (table.month === null && !/原版|制度|基准|标准/.test(label)) {
      ctx.warnings.push({ level: 'info', message: `${company}档级表“${label}”未写月份，视为制度原版`, loc: { sheet: grid.name, addr: addr(r, labelCell.c) } });
    }
    tierTables.push(table);
  }
}

function parseCompletion(grid: SheetGrid, company: string, quarterLabel: string, completion: CompletionData[]) {
  for (const r of grid.rowIndex) {
    const cells = grid.rowCells(r);
    const vol = cells.find((c) => normHeader(c.v) === '销售量');
    const amt = cells.find((c) => normHeader(c.v) === '销售额');
    if (!vol || !amt) continue;
    const labelCol = Math.min(vol.c, amt.c) - 1;
    if (labelCol < 0) continue;
    const rowsByLabel = new Map<string, { vol: number | null; amt: number | null; r: number }>();
    for (const rr of grid.rowIndex) {
      if (rr <= r) continue;
      const label = normHeader(grid.get(rr, labelCol)?.v);
      if (!label) {
        if (rr > r + 1 && rowsByLabel.size) break;
        continue;
      }
      rowsByLabel.set(label, { vol: grid.num(rr, vol.c), amt: grid.num(rr, amt.c), r: rr });
    }
    const q = normHeader(quarterLabel);
    const plan = [...rowsByLabel.entries()].find(([k]) => k.includes('年度计划') || k === '计划');
    const actual = q ? rowsByLabel.get(q) : undefined;
    let rate = q ? rowsByLabel.get(`${q}完成率`) : undefined;
    if (!rate) {
      const cands = [...rowsByLabel.entries()].filter(([k]) => k.includes('完成率') && !k.startsWith('前') && !k.includes('年'));
      if (cands.length === 1) rate = cands[0][1];
    }
    const qTargetVol = plan?.[1].vol != null ? plan[1].vol / 4 : null;
    const qTargetAmt = plan?.[1].amt != null ? plan[1].amt / 4 : null;
    const volumeRate = rate?.vol ?? (actual?.vol != null && qTargetVol ? actual.vol / qTargetVol : null);
    const amountRate = rate?.amt ?? (actual?.amt != null && qTargetAmt ? actual.amt / qTargetAmt : null);
    completion.push({
      company,
      volumeRate,
      amountRate,
      volumeTarget: qTargetVol,
      volumeActual: actual?.vol ?? null,
      amountTarget: qTargetAmt,
      amountActual: actual?.amt ?? null,
      source: `${grid.name}!${addr(r, labelCol)}`,
    });
    return;
  }
}

function parseCostSource(grid: SheetGrid, costSources: CostSource[]) {
  let month = parseMonth(grid.name.replace(/提成计算/, ''));
  let header: ColMap<CalcField> | null = null;
  let headerRow = -1;
  for (const r of grid.rowIndex) {
    const cells = grid.rowCells(r);
    if (month === null && cells.length <= 2 && typeof cells[0]?.v === 'string') month = parseMonth(cells[0].v);
    const m = matchHeaders(cells, CALC_MATCHERS);
    if (m.model !== undefined && m.varCost !== undefined) {
      header = m;
      headerRow = r;
      break;
    }
  }
  if (!header || month === null) return;
  for (const r of grid.rowIndex) {
    if (r <= headerRow) continue;
    const model = grid.text(r, header.model);
    const cost = grid.num(r, header.varCost);
    if (!model || /合计/.test(model) || cost === null) continue;
    costSources.push({ month, model, modelKey: modelKey(model), varCost: cost, sheet: grid.name, row: r + 1, addr: addr(r, header.varCost as number) });
  }
}

function buildStandards(summaries: SummaryRow[], calcRows: CalcRow[]): Standard[] {
  const map = new Map<string, Standard>();
  const get = (company: string, month: number, model: string, key: string) => {
    const k = `${company}|${month}|${key}`;
    let s = map.get(k);
    if (!s) {
      s = { company, month, model, modelKey: key, domesticAvg: null, varCost: null, tier: null, unitPrice: null };
      map.set(k, s);
    }
    return s;
  };
  for (const s of summaries) {
    const st = get(s.company, s.month, s.model, s.modelKey);
    st.summary = s;
    st.domesticAvg = s.domesticAvg;
  }
  for (const c of calcRows) {
    const st = get(c.company, c.month, c.model, c.modelKey);
    st.calc = c;
    st.varCost = c.varCost;
    st.tier = c.tier;
    st.unitPrice = c.unitPrice;
  }
  return [...map.values()];
}

export function parseWorkbookData(data: ArrayBuffer | Uint8Array, fileName: string): ParsedWorkbook {
  return parseWorkbook(readWorkbook(data), fileName);
}

export function parseWorkbook(wb: XLSX.WorkBook, fileName: string): ParsedWorkbook {
  const ctx: Ctx = { warnings: [], rowRoles: {} };
  const detail = new Map<string, string>();
  const calc = new Map<string, string>();
  const order: string[] = [];
  let quarterLabel = '';
  const costSheets: string[] = [];
  for (const name of wb.SheetNames) {
    if (/提成计算\s*\d{1,2}\s*月/.test(name)) {
      costSheets.push(name);
      continue;
    }
    const m = name.match(SHEET_RE);
    if (!m) continue;
    const company = normText(m[2]);
    if (m[1] && !quarterLabel) quarterLabel = normText(m[1]).replace(/\s+/g, '');
    if (m[3] === '明细') {
      detail.set(company, name);
      if (!order.includes(company)) order.push(company);
    } else {
      calc.set(company, name);
      if (!order.includes(company)) order.push(company);
    }
  }
  const sheets: CompanySheets[] = [];
  for (const company of order) {
    const d = detail.get(company);
    const c = calc.get(company);
    if (d && c) sheets.push({ company, detail: d, calc: c });
    else if (c && !d) ctx.warnings.push({ level: 'warn', message: `找到“${c}”但没有对应的明细表，已忽略该公司` });
  }
  if (!sheets.length) {
    ctx.warnings.push({ level: 'error', message: '没有找到成对的「X明细」与「X提成计算」工作表（例如“三季度高科明细”“三季度高科提成计算”）' });
  }

  const orders: Order[] = [];
  const summaries: SummaryRow[] = [];
  const calcRows: CalcRow[] = [];
  const tierTables: TierTable[] = [];
  const completion: CompletionData[] = [];
  const costSources: CostSource[] = [];
  const calcTotalRows: ParsedWorkbook['calcTotalRows'] = [];
  const summaryTotalRows: ParsedWorkbook['summaryTotalRows'] = [];

  for (const s of sheets) {
    const dGrid = new SheetGrid(s.detail, wb.Sheets[s.detail], sheetHidden(wb, s.detail));
    parseDetail(dGrid, s.company, ctx, orders, summaries, summaryTotalRows);
    const cGrid = new SheetGrid(s.calc, wb.Sheets[s.calc], sheetHidden(wb, s.calc));
    parseCalc(cGrid, s.company, quarterLabel, ctx, calcRows, tierTables, completion, calcTotalRows);
    if (!orders.some((o) => o.company === s.company)) {
      ctx.warnings.push({ level: 'error', message: `${s.detail}：没有读到订单行（需要含“规格型号、合同数量、对接人/客户”的表头）`, loc: { sheet: s.detail, addr: 'A1' } });
    }
  }
  for (const name of costSheets) {
    parseCostSource(new SheetGrid(name, wb.Sheets[name], sheetHidden(wb, name)), costSources);
  }

  return {
    fileName,
    quarterLabel,
    companies: sheets.map((s) => s.company),
    sheets,
    orders,
    summaries,
    calcRows,
    standards: buildStandards(summaries, calcRows),
    tierTables,
    completion,
    costSources,
    warnings: ctx.warnings,
    rowRoles: ctx.rowRoles,
    calcTotalRows,
    summaryTotalRows,
  };
}
