// 计算：部门提成 = Σ(数量×单价) + Σ溢价，溢价 = (外贸均价 − 内贸均价) × 10% × 数量；
// 个人贡献按 人×月×型号 汇总；两种口径对比；原表 → 重算 → Σ个人 的差额拆解。
import { normCustomer, normText } from './text';
import { PREMIUM_RATE, type Order, type ParsedWorkbook, type PriceBasis, type QtyBasis, type RuleConfig, type Standard } from './types';

export interface Basis {
  qty: QtyBasis;
  price: PriceBasis;
}

export const QTY_LABEL: Record<QtyBasis, string> = {
  contract: '合同数量',
  shipped: '出库数量',
  shippedPaid: '出库且回款数量',
};
export const PRICE_LABEL: Record<PriceBasis, string> = {
  contract: '合同均价',
  shipped: '出库均价',
};

export function basisLabel(b: Basis): string {
  return `${QTY_LABEL[b.qty]} × ${PRICE_LABEL[b.price]}`;
}

export function basisShortLabel(b: Basis): string {
  if (b.qty === 'contract') return b.price === 'contract' ? '合同口径' : '合同数量·出库均价';
  if (b.qty === 'shipped') return b.price === 'contract' ? '出库口径' : '出库口径（出库均价）';
  return b.price === 'contract' ? '出库且回款口径' : '出库且回款口径（出库均价）';
}

/** 原表口径：数量取实发，均价取全部合同（含未发）的加权均价 */
export const ORIGINAL_BASIS: Basis = { qty: 'shipped', price: 'contract' };

export function primaryBasis(cfg: RuleConfig): Basis {
  return { qty: cfg.qtyBasis, price: cfg.priceBasis };
}

/** 对照口径：主口径按合同数量时对照出库数量，否则对照合同口径 */
export function comparisonBasis(cfg: RuleConfig): Basis {
  return cfg.qtyBasis === 'contract' ? { qty: 'shipped', price: cfg.priceBasis } : { qty: 'contract', price: 'contract' };
}

export interface CoefInfo {
  company: string;
  mode: RuleConfig['completion']['mode'];
  rate: number | null;
  rateSource: '配置' | '表内' | '无';
  /** 作用于“数量×单价”部分 */
  unit: number;
  /** 作用于溢价部分（溢价需达成目标时等于 unit，否则为 1） */
  premium: number;
  missing: boolean;
}

export function completionFactor(rate: number, full: number, floor: number): number {
  if (rate >= full) return 1;
  if (rate >= floor) return rate;
  return 0;
}

export function coefficients(pw: ParsedWorkbook, cfg: RuleConfig): Record<string, CoefInfo> {
  const out: Record<string, CoefInfo> = {};
  for (const company of pw.companies) {
    const mode = cfg.completion.mode;
    if (mode === 'none') {
      out[company] = { company, mode, rate: null, rateSource: '无', unit: 1, premium: 1, missing: false };
      continue;
    }
    const manual = cfg.completion.perCompany[company];
    const sheet = pw.completion.find((c) => c.company === company);
    const manualRate = mode === 'volume' ? manual?.volumeRate : manual?.amountRate;
    const sheetRate = mode === 'volume' ? sheet?.volumeRate : sheet?.amountRate;
    const rate = manualRate ?? sheetRate ?? null;
    const rateSource: CoefInfo['rateSource'] = manualRate != null ? '配置' : sheetRate != null ? '表内' : '无';
    const k = rate === null ? 1 : completionFactor(rate, cfg.completion.full, cfg.completion.floor);
    out[company] = { company, mode, rate, rateSource, unit: k, premium: cfg.premiumNeedsTarget ? k : 1, missing: rate === null };
  }
  return out;
}

export interface CalcSettings {
  basis: Basis;
  excluded: Set<string>;
  personMap: Map<string, string>;
  useSupplements: boolean;
  supplements: RuleConfig['supplements'];
  restrictToCalcModels: boolean;
}

