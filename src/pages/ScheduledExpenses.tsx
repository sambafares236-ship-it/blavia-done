import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

import { toast } from "@/components/ui/use-toast";
import {
  ScheduleDialog,
  type ScheduleInitial,
} from "@/components/expenses/ScheduleDialog";
import { cn } from "@/lib/utils";

interface ScheduledExpense {
  id: string;
  vendor: string;
  category: string;
  amount: number;
  frequency: string;
  next_due: string;
  payment_method: string | null;
  account_ref: string | null;
  status: string;
  auto_post: boolean;
  notes: string | null;
  last_paid_on: string | null;
}

const fmt = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const advance = (date: string, freq: string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  switch (freq) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return date;
  }
  return d.toISOString().slice(0, 10);
};

const dayDiff = (iso: string) => {
  const a = new Date(iso);
  const b = new Date();
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

const dueBadge = (iso: string) => {
  const diff = dayDiff(iso);
  if (diff < 0)
    return (
      <Badge variant="destructive" className="font-medium">
        Overdue {Math.abs(diff)}d
      </Badge>
    );
  if (diff === 0)
    return <Badge className="bg-warning text-warning-foreground">Due today</Badge>;
  if (diff <= 7)
    return (
      <Badge variant="outline" className="border-warning/50 text-warning">
        In {diff}d
      </Badge>
    );
  return <Badge variant="secondary">In {diff}d</Badge>;
};

const ScheduledExpensesPage = () => {
  const [rows, setRows] = useState<ScheduledExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; initial?: ScheduleInitial }>({
    open: false,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("scheduled_expenses")
      .select("*")
      .order("next_due", { ascending: true });
    if (error) {
      toast({
        title: "Couldn't load schedules",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRows((data ?? []) as ScheduledExpense[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const dueSoon = active.filter((r) => dayDiff(r.next_due) <= 7);
    const overdue = active.filter((r) => dayDiff(r.next_due) < 0);
    const monthlyEquiv = active.reduce((s, r) => {
      const factor =
        r.frequency === "weekly"
          ? 4.33
          : r.frequency === "monthly"
            ? 1
            : r.frequency === "quarterly"
              ? 1 / 3
              : r.frequency === "yearly"
                ? 1 / 12
                : 0;
      return s + Number(r.amount || 0) * factor;
    }, 0);
    return {
      activeCount: active.length,
      dueSoonCount: dueSoon.length,
      overdueCount: overdue.length,
      monthlyEquiv,
    };
  }, [rows]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this scheduled expense?")) return;
    const { error } = await supabase.from("scheduled_expenses").delete().eq("id", id);
    if (error) {
      toast({
        title: "Couldn't delete",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Schedule deleted" });
    load();
  };

  const togglePause = async (row: ScheduledExpense) => {
    const next = row.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("scheduled_expenses")
      .update({ status: next })
      .eq("id", row.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const markPaid = async (row: ScheduledExpense) => {
    const today = new Date().toISOString().slice(0, 10);
    // 1) Insert a transaction
    const { error: txErr } = await supabase.from("transactions").insert({
      txn_date: today,
      narration: `${row.vendor} — ${row.category}`,
      amount: -Math.abs(Number(row.amount) || 0),
      category: row.category,
      source: row.payment_method ?? "Manual",
      source_bank: row.payment_method ?? null,
      ref_number: row.account_ref ?? null,
      status: "Approved",
      txn_type: "Expense",
    });
    if (txErr) {
      toast({
        title: "Couldn't post payment",
        description: txErr.message,
        variant: "destructive",
      });
      return;
    }
    // 2) Advance schedule
    const newDue =
      row.frequency === "one_off" ? row.next_due : advance(row.next_due, row.frequency);
    const updates: Partial<ScheduledExpense> = {
      last_paid_on: today,
      next_due: newDue,
    };
    if (row.frequency === "one_off") updates.status = "cancelled";
    await supabase.from("scheduled_expenses").update(updates).eq("id", row.id);
    toast({ title: "Payment recorded", description: `${fmt(row.amount)} to ${row.vendor}` });
    load();
  };

  const openAdd = () => setDialog({ open: true, initial: undefined });
  const openEdit = (row: ScheduledExpense) =>
    setDialog({
      open: true,
      initial: {
        id: row.id,
        vendor: row.vendor,
        category: row.category,
        amount: row.amount,
        frequency: row.frequency,
        next_due: row.next_due,
        payment_method: row.payment_method,
        account_ref: row.account_ref,
        auto_post: row.auto_post,
        notes: row.notes,
      },
    });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Scheduled Expenses
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Recurring vendor payments. Mark as paid to auto-record a transaction.
              {loading && " · loading…"}
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            New schedule
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-xl font-bold">{totals.activeCount}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Due in 7 days</p>
            <p className="mt-1 text-xl font-bold text-warning">{totals.dueSoonCount}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 text-xl font-bold text-destructive">
              {totals.overdueCount}
            </p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Monthly equivalent</p>
            <p className="mt-1 text-xl font-bold">{fmt(totals.monthlyEquiv)}</p>
          </Card>
        </section>

        <Card className="border border-border/60 shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CalendarClock className="h-8 w-8 opacity-40" />
                      No scheduled expenses yet.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className={cn(r.status !== "active" && "opacity-60")}
                  >
                    <TableCell>
                      <div className="font-medium text-foreground">{r.vendor}</div>
                      {r.account_ref && (
                        <div className="text-[11px] text-muted-foreground">
                          Ref {r.account_ref}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.category}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {r.frequency.replace("_", " ")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm tabular-nums">{r.next_due}</span>
                        {r.status === "active" && dueBadge(r.next_due)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmt(r.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.payment_method ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "active"
                            ? "default"
                            : r.status === "paused"
                              ? "secondary"
                              : "outline"
                        }
                        className="capitalize"
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex">
                        {r.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-success hover:text-success"
                            onClick={() => markPaid(r)}
                            title="Mark as paid"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Pay
                          </Button>
                        )}
                        {r.status !== "cancelled" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => togglePause(r)}
                            title={r.status === "active" ? "Pause" : "Resume"}
                          >
                            {r.status === "active" ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <ScheduleDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.initial}
        onSaved={load}
      />
    </AppShell>
  );
};

export default ScheduledExpensesPage;
