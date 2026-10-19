import { useState } from 'preact/hooks';
import type { Analysis } from '../lib/analysis';
import { basisLabel } from '../lib/calc';
import { buildAllWorkbook, buildChangeNotesWorkbook, buildHealthWorkbook, buildPersonalWorkbook, changeNotesText, workbookBytes } from '../lib/export';
import type ExcelJS from 'exceljs';
import { Card } from './common';
import { XLSX_MIME, baseName, copyText, downloadBlob } from './download';

export function ExportTab({ an }: { an: Analysis }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const base = baseName(an.pw.fileName);

  async function run(label: string, build: (a: Analysis) => ExcelJS.Workbook, name: string) {
    setBusy(label);
    setMsg('');
    try {
      const bytes = await workbookBytes(build(an));
      downloadBlob(bytes, name, XLSX_MIME);
      setMsg(`已生成 ${name}`);
    } catch (e) {
      console.error(e);
      setMsg(`生成失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy('');
    }
  }

  const items: { key: string; title: string; desc: string; build: (a: Analysis) => ExcelJS.Workbook; file: string }[] = [
    {
      key: 'person',
      title: '个人贡献表',
      desc: `沿用原格式（合同均价/出库数量/内贸销售均价/部门提成单价/出库量提成/溢价提成/小计），含主口径、对照口径两张表，以及个人汇总、口径对比。单元格保留公式，可在 Excel 中核对。`,
      build: buildPersonalWorkbook,
      file: `${base}-个人贡献表.xlsx`,
    },
    {
      key: 'health',
      title: '体检报告',
      desc: `${an.issues.length} 条问题：严重度 / 类别 / 位置 / 原值 / 应为 / 影响金额 / 说明，带筛选；另附按类别的汇总。`,
      build: buildHealthWorkbook,
      file: `${base}-体检报告.xlsx`,
    },
    {
      key: 'notes',
      title: '修改说明',
      desc: '逐条说明重算采用了哪些修正、哪些待确认未采用、哪些待补；附部门提成对账（原表 → Σ个人逐步差额）、待补事项与本次规则配置。',
      build: buildChangeNotesWorkbook,
      file: `${base}-修改说明.xlsx`,
    },
    {
      key: 'all',
      title: '全部（一个工作簿）',
      desc: '以上三份合并为一个文件，便于归档。',
      build: buildAllWorkbook,
      file: `${base}-提成测算与体检.xlsx`,
    },
  ];

  return (
    <div class="stack">
      <Card title="导出" sub={<>当前规则：{basisLabel(an.primary.basis)}（对照：{basisLabel(an.comparison.basis)}）。文件在本机生成并直接下载。</>}>
        <div class="export-grid">
          {items.map((it) => (
            <div class="export-item">
              <h4>{it.title}</h4>
              <p class="small muted">{it.desc}</p>
              <button type="button" class="btn primary" disabled={!!busy} onClick={() => void run(it.key, it.build, it.file)}>
                {busy === it.key ? '生成中…' : `下载 ${it.file.replace(`${base}-`, '')}`}
              </button>
            </div>
          ))}
          <div class="export-item">
            <h4>修改说明（文字版）</h4>
            <p class="small muted">复制为纯文本，方便贴到微信或邮件。</p>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                const ok = await copyText(changeNotesText(an));
                setMsg(ok ? '已复制到剪贴板' : '复制失败，请改用下载');
              }}
            >
              复制文字
            </button>
            <button type="button" class="btn ghost" onClick={() => downloadBlob(changeNotesText(an), `${base}-修改说明.txt`, 'text/plain;charset=utf-8')}>
              下载 .txt
            </button>
          </div>
        </div>
        {msg && <p class="small">{msg}</p>}
      </Card>
    </div>
  );
}
