import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
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

interface Payslip {
  id: string;
  employee_id: string;
  period_start: string | null;
  period_end: string | null;
  basic_salary: number | null;
  allowances: Record<string, number> | null;
  paye: number | null;
  housing_levy: number | null;
  net_pay: number | null;
  payment_method: string | null;
  created_at?: string;
}

interface EmployeeLite {
  id: string;
  full_name: string;
  employee_id: string | null;
}

interface Props {
  employeeId?: string | null;
  onClearFilter?: () => void;
}

export const PayslipsSection = ({ employeeId, onClearFilter }: Props) => {
  const [rows, setRows] = useState<Payslip[]>([]);
  const [employees, setEmployees] = useState<Record<string, EmployeeLite>>({});
  const [loading, setLoading] = useState(true);

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
        supabase
          .from("employees")
          .select("id, full_name, employee_id"),
      ]);

      if (pErr) {
        toast({
          title: "Couldn't load payslips",
          description: pErr.message,
          variant: "destructive",
        });
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
    const gross = rows.reduce(
      (s, r) =>
        s +
        (Number(r.basic_salary) || 0) +
        Object.values(r.allowances ?? {}).reduce(
          (a, v) => a + (Number(v) || 0),
          0,
        ),
      0,
    );
    const net = rows.reduce((s, r) => s + (Number(r.net_pay) || 0), 0);
    return { gross, net };
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      "employee",
      "period_start",
      "period_end",
      "basic_salary",
      "paye",
      "housing_levy",
      "net_pay",
      "payment_method",
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      const emp = employees[r.employee_id];
      const vals = [
        emp?.full_name ?? r.employee_id,
        r.period_start ?? "",
        r.period_end ?? "",
        r.basic_salary ?? "",
        r.paye ?? "",
        r.housing_levy ?? "",
        r.net_pay ?? "",
        r.payment_method ?? "",
      ];
      lines.push(
        vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      );
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {focusedEmp ? (
              <>
                Filtered by <span className="font-medium text-foreground">{focusedEmp.full_name}</span>
                {onClearFilter && (
                  <button
                    onClick={onClearFilter}
                    className="ml-2 text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </>
            ) : (
              `${rows.length} payslip${rows.length === 1 ? "" : "s"}`
            )}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-card">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total gross
            </div>
            <div className="font-semibold text-foreground">{fmtKES(totals.gross)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-card">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total net
            </div>
            <div className="font-semibold text-success">{fmtKES(totals.net)}</div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 rounded-lg">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Employee
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Period
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Basic
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                PAYE
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Housing levy
              </TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Net pay
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Method
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No payslips yet. Run payroll to generate the first batch.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const emp = employees[r.employee_id];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="text-sm font-medium">
                      {emp?.full_name ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {emp?.employee_id ?? r.employee_id?.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.period_start ?? "—"}
                    {r.period_end ? ` → ${r.period_end}` : ""}
                  </TableCell>
                  <TableCell className="text-right">{fmtKES(r.basic_salary)}</TableCell>
                  <TableCell className="text-right">{fmtKES(r.paye)}</TableCell>
                  <TableCell className="text-right">{fmtKES(r.housing_levy)}</TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    {fmtKES(r.net_pay)}
                  </TableCell>
                  <TableCell className="text-sm">{r.payment_method ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
