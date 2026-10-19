import { useState } from 'preact/hooks';
import type { Analysis } from '../lib/analysis';
import { buildPersonMap, excludedSet, isExcluded } from '../lib/calc';
import { qty as fmtQty } from '../lib/format';
import { normText } from '../lib/text';
import { TIERS } from '../lib/types';
import { Card, Money, Qty, Segmented, TableWrap } from './common';

export function DataTab({ an }: { an: Analysis }) {
  const [view, setView] = useState<'orders' | 'standards' | 'tiers'>('orders');
  const [company, setCompany] = useState('');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const pm = buildPersonMap(an.cfg.personMerge);
  const ex = excludedSet(an.cfg);
  const months = [...new Set(an.pw.orders.map((o) => o.month))].sort((a, b) => a - b);
  const match = (c: string, m: number) => (!company || c === company) && (!month || m === Number(month));
  return (
    <div class="stack">
      <Card
        title="解析出的数据"
        sub="Order(公司, 月, 对接人, 型号, 合同量, 单价, 实发, 客户, 合同号)；Standard(公司, 月, 型号, 内贸均价, 变动成本, 档级, 单价)；TierTable(公司, 月, 各档下限)"
        actions={
          <Segmented
            name="数据"
            value={view}
            onChange={setView}
            options={[
              { value: 'orders', label: `订单 ${an.pw.orders.length}` },
              { value: 'standards', label: `标准 ${an.pw.standards.length}` },
              { value: 'tiers', label: `档级表 ${an.pw.tierTables.length}` },
            ]}
          />
        }
      >
        <div class="row-wrap">
          <select value={company} onChange={(e) => setCompany((e.currentTarget as HTMLSelectElement).value)}>
            <option value="">全部公司</option>
            {an.pw.companies.map((c) => (
              <option value={c}>{c}</option>
            ))}
          </select>
          {view !== 'tiers' && (
            <select value={month} onChange={(e) => setMonth((e.currentTarget as HTMLSelectElement).value)}>
              <option value="">全部月份</option>
              {months.map((m) => (
                <option value={String(m)}>{m}月</option>
              ))}
            </select>
          )}
          {view === 'orders' && <input type="search" placeholder="搜索对接人、型号、客户、合同号" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />}
        </div>
      </Card>
      {view === 'orders' && (
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>月</th>
                <th>对接人</th>
                <th>型号</th>
                <th class="r">合同量</th>
                <th class="r">含税单价</th>
                <th class="r">运费</th>
                <th class="r">实发</th>
                <th>未发</th>
                <th>客户</th>
                <th>合同号</th>
                <th>位置</th>
              </tr>
            </thead>
            <tbody>
              {an.pw.orders
                .filter((o) => match(o.company, o.month) && (!q || `${o.person} ${o.model} ${o.customer} ${o.contractNo}`.toUpperCase().includes(q.toUpperCase())))
                .map((o) => {
                  const merged = pm.get(normText(o.person));
                  const excluded = isExcluded(o, ex);
                  return (
                    <tr class={excluded ? 'row-excluded' : ''}>
                      <td>{o.company}</td>
                      <td>{o.month}</td>
                      <td>
                        {o.person}
                        {merged && <span class="small muted"> → {merged}</span>}
                      </td>
                      <td>{o.model}</td>
                      <td class="r">
                        <Qty v={o.contractQty} />
                      </td>
                      <td class="r">
                        <Money v={o.price} />
                      </td>
                      <td class="r">
                        <Money v={o.freight} />
                      </td>
                      <td class="r">
                        <Qty v={o.shipped} />
                      </td>
                      <td class="small">{o.unshippedRaw === null ? '' : typeof o.unshippedRaw === 'number' ? fmtQty(o.unshippedRaw) : o.unshippedRaw}</td>
                      <td class="small">
                        {o.customer}
                        {excluded && <span class="badge sev-medium">已剔除</span>}
                      </td>
                      <td class="small">{o.contractNo}</td>
                      <td class="small muted">
                        {o.sheet} 第{o.row}行
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </TableWrap>
      )}
      {view === 'standards' && (
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>月</th>
                <th>型号</th>
                <th class="r">内贸均价</th>
                <th>内贸均价备注</th>
                <th class="r">变动成本</th>
                <th>档级</th>
                <th class="r">提成单价</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              {an.pw.standards
                .filter((s) => match(s.company, s.month))
                .sort((a, b) => an.pw.companies.indexOf(a.company) - an.pw.companies.indexOf(b.company) || a.month - b.month || (a.model < b.model ? -1 : 1))
                .map((s) => (
                  <tr>
                    <td>{s.company}</td>
                    <td>{s.month}</td>
                    <td>{s.model}</td>
                    <td class="r">
                      <Money v={s.domesticAvg} />
                    </td>
                    <td class="small">{s.summary?.note}</td>
                    <td class="r">
                      <Money v={s.varCost} />
                    </td>
                    <td>{s.tier ?? <span class="muted">—</span>}</td>
                    <td class="r">{s.unitPrice ?? <span class="pending">缺</span>}</td>
                    <td class="small muted">
                      {s.summary ? `${s.summary.sheet} 第${s.summary.row}行` : '汇总无'} / {s.calc ? `${s.calc.sheet} 第${s.calc.row}行` : '提成表无'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {view === 'tiers' && (
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>适用月份</th>
                <th>名称</th>
                {TIERS.map((t) => (
                  <th>{t}</th>
                ))}
                <th>各档下限</th>
              </tr>
            </thead>
            <tbody>
              {an.pw.tierTables
                .filter((t) => !company || t.company === company)
                .map((t) => (
                  <tr>
                    <td>{t.company}</td>
                    <td>{t.month === null ? '制度原版' : `${t.month}月`}</td>
                    <td class="small">
                      {t.label}
                      {t.exceptions.length > 0 && <div class="muted">例外：{t.exceptions.join('、')}</div>}
                    </td>
                    {t.unmodified ? (
                      <td colSpan={TIERS.length} class="muted">
                        未修正，沿用制度原版
                      </td>
                    ) : (
                      TIERS.map((tier) => {
                        const r = t.ranges.find((x) => x.tier === tier);
                        return <td class={`small${r?.formatNote ? ' pending' : ''}`}>{r?.raw ?? ''}</td>;
                      })
                    )}
                    <td class="small num">{t.unmodified ? '' : TIERS.map((tier) => `${tier}≥${t.lowerBounds[tier] === -Infinity ? '−∞' : t.lowerBounds[tier] ?? '?'}`).join(' ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
