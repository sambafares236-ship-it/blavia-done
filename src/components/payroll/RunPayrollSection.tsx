import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, PlayCircle, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { fmtKES, type Employee } from "@/lib/employees";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const calcPAYEBeforeRelief = (taxable: number) => {
  if (taxable <= 24000) return taxable * 0.1;
  if (taxable <= 32333) return 2400 + (taxable - 24000) * 0.25;
  if (taxable <= 500000) return 2400 + 2083.25 + (taxable - 32333) * 0.3;
  if (taxable <= 800000) return 2400 + 2083.25 + 140300.1 + (taxable - 500000) * 0.325;
  return 2400 + 2083.25 + 140300.1 + 97500 + (taxable - 800000) * 0.35;
};

const HOUSING_LEVY = 0.015;
const SHIF = 0.0275;
const NSSF_RATE = 0.06;
const NSSF_CAP = 4320;
const PERSONAL_RELIEF = 2400;
const STANDARD_DAYS = 26;

interface PreviewRow {
  employee: Employee;
  selected: boolean;
  daysWorked: number;
  commission: number;
  basic: number;
  gross: number;
  nssf: number;
  housing: number;
  shif: number;
  cotu: number;
  welfare: number;
  taxable: number;
  taxBeforeRelief: number;
  paye: number;
  net: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const lastOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
};

