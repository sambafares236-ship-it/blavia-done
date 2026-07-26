import { Transaction } from "@/lib/supabase";

export interface ReportLine {
  label: string;
  value: number;
  /** Indent level (0=section, 1=group, 2=line, 3=total) */
  level?: 0 | 1 | 2 | 3;
  /** Render as a bold subtotal/total */
  emphasis?: boolean;
}

const APPROVED = ["Approved", "Auto-Approved"];

const isApproved = (t: Transaction) => APPROVED.includes(t.status);
const isIncome = (t: Transaction) => (t.txn_type ?? "").toLowerCase() === "income";
const isExpense = (t: Transaction) => (t.txn_type ?? "").toLowerCase() === "expense";

const sumBy = (txns: Transaction[], pred: (t: Transaction) => boolean) =>
  txns.filter(pred).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

const groupByCategory = (
  txns: Transaction[],
  pred: (t: Transaction) => boolean,
): Record<string, number> => {
  const out: Record<string, number> = {};
  txns.filter(pred).forEach((t) => {
    const cat = t.category || "Uncategorized";
    out[cat] = (out[cat] || 0) + Math.abs(Number(t.amount) || 0);
  });
  return out;
};

export const filterByDateRange = (
  txns: Transaction[],
  from: Date,
  to: Date,
): Transaction[] =>
  txns.filter((t) => {
    const d = new Date(t.txn_date);
    return !isNaN(d.getTime()) && d >= from && d <= to;
  });

/** Classify an expense category into a P&L bucket. */
const COGS_KEYS = [
  "cogs",
  "cost of goods",
  "cost of sales",
  "inventory",
  "raw material",
  "purchases",
  "direct cost",
  "merchandise",
];
const FINANCE_KEYS = [
  "loan",
  "interest",
  "bank charge",
  "bank fee",
  "finance",
  "overdraft",
  "forex loss",
];
const OPEX_KEYWORDS = [
  "rent",
  "salaries",
  "salary",
  "wages",
  "payroll",
  "electricity",
  "utilities",
  "water",
  "marketing",
  "advertising",
  "internet",
  "telephone",
  "communication",
  "professional fees",
  "legal",
  "audit",
  "consult",
  "depreciation",
  "amortisation",
  "amortization",
  "insurance",
  "office",
  "stationery",
  "repairs",
  "maintenance",
  "transport",
  "travel",
  "fuel",
  "subscription",
  "software",
];

type ExpenseBucket = "cogs" | "finance" | "opex";
const classifyExpense = (category: string | null | undefined): ExpenseBucket => {
  const c = (category ?? "").toLowerCase();
  if (COGS_KEYS.some((k) => c.includes(k))) return "cogs";
  if (FINANCE_KEYS.some((k) => c.includes(k))) return "finance";
  return "opex";
};

/** Standard Operating Expense lines we always show, even if zero. */
const STANDARD_OPEX = [
  "Rent",
  "Salaries & Wages",
  "Electricity",
  "Marketing",
  "Internet & Telephone",
  "Professional Fees",
  "Depreciation",
];

const matchesStandardOpex = (category: string, standard: string): boolean => {
  const c = category.toLowerCase();
  const s = standard.toLowerCase();
  if (c.includes(s)) return true;
  if (s === "salaries & wages") return /salar|wage|payroll/.test(c);
  if (s === "internet & telephone") return /internet|telephone|communication/.test(c);
  if (s === "professional fees") return /professional|legal|audit|consult/.test(c);
  if (s === "marketing") return /market|advertis/.test(c);
  if (s === "electricity") return /electric|utilit|power/.test(c);
  if (s === "depreciation") return /depreciation|amortis|amortiz/.test(c);
  return false;
};

export type CompanyType = "local" | "international";

/** Corporate Income Tax rates (Kenya) */
export const TAX_RATES: Record<CompanyType, number> = {
  local: 0.30,
  international: 0.375,
};

