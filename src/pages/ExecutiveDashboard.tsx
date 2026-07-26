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
import { Input } from "@/components/ui/input";
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
import type { Database } from "@/lib/database.types";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

/**
 * Expense categories treated as cost of sales. Everything else that isn't
 * income counts as an operating expense, so Gross Profit = revenue − COGS
 * and Net Profit = revenue − COGS − opex. The split is keyword-based because
 * the transactions table stores a free-text category rather than a chart of
 * accounts — the "How costs are split" note in the sidebar makes that visible
 * to whoever reads the numbers.
 */
const COGS_KEYWORDS = [
  "cogs", "cost of goods", "cost of sales", "purchase", "inventory", "stock",
  "material", "raw", "supplier", "freight", "shipping", "import", "duty",
  "packaging", "production", "manufactur", "direct labour", "direct labor",
  "subcontract", "merchandise", "goods",
];

const isCogs = (category: string | null | undefined) => {
  const c = (category ?? "").toLowerCase();
  return COGS_KEYWORDS.some((k) => c.includes(k));
};

const isIncome = (t: Transaction) => (t.txn_type ?? "").toLowerCase() === "income";
const amountOf = (t: Transaction) => Math.abs(Number(t.amount) || 0);
const methodOf = (t: Transaction) => t.source_bank ?? "Other";

/** Statuses that count as real money by default, matching the Dashboard. */
const APPROVED_STATUSES = ["approved", "auto-approved"];

