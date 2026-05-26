import { useMemo } from "react";
import { CheckCircle2, PiggyBank, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Transaction } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const APPROVED = ["Approved", "Auto-Approved"];
const TOT_RATE = 0.03;
const MIN_TURNOVER = 1_000_000;
const MAX_TURNOVER = 25_000_000; // KRA threshold (2024)

export const TurnoverTaxTab = ({ txns }: { txns: Transaction[] }) => {
  const { ytdSales, eligible, monthlyTot, quarters } = useMemo(() => {
    const ytdStart = new Date(new Date().getFullYear(), 0, 1);
    const sales = txns
      .filter(
        (t) =>
          APPROVED.includes(t.status) &&
          (t.txn_type ?? "").toLowerCase() === "income" &&
          new Date(t.txn_date) >= ytdStart,
      )
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const isEligible = sales >= MIN_TURNOVER && sales <= MAX_TURNOVER;
    const monthly = (sales / 12) * TOT_RATE;

    const qs: { label: string; sales: number; tot: number }[] = [];
    for (let q = 0; q < 4; q++) {
      const qStart = new Date(new Date().getFullYear(), q * 3, 1);
      const qEnd = new Date(new Date().getFullYear(), q * 3 + 3, 0, 23, 59, 59);
      const qSales = txns
        .filter((t) => {
          if (!APPROVED.includes(t.status)) return false;
          if ((t.txn_type ?? "").toLowerCase() !== "income") return false;
          const d = new Date(t.txn_date);
          return d >= qStart && d <= qEnd;
        })
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
      qs.push({ label: `Q${q + 1}`, sales: qSales, tot: qSales * TOT_RATE });
    }

    return { ytdSales: sales, eligible: isEligible, monthlyTot: monthly, quarters: qs };
  }, [txns]);

  return (
    <div className="space-y-6">
      <Card
        className={`border-2 p-5 shadow-card ${
          eligible ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {eligible ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-warning" />
          )}
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {eligible ? "Eligible for Turnover Tax" : "Not Eligible for Turnover Tax"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              YTD turnover: <span className="font-semibold">{fmtKES(ytdSales)}</span> · Eligible
              range KES 1M – 25M per year (KRA 2024).
            </p>
          </div>
        </div>
      </Card>

      <Card className="border border-border/60 p-6 shadow-card">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-success" />
          <h3 className="text-base font-semibold text-foreground">3% Gross Sales Calculator</h3>
        </div>
        <dl className="mt-4 divide-y divide-border">
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">YTD Gross Sales</dt>
            <dd className="text-sm font-semibold tabular-nums">{fmtKES(ytdSales)}</dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-sm text-muted-foreground">Rate</dt>
            <dd className="text-sm font-semibold">3%</dd>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-success/10 px-3 py-3">
            <dt className="text-sm font-bold text-foreground">Estimated Monthly TOT</dt>
            <dd className="text-lg font-bold tabular-nums text-success">{fmtKES(monthlyTot)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="border border-border/60 p-6 shadow-card">
        <h3 className="text-base font-semibold text-foreground">Quarterly Filing</h3>
        <p className="text-xs text-muted-foreground">
          TOT is filed monthly by the 20th. Quarterly view shown for reference.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {quarters.map((q) => (
            <div key={q.label} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {q.label}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  3%
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtKES(q.sales)} sales</p>
              <p className="mt-1 text-base font-bold tabular-nums text-success">{fmtKES(q.tot)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