export interface Line {
  company: string;
  month: number;
  model: string;
  modelKey: string;
  person: string | null;
  /** 并入前的原始对接人 */
  mergedFrom: string[];
  qty: number;
  contractQty: number;
  shippedQty: number;
  amountContract: number;
  amountShipped: number;
  avg: number | null;
  avgNote: string;
  domestic: number | null;
  domSource: '表内' | '补录' | '缺失';
  unitPrice: number | null;
  unitSource: '表内' | '补录' | '缺失';
  tier: string | null;
  /** 数量×单价；null = 单价待补 */
  unitComm: number | null;
  /** 溢价；null = 均价或内贸均价缺失 */
  premium: number | null;
  /** 已知部分之和（不含待补） */
  subtotal: number;
  orderKeys: string[];
  notes: string[];
  paidUnknown: number;
}

export function stdKey(company: string, month: number, modelKeyText: string): string {
  return `${company}|${month}|${modelKeyText}`;
}

export function indexStandards(pw: ParsedWorkbook): Map<string, Standard> {
  const m = new Map<string, Standard>();
  for (const s of pw.standards) m.set(stdKey(s.company, s.month, s.modelKey), s);
  return m;
}

export function buildPersonMap(merge: RuleConfig['personMerge']): Map<string, string> {
  const raw = new Map<string, string>();
  for (const { from, to } of merge) {
    const f = normText(from);
    const t = normText(to);
    if (f && t && f !== t) raw.set(f, t);
  }
  const resolved = new Map<string, string>();
  for (const f of raw.keys()) {
    let cur = f;
    const seen = new Set<string>([f]);
    while (raw.has(cur)) {
      const next = raw.get(cur)!;
      if (seen.has(next)) break;
      seen.add(next);
      cur = next;
    }
    resolved.set(f, cur);
  }
  return resolved;
}

export function excludedSet(cfg: RuleConfig): Set<string> {
  return new Set(cfg.relatedCustomers.map((c) => normCustomer(c)).filter(Boolean));
}

export function isExcluded(o: Order, excluded: Set<string>): boolean {
  return excluded.size > 0 && excluded.has(normCustomer(o.customer));
}

/** 回款数量：补录优先，其次表内回款列；都没有返回 null */
export function paidQtyOf(o: Order, supplements: RuleConfig['supplements']): number | null {
  const s = supplements.paid[o.key];
  if (s === true) return o.shipped;
  if (s === false) return 0;
  if (typeof s === 'number' && Number.isFinite(s)) return Math.max(0, Math.min(o.shipped, s));
  return o.paidQty;
}

export function qtyOf(o: Order, basis: QtyBasis, supplements: RuleConfig['supplements']): { qty: number; unknownPaid: boolean } {
  if (basis === 'contract') return { qty: o.contractQty, unknownPaid: false };
  if (basis === 'shipped') return { qty: o.shipped, unknownPaid: false };
  const p = paidQtyOf(o, supplements);
  if (p === null) return { qty: 0, unknownPaid: o.shipped > 0 };
  return { qty: p, unknownPaid: false };
}

