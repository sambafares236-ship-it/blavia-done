import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  Download,
  Filter,
  Search,
  TrendingUp,
} from "lucide-react";
import { supabase, Transaction } from "@/lib/supabase";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { TransactionsTable } from "@/components/dashboard/TransactionsTable";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import {
  FinancialReportsCard,
  LivePaymentTrackingCard,
  TaxOverviewCard,
  PayrollQuickActionsCard,
} from "@/components/dashboard/DashboardSections";
import { TaxObligationsCard } from "@/components/dashboard/TaxObligationsCard";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const APPROVED_STATUSES = ["Approved", "Auto-Approved"];

const fmtCurrency = (n: number) =>
  "KES " +
  new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const Index = () => {
  const { user, profile } = useAuth();
  const greetingName =
    profile?.full_name?.split(" ")[0] ??
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    profile?.company_name ??
    "there";

  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!profile?.business_id) return;

    const load = async () => {
      console.log("Dashboard loading for business:", profile.business_id);
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("transactions error:", error);
        toast({
          title: "Couldn't load transactions",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setAllTxns((data ?? []) as Transaction[]);
      }
      setLoading(false);
    };

    load();
  }, [profile?.business_id]);

  const kpis = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    const prevCutoff = new Date(cutoff);
    prevCutoff.setDate(prevCutoff.getDate() - 30);

    const inWindow = (t: Transaction, from: Date, to: Date) => {
      const d = new Date(t.txn_date);
      return !isNaN(d.getTime()) && d >= from && d < to;
    };

    const approved = allTxns.filter((t) =>
      APPROVED_STATUSES.includes(t.status)
    );
    const sumIncome = (rows: Transaction[]) =>
      rows
        .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const sumExpense = (rows: Transaction[]) =>
      rows
        .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const cur = approved.filter((t) => inWindow(t, cutoff, now));
    const prev = approved.filter((t) => inWindow(t, prevCutoff, cutoff));

    const income = sumIncome(cur);
    const expenses = sumExpense(cur);
    const prevIncome = sumIncome(prev);
    const prevExpense = sumExpense(prev);

    const pct = (a: number, b: number) =>
      b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;

    const pendingCount = allTxns.filter(
      (t) => (t.status ?? "").toLowerCase() === "pending review"
    ).length;

    return {
      income,
      expenses,
      net: income - expenses,
      pendingCount,
      incomeDelta: pct(income, prevIncome),
      expenseDelta: pct(expenses, prevExpense),
      netDelta: pct(income - expenses, prevIncome - prevExpense),
    };
  }, [allTxns]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = allTxns.slice(0, 50);
    if (!q) return base;
    return base.filter((t) =>
      [t.narration, t.category, t.txn_id, t.ref_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [allTxns, search]);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Executive Overview
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome back, {greetingName}. Here's what's happening today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-lg border-border bg-card"
            >
              <CalendarDays className="h-4 w-4" />
              Last 30 Days
            </Button>
            <Button
              size="sm"
              className="gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90"
            >
              <Download className="h-4 w-4" />
              Report
            </Button>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Total Inflow"
            value={fmtCurrency(kpis.income)}
            icon={ArrowUpRight}
            tone="success"
            loading={loading}
            delta={kpis.incomeDelta}
          />
          <KpiCard
            label="Total Outflow"
            value={fmtCurrency(kpis.expenses)}
            icon={ArrowDownLeft}
            tone="danger"
            loading={loading}
            delta={kpis.expenseDelta}
          />
          <KpiCard
            label="Pending Review"
            value={String(kpis.pendingCount)}
            icon={ClipboardCheck}
            tone="warning"
            loading={loading}
            hint="Needs attention"
          />
          <KpiCard
            label="Net Profit"
            value={fmtCurrency(kpis.net)}
            icon={TrendingUp}
            tone="navy"
            loading={loading}
            delta={kpis.netDelta}
          />
        </section>

        {/* Charts */}
        <section>
          <DashboardCharts txns={allTxns} />
        </section>

        {/* Operations grid */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <TaxObligationsCard />
          <FinancialReportsCard />
          <LivePaymentTrackingCard txns={allTxns} />
          <TaxOverviewCard txns={allTxns} />
          <PayrollQuickActionsCard />
        </section>

        {/* Transactions */}
        <section id="transactions" className="space-y-4 scroll-mt-20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Transactions
            </h2>
            <button className="text-sm font-medium text-primary hover:underline">
              View all
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transactions…"
                className="h-10 rounded-lg border-border bg-card pl-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-lg border-border bg-card"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button
                size="sm"
                className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <TransactionsTable rows={filteredRows} loading={loading} />
        </section>
      </div>

      <ChatbotWidget />
    </AppShell>
  );
};

export default Index;