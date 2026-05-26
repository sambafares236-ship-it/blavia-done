import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import type { ReportLine } from "@/lib/reports";

const fmt = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.abs(n) ?? 0);

interface Props {
  lines: ReportLine[];
}

/** Aggregates a balance-sheet ReportLine[] into Assets vs Liabilities totals. */
const summarize = (lines: ReportLine[]) => {
  const find = (label: string) =>
    lines.find((l) => l.label.toLowerCase() === label.toLowerCase())?.value ?? 0;
  const assets = find("Total Assets");
  const liabilities = find("Total Liabilities");
  const equity = find("Total Equity");
  return { assets, liabilities, equity };
};

export const AssetsLiabilitiesChart = ({ lines }: Props) => {
  const { assets, liabilities, equity } = summarize(lines);
  const data = [
    { name: "Assets", value: Math.max(0, assets), color: "hsl(var(--success))" },
    { name: "Liabilities", value: Math.max(0, liabilities), color: "hsl(var(--destructive))" },
    { name: "Equity", value: Math.max(0, equity), color: "hsl(var(--shield))" },
  ].filter((d) => d.value > 0);

  return (
    <Card className="border border-border/60 p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Assets vs Liabilities
          </h3>
          <p className="text-xs text-muted-foreground">Composition snapshot</p>
        </div>
      </div>

      <div className="mt-2 h-56">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: d.color }}
              />
              <span className="text-foreground">{d.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {fmt(d.value)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
