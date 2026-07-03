import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  PiggyBank,
  PlayCircle,
  Receipt,
  Scale,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Transaction } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  "KES " +
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const APPROVED = ["Approved", "Auto-Approved"];
const isApproved = (t: Transaction) => APPROVED.includes(t.status);
const isIncome = (t: Transaction) =>
  (t.txn_type ?? "").toLowerCase() === "income";
const isExpense = (t: Transaction) =>
  (t.txn_type ?? "").toLowerCase() === "expense";

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/* -------------------------------------------------------------------------- */
/*                            Financial Reports Card                          */
/* -------------------------------------------------------------------------- */

const reportsList = [
  {
    name: "Balance Sheet",
    icon: Scale,
    desc: "Assets, liabilities & equity",
    status: "pending" as const,
  },
  {
    name: "Cashflow Statement",
    icon: Wallet,
    desc: "Operating, investing, financing",
    status: "ready" as const,
  },
  {
    name: "Income Statement",
    icon: TrendingUp,
    desc: "Revenue, expenses, profit",
    status: "ready" as const,
  },
  {
    name: "Comprehensive Income",
    icon: BarChart3,
    desc: "Net income + OCI",
    status: "ready" as const,
  },
];

export const FinancialReportsCard = () => (
  <Card className="border border-border/60 bg-card p-5 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Financial Reports
        </h3>
        <p className="text-xs text-muted-foreground">
          Generate and approve statutory statements
        </p>
      </div>
      <FileText className="h-5 w-5 text-muted-foreground" />
    </div>

    <ul className="mt-4 space-y-2">
      {reportsList.map((r) => {
        const Icon = r.icon;
        return (
          <li
            key={r.name}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy/10 text-navy">
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{r.desc}</p>
              </div>
            </div>
            {r.status === "pending" ? (
              <Badge
                variant="outline"
                className="gap-1 border-warning/30 bg-warning/10 text-[10px] font-semibold uppercase tracking-wide text-warning"
              >
                <Clock className="h-3 w-3" />
                Awaiting approval
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-success/30 bg-success/10 text-[10px] font-semibold uppercase tracking-wide text-success"
              >
                <CheckCircle2 className="h-3 w-3" />
                Ready
              </Badge>
            )}
          </li>
        );
      })}
    </ul>

    <Link
      to="/reports"
      className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
    >
      Open Financial Reports
      <ArrowRight className="h-4 w-4" />
    </Link>
  </Card>
);

/* -------------------------------------------------------------------------- */
/*                          Live Payment Tracking Card                        */
/* -------------------------------------------------------------------------- */

