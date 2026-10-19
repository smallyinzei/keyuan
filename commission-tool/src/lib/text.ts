// 文本归一：表头、月份、型号、客户名。

const CN_DIGITS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

const CN_MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

/** 任意值 → 去首尾空白、全角转半角、合并空白后的字符串 */
export function normText(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** 表头归一：全角转半角、去掉所有空白、英文大写 */
export function normHeader(v: unknown): string {
  return normText(v).replace(/\s+/g, '').toUpperCase();
}

/** 型号归一键：大写、去空格（“AB 900” 与 “AB900” 视为同一型号） */
export function modelKey(model: string): string {
  return normText(model).toUpperCase().replace(/\s+/g, '');
}

/** 一 ~ 九十九 */
export function parseCnInt(s: string): number | null {
  if (!s) return null;
  if (s === '十') return 10;
  const ten = s.indexOf('十');
  if (ten < 0) {
    if (s.length !== 1) return null;
    return CN_DIGITS[s] ?? null;
  }
  const head = s.slice(0, ten);
  const tail = s.slice(ten + 1);
  const tens = head === '' ? 1 : CN_DIGITS[head];
  const ones = tail === '' ? 0 : CN_DIGITS[tail];
  if (tens === undefined || ones === undefined || head.length > 1 || tail.length > 1) return null;
  return tens * 10 + ones;
}

/** 从文字中取月份：“生物七月”→7，“7月按实际产量…”→7，“九月”→9 */
export function parseMonth(v: unknown): number | null {
  const t = normText(v);
  let m = t.match(/(?:^|[^\d])(\d{1,2})\s*月/);
  if (m) {
    const n = Number(m[1]);
    return n >= 1 && n <= 12 ? n : null;
  }
  m = t.match(/([一二三四五六七八九十]{1,3})\s*月/);
  if (m) {
    const n = parseCnInt(m[1]);
    return n !== null && n >= 1 && n <= 12 ? n : null;
  }
  return null;
}

/** 是否为月份标题行文字，如“高科七月”“生物八月”“2026年7月”；“七月溢价提成合计”不是 */
export function isMonthTitle(v: unknown): boolean {
  const t = normText(v).replace(/\s+/g, '');
  if (!t || t.length > 24) return false;
  if (/合计|提成|均价|单价|数量|边际|修正|计划|完成/.test(t)) return false;
  return /([一二三四五六七八九十]{1,3}|\d{1,2})月份?$/.test(t) && parseMonth(t) !== null;
}

export function cnMonth(m: number): string {
  return `${CN_MONTHS[m - 1] ?? m}月`;
}

/** 从合同号中取月份，如 ABC-20260706-030 → 7 */
export function monthFromContractNo(no: string): number | null {
  const m = normText(no).match(/20\d{2}(0[1-9]|1[0-2])([0-2]\d|3[01])/);
  return m ? Number(m[1]) : null;
}

/** 解析数字：数字原样返回；文字去千分位后尝试转换；否则 null */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = normText(v).replace(/,/g, '').replace(/\s+/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const CUSTOMER_TOKENS: Record<string, string> = {
  PVT: 'PRIVATE',
  PRIV: 'PRIVATE',
  PRIVT: 'PRIVATE',
  LTD: 'LIMITED',
  LTDA: 'LIMITADA',
  LIMITD: 'LIMITED',
  LIMTED: 'LIMITED',
  LMT: 'LIMITED',
  CO: 'COMPANY',
  COMP: 'COMPANY',
  CORP: 'CORPORATION',
  INC: 'INCORPORATED',
  INDS: 'INDUSTRIES',
  IND: 'INDUSTRIES',
  INTL: 'INTERNATIONAL',
  MFG: 'MANUFACTURING',
  '&': 'AND',
};

const LEGAL_SUFFIX = new Set([
  'PRIVATE',
  'LIMITED',
  'COMPANY',
  'CORPORATION',
  'INCORPORATED',
  'LLP',
  'LLC',
  'PTE',
  'JSC',
  'GMBH',
  'SA',
  'LIMITADA',
  'AND',
]);

/** 客户名归一键：全角转半角、大写、去标点、PVT/LTD 等缩写展开 */
export function normCustomer(name: string): string {
  let t = normText(name).toUpperCase();
  t = t.replace(/&/g, ' & ');
  t = t.replace(/[.,;:'"`()[\]{}/\\_\-·、，。；：（）【】]/g, ' ');
  const tokens = t
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => CUSTOMER_TOKENS[tok] ?? tok);
  // 中文名称内部不保留空格（不用后行断言，兼容 Safari 14）
  return tokens.join(' ').replace(/([一-鿿])\s+(?=[一-鿿])/g, '$1');
}

/** 去掉公司性质后缀后的“核心名”，用于识别“XX”与“XX PRIVATE LIMITED”这类写法差异 */
export function customerCore(key: string): string {
  const tokens = key.split(' ');
  while (tokens.length > 1 && LEGAL_SUFFIX.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ').replace(/(股份)?有限(责任)?公司$|公司$/, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 两个客户归一键是否可能是同一客户（拼写差一两个字母、或仅公司后缀不同） */
export function sameCustomer(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = customerCore(a);
  const cb = customerCore(b);
  if (ca && ca === cb && ca.length >= 4) return true;
  const len = Math.min(a.length, b.length);
  if (len < 8) return false;
  const d = levenshtein(a, b);
  return d <= 2 && d / len <= 0.12;
}

/** 关键字疑似集团关联公司 */
export const RELATED_HINT_KEYWORDS = ['科元', '长鸿', 'KEYUAN', 'CHANGHONG'];

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round((n + Math.sign(n) * Number.EPSILON) * f) / f;
}
