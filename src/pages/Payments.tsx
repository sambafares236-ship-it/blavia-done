import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { UnmatchedPaymentsSection } from "@/components/payments/UnmatchedPaymentsSection";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { downloadCsv, printTableAsPdf } from "@/lib/exporters";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toISOString().slice(0, 10);
};

// Build last 24 months as options
const buildMonthOptions = () => {
  const options: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 24; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-KE", { month: "long", year: "numeric" });
    options.push({ key, label });
    d.setMonth(d.getMonth() - 1);
  }
  return options;
};

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const firstOfMonth = () => {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1));
};
const todayStr = () => isoDate(new Date());

type ViewMode = "month" | "custom" | "all";

const Payments = () => {
  const { profile } = useAuth();
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const monthOptions = useMemo(() => buildMonthOptions(), []);
  // Default to the current month (index 0) so today's payments show immediately
  const [monthIdx, setMonthIdx] = useState(0);
  const selectedMonth = monthOptions[monthIdx];

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [customFrom, setCustomFrom] = useState(firstOfMonth());
  const [customTo, setCustomTo] = useState(todayStr());
  const [recordOpen, setRecordOpen] = useState(false);

  const loadTxns = async () => {
    if (!profile?.business_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("business_id", profile.business_id)
      .order("txn_date", { ascending: false })
      .limit(2000);
    if (error) {
      toast({ title: "Couldn't load payments", description: error.message, variant: "destructive" });
    } else {
      setAllTxns((data ?? []) as Transaction[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTxns();
  }, [profile?.business_id]);

  const periodLabel = viewMode === "month"
    ? selectedMonth.label
    : viewMode === "all"
      ? "all time"
      : `${customFrom || "…"} → ${customTo || "…"}`;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTxns.filter((t) => {
      if (viewMode === "month") {
        if (!t.txn_date?.startsWith(selectedMonth.key)) return false;
      } else if (viewMode === "custom") {
        if (customFrom && (t.txn_date ?? "") < customFrom) return false;
        if (customTo && (t.txn_date ?? "") > customTo) return false;
      }
      if (!q) return true;
      return [t.narration, t.category, t.txn_id, t.ref_number, t.source_bank]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allTxns, viewMode, selectedMonth.key, customFrom, customTo, search]);

  const totals = useMemo(() => {
    const inflow = rows
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const outflow = rows
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    return { inflow, outflow, net: inflow - outflow, count: rows.length };
  }, [rows]);

  const headers = ["Date", "Description", "Amount (KES)", "Type", "Method", "Status"];
  const exportRows = () => rows.map((t) => [
    fmtDate(t.txn_date), t.narration ?? "",
    Math.round(Number(t.amount) || 0), t.txn_type ?? "",
    t.source_bank ?? "", t.status ?? "",
  ]);

  const periodKey = viewMode === "month" ? selectedMonth.key : viewMode === "all" ? "all-time" : `${customFrom}_to_${customTo}`;
  const onCsv = () => downloadCsv(`payments-${periodKey}.csv`, headers, exportRows());
  const onPdf = () => printTableAsPdf({
    title: "Payments",
    subtitle: periodLabel,
    headers, rows: exportRows(),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Payments
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading…" : `${totals.count} transaction${totals.count !== 1 ? "s" : ""} ${viewMode === "all" ? "(all time)" : viewMode === "custom" ? `from ${periodLabel}` : `in ${periodLabel}`}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setRecordOpen(true)}
              className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Record Payment
            </Button>
            <Button variant="outline" size="sm" onClick={onCsv} className="gap-2 rounded-lg">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onPdf} className="gap-2 rounded-lg">
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </header>

        {profile?.business_id && (
          <UnmatchedPaymentsSection businessId={profile.business_id} onMatched={loadTxns} />
        )}

        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="mt-1 text-xl font-bold">{totals.count}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Inflow</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{fmtKES(totals.inflow)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Outflow</p>
            <p className="mt-1 text-xl font-bold text-destructive">{fmtKES(totals.outflow)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={cn("mt-1 text-xl font-bold",
              totals.net >= 0 ? "text-foreground" : "text-destructive")}>
              {fmtKES(totals.net)}
            </p>
          </Card>
        </section>

        {/* View mode + period filter + search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode tabs */}
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
            {([
              { key: "month", label: "Months" },
              { key: "custom", label: "Custom" },
              { key: "all", label: "All time" },
            ] as const).map((m) => (
              <button
                key={m.key}
                onClick={() => setViewMode(m.key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === m.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {viewMode === "month" && (
            <>
              {/* Month selector */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 shadow-card">
                <button
                  onClick={() => setMonthIdx((i) => Math.min(i + 1, monthOptions.length - 1))}
                  disabled={monthIdx >= monthOptions.length - 1}
                  className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[160px] text-center text-sm font-semibold">
                  {selectedMonth.label}
                </span>
                <button
                  onClick={() => setMonthIdx((i) => Math.max(i - 1, 0))}
                  disabled={monthIdx <= 0}
                  className="rounded p-1 hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Quick month jumps */}
              <div className="flex gap-1">
                {[0, 1, 2].map((offset) => (
                  <button
                    key={offset}
                    onClick={() => setMonthIdx(offset)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      monthIdx === offset
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {offset === 0 ? "This month" : offset === 1 ? "Last month" : monthOptions[offset].label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </>
          )}

          {viewMode === "custom" && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-card">
              <Input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-[150px] border-none shadow-none focus-visible:ring-0"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-[150px] border-none shadow-none focus-visible:ring-0"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, ref…"
              className="h-9 rounded-lg border-border bg-card pl-10 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {["Date", "Description", "Amount", "Type", "Method", "Status"].map((h) => (
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
                    Loading payments…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No payments {viewMode === "all" ? "recorded yet" : `in ${periodLabel}`}.
                    {viewMode !== "all" && (
                      <span className="block mt-1 text-xs">
                        Try{" "}
                        <button
                          onClick={() => setViewMode("all")}
                          className="text-primary underline"
                        >
                          all time
                        </button>{" "}
                        to see every transaction.
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => {
                  const isIncome = (t.txn_type ?? "").toLowerCase() === "income";
                  return (
                    <TableRow key={String(t.id)} className="hover:bg-muted/30">
                      <TableCell className="text-sm tabular-nums">{fmtDate(t.txn_date)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{t.narration || "—"}</div>
                        {(t.txn_id || t.ref_number) && (
                          <div className="text-[11px] text-muted-foreground">
                            Ref {t.txn_id || t.ref_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-semibold tabular-nums",
                        isIncome ? "text-emerald-600" : "text-destructive"
                      )}>
                        {isIncome ? "+ " : "− "}
                        {fmtKES(Math.abs(Number(t.amount) || 0))}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                          isIncome
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        )}>
                          {t.txn_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.source_bank || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {profile?.business_id && (
        <RecordPaymentDialog
          open={recordOpen}
          onOpenChange={setRecordOpen}
          businessId={profile.business_id}
          onRecorded={loadTxns}
        />
      )}
    </AppShell>
  );
};

export default Payments;