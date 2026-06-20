import { useEffect, useMemo, useState } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { fmtKES } from "@/lib/employees";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PERSONAL_RELIEF, calcTaxable, calcPAYEBeforeRelief } from "@/lib/payeCalculator";

interface Payslip {
  id: string;
  employee_id: string;
  period_start: string | null;
  period_end: string | null;
  basic_salary: number | null;
  allowances: Record<string, number> | null;
  gross_pay: number | null;
  nssf_employee: number | null;
  nhif_employee: number | null;
  housing_levy: number | null;
  other_deductions: { cotu?: number; welfare?: number } | null;
  paye: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  payment_method: string | null;
  payment_status: string | null;
  created_at?: string;
}

interface EmployeeLite {
  id: string;
  full_name: string;
  employee_id: string | null;
  kra_pin: string | null;
  nssf_number: string | null;
  nhif_number: string | null;
  id_number: string | null;
  position: string | null;
  department: string | null;
}

interface Props {
  employeeId?: string | null;
  onClearFilter?: () => void;
}

export const PayslipsSection = ({ employeeId, onClearFilter }: Props) => {
  const [rows, setRows] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Record<string, EmployeeLite>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("payslips")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(500);
      if (employeeId) query = query.eq("employee_id", employeeId);

      const [{ data: ps, error: pErr }, { data: emps }] = await Promise.all([
        query,
        supabase.from("employees").select("id, full_name, employee_id, kra_pin, nssf_number, nhif_number, id_number, position, department"),
      ]);

      if (pErr) {
        toast({ title: "Couldn't load payslips", description: pErr.message, variant: "destructive" });
      } else {
        setRows((ps ?? []) as Payslip[]);
      }

      const map: Record<string, EmployeeLite> = {};
      (emps ?? []).forEach((e) => (map[e.id] = e as EmployeeLite));
      setEmployees(map);
      setLoading(false);
    };
    load();
  }, [employeeId]);

  const focusedEmp = employeeId ? employees[employeeId] : undefined;

  const totals = useMemo(() => {
    const gross = rows.reduce((s, r) => s + (Number(r.gross_pay) || Number(r.basic_salary) || 0), 0);
    const net = rows.reduce((s, r) => s + (Number(r.net_pay) || 0), 0);
    const paye = rows.reduce((s, r) => s + (Number(r.paye) || 0), 0);
    const nssf = rows.reduce((s, r) => s + (Number(r.nssf_employee) || 0), 0);
    return { gross, net, paye, nssf };
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      "Employee", "Employee ID", "KRA PIN", "Period Start", "Period End",
      "Basic Salary", "Allowances", "Gross Pay",
      "NSSF", "Housing Levy", "SHIF", "COTU Fund", "Staff Welfare",
      "Taxable Income", "PAYE Before Relief", "Tax Relief", "PAYE Payable",
      "Total Deductions", "Net Pay", "Payment Method", "Status"
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      const emp = employees[r.employee_id];
      const gross = Number(r.gross_pay) || Number(r.basic_salary) || 0;
      const nssf = Number(r.nssf_employee) || 0;
      const shif = Number(r.nhif_employee) || 0;
      const housing = Number(r.housing_levy) || 0;
      const taxable = calcTaxable(gross, nssf, housing, shif);
      const payeBefore = calcPAYEBeforeRelief(taxable);
      const allowTotal = Object.values(r.allowances ?? {}).reduce((a, v) => a + (Number(v) || 0), 0);
      const cotu = Number(r.other_deductions?.cotu) || 0;
      const welfare = Number(r.other_deductions?.welfare) || 0;

      const vals = [
        emp?.full_name ?? r.employee_id,
        emp?.employee_id ?? "",
        emp?.kra_pin ?? "",
        r.period_start ?? "",
        r.period_end ?? "",
        r.basic_salary ?? "",
        allowTotal,
        gross,
        nssf,
        housing,
        shif,
        cotu,
        welfare,
        taxable,
        payeBefore,
        PERSONAL_RELIEF,
        r.paye ?? "",
        r.total_deductions ?? "",
        r.net_pay ?? "",
        r.payment_method ?? "",
        r.payment_status ?? "",
      ];
      lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslips-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {focusedEmp ? (
              <>
                Filtered by <span className="font-medium text-foreground">{focusedEmp.full_name}</span>
                {onClearFilter && (
                  <button onClick={onClearFilter} className="ml-2 text-primary hover:underline">Clear</button>
                )}
              </>
            ) : (
              `${rows.length} payslip${rows.length === 1 ? "" : "s"}`
            )}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Gross</div>
            <div className="font-semibold">{fmtKES(totals.gross)}</div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total PAYE</div>
            <div className="font-semibold text-destructive">{fmtKES(totals.paye)}</div>
          </div>
          <div className="rounded-lg border bg-card px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Net</div>
            <div className="font-semibold text-success">{fmtKES(totals.net)}</div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table className="min-w-[1400px] text-xs">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Employee</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Period</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Basic Salary</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Allowances</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Gross Pay</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">NSSF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Taxable Income</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">PAYE B/Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Tax Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">PAYE</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">SHIF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Housing Levy</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Net Pay</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Method</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={16} className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={16} className="py-8 text-center text-sm text-muted-foreground">
                  No payslips yet. Run payroll to generate the first batch.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const emp = employees[r.employee_id];
              const gross = Number(r.gross_pay) || Number(r.basic_salary) || 0;
              const nssf = Number(r.nssf_employee) || 0;
              const shif = Number(r.nhif_employee) || 0;
              const housing = Number(r.housing_levy) || 0;
              const paye = Number(r.paye) || 0;
              const taxable = calcTaxable(gross, nssf, housing, shif);
              const payeBefore = calcPAYEBeforeRelief(taxable);
              const allowTotal = Object.values(r.allowances ?? {}).reduce((a, v) => a + (Number(v) || 0), 0);
              const cotu = Number(r.other_deductions?.cotu) || 0;
              const welfare = Number(r.other_deductions?.welfare) || 0;
              const isExpanded = expanded === r.id;

              return (
                <>
                  <TableRow key={r.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-medium">{emp?.full_name ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{emp?.employee_id ?? r.employee_id?.slice(0, 8)}</div>
                    </TableCell>
                    <TableCell>
                      <div>{r.period_start ?? "—"}</div>
                      {r.period_end && <div className="text-muted-foreground">→ {r.period_end}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKES(r.basic_salary)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKES(allowTotal)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtKES(gross)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtKES(nssf)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKES(taxable)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtKES(payeBefore)}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">-{fmtKES(PERSONAL_RELIEF)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtKES(paye)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtKES(shif)}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{fmtKES(housing)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-success">{fmtKES(r.net_pay)}</TableCell>
                    <TableCell className="capitalize">{r.payment_method ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.payment_status === "paid"
                          ? "bg-green-100 text-green-700"
                          : r.payment_status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {r.payment_status ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded payslip detail */}
                  {isExpanded && (
                    <TableRow key={`${r.id}-detail`} className="bg-muted/10">
                      <TableCell colSpan={16} className="p-4">
                        <div className="max-w-md rounded-lg border bg-card p-4 text-xs">
                          <div className="mb-3 font-bold text-sm text-foreground">
                            {emp?.full_name} — Payslip Detail
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Earnings</div>
                            <div className="flex justify-between"><span>Basic Salary</span><span>{fmtKES(r.basic_salary)}</span></div>
                            {allowTotal > 0 && <div className="flex justify-between"><span>Allowances</span><span>{fmtKES(allowTotal)}</span></div>}
                            <div className="flex justify-between font-semibold border-t pt-1"><span>Gross Pay</span><span>{fmtKES(gross)}</span></div>

                            <div className="font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">Deductions</div>
                            <div className="flex justify-between"><span>NSSF</span><span className="text-destructive">-{fmtKES(nssf)}</span></div>
                            {cotu > 0 && <div className="flex justify-between"><span>COTU Education Fund</span><span className="text-destructive">-{fmtKES(cotu)}</span></div>}
                            {welfare > 0 && <div className="flex justify-between"><span>Staff Welfare</span><span className="text-destructive">-{fmtKES(welfare)}</span></div>}
                            <div className="flex justify-between border-t pt-1"><span>Taxable Income</span><span>{fmtKES(taxable)}</span></div>
                            <div className="flex justify-between"><span>PAYE (before relief)</span><span className="text-destructive">-{fmtKES(payeBefore)}</span></div>
                            <div className="flex justify-between"><span>Tax Relief</span><span className="text-success">+{fmtKES(PERSONAL_RELIEF)}</span></div>
                            <div className="flex justify-between font-semibold"><span>PAYE Payable</span><span className="text-destructive">-{fmtKES(paye)}</span></div>
                            <div className="flex justify-between"><span>SHIF</span><span className="text-destructive">-{fmtKES(shif)}</span></div>
                            <div className="flex justify-between"><span>Housing Levy (1.5%)</span><span className="text-destructive">-{fmtKES(housing)}</span></div>

                            <div className="flex justify-between font-bold text-sm border-t pt-2 mt-2">
                              <span>NET PAY</span>
                              <span className="text-success">{fmtKES(r.net_pay)}</span>
                            </div>
                          </div>

                          {emp && (
                            <div className="mt-3 border-t pt-3 text-muted-foreground space-y-0.5">
                              <div className="flex justify-between"><span>KRA PIN</span><span>{emp.kra_pin ?? "—"}</span></div>
                              <div className="flex justify-between"><span>NSSF No.</span><span>{emp.nssf_number ?? "—"}</span></div>
                              <div className="flex justify-between"><span>SHIF No.</span><span>{emp.nhif_number ?? "—"}</span></div>
                              <div className="flex justify-between"><span>ID No.</span><span>{emp.id_number ?? "—"}</span></div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        PAYE uses KRA monthly bands (2024). Tax relief KES 2,400/month applied automatically.
        Click the arrow to expand a payslip detail.
      </p>
    </div>
  );
};