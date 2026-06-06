import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Brain,
  Download, LineChart as LineIcon, Loader2, Smartphone, Sparkles,
  TrendingUp, Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { supabase, Transaction } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  budgetVsActual, buildDailySeries, categoryBreakdown, forecastNextDays,
  generateInsights, isExpense, isIncome, onlyApproved, sourceBreakdown,
  summarise, toCsv,
} from "@/lib/analytics";

const fmtKsh = (n: number) =>
  "KSh " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

const fmtKshCompact = (n: number) =>
  "KSh " + new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);

const PIE_COLORS = [
  "hsl(213 52% 25%)", "hsl(209 60% 45%)", "hsl(88 50% 47%)",
  "hsl(38 92% 50%)", "hsl(0 72% 51%)", "hsl(262 60% 50%)",
  "hsl(180 60% 35%)", "hsl(20 80% 55%)",
];

type Horizon = 30 | 60 | 90;

export default function Analytics() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>(30);

  useEffect(() => {
    if (!profile?.business_id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("txn_date", { ascending: false })
        .limit(2000);
      if (error) {
        toast({ title: "Couldn't load transactions", description: error.message, variant: "destructive" });
      } else {
        setRows((data ?? []) as Transaction[]);
      }
      setLoading(false);
    };
    load();
  }, [profile?.business_id]);

  const summary = useMemo(() => summarise(rows, 30), [rows]);
  const daily = useMemo(() => buildDailySeries(rows, 90), [rows]);

  const openingBalance = useMemo(() => {
    const approved = onlyApproved(rows);
    const inc = approved.filter(isIncome).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const exp = approved.filter(isExpense).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    return inc - exp;
  }, [rows]);

  const forecast = useMemo(() => forecastNextDays(daily, horizon, openingBalance), [daily, horizon, openingBalance]);
  const expenseBreakdown = useMemo(() => categoryBreakdown(rows, "expense").slice(0, 8), [rows]);
  const incomeBreakdown = useMemo(() => categoryBreakdown(rows, "income").slice(0, 8), [rows]);
  const sources = useMemo(() => sourceBreakdown(rows).slice(0, 6), [rows]);
  const budgets = useMemo(() => budgetVsActual(rows).slice(0, 8), [rows]);
  const insights = useMemo(() => generateInsights(rows, budgets, forecast, summary), [rows, budgets, forecast, summary]);

  const combinedChartData = useMemo(() => {
    const past = daily.slice(-30).map((d) => ({
      date: d.date, net: d.net,
      forecast: null as number | null,
      balance: null as number | null,
    }));
    let runBal = openingBalance;
    for (let i = past.length - 1; i >= 0; i--) {
      past[i].balance = runBal;
      runBal -= past[i].net;
    }
    const fc = forecast.map((f) => ({
      date: f.date, net: null as number | null,
      forecast: f.forecastNet, balance: f.forecastBalance,
    }));
    return [...past, ...fc];
  }, [daily, forecast, openingBalance]);

  const exportSnapshot = () => {
    const out = daily.map((d) => ({ date: d.date, income: d.income, expenses: d.expenses, net: d.net }));
    const fc = forecast.map((f) => ({
      date: f.date, income: Math.round(f.forecastIncome),
      expenses: Math.round(f.forecastExpenses), net: Math.round(f.forecastNet),
      projected_balance: Math.round(f.forecastBalance),
    }));
    toCsv([...out, ...fc], `blavia-cashflow-${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-navy">
              <Sparkles className="h-5 w-5 text-shield" />
              Analytics & Forecast
            </h2>
            <p className="text-sm text-muted-foreground">
              Live KPIs, cashflow predictions and insights — tuned for Kenyan business cycles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v) as Horizon)}>
              <TabsList>
                <TabsTrigger value="30">30 days</TabsTrigger>
                <TabsTrigger value="60">60 days</TabsTrigger>
                <TabsTrigger value="90">90 days</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportSnapshot} disabled={loading}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Income (30d)" value={fmtKsh(summary.income)} icon={ArrowUpRight} variant="success" loading={loading} hint={summary.topIncomeCategory ?? undefined} />
          <KpiCard label="Expenses (30d)" value={fmtKsh(summary.expenses)} icon={ArrowDownRight} variant="shield" loading={loading} hint={summary.topExpenseCategory ?? undefined} />
          <KpiCard label="Net cashflow (30d)" value={fmtKsh(summary.net)} icon={Wallet} variant={summary.net >= 0 ? "navy" : "warning"} loading={loading} hint={summary.net >= 0 ? "Surplus" : "Deficit"} />
          <KpiCard label="M-Pesa share" value={`${Math.round(summary.mpesaShare * 100)}%`} icon={Smartphone} variant="navy" loading={loading} hint={`${summary.txnCount} approved txns`} />
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <LineIcon className="h-4 w-4 text-shield" />
              Cashflow & {horizon}-day forecast
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Opening balance ≈ {fmtKshCompact(openingBalance)}
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={combinedChartData}>
                    <defs>
                      <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(209 60% 45%)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(209 60% 45%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 25% 88%)" />
                    <XAxis dataKey="date" tickFormatter={(d) => format(parseISO(d), "d MMM")} tick={{ fontSize: 11 }} minTickGap={32} />
                    <YAxis tickFormatter={(v) => fmtKshCompact(Number(v))} tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v: any) => fmtKsh(Number(v))} labelFormatter={(d) => format(parseISO(d as string), "EEE, d MMM yyyy")} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="balance" name="Projected balance" stroke="hsl(209 60% 45%)" fill="url(#balGrad)" strokeWidth={2} />
                    <Line type="monotone" dataKey="net" name="Daily net (actual)" stroke="hsl(213 52% 25%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="forecast" name="Daily net (forecast)" stroke="hsl(38 92% 50%)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-shield" /> Insights & recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : insights.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No insights yet — load more transactions to generate recommendations.
                </p>
              ) : (
                insights.map((ins) => (
                  <div key={ins.id} className={`rounded-lg border p-3 ${
                    ins.severity === "warning" ? "border-warning/40 bg-warning/10"
                      : ins.severity === "positive" ? "border-success/40 bg-success/10"
                      : "border-border bg-muted/40"}`}>
                    <div className="flex items-start gap-2">
                      {ins.severity === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                        : ins.severity === "positive" ? <TrendingUp className="mt-0.5 h-4 w-4 text-success" />
                        : <Sparkles className="mt-0.5 h-4 w-4 text-shield" />}
                      <div>
                        <p className="text-sm font-semibold text-navy">{ins.title}</p>
                        <p className="text-sm text-muted-foreground">{ins.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-4 w-4 text-shield" /> Income channels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {sources.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No income data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sources} dataKey="amount" nameKey="source" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {sources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtKsh(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base text-success">Income categories</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {incomeBreakdown.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No income data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={incomeBreakdown} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {incomeBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtKsh(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-destructive">Expense categories</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {expenseBreakdown.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No expense data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseBreakdown} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {expenseBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtKsh(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Budget vs actual{" "}
              <span className="text-xs font-normal text-muted-foreground">(budget = rolling 3-month average)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Need at least one prior month of data to derive budgets.</p>
            ) : (
              <div className="space-y-3">
                {budgets.map((b) => {
                  const pct = Math.min(b.utilisation, 1.5);
                  const over = b.utilisation > 1;
                  return (
                    <div key={b.category} className="space-y-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-navy">{b.category}</span>
                        <span className={over ? "text-destructive" : "text-muted-foreground"}>
                          {fmtKsh(b.actual)} / <span className="text-muted-foreground">{fmtKsh(b.budget)}</span> · {Math.round(b.utilisation * 100)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${over ? "bg-destructive" : b.utilisation > 0.8 ? "bg-warning" : "bg-success"}`}
                          style={{ width: `${(pct / 1.5) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}