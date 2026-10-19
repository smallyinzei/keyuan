// SheetJS 工作表的稀疏行视图，以及公式引用解析。
import * as XLSX from 'xlsx';
import { normText, toNumber } from './text';

export interface Cell {
  r: number;
  c: number;
  v: unknown;
  t: string;
  f?: string;
  w?: string;
}

export function colName(c: number): string {
  return XLSX.utils.encode_col(c);
}

export function colIndex(name: string): number {
  return XLSX.utils.decode_col(name);
}

export function addr(r: number, c: number): string {
  return XLSX.utils.encode_cell({ r, c });
}

/** 只遍历实际存在的单元格（避免 A1:XFD79 这类虚大区域） */
export class SheetGrid {
  readonly rows = new Map<number, Map<number, Cell>>();
  readonly rowIndex: number[];

  constructor(
    readonly name: string,
    ws: XLSX.WorkSheet,
    readonly hidden: boolean,
  ) {
    for (const key of Object.keys(ws)) {
      if (key[0] === '!') continue;
      const raw = ws[key] as XLSX.CellObject;
      const { r, c } = XLSX.utils.decode_cell(key);
      const cell: Cell = { r, c, v: raw.v, t: raw.t, f: raw.f, w: raw.w };
      if (cell.t === 'z' && !cell.f) continue;
      if (cell.t === 's' && normText(cell.v) === '' && !cell.f) continue;
      let row = this.rows.get(r);
      if (!row) this.rows.set(r, (row = new Map()));
      row.set(c, cell);
    }
    this.rowIndex = [...this.rows.keys()].sort((a, b) => a - b);
  }

  get(r: number, c: number): Cell | undefined {
    return this.rows.get(r)?.get(c);
  }

  rowCells(r: number): Cell[] {
    const row = this.rows.get(r);
    if (!row) return [];
    return [...row.values()].sort((a, b) => a.c - b.c);
  }

  text(r: number, c: number | undefined): string {
    if (c === undefined) return '';
    const cell = this.get(r, c);
    if (!cell || cell.t === 'e') return '';
    return normText(cell.v);
  }

  num(r: number, c: number | undefined): number | null {
    if (c === undefined) return null;
    const cell = this.get(r, c);
    if (!cell || cell.t === 'e' || cell.t === 'b') return null;
    return toNumber(cell.v);
  }

  formula(r: number, c: number | undefined): string | undefined {
    if (c === undefined) return undefined;
    const f = this.get(r, c)?.f;
    return f ? `=${f.replace(/^=/, '')}` : undefined;
  }

  isError(r: number, c: number | undefined): boolean {
    return c !== undefined && this.get(r, c)?.t === 'e';
  }
}

export interface FormulaRef {
  sheet?: string;
  col: string;
  row: number;
  c: number;
  r: number;
  /** 行号前有 $（绝对引用），如 $M$1 */
  rowAbs: boolean;
  /** 区域终点（如 SUM(G19:G23)） */
  end?: { col: string; row: number; c: number; r: number };
}

const REF_RE =
  /(?:(?:'((?:[^']|'')+)'|([A-Za-z0-9_.一-鿿]+))!)?\$?([A-Z]{1,3})(\$?)(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?/g;

/** 取公式中的单元格引用（忽略字符串常量与函数名） */
export function parseRefs(formula: string): FormulaRef[] {
  const src = formula.replace(/^=/, '').replace(/"(?:[^"]|"")*"/g, '""');
  const out: FormulaRef[] = [];
  REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REF_RE.exec(src))) {
    const [whole, quoted, bare, col, rowDollar, row, col2, row2] = m;
    const before = src[m.index - 1];
    const after = src[m.index + whole.length];
    // LOG10( 这类函数名、或标识符中间的片段，不是单元格引用
    if (after === '(' || (after && /[A-Za-z0-9_]/.test(after))) continue;
    const hasSheet = quoted !== undefined || bare !== undefined;
    if (!hasSheet && before && /[A-Za-z0-9_.一-鿿]/.test(before)) continue;
    const sheet = quoted !== undefined ? quoted.replace(/''/g, "'") : bare;
    const ref: FormulaRef = {
      sheet,
      col,
      row: Number(row),
      c: colIndex(col),
      r: Number(row) - 1,
      rowAbs: rowDollar === '$',
    };
    if (col2 && row2) ref.end = { col: col2, row: Number(row2), c: colIndex(col2), r: Number(row2) - 1 };
    out.push(ref);
  }
  return out;
}

/** 公式形如 =X-(...) 或 =X-Y 时取首个数字常量 X（变动成本“基数”） */
export function leadingConstant(formula: string | undefined): number | null {
  if (!formula) return null;
  const m = formula.replace(/^=/, '').match(/^\s*\(?\s*(-?\d+(?:\.\d+)?(?:E[-+]?\d+)?)/i);
  return m ? Number(m[1]) : null;
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(data, {
    type: 'array',
    cellFormula: true,
    cellNF: false,
    cellHTML: false,
    cellStyles: false,
    cellDates: false,
    sheetStubs: false,
  });
}

export function sheetHidden(wb: XLSX.WorkBook, name: string): boolean {
  const idx = wb.SheetNames.indexOf(name);
  const meta = wb.Workbook?.Sheets?.[idx];
  return !!meta && !!meta.Hidden;
}