/** Profit & Loss / Income Statement lines */
export const profitAndLoss = (
  txns: Transaction[],
  companyType: CompanyType = "local",
): ReportLine[] => {
  const approved = txns.filter(isApproved);

  // Revenue
  const incomeByCat = groupByCategory(approved, isIncome);
  const totalRevenue = Object.values(incomeByCat).reduce((s, v) => s + v, 0);

  // Bucket expenses
  const cogsByCat: Record<string, number> = {};
  const opexByCat: Record<string, number> = {};
  const financeByCat: Record<string, number> = {};
  approved.filter(isExpense).forEach((t) => {
    const bucket = classifyExpense(t.category);
    const cat = t.category || "Uncategorized";
    const amt = Math.abs(Number(t.amount) || 0);
    const target =
      bucket === "cogs" ? cogsByCat : bucket === "finance" ? financeByCat : opexByCat;
    target[cat] = (target[cat] || 0) + amt;
  });

  const totalCogs = Object.values(cogsByCat).reduce((s, v) => s + v, 0);
  const grossProfit = totalRevenue - totalCogs;

  // Build operating expense lines: standard rows + any extras
  const opexEntries = Object.entries(opexByCat);
  const standardLines = STANDARD_OPEX.map((std) => {
    const matched = opexEntries
      .filter(([cat]) => matchesStandardOpex(cat, std))
      .reduce((s, [, v]) => s + v, 0);
    return { label: std, value: matched, level: 2 as const };
  });
  const matchedCats = new Set(
    opexEntries
      .filter(([cat]) => STANDARD_OPEX.some((std) => matchesStandardOpex(cat, std)))
      .map(([cat]) => cat),
  );
  const extraOpex = opexEntries
    .filter(([cat]) => !matchedCats.has(cat))
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => ({ label: k, value: v, level: 2 as const }));
  const totalOpex = Object.values(opexByCat).reduce((s, v) => s + v, 0);
  const operatingProfit = grossProfit - totalOpex;

  const totalFinance = Object.values(financeByCat).reduce((s, v) => s + v, 0);
  const profitBeforeTax = operatingProfit - totalFinance;

  const taxRate = TAX_RATES[companyType];
  const taxExpense = profitBeforeTax > 0 ? profitBeforeTax * taxRate : 0;
  const netProfit = profitBeforeTax - taxExpense;

  const lines: ReportLine[] = [
    { label: "Revenue", value: 0, level: 0 },
    ...Object.entries(incomeByCat)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: k, value: v, level: 2 as const })),
    { label: "Total Revenue", value: totalRevenue, level: 3, emphasis: true },

    { label: "Cost of Goods Sold", value: 0, level: 0 },
    ...(Object.entries(cogsByCat).length
      ? Object.entries(cogsByCat)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => ({ label: k, value: -v, level: 2 as const }))
      : [{ label: "Cost of Goods Sold", value: 0, level: 2 as const }]),
    { label: "Total Cost of Goods Sold", value: -totalCogs, level: 3, emphasis: true },

    { label: "Gross Profit", value: grossProfit, level: 3, emphasis: true },

    { label: "Operating Expenses", value: 0, level: 0 },
    ...standardLines.map((l) => ({ ...l, value: -l.value })),
    ...extraOpex.map((l) => ({ ...l, value: -l.value })),
    { label: "Total Operating Expenses", value: -totalOpex, level: 3, emphasis: true },

    { label: "Operating Profit / (Loss)", value: operatingProfit, level: 3, emphasis: true },

    { label: "Finance Costs", value: 0, level: 0 },
    ...(Object.entries(financeByCat).length
      ? Object.entries(financeByCat)
          .sort(([, a], [, b]) => b - a)
          .map(([k, v]) => ({ label: k, value: -v, level: 2 as const }))
      : [
          { label: "Loan interest", value: 0, level: 2 as const },
          { label: "Bank charges", value: 0, level: 2 as const },
        ]),
    { label: "Total Finance Costs", value: -totalFinance, level: 3, emphasis: true },

    { label: "Profit Before Taxation", value: profitBeforeTax, level: 3, emphasis: true },

    { label: "Taxation", value: 0, level: 0 },
    {
      label: `Income Tax Expense (${companyType === "local" ? "Local 30%" : "International 37.5%"})`,
      value: -taxExpense,
      level: 2,
    },

    { label: "Net Profit / (Loss)", value: netProfit, level: 3, emphasis: true },
  ];
  return lines;
};

/** Statement of Changes in Equity */
export const changesInEquity = (
  txns: Transaction[],
  companyType: CompanyType = "local",
  openingEquity = 0,
  capitalInjection = 0,
  dividends = 0,
): ReportLine[] => {
  const pl = profitAndLoss(txns, companyType);
  const netProfit = pl.find((l) => l.label === "Net Profit / (Loss)")?.value ?? 0;
  const closing = openingEquity + capitalInjection + netProfit - dividends;
  return [
    { label: "Equity Movements", value: 0, level: 0 },
    { label: "Opening Balance (Retained Earnings)", value: openingEquity, level: 2 },
    { label: "Capital Injections / Share Issues", value: capitalInjection, level: 2 },
    { label: "Profit / (Loss) for the Period", value: netProfit, level: 2 },
    { label: "Less: Dividends / Drawings", value: -dividends, level: 2 },
    { label: "Closing Equity Balance", value: closing, level: 3, emphasis: true },
  ];
};

