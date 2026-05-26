import type { ReportLine } from "@/lib/reports";
import type { Transaction } from "@/lib/supabase";

export interface AssetRow {
  id: string;
  name: string;
  category: string;
  value: number;
  acquired_on: string | null;
  notes: string | null;
}

export interface LiabilityRow {
  id: string;
  name: string;
  category: string;
  value: number;
  due_on: string | null;
  notes: string | null;
}

const APPROVED = ["Approved", "Auto-Approved"];
const isApproved = (t: Transaction) => APPROVED.includes(t.status);
const isIncome = (t: Transaction) => (t.txn_type ?? "").toLowerCase() === "income";
const isExpense = (t: Transaction) => (t.txn_type ?? "").toLowerCase() === "expense";

/**
 * Combined balance sheet:
 *   - Cash & equivalents derived from approved transactions up to `asOf`
 *   - Pending receivables / payables from `Pending Review` transactions
 *   - Manual asset & liability rows added on top
 */
export const combinedBalanceSheet = (
  txns: Transaction[],
  assets: AssetRow[],
  liabilities: LiabilityRow[],
  asOf: Date,
): ReportLine[] => {
  const upto = txns.filter((t) => {
    if (!isApproved(t)) return false;
    const d = new Date(t.txn_date);
    return !isNaN(d.getTime()) && d <= asOf;
  });
  const totalIncome = upto
    .filter(isIncome)
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const totalExpense = upto
    .filter(isExpense)
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const cash = totalIncome - totalExpense;

  const pendingIncome = txns
    .filter(
      (t) => (t.status ?? "").toLowerCase() === "pending review" && isIncome(t),
    )
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const pendingExpense = txns
    .filter(
      (t) => (t.status ?? "").toLowerCase() === "pending review" && isExpense(t),
    )
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  // Group manual assets by category
  const assetsByCat: Record<string, number> = {};
  assets.forEach((a) => {
    const k = a.category || "Other";
    assetsByCat[k] = (assetsByCat[k] || 0) + Number(a.value || 0);
  });
  const manualAssets = Object.values(assetsByCat).reduce((s, v) => s + v, 0);

  const liabsByCat: Record<string, number> = {};
  liabilities.forEach((l) => {
    const k = l.category || "Other";
    liabsByCat[k] = (liabsByCat[k] || 0) + Number(l.value || 0);
  });
  const manualLiabs = Object.values(liabsByCat).reduce((s, v) => s + v, 0);

  const totalAssets = cash + pendingIncome + manualAssets;
  const totalLiabilities = pendingExpense + manualLiabs;
  const equity = totalAssets - totalLiabilities;

  return [
    { label: "Assets", value: 0, level: 0 },
    { label: "Cash & equivalents", value: cash, level: 2 },
    { label: "Accounts receivable (pending)", value: pendingIncome, level: 2 },
    ...Object.entries(assetsByCat)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: k, value: v, level: 2 as const })),
    { label: "Total Assets", value: totalAssets, level: 3, emphasis: true },

    { label: "Liabilities", value: 0, level: 0 },
    { label: "Accounts payable (pending)", value: pendingExpense, level: 2 },
    ...Object.entries(liabsByCat)
      .sort(([, a], [, b]) => b - a)
      .map(([k, v]) => ({ label: k, value: v, level: 2 as const })),
    { label: "Total Liabilities", value: totalLiabilities, level: 3, emphasis: true },

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
