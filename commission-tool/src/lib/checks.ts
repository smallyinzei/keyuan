// 体检：逐项核对原表，给出 严重度 / 位置 / 原值 / 应为 / 影响金额。
// 影响金额统一按“原表口径”（出库数量 × 合同均价）估算对部门提成的影响，正数表示应增加。
import {
  coefficients,
  comparisonBasis,
  computeLines,
  excludedSet,
  indexStandards,
  primaryBasis,
  settingsFor,
  stdKey,
  type Basis,
  type Line,
} from './calc';
import { plain, pct } from './format';
import { leadingConstant, parseRefs } from './sheet';
import { boundaryProblems, inferTierPrice, tableFor, tierOf } from './tiers';
import {
  RELATED_HINT_KEYWORDS,
  modelKey,
  monthFromContractNo,
  normCustomer,
  normText,
  sameCustomer,
} from './text';
import {
  PREMIUM_RATE,
  VAT_DIVISOR,
  type CalcField,
  type CalcRow,
  type Issue,
  type Order,
  type ParsedWorkbook,
  type RuleConfig,
  type Severity,
  type SummaryRow,
} from './types';

export const CATEGORY = {
  ref: '引用错行',
  formula: '公式重算',
  avg: '汇总均价',
  shipped: '汇总实发',
  unshipped: '未发数量',
  tier: '档级',
  tierPrice: '同档单价',
  note: '参考备注',
  boundary: '档级边界',
  missingModel: '漏列型号',
  missingPrice: '缺单价',
  cost: '变动成本',
  customer: '客户名归一',
  contract: '合同客户',
  contractMonth: '合同月份',
  basis: '口径',
  coef: '完成系数',
  related: '关联公司',
  parse: '解析',
} as const;

const SEV_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
export const SEV_LABEL: Record<Severity, string> = { high: '严重', medium: '警告', low: '提示' };

interface Group {
  company: string;
  month: number;
  modelKey: string;
  model: string;
  orders: Order[];
  contractQty: number;
  shipped: number;
  avgContract: number | null;
  avgShipped: number | null;
}

function groupOrders(orders: Order[]): Map<string, Group> {
  const m = new Map<string, Group>();
  for (const o of orders) {
    const k = stdKey(o.company, o.month, o.modelKey);
    let g = m.get(k);
    if (!g) {
      g = { company: o.company, month: o.month, modelKey: o.modelKey, model: o.model, orders: [], contractQty: 0, shipped: 0, avgContract: null, avgShipped: null };
      m.set(k, g);
    }
    g.orders.push(o);
  }
  for (const g of m.values()) {
    let cq = 0;
    let sq = 0;
    let ca = 0;
    let sa = 0;
    for (const o of g.orders) {
      cq += o.contractQty;
      sq += o.shipped;
      ca += o.contractQty * o.netPrice;
      sa += o.shipped * o.netPrice;
    }
    g.contractQty = cq;
    g.shipped = sq;
    g.avgContract = cq > 0 ? ca / cq : null;
    g.avgShipped = sq > 0 ? sa / sq : null;
  }
  return m;
}

const near = (a: number, b: number, tol = 0.005) => Math.abs(a - b) <= tol;
const loc = (sheet: string, col: string | undefined, row: number) => `${sheet}!${col ?? '?'}${row}`;

