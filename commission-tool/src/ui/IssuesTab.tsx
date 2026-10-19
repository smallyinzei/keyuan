import { useMemo, useState } from 'preact/hooks';
import type { Analysis } from '../lib/analysis';
import { SEV_LABEL } from '../lib/checks';
import type { Severity } from '../lib/types';
import { Card, Clamp, Delta, SevBadge, TableWrap } from './common';

export function IssuesTab({ an }: { an: Analysis }) {
  const [sev, setSev] = useState<Record<Severity, boolean>>({ high: true, medium: true, low: true });
  const [cat, setCat] = useState('');
  const [company, setCompany] = useState('');
  const [q, setQ] = useState('');
  const cats = useMemo(() => [...new Set(an.issues.map((i) => i.category))], [an.issues]);
  const list = an.issues.filter(
    (i) =>
      sev[i.severity] &&
      (!cat || i.category === cat) &&
      (!company || i.company.includes(company)) &&
      (!q || `${i.model} ${i.location} ${i.message} ${i.original} ${i.expected}`.toUpperCase().includes(q.toUpperCase())),
  );
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of an.issues) counts[i.severity]++;
  return (
    <div class="stack">
      <Card title="体检报告" sub="影响金额 = 按原表口径（出库数量 × 合同均价）估算的部门提成变化，正数表示应增加；“—”表示无法估算或待补。各条单独估算，可能相互重叠，结论以“差额拆解”为准。">
        <div class="row-wrap">
          {(['high', 'medium', 'low'] as Severity[]).map((s) => (
            <label class={`inline check sev-filter sev-${s}`}>
              <input type="checkbox" checked={sev[s]} onChange={(e) => setSev({ ...sev, [s]: (e.currentTarget as HTMLInputElement).checked })} />
              {SEV_LABEL[s]} {counts[s]}
            </label>
          ))}
          <select value={cat} onChange={(e) => setCat((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">全部类别</option>
            {cats.map((c) => (
              <option value={c}>
                {c}（{an.issues.filter((i) => i.category === c).length}）
              </option>
            ))}
          </select>
          <select value={company} onChange={(e) => setCompany((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">全部公司</option>
            {an.pw.companies.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
          <input type="search" placeholder="搜索型号、位置、说明" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
          <span class="small muted">显示 {list.length} / {an.issues.length}</span>
        </div>
      </Card>
      <TableWrap>
        <table class="grid issues">
          <thead>
            <tr>
              <th>#</th>
              <th>严重度</th>
              <th>类别</th>
              <th>公司/月</th>
              <th>型号</th>
              <th>位置</th>
              <th>原值</th>
              <th>应为</th>
              <th class="r">影响金额</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {list.map((i) => (
              <tr class={`sev-row-${i.severity}`}>
                <td class="muted">{i.id}</td>
                <td>
                  <SevBadge s={i.severity} />
                </td>
                <td class="nowrap">{i.category}</td>
                <td class="nowrap">
                  {i.company}
                  {i.month ? ` ${i.month}月` : ''}
                </td>
                <td class="model">
                  <Clamp text={i.model} limit={40} />
                </td>
                <td class="loc">
                  <Clamp text={i.location} limit={60} />
                </td>
                <td class="val">
                  <Clamp text={i.original} />
                </td>
                <td class="val">
                  <Clamp text={i.expected} />
                </td>
                <td class="r">
                  <Delta v={i.impact} />
                  {i.impactNote && <div class="small muted">{i.impactNote}</div>}
                </td>
                <td class="msg">
                  {i.message}
                  {i.suggestion && <div class="small suggestion">建议：{i.suggestion}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
