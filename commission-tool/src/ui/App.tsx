// 应用外壳：读文件、规则状态、分页。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { analyze } from '../lib/analysis';
import { defaultConfig, loadStoredConfig, storeConfig } from '../lib/config';
import { parseWorkbookData } from '../lib/parse';
import type { ParsedWorkbook, RuleConfig } from '../lib/types';
import { DataTab } from './DataTab';
import { DeptTab } from './DeptTab';
import { ExportTab } from './ExportTab';
import { IssuesTab } from './IssuesTab';
import { OverviewTab } from './OverviewTab';
import { CompareTab, PersonTab } from './PersonTab';
import { RulesTab } from './RulesTab';
import { WaterfallTab } from './WaterfallTab';

type TabKey = 'overview' | 'rules' | 'dept' | 'person' | 'compare' | 'waterfall' | 'issues' | 'data' | 'export';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '总览' },
  { key: 'issues', label: '体检' },
  { key: 'rules', label: '规则配置' },
  { key: 'dept', label: '部门提成' },
  { key: 'person', label: '个人贡献' },
  { key: 'compare', label: '口径对比' },
  { key: 'waterfall', label: '差额拆解' },
  { key: 'data', label: '数据' },
  { key: 'export', label: '导出' },
];

export function App() {
  const [pw, setPw] = useState<ParsedWorkbook | null>(null);
  const [cfg, setCfg] = useState<RuleConfig>(() => loadStoredConfig() ?? defaultConfig());
  const [tab, setTab] = useState<TabKey>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => storeConfig(cfg), [cfg]);

  const an = useMemo(() => {
    if (!pw) return null;
    try {
      return analyze(pw, cfg);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [pw, cfg]);

  async function openFile(f: File) {
    setError(null);
    if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
      setError(`“${f.name}”不是 Excel 文件（.xlsx / .xlsm / .xls）`);
      return;
    }
    setBusy(true);
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      await new Promise((r) => setTimeout(r, 0));
      const parsed = parseWorkbookData(buf, f.name);
      if (!parsed.companies.length) {
        setError(parsed.warnings.map((w) => w.message).join('；') || '没有识别到提成表');
        setPw(null);
      } else {
        setPw(parsed);
        setTab('overview');
      }
    } catch (e) {
      console.error(e);
      setError(`读取失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) void openFile(f);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const highCount = an?.issues.filter((i) => i.severity === 'high').length ?? 0;

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <h1>外贸提成测算与体检</h1>
          <span class="offline" title="页面不发起任何网络请求，文件只在本机浏览器内存中处理">离线运行 · 数据不出本机</span>
        </div>
        <div class="file-actions">
          {pw && (
            <span class="file-name" title={pw.fileName}>
              {pw.fileName}
            </span>
          )}
          <button type="button" class={pw ? 'btn' : 'btn primary'} onClick={() => inputRef.current?.click()} disabled={busy}>
            {pw ? '换一个文件' : '选择 Excel'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const f = (e.currentTarget as HTMLInputElement).files?.[0];
              if (f) void openFile(f);
              (e.currentTarget as HTMLInputElement).value = '';
            }}
          />
        </div>
      </header>

      {dragging && <div class="drop-overlay">松开鼠标，读取 Excel</div>}
      {error && (
        <div class="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!pw && (
        <main class="landing">
          <div
            class={`dropzone${busy ? ' busy' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
          >
            <div class="dz-icon" aria-hidden="true">
              ⇪
            </div>
            <div class="dz-title">{busy ? '正在读取…' : '把季度提成 Excel 拖到这里，或点击选择'}</div>
            <div class="dz-sub">需包含「三季度X明细」「三季度X提成计算」（X = 高科 / 生物 / 长科），按表头文字定位列，不依赖固定行号</div>
          </div>
          <ul class="landing-notes">
            <li>全部计算在本机浏览器内完成，页面没有任何联网请求，Excel 不会上传。</li>
            <li>规则配置（数量口径、均价口径、完成系数、人员合并、关联公司剔除）会保存在本机浏览器，也可导出为 JSON 发给同事。</li>
            <li>缺少提成单价的型号标记“待补”，不按 0 计算；合计会注明不含哪些部分。</li>
          </ul>
        </main>
      )}

      {pw && !an && <div class="alert alert-error">计算出错，请检查文件格式或恢复默认规则后重试。</div>}

      {pw && an && (
        <>
          <nav class="tabs" role="tablist">
            {TABS.map((t) => (
              <button type="button" role="tab" aria-selected={tab === t.key} class={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
                {t.key === 'issues' && highCount > 0 && <span class="tab-count">{highCount}</span>}
              </button>
            ))}
          </nav>
          <main class="content">
            {tab === 'overview' && <OverviewTab an={an} goto={(k) => setTab(k as TabKey)} />}
            {tab === 'rules' && <RulesTab an={an} cfg={cfg} setCfg={setCfg} />}
            {tab === 'dept' && <DeptTab an={an} />}
            {tab === 'person' && <PersonTab an={an} />}
            {tab === 'compare' && <CompareTab an={an} />}
            {tab === 'waterfall' && <WaterfallTab an={an} />}
            {tab === 'issues' && <IssuesTab an={an} />}
            {tab === 'data' && <DataTab an={an} />}
            {tab === 'export' && <ExportTab an={an} />}
          </main>
        </>
      )}
      <footer class="foot">外贸提成测算与体检 · 单文件离线工具 · 数据只在本机处理</footer>
    </div>
  );
}
