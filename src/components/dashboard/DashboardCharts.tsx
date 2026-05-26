import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Transaction } from "@/lib/supabase";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DashboardChartsProps {
  txns: Transaction[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
};

export const DashboardCharts = ({ txns }: DashboardChartsProps) => {
  const { revenueExpense, weekly } = useMemo(() => {
    // Group last 7 months by month
    const now = new Date();
    const buckets = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()] };
    });

    const monthMap = new Map<string, { revenue: number; expense: number }>();
    buckets.forEach((b) => monthMap.set(b.key, { revenue: 0, expense: 0 }));

    txns.forEach((t) => {
      const d = new Date(t.txn_date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const slot = monthMap.get(key);
      if (!slot) return;
      const amt = Math.abs(Number(t.amount) || 0);
      if ((t.txn_type ?? "").toLowerCase() === "income") slot.revenue += amt;
      else slot.expense += amt;
    });

    const revenueExpense = buckets.map((b) => ({
      month: b.label,
      revenue: monthMap.get(b.key)?.revenue ?? 0,
      expense: monthMap.get(b.key)?.expense ?? 0,
    }));

    const weekly = buckets.map((b) => {
      const slot = monthMap.get(b.key);
      return {
        month: b.label,
        cashflow: (slot?.revenue ?? 0) - (slot?.expense ?? 0),
      };
    });

    return { revenueExpense, weekly };
  }, [txns]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Revenue vs Expenses */}
      <Card className="border border-border/60 p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Revenue vs Expenses
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueExpense} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={45} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `KES ${new Intl.NumberFormat("en-KE").format(v)}`}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={2.5} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expense" stroke="hsl(var(--destructive))" strokeWidth={2.5} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Weekly Cash Flow */}
      <Card className="border border-border/60 p-5 shadow-card">
        <h3 className="mb-4 text-base font-semibold text-foreground">
          Weekly Cash Flow
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tickFormatter={fmtK} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={45} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `KES ${new Intl.NumberFormat("en-KE").format(v)}`}
              />
              <Bar dataKey="cashflow" fill="hsl(var(--navy))" radius={[6, 6, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
