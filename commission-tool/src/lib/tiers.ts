// 档级表：区间文字解析、定档、边界重叠/空档检查。
import { normText, parseMonth, toNumber } from './text';
import { TIERS, type CalcRow, type Tier, type TierRange, type TierTable } from './types';

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const RANGE_RE = new RegExp(`^${NUM}\\s*(?:-|~|～|—|–|－|至|到)\\s*${NUM}$`);
const LT_RE = new RegExp(`^(?:<|≤|<=|小于|低于)\\s*(=)?\\s*${NUM}$`);
const GT_RE = new RegExp(`^(?:>|≥|>=|大于|高于)\\s*(=)?\\s*${NUM}$`);
const BELOW_RE = new RegExp(`^${NUM}\\s*(以下|以内)$`);
const ABOVE_RE = new RegExp(`^${NUM}\\s*(以上)$`);

export function parseRangeText(raw: unknown, tier: Tier, isFirst: boolean, isLast: boolean, addrText: string): TierRange | null {
  const base = { tier, raw: normText(raw), addr: addrText };
  if (raw === null || raw === undefined || normText(raw) === '') return null;
  const n = typeof raw === 'number' ? raw : toNumber(raw);
  if (n !== null) {
    if (isFirst) return { ...base, lo: null, hi: n, loInclusive: false, hiInclusive: false, formatNote: `只写了数字 ${n}，按“<${n}”理解` };
    if (isLast) return { ...base, lo: n, hi: null, loInclusive: false, hiInclusive: false, formatNote: `只写了数字 ${n}，按“>${n}”理解` };
    return { ...base, lo: n, hi: null, loInclusive: true, hiInclusive: false, formatNote: `只写了数字 ${n}，按下限理解` };
  }
  const t = normText(raw).replace(/\s+/g, '').replace(/＜/g, '<').replace(/＞/g, '>');
  let m = t.match(RANGE_RE);
  if (m) return { ...base, lo: Number(m[1]), hi: Number(m[2]), loInclusive: true, hiInclusive: true };
  m = t.match(LT_RE);
  if (m) return { ...base, lo: null, hi: Number(m[2]), loInclusive: false, hiInclusive: t.startsWith('≤') || t.startsWith('<=') };
  m = t.match(GT_RE);
  if (m) return { ...base, lo: Number(m[2]), hi: null, loInclusive: t.startsWith('≥') || t.startsWith('>='), hiInclusive: false };
  m = t.match(BELOW_RE);
  if (m) return { ...base, lo: null, hi: Number(m[1]), loInclusive: false, hiInclusive: true };
  m = t.match(ABOVE_RE);
  if (m) return { ...base, lo: Number(m[1]), hi: null, loInclusive: true, hiInclusive: false };
  return { ...base, lo: null, hi: null, loInclusive: false, hiInclusive: false, formatNote: `无法识别区间“${base.raw}”` };
}

export function parseTierRow(input: {
  company: string;
  label: string;
  sheet: string;
  row: number;
  cells: { tier: Tier; raw: unknown; addr: string }[];
  extras: string[];
}): TierTable {
  const { company, label, sheet, row, cells, extras } = input;
  const month = /原版|制度/.test(label) ? null : parseMonth(label);
  const nonEmpty = cells.filter((c) => normText(c.raw) !== '');
  const unmodified = nonEmpty.length > 0 && nonEmpty.length <= 2 && nonEmpty.every((c) => /未修正|不修正|同原版|沿用/.test(normText(c.raw)));
  const ranges: TierRange[] = [];
  if (!unmodified) {
    cells.forEach((c, i) => {
      const r = parseRangeText(c.raw, c.tier, i === 0, i === cells.length - 1, c.addr);
      if (r) ranges.push(r);
    });
  }
  const exceptions: string[] = [];
  for (const e of extras) {
    const m = normText(e).match(/^(.+?)(?:型号)?除外$/);
    if (m) exceptions.push(...m[1].split(/[、,，/\s]+/).filter(Boolean));
  }
  const table: TierTable = { company, month, label, unmodified, ranges, lowerBounds: {}, exceptions, sheet, row };
  table.lowerBounds = lowerBounds(table);
  return table;
}

/** 各档下限：C1 为 −∞；其余取本档下限，缺失时取上一档上限 */
export function lowerBounds(table: TierTable): Partial<Record<Tier, number>> {
  const out: Partial<Record<Tier, number>> = {};
  let prevHi: number | null = null;
  for (const t of TIERS) {
    const r = table.ranges.find((x) => x.tier === t);
    if (t === 'C1') out[t] = -Infinity;
    else if (r?.lo !== null && r?.lo !== undefined) out[t] = r.lo;
    else if (prevHi !== null) out[t] = prevHi;
    if (r?.hi !== null && r?.hi !== undefined) prevHi = r.hi;
  }
  return out;
}

function contains(r: TierRange, v: number): boolean {
  const okLo = r.lo === null || (r.loInclusive ? v >= r.lo : v > r.lo);
  const okHi = r.hi === null || (r.hiInclusive ? v <= r.hi : v < r.hi);
  return okLo && okHi && (r.lo !== null || r.hi !== null);
}

