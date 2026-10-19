import { useState } from 'preact/hooks';
import type { Analysis } from '../lib/analysis';
import { basisLabel, basisShortLabel, cmKey, groupBy, stdKey, sumLines, type Line } from '../lib/calc';
import { money } from '../lib/format';
import { Card, Delta, Money, Qty, Segmented, TableWrap } from './common';

export function DeptTab({ an }: { an: Analysis }) {
  const [which, setWhich] = useState<'primary' | 'comparison'>('primary');
  const res = which === 'primary' ? an.primary : an.comparison;
  const byCm = groupBy(res.dept, (l) => cmKey(l.company, l.month));
  const calcIdx = new Map(an.pw.calcRows.map((r) => [stdKey(r.company, r.month, r.modelKey), r]));
  const [hideZero, setHideZero] = useState(true);

  return (
    <div class="stack">
      <Card
        title="部门提成重算"
        sub={<>部门提成 = Σ(数量 × 提成单价) + Σ溢价，溢价 = (外贸均价 − 内贸均价) × 10% × 数量。当前：{basisLabel(res.basis)}</>}
        actions={
          <>
            <label class="inline check small">
              <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero((e.currentTarget as HTMLInputElement).checked)} />
              隐藏数量为 0 的型号
            </label>
            <Segmented
              name="口径"
              value={which}
              onChange={setWhich}
              options={[
                { value: 'primary', label: `主口径·${basisShortLabel(an.primary.basis)}` },
                { value: 'comparison', label: `对照·${basisShortLabel(an.comparison.basis)}` },
              ]}
            />
          </>
        }
      >
        <p class="small muted">“原表”列取提成计算表的缓存值；差额 = 重算小计 − 原表提成合计。档级与单价沿用原表（档级核对见“体检”）。</p>
      </Card>
      {an.pw.companies.map((company) => {
        const months = an.cm.filter((c) => c.company === company);
        const coef = an.coefs[company];
        return (
          <Card title={company} sub={coef.unit !== 1 || coef.premium !== 1 ? `完成系数：单价部分 ×${coef.unit.toFixed(4)}，溢价 ×${coef.premium.toFixed(4)}` : undefined}>
            {months.map(({ month }) => {
              const lines = (byCm.get(cmKey(company, month)) ?? []).filter((l) => !hideZero || l.qty !== 0 || calcIdx.has(stdKey(l.company, l.month, l.modelKey)));
              const t = sumLines(byCm.get(cmKey(company, month)) ?? [], coef);
              const origRows = an.pw.calcRows.filter((r) => r.company === company && r.month === month);
              const origTotal = origRows.reduce((a, r) => a + (r.total ?? 0), 0);
              return (
                <div class="month-block">
                  <h4>
                    {month}月 <span class="muted small">重算 {money(t.final)} · 原表 {money(origTotal)} · 差额 </span>
                    <Delta v={t.final - origTotal} />
                  </h4>
                  <TableWrap>
                    <table class="grid">
                      <thead>
                        <tr>
                          <th>型号</th>
                          <th>档级</th>
                          <th class="r">提成单价</th>
                          <th class="r">数量</th>
                          <th class="r">外贸均价</th>
                          <th class="r">内贸均价</th>
                          <th class="r">数量×单价</th>
                          <th class="r">溢价</th>
                          <th class="r">小计</th>
                          <th class="r sep">原表数量</th>
                          <th class="r">原表溢价</th>
                          <th class="r">原表合计</th>
                          <th class="r">差额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l: Line) => {
                          const o = calcIdx.get(stdKey(l.company, l.month, l.modelKey));
                          return (
                            <tr class={l.unitComm === null ? 'row-pending' : ''}>
                              <td>
                                {l.model}
                                {l.avgNote && <div class="small muted">{l.avgNote}</div>}
                                {l.notes.length > 0 && <div class="small muted">{l.notes.join('；')}</div>}
                              </td>
                              <td>{l.tier ?? <span class="muted">—</span>}</td>
                              <td class="r">{l.unitPrice === null ? <span class="pending">待补</span> : <span class="num">{l.unitPrice}{l.unitSource === '补录' && <sup class="sup">补</sup>}</span>}</td>
                              <td class="r">
                                <Qty v={l.qty} />
                              </td>
                              <td class="r">
                                <Money v={l.avg} />
                              </td>
                              <td class="r">
                                <Money v={l.domestic} />
                                {l.domSource === '补录' && <sup class="sup">补</sup>}
                              </td>
                              <td class="r">
                                <Money v={l.unitComm} pending={l.unitComm === null} />
                              </td>
                              <td class="r">
                                <Money v={l.premium} pending={l.premium === null} />
                              </td>
                              <td class="r strong">
                                <Money v={l.subtotal} />
                              </td>
                              <td class="r sep">{o ? <Qty v={o.qty} /> : <span class="muted">未列</span>}</td>
                              <td class="r">{o ? <Money v={o.premium} /> : '—'}</td>
                              <td class="r">{o ? <Money v={o.total} /> : '—'}</td>
                              <td class="r">
                                <Delta v={l.subtotal - (o?.total ?? 0)} />
                              </td>
                            </tr>
                          );
                        })}
                        <tr class="total">
                          <td colSpan={3}>合计{t.pendingUnit.length ? `（不含待补：${t.pendingUnit.map((l) => l.model).join('、')}）` : ''}</td>
                          <td class="r">
                            <Qty v={t.qty} />
                          </td>
                          <td />
                          <td />
                          <td class="r">
                            <Money v={t.unitComm} />
                          </td>
                          <td class="r">
                            <Money v={t.premium} />
                          </td>
                          <td class="r">
                            <Money v={t.raw} />
                          </td>
                          <td class="r sep">
                            <Qty v={origRows.reduce((a, r) => a + (r.qty ?? 0), 0)} />
                          </td>
                          <td class="r">
                            <Money v={origRows.reduce((a, r) => a + (r.premium ?? 0), 0)} />
                          </td>
                          <td class="r">
                            <Money v={origTotal} />
                          </td>
                          <td class="r">
                            <Delta v={t.raw - origTotal} />
                          </td>
                        </tr>
                        {(t.coefUnit !== 1 || t.coefPremium !== 1) && (
                          <tr class="total">
                            <td colSpan={6}>完成系数后（单价部分 ×{t.coefUnit.toFixed(4)}，溢价 ×{t.coefPremium.toFixed(4)}）</td>
                            <td class="r">
                              <Money v={t.unitComm * t.coefUnit} />
                            </td>
                            <td class="r">
                              <Money v={t.premium * t.coefPremium} />
                            </td>
                            <td class="r">
                              <Money v={t.final} />
                            </td>
                            <td colSpan={3} />
                            <td class="r">
                              <Delta v={t.final - origTotal} />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}
