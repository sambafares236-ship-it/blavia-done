import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, PlayCircle, Smartphone, ShieldCheck, CheckCircle, AlertCircle, X, Users, DollarSign } from "lucide-react";
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
import {
  PERSONAL_RELIEF,
  STANDARD_DAYS,
  calcNssf,
  calcHousingLevy,
  calcShif,
  calcEmployerCost,
  calcPAYEBeforeRelief,
  calcTaxable,
} from "@/lib/payeCalculator";

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
  /** Employer's own matching NSSF contribution — not deducted from the employee. */
  nssfEmployer: number;
  /** Employer's own matching Housing Levy contribution — not deducted from the employee. */
  housingEmployer: number;
  /** Total the employer actually pays out for this employee this period: gross + their own statutory matches. */
  employerCost: number;
}

interface PendingRun {
  id: string;
  run_period: string;
  total_gross: number;
  total_net: number;
  total_deductions: number;
  total_employer_contributions: number | null;
  notes: string;
  created_at: string;
  payslips: {
    id: string;
    net_pay: number;
    payment_status: string;
    employees: { full_name: string; mpesa_number: string; phone: string } | null;
  }[];
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
  const { profile, user } = useAuth();
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

  // Pending runs
  const [pendingRuns, setPendingRuns] = useState<PendingRun[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Approval modal
  const [approvalRun, setApprovalRun] = useState<PendingRun | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { setLoading(false); return; }

      const { data: bizData } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_id", u.id)
        .limit(1)
        .single();

      if (!bizData?.id) {
        toast({ title: "No business found for your account", variant: "destructive" });
        setLoading(false);
        return;
      }

      setBusinessId(bizData.id);

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("business_id", bizData.id)
        .eq("status", "active")
        .order("full_name");

      if (error) {
        toast({ title: "Couldn't load employees", description: error.message, variant: "destructive" });
      } else {
        const list = (data ?? []) as Employee[];
        setEmployees(list);
        const initSel: Record<string, boolean> = {};
        list.forEach((e) => (initSel[e.id] = true));
        setSelected(initSel);
      }
      setLoading(false);
      fetchPendingRuns(bizData.id);
    };
    load();
  }, []);

  const fetchPendingRuns = async (bizId: string) => {
    setLoadingPending(true);
    const { data, error } = await supabase
      .from("payroll_runs")
      .select(`*, payslips(id, net_pay, payment_status, employees(full_name, mpesa_number, phone))`)
      .eq("business_id", bizId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load pending payroll runs", description: error.message, variant: "destructive" });
    }
    setPendingRuns((data as PendingRun[]) || []);
    setLoadingPending(false);
  };

  const preview: PreviewRow[] = useMemo(() => {
    return employees.map((e) => {
      const fullBase = Number(e.basic_salary) || 0;
      const days = daysWorked[e.id] ?? STANDARD_DAYS;
      const basic = (fullBase * days) / STANDARD_DAYS;
      const comm = commission[e.id] ?? 0;
      const allowanceTotal = Object.values(e.allowances ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
      const gross = basic + comm + allowanceTotal;
      const nssf = calcNssf(gross);
      const housing = calcHousingLevy(gross);
      const shif = calcShif(gross);
      const cotu = Number(e.deductions?.cotu) || 0;
      const welfare = Number(e.deductions?.welfare ?? e.deductions?.staff_welfare) || 0;
      const taxable = calcTaxable(gross, nssf, housing, shif);
      const taxBeforeRelief = calcPAYEBeforeRelief(taxable);
      const paye = Math.max(0, taxBeforeRelief - PERSONAL_RELIEF);
      const otherDeductions = Object.entries(e.deductions ?? {})
        .filter(([k]) => !["cotu", "welfare", "staff_welfare"].includes(k))
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
      const net = gross - paye - housing - shif - nssf - cotu - welfare - otherDeductions;
      // NSSF and Housing Levy are matched equally by the employer — this is
      // money the employer pays out, separate from what's deducted from staff.
      const nssfEmployer = nssf;
      const housingEmployer = housing;
      const employerCost = calcEmployerCost(gross, nssfEmployer, housingEmployer);
      return {
        employee: e, selected: !!selected[e.id], daysWorked: days, commission: comm,
        basic, gross, nssf, housing, shif, cotu, welfare, taxable, taxBeforeRelief, paye, net,
        nssfEmployer, housingEmployer, employerCost,
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
      // Employer's own statutory matches (NSSF + Housing Levy) — not withheld from employees.
      employerContributions: sel.reduce((s, r) => s + r.nssfEmployer + r.housingEmployer, 0),
      // What this run actually costs the business: gross paid out + employer's own statutory matches.
      employerCost: sel.reduce((s, r) => s + r.employerCost, 0),
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

    const { data: runData, error: runError } = await supabase
      .from("payroll_runs")
      .insert({
        business_id: businessId,
        run_period: `${periodStart.slice(0, 7)}`,
        run_type: "monthly",
        total_gross: Math.round(selectedRows.reduce((s, r) => s + r.gross, 0)),
        total_deductions: Math.round(selectedRows.reduce((s, r) => s + r.paye + r.nssf + r.housing + r.shif + r.cotu + r.welfare, 0)),
        total_net: Math.round(selectedRows.reduce((s, r) => s + r.net, 0)),
        total_employer_contributions: Math.round(selectedRows.reduce((s, r) => s + r.nssfEmployer + r.housingEmployer, 0)),
        status: "draft",
        notes: `Payroll run for ${periodStart} → ${periodEnd}`,
      })
      .select()
      .single();

    if (runError) {
      toast({ title: "Failed to create payroll run", description: runError.message, variant: "destructive" });
      setRunning(false);
      return;
    }

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
      other_deductions: { cotu: Math.round(r.cotu), welfare: Math.round(r.welfare) },
      total_deductions: Math.round(r.paye + r.nssf + r.housing + r.shif + r.cotu + r.welfare),
      net_pay: Math.round(r.net),
      // Employer's own matching contributions — this is money the business
      // pays, on top of net pay and PAYE, not an amount withheld from staff.
      nssf_employer: Math.round(r.nssfEmployer),
      housing_levy_employer: Math.round(r.housingEmployer),
      // SHIF has no employer match under current law — always 0, not shif*0.5.
      nhif_employer: 0,
      payment_method: r.employee.payment_method,
      payment_status: "pending",
    }));

    const { error } = await supabase.from("payslips").insert(records);

    if (error) {
      await supabase.from("payroll_runs").update({ status: "failed" }).eq("id", runData.id);
      if (error.code === "23505") {
        toast({
          title: "Payroll has already been run for this period",
          description: `One or more selected employees already have a payslip for ${periodStart} → ${periodEnd}. Check the pending runs above.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Payroll run failed", description: error.message, variant: "destructive" });
      }
    } else {
      toast({
        title: "Payroll generated ✅",
        description: `${records.length} payslip(s) created. Review and approve payment below.`,
      });
      fetchPendingRuns(businessId);
    }
    setRunning(false);
  };

  // ── Approve & Pay ────────────────────────────────────────────────────────────
  const handleApproveAndPay = async () => {
    if (!approvalRun || !businessId) return;
    setApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-b2c", {
        body: {
          payroll_run_id: approvalRun.id,
          business_id: businessId,
          approved_by: user?.email ?? "owner",
        },
      });

      if (error || !data?.success) {
        toast({
          title: "Payment failed",
          description: data?.error || "Could not initiate M-Pesa B2C payments",
          variant: "destructive",
        });
      } else {
        toast({
          title: `Payments initiated! ✅`,
          description: `${data.success_count} of ${data.total} employees paid. ${data.fail_count > 0 ? data.fail_count + " failed — retry from pending runs." : ""}`,
        });

        // Record this as a real business expense so it shows up in Reports/P&L.
        // Cost = gross pay (net to staff + PAYE/NSSF/Housing withheld on their
        // behalf) + the employer's OWN NSSF and Housing Levy matches — the
        // employer contributions are money the business pays out of pocket,
        // on top of gross, and were previously invisible outside payroll.
        const employerCost = Math.round(
          (approvalRun.total_gross || 0) + (approvalRun.total_employer_contributions || 0),
        );
        const { error: txnError } = await supabase.from("transactions").insert({
          business_id: businessId,
          txn_date: today(),
          narration: `Payroll — ${approvalRun.run_period} (${data.success_count} employee${data.success_count === 1 ? "" : "s"})`,
          amount: -employerCost,
          category: "Payroll",
          source_bank: "M-Pesa",
          txn_type: "Expense",
          status: "Approved",
        });
        if (txnError) {
          // Payment already went out — don't block on this, but flag it so
          // the run doesn't silently go missing from expense reports.
          toast({
            title: "Payroll paid, but couldn't log the expense",
            description: `${txnError.message} — add it to Reports manually so your P&L stays accurate.`,
            variant: "destructive",
          });
        }

        setApprovalRun(null);
        fetchPendingRuns(businessId);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setApproving(false);
    }
  };

  const allSelected = employees.length > 0 && employees.every((e) => selected[e.id]);

  return (
    <div className="space-y-6">

      {/* ── Pending Runs ─────────────────────────────────────────────────────── */}
      {pendingRuns.length > 0 && (
        <Card className="border-2 border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Pending Payroll Approval</h3>
          </div>
          <div className="space-y-3">
            {pendingRuns.map((run) => (
              <div key={run.id} className="rounded-lg bg-white border border-amber-200 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">{run.run_period} Payroll</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {run.payslips?.length || 0} employees · Total Net: {fmtKES(run.total_net)}
                  </p>
                  <p className="text-xs text-muted-foreground">{run.notes}</p>
                </div>
                <Button
                  onClick={() => setApprovalRun(run)}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 shrink-0"
                  size="sm"
                >
                  <Smartphone className="h-4 w-4" />
                  Review & Approve
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Employer's own statutory cost — separate from what's withheld from staff */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border border-warning/30 bg-warning/5 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Employer Statutory Contributions</p>
          <p className="mt-1 text-xl font-bold text-warning">{fmtKES(totals.employerContributions)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Your matching NSSF (6%) + Housing Levy (1.5%) — this is your money, not deducted from staff pay.
          </p>
        </Card>
        <Card className="border border-primary/30 bg-primary/5 p-4 shadow-card">
          <p className="text-xs text-muted-foreground">Total Cost to Business</p>
          <p className="mt-1 text-xl font-bold text-primary">{fmtKES(totals.employerCost)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Gross pay + your statutory contributions. What this run actually costs you.
          </p>
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
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">SHIF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Taxable</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Tax B/Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Relief</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">PAYE</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">Net Pay</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-warning border-l border-border">Employer NSSF</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-warning">Employer Housing</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wide text-primary">Cost to Employer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={21} className="py-8 text-center text-sm text-muted-foreground">
                  Loading active employees…
                </TableCell>
              </TableRow>
            )}
            {!loading && preview.length === 0 && (
              <TableRow>
                <TableCell colSpan={21} className="py-8 text-center text-sm text-muted-foreground">
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
                <TableCell className="font-medium">{r.employee.id.slice(0, 8)}</TableCell>
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
                <TableCell className="text-right tabular-nums">{fmtKES(r.shif)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.taxable)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtKES(r.taxBeforeRelief)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtKES(PERSONAL_RELIEF)}</TableCell>
                <TableCell className="text-right tabular-nums text-destructive">{fmtKES(r.paye)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-success">{fmtKES(r.net)}</TableCell>
                <TableCell className="text-right tabular-nums text-warning border-l border-border">{fmtKES(r.nssfEmployer)}</TableCell>
                <TableCell className="text-right tabular-nums text-warning">{fmtKES(r.housingEmployer)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-primary">{fmtKES(r.employerCost)}</TableCell>
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
          PAYE uses KRA monthly bands (2024). NSSF: 6% on the first KSh 9,000 + 6% on KSh 9,000–108,000 (KSh 6,480 max, per side), Housing Levy 1.5%, SHIF 2.75%, personal relief KSh 2,400.
          Employer NSSF and Housing Levy shown above are matched contributions the business pays — SHIF has no employer match.
        </p>
        <Button onClick={runPayroll} disabled={running || !totals.count}
          className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Running…</>
          ) : (
            <><PlayCircle className="h-4 w-4" />Generate payroll for {totals.count} employee{totals.count === 1 ? "" : "s"}</>
          )}
        </Button>
      </div>

      {/* ── Approval Modal ─────────────────────────────────────────────────────── */}
      {approvalRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="font-semibold text-lg">Approve Payroll Payment</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{approvalRun.run_period} · via M-Pesa B2C</p>
              </div>
              <button onClick={() => setApprovalRun(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Users className="h-3.5 w-3.5" />Employees
                  </div>
                  <p className="text-xl font-bold">{approvalRun.payslips?.length || 0}</p>
                </div>
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-green-700 mb-1">
                    <DollarSign className="h-3.5 w-3.5" />Total to Disburse
                  </div>
                  <p className="text-xl font-bold text-green-700">{fmtKES(approvalRun.total_net)}</p>
                </div>
              </div>

              {/* Employee breakdown */}
              <div className="rounded-lg border overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground uppercase">
                  Payment breakdown
                </div>
                <div className="divide-y max-h-52 overflow-y-auto">
                  {approvalRun.payslips?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{p.employees?.full_name || "Employee"}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.employees?.mpesa_number || p.employees?.phone || "No M-Pesa number"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-700">{fmtKES(p.net_pay)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{p.payment_status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                <strong>Note:</strong> This will initiate M-Pesa B2C payments to all employees above. Employees without an M-Pesa number will be marked as failed and can be retried manually.
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end p-6 border-t">
              <Button variant="outline" onClick={() => setApprovalRun(null)} disabled={approving}>
                Cancel
              </Button>
              <Button
                onClick={handleApproveAndPay}
                disabled={approving}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {approving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                ) : (
                  <><Smartphone className="h-4 w-4" />Confirm & Pay via M-Pesa</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};