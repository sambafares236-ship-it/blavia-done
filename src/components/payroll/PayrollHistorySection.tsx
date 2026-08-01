import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Download, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { downloadCsv } from "@/lib/exporters";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

interface PayslipRow {
  id: string | number;
  period_start: string;
  period_end: string;
  gross_pay: number;
  net_pay: number;
  paye: number;
  housing_levy: number;
  nssf_employer: number | null;
  housing_levy_employer: number | null;
  payment_method: string | null;
  created_at: string;
}

interface RunSummary {
  key: string;
  period_start: string;
  period_end: string;
  count: number;
  grossTotal: number;
  netTotal: number;
  payeTotal: number;
  housingTotal: number;
  /** Employer's own NSSF + Housing Levy matches — not withheld from staff. */
  employerContributionsTotal: number;
  /** What this run actually cost the business: gross paid out + employer's own statutory matches. */
  employerCostTotal: number;
  runDate: string;
  remitted: boolean;
}

export const PayrollHistorySection = () => {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunSummary[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        toast({
          title: "Couldn't load payroll history",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const groups = new Map<string, PayslipRow[]>();
      ((data ?? []) as PayslipRow[]).forEach((p) => {
        const k = `${p.period_start}__${p.period_end}`;
        const arr = groups.get(k) ?? [];
        arr.push(p);
        groups.set(k, arr);
      });
      const summary: RunSummary[] = [...groups.entries()].map(([k, arr]) => {
        const a = arr[0];
        const grossTotal = arr.reduce((s, r) => s + Number(r.gross_pay || 0), 0);
        const employerContributionsTotal = arr.reduce(
          (s, r) => s + Number(r.nssf_employer || 0) + Number(r.housing_levy_employer || 0),
          0,
        );
        return {
          key: k,
          period_start: a.period_start,
          period_end: a.period_end,
          count: arr.length,
          grossTotal,
          netTotal: arr.reduce((s, r) => s + Number(r.net_pay || 0), 0),
          payeTotal: arr.reduce((s, r) => s + Number(r.paye || 0), 0),
          housingTotal: arr.reduce((s, r) => s + Number(r.housing_levy || 0), 0),
          employerContributionsTotal,
          employerCostTotal: grossTotal + employerContributionsTotal,
          runDate: a.created_at?.slice(0, 10) ?? a.period_end,
          remitted: new Date(a.period_end) < new Date(),
        };
      });
      summary.sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
      setRuns(summary);
      setLoading(false);
    };
    load();
  }, []);

  const totals = useMemo(
    () => ({
      runs: runs.length,
      employees: runs.reduce((s, r) => s + r.count, 0),
      net: runs.reduce((s, r) => s + r.netTotal, 0),
      paye: runs.reduce((s, r) => s + r.payeTotal, 0),
      employerContributions: runs.reduce((s, r) => s + r.employerContributionsTotal, 0),
      employerCost: runs.reduce((s, r) => s + r.employerCostTotal, 0),
    }),
    [runs],
  );

  const exportAll = () => {
    downloadCsv(
      `payroll-history-${Date.now()}.csv`,
      [
        "Period Start", "Period End", "Employees", "Gross Pay", "Net Pay", "PAYE", "Housing Levy",
        "Employer Contributions (NSSF + Housing)", "Total Cost to Employer", "Run Date",
      ],
      runs.map((r) => [
        r.period_start,
        r.period_end,
        r.count,
        Math.round(r.grossTotal),
        Math.round(r.netTotal),
        Math.round(r.payeTotal),
        Math.round(r.housingTotal),
        Math.round(r.employerContributionsTotal),
        Math.round(r.employerCostTotal),
        r.runDate,
      ]),
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total Runs</p>
          <p className="mt-1 text-xl font-bold">{totals.runs}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Payslips</p>
          <p className="mt-1 text-xl font-bold">{totals.employees}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Net Disbursed</p>
          <p className="mt-1 text-xl font-bold text-success">{fmtKES(totals.net)}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">PAYE Remitted</p>
          <p className="mt-1 text-xl font-bold text-destructive">{fmtKES(totals.paye)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border border-warning/30 bg-warning/5 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Your Statutory Contributions</p>
          <p className="mt-1 text-xl font-bold text-warning">{fmtKES(totals.employerContributions)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            NSSF + Housing Levy matched by you as employer, across all runs — this is your money, not staff deductions.
          </p>
        </Card>
        <Card className="border border-primary/30 bg-primary/5 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total Payroll Cost</p>
          <p className="mt-1 text-xl font-bold text-primary">{fmtKES(totals.employerCost)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Gross pay + your statutory contributions, across all runs.
          </p>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Past Payroll Runs</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={exportAll}
          className="gap-2"
          disabled={!runs.length}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Period
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employees
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Net Pay
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PAYE
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-warning">
                Employer Contributions
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Run Date
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Statutory Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                  Loading payroll history…
                </TableCell>
              </TableRow>
            ) : runs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No payroll runs yet. Use "Run Payroll" to create your first run.
                </TableCell>
              </TableRow>
            ) : (
              runs.map((r) => (
                <TableRow key={r.key} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">
                      {r.period_start} → {r.period_end}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{r.count}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-success">
                    {fmtKES(r.netTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-destructive">
                    {fmtKES(r.payeTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-warning">
                    {fmtKES(r.employerContributionsTotal)}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {r.runDate}
                  </TableCell>
                  <TableCell>
                    {r.remitted ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-success/30 bg-success/10 text-[10px] font-semibold uppercase text-success"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Remitted
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-warning/30 bg-warning/10 text-[10px] font-semibold uppercase text-warning"
                      >
                        <Clock className="h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};