import { useState } from 'preact/hooks';
import type { Analysis } from '../lib/analysis';
import type { WaterfallRow, WaterfallStep } from '../lib/calc';
import { money, signed } from '../lib/format';
import { Card, Delta, Money, TableWrap } from './common';

/** 以 0 为中线的差额条：向左为减少，向右为增加，长度按本表最大差额缩放 */
function DeltaBar({ v, max }: { v: number; max: number }) {
  if (Math.abs(v) < 0.005 || max <= 0) return <div class="wf-bar-track" />;
  const half = (Math.abs(v) / max) * 50;
  const style = v >= 0 ? { left: '50%', width: `${half}%` } : { left: `${50 - half}%`, width: `${half}%` };
  return (
    <div class="wf-bar-track">
      <span class={`wf-bar ${v >= 0 ? 'up' : 'down'}`} style={style} />
    </div>
  );
}

function sumRows(rows: WaterfallRow[]): WaterfallRow {
  const first = rows[0];
  return {
    company: '全部',
    month: 0,
    pending: rows.flatMap((r) => r.pending.map((p) => `${r.company}${r.month}月 ${p}`)),
    steps: first.steps.map((s, i) => ({
      ...s,
      total: rows.reduce((a, r) => a + r.steps[i].total, 0),
      delta: rows.reduce((a, r) => a + r.steps[i].delta, 0),
      byModel: rows
        .flatMap((r) => r.steps[i].byModel.map((m) => ({ model: `${r.company}${r.month}月 ${m.model}`, delta: m.delta })))
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 8),
    })),
  };
}

function StepRow({ s, max, first }: { s: WaterfallStep; max: number; first?: boolean }) {
  return (
    <tr class={first ? 'total' : ''}>
      <td>
        <div>{s.label}</div>
        <div class="small muted">{s.explain}</div>
      </td>
      <td class="r">
        <Money v={s.total} />
      </td>
      <td class="r">{first ? '' : <Delta v={s.delta} />}</td>
      <td class="wf-bar-cell">{first ? null : <DeltaBar v={s.delta} max={max} />}</td>
      <td class="small">{s.byModel.length ? s.byModel.map((m) => `${m.model} ${signed(m.delta)}`).join('；') : <span class="muted">—</span>}</td>
    </tr>
  );
}

function WfTable({ row, title }: { row: WaterfallRow; title: string }) {
  const [open, setOpen] = useState(false);
  const steps = row.steps;
  const deptIdx = steps.findIndex((s) => s.key === 'coef');
  const personIdx = steps.findIndex((s) => s.key === 'person');
  const mid = steps.slice(1, personIdx).filter((s) => open || Math.abs(s.delta) >= 0.005);
  const max = Math.max(0, ...steps.slice(1).map((s) => Math.abs(s.delta)));
  const nonZero = steps.filter((s, i) => i > 0 && Math.abs(s.delta) >= 0.005).length;
  const dept = steps[deptIdx];
  const person = steps[personIdx];
  return (
    <Card
      title={title}
      sub={nonZero ? `${nonZero} 个步骤有差额；原表 ${money(steps[0].total)} → 部门重算 ${money(dept.total)} → Σ个人 ${money(person.total)}` : '各步骤均无差额'}
      actions={
        <button type="button" class="btn small ghost" onClick={() => setOpen(!open)}>
          {open ? '只看有差额的步骤' : '显示全部步骤'}
        </button>
      }
    >
      <TableWrap>
        <table class="grid">
          <thead>
            <tr>
              <th>步骤</th>
              <th class="r">部门提成</th>
              <th class="r">本步差额</th>
              <th class="wf-bar-cell">差额示意</th>
              <th>按型号拆分</th>
            </tr>
          </thead>
          <tbody>
            <StepRow s={steps[0]} max={max} first />
            {mid.map((s) => (
              <StepRow s={s} max={max} />
            ))}
            <tr class="wf-dept">
              <td>＝ 重算部门提成（主口径）</td>
              <td class="r">
                <Money v={dept.total} />
              </td>
              <td class="r">
                <Delta v={dept.total - steps[0].total} />
              </td>
              <td class="wf-bar-cell" />
              <td class="small muted">相对原表合计差额</td>
            </tr>
            <StepRow s={person} max={max} />
          </tbody>
        </table>
      </TableWrap>
      {row.pending.length > 0 && <p class="small pending-note">仍待补（金额不含）：{row.pending.join('；')}</p>}
    </Card>
  );
}

export function WaterfallTab({ an }: { an: Analysis }) {
  const [company, setCompany] = useState('');
  const rows = an.waterfall.filter((r) => !company || r.company === company);
  const total = rows.length ? sumRows(rows) : null;
  return (
    <div class="stack">
      <Card title="差额拆解：原表部门提成 → 重算 → Σ个人贡献" sub="每一步只改变一个因素，前后相减即该因素的影响；各步差额相加等于总差额">
        <div class="row-wrap">
          <select value={company} onChange={(e) => setCompany((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">全部公司</option>
            {an.pw.companies.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
          {total && (
            <span class="small muted">
              {company || '全部'}：原表 {money(total.steps[0].total)} → Σ个人 {money(total.steps[total.steps.length - 1].total)}，合计差额 {signed(total.steps[total.steps.length - 1].total - total.steps[0].total)}
            </span>
          )}
        </div>
      </Card>
      {total && <WfTable row={total} title={`${company || '全部公司'} · 季度合计`} />}
      {rows.map((r) => (
        <WfTable row={r} title={`${r.company} · ${r.month}月`} />
      ))}
    </div>
  );
}
