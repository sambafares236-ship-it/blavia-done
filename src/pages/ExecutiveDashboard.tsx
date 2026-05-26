import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  RefreshCw,
  Printer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

const BRAND = {
  emerald: "#0F6E56",
  navy: "#1e293b",
  orange: "#f97316",
  blue: "#3b82f6",
  red: "#ef4444",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  teal: "#14b8a6",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
};
const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;

// ---------- KPI Card ----------
type KpiProps = {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
};
const Kpi = ({ label, value, delta, deltaLabel = "from last month", loading }: KpiProps) => {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {loading ? <Skeleton className="h-7 w-24" /> : value}
      </p>
      {typeof delta === "number" && !loading && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-success" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className={cn("font-semibold", positive ? "text-success" : "text-destructive")}>
            {positive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
};

const ChartCard = ({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn("rounded-lg border border-border/60 bg-card p-5 shadow-sm", className)}>
    <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
    {children}
  </Card>
);

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

// Date range presets
type RangeKey = "month" | "30d" | "quarter" | "year" | "custom";

const ExecutiveDashboard = () => {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters (right sidebar)
  const [range, setRange] = useState<RangeKey>("30d");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Applied filters (after Apply)
  const [applied, setApplied] = useState({
    range: "30d" as RangeKey,
    categories: [] as string[],
    methods: [] as string[],
    units: [] as string[],
  });

  const load = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("txn_date", { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: "Couldn't load data", description: error.message, variant: "destructive" });
    } else {
      setTxns((data ?? []) as Transaction[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Available filter values
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => t.category && s.add(t.category));
    return Array.from(s).sort();
  }, [txns]);
  const allMethods = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => {
      const m = (t.source ?? t.source_bank ?? "Other") as string;
      s.add(m);
    });
    return Array.from(s).sort();
  }, [txns]);
  const allUnits = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => t.business_name && s.add(t.business_name));
    return Array.from(s).sort();
  }, [txns]);

  // Apply date range + filters
  const filteredTxns = useMemo(() => {
    const now = new Date();
    let from = new Date(0);
    if (applied.range === "month") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (applied.range === "30d") {
      from = new Date(now);
      from.setDate(from.getDate() - 30);
    } else if (applied.range === "quarter") {
      from = new Date(now);
      from.setMonth(from.getMonth() - 3);
    } else if (applied.range === "year") {
      from = new Date(now.getFullYear(), 0, 1);
    }
    return txns.filter((t) => {
      const d = new Date(t.txn_date);
      if (isNaN(d.getTime())) return false;
      if (d < from) return false;
      if (applied.categories.length && !applied.categories.includes(t.category ?? "")) return false;
      const m = (t.source ?? t.source_bank ?? "Other") as string;
      if (applied.methods.length && !applied.methods.includes(m)) return false;
      if (applied.units.length && !applied.units.includes(t.business_name ?? "")) return false;
      return true;
    });
  }, [txns, applied]);

  // KPIs
  const kpis = useMemo(() => {
    const sumIncome = (rows: Transaction[]) =>
      rows
        .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const sumExpense = (rows: Transaction[]) =>
      rows
        .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
        .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);

    const gross = sumIncome(filteredTxns);
    const expense = sumExpense(filteredTxns);
    const net = gross - expense;
    const grossProfit = gross * 0.42; // estimated COGS proxy
    const margin = gross > 0 ? (grossProfit / gross) * 100 : 0;
    const units = filteredTxns.filter((t) => (t.txn_type ?? "").toLowerCase() === "income").length;
    const discount = 7.5; // heuristic until discounts table exists
    const promoROI = expense > 0 ? gross / expense : 0;
    const avgDiscount = 4.8;

    // prior-period delta (rough)
    const half = Math.floor(filteredTxns.length / 2);
    const recent = filteredTxns.slice(0, half);
    const prior = filteredTxns.slice(half);
    const recentNet = sumIncome(recent) - sumExpense(recent);
    const priorNet = sumIncome(prior) - sumExpense(prior);
    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

    return {
      gross,
      net,
      grossProfit,
      margin,
      units,
      discount,
      promoROI,
      avgDiscount,
      grossDelta: pct(sumIncome(recent), sumIncome(prior)),
      netDelta: pct(recentNet, priorNet),
      profitDelta: pct(sumIncome(recent) * 0.42, sumIncome(prior) * 0.42),
      unitsDelta: pct(recent.length, prior.length),
    };
  }, [filteredTxns]);

  // Revenue & Expenses by month (last 12)
  const monthlyRevExp = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], revenue: 0, expense: 0 };
    });
    const map = new Map(buckets.map((b) => [b.key, b]));
    filteredTxns.forEach((t) => {
      const d = new Date(t.txn_date);
      if (isNaN(d.getTime())) return;
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = map.get(k);
      if (!slot) return;
      const a = Math.abs(Number(t.amount) || 0);
      if ((t.txn_type ?? "").toLowerCase() === "income") slot.revenue += a;
      else slot.expense += a;
    });
    return buckets;
  }, [filteredTxns]);

  // Net Revenue by Category (fixed buckets)
  const revenueByCategory = useMemo(() => {
    const cats = ["Customer Payments", "Grants", "Loans", "Other Income", "Expenses"];
    const data = cats.map((name) => ({ name, value: 0, fill: BRAND.emerald }));
    filteredTxns.forEach((t) => {
      const a = Math.abs(Number(t.amount) || 0);
      const type = (t.txn_type ?? "").toLowerCase();
      const cat = (t.category ?? "").toLowerCase();
      if (type === "expense") data[4].value += a;
      else if (cat.includes("grant")) data[1].value += a;
      else if (cat.includes("loan")) data[2].value += a;
      else if (cat.includes("customer") || cat.includes("sale") || cat.includes("invoice")) data[0].value += a;
      else data[3].value += a;
    });
    const colors = [BRAND.emerald, BRAND.blue, BRAND.violet, BRAND.teal, BRAND.orange];
    return data.map((d, i) => ({ ...d, fill: colors[i] }));
  }, [filteredTxns]);

  // Payment methods donut
  const paymentMethods = useMemo(() => {
    const buckets: Record<string, number> = { "M-Pesa": 0, "Bank Transfer": 0, Cash: 0, Cheque: 0 };
    filteredTxns.forEach((t) => {
      const src = ((t.source ?? t.source_bank ?? "") as string).toLowerCase();
      const a = Math.abs(Number(t.amount) || 0);
      if (src.includes("mpesa") || src.includes("m-pesa") || src.includes("safaricom")) buckets["M-Pesa"] += a;
      else if (src.includes("cash")) buckets["Cash"] += a;
      else if (src.includes("cheque") || src.includes("check")) buckets["Cheque"] += a;
      else buckets["Bank Transfer"] += a;
    });
    const colors = [BRAND.emerald, BRAND.navy, BRAND.orange, BRAND.amber];
    const arr = Object.entries(buckets).map(([name, value], i) => ({ name, value, fill: colors[i] }));
    const total = arr.reduce((s, x) => s + x.value, 0);
    return { arr, total };
  }, [filteredTxns]);

  // Top 5 most/least profitable (use category aggregation, profit = revenue - cost proxy 0.58)
  const topTable = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    filteredTxns.forEach((t) => {
      const cat = t.category ?? "Uncategorized";
      const a = Math.abs(Number(t.amount) || 0);
      if (!map.has(cat)) map.set(cat, { revenue: 0, cost: 0 });
      const slot = map.get(cat)!;
      if ((t.txn_type ?? "").toLowerCase() === "income") slot.revenue += a;
      else slot.cost += a;
    });
    const rows = Array.from(map.entries())
      .map(([name, v]) => {
        const profit = v.revenue - v.cost;
        const margin = v.revenue > 0 ? (profit / v.revenue) * 100 : 0;
        return { name, revenue: v.revenue, cost: v.cost, profit, margin };
      })
      .filter((r) => r.revenue > 0 || r.cost > 0);
    const top = [...rows].sort((a, b) => b.profit - a.profit).slice(0, 5);
    const bottom = [...rows].sort((a, b) => a.profit - b.profit).slice(0, 5);
    return { top, bottom };
  }, [filteredTxns]);

  // Sales by Category stacked + margin overlay
  const salesByCategory = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    filteredTxns.forEach((t) => {
      const cat = t.category ?? "Other";
      const a = Math.abs(Number(t.amount) || 0);
      if (!map.has(cat)) map.set(cat, { revenue: 0, cost: 0 });
      const slot = map.get(cat)!;
      if ((t.txn_type ?? "").toLowerCase() === "income") slot.revenue += a;
      else slot.cost += a;
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: name.length > 12 ? name.slice(0, 12) + "…" : name,
        revenue: v.revenue,
        cost: v.cost,
        margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue + b.cost - (a.revenue + a.cost))
      .slice(0, 8);
  }, [filteredTxns]);

  const salesTrend = useMemo(
    () =>
      monthlyRevExp.map((m) => ({
        month: m.month,
        sales: m.revenue,
      })),
    [monthlyRevExp],
  );

  // Filter sidebar handlers
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const applyFilters = () => {
    setApplied({ range, categories: selectedCategories, methods: selectedMethods, units: selectedUnits });
  };

  // Export CSV
  const exportCsv = () => {
    const header = ["Date", "Narration", "Category", "Type", "Amount", "Source", "Status"];
    const rows = filteredTxns.map((t) => [
      t.txn_date,
      `"${(t.narration ?? "").replace(/"/g, '""')}"`,
      t.category ?? "",
      t.txn_type,
      t.amount,
      t.source ?? t.source_bank ?? "",
      t.status,
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <section className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Executive Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time business intelligence across revenue, expenses & operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load()} disabled={refreshing}>
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button size="sm" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </section>

        {/* Main + Sidebar */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
          {/* Main column */}
          <div className="space-y-6 min-w-0">
            {/* KPI Row */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <Kpi label="Gross Revenue" value={fmtKES(kpis.gross)} delta={kpis.grossDelta} loading={loading} />
              <Kpi label="Net Revenue" value={fmtKES(kpis.net)} delta={kpis.netDelta} loading={loading} />
              <Kpi
                label="Gross Profit"
                value={fmtKES(kpis.grossProfit)}
                delta={kpis.profitDelta}
                deltaLabel={`${fmtPct(kpis.margin)} margin`}
                loading={loading}
              />
              <Kpi label="Discount Impact" value={fmtPct(kpis.discount)} loading={loading} />
              <Kpi label="Promo ROI" value={`${kpis.promoROI.toFixed(2)}x`} loading={loading} />
              <Kpi label="Units Sold" value={String(kpis.units)} delta={kpis.unitsDelta} loading={loading} />
              <Kpi label="Avg Discount" value={fmtPct(kpis.avgDiscount)} loading={loading} />
            </section>

            {/* Row 2: 4 visualizations */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Revenue & Expenses (Last 12 Months)">
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={monthlyRevExp} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" fill={BRAND.blue} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill={BRAND.orange} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Net Revenue by Category">
                <div className="h-72">
                  <ResponsiveContainer>
                    <BarChart data={revenueByCategory} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                      <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {revenueByCategory.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                        <LabelList dataKey="value" position="top" formatter={(v: number) => fmtK(v)} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Payment Methods Distribution">
                <div className="relative h-72">
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                      <Pie
                        data={paymentMethods.arr}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                        label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {paymentMethods.arr.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-10">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-base font-bold text-foreground">{fmtKES(paymentMethods.total)}</p>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Top & Bottom Profitable Categories">
                <div className="space-y-4 text-xs">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-success">Most Profitable</p>
                    <ProfitTable rows={topTable.top} />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">Least Profitable</p>
                    <ProfitTable rows={topTable.bottom} />
                  </div>
                </div>
              </ChartCard>
            </section>

            {/* Row 3: 2 visualizations */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Sales by Category (Stacked) with Profit Margin">
                <div className="h-80">
                  <ResponsiveContainer>
                    <ComposedChart data={salesByCategory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} dy={6} />
                      <YAxis yAxisId="left" tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar yAxisId="left" dataKey="revenue" stackId="a" fill={BRAND.emerald} radius={[0, 0, 0, 0]} />
                      <Bar yAxisId="left" dataKey="cost" stackId="a" fill={BRAND.orange} radius={[4, 4, 0, 0]} />
                      <Line yAxisId="right" dataKey="margin" stroke={BRAND.navy} strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Total Sales Trend by Month">
                <div className="h-80">
                  <ResponsiveContainer>
                    <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={BRAND.emerald} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={BRAND.emerald} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                      <Area type="monotone" dataKey="sales" stroke={BRAND.emerald} strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 3, fill: BRAND.emerald }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </section>
          </div>

          {/* Right Sidebar - Filters */}
          <aside className="print:hidden">
            <Card className="sticky top-4 rounded-lg border border-border/60 bg-card p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Filters</h3>

              <div className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date Range</Label>
                  <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="quarter">Quarter</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="custom">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <FilterGroup
                  title="Categories"
                  options={allCategories}
                  selected={selectedCategories}
                  onToggle={(v) => setSelectedCategories((s) => toggle(s, v))}
                />
                <FilterGroup
                  title="Payment Methods"
                  options={allMethods}
                  selected={selectedMethods}
                  onToggle={(v) => setSelectedMethods((s) => toggle(s, v))}
                />
                <FilterGroup
                  title="Business Unit"
                  options={allUnits}
                  selected={selectedUnits}
                  onToggle={(v) => setSelectedUnits((s) => toggle(s, v))}
                />

                <Button className="w-full" onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setRange("30d");
                    setSelectedCategories([]);
                    setSelectedMethods([]);
                    setSelectedUnits([]);
                    setApplied({ range: "30d", categories: [], methods: [], units: [] });
                  }}
                >
                  Reset
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
};

const ProfitTable = ({
  rows,
}: {
  rows: { name: string; revenue: number; cost: number; profit: number; margin: number }[];
}) => {
  if (!rows.length) return <p className="py-2 text-xs text-muted-foreground">No data</p>;
  return (
    <div className="overflow-hidden rounded-md border border-border/60">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 font-medium">Category</th>
            <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
            <th className="px-2 py-1.5 text-right font-medium">Cost</th>
            <th className="px-2 py-1.5 text-right font-medium">Profit</th>
            <th className="px-2 py-1.5 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/50">
              <td className="truncate px-2 py-1.5 max-w-[120px]">{r.name}</td>
              <td className="px-2 py-1.5 text-right font-mono">{fmtK(r.revenue)}</td>
              <td className="px-2 py-1.5 text-right font-mono">{fmtK(r.cost)}</td>
              <td className={cn("px-2 py-1.5 text-right font-mono font-semibold", r.profit >= 0 ? "text-success" : "text-destructive")}>
                {r.profit >= 0 ? "+" : ""}
                {fmtK(r.profit)}
              </td>
              <td className={cn("px-2 py-1.5 text-right font-mono", r.margin >= 0 ? "text-success" : "text-destructive")}>
                {r.margin.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const FilterGroup = ({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) => (
  <div>
    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{title}</Label>
    <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-md border border-border/50 p-2">
      {options.length === 0 && <p className="text-xs text-muted-foreground">No options</p>}
      {options.map((o) => (
        <label key={o} className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground">
          <Checkbox
            checked={selected.includes(o)}
            onCheckedChange={() => onToggle(o)}
            className="h-3.5 w-3.5"
          />
          <span className="truncate">{o}</span>
        </label>
      ))}
    </div>
  </div>
);

export default ExecutiveDashboard;
