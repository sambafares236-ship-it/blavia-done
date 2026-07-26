import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Eye, FileText, Hourglass, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
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

type Tables = Database["public"]["Tables"];

/** Projected off the generated schema so it cannot drift from the database. */
type ReceivableInvoice = Pick<
  Tables["invoices"]["Row"],
  "id" | "invoice_number" | "status" | "issue_date" | "due_date" | "total" | "paid_at"
> & { contacts: Pick<Tables["contacts"]["Row"], "name" | "phone" | "email"> | null };

const Receivables = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<Bucket | "all">("all");

  useEffect(() => {
    if (!profile?.business_id) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, issue_date, due_date, total, paid_at, contacts(name, phone, email)")
        .eq("business_id", profile.business_id)
        .in("status", ["sent", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) {
        toast({ title: "Couldn't load receivables", description: error.message, variant: "destructive" });
      } else {
        setInvoices(data ?? []);
      }
      setLoading(false);
    };
    load();
  }, [profile?.business_id]);

  const today = todayStr();

  const withBucket = useMemo(
    () => invoices.map((inv) => ({ ...inv, bucket: bucketOf(inv.due_date, today) })),
    [invoices, today],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withBucket.filter((inv) => {
      if (bucketFilter !== "all" && inv.bucket !== bucketFilter) return false;
      if (!q) return true;
      return [inv.invoice_number, inv.contacts?.name, inv.contacts?.email, inv.contacts?.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [withBucket, bucketFilter, search]);

  const totals = useMemo(() => {
    const outstanding = withBucket.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const overdueRows = withBucket.filter((i) => i.bucket.startsWith("overdue"));
    const overdue = overdueRows.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const dueSoonRows = withBucket.filter((i) => i.bucket === "due_soon");
    const dueSoon = dueSoonRows.reduce((s, i) => s + (Number(i.total) || 0), 0);
    return {
      outstanding, count: withBucket.length,
      overdue, overdueCount: overdueRows.length,
      dueSoon, dueSoonCount: dueSoonRows.length,
    };
  }, [withBucket]);

  const bucketCounts = useMemo(() => {
    const m: Record<Bucket, number> = { not_due: 0, due_soon: 0, overdue_1_30: 0, overdue_31_60: 0, overdue_60_plus: 0, no_due_date: 0 };
    withBucket.forEach((i) => { m[i.bucket]++; });
    return m;
  }, [withBucket]);

  const headers = ["Invoice", "Customer", "Issue Date", "Due Date", "Amount (KES)", "Aging"];
  const exportRows = () => rows.map((i) => [
    i.invoice_number, i.contacts?.name ?? "",
    fmtDate(i.issue_date), fmtDate(i.due_date),
    Math.round(Number(i.total) || 0), BUCKET_META[i.bucket].label,
  ]);
  const onCsv = () => downloadCsv(`receivables-${today}.csv`, headers, exportRows());
  const onPdf = () => printTableAsPdf({
    title: "Receivables — Money Owed to You",
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
              Receivables
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Loading…" : `${totals.count} unpaid invoice${totals.count !== 1 ? "s" : ""} owed to you — money expected, not yet in hand`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCsv} className="gap-2 rounded-lg">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={onPdf}
              className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
              <FileText className="h-4 w-4" /> PDF
            </Button>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="mt-1 text-xl font-bold">{fmtKES(totals.outstanding)}</p>
            <p className="text-[11px] text-muted-foreground">{totals.count} invoice{totals.count !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Due This Week</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{fmtKES(totals.dueSoon)}</p>
            <p className="text-[11px] text-muted-foreground">{totals.dueSoonCount} invoice{totals.dueSoonCount !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border-2 border-red-200 bg-red-50 p-4 shadow-card">
            <p className="text-xs text-red-700">Overdue</p>
            <p className="mt-1 text-xl font-bold text-red-700">{fmtKES(totals.overdue)}</p>
            <p className="text-[11px] text-red-700/70">{totals.overdueCount} invoice{totals.overdueCount !== 1 ? "s" : ""}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Not Yet Due</p>
            <p className="mt-1 text-xl font-bold">{fmtKES(withBucket.filter((i) => i.bucket === "not_due").reduce((s, i) => s + (Number(i.total) || 0), 0))}</p>
            <p className="text-[11px] text-muted-foreground">{bucketCounts.not_due} invoice{bucketCounts.not_due !== 1 ? "s" : ""}</p>
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
              placeholder="Search invoice, customer…"
              className="h-9 rounded-lg border-border bg-card pl-10 text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {["Invoice", "Customer", "Issue Date", "Due Date", "Amount", "Aging", ""].map((h) => (
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
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading receivables…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Hourglass className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    Nothing owed to you {bucketFilter === "all" ? "right now" : `in "${BUCKET_META[bucketFilter as Bucket].label}"`}.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{inv.contacts?.name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{inv.contacts?.phone || inv.contacts?.email || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.issue_date)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.due_date)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtKES(inv.total)}</TableCell>
                    <TableCell>
                      <span className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                        BUCKET_META[inv.bucket].color
                      )}>
                        {BUCKET_META[inv.bucket].label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/invoices/${inv.id}`)} className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
};

export default Receivables;
