// 数据模型：Order / Standard / TierTable 以及解析、计算、体检的公共类型。

export const TIERS = ['C1', 'C2', 'B1', 'B2', 'B3', 'A1', 'A2'] as const;
export type Tier = (typeof TIERS)[number];

/** 溢价提成比例：溢价 = (外贸均价 − 内贸均价) × 10% × 数量 */
export const PREMIUM_RATE = 0.1;
/** 边际贡献计算用的增值税除数：不含税均价 = 含税均价 / 1.13 */
export const VAT_DIVISOR = 1.13;

/** 单元格位置，用于体检报告定位（sheet!A1） */
export interface Loc {
  sheet: string;
  addr: string;
}

export interface Order {
  /** 稳定键：公司|月|合同号|型号|序号，用于保存回款标记等补录数据 */
  key: string;
  company: string;
  month: number;
  person: string;
  model: string;
  /** 型号归一键（大写、去空格），用于与汇总、提成计算表匹配 */
  modelKey: string;
  contractQty: number;
  /** 含税单价 */
  price: number;
  /** 运费（每吨） */
  freight: number;
  /** 出厂单价 = 含税单价 − 运费 */
  netPrice: number;
  shipped: number;
  /** 未发数量原值（数字、文字如“合同取消”或空） */
  unshippedRaw: number | string | null;
  customer: string;
  contractNo: string;
  /** 表内回款信息：已回款数量（null 表示表内无回款列或未填写） */
  paidQty: number | null;
  sheet: string;
  row: number;
  cols: Partial<Record<OrderField, string>>;
  formulas: Partial<Record<OrderField, string>>;
}

export type OrderField =
  | 'person'
  | 'date'
  | 'model'
  | 'contractQty'
  | 'price'
  | 'freight'
  | 'netPrice'
  | 'amount'
  | 'contractNo'
  | 'customer'
  | 'shipped'
  | 'unshipped'
  | 'paid';

/** 明细表中各月的汇总块（外贸销售均价 / 内贸销售均价 / 溢价提成 / 实发数量） */
export interface SummaryRow {
  company: string;
  month: number;
  model: string;
  modelKey: string;
  foreignAvg: number | null;
  domesticAvg: number | null;
  premium: number | null;
  shippedQty: number | null;
  note: string;
  sheet: string;
  row: number;
  cols: Partial<Record<SummaryField | 'model' | 'note', string>>;
  formulas: Partial<Record<SummaryField, string>>;
}

export type SummaryField = 'foreignAvg' | 'domesticAvg' | 'premium' | 'shippedQty';

/** 提成计算表中的一行 */
export interface CalcRow {
  company: string;
  month: number;
  model: string;
  modelKey: string;
  qty: number | null;
  avgTax: number | null;
  avgNet: number | null;
  varCost: number | null;
  margin: number | null;
  tier: string | null;
  unitPrice: number | null;
  premium: number | null;
  coef: number | null;
  total: number | null;
  remark: string;
  sheet: string;
  row: number;
  cols: Partial<Record<CalcField, string>>;
  formulas: Partial<Record<CalcField, string>>;
  /** 原始单元格值（非数字时保留文字，便于报告） */
  rawText: Partial<Record<CalcField, string>>;
}

export type CalcField =
  | 'seq'
  | 'model'
  | 'qty'
  | 'avgTax'
  | 'avgNet'
  | 'varCost'
  | 'margin'
  | 'tier'
  | 'unitPrice'
  | 'premium'
  | 'coef'
  | 'total'
  | 'remark';

/** Standard(公司, 月, 型号, 内贸均价, 变动成本, 档级, 单价)：由汇总块与提成计算表按型号合并得到 */
export interface Standard {
  company: string;
  month: number;
  model: string;
  modelKey: string;
  domesticAvg: number | null;
  varCost: number | null;
  tier: string | null;
  unitPrice: number | null;
  summary?: SummaryRow;
  calc?: CalcRow;
}

export interface TierRange {
  tier: Tier;
  lo: number | null;
  hi: number | null;
  loInclusive: boolean;
  hiInclusive: boolean;
  raw: string;
  addr: string;
  /** 格式问题，例如 C1 只写了数字没写“<” */
  formatNote?: string;
}