const DAY_MS = 24 * 60 * 60 * 1000;
const toDate = (v: string | null | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Row shapes are projected off the generated schema rather than hand-written,
 * so renaming or dropping a column upstream breaks the build here instead of
 * silently producing NaN in a KPI.
 */
type Tables = Database["public"]["Tables"];

type InvoiceRow = Pick<
  Tables["invoices"]["Row"],
  "id" | "status" | "issue_date" | "due_date" | "paid_at" | "subtotal" | "vat_amount" | "total"
> & { contacts: Pick<Tables["contacts"]["Row"], "name"> | null };
type InvoiceItemRow = Pick<Tables["invoice_items"]["Row"], "invoice_id" | "quantity" | "total">;
type AssetRow = Pick<Tables["assets"]["Row"], "category" | "value">;
type LiabilityRow = Pick<Tables["liabilities"]["Row"], "category" | "value" | "due_on">;
type ScheduledExpenseRow = Pick<
  Tables["scheduled_expenses"]["Row"],
  "amount" | "next_due" | "status"
>;
type EmployeeRow = Pick<Tables["employees"]["Row"], "status" | "basic_salary">;

/** Asset categories that represent spendable cash rather than book value. */
const LIQUID_ASSET_CATEGORIES = ["cash", "bank"];
const isLiquid = (a: AssetRow) =>
  LIQUID_ASSET_CATEGORIES.includes((a.category ?? "").toLowerCase());

/** Invoices that never represented a real sale are excluded from all metrics. */
const NON_SALE_INVOICE_STATUSES = ["draft", "void", "voided", "cancelled", "canceled"];
const isSaleInvoice = (i: InvoiceRow) =>
  !NON_SALE_INVOICE_STATUSES.includes((i.status ?? "").toLowerCase());
const isPaidInvoice = (i: InvoiceRow) =>
  (i.status ?? "").toLowerCase() === "paid" || !!i.paid_at;

// ---------- KPI Card ----------
type KpiProps = {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  loading?: boolean;
};
const Kpi = ({ label, value, delta, deltaLabel = "vs prior period", hint, loading }: KpiProps) => {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className="rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {loading ? <Skeleton className="h-7 w-24" /> : value}
      </p>
      {!loading && typeof delta === "number" && (
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
      {!loading && typeof delta !== "number" && hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  );
};

const ChartCard = ({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <Card className={cn("rounded-lg border border-border/60 bg-card p-5 shadow-sm", className)}>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </Card>
);

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="border-b border-border/60 pb-2">
    <h2 className="text-base font-semibold text-foreground">{title}</h2>
    {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
  </div>
);

const EmptyChart = ({ label = "No data in this range" }: { label?: string }) => (
  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
    {label}
  </div>
);

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
};

// Date range presets
type RangeKey = "month" | "30d" | "quarter" | "year" | "all" | "custom";

const RANGE_LABELS: Record<RangeKey, string> = {
  month: "This Month",
  "30d": "Last 30 Days",
  quarter: "Last Quarter",
  year: "Year to Date",
  all: "All Time",
  custom: "Custom Range",
};

type AppliedFilters = {
  range: RangeKey;
  customFrom: string;
  customTo: string;
  categories: string[];
  methods: string[];
  units: string[];
  statuses: string[];
};

/**
 * Resolves the applied range into the window under review plus the equal-length
 * window immediately before it, so every delta is a true period-over-period
 * comparison. "All Time" has no comparable prior window, so deltas are hidden.
 */
const resolveWindow = (applied: AppliedFilters) => {
  const now = new Date();
  let from: Date;
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // end of today

  switch (applied.range) {
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "30d":
      from = new Date(to.getTime() - 30 * DAY_MS);
      break;
    case "quarter":
      from = new Date(to.getTime() - 91 * DAY_MS);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom": {
      const cf = toDate(applied.customFrom);
      const ct = toDate(applied.customTo);
      from = cf ?? new Date(to.getTime() - 30 * DAY_MS);
      if (ct) to = new Date(ct.getTime() + DAY_MS); // inclusive of the end day
      break;
    }
    case "all":
    default:
      return { from: new Date(0), to, prevFrom: null, prevTo: null, comparable: false };
  }

  if (from > to) [from, to] = [to, from];
  const span = to.getTime() - from.getTime();
  return {
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    comparable: true,
  };
};

const pctChange = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

const ExecutiveDashboard = () => {
  const { profile } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItemRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledExpenseRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusesReady, setStatusesReady] = useState(false);

  // Draft filters (right sidebar)
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMethods, setSelectedMethods] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Applied filters (after Apply)
  const [applied, setApplied] = useState<AppliedFilters>({
    range: "30d",
    customFrom: "",
    customTo: "",
    categories: [],
    methods: [],
    units: [],
    statuses: [],
  });

  const load = async () => {
    if (!profile?.business_id) return;
    setRefreshing(true);

    const [txRes, invRes, itemRes, assetRes, liabRes, schedRes, empRes] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("business_id", profile.business_id)
        .order("txn_date", { ascending: false })
        .limit(5000),
      supabase
        .from("invoices")
        .select(
          "id, status, issue_date, due_date, paid_at, subtotal, vat_amount, total, contacts(name)",
        )
        .eq("business_id", profile.business_id)
        .order("issue_date", { ascending: false })
        .limit(5000),
      supabase
        .from("invoice_items")
        .select("invoice_id, quantity, total")
        .eq("business_id", profile.business_id)
        .limit(20000),
      supabase.from("assets").select("category, value").eq("business_id", profile.business_id),
      supabase
        .from("liabilities")
        .select("category, value, due_on")
        .eq("business_id", profile.business_id),
      supabase
        .from("scheduled_expenses")
        .select("amount, next_due, status")
        .eq("business_id", profile.business_id)
        .eq("status", "active"),
      supabase
        .from("employees")
        .select("status, basic_salary")
        .eq("business_id", profile.business_id),
    ]);

    const firstError =
      txRes.error ?? invRes.error ?? itemRes.error ?? assetRes.error ?? liabRes.error ??
      schedRes.error ?? empRes.error;
    if (firstError) {
      toast({ title: "Couldn't load data", description: firstError.message, variant: "destructive" });
    }
    setTxns(txRes.data ?? []);
    setInvoices(invRes.data ?? []);
    setInvoiceItems(itemRes.data ?? []);
    setAssets(assetRes.data ?? []);
    setLiabilities(liabRes.data ?? []);
    setScheduled(schedRes.data ?? []);
    setEmployees(empRes.data ?? []);

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, [profile?.business_id]);

  // Available filter values
  const allCategories = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => t.category && s.add(t.category));
    return Array.from(s).sort();
  }, [txns]);
  const allMethods = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => s.add(methodOf(t)));
    return Array.from(s).sort();
  }, [txns]);
  const allUnits = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => t.business_name && s.add(t.business_name));
    return Array.from(s).sort();
  }, [txns]);
  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    txns.forEach((t) => t.status && s.add(t.status));
    return Array.from(s).sort();
  }, [txns]);

  /**
   * Default to the approved-only view the Dashboard uses, so the two pages
   * report the same revenue for the same period. Statuses are whatever the
   * data actually contains, so this matches on normalised text; if a business
   * uses labels we don't recognise, everything is selected rather than nothing.
   */
  useEffect(() => {
    if (statusesReady || allStatuses.length === 0) return;
    const approved = allStatuses.filter((s) => APPROVED_STATUSES.includes(s.toLowerCase()));
    const next = approved.length > 0 ? approved : allStatuses;
    setSelectedStatuses(next);
    setApplied((a) => ({ ...a, statuses: next }));
    setStatusesReady(true);
  }, [allStatuses, statusesReady]);

  const windowRange = useMemo(() => resolveWindow(applied), [applied]);

  /**
   * Everything except the date range. The month-by-month charts need this so a
   * "Last 30 Days" filter doesn't leave eleven of their twelve columns empty.
   */
  const dimensionFiltered = useMemo(
    () =>
      txns.filter((t) => {
        if (applied.statuses.length && !applied.statuses.includes(t.status)) return false;
        if (applied.categories.length && !applied.categories.includes(t.category ?? "")) return false;
        if (applied.methods.length && !applied.methods.includes(methodOf(t))) return false;
        if (applied.units.length && !applied.units.includes(t.business_name ?? "")) return false;
        return true;
      }),
    [txns, applied],
  );

  const inWindow = (value: string | null | undefined, from: Date, to: Date) => {
    const d = toDate(value);
    return !!d && d >= from && d < to;
  };

  const filteredTxns = useMemo(
    () => dimensionFiltered.filter((t) => inWindow(t.txn_date, windowRange.from, windowRange.to)),
    [dimensionFiltered, windowRange],
  );

  const priorTxns = useMemo(() => {
    if (!windowRange.comparable || !windowRange.prevFrom || !windowRange.prevTo) return [];
    return dimensionFiltered.filter((t) =>
      inWindow(t.txn_date, windowRange.prevFrom!, windowRange.prevTo!),
    );
  }, [dimensionFiltered, windowRange]);

  // Invoices scoped to the same windows, for the sales-side metrics
  const saleInvoices = useMemo(() => invoices.filter(isSaleInvoice), [invoices]);
  const currentInvoices = useMemo(
    () => saleInvoices.filter((i) => inWindow(i.issue_date, windowRange.from, windowRange.to)),
    [saleInvoices, windowRange],
  );
  const priorInvoices = useMemo(() => {
    if (!windowRange.comparable || !windowRange.prevFrom || !windowRange.prevTo) return [];
    return saleInvoices.filter((i) =>
      inWindow(i.issue_date, windowRange.prevFrom!, windowRange.prevTo!),
    );
  }, [saleInvoices, windowRange]);

  const itemsByInvoice = useMemo(() => {
    const map = new Map<string, InvoiceItemRow[]>();
    invoiceItems.forEach((it) => {
      const list = map.get(it.invoice_id);
      if (list) list.push(it);
      else map.set(it.invoice_id, [it]);
    });
    return map;
  }, [invoiceItems]);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const unitsFor = (rows: InvoiceRow[]) =>
      rows.reduce(
        (sum, inv) =>
          sum +
          (itemsByInvoice.get(inv.id) ?? []).reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        0,
      );

    const revenueOf = (rows: Transaction[]) =>
      rows.filter(isIncome).reduce((s, t) => s + amountOf(t), 0);
    const cogsOf = (rows: Transaction[]) =>
      rows.filter((t) => !isIncome(t) && isCogs(t.category)).reduce((s, t) => s + amountOf(t), 0);
    const opexOf = (rows: Transaction[]) =>
      rows.filter((t) => !isIncome(t) && !isCogs(t.category)).reduce((s, t) => s + amountOf(t), 0);

    const revenue = revenueOf(filteredTxns);
    const cogs = cogsOf(filteredTxns);
    const opex = opexOf(filteredTxns);
    const grossProfit = revenue - cogs;
    const net = revenue - cogs - opex;

    const pRevenue = revenueOf(priorTxns);
    const pCogs = cogsOf(priorTxns);
    const pOpex = opexOf(priorTxns);
    const pGross = pRevenue - pCogs;
    const pNet = pRevenue - pCogs - pOpex;

    // Sales-side metrics from invoices
    const invoiced = currentInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const collected = currentInvoices
      .filter(isPaidInvoice)
      .reduce((s, i) => s + (Number(i.total) || 0), 0);
    const pInvoiced = priorInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const pCollected = priorInvoices
      .filter(isPaidInvoice)
      .reduce((s, i) => s + (Number(i.total) || 0), 0);

    const units = unitsFor(currentInvoices);
    const pUnits = unitsFor(priorInvoices);

    const avgInvoice = currentInvoices.length > 0 ? invoiced / currentInvoices.length : 0;
    const pAvgInvoice = priorInvoices.length > 0 ? pInvoiced / priorInvoices.length : 0;

    const collectionRate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
    const pCollectionRate = pInvoiced > 0 ? (pCollected / pInvoiced) * 100 : 0;

    // Days sales outstanding: mean issue → payment time on invoices settled in-window
    const settled = currentInvoices.filter((i) => i.paid_at && i.issue_date);
    const dsoDays =
      settled.length > 0
        ? settled.reduce((s, i) => {
            const issued = toDate(i.issue_date)!;
            const paid = toDate(i.paid_at)!;
            return s + Math.max(0, (paid.getTime() - issued.getTime()) / DAY_MS);
          }, 0) / settled.length
        : null;

    const vatCollected = currentInvoices.reduce((s, i) => s + (Number(i.vat_amount) || 0), 0);

    const comparable = windowRange.comparable;
    const delta = (a: number, b: number) => (comparable ? pctChange(a, b) : null);

    return {
      revenue,
      cogs,
      opex,
      grossProfit,
      net,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      netMargin: revenue > 0 ? (net / revenue) * 100 : 0,
      units,
      avgInvoice,
      collectionRate,
      dsoDays,
      vatCollected,
      invoiceCount: currentInvoices.length,
      settledCount: settled.length,
      revenueDelta: delta(revenue, pRevenue),
      grossDelta: delta(grossProfit, pGross),
      opexDelta: delta(opex, pOpex),
      netDelta: delta(net, pNet),
      unitsDelta: delta(units, pUnits),
      avgInvoiceDelta: delta(avgInvoice, pAvgInvoice),
      collectionDelta: delta(collectionRate, pCollectionRate),
    };
  }, [filteredTxns, priorTxns, currentInvoices, priorInvoices, itemsByInvoice, windowRange]);

  // Revenue & Expenses by month — always the trailing 12 months, ignoring the
  // date filter so the series stays readable at any range setting.
  const monthlyRevExp = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: MONTHS[d.getMonth()],
        revenue: 0,
        expense: 0,
      };
    });
    const map = new Map(buckets.map((b) => [b.key, b]));
    dimensionFiltered.forEach((t) => {
      const d = toDate(t.txn_date);
      if (!d) return;
      const slot = map.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (!slot) return;
      if (isIncome(t)) slot.revenue += amountOf(t);
      else slot.expense += amountOf(t);
    });
    return buckets;
  }, [dimensionFiltered]);

  const monthlyHasData = useMemo(
    () => monthlyRevExp.some((m) => m.revenue > 0 || m.expense > 0),
    [monthlyRevExp],
  );

  // Net Revenue by Category (fixed buckets)
  const revenueByCategory = useMemo(() => {
    const cats = ["Customer Payments", "Grants", "Loans", "Other Income", "Expenses"];
    const data = cats.map((name) => ({ name, value: 0 }));
    filteredTxns.forEach((t) => {
      const a = amountOf(t);
      const cat = (t.category ?? "").toLowerCase();
      if (!isIncome(t)) data[4].value += a;
      else if (cat.includes("grant")) data[1].value += a;
      else if (cat.includes("loan")) data[2].value += a;
      else if (cat.includes("customer") || cat.includes("sale") || cat.includes("invoice"))
        data[0].value += a;
      else data[3].value += a;
    });
    const colors = [BRAND.emerald, BRAND.blue, BRAND.violet, BRAND.teal, BRAND.orange];
    return data.map((d, i) => ({ ...d, fill: colors[i] }));
  }, [filteredTxns]);

  const categoryHasData = useMemo(
    () => revenueByCategory.some((d) => d.value > 0),
    [revenueByCategory],
  );

  // Collections by payment method — income only, so the mix reflects how
  // customers actually pay rather than mixing in outbound spend.
  const paymentMethods = useMemo(() => {
    const buckets: Record<string, number> = { "M-Pesa": 0, "Bank Transfer": 0, Cash: 0, Cheque: 0 };
    filteredTxns.filter(isIncome).forEach((t) => {
      const src = methodOf(t).toLowerCase();
      const a = amountOf(t);
      if (src.includes("mpesa") || src.includes("m-pesa") || src.includes("safaricom"))
        buckets["M-Pesa"] += a;
      else if (src.includes("cash")) buckets["Cash"] += a;
      else if (src.includes("cheque") || src.includes("check")) buckets["Cheque"] += a;
      else buckets["Bank Transfer"] += a;
    });
    const colors = [BRAND.emerald, BRAND.navy, BRAND.orange, BRAND.amber];
    const arr = Object.entries(buckets)
      .map(([name, value], i) => ({ name, value, fill: colors[i] }))
      .filter((d) => d.value > 0);
    const total = arr.reduce((s, x) => s + x.value, 0);
    return { arr, total };
  }, [filteredTxns]);

  // Most / least profitable categories. Bottom rows exclude anything already
  // shown in the top table so the two lists never repeat the same category.
  const topTable = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    filteredTxns.forEach((t) => {
      const cat = t.category ?? "Uncategorized";
      if (!map.has(cat)) map.set(cat, { revenue: 0, cost: 0 });
      const slot = map.get(cat)!;
      if (isIncome(t)) slot.revenue += amountOf(t);
      else slot.cost += amountOf(t);
    });
    const rows = Array.from(map.entries())
      .map(([name, v]) => {
        const profit = v.revenue - v.cost;
        return {
          name,
          revenue: v.revenue,
          cost: v.cost,
          profit,
          margin: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
        };
      })
      .filter((r) => r.revenue > 0 || r.cost > 0);

    const sorted = [...rows].sort((a, b) => b.profit - a.profit);
    const top = sorted.slice(0, 5);
    const taken = new Set(top.map((r) => r.name));
    const bottom = [...sorted]
      .reverse()
      .filter((r) => !taken.has(r.name))
      .slice(0, 5);
    return { top, bottom };
  }, [filteredTxns]);

  // Sales by Category stacked + margin overlay
  const salesByCategory = useMemo(() => {
    const map = new Map<string, { revenue: number; cost: number }>();
    filteredTxns.forEach((t) => {
      const cat = t.category ?? "Other";
      if (!map.has(cat)) map.set(cat, { revenue: 0, cost: 0 });
      const slot = map.get(cat)!;
      if (isIncome(t)) slot.revenue += amountOf(t);
      else slot.cost += amountOf(t);
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
    () => monthlyRevExp.map((m) => ({ month: m.month, sales: m.revenue })),
    [monthlyRevExp],
  );

  /**
   * Balance-sheet style figures. These are positions as at today rather than
   * flows over the selected window, so they deliberately ignore the date
   * filter — a "cash position for last March" would be meaningless here.
   */
  const position = useMemo(() => {
    const cash = assets.filter(isLiquid).reduce((s, a) => s + (Number(a.value) || 0), 0);
    const totalAssets = assets.reduce((s, a) => s + (Number(a.value) || 0), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.value) || 0), 0);

    // Burn = mean monthly spend over the last three months, taken from the
    // trailing-12 series so the date filter can't distort it.
    const recent = monthlyRevExp.slice(-3);
    const burn = recent.length > 0 ? recent.reduce((s, m) => s + m.expense, 0) / recent.length : 0;
    const monthlyRevenue =
      recent.length > 0 ? recent.reduce((s, m) => s + m.revenue, 0) / recent.length : 0;

    return {
      cash,
      totalAssets,
      totalLiabilities,
      netPosition: totalAssets - totalLiabilities,
      burn,
      monthlyRevenue,
      runwayMonths: burn > 0 ? cash / burn : null,
      hasRegister: assets.length > 0 || liabilities.length > 0,
    };
  }, [assets, liabilities, monthlyRevExp]);

  /** Unpaid invoices bucketed by how far past their due date they are, as at today. */
  const receivables = useMemo(() => {
    const today = new Date();
    const buckets = [
      { name: "Not yet due", value: 0, fill: BRAND.emerald },
      { name: "1–30 days", value: 0, fill: BRAND.amber },
      { name: "31–60 days", value: 0, fill: BRAND.orange },
      { name: "61–90 days", value: 0, fill: BRAND.violet },
      { name: "90+ days", value: 0, fill: BRAND.red },
    ];

    let outstanding = 0;
    let overdue = 0;
    let count = 0;

    saleInvoices
      .filter((i) => !isPaidInvoice(i))
      .forEach((i) => {
        const amount = Number(i.total) || 0;
        if (amount <= 0) return;
        outstanding += amount;
        count += 1;

        const due = toDate(i.due_date);
        if (!due || due >= today) {
          buckets[0].value += amount;
          return;
        }
        overdue += amount;
        const days = (today.getTime() - due.getTime()) / DAY_MS;
        if (days <= 30) buckets[1].value += amount;
        else if (days <= 60) buckets[2].value += amount;
        else if (days <= 90) buckets[3].value += amount;
        else buckets[4].value += amount;
      });

    return { buckets, outstanding, overdue, count, hasData: outstanding > 0 };
  }, [saleInvoices]);

  /** Committed outgoings landing in the next 30 days. */
  const payables = useMemo(() => {
    const today = new Date();
    const horizon = new Date(today.getTime() + 30 * DAY_MS);

    const bills = scheduled.filter((s) => {
      const due = toDate(s.next_due);
      return !!due && due < horizon;
    });
    const billsTotal = bills.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    const overdueBills = scheduled.filter((s) => {
      const due = toDate(s.next_due);
      return !!due && due < today;
    }).length;

    const debts = liabilities.filter((l) => {
      const due = toDate(l.due_on);
      return !!due && due < horizon;
    });
    const debtsTotal = debts.reduce((s, l) => s + (Number(l.value) || 0), 0);

    return {
      total: billsTotal + debtsTotal,
      count: bills.length + debts.length,
      overdueBills,
    };
  }, [scheduled, liabilities]);

  /**
   * Revenue by customer for the selected window, with concentration risk —
   * how much of the period's invoiced revenue rests on the single largest
   * customer.
   */
  const customers = useMemo(() => {
    const map = new Map<string, { invoiced: number; paid: number; count: number }>();
    currentInvoices.forEach((inv) => {
      const name = inv.contacts?.name?.trim() || "Unnamed customer";
      if (!map.has(name)) map.set(name, { invoiced: 0, paid: 0, count: 0 });
      const slot = map.get(name)!;
      const amount = Number(inv.total) || 0;
      slot.invoiced += amount;
      slot.count += 1;
      if (isPaidInvoice(inv)) slot.paid += amount;
    });

    const total = Array.from(map.values()).reduce((s, v) => s + v.invoiced, 0);
    const rows = Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        invoiced: v.invoiced,
        paid: v.paid,
        count: v.count,
        share: total > 0 ? (v.invoiced / total) * 100 : 0,
      }))
      .sort((a, b) => b.invoiced - a.invoiced);

    return {
      rows: rows.slice(0, 10),
      total,
      concentration: rows[0]?.share ?? 0,
      topName: rows[0]?.name ?? null,
    };
  }, [currentInvoices]);

  /** Monthly payroll commitment measured against typical monthly revenue. */
  const payroll = useMemo(() => {
    const active = employees.filter((e) => (e.status ?? "").toLowerCase() === "active");
    const monthly = active.reduce((s, e) => s + (Number(e.basic_salary) || 0), 0);
    return {
      monthly,
      headcount: active.length,
      ratio: position.monthlyRevenue > 0 ? (monthly / position.monthlyRevenue) * 100 : null,
    };
  }, [employees, position.monthlyRevenue]);

  // Filter sidebar handlers
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const applyFilters = () => {
    setApplied({
      range,
      customFrom,
      customTo,
      categories: selectedCategories,
      methods: selectedMethods,
      units: selectedUnits,
      statuses: selectedStatuses,
    });
  };

  const resetFilters = () => {
    const approved = allStatuses.filter((s) => APPROVED_STATUSES.includes(s.toLowerCase()));
    const statuses = approved.length > 0 ? approved : allStatuses;
    setRange("30d");
    setCustomFrom("");
    setCustomTo("");
    setSelectedCategories([]);
    setSelectedMethods([]);
    setSelectedUnits([]);
    setSelectedStatuses(statuses);
    setApplied({
      range: "30d",
      customFrom: "",
      customTo: "",
      categories: [],
      methods: [],
      units: [],
      statuses,
    });
  };

  // Export CSV — every field is quoted and internal quotes doubled so
  // narrations containing commas or quotes survive the round trip.
  const exportCsv = () => {
    if (filteredTxns.length === 0) {
      toast({ title: "Nothing to export", description: "No transactions match the current filters." });
      return;
    }
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["Date", "Narration", "Category", "Type", "Amount", "Source", "Status"];
    const rows = filteredTxns.map((t) => [
      t.txn_date,
      t.narration,
      t.category ?? "",
      t.txn_type,
      t.amount,
      methodOf(t),
      t.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
    // Leading BOM so Excel opens the file as UTF-8 rather than ANSI.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `executive-dashboard-${iso(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeSummary = windowRange.comparable
    ? `${RANGE_LABELS[applied.range]} · ${iso(windowRange.from)} → ${iso(
        new Date(windowRange.to.getTime() - DAY_MS),
      )}`
    : "All time · no prior period to compare against";

  return (
    <AppShell>
      <div className="space-y-6 print:space-y-4">
        {/* Header */}
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Executive BI
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {rangeSummary} · {filteredTxns.length} transactions · {kpis.invoiceCount} invoices
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
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
            <SectionTitle
              title="Performance"
              subtitle="Trading results for the selected window, against the prior window of equal length"
            />
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Kpi
                label="Revenue"
                value={fmtKES(kpis.revenue)}
                delta={kpis.revenueDelta}
                loading={loading}
              />
              <Kpi
                label="Gross Profit"
                value={fmtKES(kpis.grossProfit)}
                delta={kpis.grossDelta}
                deltaLabel={`· ${fmtPct(kpis.grossMargin)} margin`}
                loading={loading}
              />
              <Kpi
                label="Operating Expenses"
                value={fmtKES(kpis.opex)}
                delta={kpis.opexDelta}
                loading={loading}
              />
              <Kpi
                label="Net Profit"
                value={fmtKES(kpis.net)}
                delta={kpis.netDelta}
                deltaLabel={`· ${fmtPct(kpis.netMargin)} margin`}
                loading={loading}
              />
              <Kpi
                label="Units Sold"
                value={new Intl.NumberFormat("en-KE").format(kpis.units)}
                delta={kpis.unitsDelta}
                hint="From invoice line quantities"
                loading={loading}
              />
              <Kpi
                label="Avg Invoice Value"
                value={fmtKES(kpis.avgInvoice)}
                delta={kpis.avgInvoiceDelta}
                hint={`${kpis.invoiceCount} invoices issued`}
                loading={loading}
              />
              <Kpi
                label="Collection Rate"
                value={kpis.invoiceCount > 0 ? fmtPct(kpis.collectionRate) : "—"}
                delta={kpis.invoiceCount > 0 ? kpis.collectionDelta : null}
                hint="No invoices issued in range"
                loading={loading}
              />
              <Kpi
                label="Days to Payment"
                value={kpis.dsoDays === null ? "—" : `${kpis.dsoDays.toFixed(1)} days`}
                hint={
                  kpis.dsoDays === null
                    ? "No invoices settled in range"
                    : `Across ${kpis.settledCount} settled invoice${kpis.settledCount === 1 ? "" : "s"}`
                }
                loading={loading}
              />
            </section>

            {/* Cash, obligations and risk — positions as at today */}
            <SectionTitle
              title="Cash & obligations"
              subtitle="Positions as at today — not affected by the date range filter"
            />
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Kpi
                label="Cash Position"
                value={position.hasRegister ? fmtKES(position.cash) : "—"}
                hint={
                  position.hasRegister
                    ? "Cash and bank on the asset register"
                    : "No assets recorded yet"
                }
                loading={loading}
              />
              <Kpi
                label="Net Position"
                value={position.hasRegister ? fmtKES(position.netPosition) : "—"}
                hint={
                  position.hasRegister
                    ? `${fmtKES(position.totalAssets)} assets − ${fmtKES(position.totalLiabilities)} liabilities`
                    : "Add assets and liabilities to see this"
                }
                loading={loading}
              />
              <Kpi
                label="Monthly Burn"
                value={fmtKES(position.burn)}
                hint="Mean spend over the last 3 months"
                loading={loading}
              />
              <Kpi
                label="Runway"
                value={
                  position.runwayMonths === null || !position.hasRegister
                    ? "—"
                    : `${position.runwayMonths.toFixed(1)} months`
                }
                hint={
                  !position.hasRegister
                    ? "Needs cash on the asset register"
                    : position.runwayMonths === null
                      ? "No spend recorded to burn through"
                      : "Cash divided by monthly burn"
                }
                loading={loading}
              />
              <Kpi
                label="Outstanding AR"
                value={fmtKES(receivables.outstanding)}
                hint={
                  receivables.count === 0
                    ? "Nothing unpaid"
                    : `${receivables.count} unpaid · ${fmtKES(receivables.overdue)} overdue`
                }
                loading={loading}
              />
              <Kpi
                label="Payables Due (30d)"
                value={fmtKES(payables.total)}
                hint={
                  payables.count === 0
                    ? "Nothing scheduled"
                    : `${payables.count} due${payables.overdueBills > 0 ? ` · ${payables.overdueBills} overdue` : ""}`
                }
                loading={loading}
              />
              <Kpi
                label="Payroll / Revenue"
                value={payroll.ratio === null ? "—" : fmtPct(payroll.ratio)}
                hint={
                  payroll.headcount === 0
                    ? "No active employees"
                    : `${fmtKES(payroll.monthly)}/mo across ${payroll.headcount}`
                }
                loading={loading}
              />
              <Kpi
                label="Customer Concentration"
                value={customers.rows.length === 0 ? "—" : fmtPct(customers.concentration)}
                hint={
                  customers.topName
                    ? `${customers.topName} is the largest`
                    : "No invoiced customers in range"
                }
                loading={loading}
              />
            </section>

            {/* Row 2: 4 visualizations */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Revenue & Expenses (Last 12 Months)"
                subtitle="Trailing 12 months — not limited by the date range filter"
              >
                <div className="h-72">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !monthlyHasData ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={monthlyRevExp} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="revenue" name="Revenue" fill={BRAND.blue} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expense" name="Expenses" fill={BRAND.orange} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard title="Revenue by Category" subtitle="Income sources against total spend">
                <div className="h-72">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !categoryHasData ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={revenueByCategory} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                        <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                        <Bar dataKey="value" name="Amount" radius={[6, 6, 0, 0]}>
                          {revenueByCategory.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                          <LabelList dataKey="value" position="top" formatter={(v: number) => fmtK(v)} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard title="Collections by Payment Method" subtitle="Incoming payments only">
                <div className="relative h-72">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : paymentMethods.total === 0 ? (
                    <EmptyChart label="No collections in this range" />
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </ChartCard>

              <ChartCard title="Top & Bottom Profitable Categories" subtitle="Revenue minus spend, per category">
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
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : salesByCategory.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer>
                      <ComposedChart data={salesByCategory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-15} dy={6} />
                        <YAxis yAxisId="left" tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v: number, name: string) =>
                            name === "Margin" ? fmtPct(v) : fmtKES(v)
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar yAxisId="left" dataKey="revenue" name="Revenue" stackId="a" fill={BRAND.emerald} />
                        <Bar yAxisId="left" dataKey="cost" name="Cost" stackId="a" fill={BRAND.orange} radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" dataKey="margin" name="Margin" stroke={BRAND.navy} strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Revenue Trend by Month"
                subtitle="Trailing 12 months — not limited by the date range filter"
              >
                <div className="h-80">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !monthlyHasData ? (
                    <EmptyChart />
                  ) : (
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
                        <Area type="monotone" dataKey="sales" name="Revenue" stroke={BRAND.emerald} strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 3, fill: BRAND.emerald }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>
            </section>

            {/* Row 4: receivables ageing and customer mix */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard
                title="Receivables Ageing"
                subtitle="Unpaid invoices by time past due, as at today"
              >
                <div className="h-72">
                  {loading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !receivables.hasData ? (
                    <EmptyChart label="No unpaid invoices" />
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={receivables.buckets} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} />
                        <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} width={45} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtKES(v)} />
                        <Bar dataKey="value" name="Outstanding" radius={[6, 6, 0, 0]}>
                          {receivables.buckets.map((d, i) => (
                            <Cell key={i} fill={d.fill} />
                          ))}
                          <LabelList dataKey="value" position="top" formatter={(v: number) => (v > 0 ? fmtK(v) : "")} style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </ChartCard>

              <ChartCard
                title="Top Customers"
                subtitle="By invoiced value in the selected window"
              >
                <div className="min-h-[18rem]">
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : customers.rows.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
                      No invoices issued in this range
                    </div>
                  ) : (
                    <CustomerTable rows={customers.rows} />
                  )}
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
                      {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {RANGE_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {range === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">From</Label>
                      <Input
                        type="date"
                        value={customFrom}
                        max={customTo || undefined}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">To</Label>
                      <Input
                        type="date"
                        value={customTo}
                        min={customFrom || undefined}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                )}

                <FilterGroup
                  title="Transaction Status"
                  options={allStatuses}
                  selected={selectedStatuses}
                  onToggle={(v) => setSelectedStatuses((s) => toggle(s, v))}
                />
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
                <Button variant="outline" className="w-full" onClick={resetFilters}>
                  Reset
                </Button>

                <div className="rounded-md border border-border/50 bg-muted/30 p-2.5">
                  <p className="text-[11px] font-medium text-foreground">How costs are split</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Expenses in categories naming purchases, inventory, materials, freight or
                    production count as cost of sales. Everything else is an operating expense.
                    Gross Profit is revenue minus cost of sales.
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    Cost of sales this period:{" "}
                    <span className="font-medium text-foreground">{fmtKES(kpis.cogs)}</span>
                  </p>
                </div>
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
    <div className="overflow-x-auto rounded-md border border-border/60">
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

const CustomerTable = ({
  rows,
}: {
  rows: { name: string; invoiced: number; paid: number; count: number; share: number }[];
}) => (
  <div className="overflow-x-auto rounded-md border border-border/60">
    <table className="w-full text-left text-xs">
      <thead className="bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-2 py-1.5 font-medium">Customer</th>
          <th className="px-2 py-1.5 text-right font-medium">Invoices</th>
          <th className="px-2 py-1.5 text-right font-medium">Invoiced</th>
          <th className="px-2 py-1.5 text-right font-medium">Collected</th>
          <th className="px-2 py-1.5 text-right font-medium">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border/50">
            <td className="truncate px-2 py-1.5 max-w-[140px]">{r.name}</td>
            <td className="px-2 py-1.5 text-right font-mono">{r.count}</td>
            <td className="px-2 py-1.5 text-right font-mono">{fmtK(r.invoiced)}</td>
            <td
              className={cn(
                "px-2 py-1.5 text-right font-mono",
                r.paid >= r.invoiced ? "text-success" : "text-muted-foreground",
              )}
            >
              {fmtK(r.paid)}
            </td>
            <td className="px-2 py-1.5 text-right font-mono">{r.share.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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
    <div className="mb-1.5 flex items-center justify-between">
      <Label className="block text-xs font-medium text-muted-foreground">{title}</Label>
      {selected.length > 0 && (
        <span className="text-[10px] text-muted-foreground">{selected.length} selected</span>
      )}
    </div>
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
