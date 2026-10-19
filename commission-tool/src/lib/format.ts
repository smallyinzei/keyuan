// 数字与文字格式化。

const nf2 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf4 = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 4 });

/** 金额：千分位 + 两位小数；null → “—” */
export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const v = Math.abs(n) < 0.005 ? 0 : n;
  return nf2.format(v);
}

/** 带正负号的差额 */
export function signed(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (Math.abs(n) < 0.005) return '0.00';
  return (n > 0 ? '+' : '') + nf2.format(n);
}

/** 数量（吨）：最多 4 位小数 */
export function qty(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return nf4.format(Math.abs(n) < 1e-9 ? 0 : n);
}

export function pct(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/** 体检报告中原值/应为的数字展示 */
export function plain(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '（空）';
  const r = Number(n.toFixed(digits));
  return Math.abs(r - n) < 1e-9 ? String(r) : r.toFixed(digits);
}

export function monthText(m: number | null): string {
  if (m === null || m === 0) return '—';
  return `${m}月`;
}
