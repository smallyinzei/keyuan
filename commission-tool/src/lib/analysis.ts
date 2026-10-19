// 汇总一次完整分析：两种口径、差额拆解、体检。
import {
  cmKey,
  coefficients,
  comparisonBasis,
  computeBasis,
  groupBy,
  indexStandards,
  primaryBasis,
  sumLines,
  waterfall,
  type BasisResult,
  type CoefInfo,
  type Line,
  type Totals,
  type WaterfallRow,
} from './calc';
import { runChecks } from './checks';
import type { Issue, ParsedWorkbook, RuleConfig } from './types';

export interface CmSummary {
  company: string;
  month: number;
  original: number | null;
  primary: Totals;
  comparison: Totals;
  personPrimary: Totals;
  personComparison: Totals;
}

export interface PersonBlock {
  person: string;
  company: string;
  month: number;
  lines: Line[];
  totals: Totals;
}

export interface Analysis {
  pw: ParsedWorkbook;
  cfg: RuleConfig;
  coefs: Record<string, CoefInfo>;
  primary: BasisResult;
  comparison: BasisResult;
  waterfall: WaterfallRow[];
  issues: Issue[];
  cm: CmSummary[];
  personBlocks: { primary: PersonBlock[]; comparison: PersonBlock[] };
  persons: string[];
}

/** 原表“提成合计”按公司×月汇总 */
export function originalTotals(pw: ParsedWorkbook): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of pw.calcRows) m.set(cmKey(r.company, r.month), (m.get(cmKey(r.company, r.month)) ?? 0) + (r.total ?? 0));
  return m;
}

function personBlocks(pw: ParsedWorkbook, lines: Line[], coefs: Record<string, CoefInfo>, personOrder: string[]): PersonBlock[] {
  const blocks: PersonBlock[] = [];
  for (const [, ls] of groupBy(lines, (l) => `${l.company}|${l.month}|${l.person}`)) {
    const l0 = ls[0];
    blocks.push({ person: l0.person ?? '', company: l0.company, month: l0.month, lines: ls, totals: sumLines(ls, coefs[l0.company]) });
  }
  return blocks.sort(
    (a, b) =>
      pw.companies.indexOf(a.company) - pw.companies.indexOf(b.company) ||
      a.month - b.month ||
      personOrder.indexOf(a.person) - personOrder.indexOf(b.person),
  );
}

export function analyze(pw: ParsedWorkbook, cfg: RuleConfig): Analysis {
  const stds = indexStandards(pw);
  const coefs = coefficients(pw, cfg);
  const primary = computeBasis(pw, cfg, primaryBasis(cfg), stds);
  const comparison = computeBasis(pw, cfg, comparisonBasis(cfg), stds);
  const orig = originalTotals(pw);

  const keys = new Map<string, { company: string; month: number }>();
  for (const l of [...primary.dept, ...comparison.dept]) keys.set(cmKey(l.company, l.month), { company: l.company, month: l.month });
  for (const r of pw.calcRows) keys.set(cmKey(r.company, r.month), { company: r.company, month: r.month });
  const by = (lines: Line[]) => groupBy(lines, (l) => cmKey(l.company, l.month));
  const pd = by(primary.dept);
  const cd = by(comparison.dept);
  const pp = by(primary.person);
  const cp = by(comparison.person);
  const cm: CmSummary[] = [...keys.values()]
    .sort((a, b) => pw.companies.indexOf(a.company) - pw.companies.indexOf(b.company) || a.month - b.month)
    .map(({ company, month }) => {
      const k = cmKey(company, month);
      return {
        company,
        month,
        original: orig.has(k) ? orig.get(k)! : null,
        primary: sumLines(pd.get(k) ?? [], coefs[company]),
        comparison: sumLines(cd.get(k) ?? [], coefs[company]),
        personPrimary: sumLines(pp.get(k) ?? [], coefs[company]),
        personComparison: sumLines(cp.get(k) ?? [], coefs[company]),
      };
    });

  // 人员顺序：按在明细中首次出现的先后（合并后的名字）
  const persons: string[] = [];
  for (const l of primary.person) if (l.person && !persons.includes(l.person)) persons.push(l.person);
  const firstSeen = new Map<string, number>();
  pw.orders.forEach((o, i) => {
    const p = primary.person.find((l) => l.orderKeys.includes(o.key))?.person;
    if (p && !firstSeen.has(p)) firstSeen.set(p, i);
  });
  persons.sort((a, b) => (firstSeen.get(a) ?? 0) - (firstSeen.get(b) ?? 0));

  return {
    pw,
    cfg,
    coefs,
    primary,
    comparison,
    waterfall: waterfall(pw, cfg, coefs, stds),
    issues: runChecks(pw, cfg),
    cm,
    personBlocks: { primary: personBlocks(pw, primary.person, coefs, persons), comparison: personBlocks(pw, comparison.person, coefs, persons) },
    persons,
  };
}

/** 待补单价清单（主口径与对照口径合并），供补录界面使用 */
export interface PendingItem {
  key: string;
  company: string;
  month: number;
  model: string;
  modelKey: string;
  primaryQty: number | null;
  comparisonQty: number | null;
  needUnit: boolean;
  needDomestic: boolean;
}

export function pendingItems(an: Analysis): PendingItem[] {
  const m = new Map<string, PendingItem>();
  const visit = (lines: Line[], which: 'primary' | 'comparison') => {
    for (const l of lines) {
      const needUnit = l.unitComm === null || l.unitSource === '补录';
      const needDomestic = (l.premium === null && l.domestic === null) || l.domSource === '补录';
      if (!needUnit && !needDomestic) continue;
      const key = `${l.company}|${l.month}|${l.modelKey}`;
      const cur = m.get(key) ?? { key, company: l.company, month: l.month, model: l.model, modelKey: l.modelKey, primaryQty: null, comparisonQty: null, needUnit: false, needDomestic: false };
      if (which === 'primary') cur.primaryQty = l.qty;
      else cur.comparisonQty = l.qty;
      cur.needUnit ||= needUnit;
      cur.needDomestic ||= needDomestic;
      m.set(key, cur);
    }
  };
  visit(an.primary.dept, 'primary');
  visit(an.comparison.dept, 'comparison');
  return [...m.values()].sort((a, b) => an.pw.companies.indexOf(a.company) - an.pw.companies.indexOf(b.company) || a.month - b.month || (a.model < b.model ? -1 : 1));
}