export function runChecks(pw: ParsedWorkbook, cfg: RuleConfig): Issue[] {
  const issues: Issue[] = [];
  let seq = 0;
  const add = (i: Omit<Issue, 'id' | 'impactNote' | 'suggestion'> & Partial<Pick<Issue, 'impactNote' | 'suggestion'>>) => {
    issues.push({ id: `${++seq}`, impactNote: '', suggestion: '', ...i });
  };

  const groups = groupOrders(pw.orders);
  const summaryIdx = new Map<string, SummaryRow>();
  for (const s of pw.summaries) summaryIdx.set(stdKey(s.company, s.month, s.modelKey), s);
  const calcIdx = new Map<string, CalcRow>();
  for (const c of pw.calcRows) calcIdx.set(stdKey(c.company, c.month, c.modelKey), c);

  // ── 解析阶段的问题 ──
  for (const w of pw.warnings) {
    add({
      severity: w.level === 'error' ? 'high' : w.level === 'warn' ? 'medium' : 'low',
      category: CATEGORY.parse,
      company: '',
      month: null,
      model: '',
      location: w.loc ? `${w.loc.sheet}!${w.loc.addr}` : '',
      original: '',
      expected: '',
      impact: null,
      message: w.message,
    });
  }

  // ── 1. 汇总块：重算外贸均价、实发数量、溢价 ──
  const shippedMismatch: { s: SummaryRow; g: Group }[] = [];
  for (const s of pw.summaries) {
    const g = groups.get(stdKey(s.company, s.month, s.modelKey));
    if (!g) {
      add({ severity: 'medium', category: CATEGORY.avg, company: s.company, month: s.month, model: s.model, location: loc(s.sheet, s.cols.model, s.row), original: s.model, expected: '明细中应有该型号订单', impact: null, message: `汇总块列了 ${s.model}，但本月明细没有该型号的订单` });
      continue;
    }
    const calc = calcIdx.get(stdKey(s.company, s.month, s.modelKey));
    const tableQty = s.shippedQty ?? g.shipped;
    if (g.avgContract !== null) {
      if (s.foreignAvg === null) {
        add({ severity: 'high', category: CATEGORY.avg, company: s.company, month: s.month, model: s.model, location: loc(s.sheet, s.cols.foreignAvg, s.row), original: '（空）', expected: plain(g.avgContract), impact: null, message: `${s.model} 外贸销售均价为空` });
      } else if (!near(s.foreignAvg, g.avgContract)) {
        const impact = (g.avgContract - s.foreignAvg) * PREMIUM_RATE * tableQty;
        const isShippedAvg = g.avgShipped !== null && near(s.foreignAvg, g.avgShipped);
        add({
          severity: Math.abs(impact) >= 1 ? 'high' : 'low',
          category: CATEGORY.avg,
          company: s.company,
          month: s.month,
          model: s.model,
          location: loc(s.sheet, s.cols.foreignAvg, s.row),
          original: plain(s.foreignAvg),
          expected: plain(g.avgContract),
          impact,
          message: `${s.model} 外贸销售均价与明细重算不一致：Σ(合同数量×出厂单价)/Σ合同数量 = ${plain(g.avgContract)}${isShippedAvg ? '（表内值等于出库加权均价，口径不同）' : ''}`,
          impactNote: `按表内实发 ${plain(tableQty, 4)} 吨计算溢价差`,
          suggestion: s.formulas.foreignAvg ? `核对公式 ${s.formulas.foreignAvg}` : '核对手填均价',
        });
      }
    }
    if (s.shippedQty === null) {
      if (g.shipped > 0) add({ severity: 'high', category: CATEGORY.shipped, company: s.company, month: s.month, model: s.model, location: loc(s.sheet, s.cols.shippedQty, s.row), original: '（空）', expected: plain(g.shipped, 4), impact: null, message: `${s.model} 实发数量为空` });
    } else if (!near(s.shippedQty, g.shipped, 1e-6)) {
      shippedMismatch.push({ s, g });
    }
    if (s.premium !== null && s.foreignAvg !== null && s.domesticAvg !== null && s.shippedQty !== null) {
      const exp = (s.foreignAvg - s.domesticAvg) * PREMIUM_RATE * s.shippedQty;
      if (!near(exp, s.premium, 0.01)) {
        add({ severity: 'high', category: CATEGORY.formula, company: s.company, month: s.month, model: s.model, location: loc(s.sheet, s.cols.premium, s.row), original: plain(s.premium), expected: plain(exp), impact: calc ? exp - s.premium : null, message: `${s.model} 溢价提成 ≠ (外贸均价 − 内贸均价) × 10% × 实发数量`, suggestion: s.formulas.premium ? `核对公式 ${s.formulas.premium}` : '' });
      }
    }
  }
  for (const { s, g } of shippedMismatch) {
    const calc = calcIdx.get(stdKey(s.company, s.month, s.modelKey));
    const dq = g.shipped - (s.shippedQty ?? 0);
    const avg = s.foreignAvg ?? g.avgContract;
    const premiumDelta = avg !== null && s.domesticAvg !== null ? (avg - s.domesticAvg) * PREMIUM_RATE * dq : null;
    const unitDelta = calc?.unitPrice != null ? calc.unitPrice * dq : null;
    const partner = shippedMismatch.find(
      (x) => x.s !== s && x.s.company === s.company && x.s.month === s.month && near(x.s.shippedQty ?? NaN, g.shipped, 1e-6) && near(s.shippedQty ?? NaN, x.g.shipped, 1e-6),
    );
    add({
      severity: 'high',
      category: CATEGORY.shipped,
      company: s.company,
      month: s.month,
      model: s.model,
      location: loc(s.sheet, s.cols.shippedQty, s.row),
      original: plain(s.shippedQty, 4),
      expected: plain(g.shipped, 4),
      impact: premiumDelta === null ? null : premiumDelta + (unitDelta ?? 0),
      message: `${s.model} 实发数量与明细“实际出库”合计不一致${partner ? `，与 ${partner.s.model} 的实发数量互换` : ''}`,
      impactNote:
        premiumDelta === null
          ? '缺均价或内贸均价，无法估算'
          : `溢价 ${plain(premiumDelta)}${unitDelta !== null ? `，数量×单价 ${plain(unitDelta)}` : '，单价部分待补'}`,
      suggestion: `明细 ${g.orders.map((o) => loc(o.sheet, o.cols.shipped, o.row)).join('、')} 合计 ${plain(g.shipped, 4)}`,
    });
  }

  // ── 2. 订单行：未发 = 合同 − 实发；实发不超过合同；合同号月份 ──
  for (const o of pw.orders) {
    const expected = o.contractQty - o.shipped;
    const where = loc(o.sheet, o.cols.unshipped, o.row);
    if (o.shipped > o.contractQty + 1e-6) {
      add({ severity: 'high', category: CATEGORY.unshipped, company: o.company, month: o.month, model: o.model, location: loc(o.sheet, o.cols.shipped, o.row), original: `实发 ${plain(o.shipped, 4)}`, expected: `≤ 合同 ${plain(o.contractQty, 4)}`, impact: null, message: `${o.model} 实际出库大于合同数量（合同 ${o.contractNo}）` });
    }
    if (typeof o.unshippedRaw === 'number') {
      if (!near(o.unshippedRaw, expected, 1e-6)) {
        add({ severity: 'medium', category: CATEGORY.unshipped, company: o.company, month: o.month, model: o.model, location: where, original: plain(o.unshippedRaw, 4), expected: plain(expected, 4), impact: 0, message: `${o.model} 未发数量 ≠ 合同数量 ${plain(o.contractQty, 4)} − 实际出库 ${plain(o.shipped, 4)}（合同 ${o.contractNo}）`, impactNote: '未发数量不参与计算；若是实发数量填错则会影响提成', suggestion: '核对实际出库与未发数量哪一个有误' });
      }
    } else if (typeof o.unshippedRaw === 'string') {
      if (/取消|作废/.test(o.unshippedRaw) && (o.contractQty !== 0 || o.shipped !== 0)) {
        add({ severity: 'medium', category: CATEGORY.unshipped, company: o.company, month: o.month, model: o.model, location: where, original: o.unshippedRaw, expected: '合同数量与实发应为 0', impact: null, message: `${o.model} 注明“${o.unshippedRaw}”，但合同数量 ${plain(o.contractQty, 4)}、实发 ${plain(o.shipped, 4)}` });
      }
    } else if (o.cols.unshipped && Math.abs(expected) > 1e-6) {
      add({ severity: 'low', category: CATEGORY.unshipped, company: o.company, month: o.month, model: o.model, location: where, original: '（空）', expected: plain(expected, 4), impact: 0, message: `${o.model} 有未发 ${plain(expected, 4)} 吨但未发数量未填（合同 ${o.contractNo}）` });
    }
    const cm = monthFromContractNo(o.contractNo);
    if (cm !== null && o.month && cm !== o.month) {
      add({ severity: 'low', category: CATEGORY.contractMonth, company: o.company, month: o.month, model: o.model, location: loc(o.sheet, o.cols.contractNo, o.row), original: `${o.contractNo}（${cm}月）`, expected: `${o.month}月`, impact: null, message: `合同号日期为 ${cm} 月，但订单放在 ${o.month} 月明细中`, suggestion: '确认是否放错月份块（跨月出库可忽略）' });
    }
  }

  // ── 3. 提成计算表：引用是否同一型号、公式重算 ──
  const refFlagged = new Set<string>();
  const crossFields: CalcField[] = ['qty', 'avgTax', 'premium'];
  const sameRowFields: CalcField[] = ['avgNet', 'margin', 'total'];
  const summaryFieldOf: Partial<Record<CalcField, 'shippedQty' | 'foreignAvg' | 'premium'>> = { qty: 'shippedQty', avgTax: 'foreignAvg', premium: 'premium' };
  const fieldName: Partial<Record<CalcField, string>> = { qty: '出库数量', avgTax: '出库均价（含税）', premium: '溢价提成', avgNet: '出库均价（不含税）', margin: '边际贡献', total: '提成合计', unitPrice: '提成单价', varCost: '变动成本' };
  for (const r of pw.calcRows) {
    const s = summaryIdx.get(stdKey(r.company, r.month, r.modelKey));
    for (const f of crossFields) {
      const fm = r.formulas[f];
      const col = r.cols[f];
      if (!col) continue;
      const sf = summaryFieldOf[f]!;
      const expectedVal = s ? s[sf] : null;
      if (fm) {
        for (const ref of parseRefs(fm)) {
          if (!ref.sheet || ref.sheet === r.sheet) continue;
          const role = pw.rowRoles[ref.sheet]?.[ref.row];
          if (!role) continue;
          if (role.modelKey !== r.modelKey || role.month !== r.month) {
            const cached = f === 'qty' ? r.qty : f === 'avgTax' ? r.avgTax : r.premium;
            let impact: number | null = null;
            if (expectedVal !== null && cached !== null) {
              if (f === 'qty') impact = (r.unitPrice ?? 0) * (expectedVal - cached);
              if (f === 'premium') impact = expectedVal - cached;
            }
            refFlagged.add(`${r.sheet}!${r.row}`);
            add({
              severity: 'high',
              category: CATEGORY.ref,
              company: r.company,
              month: r.month,
              model: r.model,
              location: loc(r.sheet, col, r.row),
              original: `${fm}（${role.month}月 ${role.model}）`,
              expected: s ? `=${s.sheet}!${s.cols[sf]}${s.row}（${r.month}月 ${r.model}）` : `引用 ${r.month}月 ${r.model} 的汇总行`,
              impact,
              message: `${fieldName[f]}引用了 ${role.month}月 ${role.model} 的行，本行是 ${r.month}月 ${r.model}`,
              impactNote: f === 'avgTax' ? '影响不含税均价、边际贡献与档级判定' : '',
            });
          }
        }
      } else if (expectedVal !== null) {
        const cached = f === 'qty' ? r.qty : f === 'avgTax' ? r.avgTax : r.premium;
        const others = pw.calcRows.filter((x) => x.sheet === r.sheet && x.formulas[f]);
        if (cached !== null && others.length >= 2) {
          const same = near(cached, expectedVal, f === 'qty' ? 1e-6 : 0.005);
          add({
            severity: same ? 'low' : 'high',
            category: same ? CATEGORY.formula : CATEGORY.ref,
            company: r.company,
            month: r.month,
            model: r.model,
            location: loc(r.sheet, col, r.row),
            original: `手填 ${plain(cached, 4)}`,
            expected: `=${s!.sheet}!${s!.cols[sf]}${s!.row}（${plain(expectedVal, 4)}）`,
            impact: same ? 0 : f === 'qty' ? (r.unitPrice ?? 0) * (expectedVal - cached) : f === 'premium' ? expectedVal - cached : null,
            message: same ? `${fieldName[f]}是手填数值，同列其他行引用明细；当前数值与明细一致` : `${fieldName[f]}手填数值与明细汇总不一致`,
            suggestion: '改为引用明细汇总单元格，避免明细修改后不同步',
          });
        }
      }
    }
    for (const f of sameRowFields) {
      const fm = r.formulas[f];
      if (!fm) continue;
      const wrong = parseRefs(fm).filter((ref) => (!ref.sheet || ref.sheet === r.sheet) && !ref.end && ref.row !== r.row);
      if (!wrong.length) continue;
      const roles = wrong.map((ref) => {
        const role = pw.rowRoles[r.sheet]?.[ref.row];
        return `${ref.col}${ref.row}${role ? `（${role.month}月 ${role.model}）` : ''}`;
      });
      const fixed = fm.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (all, d1, c, d2, rowNo, offset, str) => {
        const before = str[offset - 1];
        if (before === '!' || Number(rowNo) === r.row) return all;
        return wrong.some((w) => w.col === c && w.row === Number(rowNo)) ? `${d1}${c}${d2}${r.row}` : all;
      });
      let impact: number | null = null;
      if (f === 'total' && r.total !== null) impact = (r.unitPrice ?? 0) * (r.qty ?? 0) + (r.premium ?? 0) - r.total;
      refFlagged.add(`${r.sheet}!${r.row}`);
      add({
        severity: 'high',
        category: CATEGORY.ref,
        company: r.company,
        month: r.month,
        model: r.model,
        location: loc(r.sheet, r.cols[f], r.row),
        original: `${fm}（引用 ${roles.join('、')}）`,
        expected: fixed,
        impact,
        message: `${fieldName[f]}公式引用了其他行：${roles.join('、')}；本行是 ${r.month}月 ${r.model}`,
        impactNote: f === 'total' ? '提成合计 = 本行单价 × 本行出库数量 + 本行溢价' : '影响边际贡献与档级判定',
      });
    }
    // 公式数值重算
    if (r.total !== null && !refFlagged.has(`${r.sheet}!${r.row}`)) {
      const exp = (r.unitPrice ?? 0) * (r.qty ?? 0) + (r.premium ?? 0);
      if (!near(exp, r.total, 0.01)) {
        add({ severity: 'high', category: CATEGORY.formula, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.total, r.row), original: plain(r.total), expected: plain(exp), impact: exp - r.total, message: `${r.model} 提成合计 ≠ 提成单价 × 出库数量 + 溢价提成`, suggestion: r.formulas.total ? `核对公式 ${r.formulas.total}` : '' });
      }
    }
    if (r.avgTax !== null && r.avgNet !== null && !near(r.avgTax / VAT_DIVISOR, r.avgNet, 0.01)) {
      add({ severity: 'medium', category: CATEGORY.formula, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.avgNet, r.row), original: plain(r.avgNet), expected: plain(r.avgTax / VAT_DIVISOR), impact: null, message: `${r.model} 不含税均价 ≠ 含税均价 / 1.13`, impactNote: '影响边际贡献与档级' });
    }
    if (s && r.qty !== null && s.shippedQty !== null && !near(r.qty, s.shippedQty, 1e-6) && !refFlagged.has(`${r.sheet}!${r.row}`) && r.formulas.qty) {
      add({ severity: 'high', category: CATEGORY.formula, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.qty, r.row), original: plain(r.qty, 4), expected: plain(s.shippedQty, 4), impact: (r.unitPrice ?? 0) * (s.shippedQty - r.qty), message: `${r.model} 出库数量与明细汇总实发不一致` });
    }
  }

  // ── 4. 档级与档级表一致；边际贡献重算 ──
  const noCost: Map<string, CalcRow[]> = new Map();
  for (const r of pw.calcRows) {
    if (r.varCost === null) {
      if (r.unitPrice !== null) {
        const k = `${r.company}|${r.month}`;
        noCost.set(k, [...(noCost.get(k) ?? []), r]);
      }
      continue;
    }
    if (r.avgTax === null) continue;
    const net = r.avgNet ?? r.avgTax / VAT_DIVISOR;
    const margin = net - r.varCost;
    if (r.margin !== null && !near(r.margin, margin, 0.01)) {
      add({ severity: 'medium', category: CATEGORY.formula, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.margin, r.row), original: plain(r.margin), expected: plain(margin), impact: null, message: `${r.model} 边际贡献 ≠ 不含税均价 − 变动成本` });
    }
    const { table, reason } = tableFor(pw.tierTables, r.company, r.month, r.model);
    if (!table) {
      add({ severity: 'medium', category: CATEGORY.tier, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.tier, r.row), original: r.tier ?? '（空）', expected: '—', impact: null, message: `${r.company}提成计算表没有可用的档级表，无法核对档级` });
      continue;
    }
    const look = tierOf(margin, table);
    if (look.tier !== r.tier) {
      const newPrice = look.tier ? inferTierPrice(pw.calcRows, r.company, r.month, look.tier, r) : null;
      add({
        severity: 'high',
        category: CATEGORY.tier,
        company: r.company,
        month: r.month,
        model: r.model,
        location: loc(r.sheet, r.cols.tier, r.row),
        original: r.tier ?? '（空）',
        expected: look.tier ?? '无法定档',
        impact: newPrice !== null && r.unitPrice !== null && r.qty !== null ? (newPrice - r.unitPrice) * r.qty : null,
        message: `${r.model} 边际贡献 ${plain(margin)} 按「${table.label}」应为 ${look.tier ?? '—'}（${reason}）`,
        impactNote: newPrice !== null ? `按同公司 ${look.tier} 档单价 ${plain(newPrice)} 估算` : '该档在本公司无参考单价，无法估算',
      });
    } else if (look.ambiguous) {
      add({ severity: 'medium', category: CATEGORY.tier, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.margin, r.row), original: `${plain(margin)} → ${r.tier}`, expected: '边界需明确', impact: null, message: `${r.model} ${look.note}` });
    }
    if (r.tier && r.unitPrice === null) {
      add({ severity: 'high', category: CATEGORY.missingPrice, company: r.company, month: r.month, model: r.model, location: loc(r.sheet, r.cols.unitPrice, r.row), original: r.rawText.unitPrice ?? '（空）', expected: '补录提成单价', impact: null, message: `${r.model} 已定档 ${r.tier} 但提成单价为空`, impactNote: '待补' });
    }
  }
  for (const [k, rows] of noCost) {
    const [company, month] = k.split('|');
    add({ severity: 'low', category: CATEGORY.tier, company, month: Number(month), model: rows.map((r) => r.model).join('、'), location: rows.map((r) => loc(r.sheet, r.cols.varCost, r.row)).join('、'), original: rows.map((r) => `${r.model} 单价 ${plain(r.unitPrice)}`).join('；'), expected: '—', impact: null, message: '这些型号没有变动成本，未按档级表定档（单价为固定值），请确认制度依据' });
  }

  // ── 5. 同档单价一致 ──
  const byTier = new Map<string, CalcRow[]>();
  for (const r of pw.calcRows) {
    if (!r.tier || r.unitPrice === null) continue;
    const k = `${r.company}|${r.tier}`;
    byTier.set(k, [...(byTier.get(k) ?? []), r]);
  }
  for (const [k, rows] of byTier) {
    const prices = new Map<number, CalcRow[]>();
    for (const r of rows) prices.set(r.unitPrice!, [...(prices.get(r.unitPrice!) ?? []), r]);
    if (prices.size < 2) continue;
    const [company, tier] = k.split('|');
    const sorted = [...prices.entries()].sort((a, b) => b[1].length - a[1].length);
    const mode = sorted[0][1].length > sorted[1][1].length ? sorted[0][0] : null;
    const dist = sorted.map(([p, rs]) => `${plain(p)}：${rs.map((r) => `${r.month}月${r.model}`).join('、')}`).join('；');
    for (const r of rows) {
      if (mode !== null && r.unitPrice === mode) continue;
      add({
        severity: 'medium',
        category: CATEGORY.tierPrice,
        company,
        month: r.month,
        model: r.model,
        location: loc(r.sheet, r.cols.unitPrice, r.row),
        original: `${tier} 档单价 ${plain(r.unitPrice)}`,
        expected: mode !== null ? plain(mode) : `待确认（${[...prices.keys()].map((p) => plain(p)).join(' / ')}）`,
        impact: mode !== null && r.qty !== null ? (mode - r.unitPrice!) * r.qty : null,
        message: `${company} ${tier} 档出现不同单价（${dist}）`,
        impactNote: mode !== null ? `按多数单价 ${plain(mode)} 估算` : '无多数值，无法估算',
        suggestion: '若该型号适用单独单价表可忽略；否则按制度单价表统一',
      });
    }
  }

  // ── 6. “参考某型号”备注与数值一致 ──
  for (const s of pw.summaries) {
    const m = normText(s.note).match(/参考\s*([A-Za-z0-9][A-Za-z0-9\- ]*)/);
    if (!m || s.domesticAvg === null) continue;
    const token = modelKey(m[1]);
    const sameMonth = pw.summaries.filter((x) => x.company === s.company && x.month === s.month && x !== s);
    const ref = sameMonth.find((x) => x.modelKey === token) ?? sameMonth.find((x) => x.modelKey.endsWith(token));
    const where = loc(s.sheet, s.cols.domesticAvg, s.row);
    if (!ref) {
      add({ severity: 'medium', category: CATEGORY.note, company: s.company, month: s.month, model: s.model, location: where, original: `备注“${s.note}”`, expected: '—', impact: null, message: `备注参考的型号“${m[1]}”在 ${s.month} 月汇总中找不到，无法核对内贸均价` });
      continue;
    }
    if (ref.domesticAvg === null || near(ref.domesticAvg, s.domesticAvg)) continue;
    const g = groups.get(stdKey(s.company, s.month, s.modelKey));
    const q = s.shippedQty ?? g?.shipped ?? 0;
    const impact = (s.domesticAvg - ref.domesticAvg) * PREMIUM_RATE * q;
    const contractImpact = g ? (s.domesticAvg - ref.domesticAvg) * PREMIUM_RATE * g.contractQty : null;
    const actual = sameMonth.find((x) => x !== ref && x.domesticAvg !== null && near(x.domesticAvg, s.domesticAvg!, 1e-6));
    add({
      severity: Math.abs(impact) >= 1 || Math.abs(contractImpact ?? 0) >= 1 ? 'medium' : 'low',
      category: CATEGORY.note,
      company: s.company,
      month: s.month,
      model: s.model,
      location: where,
      original: `${plain(s.domesticAvg)}（备注：${s.note}）`,
      expected: `${plain(ref.domesticAvg)}（${ref.model} 的内贸均价，${loc(ref.sheet, ref.cols.domesticAvg, ref.row)}）`,
      impact,
      message: `${s.model} 备注参考 ${ref.model}，但内贸均价与 ${ref.model} 不同${actual ? `；该数值实际等于 ${actual.model} 的内贸均价` : ''}`,
      impactNote: `按实发 ${plain(q, 4)} 吨${contractImpact !== null && !near(contractImpact, impact, 0.005) ? `；合同口径（${plain(g!.contractQty, 4)} 吨）影响 ${plain(contractImpact)}` : ''}`,
      suggestion: '确认参考型号后统一数值或修改备注',
    });
  }

  // ── 7. 档级边界重叠/空档 ──
  for (const t of pw.tierTables) {
    if (t.unmodified) continue;
    const probs = boundaryProblems(t);
    if (!probs.length) continue;
    const users = pw.calcRows.filter((r) => r.company === t.company && r.varCost !== null && r.avgTax !== null && tableFor(pw.tierTables, r.company, r.month, r.model).table === t);
    const hitRows = users.filter((r) => {
      const margin = (r.avgNet ?? r.avgTax! / VAT_DIVISOR) - r.varCost!;
      return probs.some((p) => p.zone && margin >= p.zone[0] && margin <= p.zone[1]);
    });
    add({
      severity: hitRows.length ? 'medium' : 'low',
      category: CATEGORY.boundary,
      company: t.company,
      month: t.month,
      model: hitRows.map((r) => r.model).join('、'),
      location: `${t.sheet}!${t.ranges[0]?.addr ?? ''}:${t.ranges[t.ranges.length - 1]?.addr ?? ''}（第 ${t.row} 行）`,
      original: probs.map((p) => p.detail).join('；'),
      expected: '相邻档首尾相接，不重叠、不留空（建议统一写成“含下限、不含上限”）',
      impact: hitRows.length ? null : 0,
      message: `档级表「${t.label}」边界${probs.some((p) => p.kind === 'overlap') ? '重叠' : ''}${probs.some((p) => p.kind === 'gap') ? '有空档' : ''}${probs.some((p) => p.kind === 'format') ? '格式不规范' : ''}${hitRows.length ? `，${hitRows.map((r) => r.model).join('、')} 的边际贡献落在歧义区` : '，本季度没有型号落在歧义区'}`,
    });
  }

  // ── 8. 有实发但未进提成表；提成表有但明细无 ──
  for (const g of groups.values()) {
    const k = stdKey(g.company, g.month, g.modelKey);
    const calc = calcIdx.get(k);
    const s = summaryIdx.get(k);
    if (!s) {
      add({ severity: 'high', category: CATEGORY.missingModel, company: g.company, month: g.month, model: g.model, location: g.orders.map((o) => loc(o.sheet, o.cols.model, o.row)).join('、'), original: '汇总块无该型号', expected: '补列汇总行（外贸均价、内贸均价、实发）', impact: null, message: `${g.month}月 ${g.model} 有 ${g.orders.length} 笔订单（合同 ${plain(g.contractQty, 4)} 吨、实发 ${plain(g.shipped, 4)} 吨），汇总块漏列`, impactNote: '缺内贸均价，溢价无法计算' });
    }
    if (!calc && g.shipped > 1e-9) {
      const prem = s?.domesticAvg != null && g.avgContract !== null ? (g.avgContract - s.domesticAvg) * PREMIUM_RATE * g.shipped : null;
      add({
        severity: 'high',
        category: CATEGORY.missingModel,
        company: g.company,
        month: g.month,
        model: g.model,
        location: s ? loc(s.sheet, s.cols.model, s.row) : loc(g.orders[0].sheet, g.orders[0].cols.model, g.orders[0].row),
        original: '未列入提成计算表',
        expected: `补列：实发 ${plain(g.shipped, 4)} 吨`,
        impact: prem,
        message: `${g.month}月 ${g.model} 有实发 ${plain(g.shipped, 4)} 吨，但提成计算表没有该型号`,
        impactNote: prem === null ? '缺内贸均价，无法估算' : `仅溢价部分；数量×单价部分待补（${plain(g.shipped, 4)} 吨 × 单价）`,
      });
    }
  }
  for (const c of pw.calcRows) {
    if (!groups.has(stdKey(c.company, c.month, c.modelKey))) {
      add({ severity: 'medium', category: CATEGORY.missingModel, company: c.company, month: c.month, model: c.model, location: loc(c.sheet, c.cols.model, c.row), original: c.model, expected: '明细中应有该型号订单', impact: null, message: `提成计算表 ${c.month}月 列了 ${c.model}，但明细没有该型号订单` });
    }
  }

  // ── 9. 缺单价（主口径与对照口径；不按 0 计算） ──
  const stds = indexStandards(pw);
  const bases: { b: Basis; primary: boolean }[] = [
    { b: primaryBasis(cfg), primary: true },
    { b: comparisonBasis(cfg), primary: false },
  ];
  const pendingMap = new Map<string, { line: Line; primaryQty: number | null; compQty: number | null }>();
  for (const { b, primary } of bases) {
    const lines = computeLines(pw, settingsFor(cfg, b), 'dept', stds);
    for (const l of lines) {
      if (l.unitComm !== null) continue;
      const k = stdKey(l.company, l.month, l.modelKey);
      const cur = pendingMap.get(k) ?? { line: l, primaryQty: null, compQty: null };
      if (primary) cur.primaryQty = l.qty;
      else cur.compQty = l.qty;
      pendingMap.set(k, cur);
    }
  }
  for (const [k, p] of pendingMap) {
    const s = summaryIdx.get(k);
    const l = p.line;
    const qtyText = [p.primaryQty !== null ? `主口径 ${plain(p.primaryQty, 4)} 吨` : '', p.compQty !== null ? `对照口径 ${plain(p.compQty, 4)} 吨` : ''].filter(Boolean).join('，');
    add({
      severity: p.primaryQty !== null ? 'high' : 'medium',
      category: CATEGORY.missingPrice,
      company: l.company,
      month: l.month,
      model: l.model,
      location: s ? loc(s.sheet, s.cols.model, s.row) : '',
      original: '无提成单价',
      expected: '补录提成单价（规则配置 → 待补单价）',
      impact: null,
      message: `${l.month}月 ${l.model} 计提数量 ${qtyText}，提成计算表没有单价，标记待补，不按 0 计算`,
      impactNote: '待补',
    });
  }

  // ── 10. 变动成本：与源表核对、同月不同型号成本相同 ──
  const costFlagged = new Set<CalcRow>();
  const baseOf = (r: CalcRow) => leadingConstant(r.formulas.varCost) ?? r.varCost!;
  for (const r of pw.calcRows) {
    if (r.varCost === null) continue;
    const srcs = pw.costSources.filter((c) => c.month === r.month);
    const own = srcs.find((c) => c.modelKey === r.modelKey);
    if (!own) continue;
    const base = baseOf(r);
    if (near(base, own.varCost, 0.005)) continue;
    // 只在能证明本公司成本取自该源表时才判定（基数等于源表某型号成本，或同月其他型号与源表一致），避免跨公司同名型号误报
    const usesSource =
      srcs.some((c) => near(c.varCost, base, 0.005)) ||
      pw.calcRows.some((x) => x !== r && x.company === r.company && x.month === r.month && x.varCost !== null && srcs.some((c) => c.modelKey === x.modelKey && near(c.varCost, baseOf(x), 0.005)));
    if (!usesSource) continue;
    const adj = r.varCost - base;
    const expected = own.varCost + adj;
    const copied = srcs.find((c) => c !== own && near(c.varCost, base, 0.005));
    let impact: number | null = null;
    let impactNote = '';
    if (r.avgTax !== null) {
      const margin = (r.avgNet ?? r.avgTax / VAT_DIVISOR) - expected;
      const { table } = tableFor(pw.tierTables, r.company, r.month, r.model);
      if (table) {
        const look = tierOf(margin, table);
        const price = look.tier ? (look.tier === r.tier ? r.unitPrice : inferTierPrice(pw.calcRows, r.company, r.month, look.tier, r)) : null;
        if (price !== null && r.unitPrice !== null && r.qty !== null) {
          impact = (price - r.unitPrice) * r.qty;
          impactNote = `更正后边际贡献 ${plain(margin)} → ${look.tier}（原 ${r.tier ?? '—'}），单价 ${plain(price)}`;
        } else impactNote = `更正后边际贡献 ${plain(margin)} → ${look.tier ?? '—'}，单价无法推断`;
      }
    }
    costFlagged.add(r);
    add({
      severity: 'high',
      category: CATEGORY.cost,
      company: r.company,
      month: r.month,
      model: r.model,
      location: loc(r.sheet, r.cols.varCost, r.row),
      original: `${plain(r.varCost)}${r.formulas.varCost ? `（${r.formulas.varCost}）` : ''}`,
      expected: plain(expected),
      impact,
      impactNote,
      message: `${r.model} 变动成本${copied ? `与 ${copied.model} 相同：公式基数 ${plain(base)} 是 ${copied.model} 在「${copied.sheet}」的成本（${copied.addr}）` : `基数 ${plain(base)} 与源表不一致`}；${r.model} 在「${own.sheet}」的成本为 ${plain(own.varCost)}（${own.addr}）`,
      suggestion: adj !== 0 ? `按同月统一调整（${plain(adj)}）更正为 ${plain(own.varCost)} ${adj < 0 ? '−' : '+'} ${plain(Math.abs(adj))}` : `更正为 ${plain(own.varCost)}`,
    });
  }
  const byCm = new Map<string, CalcRow[]>();
  for (const r of pw.calcRows) {
    if (r.varCost === null) continue;
    const k = `${r.company}|${r.month}`;
    byCm.set(k, [...(byCm.get(k) ?? []), r]);
  }
  for (const rows of byCm.values()) {
    const seen = new Map<string, CalcRow[]>();
    for (const r of rows) {
      const k = r.varCost!.toFixed(6);
      seen.set(k, [...(seen.get(k) ?? []), r]);
    }
    for (const same of seen.values()) {
      const models = new Set(same.map((r) => r.modelKey));
      if (models.size < 2) continue;
      if (models.size >= 3 && !same.some((r) => costFlagged.has(r))) {
        // 三个及以上型号同成本，多为按品类核算，仅提示
        const r0 = same[0];
        add({
          severity: 'low',
          category: CATEGORY.cost,
          company: r0.company,
          month: r0.month,
          model: same.map((r) => r.model).join('、'),
          location: same.map((r) => loc(r.sheet, r.cols.varCost, r.row)).join('、'),
          original: `${same.length} 个型号均为 ${plain(r0.varCost)}`,
          expected: '确认是否按品类统一核算',
          impact: null,
          message: `${r0.month}月 ${same.length} 个型号变动成本完全相同，可能按品类核算，请与财务确认`,
        });
        continue;
      }
      // 已由源表核对确认的行不再重复报告
      if (same.some((r) => costFlagged.has(r))) continue;
      for (const r of same.slice(1)) {
        const first = same[0];
        add({
          severity: 'medium',
          category: CATEGORY.cost,
          company: r.company,
          month: r.month,
          model: r.model,
          location: `${loc(r.sheet, r.cols.varCost, r.row)}、${loc(first.sheet, first.cols.varCost, first.row)}`,
          original: `${r.model} ${plain(r.varCost)} = ${first.model} ${plain(first.varCost)}`,
          expected: '各型号按财务结转成本分别填列',
          impact: null,
          message: `${r.month}月 ${r.model} 的变动成本与 ${first.model} 完全相同${r.formulas.varCost && r.formulas.varCost === first.formulas.varCost ? '（公式相同）' : ''}，疑似复制`,
          impactNote: '影响档级与单价，需财务确认（工作簿中没有该月成本源表可核对）',
        });
      }
    }
  }

  // ── 11. 客户名归一；同一合同号客户一致 ──
  const variants = new Map<string, { raw: string; key: string; orders: Order[] }>();
  for (const o of pw.orders) {
    if (!o.customer) continue;
    const v = variants.get(o.customer) ?? { raw: o.customer, key: normCustomer(o.customer), orders: [] };
    v.orders.push(o);
    variants.set(o.customer, v);
  }
  const list = [...variants.values()];
  const parent = list.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (sameCustomer(list[i].key, list[j].key)) parent[find(i)] = find(j);
    }
  }
  const clusters = new Map<number, typeof list>();
  list.forEach((v, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), v]));
  const excluded = excludedSet(cfg);
  for (const cl of clusters.values()) {
    if (cl.length < 2) continue;
    const sorted = [...cl].sort((a, b) => b.orders.length - a.orders.length);
    const canonical = sorted[0].raw;
    const partial = cl.some((v) => excluded.has(v.key)) && !cl.every((v) => excluded.has(v.key));
    add({
      severity: partial ? 'medium' : 'low',
      category: CATEGORY.customer,
      company: [...new Set(cl.flatMap((v) => v.orders.map((o) => o.company)))].join('、'),
      month: null,
      model: '',
      location: cl.map((v) => loc(v.orders[0].sheet, v.orders[0].cols.customer, v.orders[0].row)).join('、'),
      original: sorted.map((v) => `“${v.raw}”×${v.orders.length}`).join('、'),
      expected: `统一为“${canonical}”`,
      impact: 0,
      message: `同一客户存在 ${cl.length} 种写法${partial ? '；关联公司剔除名单只覆盖了其中部分写法' : ''}`,
      impactNote: partial ? '剔除名单按归一后名称匹配，部分写法可能漏剔除' : '不影响金额，影响按客户统计与新客户认定',
    });
  }
  const byContract = new Map<string, Order[]>();
  for (const o of pw.orders) {
    const k = normText(o.contractNo).toUpperCase().replace(/\s+/g, '');
    if (!k) continue;
    byContract.set(k, [...(byContract.get(k) ?? []), o]);
  }
  for (const orders of byContract.values()) {
    const names = [...new Set(orders.map((o) => o.customer))];
    if (names.length < 2) continue;
    const keys = names.map(normCustomer);
    const allSame = keys.every((k) => sameCustomer(k, keys[0]));
    const counts = names.map((n) => ({ n, c: orders.filter((o) => o.customer === n).length })).sort((a, b) => b.c - a.c);
    add({
      severity: allSame ? 'low' : 'medium',
      category: CATEGORY.contract,
      company: orders[0].company,
      month: orders[0].month,
      model: [...new Set(orders.map((o) => o.model))].join('、'),
      location: orders.map((o) => loc(o.sheet, o.cols.customer, o.row)).join('、'),
      original: counts.map((x) => `“${x.n}”`).join(' / '),
      expected: `“${counts[0].n}”`,
      impact: 0,
      message: `合同 ${orders[0].contractNo} 各行客户名不一致${allSame ? '（拼写差异）' : '（疑似不同客户，请核对合同）'}`,
    });
  }

  // ── 12. 疑似关联公司 ──
  for (const v of list) {
    if (excluded.has(v.key)) continue;
    const hit = RELATED_HINT_KEYWORDS.find((k) => v.key.includes(k));
    if (!hit) continue;
    add({ severity: 'medium', category: CATEGORY.related, company: v.orders[0].company, month: null, model: '', location: loc(v.orders[0].sheet, v.orders[0].cols.customer, v.orders[0].row), original: v.raw, expected: '确认是否关联公司', impact: null, message: `客户名含“${hit}”，疑似集团关联公司，出库量应剔除`, suggestion: '如是关联公司，加入规则配置的“关联公司剔除名单”' });
  }

  // ── 13. 口径：合同均价含未发合同 ──
  for (const company of pw.companies) {
    let diff = 0;
    const models: string[] = [];
    for (const g of groups.values()) {
      if (g.company !== company || g.avgContract === null || g.avgShipped === null) continue;
      const s = summaryIdx.get(stdKey(g.company, g.month, g.modelKey));
      if (!s || s.domesticAvg === null || near(g.avgContract, g.avgShipped, 0.005)) continue;
      diff += (g.avgShipped - g.avgContract) * PREMIUM_RATE * g.shipped;
      models.push(`${g.month}月${g.model}`);
    }
    if (!models.length) continue;
    add({
      severity: 'low',
      category: CATEGORY.basis,
      company,
      month: null,
      model: models.join('、'),
      location: '',
      original: '外贸均价按全部合同（含未发）加权，数量按实发',
      expected: '数量与均价口径一致（规则配置可切换）',
      impact: diff,
      message: `${models.length} 个型号的合同均价 ≠ 出库均价，原表口径混用`,
      impactNote: '若均价改按出库加权（数量仍按实发），部门溢价的变化',
    });
  }

  // ── 14. 完成系数 ──
  const coefs = coefficients(pw, cfg);
  for (const company of pw.companies) {
    const c = coefs[company];
    const sheet = pw.completion.find((x) => x.company === company);
    if (cfg.completion.mode !== 'none' && c.missing) {
      add({ severity: 'medium', category: CATEGORY.coef, company, month: null, model: '', location: '', original: '无完成率', expected: '在规则配置中填写完成率', impact: null, message: `已启用“${cfg.completion.mode === 'volume' ? '按销量' : '按金额'}”完成系数，但 ${company} 没有完成率数据，暂按 1 计算` });
    }
    if (cfg.completion.mode === 'none' && sheet && (sheet.volumeRate !== null || sheet.amountRate !== null)) {
      add({ severity: 'low', category: CATEGORY.coef, company, month: null, model: '', location: sheet.source, original: `销量完成率 ${pct(sheet.volumeRate)}，金额完成率 ${pct(sheet.amountRate)}`, expected: '—', impact: null, message: `${company}提成计算表有季度完成率数据，但当前规则未启用完成系数（原表“完成系数”列为空）` });
    }
  }

  return issues.sort(
    (a, b) =>
      SEV_RANK[a.severity] - SEV_RANK[b.severity] ||
      Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0) ||
      pw.companies.indexOf(a.company) - pw.companies.indexOf(b.company) ||
      (a.month ?? 0) - (b.month ?? 0),
  ).map((i, n) => ({ ...i, id: String(n + 1) }));
}
