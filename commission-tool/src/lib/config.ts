// 规则配置：默认值、JSON 导入校验、本地保存。
import { cleanMerges } from './calc';
import type { CompletionMode, PriceBasis, QtyBasis, RuleConfig } from './types';

export const STORAGE_KEY = 'commission-checker.rules.v1';

export function defaultConfig(): RuleConfig {
  return {
    schema: 'commission-checker/rules',
    version: 1,
    qtyBasis: 'shipped',
    priceBasis: 'contract',
    completion: { mode: 'none', full: 0.8, floor: 0.5, perCompany: {} },
    premiumNeedsTarget: false,
    personMerge: [],
    relatedCustomers: [],
    missingUnitPrice: 'pending',
    supplements: { unitPrice: {}, domesticAvg: {}, paid: {} },
  };
}

const QTY: QtyBasis[] = ['contract', 'shipped', 'shippedPaid'];
const PRICE: PriceBasis[] = ['contract', 'shipped'];
const MODES: CompletionMode[] = ['none', 'volume', 'amount'];

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** 补录数值：只收非负数，其余丢弃并记录 */
function numRecord(v: unknown, label: string, notes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const n = num(x);
      if (n !== null && n >= 0) out[k] = n;
      else notes.push(`补录${label}“${k}”的值 ${JSON.stringify(x)} 无效（应为非负数），已忽略`);
    }
  }
  return out;
}

/** 完成率：小数；大于 5 视为百分数自动换算，负数无效 */
function rateValue(v: unknown, where: string, notes: string[]): number | null {
  const n = num(v);
  if (n === null) {
    if (v !== null && v !== undefined) notes.push(`${where} 不是数字，已忽略`);
    return null;
  }
  if (n < 0) {
    notes.push(`${where} 为负数，已忽略`);
    return null;
  }
  if (n > 5) {
    notes.push(`${where} = ${n} 按百分数换算为 ${n / 100}`);
    return n / 100;
  }
  return n;
}

/** 校验并补全外部 JSON；返回配置与提示信息（未知字段忽略，非法值回退默认） */
export function normalizeConfig(input: unknown): { config: RuleConfig; notes: string[] } {
  const d = defaultConfig();
  const notes: string[] = [];
  if (!input || typeof input !== 'object') return { config: d, notes: ['不是有效的 JSON 对象，已使用默认规则'] };
  const o = input as Record<string, unknown>;
  if (o.schema !== undefined && o.schema !== d.schema) notes.push(`schema 为“${String(o.schema)}”，不是本工具导出的规则文件，已尽量读取`);

  if (QTY.includes(o.qtyBasis as QtyBasis)) d.qtyBasis = o.qtyBasis as QtyBasis;
  else if (o.qtyBasis !== undefined) notes.push(`qtyBasis“${String(o.qtyBasis)}”无效，使用默认“shipped”`);
  if (PRICE.includes(o.priceBasis as PriceBasis)) d.priceBasis = o.priceBasis as PriceBasis;
  else if (o.priceBasis !== undefined) notes.push(`priceBasis“${String(o.priceBasis)}”无效，使用默认“contract”`);

  const c = o.completion as Record<string, unknown> | undefined;
  if (c && typeof c === 'object') {
    if (MODES.includes(c.mode as CompletionMode)) d.completion.mode = c.mode as CompletionMode;
    else if (c.mode !== undefined) notes.push(`完成系数 mode“${String(c.mode)}”无效，使用“none”`);
    const full = num(c.full);
    const floor = num(c.floor);
    if (full !== null && full > 0 && full <= 2) d.completion.full = full;
    else if (c.full !== undefined) notes.push(`完成系数上限 ${String(c.full)} 无效（应在 0–2 之间的小数），使用 0.8`);
    if (floor !== null && floor >= 0 && floor <= d.completion.full) d.completion.floor = floor;
    else if (c.floor !== undefined) notes.push(`完成系数下限 ${String(c.floor)} 无效（应在 0 与上限之间），使用 0.5`);
    if (c.perCompany && typeof c.perCompany === 'object') {
      for (const [k, v] of Object.entries(c.perCompany as Record<string, unknown>)) {
        const x = (v ?? {}) as Record<string, unknown>;
        d.completion.perCompany[k] = { volumeRate: rateValue(x.volumeRate, `${k} 销量完成率`, notes), amountRate: rateValue(x.amountRate, `${k} 金额完成率`, notes) };
      }
    }
  }
  if (typeof o.premiumNeedsTarget === 'boolean') d.premiumNeedsTarget = o.premiumNeedsTarget;
  if (Array.isArray(o.personMerge)) {
    const list = o.personMerge
      .filter((x): x is { from: string; to: string } => !!x && typeof x === 'object' && typeof (x as { from?: unknown }).from === 'string' && typeof (x as { to?: unknown }).to === 'string')
      .map((x) => ({ from: x.from, to: x.to }));
    const { list: kept, dropped } = cleanMerges(list);
    d.personMerge = kept;
    if (dropped.length) notes.push(`人员合并中 ${dropped.map((m) => `${m.from}→${m.to}`).join('、')} 与后面的设置重复或形成循环，已忽略`);
  }
  if (Array.isArray(o.relatedCustomers)) d.relatedCustomers = o.relatedCustomers.filter((x): x is string => typeof x === 'string');
  if (o.missingUnitPrice !== undefined && o.missingUnitPrice !== 'pending') {
    notes.push('缺单价处理固定为“标记待补”，不允许按 0 计算');
  }
  const s = o.supplements as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    d.supplements.unitPrice = numRecord(s.unitPrice, '单价', notes);
    d.supplements.domesticAvg = numRecord(s.domesticAvg, '内贸均价', notes);
    if (s.paid && typeof s.paid === 'object') {
      for (const [k, v] of Object.entries(s.paid as Record<string, unknown>)) {
        if (typeof v === 'boolean') d.supplements.paid[k] = v;
        else if (num(v) !== null) d.supplements.paid[k] = v as number;
      }
    }
  }
  return { config: d, notes };
}

export function loadStoredConfig(): RuleConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeConfig(JSON.parse(raw)).config;
  } catch {
    return null;
  }
}

export function storeConfig(cfg: RuleConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // 隐私模式等无法写入时忽略；用户仍可导出 JSON
  }
}
