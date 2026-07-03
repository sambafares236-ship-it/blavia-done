import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Download, FileText, Plus, Search, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";
import { AddPayableDialog } from "@/components/payments/AddPayableDialog";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { PaymentMethod } from "@/lib/instantPayments";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { downloadCsv, printTableAsPdf } from "@/lib/exporters";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Bucket, BUCKET_META, BUCKET_ORDER, bucketOf } from "@/lib/aging";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
};

const todayStr = () => new Date().toISOString().slice(0, 10);

interface Payable {
  id: number;
  payment_type: string | null;
  amount: number;
  narration: string | null;
  status: string;
  reference_number: string | null;
  due_date: string | null;
}

const Payables = () => {
  const { profile } = useAuth();
  const [payables, setPayables] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<Bucket | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Payable | null>(null);

  const loadPayables = async () => {
    if (!profile?.business_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select("id, payment_type, amount, narration, status, reference_number, due_date")
      .eq("business_id", profile.business_id)
      .eq("status", "pending")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) {
      toast({ title: "Couldn't load payables", description: error.message, variant: "destructive" });
    } else {
      setPayables((data ?? []) as Payable[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPayables();
  }, [profile?.business_id]);

  const today = todayStr();

  const withBucket = useMemo(
    () => payables.map((p) => ({ ...p, bucket: bucketOf(p.due_date, today) })),
    [payables, today],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withBucket.filter((p) => {
      if (bucketFilter !== "all" && p.bucket !== bucketFilter) return false;
      if (!q) return true;
      return [p.narration, p.payment_type, p.reference_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [withBucket, bucketFilter, search]);

  const totals = useMemo(() => {
    const outstanding = withBucket.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const overdueRows = withBucket.filter((p) => p.bucket.startsWith("overdue"));
    const overdue = overdueRows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const dueSoonRows = withBucket.filter((p) => p.bucket === "due_soon");
    const dueSoon = dueSoonRows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return {
      outstanding, count: withBucket.length,
      overdue, overdueCount: overdueRows.length,
      dueSoon, dueSoonCount: dueSoonRows.length,
    };
  }, [withBucket]);

  const bucketCounts = useMemo(() => {
    const m: Record<Bucket, number> = { not_due: 0, due_soon: 0, overdue_1_30: 0, overdue_31_60: 0, overdue_60_plus: 0, no_due_date: 0 };
    withBucket.forEach((p) => { m[p.bucket]++; });
    return m;
  }, [withBucket]);

  const finalizePaid = async (method: PaymentMethod) => {
    if (!payTarget) return;
    const { error } = await supabase
      .from("payments")
      .update({ status: "paid", paid_date: todayStr(), payment_method: method })
      .eq("id", payTarget.id);
    if (error) {
      toast({ title: "Payment recorded, but payable status update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payable marked as paid" });
    }
    setPayTarget(null);
    loadPayables();
  };

  const headers = ["Payee", "Category", "Due Date", "Amount (KES)", "Aging"];
  const exportRows = () => rows.map((p) => [
    p.narration ?? "", p.payment_type ?? "",
    fmtDate(p.due_date), Math.round(Number(p.amount) || 0), BUCKET_META[p.bucket].label,
  ]);
  const onCsv = () => downloadCsv(`payables-${today}.csv`, headers, exportRows());
  const onPdf = () => printTableAsPdf({
    title: "Payables — Money You Owe",
    subtitle: `As of ${fmtDate(today)}`,
    headers, rows: exportRows(),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Payables
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading…" : `${totals.count} unpaid bill${totals.count !== 1 ? "s" : ""} — money you owe, not yet paid out`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}
              className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add Payable
            </Button>
            <Button variant="outline" size="sm" onClick={onCsv} className="gap-2 rounded-lg">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onPdf} className="gap-2 rounded-lg">
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Total Payable</p>
            <p className="mt-1 text-xl font-bold">{fmtKES(totals.outstanding)}</p>
            <p className="text-[11px] text-muted-foreground">{totals.count} bill{totals.count !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{fmtKES(totals.dueSoon)}</p>
            <p className="text-[11px] text-muted-foreground">{totals.dueSoonCount} bill{totals.dueSoonCount !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border-2 border-red-200 bg-red-50 p-4 shadow-card">
            <p className="text-xs text-red-700">Overdue</p>
            <p className="mt-1 text-xl font-bold text-red-700">{fmtKES(totals.overdue)}</p>
            <p className="text-[11px] text-red-700/70">{totals.overdueCount} bill{totals.overdueCount !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Not Yet Due</p>
            <p className="mt-1 text-xl font-bold">{fmtKES(withBucket.filter((p) => p.bucket === "not_due").reduce((s, p) => s + (Number(p.amount) || 0), 0))}</p>
            <p className="text-[11px] text-muted-foreground">{bucketCounts.not_due} bill{bucketCounts.not_due !== 1 ? "s" : ""}</p>
          </Card>
        </section>

        {/* Aging filter + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
            <button
              onClick={() => setBucketFilter("all")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                bucketFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({totals.count})
            </button>
            {BUCKET_ORDER.map((b) => (
              <button
                key={b}
                onClick={() => setBucketFilter(b)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  bucketFilter === b ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {BUCKET_META[b].label} ({bucketCounts[b]})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payee, category…"
              className="h-9 rounded-lg border-border bg-card pl-10 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {["Payee", "Category", "Due Date", "Amount", "Aging", ""].map((h) => (
                  <TableHead key={h}
                    className={cn("text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      h === "Amount" && "text-right")}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    Loading payables…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <Wallet className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    Nothing owed by you {bucketFilter === "all" ? "right now" : `in "${BUCKET_META[bucketFilter as Bucket].label}"`}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{p.narration || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.payment_type || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(p.due_date)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtKES(p.amount)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        BUCKET_META[p.bucket].color
                      )}>
                        {BUCKET_META[p.bucket].label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setPayTarget(p)} className="gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Mark Paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {profile?.business_id && (
        <AddPayableDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          businessId={profile.business_id}
          onSaved={loadPayables}
        />
      )}

      {profile?.business_id && payTarget && (
        <RecordPaymentDialog
          open={!!payTarget}
          onOpenChange={(o) => !o && setPayTarget(null)}
          businessId={profile.business_id}
          direction="Expense"
          title="Record Payment & Mark Payable Paid"
          defaultAmount={payTarget.amount}
          lockAmount
          defaultNarration={payTarget.narration ?? ""}
          defaultReference={payTarget.reference_number ?? ""}
          defaultCategory={payTarget.payment_type ?? undefined}
          onRecorded={finalizePaid}
        />
      )}

      <ChatbotWidget />
    </AppShell>
  );
};

export default Payables;
