import { useState } from 'preact/hooks';
import type { Analysis, PersonBlock } from '../lib/analysis';
import { basisLabel, basisShortLabel } from '../lib/calc';
import { money } from '../lib/format';
import { cnMonth } from '../lib/text';
import { Card, Delta, Money, Qty, Segmented, TableWrap } from './common';

function Filters({ an, company, setCompany, month, setMonth, person, setPerson }: { an: Analysis; company: string; setCompany: (v: string) => void; month: string; setMonth: (v: string) => void; person: string; setPerson: (v: string) => void }) {
  const months = [...new Set(an.cm.map((c) => c.month))].sort((a, b) => a - b);
  return (
    <div class="row-wrap">
      <select value={company} onChange={(e) => setCompany((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">全部公司</option>
        {an.pw.companies.map((c) => (
          <option value={c}>{c}</option>
        ))}
      </select>
      <select value={month} onChange={(e) => setMonth((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">全部月份</option>
        {months.map((m) => (
          <option value={String(m)}>{m}月</option>
        ))}
      </select>
      <select value={person} onChange={(e) => setPerson((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">全部人员</option>
        {an.persons.map((p) => (
          <option value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}

function Block({ b }: { b: PersonBlock }) {
  const t = b.totals;
  return (
    <div class="person-block">
      <div class="pb-title">
        {b.person}
        {b.company}
        {cnMonth(b.month)}
      </div>
      <TableWrap>
        <table class="grid">
          <thead>
            <tr>
              <th />
              <th class="r">合同均价</th>
              <th class="r">出库数量</th>
              <th class="r">内贸销售均价</th>
              <th class="r">部门提成单价</th>
              <th class="r">出库量提成</th>
              <th class="r">溢价提成</th>
              <th class="r">小计</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            {b.lines.map((l) => (
              <tr class={l.unitComm === null ? 'row-pending' : ''}>
                <td>{l.model}</td>
                <td class="r">
                  <Money v={l.avg} />
                </td>
                <td class="r">
                  <Qty v={l.qty} />
                </td>
                <td class="r">
                  <Money v={l.domestic} />
                </td>
                <td class="r">{l.unitPrice === null ? l.qty === 0 ? <span class="muted">—</span> : <span class="pending">待补单价</span> : <span class="num">{l.unitPrice}</span>}</td>
                <td class="r">
                  <Money v={l.unitComm} pending={l.unitComm === null} />
                </td>
                <td class="r">
                  <Money v={l.premium} pending={l.premium === null} />
                </td>
                <td class="r strong">
                  <Money v={l.subtotal} />
                </td>
                <td class="small muted">
                  {[l.unitComm === null ? '待补单价' : '', l.unitSource === '补录' ? '单价为补录' : '', l.avgNote, l.mergedFrom.length ? `含 ${l.mergedFrom.join('、')}` : '', ...l.notes].filter(Boolean).join('；')}
                </td>
              </tr>
            ))}
            <tr class="total">
              <td>合计</td>
              <td />
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
              <td class="small">{t.pendingUnit.length ? <span class="pending">不含 {t.pendingUnit.map((l) => `${l.model} 单价部分`).join('、')}</span> : ''}</td>
            </tr>
            {(t.coefUnit !== 1 || t.coefPremium !== 1) && (
              <tr class="total">
                <td colSpan={5}>完成系数后</td>
                <td class="r">
                  <Money v={t.unitComm * t.coefUnit} />
                </td>
                <td class="r">
                  <Money v={t.premium * t.coefPremium} />
                </td>
                <td class="r">
                  <Money v={t.final} />
                </td>
                <td class="small muted">
                  ×{t.coefUnit.toFixed(4)} / ×{t.coefPremium.toFixed(4)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}

export function PersonTab({ an }: { an: Analysis }) {
  const [which, setWhich] = useState<'primary' | 'comparison'>('primary');
  const [company, setCompany] = useState('');
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState('');
  const basis = which === 'primary' ? an.primary.basis : an.comparison.basis;
  const blocks = (which === 'primary' ? an.personBlocks.primary : an.personBlocks.comparison).filter(
    (b) => (!company || b.company === company) && (!month || b.month === Number(month)) && (!person || b.person === person),
  );
  const totals = new Map<string, { qty: number; unit: number; prem: number; final: number; pending: string[] }>();
  for (const b of blocks) {
    const cur = totals.get(b.person) ?? { qty: 0, unit: 0, prem: 0, final: 0, pending: [] };
    cur.qty += b.totals.qty;
    cur.unit += b.totals.unitComm * b.totals.coefUnit;
    cur.prem += b.totals.premium * b.totals.coefPremium;
    cur.final += b.totals.final;
    cur.pending.push(...b.totals.pendingUnit.map((l) => `${b.company}${b.month}月${l.model}`));
    totals.set(b.person, cur);
  }
  return (
    <div class="stack">
      <Card
        title="个人贡献（人 × 月 × 型号）"
        sub={<>沿用原格式：合同均价 / 出库数量 / 内贸销售均价 / 部门提成单价 / 出库量提成 / 溢价提成 / 小计。当前：{basisLabel(basis)}（“出库数量”列填该口径的数量）</>}
        actions={
          <Segmented
            name="口径"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'primary', label: `主口径·${basisShortLabel(an.primary.basis)}` },
              { value: 'comparison', label: `对照·${basisShortLabel(an.comparison.basis)}` },
            ]}
          />
        }
      >
        <Filters an={an} company={company} setCompany={setCompany} month={month} setMonth={setMonth} person={person} setPerson={setPerson} />
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>人员</th>
                <th class="r">数量</th>
                <th class="r">出库量提成</th>
                <th class="r">溢价提成</th>
                <th class="r">小计</th>
                <th>待补单价（未计入）</th>
              </tr>
            </thead>
            <tbody>
              {[...totals.entries()].map(([p, t]) => (
                <tr>
                  <td>{p}</td>
                  <td class="r">
                    <Qty v={t.qty} />
                  </td>
                  <td class="r">
                    <Money v={t.unit} />
                  </td>
                  <td class="r">
                    <Money v={t.prem} />
                  </td>
                  <td class="r strong">
                    <Money v={t.final} />
                  </td>
                  <td class="small">{t.pending.length ? <span class="pending">{t.pending.join('、')}</span> : <span class="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <div class="blocks">
        {blocks.map((b) => (
          <Block b={b} />
        ))}
      </div>
    </div>
  );
}

export function CompareTab({ an }: { an: Analysis }) {
  const [company, setCompany] = useState('');
  const [month, setMonth] = useState('');
  const [person, setPerson] = useState('');
  const pl = basisShortLabel(an.primary.basis);
  const cl = basisShortLabel(an.comparison.basis);
  const key = (b: PersonBlock) => `${b.person}|${b.company}|${b.month}`;
  const pIdx = new Map(an.personBlocks.primary.map((b) => [key(b), b]));
  const cIdx = new Map(an.personBlocks.comparison.map((b) => [key(b), b]));
  const keys = [...new Set([...pIdx.keys(), ...cIdx.keys()])]
    .map((k) => {
      const [p, c, m] = k.split('|');
      return { k, person: p, company: c, month: Number(m) };
    })
    .filter((x) => (!company || x.company === company) && (!month || x.month === Number(month)) && (!person || x.person === person))
    .sort((a, b) => an.persons.indexOf(a.person) - an.persons.indexOf(b.person) || an.pw.companies.indexOf(a.company) - an.pw.companies.indexOf(b.company) || a.month - b.month);
  let sp = 0;
  let sc = 0;
  return (
    <div class="stack">
      <Card title="两种口径对比" sub={<>主口径 {basisLabel(an.primary.basis)}；对照口径 {basisLabel(an.comparison.basis)}。差额 = 主 − 对照。</>}>
        <Filters an={an} company={company} setCompany={setCompany} month={month} setMonth={setMonth} person={person} setPerson={setPerson} />
        <TableWrap>
          <table class="grid">
            <thead>
              <tr>
                <th>人员</th>
                <th>公司</th>
                <th>月份</th>
                <th class="r">{pl}·数量</th>
                <th class="r">{pl}·小计</th>
                <th class="r">{cl}·数量</th>
                <th class="r">{cl}·小计</th>
                <th class="r">差额</th>
                <th>待补（未计入）</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((x) => {
                const p = pIdx.get(x.k);
                const c = cIdx.get(x.k);
                sp += p?.totals.final ?? 0;
                sc += c?.totals.final ?? 0;
                const pend = [...(p?.totals.pendingUnit ?? []).map((l) => `主:${l.model}`), ...(c?.totals.pendingUnit ?? []).map((l) => `对照:${l.model}`)];
                return (
                  <tr>
                    <td>{x.person}</td>
                    <td>{x.company}</td>
                    <td>{x.month}月</td>
                    <td class="r">
                      <Qty v={p?.totals.qty ?? 0} />
                    </td>
                    <td class="r">
                      <Money v={p?.totals.final ?? 0} />
                    </td>
                    <td class="r">
                      <Qty v={c?.totals.qty ?? 0} />
                    </td>
                    <td class="r">
                      <Money v={c?.totals.final ?? 0} />
                    </td>
                    <td class="r">
                      <Delta v={(p?.totals.final ?? 0) - (c?.totals.final ?? 0)} />
                    </td>
                    <td class="small">{pend.length ? <span class="pending">{pend.join('、')}</span> : <span class="muted">—</span>}</td>
                  </tr>
                );
              })}
              <tr class="total">
                <td colSpan={4}>合计</td>
                <td class="r">{money(sp)}</td>
                <td />
                <td class="r">{money(sc)}</td>
                <td class="r">
                  <Delta v={sp - sc} />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
