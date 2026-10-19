// 通用界面组件。
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { money, qty as fmtQty, signed } from '../lib/format';
import type { Severity } from '../lib/types';
import { SEV_LABEL } from '../lib/checks';

export function Money({ v, pending, sign }: { v: number | null | undefined; pending?: boolean; sign?: boolean }) {
  if (pending) return <span class="pending">待补</span>;
  if (v === null || v === undefined) return <span class="muted">—</span>;
  const neg = v < -0.004;
  return <span class={`num${neg ? ' neg' : ''}`}>{sign ? signed(v) : money(v)}</span>;
}

export function Delta({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span class="muted">—</span>;
  if (Math.abs(v) < 0.005) return <span class="num muted">0.00</span>;
  return <span class={`num ${v > 0 ? 'pos' : 'neg'}`}>{signed(v)}</span>;
}

export function Qty({ v }: { v: number | null | undefined }) {
  return <span class="num">{fmtQty(v)}</span>;
}

export function SevBadge({ s }: { s: Severity }) {
  return <span class={`badge sev-${s}`}>{SEV_LABEL[s]}</span>;
}

export function Card({ title, actions, children, sub }: { title?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <section class="card">
      {(title || actions) && (
        <header class="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <p class="card-sub">{sub}</p>}
          </div>
          {actions && <div class="card-actions">{actions}</div>}
        </header>
      )}
      <div class="card-body">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ComponentChildren; hint?: ComponentChildren; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div class={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <div class="kpi-label">{label}</div>
      <div class="kpi-value">{value}</div>
      {hint && <div class="kpi-hint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, name }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; name: string }) {
  return (
    <div class="segmented" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button type="button" role="radio" aria-checked={value === o.value} class={value === o.value ? 'on' : ''} title={o.hint} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ComponentChildren }) {
  return <div class="empty">{children}</div>;
}

export function TableWrap({ children }: { children: ComponentChildren }) {
  return <div class="table-wrap">{children}</div>;
}

/** 长文字默认显示 3 行，点击展开 */
export function Clamp({ text, limit = 90 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  if (text.length <= limit) return <>{text}</>;
  return (
    <div class={`clamp${open ? ' open' : ''}`} title={open ? '' : '点击展开'} onClick={() => setOpen(!open)}>
      {text}
    </div>
  );
}
