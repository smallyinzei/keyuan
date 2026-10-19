import type { Analysis, CmSummary } from '../lib/analysis';
import { pendingItems } from '../lib/analysis';
import { basisLabel, basisShortLabel } from '../lib/calc';
import { money, signed } from '../lib/format';
import { Card, Delta, Kpi, Money, SevBadge, TableWrap } from './common';

function sum(rows: CmSummary[], f: (c: CmSummary) => number | null): number {
  return rows.reduce((a, c) => a + (f(c) ?? 0), 0);
}

export function OverviewTab({ an, goto }: { an: Analysis; goto: (tab: string) => void }) {
  const { pw, cm } = an;
  const pl = basisShortLabel(an.primary.basis);
  const cl = basisShortLabel(an.comparison.basis);
  const orig = sum(cm, (c) => c.original);
  const prim = sum(cm, (c) => c.primary.final);
  const comp = sum(cm, (c) => c.comparison.final);
  const pers = sum(cm, (c) => c.personPrimary.final);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of an.issues) counts[i.severity]++;
  // 仍未补录的项目（已补录的不再计入）
  const open = pendingItems(an).filter((p) => (p.needUnit && an.cfg.supplements.unitPrice[p.key] === undefined) || (p.needDomestic && an.cfg.supplements.domesticAvg[p.key] === undefined));
  const pendPrimary = open.filter((p) => p.primaryQty !== null && p.primaryQty > 0).length;
  const top = an.issues.filter((i) => i.severity !== 'low').slice(0, 8);

  return (
    <div class="stack">
      <div class="kpis">
        <Kpi label="原表部门提成" value={money(orig)} hint={`${pw.companies.join(' / ')} · ${pw.quarterLabel || '本季度'}`} />
        <Kpi label={`重算部门提成（${pl}）`} value={money(prim)} hint={<>较原表 <Delta v={prim - orig} /></>} tone={Math.abs(prim - orig) >= 0.005 ? 'warn' : undefined} />
        <Kpi label={`对照口径（${cl}）`} value={money(comp)} hint={<>主口径−对照 <Delta v={prim - comp} /></>} />
        <Kpi label={`Σ个人贡献（${pl}）`} value={money(pers)} hint={<>个人−部门 <Delta v={pers - prim} /></>} />
        <Kpi
          label="体检问题"
          value={
            <span class="sev-counts">
              <b class="c-high">{counts.high}</b>
              <b class="c-mid">{counts.medium}</b>
              <b class="c-low">{counts.low}</b>
            </span>
          }
          hint="严重 / 警告 / 提示"
          tone={counts.high ? 'bad' : undefined}
        />
        <Kpi label="待补单价（主口径）" value={String(pendPrimary)} hint={open.length ? `两种口径合计 ${open.length} 项未补录，金额不含待补部分` : '无'} tone={pendPrimary ? 'warn' : undefined} />
      </div>

      <Card
        title="部门提成：原表 vs 重算"
        sub={
          <>
            主口径：{basisLabel(an.primary.basis)}；对照口径：{basisLabel(an.comparison.basis)}。在“规则配置”中可切换。
          </>
        }
        actions={
          <button type="button" class="btn small" onClick={() => goto('waterfall')}>
            查看差额拆解
          </button>
        }
      >
        <TableWrap>
          <table class="grid">
            <thead>
              <tr>
                <th>公司</th>
                <th>月份</th>
                <th class="r">原表</th>
                <th class="r">重算·{pl}</th>
                <th class="r">与原表差</th>
                <th class="r">对照·{cl}</th>
                <th class="r">主−对照</th>
                <th class="r">Σ个人·{pl}</th>
                <th class="r">个人−部门</th>
                <th>待补（主口径）</th>
              </tr>
            </thead>
            <tbody>
              {pw.companies.map((company) => {
                const rows = cm.filter((c) => c.company === company);
                return (
                  <>
                    {rows.map((c, i) => (
                      <tr key={`${company}-${c.month}`}>
                        {i === 0 && (
                          <td rowSpan={rows.length + 1} class="group">
                            {company}
                            {an.coefs[company].unit !== 1 || an.coefs[company].premium !== 1 ? <div class="muted small">系数 {an.coefs[company].unit.toFixed(4)}</div> : null}
                          </td>
                        )}
                        <td>{c.month}月</td>
                        <td class="r">
                          <Money v={c.original} />
                        </td>
                        <td class="r">
                          <Money v={c.primary.final} />
                        </td>
                        <td class="r">
                          <Delta v={c.original === null ? null : c.primary.final - c.original} />
                        </td>
                        <td class="r">
                          <Money v={c.comparison.final} />
                          {c.comparison.pendingUnit.length > 0 && (
                            <div class="small pending-note" title={c.comparison.pendingUnit.map((l) => `${l.model}（${l.qty} 吨）`).join('、')}>
                              不含待补 {c.comparison.pendingUnit.length} 项
                            </div>
                          )}
                        </td>
                        <td class="r">
                          <Delta v={c.primary.final - c.comparison.final} />
                        </td>
                        <td class="r">
                          <Money v={c.personPrimary.final} />
                        </td>
                        <td class="r">
                          <Delta v={c.personPrimary.final - c.primary.final} />
                        </td>
                        <td class="small">{c.primary.pendingUnit.length ? <span class="pending">{c.primary.pendingUnit.map((l) => l.model).join('、')}</span> : <span class="muted">—</span>}</td>
                      </tr>
                    ))}
                    <tr class="subtotal">
                      <td>小计</td>
                      <td class="r">
                        <Money v={sum(rows, (c) => c.original)} />
                      </td>
                      <td class="r">
                        <Money v={sum(rows, (c) => c.primary.final)} />
                      </td>
                      <td class="r">
                        <Delta v={sum(rows, (c) => (c.original === null ? null : c.primary.final - c.original))} />
                      </td>
                      <td class="r">
                        <Money v={sum(rows, (c) => c.comparison.final)} />
                      </td>
                      <td class="r">
                        <Delta v={sum(rows, (c) => c.primary.final - c.comparison.final)} />
                      </td>
                      <td class="r">
                        <Money v={sum(rows, (c) => c.personPrimary.final)} />
                      </td>
                      <td class="r">
                        <Delta v={sum(rows, (c) => c.personPrimary.final - c.primary.final)} />
                      </td>
                      <td />
                    </tr>
                  </>
                );
              })}
              <tr class="total">
                <td colSpan={2}>合计</td>
                <td class="r">
                  <Money v={orig} />
                </td>
                <td class="r">
                  <Money v={prim} />
                </td>
                <td class="r">
                  <Delta v={prim - orig} />
                </td>
                <td class="r">
                  <Money v={comp} />
                </td>
                <td class="r">
                  <Delta v={prim - comp} />
                </td>
                <td class="r">
                  <Money v={pers} />
                </td>
                <td class="r">
                  <Delta v={pers - prim} />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card
        title="需要优先处理的问题"
        sub="按严重度、影响金额排序；影响金额按原表口径（出库数量 × 合同均价）估算"
        actions={
          <button type="button" class="btn small" onClick={() => goto('issues')}>
            全部 {an.issues.length} 条
          </button>
        }
      >
        {top.length ? (
          <ul class="finding-list">
            {top.map((i) => (
              <li>
                <SevBadge s={i.severity} />
                <span class="tag">{i.category}</span>
                <span class="where">
                  {i.company}
                  {i.month ? `${i.month}月` : ''} {i.location}
                </span>
                <span class="msg">{i.message}</span>
                {i.impact !== null && Math.abs(i.impact) >= 0.005 && <span class={`impact ${i.impact > 0 ? 'pos' : 'neg'}`}>{signed(i.impact)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">没有严重或警告级问题。</p>
        )}
      </Card>

      <Card title="读取情况" sub="按表头文字定位列；如识别有误，请检查表头写法">
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>明细表</th>
                <th>提成计算表</th>
                <th class="r">订单行</th>
                <th class="r">汇总行</th>
                <th class="r">提成计算行</th>
                <th class="r">档级表</th>
                <th>月份</th>
                <th>完成率数据</th>
              </tr>
            </thead>
            <tbody>
              {pw.sheets.map((s) => {
                const comp = pw.completion.find((c) => c.company === s.company);
                return (
                  <tr>
                    <td>{s.company}</td>
                    <td>{s.detail}</td>
                    <td>{s.calc}</td>
                    <td class="r">{pw.orders.filter((o) => o.company === s.company).length}</td>
                    <td class="r">{pw.summaries.filter((o) => o.company === s.company).length}</td>
                    <td class="r">{pw.calcRows.filter((o) => o.company === s.company).length}</td>
                    <td class="r">{pw.tierTables.filter((o) => o.company === s.company).length}</td>
                    <td>{[...new Set(pw.orders.filter((o) => o.company === s.company).map((o) => o.month))].sort((a, b) => a - b).map((m) => `${m}月`).join('、')}</td>
                    <td class="small">{comp ? `销量 ${comp.volumeRate === null ? '—' : `${(comp.volumeRate * 100).toFixed(2)}%`}，金额 ${comp.amountRate === null ? '—' : `${(comp.amountRate * 100).toFixed(2)}%`}` : <span class="muted">无</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {pw.costSources.length > 0 && <p class="muted small">另读取到 {[...new Set(pw.costSources.map((c) => c.sheet))].join('、')} 中的变动成本，用于核对复制错误。</p>}
        {pw.warnings.length > 0 && (
          <ul class="warn-list">
            {pw.warnings.map((w) => (
              <li class={`w-${w.level}`}>
                {w.message}
                {w.loc ? `（${w.loc.sheet}!${w.loc.addr}）` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
