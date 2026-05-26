import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChatbotWidget } from "@/components/dashboard/ChatbotWidget";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { downloadCsv, printTableAsPdf } from "@/lib/exporters";

import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Preset = "today" | "yesterday" | "week" | "month" | "custom";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d: string) => {
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toISOString().slice(0, 10);
};

const startOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOf = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const computeRange = (
  preset: Preset,
  custom: { from?: Date; to?: Date },
): { from: Date; to: Date; label: string } => {
  const now = new Date();
  if (preset === "today") return { from: startOf(now), to: endOf(now), label: "Today" };
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOf(y), to: endOf(y), label: "Yesterday" };
  }
  if (preset === "week") {
    const w = new Date(now);
    w.setDate(w.getDate() - 6);
    return { from: startOf(w), to: endOf(now), label: "This Week" };
  }
  if (preset === "month") {
    const m = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: startOf(m), to: endOf(now), label: "This Month" };
  }
  const f = custom.from ?? startOf(now);
  const t = custom.to ?? endOf(now);
  return { from: startOf(f), to: endOf(t), label: "Custom Range" };
};

const Payments = () => {
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("month");
  const [custom, setCustom] = useState<{ from?: Date; to?: Date }>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("txn_date", { ascending: false })
        .limit(2000);
      if (error) {
        toast({
          title: "Couldn't load payments",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setAllTxns((data ?? []) as Transaction[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const { from, to, label } = computeRange(preset, custom);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTxns.filter((t) => {
      const d = new Date(t.txn_date);
      if (isNaN(d.getTime()) || d < from || d > to) return false;
      if (!q) return true;
      return [t.narration, t.category, t.txn_id, t.ref_number, t.source, t.source_bank]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allTxns, from, to, search]);

  const totals = useMemo(() => {
    const inflow = rows
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "income")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const outflow = rows
      .filter((t) => (t.txn_type ?? "").toLowerCase() === "expense")
      .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    return { inflow, outflow, net: inflow - outflow, count: rows.length };
  }, [rows]);

  const exportRows = () =>
    rows.map((t) => [
      fmtDate(t.txn_date),
      t.narration ?? "",
      Math.round(Number(t.amount) || 0),
      t.txn_type ?? "",
      t.source_bank ?? t.source ?? "",
      t.status ?? "",
    ]);

  const headers = ["Date", "Description", "Amount (KES)", "Type", "Method", "Status"];

  const onCsv = () =>
    downloadCsv(`payments-${preset}-${Date.now()}.csv`, headers, exportRows());
  const onPdf = () =>
    printTableAsPdf({
      title: "Payments",
      subtitle: `${label} · ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`,
      headers,
      rows: exportRows(),
    });

  const presets: { v: Preset; label: string }[] = [
    { v: "today", label: "Today" },
    { v: "yesterday", label: "Yesterday" },
    { v: "week", label: "This Week" },
    { v: "month", label: "This Month" },
    { v: "custom", label: "Custom" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Payments
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {label} · {from.toISOString().slice(0, 10)} → {to.toISOString().slice(0, 10)}
              {loading && " · loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCsv} className="gap-2 rounded-lg">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              size="sm"
              onClick={onPdf}
              className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </header>

        {/* Summary */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Payments</p>
            <p className="mt-1 text-xl font-bold">{totals.count}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Inflow</p>
            <p className="mt-1 text-xl font-bold text-success">{fmtKES(totals.inflow)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Outflow</p>
            <p className="mt-1 text-xl font-bold text-destructive">{fmtKES(totals.outflow)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={cn(
                "mt-1 text-xl font-bold",
                totals.net >= 0 ? "text-foreground" : "text-destructive",
              )}
            >
              {fmtKES(totals.net)}
            </p>
          </Card>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-card">
            {presets.map((p) => (
              <button
                key={p.v}
                onClick={() => setPreset(p.v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === p.v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                    <CalendarDays className="h-4 w-4" />
                    {custom.from ? format(custom.from, "PP") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={custom.from}
                    onSelect={(d) => setCustom((c) => ({ ...c, from: d ?? undefined }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 rounded-lg">
                    <CalendarDays className="h-4 w-4" />
                    {custom.to ? format(custom.to, "PP") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={custom.to}
                    onSelect={(d) => setCustom((c) => ({ ...c, to: d ?? undefined }))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

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
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Description
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Method
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
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
                    No payments in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => {
                  const isIncome = (t.txn_type ?? "").toLowerCase() === "income";
                  return (
                    <TableRow key={String(t.id)} className="hover:bg-muted/30">
                      <TableCell className="text-sm tabular-nums">{fmtDate(t.txn_date)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">
                          {t.narration || "—"}
                        </div>
                        {(t.txn_id || t.ref_number) && (
                          <div className="text-[11px] text-muted-foreground">
                            Ref {t.txn_id || t.ref_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          isIncome ? "text-success" : "text-destructive",
                        )}
                      >
                        {isIncome ? "+ " : "− "}
                        {fmtKES(Math.abs(Number(t.amount) || 0))}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
                            isIncome
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-destructive/30 bg-destructive/10 text-destructive",
                          )}
                        >
                          {t.txn_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.source_bank || t.source || "—"}
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

      <ChatbotWidget />
    </AppShell>
  );
};

export default Payments;