/** TierTable(公司, 月, 各档下限)；month = null 表示制度原版 */
export interface TierTable {
  company: string;
  month: number | null;
  label: string;
  /** “未修正”：该月沿用制度原版 */
  unmodified: boolean;
  ranges: TierRange[];
  /** 各档下限（C1 为 −∞） */
  lowerBounds: Partial<Record<Tier, number>>;
  /** 例外型号片段，如 “2010除外” → ['2010'] */
  exceptions: string[];
  sheet: string;
  row: number;
}

export interface CompletionData {
  company: string;
  volumeRate: number | null;
  amountRate: number | null;
  volumeTarget: number | null;
  volumeActual: number | null;
  amountTarget: number | null;
  amountActual: number | null;
  source: string;
}

/** 隐藏的月度提成计算表（如“提成计算7月”）里的变动成本，用于核对复制错误 */
export interface CostSource {
  month: number;
  model: string;
  modelKey: string;
  varCost: number;
  sheet: string;
  row: number;
  addr: string;
}

export interface ParseWarning {
  level: 'error' | 'warn' | 'info';
  message: string;
  loc?: Loc;
}

export interface CompanySheets {
  company: string;
  detail: string;
  calc: string;
}

/** 某个单元格所在行对应的型号，用于核对“引用的是否为同一型号” */
export interface RowRole {
  kind: 'order' | 'summary' | 'calc';
  model: string;
  modelKey: string;
  month: number;
  company: string;
}

export interface ParsedWorkbook {
  fileName: string;
  quarterLabel: string;
  companies: string[];
  sheets: CompanySheets[];
  orders: Order[];
  summaries: SummaryRow[];
  calcRows: CalcRow[];
  standards: Standard[];
  tierTables: TierTable[];
  completion: CompletionData[];
  costSources: CostSource[];
  warnings: ParseWarning[];
  /** sheet → 行号(1 起) → 行角色 */
  rowRoles: Record<string, Record<number, RowRole>>;
  /** 提成计算表“合计”行的位置 */
  calcTotalRows: { company: string; sheet: string; row: number; total: number | null; addr: string }[];
  /** 明细表汇总块“合计”行 */
  summaryTotalRows: { company: string; month: number; sheet: string; row: number; premium: number | null; shippedQty: number | null }[];
}

export type QtyBasis = 'contract' | 'shipped' | 'shippedPaid';
export type PriceBasis = 'contract' | 'shipped';
export type CompletionMode = 'none' | 'volume' | 'amount';

export interface CompanyCompletionInput {
  volumeRate: number | null;
  amountRate: number | null;
}

export interface RuleConfig {
  schema: 'commission-checker/rules';
  version: 1;
  qtyBasis: QtyBasis;
  priceBasis: PriceBasis;
  completion: {
    mode: CompletionMode;
    /** 达成率 ≥ full → 系数 1 */
    full: number;
    /** floor ≤ 达成率 < full → 系数 = 达成率；< floor → 0 */
    floor: number;
    /** 各公司完成率（小数，0.71 表示 71%）；为空时取表内数据 */
    perCompany: Record<string, CompanyCompletionInput>;
  };
  premiumNeedsTarget: boolean;
  personMerge: { from: string; to: string }[];
  relatedCustomers: string[];
  missingUnitPrice: 'pending';
  supplements: {
    /** 补录提成单价：键 公司|月|型号键 */
    unitPrice: Record<string, number>;
    /** 补录内贸均价：键 公司|月|型号键 */
    domesticAvg: Record<string, number>;
    /** 回款标记：键 订单 key → 已回款数量（吨）；true 表示全部回款 */
    paid: Record<string, number | boolean>;
  };
}

export type Severity = 'high' | 'medium' | 'low';

export interface Issue {
  id: string;
  severity: Severity;
  category: string;
  company: string;
  month: number | null;
  model: string;
  location: string;
  original: string;
  expected: string;
  /** 对部门提成（原表口径：出库数量 × 合同均价）的影响，正数 = 应增加；null = 无法估算/待补 */
  impact: number | null;
  impactNote: string;
  message: string;
  suggestion: string;
}