export function computeLines(pw: ParsedWorkbook, settings: CalcSettings, level: 'dept' | 'person', stds = indexStandards(pw)): Line[] {
  const groups = new Map<string, { orders: Order[]; person: string | null; mergedFrom: Set<string> }>();
  for (const o of pw.orders) {
    if (isExcluded(o, settings.excluded)) continue;
    let person: string | null = null;
    if (level === 'person') {
      const raw = normText(o.person);
      person = settings.personMap.get(raw) ?? raw;
    }
    const k = `${o.company}|${o.month}|${person ?? ''}|${o.modelKey}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { orders: [], person, mergedFrom: new Set() }));
    g.orders.push(o);
    if (person !== null && normText(o.person) !== person) g.mergedFrom.add(normText(o.person));
  }

  const lines: Line[] = [];
  for (const g of groups.values()) {
    const first = g.orders[0];
    const sk = stdKey(first.company, first.month, first.modelKey);
    const std = stds.get(sk);
    if (settings.restrictToCalcModels && !std?.calc) continue;
    let contractQty = 0;
    let shippedQty = 0;
    let amountContract = 0;
    let amountShipped = 0;
    let qty = 0;
    let paidUnknown = 0;
    const notes = new Set<string>();
    for (const o of g.orders) {
      contractQty += o.contractQty;
      shippedQty += o.shipped;
      amountContract += o.contractQty * o.netPrice;
      amountShipped += o.shipped * o.netPrice;
      const q = qtyOf(o, settings.basis.qty, settings.supplements);
      qty += q.qty;
      if (q.unknownPaid) paidUnknown++;
      if (typeof o.unshippedRaw === 'string' && o.unshippedRaw) notes.add(o.unshippedRaw);
    }
    let avg: number | null = null;
    let avgNote = '';
    if (settings.basis.price === 'contract') {
      avg = contractQty > 0 ? amountContract / contractQty : null;
    } else if (shippedQty > 0) {
      avg = amountShipped / shippedQty;
    } else if (contractQty > 0) {
      avg = amountContract / contractQty;
      avgNote = '无出库，均价按合同均价';
    }
    const supUnit = settings.useSupplements ? settings.supplements.unitPrice[sk] : undefined;
    const supDom = settings.useSupplements ? settings.supplements.domesticAvg[sk] : undefined;
    const tableUnit = std?.unitPrice ?? null;
    const tableDom = std?.domesticAvg ?? null;
    const unitPrice = typeof supUnit === 'number' ? supUnit : tableUnit;
    const unitSource: Line['unitSource'] = typeof supUnit === 'number' ? '补录' : tableUnit !== null ? '表内' : '缺失';
    const domestic = typeof supDom === 'number' ? supDom : tableDom;
    const domSource: Line['domSource'] = typeof supDom === 'number' ? '补录' : tableDom !== null ? '表内' : '缺失';
    const unitComm = qty === 0 ? 0 : unitPrice === null ? null : qty * unitPrice;
    const premium = qty === 0 ? 0 : avg === null || domestic === null ? null : (avg - domestic) * PREMIUM_RATE * qty;
    if (paidUnknown) notes.add(`${paidUnknown} 笔出库缺回款信息，未计入`);
    lines.push({
      company: first.company,
      month: first.month,
      model: std?.calc?.model ?? std?.summary?.model ?? first.model,
      modelKey: first.modelKey,
      person: g.person,
      mergedFrom: [...g.mergedFrom],
      qty,
      contractQty,
      shippedQty,
      amountContract,
      amountShipped,
      avg,
      avgNote,
      domestic,
      domSource,
      unitPrice,
      unitSource,
      tier: std?.tier ?? null,
      unitComm,
      premium,
      subtotal: (unitComm ?? 0) + (premium ?? 0),
      orderKeys: g.orders.map((o) => o.key),
      notes: [...notes],
      paidUnknown,
    });
  }
  lines.sort(
    (a, b) =>
      pw.companies.indexOf(a.company) - pw.companies.indexOf(b.company) ||
      a.month - b.month ||
      (a.person ?? '').localeCompare(b.person ?? '', 'zh-CN') ||
      (a.model < b.model ? -1 : a.model > b.model ? 1 : 0),
  );
  return lines;
}

export interface Totals {
  qty: number;
  unitComm: number;
  premium: number;
  /** 系数前（已知部分） */
  raw: number;
  coefUnit: number;
  coefPremium: number;
  /** 系数后（已知部分） */
  final: number;
  pendingUnit: Line[];
  pendingPremium: Line[];
}

export function sumLines(lines: Line[], coef?: { unit: number; premium: number }): Totals {
  const cu = coef?.unit ?? 1;
  const cp = coef?.premium ?? 1;
  let qty = 0;
  let unitComm = 0;
  let premium = 0;
  const pendingUnit: Line[] = [];
  const pendingPremium: Line[] = [];
  for (const l of lines) {
    qty += l.qty;
    if (l.unitComm === null) pendingUnit.push(l);
    else unitComm += l.unitComm;
    if (l.premium === null) pendingPremium.push(l);
    else premium += l.premium;
  }
  return { qty, unitComm, premium, raw: unitComm + premium, coefUnit: cu, coefPremium: cp, final: unitComm * cu + premium * cp, pendingUnit, pendingPremium };
}

export function settingsFor(cfg: RuleConfig, basis: Basis, over: Partial<CalcSettings> = {}): CalcSettings {
  return {
    basis,
    excluded: excludedSet(cfg),
    personMap: buildPersonMap(cfg.personMerge),
    useSupplements: true,
    supplements: cfg.supplements,
    restrictToCalcModels: false,
    ...over,
  };
}

export interface BasisResult {
  basis: Basis;
  dept: Line[];
  person: Line[];
}

export function computeBasis(pw: ParsedWorkbook, cfg: RuleConfig, basis: Basis, stds = indexStandards(pw)): BasisResult {
  const s = settingsFor(cfg, basis);
  return { basis, dept: computeLines(pw, s, 'dept', stds), person: computeLines(pw, s, 'person', stds) };
}

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    let arr = m.get(k);
    if (!arr) m.set(k, (arr = []));
    arr.push(it);
  }
  return m;
}

export const cmKey = (company: string, month: number) => `${company}|${month}`;

// ───────────── 差额拆解 ─────────────

export interface WaterfallStep {
  key: string;
  label: string;
  explain: string;
  total: number;
  delta: number;
  byModel: { model: string; delta: number }[];
}

export interface WaterfallRow {
  company: string;
  month: number;
  steps: WaterfallStep[];
  /** 最终口径下仍待补的项目 */
  pending: string[];
}

function modelTotals(lines: Line[], coef?: { unit: number; premium: number }): Map<string, { model: string; v: number }> {
  const m = new Map<string, { model: string; v: number }>();
  for (const l of lines) {
    const cur = m.get(l.modelKey) ?? { model: l.model, v: 0 };
    cur.v += (l.unitComm ?? 0) * (coef?.unit ?? 1) + (l.premium ?? 0) * (coef?.premium ?? 1);
    m.set(l.modelKey, cur);
  }
  return m;
}

function diffModels(prev: Map<string, { model: string; v: number }>, next: Map<string, { model: string; v: number }>): { model: string; delta: number }[] {
  const keys = new Set([...prev.keys(), ...next.keys()]);
  const out: { model: string; delta: number }[] = [];
  for (const k of keys) {
    const d = (next.get(k)?.v ?? 0) - (prev.get(k)?.v ?? 0);
    if (Math.abs(d) > 0.005) out.push({ model: next.get(k)?.model ?? prev.get(k)?.model ?? k, delta: d });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function waterfall(pw: ParsedWorkbook, cfg: RuleConfig, coefs: Record<string, CoefInfo>, stds = indexStandards(pw)): WaterfallRow[] {
  const finalBasis = primaryBasis(cfg);
  const base: CalcSettings = {
    basis: ORIGINAL_BASIS,
    excluded: new Set(),
    personMap: new Map(),
    useSupplements: false,
    supplements: cfg.supplements,
    restrictToCalcModels: true,
  };
  const excluded = excludedSet(cfg);
  const variants: { key: string; label: string; explain: string; settings: CalcSettings; level: 'dept' | 'person'; coef: boolean }[] = [
    { key: 'resum', label: '按明细重算（原表口径）', explain: '用订单明细重算各型号实发数量与合同加权均价，单价、内贸均价沿用原表', settings: base, level: 'dept', coef: false },
    { key: 'missing', label: '补列漏项型号', explain: '有实发但未进提成计算表的型号：计入溢价，单价部分待补', settings: { ...base, restrictToCalcModels: false }, level: 'dept', coef: false },
    { key: 'exclude', label: '剔除关联公司', explain: '按“关联公司剔除名单”去掉相应订单', settings: { ...base, restrictToCalcModels: false, excluded }, level: 'dept', coef: false },
    { key: 'supplement', label: '补录单价/内贸均价', explain: '使用规则配置中补录的提成单价、内贸均价', settings: { ...base, restrictToCalcModels: false, excluded, useSupplements: true }, level: 'dept', coef: false },
    { key: 'qty', label: `数量口径 → ${QTY_LABEL[finalBasis.qty]}`, explain: '把数量口径从“出库数量”切换为规则配置中的口径', settings: { ...base, restrictToCalcModels: false, excluded, useSupplements: true, basis: { qty: finalBasis.qty, price: ORIGINAL_BASIS.price } }, level: 'dept', coef: false },
    { key: 'price', label: `均价口径 → ${PRICE_LABEL[finalBasis.price]}`, explain: '把外贸均价口径切换为规则配置中的口径', settings: { ...base, restrictToCalcModels: false, excluded, useSupplements: true, basis: finalBasis }, level: 'dept', coef: false },
    { key: 'coef', label: '完成系数', explain: '按季度完成率折算（数量×单价部分；溢价视“溢价需达成目标”而定）', settings: { ...base, restrictToCalcModels: false, excluded, useSupplements: true, basis: finalBasis }, level: 'dept', coef: true },
    {
      key: 'person',
      label: 'Σ个人贡献（均价结构差）',
      explain: '个人溢价用本人均价×本人数量，部门用部门均价×部门数量；数量与均价口径不一致时两者不相等',
      settings: { ...base, restrictToCalcModels: false, excluded, useSupplements: true, basis: finalBasis, personMap: buildPersonMap(cfg.personMerge) },
      level: 'person',
      coef: true,
    },
  ];
  const computed = variants.map((v) => ({ v, lines: computeLines(pw, v.settings, v.level, stds) }));

  const rows: WaterfallRow[] = [];
  const keys = new Set<string>();
  for (const c of pw.calcRows) keys.add(cmKey(c.company, c.month));
  for (const o of pw.orders) keys.add(cmKey(o.company, o.month));
  const sortedKeys = [...keys]
    .map((k) => {
      const [company, month] = k.split('|');
      return { company, month: Number(month) };
    })
    .sort((a, b) => pw.companies.indexOf(a.company) - pw.companies.indexOf(b.company) || a.month - b.month);

  for (const { company, month } of sortedKeys) {
    const calc = pw.calcRows.filter((r) => r.company === company && r.month === month);
    const steps: WaterfallStep[] = [];
    const origByModel = new Map<string, { model: string; v: number }>();
    const fixByModel = new Map<string, { model: string; v: number }>();
    let orig = 0;
    let fix = 0;
    for (const r of calc) {
      orig += r.total ?? 0;
      const f = (r.unitPrice ?? 0) * (r.qty ?? 0) + (r.premium ?? 0);
      fix += f;
      origByModel.set(r.modelKey, { model: r.model, v: (origByModel.get(r.modelKey)?.v ?? 0) + (r.total ?? 0) });
      fixByModel.set(r.modelKey, { model: r.model, v: (fixByModel.get(r.modelKey)?.v ?? 0) + f });
    }
    steps.push({ key: 'orig', label: '原表部门提成', explain: '提成计算表“提成合计”列（缓存值）之和', total: orig, delta: 0, byModel: [] });
    steps.push({ key: 'rowfix', label: '提成合计按本行重算', explain: '提成合计 = 本行提成单价 × 本行出库数量 + 本行溢价（修正引用错行等公式错误）', total: fix, delta: fix - orig, byModel: diffModels(origByModel, fixByModel) });
    let prevTotal = fix;
    let prevModels = fixByModel;
    const coef = coefs[company] ?? { unit: 1, premium: 1 };
    for (const { v, lines } of computed) {
      const own = lines.filter((l) => l.company === company && l.month === month);
      const t = sumLines(own, v.coef ? coef : undefined);
      const models = modelTotals(own, v.coef ? coef : undefined);
      steps.push({ key: v.key, label: v.label, explain: v.explain, total: t.final, delta: t.final - prevTotal, byModel: diffModels(prevModels, models) });
      prevTotal = t.final;
      prevModels = models;
    }
    const finalDept = computed.find((c) => c.v.key === 'coef')!.lines.filter((l) => l.company === company && l.month === month);
    const pending: string[] = [];
    for (const l of finalDept) {
      if (l.unitComm === null) pending.push(`${l.model} 单价待补（数量 ${l.qty.toFixed(2)}）`);
      if (l.premium === null) pending.push(`${l.model} 溢价无法计算（${l.domestic === null ? '缺内贸均价' : '缺外贸均价'}）`);
    }
    rows.push({ company, month, steps, pending });
  }
  return rows;
}
