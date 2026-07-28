import { Transaction } from "./supabase";
import {
  addDays,
  differenceInDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

export const APPROVED = ["Approved", "Auto-Approved"];

export const isIncome = (t: Transaction) =>
  (t.txn_type ?? "").toLowerCase() === "income";
export const isExpense = (t: Transaction) =>
  (t.txn_type ?? "").toLowerCase() === "expense";

export const txnDate = (t: Transaction) => {
  // txn_date is "YYYY-MM-DD"
  return parseISO(t.txn_date);
};

export const onlyApproved = (rows: Transaction[]) =>
  rows.filter((t) => APPROVED.includes(t.status));

// ----------- Daily series -----------
export type DailyPoint = {
  date: string; // YYYY-MM-DD
  income: number;
  expenses: number;
  net: number;
};

export function buildDailySeries(
  rows: Transaction[],
  days = 90,
): DailyPoint[] {
  const today = new Date();
  const start = addDays(today, -days + 1);
  const map = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = format(addDays(start, i), "yyyy-MM-dd");
    map.set(d, { date: d, income: 0, expenses: 0, net: 0 });
  }
  for (const t of onlyApproved(rows)) {
    const d = t.txn_date?.slice(0, 10);
    const point = map.get(d);
    if (!point) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    if (isIncome(t)) point.income += amt;
    else if (isExpense(t)) point.expenses += amt;
    point.net = point.income - point.expenses;
  }
  return [...map.values()];
}

// ----------- Monthly series (for Revenue vs Expenses / Monthly P&L) -----------
export type MonthlyPoint = {
  month: string; // "yyyy-MM"
  label: string; // "Jan 2026"
  income: number;
  expenses: number;
  net: number;
};

export function buildMonthlySeries(rows: Transaction[], months = 6): MonthlyPoint[] {
  const now = new Date();
  const points: MonthlyPoint[] = [];
  const map = new Map<string, MonthlyPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = startOfMonth(subMonths(now, i));
    const key = format(d, "yyyy-MM");
    const point: MonthlyPoint = { month: key, label: format(d, "MMM yyyy"), income: 0, expenses: 0, net: 0 };
    map.set(key, point);
    points.push(point);
  }
  for (const t of onlyApproved(rows)) {
    const key = t.txn_date?.slice(0, 7);
    const point = map.get(key);
    if (!point) continue;
    const amt = Math.abs(Number(t.amount) || 0);
    if (isIncome(t)) point.income += amt;
    else if (isExpense(t)) point.expenses += amt;
    point.net = point.income - point.expenses;
  }
  return points;
}

/** Net profit (income - expenses) from the start of the current calendar year to today. */
export function ytdNetProfit(rows: Transaction[]): number {
  const yearStart = startOfYear(new Date());
  const approved = onlyApproved(rows).filter((t) => !isBefore(txnDate(t), yearStart));
  const inc = approved.filter(isIncome).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const exp = approved.filter(isExpense).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  return inc - exp;
}

// ----------- Forecasting -----------
// Simple moving average + Kenyan seasonality factors.
// Seasonality: end-of-month payroll spikes (last 3 days), tax filing weeks
// (around the 9th & 20th — PAYE/VAT in Kenya), and December holiday lift.
export function seasonalFactor(date: Date): number {
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  let factor = 1.0;
  // Month-end payroll bump
  const lastDay = endOfMonth(date).getDate();
  if (day >= lastDay - 2) factor *= 1.15;
  // PAYE filing week (around the 9th)
  if (day >= 7 && day <= 9) factor *= 1.08;
  // VAT filing week (around the 20th)
  if (day >= 18 && day <= 20) factor *= 1.06;
  // December holiday lift (income side)
  if (month === 11) factor *= 1.12;
  // April Easter softness
  if (month === 3 && day >= 1 && day <= 7) factor *= 0.95;
  return factor;
}

export type ForecastPoint = {
  date: string;
  forecastIncome: number;
  forecastExpenses: number;
  forecastNet: number;
  forecastBalance: number;
  isForecast: true;
};