export const LivePaymentTrackingCard = ({
  txns,
}: {
  txns: Transaction[];
}) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sumDay = (d: Date) =>
    txns
      .filter((t) => isApproved(t) && isIncome(t))
      .filter((t) => {
        const td = new Date(t.txn_date);
        return !isNaN(td.getTime()) && sameDay(td, d);
      })
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

  const todayTotal = sumDay(today);
  const yTotal = sumDay(yesterday);
  const todayCount = txns.filter(
    (t) =>
      isApproved(t) &&
      isIncome(t) &&
      sameDay(new Date(t.txn_date), today),
  ).length;
  const yCount = txns.filter(
    (t) =>
      isApproved(t) &&
      isIncome(t) &&
      sameDay(new Date(t.txn_date), yesterday),
  ).length;

  return (
    <Card className="border border-border/60 bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Live Payment Tracking
          </h3>
          <p className="text-xs text-muted-foreground">
            Real-time inflow snapshot
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-success/20 bg-success/5 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Today
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {fmt(todayTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {todayCount} payment{todayCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Yesterday
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">
            {fmt(yTotal)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {yCount} payment{yCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <a
        href="#transactions"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
      >
        View All Payments
        <ArrowRight className="h-4 w-4" />
      </a>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Tax Overview Card                             */
/* -------------------------------------------------------------------------- */

// Same regime bands as the Tax Center (src/pages/Tax.tsx) — kept in sync so
// the Dashboard estimate and the full Tax Center never disagree about which
// taxes actually apply to this business.
const TOT_MIN = 1_000_000;
const TOT_MAX = 25_000_000;

type TaxRegime = "exempt" | "tot" | "corporate" | "vat";

const getTaxRegime = (vatRegistered: boolean, annualTurnover: number): TaxRegime => {
  if (vatRegistered) return "vat";
  if (annualTurnover >= TOT_MAX) return "corporate";
  if (annualTurnover >= TOT_MIN) return "tot";
  return "exempt";
};

const regimeLabel: Record<TaxRegime, string> = {
  exempt: "Tax Exempt",
  tot: "Turnover Tax (TOT)",
  corporate: "Corporate Tax",
  vat: "VAT Registered",
};

interface TaxOverviewBusiness {
  vat_registered: boolean | null;
  annual_turnover: number | null;
}

export const TaxOverviewCard = ({ txns, business }: { txns: Transaction[]; business?: TaxOverviewBusiness | null }) => {
  const approved = txns.filter(isApproved);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const inMonth = approved.filter((t) => {
    const d = new Date(t.txn_date);
    return !isNaN(d.getTime()) && d >= monthStart;
  });

  const income = inMonth
    .filter(isIncome)
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const expense = inMonth
    .filter(isExpense)
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const profit = Math.max(income - expense, 0);

  const vatRegistered = business?.vat_registered ?? false;
  const annualTurnover = business?.annual_turnover ?? 0;
  const regime = getTaxRegime(vatRegistered, annualTurnover);

  const taxes: { name: string; rate: string; amount: number; icon: typeof Receipt; tone: string }[] = [];
  if (regime === "vat") {
    taxes.push({ name: "VAT Liability", rate: "16%", amount: income * 0.16, icon: Receipt, tone: "text-shield bg-shield/10 border-shield/20" });
    taxes.push({ name: "Corporate Tax", rate: "30%", amount: profit * 0.3, icon: Building2, tone: "text-navy bg-navy/10 border-navy/20" });
  } else if (regime === "corporate") {
    taxes.push({ name: "Corporate Tax", rate: "30%", amount: profit * 0.3, icon: Building2, tone: "text-navy bg-navy/10 border-navy/20" });
  } else if (regime === "tot") {
    taxes.push({ name: "Turnover Tax", rate: "3%", amount: income * 0.03, icon: PiggyBank, tone: "text-success bg-success/10 border-success/20" });
  }
  // Withholding Tax can apply regardless of regime, same as the Tax Center.
  taxes.push({ name: "Withholding Tax", rate: "5% / 20%", amount: income * 0.05, icon: Landmark, tone: "text-warning bg-warning/10 border-warning/20" });

  const totalLiability = taxes.reduce((s, t) => s + t.amount, 0);

  return (
    <Card className="border border-border/60 bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Tax Overview
          </h3>
          <p className="text-xs text-muted-foreground">
            {regimeLabel[regime]} · Estimated month-to-date liability (KRA)
          </p>
        </div>
        <Scale className="h-5 w-5 text-muted-foreground" />
      </div>

      {regime === "exempt" && (
        <p className="mt-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          Annual turnover below KES 1M — no income tax obligation yet. Set your turnover in Settings if this is out of date.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {taxes.map((t) => {
          const Icon = t.icon;
          return (
            <li
              key={t.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md border",
                    t.tone,
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Rate {t.rate}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {fmt(t.amount)}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-navy px-3 py-2.5 text-navy-foreground">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy-foreground/80">
          Total Liability
        </span>
        <span className="text-sm font-bold tabular-nums">
          {fmt(totalLiability)}
        </span>
      </div>

      <Link
        to="/tax"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
      >
        View Tax Center
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
};

/* -------------------------------------------------------------------------- */
/*                          Payroll Quick Actions Card                        */
/* -------------------------------------------------------------------------- */

export const PayrollQuickActionsCard = () => (
  <Card className="border border-border/60 bg-card p-5 shadow-card">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Payroll Quick Actions
        </h3>
        <p className="text-xs text-muted-foreground">
          Run payroll and manage your team
        </p>
      </div>
      <Users className="h-5 w-5 text-muted-foreground" />
    </div>

    <div className="mt-4 space-y-3">
      <Button
        asChild
        className="w-full justify-between gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Link to="/payroll?tab=run">
          <span className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4" />
            Run Payroll
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>

      <Button
        asChild
        variant="outline"
        className="w-full justify-between gap-2 rounded-lg border-border bg-background/40"
      >
        <Link to="/payroll?tab=employees">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            View Employees
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-success/15 text-success">
            <BadgeCheck className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              eTIMS Integration
            </p>
            <p className="text-[11px] text-muted-foreground">
              KRA fiscal device connected
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="gap-1 border-success/30 bg-success/10 text-[10px] font-semibold uppercase tracking-wide text-success"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Active
        </Badge>
      </div>
    </div>
  </Card>
);