/** Cash Flow statement lines */
export const cashFlow = (txns: Transaction[]): ReportLine[] => {
  const approved = txns.filter(isApproved);

  const opIncome = sumBy(approved, (t) => isIncome(t));
  const opExpense = sumBy(approved, (t) => isExpense(t));
  const operating = opIncome - opExpense;

  // Channel split (M-Pesa vs Bank vs Cash)
  const channel = (t: Transaction) =>
    (t.source_bank || "Other").toString();

  const inflowByChannel = approved
    .filter(isIncome)
    .reduce<Record<string, number>>((acc, t) => {
      const c = channel(t);
      acc[c] = (acc[c] || 0) + Math.abs(Number(t.amount) || 0);
      return acc;
    }, {});

  const outflowByChannel = approved
    .filter(isExpense)
    .reduce<Record<string, number>>((acc, t) => {
      const c = channel(t);
      acc[c] = (acc[c] || 0) + Math.abs(Number(t.amount) || 0);
      return acc;
    }, {});

  return [
    { label: "Operating Activities", value: 0, level: 0 },
    { label: "Cash inflow from customers", value: opIncome, level: 2 },
    { label: "Cash paid for expenses", value: -opExpense, level: 2 },
    {
      label: "Net Cash from Operations",
      value: operating,
      level: 3,
      emphasis: true,
    },
    { label: "Inflows by Channel", value: 0, level: 0 },
    ...Object.entries(inflowByChannel)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: k, value: v, level: 2 as const })),
    { label: "Outflows by Channel", value: 0, level: 0 },
    ...Object.entries(outflowByChannel)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: k, value: -v, level: 2 as const })),
    { label: "Net Change in Cash", value: operating, level: 3, emphasis: true },
  ];
};

/** Simplified Balance Sheet (cash-basis) */
export const balanceSheet = (
  allTxns: Transaction[],
  asOf: Date,
): ReportLine[] => {
  // Cumulative net cash up to asOf = retained earnings ≈ cash balance
  const upto = allTxns.filter((t) => {
    if (!isApproved(t)) return false;
    const d = new Date(t.txn_date);
    return !isNaN(d.getTime()) && d <= asOf;
  });
  const totalIncome = sumBy(upto, isIncome);
  const totalExpense = sumBy(upto, isExpense);
  const cash = totalIncome - totalExpense;

  // Pending receivables/payables (Pending Review)
  const pendingIncome = allTxns
    .filter(
      (t) =>
        (t.status ?? "").toLowerCase() === "pending review" && isIncome(t),
    )
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const pendingExpense = allTxns
    .filter(
      (t) =>
        (t.status ?? "").toLowerCase() === "pending review" && isExpense(t),
    )
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  const totalAssets = cash + pendingIncome;
  const totalLiabilities = pendingExpense;
  const equity = totalAssets - totalLiabilities;

  return [
    { label: "Assets", value: 0, level: 0 },
    { label: "Cash & equivalents", value: cash, level: 2 },
    { label: "Accounts receivable (pending)", value: pendingIncome, level: 2 },
    { label: "Total Assets", value: totalAssets, level: 3, emphasis: true },
    { label: "Liabilities", value: 0, level: 0 },
    { label: "Accounts payable (pending)", value: pendingExpense, level: 2 },
    {
      label: "Total Liabilities",
      value: totalLiabilities,
      level: 3,
      emphasis: true,
    },
    { label: "Equity", value: 0, level: 0 },
    { label: "Retained earnings", value: equity, level: 2 },
    { label: "Total Equity", value: equity, level: 3, emphasis: true },
    {
      label: "Liabilities + Equity",
      value: totalLiabilities + equity,
      level: 3,
      emphasis: true,
    },
  ];
};

export const linesToCsv = (lines: ReportLine[]): string => {
  const rows = [["Account", "Amount (KES)"]];
  lines.forEach((l) => {
    if (l.value === 0 && l.level === 0) {
      rows.push([l.label, ""]);
    } else {
      rows.push([l.label, String(Math.round(l.value))]);
    }
  });
  return rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
};

export const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Print only the report card → PDF via window.print() */
export const downloadPdf = (elementId: string, title: string) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return;
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; color: #0f172a; }
          h1 { font-size: 22px; margin: 0 0 4px; }
          .sub { color: #64748b; font-size: 12px; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 6px 8px; font-size: 13px; }
          tr.section td { font-weight: 700; padding-top: 14px; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: .05em; }
          tr.line td { border-bottom: 1px solid #f1f5f9; }
          tr.line td.indent { padding-left: 20px; color: #334155; }
          tr.total td { border-top: 2px solid #0f172a; font-weight: 700; padding-top: 8px; }
          td.amt { text-align: right; font-variant-numeric: tabular-nums; }
          .neg { color: #dc2626; }
        </style>
      </head>
      <body>${el.outerHTML}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 250);
};
