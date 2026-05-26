import { useMemo } from "react";
import { Building2, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Transaction } from "@/lib/supabase";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const APPROVED = ["Approved", "Auto-Approved"];
const RATE = 0.3;

export const CorporateTaxTab = ({ txns }: { txns: Transaction[] }) => {
  const { revenue, expenses, taxable, tax, quarterly } = useMemo(() => {
    const ytdStart = new Date(new Date().getFullYear(), 0, 1);
    const inYtd = txns.filter((t) => {
      if (!APPROVED.includes(t.status)) return false;
      const d = new Date(t.txn_date);
      return !isNaN(d.getTime()) && d >= ytdStart;
    });
    const r = inYtd
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const e = inYtd
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const tx = Math.max(0, r - e);
    const t = tx * RATE;
    return { revenue: r, expenses: e, taxable: tx, tax: t, quarterly: t / 4 };
  }, [txns]);

  return (
    <div className="space-y-6">
      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Taxable Income Calculator</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Year-to-date · approved transactions</p>

        <dl className="mt-4 divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Total Revenue (YTD)</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{fmtKES(revenue)}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Allowable Expenses (YTD)</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">
              ({fmtKES(expenses)})
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm font-semibold text-foreground">Taxable Income</dt>
            <dd className="text-base font-bold tabular-nums text-foreground">{fmtKES(taxable)}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Corporate Tax Rate</dt>
            <dd className="text-sm font-semibold text-foreground">30%</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-3">
            <dt className="text-sm font-bold text-foreground">Estimated Annual Tax</dt>
            <dd className="text-lg font-bold tabular-nums text-primary">{fmtKES(tax)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-navy" />
          <h3 className="text-base font-semibold text-foreground">Quarterly Estimates</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Installment tax due 20th of 4th, 6th, 9th and 12th month.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {["Q1 (Apr 20)", "Q2 (Jun 20)", "Q3 (Sep 20)", "Q4 (Dec 20)"].map((q) => (
            <div
              key={q}
              className="rounded-lg border border-border/60 bg-background/40 p-3"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {q}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums">{fmtKES(quarterly)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