export function forecastNextDays(
  history: DailyPoint[],
  daysAhead: number,
  openingBalance: number,
  windowSize = 28,
): ForecastPoint[] {
  if (!history.length) return [];
  const recent = history.slice(-windowSize);
  const avgIncome =
    recent.reduce((s, p) => s + p.income, 0) / recent.length || 0;
  const avgExpenses =
    recent.reduce((s, p) => s + p.expenses, 0) / recent.length || 0;

  const out: ForecastPoint[] = [];
  let runningBalance = openingBalance;
  const lastDate = parseISO(history[history.length - 1].date);
  for (let i = 1; i <= daysAhead; i++) {
    const d = addDays(lastDate, i);
    const factor = seasonalFactor(d);
    const fi = avgIncome * factor;
    const fe = avgExpenses * factor;
    const net = fi - fe;
    runningBalance += net;
    out.push({
      date: format(d, "yyyy-MM-dd"),
      forecastIncome: fi,
      forecastExpenses: fe,
      forecastNet: net,
      forecastBalance: runningBalance,
      isForecast: true,
    });
  }
  return out;
}

// ----------- Category breakdowns -----------
export type CategoryRow = {
  category: string;
  amount: number;
  share: number; // 0..1
  count: number;
};

export function categoryBreakdown(
  rows: Transaction[],
  type: "income" | "expense",
): CategoryRow[] {
  const filtered = onlyApproved(rows).filter((t) =>
    type === "income" ? isIncome(t) : isExpense(t),
  );
  const m = new Map<string, { amount: number; count: number }>();
  for (const t of filtered) {
    const key = t.category || "Uncategorized";
    const cur = m.get(key) ?? { amount: 0, count: 0 };
    cur.amount += Math.abs(Number(t.amount) || 0);
    cur.count += 1;
    m.set(key, cur);
  }
  const total = [...m.values()].reduce((s, v) => s + v.amount, 0) || 1;
  return [...m.entries()]
    .map(([category, v]) => ({
      category,
      amount: v.amount,
      count: v.count,
      share: v.amount / total,
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ----------- Source / channel split -----------
export type SourceRow = { source: string; amount: number; share: number };

export function sourceBreakdown(rows: Transaction[]): SourceRow[] {
  const filtered = onlyApproved(rows).filter(isIncome);
  const m = new Map<string, number>();
  for (const t of filtered) {
    const key = (t as any).source_bank || (t as any).source || "Unknown";
    m.set(key, (m.get(key) || 0) + Math.abs(Number(t.amount) || 0));
  }
  const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
  return [...m.entries()]
    .map(([source, amount]) => ({ source, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

// ----------- Budget vs actual (auto-derive) -----------
export type BudgetRow = {
  category: string;
  budget: number; // 3-mo rolling average
  actual: number; // current month
  variance: number; // actual - budget
  utilisation: number; // actual / budget
};

export function budgetVsActual(rows: Transaction[]): BudgetRow[] {
  const approved = onlyApproved(rows).filter(isExpense);
  const now = new Date();
  const startThis = startOfMonth(now);
  const startBudget = startOfMonth(subMonths(now, 3));
  const endBudget = endOfMonth(subMonths(now, 1));

  const monthly: Record<string, number> = {};
  const currentMonth: Record<string, number> = {};

  for (const t of approved) {
    const d = txnDate(t);
    const key = t.category || "Uncategorized";
    const amt = Math.abs(Number(t.amount) || 0);
    if (
      (isAfter(d, startBudget) || +d === +startBudget) &&
      (isBefore(d, endBudget) || +d === +endBudget)
    ) {
      monthly[key] = (monthly[key] ?? 0) + amt;
    }
    if (isAfter(d, startThis) || +d === +startThis) {
      currentMonth[key] = (currentMonth[key] ?? 0) + amt;
    }
  }

  const cats = new Set([
    ...Object.keys(monthly),
    ...Object.keys(currentMonth),
  ]);
  return [...cats]
    .map((category) => {
      const budget = (monthly[category] ?? 0) / 3;
      const actual = currentMonth[category] ?? 0;
      return {
        category,
        budget,
        actual,
        variance: actual - budget,
        utilisation: budget > 0 ? actual / budget : actual > 0 ? 1 : 0,
      };
    })
    .sort((a, b) => b.actual - a.actual);
}

// ----------- KPI summary for any window -----------
export type KpiSummary = {
  income: number;
  expenses: number;
  net: number;
  txnCount: number;
  avgTxn: number;
  topIncomeCategory: string | null;
  topExpenseCategory: string | null;
  mpesaShare: number;
  pendingCount: number;
};

export function summarise(rows: Transaction[], windowDays = 30): KpiSummary {
  const since = addDays(new Date(), -windowDays);
  const window = rows.filter((t) => isAfter(txnDate(t), since));
  const approved = onlyApproved(window);
  const income = approved.filter(isIncome);
  const expenses = approved.filter(isExpense);

  const inc = income.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const exp = expenses.reduce(
    (s, t) => s + Math.abs(Number(t.amount) || 0),
    0,
  );

  const incomeCat = categoryBreakdown(window, "income")[0]?.category ?? null;
  const expenseCat = categoryBreakdown(window, "expense")[0]?.category ?? null;

  const sources = sourceBreakdown(window);
  const mpesa =
    sources.find((s) => /m-?pesa/i.test(s.source))?.share ?? 0;

  const pendingCount = rows.filter(
    (t) => (t.status ?? "").toLowerCase() === "pending review",
  ).length;

  return {
    income: inc,
    expenses: exp,
    net: inc - exp,
    txnCount: approved.length,
    avgTxn: approved.length ? (inc + exp) / approved.length : 0,
    topIncomeCategory: incomeCat,
    topExpenseCategory: expenseCat,
    mpesaShare: mpesa,
    pendingCount,
  };
}

// ----------- Insights (rule-based) -----------
export type Insight = {
  id: string;
  severity: "positive" | "warning" | "info";
  title: string;
  message: string;
};

export function generateInsights(
  rows: Transaction[],
  budgets: BudgetRow[],
  forecast: ForecastPoint[],
  summary: KpiSummary,
): Insight[] {
  const out: Insight[] = [];

  // Cashflow trend
  if (summary.net > 0) {
    out.push({
      id: "net-positive",
      severity: "positive",
      title: "Positive net cashflow",
      message: `Last 30 days you netted KSh ${Math.round(summary.net).toLocaleString("en-KE")}. Reinvest or build a 3-month buffer.`,
    });
  } else if (summary.net < 0) {
    out.push({
      id: "net-negative",
      severity: "warning",
      title: "Spending exceeded income",
      message: `You spent KSh ${Math.round(Math.abs(summary.net)).toLocaleString("en-KE")} more than you earned in the last 30 days. Review top expenses.`,
    });
  }

  // Forecast warning
  const minBalance = forecast.reduce(
    (m, p) => Math.min(m, p.forecastBalance),
    Infinity,
  );
  if (forecast.length && minBalance < 0) {
    const breach = forecast.find((p) => p.forecastBalance < 0);
    if (breach) {
      const days = differenceInDays(parseISO(breach.date), new Date());
      out.push({
        id: "forecast-breach",
        severity: "warning",
        title: "Cash shortfall predicted",
        message: `Projected balance turns negative in ~${days} days. Pull receivables forward or delay non-critical spend.`,
      });
    }
  } else if (forecast.length) {
    out.push({
      id: "forecast-healthy",
      severity: "positive",
      title: "Healthy 90-day outlook",
      message: `Forecast keeps your balance above zero across the next ${forecast.length} days based on current trends.`,
    });
  }

  // Budget overruns
  const overruns = budgets.filter((b) => b.utilisation > 1.1 && b.budget > 0);
  if (overruns.length) {
    const worst = overruns[0];
    out.push({
      id: "budget-overrun",
      severity: "warning",
      title: `${worst.category} over budget`,
      message: `${worst.category} is at ${Math.round(worst.utilisation * 100)}% of its 3-month average. Consider tightening this category.`,
    });
  }

  // Channel concentration
  if (summary.mpesaShare > 0.7) {
    out.push({
      id: "mpesa-heavy",
      severity: "info",
      title: "Heavy M-Pesa reliance",
      message: `${Math.round(summary.mpesaShare * 100)}% of income came via M-Pesa. Diversifying channels reduces transaction-fee exposure.`,
    });
  }

  // Pending reviews
  if (summary.pendingCount > 0) {
    out.push({
      id: "pending",
      severity: "info",
      title: `${summary.pendingCount} pending reviews`,
      message: `Approve or reject pending transactions to keep your books clean.`,
    });
  }

  // Top expense category
  if (summary.topExpenseCategory) {
    out.push({
      id: "top-expense",
      severity: "info",
      title: `Largest cost: ${summary.topExpenseCategory}`,
      message: `This category drives the most outflow over the last 30 days. Negotiate or batch payments to save.`,
    });
  }

  return out.slice(0, 6);
}

// ----------- CSV export -----------
export function toCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}