export const RunPayrollSection = () => {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [daysWorked, setDaysWorked] = useState<Record<string, number>>({});
  const [commission, setCommission] = useState<Record<string, number>>({});
  const [mpesaB2C, setMpesaB2C] = useState(true);
  const [etims, setEtims] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // ── Get business_id for this user ──────────────
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: bizData } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .single();

      if (!bizData?.id) {
        toast({ title: "No business found for your account", variant: "destructive" });
        setLoading(false);
        return;
      }

      setBusinessId(bizData.id);

      // ── Fetch only THIS business's employees ───────
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("business_id", bizData.id)
        .eq("status", "active")
        .order("full_name");

      if (error) {
        toast({
          title: "Couldn't load employees",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const list = (data ?? []) as Employee[];
        setEmployees(list);
        const initSel: Record<string, boolean> = {};
        list.forEach((e) => (initSel[e.id] = true));
        setSelected(initSel);
      }
      setLoading(false);
    };
    load();
  }, []);

  const preview: PreviewRow[] = useMemo(() => {
    return employees.map((e) => {
      const fullBase = Number(e.basic_salary) || 0;
      const days = daysWorked[e.id] ?? STANDARD_DAYS;
      const basic = (fullBase * days) / STANDARD_DAYS;
      const comm = commission[e.id] ?? 0;
      const allowanceTotal = Object.values(e.allowances ?? {}).reduce(
        (s, v) => s + (Number(v) || 0), 0,
      );
      const gross = basic + comm + allowanceTotal;
      const nssf = Math.min(gross * NSSF_RATE, NSSF_CAP);
      const housing = gross * HOUSING_LEVY;
      const shif = gross * SHIF;
      const cotu = Number(e.deductions?.cotu) || 0;
      const welfare = Number(e.deductions?.welfare ?? e.deductions?.staff_welfare) || 0;
      const taxable = Math.max(0, gross - nssf - housing - shif);
      const taxBeforeRelief = calcPAYEBeforeRelief(taxable);
      const paye = Math.max(0, taxBeforeRelief - PERSONAL_RELIEF);
      const otherDeductions = Object.entries(e.deductions ?? {})
        .filter(([k]) => !["cotu", "welfare", "staff_welfare"].includes(k))
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
      const net = gross - paye - housing - shif - nssf - cotu - welfare - otherDeductions;
      return {
        employee: e,
        selected: !!selected[e.id],
        daysWorked: days,
        commission: comm,
        basic,
        gross,
        nssf,
        housing,
        shif,
        cotu,
        welfare,
        taxable,
        taxBeforeRelief,
        paye,
        net,
      };
    });
  }, [employees, selected, daysWorked, commission]);

  const totals = useMemo(() => {
    const sel = preview.filter((r) => r.selected);
    return {
      count: sel.length,
      gross: sel.reduce((s, r) => s + r.gross, 0),
      net: sel.reduce((s, r) => s + r.net, 0),
      paye: sel.reduce((s, r) => s + r.paye, 0),
    };
  }, [preview]);

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    employees.forEach((e) => (next[e.id] = v));
    setSelected(next);
  };

  const runPayroll = async () => {
    const selectedRows = preview.filter((r) => r.selected);
    if (!selectedRows.length) {
      toast({ title: "Select at least one employee", variant: "destructive" });
      return;
    }
    if (!businessId) {
      toast({ title: "Business not found", variant: "destructive" });
      return;
    }

    setRunning(true);

    // ── Insert payroll run first ───────────────────
    const { data: runData, error: runError } = await supabase
      .from("payroll_runs")
      .insert({
        business_id: businessId,
        run_period: `${periodStart.slice(0, 7)}`,
        run_type: "monthly",
        total_gross: Math.round(selectedRows.reduce((s, r) => s + r.gross, 0)),
        total_deductions: Math.round(selectedRows.reduce((s, r) => s + r.paye + r.nssf + r.housing + r.shif + r.cotu + r.welfare, 0)),
        total_net: Math.round(selectedRows.reduce((s, r) => s + r.net, 0)),
        total_employer_contributions: Math.round(selectedRows.reduce((s, r) => s + r.nssf, 0)),
        status: "pending",
        notes: `Payroll run for ${periodStart} → ${periodEnd}`,
      })
      .select()
      .single();

    if (runError) {
      toast({ title: "Failed to create payroll run", description: runError.message, variant: "destructive" });
      setRunning(false);
      return;
    }

    // ── Insert payslips with business_id ──────────
    const records = selectedRows.map((r) => ({
      payroll_run_id: runData.id,
      employee_id: r.employee.id,
      business_id: businessId,
      period_start: periodStart,
      period_end: periodEnd,
      basic_salary: Math.round(r.basic),
      allowances: r.employee.allowances ?? {},
      gross_pay: Math.round(r.gross),
      paye: Math.round(r.paye),
      nssf_employee: Math.round(r.nssf),
      nhif_employee: Math.round(r.shif),
      housing_levy: Math.round(r.housing),
      other_deductions: {
        cotu: Math.round(r.cotu),
        welfare: Math.round(r.welfare),
      },
      total_deductions: Math.round(r.paye + r.nssf + r.housing + r.shif + r.cotu + r.welfare),
      net_pay: Math.round(r.net),
      nssf_employer: Math.round(r.nssf),
      nhif_employer: Math.round(r.shif * 0.5),
      payment_method: r.employee.payment_method,
      payment_status: "pending",
    }));

    const { error } = await supabase.from("payslips").insert(records);
    setRunning(false);

    if (error) {
      toast({
        title: "Payroll run failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payroll generated ✅",
        description: `${records.length} payslip${records.length === 1 ? "" : "s"} for ${periodStart} → ${periodEnd}${mpesaB2C ? " · M-Pesa B2C queued" : ""}${etims ? " · eTIMS sync queued" : ""}`,
      });
    }
  };

  const allSelected =
    employees.length > 0 && employees.every((e) => selected[e.id]);

  return (
    <div className="space-y-6">
      {/* Integrations */}
      <Card className="border border-border/60 p-5 shadow-card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
                <Smartphone className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Disburse via M-Pesa B2C</p>
                <p className="text-[11px] text-muted-foreground">
                  Send net pay to mobile-money employees automatically.
                </p>
              </div>
            </div>
            <Switch checked={mpesaB2C} onCheckedChange={setMpesaB2C} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-shield/10 text-shield">
                <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">eTIMS Integration</p>
                <p className="text-[11px] text-muted-foreground">
                  Submit statutory remittances to KRA after run.
                </p>
              </div>
            </div>
            <Switch checked={etims} onCheckedChange={setEtims} />
          </div>
        </div>
      </Card>

      {/* Period */}
      <Card className="border border-border/60 p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarRange className="h-4 w-4 text-primary" />
            Pay period
          </div>
          <div className="space-y-1">
            <Label htmlFor="ps" className="text-xs text-muted-foreground">From</Label>
            <Input id="ps" type="date" value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pe" className="text-xs text-muted-foreground">To</Label>
            <Input id="pe" type="date" value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)} className="w-44" />
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>Run date: {today()}</span>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Selected</p>
          <p className="mt-1 text-xl font-bold">{totals.count}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total Gross</p>
          <p className="mt-1 text-xl font-bold">{fmtKES(totals.gross)}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total PAYE</p>
          <p className="mt-1 text-xl font-bold text-destructive">{fmtKES(totals.paye)}</p>
        </Card>
        <Card className="border border-border/60 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total Net</p>
          <p className="mt-1 text-xl font-bold text-success">{fmtKES(totals.net)}</p>
        </Card>
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <Table className="min-w-[1600px] text-xs">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Emp #</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">ID #</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wide text-muted-foreground">Job Title</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Days</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Basic</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Commission</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Gross</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">COTU Ed</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Welfare</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">NSSF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Housing</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Taxable</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Tax B/Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">PAYE</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">SHIF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Net Pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={18} className="py-8 text-center text-sm text-muted-foreground">
                  Loading active employees…
                </TableCell>
              </TableRow>
            )}
            {!loading && preview.length === 0 && (
              <TableRow>
                <TableCell colSpan={18} className="py-8 text-center text-sm text-muted-foreground">
                  No active employees found for your business.
                </TableCell>
              </TableRow>
            )}
            {preview.map((r) => (
              <TableRow key={r.employee.id} className={cn(!r.selected && "opacity-50")}>
                <TableCell>
                  <Checkbox
                    checked={r.selected}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.employee.id]: !!v }))}
                  />
                </TableCell>
                <TableCell className="font-medium">{r.employee.employee_id ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{r.employee.id_number ?? "—"}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.employee.full_name}</div>
                  <div className="text-[10px] text-muted-foreground">{r.employee.position ?? "—"}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Input type="number" min={0} max={31} value={r.daysWorked}
                    onChange={(e) => setDaysWorked((s) => ({ ...s, [r.employee.id]: Number(e.target.value) || 0 }))}
                    className="h-7 w-16 text-right tabular-nums" />
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.basic)}</TableCell>
                <TableCell className="text-right">
                  <Input type="number" min={0} value={r.commission}
                    onChange={(e) => setCommission((s) => ({ ...s, [r.employee.id]: Number(e.target.value) || 0 }))}
                    className="h-7 w-24 text-right tabular-nums" />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmtKES(r.gross)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.cotu)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.welfare)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.nssf)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.housing)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.taxable)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.taxBeforeRelief)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtKES(PERSONAL_RELIEF)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{fmtKES(r.paye)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.shif)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-success">{fmtKES(r.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip: COTU Education Fund and Staff Welfare are read from each employee's <code>deductions</code> JSON
        (keys <code>cotu</code>, <code>welfare</code>). Edit days worked or commission inline to recompute payroll instantly.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          PAYE uses KRA monthly bands (2024). NSSF 6% (cap KSh 4,320), Housing Levy 1.5%, SHIF 2.75%, personal relief KSh 2,400.
        </p>
        <Button onClick={runPayroll} disabled={running || !totals.count}
          className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Running…</>
          ) : (
            <><PlayCircle className="h-4 w-4" />Run payroll for {totals.count} employee{totals.count === 1 ? "" : "s"}</>
          )}
        </Button>
      </div>
    </div>
  );
};