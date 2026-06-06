import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileCheck2, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Transaction } from "@/lib/supabase";
import { downloadCsv } from "@/lib/exporters";
import { toast } from "@/components/ui/use-toast";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const APPROVED = ["Approved", "Auto-Approved"];
const VAT_RATE = 0.16;

const filings = [
  { period: "2025-09", filed: "2025-10-20", status: "Filed", ref: "VAT3-2025-09-7842" },
  { period: "2025-08", filed: "2025-09-19", status: "Filed", ref: "VAT3-2025-08-7611" },
  { period: "2025-07", filed: "2025-08-18", status: "Filed", ref: "VAT3-2025-07-7388" },
];

// Generate last 12 months as selectable options
const buildPeriodOptions = () => {
  const options: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return options;
};

export const VatTab = ({ txns }: { txns: Transaction[] }) => {
  const periodOptions = useMemo(() => buildPeriodOptions(), []);

  const [periodIdx, setPeriodIdx] = useState(1); // default to previous month
  const period = periodOptions[periodIdx];

  const { outputVat, inputVat, salesTotal, purchasesTotal } = useMemo(() => {
    const monthStart = new Date(period + "-01");
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
    const inWindow = txns.filter((t) => {
      if (!APPROVED.includes(t.status)) return false;
      const d = new Date(t.txn_date);
      return !isNaN(d.getTime()) && d >= monthStart && d <= monthEnd;
    });
    const salesTotal = inWindow
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const purchasesTotal = inWindow
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    return {
      salesTotal,
      purchasesTotal,
      outputVat: (salesTotal / (1 + VAT_RATE)) * VAT_RATE,
      inputVat: (purchasesTotal / (1 + VAT_RATE)) * VAT_RATE,
    };
  }, [txns, period]);

  const payable = Math.max(0, outputVat - inputVat);

  const generateVat3 = () => {
    downloadCsv(
      `VAT3-${period}.csv`,
      ["Field", "Amount (KES)"],
      [
        ["Gross Sales", Math.round(salesTotal)],
        ["Output VAT (Sales)", Math.round(outputVat)],
        ["Gross Purchases", Math.round(purchasesTotal)],
        ["Input VAT (Purchases)", Math.round(inputVat)],
        ["Net VAT Payable", Math.round(payable)],
      ],
    );
    toast({ title: "VAT3 draft generated", description: `Period ${period} ready for KRA iTax filing.` });
  };

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-medium text-muted-foreground">Period:</p>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1">
          <button
            onClick={() => setPeriodIdx((i) => Math.min(i + 1, periodOptions.length - 1))}
            disabled={periodIdx >= periodOptions.length - 1}
            className="rounded p-1 hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[80px] text-center text-sm font-semibold">{period}</span>
          <button
            onClick={() => setPeriodIdx((i) => Math.max(i - 1, 0))}
            disabled={periodIdx <= 0}
            className="rounded p-1 hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {txns.filter((t) => {
            const d = new Date(t.txn_date);
            const ms = new Date(period + "-01");
            const me = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
            return APPROVED.includes(t.status) && !isNaN(d.getTime()) && d >= ms && d <= me;
          }).length} transactions in this period
        </span>
      </div>

      {/* VAT Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output VAT</p>
            <Receipt className="h-4 w-4 text-shield" />
          </div>
          <p className="mt-2 text-2xl font-bold">{fmtKES(outputVat)}</p>
          <p className="mt-1 text-xs text-muted-foreground">From sales · 16% · Gross: {fmtKES(salesTotal)}</p>
        </Card>
        <Card className="border border-border/60 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input VAT</p>
            <Receipt className="h-4 w-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold">{fmtKES(inputVat)}</p>
          <p className="mt-1 text-xs text-muted-foreground">From purchases · 16% · Gross: {fmtKES(purchasesTotal)}</p>
        </Card>
        <Card className="border-2 border-primary/30 bg-primary/5 p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net VAT Payable</p>
            <FileCheck2 className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{fmtKES(payable)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Period {period}</p>
        </Card>
      </div>

      {/* VAT3 Generator */}
      <Card className="border border-border/60 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">VAT3 Return Generator</h3>
            <p className="text-xs text-muted-foreground">
              Generate the iTax-ready return for {period}. Due by the 20th of next month.
            </p>
          </div>
          <Button onClick={generateVat3} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="h-4 w-4" />
            Generate VAT3
          </Button>
        </div>
      </Card>

      {/* Filing History */}
      <Card className="border border-border/60 p-5 shadow-card">
        <h3 className="text-base font-semibold text-foreground">Filing History</h3>
        <ul className="mt-3 divide-y divide-border">
          {filings.map((f) => (
            <li key={f.ref} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Period {f.period}</p>
                <p className="text-[11px] text-muted-foreground">
                  Filed {f.filed} · Ref {f.ref}
                </p>
              </div>
              <Badge variant="outline"
                className="gap-1 border-success/30 bg-success/10 text-[10px] font-semibold uppercase tracking-wide text-success">
                {f.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};