export interface TierLookup {
  tier: Tier | null;
  ambiguous: boolean;
  note: string;
}

/** 按区间定档；落在重叠边界时取较高档并标记歧义，落在空档时按“各档下限”取较低档并标记 */
export function tierOf(value: number, table: TierTable): TierLookup {
  const hits = table.ranges.filter((r) => contains(r, value));
  if (hits.length === 1) return { tier: hits[0].tier, ambiguous: false, note: '' };
  if (hits.length > 1) {
    const top = hits[hits.length - 1];
    return { tier: top.tier, ambiguous: true, note: `${value.toFixed(2)} 同时落在 ${hits.map((h) => `${h.tier}(${h.raw})`).join('、')}，按下限规则取 ${top.tier}` };
  }
  let tier: Tier | null = null;
  for (const t of TIERS) {
    const lb = table.lowerBounds[t];
    if (lb !== undefined && value >= lb) tier = t;
  }
  return { tier, ambiguous: true, note: `${value.toFixed(2)} 落在档级空档内，按下限规则取 ${tier ?? '无'}` };
}

/** 某公司某月适用的档级表：有当月修正（且不是“未修正”）用当月，否则用制度原版；例外型号用原版 */
export function tableFor(tables: TierTable[], company: string, month: number, model?: string): { table: TierTable | null; reason: string } {
  const own = tables.filter((t) => t.company === company);
  const base = own.find((t) => t.month === null) ?? null;
  const monthly = own.find((t) => t.month === month) ?? null;
  if (monthly && !monthly.unmodified && monthly.ranges.length) {
    if (model && monthly.exceptions.some((e) => model.toUpperCase().includes(e.toUpperCase()))) {
      return { table: base, reason: `${month}月修正表注明“${monthly.exceptions.join('、')}除外”，按制度原版` };
    }
    return { table: monthly, reason: `${monthly.label}` };
  }
  if (monthly?.unmodified) return { table: base, reason: `${month}月注明未修正，按制度原版` };
  return { table: base, reason: base ? '无当月修正，按制度原版' : '没有档级表' };
}

export interface BoundaryProblem {
  kind: 'overlap' | 'gap' | 'format' | 'order';
  tiers: [Tier, Tier] | [Tier];
  detail: string;
  /** 歧义区间 [from, to] */
  zone: [number, number] | null;
}

export function boundaryProblems(table: TierTable): BoundaryProblem[] {
  const out: BoundaryProblem[] = [];
  for (const r of table.ranges) {
    if (r.formatNote) out.push({ kind: 'format', tiers: [r.tier], detail: `${r.tier}（${r.addr}）${r.formatNote}`, zone: null });
    if (r.lo !== null && r.hi !== null && r.lo > r.hi) out.push({ kind: 'order', tiers: [r.tier], detail: `${r.tier} 区间“${r.raw}”下限大于上限`, zone: null });
  }
  for (let i = 0; i + 1 < table.ranges.length; i++) {
    const a = table.ranges[i];
    const b = table.ranges[i + 1];
    if (a.hi === null || b.lo === null) continue;
    if (b.lo < a.hi || (b.lo === a.hi && a.hiInclusive && b.loInclusive)) {
      out.push({
        kind: 'overlap',
        tiers: [a.tier, b.tier],
        detail: b.lo === a.hi ? `${a.tier}“${a.raw}”与 ${b.tier}“${b.raw}”共用边界 ${a.hi}` : `${a.tier}“${a.raw}”与 ${b.tier}“${b.raw}”在 ${b.lo}~${a.hi} 重叠`,
        zone: [b.lo, a.hi],
      });
    } else if (b.lo > a.hi || (b.lo === a.hi && !a.hiInclusive && !b.loInclusive)) {
      out.push({
        kind: 'gap',
        tiers: [a.tier, b.tier],
        detail: b.lo === a.hi ? `${a.tier}“${a.raw}”与 ${b.tier}“${b.raw}”都不含 ${a.hi}` : `${a.tier}“${a.raw}”与 ${b.tier}“${b.raw}”之间 ${a.hi}~${b.lo} 无归属`,
        zone: [a.hi, b.lo],
      });
    }
  }
  return out;
}

/** 由提成计算表推断“档级 → 单价”：同公司同月优先，其次同公司全季度；取出现最多的单价 */
export function inferTierPrice(rows: CalcRow[], company: string, month: number, tier: string, excludeRow?: CalcRow): number | null {
  const pick = (list: CalcRow[]) => {
    const counts = new Map<number, number>();
    for (const r of list) if (r.unitPrice !== null) counts.set(r.unitPrice, (counts.get(r.unitPrice) ?? 0) + 1);
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return null;
    if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
    return sorted[0][0];
  };
  const same = rows.filter((r) => r !== excludeRow && r.company === company && r.tier === tier);
  return pick(same.filter((r) => r.month === month)) ?? pick(same);
}
