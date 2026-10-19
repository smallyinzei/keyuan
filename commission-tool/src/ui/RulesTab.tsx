import { useMemo, useRef, useState } from 'preact/hooks';
import { pendingItems, type Analysis } from '../lib/analysis';
import { basisLabel, comparisonBasis, completionFactor, paidQtyOf } from '../lib/calc';
import { defaultConfig, normalizeConfig } from '../lib/config';
import { pct, qty as fmtQty } from '../lib/format';
import { normCustomer, normText } from '../lib/text';
import type { CompletionMode, PriceBasis, QtyBasis, RuleConfig } from '../lib/types';
import { Card, Segmented, TableWrap } from './common';
import { copyText, downloadBlob } from './download';

type SetCfg = (f: (c: RuleConfig) => RuleConfig) => void;

function parseInput(v: string): number | null {
  const t = normText(v).replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumberInput({ value, onCommit, placeholder, step, suffix, width }: { value: number | null | undefined; onCommit: (v: number | null) => void; placeholder?: string; step?: string; suffix?: string; width?: number }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === null || value === undefined ? '' : String(value));
  const bad = text !== null && text.trim() !== '' && parseInput(text) === null;
  return (
    <span class="num-input">
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        step={step}
        class={bad ? 'bad' : ''}
        style={width ? { width: `${width}px` } : undefined}
        onInput={(e) => setText((e.currentTarget as HTMLInputElement).value)}
        onBlur={() => {
          if (text === null) return;
          if (!bad) onCommit(parseInput(text));
          setText(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
      />
      {suffix && <span class="suffix">{suffix}</span>}
    </span>
  );
}

export function RulesTab({ an, cfg, setCfg }: { an: Analysis; cfg: RuleConfig; setCfg: SetCfg }) {
  const set = (f: (c: RuleConfig) => RuleConfig) => setCfg((c) => f(structuredCloneSafe(c)));
  const [notes, setNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div class="stack">
      <Card
        title="规则文件"
        sub="规则自动保存在本机浏览器；导出 JSON 可存档或发给同事，导入后立即生效"
        actions={
          <>
            <button type="button" class="btn small" onClick={() => downloadBlob(JSON.stringify(cfg, null, 2), '提成规则配置.json', 'application/json')}>
              保存为 JSON
            </button>
            <button type="button" class="btn small" onClick={() => fileRef.current?.click()}>
              导入 JSON
            </button>
            <button type="button" class="btn small" onClick={() => void copyText(JSON.stringify(cfg, null, 2))}>
              复制 JSON
            </button>
            <button
              type="button"
              class="btn small ghost"
              onClick={() => {
                if (confirm('恢复默认规则？补录的单价、人员合并、剔除名单都会清空。')) {
                  setCfg(() => defaultConfig());
                  setNotes([]);
                }
              }}
            >
              恢复默认
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                (e.currentTarget as HTMLInputElement).value = '';
                if (!f) return;
                try {
                  const { config, notes: n } = normalizeConfig(JSON.parse(await f.text()));
                  setCfg(() => config);
                  setNotes([`已导入 ${f.name}`, ...n]);
                } catch (err) {
                  setNotes([`导入失败：${err instanceof Error ? err.message : String(err)}`]);
                }
              }}
            />
          </>
        }
      >
        {notes.length > 0 && (
          <ul class="warn-list">
            {notes.map((n) => (
              <li class="w-info">{n}</li>
            ))}
          </ul>
        )}
        <p class="small muted">
          当前主口径：<b>{basisLabel({ qty: cfg.qtyBasis, price: cfg.priceBasis })}</b>；对照口径自动取：<b>{basisLabel(comparisonBasis(cfg))}</b>
        </p>
      </Card>

      <div class="cols-2">
        <Card title="数量口径" sub="计提数量取哪一列">
          <Segmented<QtyBasis>
            name="数量口径"
            value={cfg.qtyBasis}
            onChange={(v) => set((c) => ({ ...c, qtyBasis: v }))}
            options={[
              { value: 'contract', label: '合同', hint: '合同数量（含未发）' },
              { value: 'shipped', label: '出库', hint: '实际出库数量（原表做法）' },
              { value: 'shippedPaid', label: '出库且回款', hint: '已出库且已回款的数量' },
            ]}
          />
          <p class="small muted">原表提成计算表按“实际出库”计数量。选“出库且回款”时，回款信息取明细中的“回款”列或下方手工标记；缺回款信息的出库不计入并提示。</p>
        </Card>
        <Card title="均价口径" sub="外贸均价怎么加权">
          <Segmented<PriceBasis>
            name="均价口径"
            value={cfg.priceBasis}
            onChange={(v) => set((c) => ({ ...c, priceBasis: v }))}
            options={[
              { value: 'contract', label: '合同', hint: 'Σ(合同数量×出厂单价)/Σ合同数量，含未发合同' },
              { value: 'shipped', label: '出库', hint: 'Σ(实发×出厂单价)/Σ实发' },
            ]}
          />
          <p class="small muted">原表“外贸销售均价”按全部合同（含未发）加权。选“出库”时，没有出库的型号回退为合同均价并注明。</p>
        </Card>
      </div>

      <Card title="完成系数" sub="季度销售计划达成率 ≥ 上限 → 1；下限 ~ 上限 → 取达成率；< 下限 → 0">
        <div class="row-wrap">
          <Segmented<CompletionMode>
            name="完成系数"
            value={cfg.completion.mode}
            onChange={(v) => set((c) => ({ ...c, completion: { ...c.completion, mode: v } }))}
            options={[
              { value: 'none', label: '无' },
              { value: 'volume', label: '按销量' },
              { value: 'amount', label: '按金额' },
            ]}
          />
          <label class="inline">
            上限
            <NumberInput value={Number((cfg.completion.full * 100).toFixed(6))} suffix="%" width={64} onCommit={(v) => v !== null && v > 0 && set((c) => ({ ...c, completion: { ...c.completion, full: v / 100 } }))} />
          </label>
          <label class="inline">
            下限
            <NumberInput value={Number((cfg.completion.floor * 100).toFixed(6))} suffix="%" width={64} onCommit={(v) => v !== null && v >= 0 && set((c) => ({ ...c, completion: { ...c.completion, floor: Math.min(v / 100, c.completion.full) } }))} />
          </label>
          <label class="inline check">
            <input type="checkbox" checked={cfg.premiumNeedsTarget} onChange={(e) => set((c) => ({ ...c, premiumNeedsTarget: (e.currentTarget as HTMLInputElement).checked }))} />
            溢价需达成目标（溢价同样乘完成系数）
          </label>
        </div>
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th class="r">表内销量完成率</th>
                <th class="r">表内金额完成率</th>
                <th>手填销量完成率</th>
                <th>手填金额完成率</th>
                <th class="r">采用完成率</th>
                <th class="r">单价部分系数</th>
                <th class="r">溢价系数</th>
              </tr>
            </thead>
            <tbody>
              {an.pw.companies.map((company) => {
                const sheet = an.pw.completion.find((c) => c.company === company);
                const manual = cfg.completion.perCompany[company] ?? { volumeRate: null, amountRate: null };
                const co = an.coefs[company];
                const setManual = (k: 'volumeRate' | 'amountRate', v: number | null) =>
                  set((c) => ({ ...c, completion: { ...c.completion, perCompany: { ...c.completion.perCompany, [company]: { ...manual, [k]: v === null ? null : v / 100 } } } }));
                return (
                  <tr>
                    <td>{company}</td>
                    <td class="r">{pct(sheet?.volumeRate)}</td>
                    <td class="r">{pct(sheet?.amountRate)}</td>
                    <td>
                      <NumberInput value={manual.volumeRate === null ? null : Number((manual.volumeRate * 100).toFixed(4))} placeholder="留空用表内" suffix="%" width={90} onCommit={(v) => setManual('volumeRate', v)} />
                    </td>
                    <td>
                      <NumberInput value={manual.amountRate === null ? null : Number((manual.amountRate * 100).toFixed(4))} placeholder="留空用表内" suffix="%" width={90} onCommit={(v) => setManual('amountRate', v)} />
                    </td>
                    <td class="r">{cfg.completion.mode === 'none' ? '—' : co.rate === null ? <span class="pending">缺数据，按 1</span> : `${pct(co.rate)}（${co.rateSource}）`}</td>
                    <td class="r num">{co.unit.toFixed(4)}</td>
                    <td class="r num">{co.premium.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <p class="small muted">
          示例：达成率 70% 时系数 = {completionFactor(0.7, cfg.completion.full, cfg.completion.floor).toFixed(4)}。部门提成 = 系数 × Σ(数量×单价) + {cfg.premiumNeedsTarget ? '系数 × ' : ''}Σ溢价。
        </p>
      </Card>

      <PersonMergeCard an={an} cfg={cfg} set={set} />
      <RelatedCard an={an} cfg={cfg} set={set} />
      <PendingCard an={an} cfg={cfg} set={set} />
      {cfg.qtyBasis === 'shippedPaid' && <PaidCard an={an} cfg={cfg} set={set} />}

      <Card title="缺单价处理" sub="固定规则，不可更改">
        <label class="inline check disabled">
          <input type="radio" checked disabled /> 标记待补（禁止当 0 算）
        </label>
        <p class="small muted">缺提成单价的型号：数量×单价部分显示“待补”，溢价照常计算；各级合计只含已知部分，并注明不含哪些型号。可在上方“待补单价”中补录。</p>
      </Card>
    </div>
  );
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function PersonMergeCard({ an, cfg, set }: { an: Analysis; cfg: RuleConfig; set: SetCfg }) {
  const raw = useMemo(() => [...new Set(an.pw.orders.map((o) => normText(o.person)))], [an.pw]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of an.pw.orders) m.set(normText(o.person), (m.get(normText(o.person)) ?? 0) + 1);
    return m;
  }, [an.pw]);
  return (
    <Card title="人员合并映射" sub="把 A 的订单并入 B 计算个人贡献（部门提成不受影响），可链式合并">
      <div class="row-wrap">
        <select value={from} onChange={(e) => setFrom((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">选择被合并人员</option>
          {raw.map((p) => (
            <option value={p}>
              {p}（{counts.get(p)} 笔）
            </option>
          ))}
        </select>
        <span>→ 并入</span>
        <input list="persons-list" value={to} placeholder="目标人员" onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)} />
        <datalist id="persons-list">
          {raw.map((p) => (
            <option value={p} />
          ))}
        </datalist>
        <button
          type="button"
          class="btn small primary"
          disabled={!from || !normText(to) || from === normText(to)}
          onClick={() => {
            set((c) => ({ ...c, personMerge: [...c.personMerge.filter((m) => normText(m.from) !== from), { from, to: normText(to) }] }));
            setFrom('');
            setTo('');
          }}
        >
          添加
        </button>
      </div>
      {cfg.personMerge.length ? (
        <ul class="chips">
          {cfg.personMerge.map((m, i) => (
            <li>
              {m.from} → {m.to}
              {!raw.includes(normText(m.from)) && <span class="muted small">（本文件无此人）</span>}
              <button type="button" class="chip-x" aria-label="删除" onClick={() => set((c) => ({ ...c, personMerge: c.personMerge.filter((_, j) => j !== i) }))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="small muted">暂无合并。</p>
      )}
    </Card>
  );
}

function RelatedCard({ an, cfg, set }: { an: Analysis; cfg: RuleConfig; set: SetCfg }) {
  const [q, setQ] = useState('');
  const [extra, setExtra] = useState('');
  const customers = useMemo(() => {
    const m = new Map<string, { key: string; names: Set<string>; orders: number; shipped: number; companies: Set<string> }>();
    for (const o of an.pw.orders) {
      if (!o.customer) continue;
      const key = normCustomer(o.customer);
      const cur = m.get(key) ?? { key, names: new Set<string>(), orders: 0, shipped: 0, companies: new Set<string>() };
      cur.names.add(o.customer);
      cur.orders++;
      cur.shipped += o.shipped;
      cur.companies.add(o.company);
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.shipped - a.shipped);
  }, [an.pw]);
  const excluded = new Set(cfg.relatedCustomers.map(normCustomer));
  const toggle = (key: string, name: string, on: boolean) =>
    set((c) => ({ ...c, relatedCustomers: on ? [...c.relatedCustomers.filter((x) => normCustomer(x) !== key), name] : c.relatedCustomers.filter((x) => normCustomer(x) !== key) }));
  const shown = customers.filter((c) => !q || [...c.names].some((n) => n.toUpperCase().includes(q.toUpperCase())));
  const unknown = cfg.relatedCustomers.filter((x) => !customers.some((c) => c.key === normCustomer(x)));
  return (
    <Card title="关联公司剔除名单" sub={`按归一后的客户名匹配（忽略大小写、标点、PVT/LTD 等写法差异）；已剔除 ${customers.filter((c) => excluded.has(c.key)).reduce((a, c) => a + c.orders, 0)} 笔订单`}>
      <div class="row-wrap">
        <input type="search" placeholder="搜索客户" value={q} onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)} />
        <input placeholder="手动添加客户名" value={extra} onInput={(e) => setExtra((e.currentTarget as HTMLInputElement).value)} />
        <button
          type="button"
          class="btn small"
          disabled={!normText(extra)}
          onClick={() => {
            set((c) => ({ ...c, relatedCustomers: [...c.relatedCustomers, normText(extra)] }));
            setExtra('');
          }}
        >
          添加
        </button>
      </div>
      <div class="scroll-list">
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>剔除</th>
                <th>客户（含各种写法）</th>
                <th>公司</th>
                <th class="r">订单</th>
                <th class="r">实发（吨）</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr class={excluded.has(c.key) ? 'row-excluded' : ''}>
                  <td>
                    <input type="checkbox" checked={excluded.has(c.key)} onChange={(e) => toggle(c.key, [...c.names][0], (e.currentTarget as HTMLInputElement).checked)} />
                  </td>
                  <td>{[...c.names].join(' / ')}</td>
                  <td>{[...c.companies].join('、')}</td>
                  <td class="r">{c.orders}</td>
                  <td class="r num">{fmtQty(c.shipped)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
      {unknown.length > 0 && (
        <p class="small muted">
          名单中本文件未出现的客户：{unknown.join('、')}
          <button type="button" class="btn link" onClick={() => set((c) => ({ ...c, relatedCustomers: c.relatedCustomers.filter((x) => !unknown.includes(x)) }))}>
            清除
          </button>
        </p>
      )}
    </Card>
  );
}

function PendingCard({ an, cfg, set }: { an: Analysis; cfg: RuleConfig; set: SetCfg }) {
  const items = pendingItems(an);
  return (
    <Card title="待补单价 / 内贸均价" sub="提成计算表缺单价的型号在此补录；留空即保持“待补”，不会按 0 计算。补录值随规则 JSON 一起保存。">
      {items.length ? (
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>月份</th>
                <th>型号</th>
                <th class="r">主口径数量</th>
                <th class="r">对照口径数量</th>
                <th>提成单价</th>
                <th>内贸均价</th>
                <th>参考（同公司同月已定单价）</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const ref = an.pw.calcRows.filter((r) => r.company === p.company && r.month === p.month && r.unitPrice !== null);
                return (
                  <tr>
                    <td>{p.company}</td>
                    <td>{p.month}月</td>
                    <td>{p.model}</td>
                    <td class="r num">{fmtQty(p.primaryQty)}</td>
                    <td class="r num">{fmtQty(p.comparisonQty)}</td>
                    <td>
                      {p.needUnit ? (
                        <NumberInput
                          value={cfg.supplements.unitPrice[p.key]}
                          placeholder="待补"
                          width={80}
                          onCommit={(v) =>
                            set((c) => {
                              const u = { ...c.supplements.unitPrice };
                              if (v === null) delete u[p.key];
                              else u[p.key] = v;
                              return { ...c, supplements: { ...c.supplements, unitPrice: u } };
                            })
                          }
                        />
                      ) : (
                        <span class="muted">表内已有</span>
                      )}
                    </td>
                    <td>
                      {p.needDomestic ? (
                        <NumberInput
                          value={cfg.supplements.domesticAvg[p.key]}
                          placeholder="待补"
                          width={100}
                          onCommit={(v) =>
                            set((c) => {
                              const d = { ...c.supplements.domesticAvg };
                              if (v === null) delete d[p.key];
                              else d[p.key] = v;
                              return { ...c, supplements: { ...c.supplements, domesticAvg: d } };
                            })
                          }
                        />
                      ) : (
                        <span class="muted">表内已有</span>
                      )}
                    </td>
                    <td class="small muted">{ref.map((r) => `${r.model} ${r.tier ?? ''} ${r.unitPrice}`).join('；') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <p class="small muted">两种口径下都没有缺单价的型号。</p>
      )}
    </Card>
  );
}

function PaidCard({ an, cfg, set }: { an: Analysis; cfg: RuleConfig; set: SetCfg }) {
  const shipped = an.pw.orders.filter((o) => o.shipped > 0);
  const setPaid = (keys: string[], v: number | boolean | null) =>
    set((c) => {
      const p = { ...c.supplements.paid };
      for (const k of keys) {
        if (v === null) delete p[k];
        else p[k] = v;
      }
      return { ...c, supplements: { ...c.supplements, paid: p } };
    });
  const unknown = shipped.filter((o) => paidQtyOf(o, cfg.supplements) === null).length;
  return (
    <Card
      title="回款标记（出库且回款口径）"
      sub={`有出库的订单 ${shipped.length} 笔，缺回款信息 ${unknown} 笔（不计入并提示）。可勾选全部回款，或填写已回款吨数。`}
      actions={
        <>
          <button type="button" class="btn small" onClick={() => setPaid(shipped.map((o) => o.key), true)}>
            全部标为已回款
          </button>
          <button type="button" class="btn small ghost" onClick={() => setPaid(shipped.map((o) => o.key), null)}>
            清除手工标记
          </button>
        </>
      }
    >
      <div class="scroll-list tall">
        <TableWrap>
          <table class="grid compact">
            <thead>
              <tr>
                <th>公司</th>
                <th>月</th>
                <th>对接人</th>
                <th>型号</th>
                <th>客户</th>
                <th>合同号</th>
                <th class="r">实发</th>
                <th>表内回款</th>
                <th>已回款</th>
                <th>回款吨数</th>
              </tr>
            </thead>
            <tbody>
              {shipped.map((o) => {
                const sup = cfg.supplements.paid[o.key];
                const val = paidQtyOf(o, cfg.supplements);
                return (
                  <tr>
                    <td>{o.company}</td>
                    <td>{o.month}</td>
                    <td>{o.person}</td>
                    <td>{o.model}</td>
                    <td class="small">{o.customer}</td>
                    <td class="small">{o.contractNo}</td>
                    <td class="r num">{fmtQty(o.shipped)}</td>
                    <td class="small">{o.paidQty === null ? <span class="muted">—</span> : fmtQty(o.paidQty)}</td>
                    <td>
                      <input type="checkbox" checked={val !== null && val >= o.shipped - 1e-9} onChange={(e) => setPaid([o.key], (e.currentTarget as HTMLInputElement).checked ? true : false)} />
                    </td>
                    <td>
                      <NumberInput value={typeof sup === 'number' ? sup : null} placeholder={val === null ? '缺' : fmtQty(val)} width={70} onCommit={(v) => setPaid([o.key], v)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Card>
  );
}
