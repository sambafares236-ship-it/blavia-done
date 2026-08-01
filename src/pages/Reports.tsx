import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, FileText, Mail, Printer, Sheet } from "lucide-react";
import * as XLSX from "xlsx";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase, Transaction } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import {
  cashFlow,
  changesInEquity,
  downloadCsv,
  downloadPdf,
  filterByDateRange,
  linesToCsv,
  profitAndLoss,
  type CompanyType,
  type ReportLine,
} from "@/lib/reports";
import { combinedBalanceSheet, type AssetRow, type LiabilityRow } from "@/lib/balanceSheet";
import { ApprovalWorkflow } from "@/components/reports/ApprovalWorkflow";
import { AssetsLiabilitiesChart } from "@/components/reports/AssetsLiabilitiesChart";
import { cn } from "@/lib/utils";

type PeriodMode = "monthly" | "quarterly" | "annual";
type RangePreset = "this_month" | "last_month" | "this_quarter" | "last_quarter" | "ytd" | "last_year";

const fmt = (n: number) => {
  const negative = n < 0;
  const abs = Math.abs(n);
  const s = "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(abs);
  return negative ? `(${s})` : s;
};

const computeRange = (preset: RangePreset): { from: Date; to: Date; label: string } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "this_month")
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59), label: "This Month" };
  if (preset === "last_month")
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59), label: "Last Month" };
  if (preset === "this_quarter") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: new Date(y, qStart, 1),
      to: new Date(y, qStart + 3, 0, 23, 59, 59),
      label: `Q${Math.floor(m / 3) + 1} ${y}`,
    };
  }
  if (preset === "last_quarter") {
    const qStart = Math.floor(m / 3) * 3 - 3;
    const qy = qStart < 0 ? y - 1 : y;
    const qs = ((qStart % 12) + 12) % 12;
    return {
      from: new Date(qy, qs, 1),
      to: new Date(qy, qs + 3, 0, 23, 59, 59),
      label: `Q${Math.floor(qs / 3) + 1} ${qy}`,
    };
  }
  if (preset === "ytd") return { from: new Date(y, 0, 1), to: now, label: "Year to Date" };
  return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31, 23, 59, 59), label: `FY ${y - 1}` };
};

const presetsByMode: Record<PeriodMode, { v: RangePreset; label: string }[]> = {
  monthly: [
    { v: "this_month", label: "This Month" },
    { v: "last_month", label: "Last Month" },
  ],
  quarterly: [
    { v: "this_quarter", label: "This Quarter" },
    { v: "last_quarter", label: "Last Quarter" },
  ],
  annual: [
    { v: "ytd", label: "Year to Date" },
    { v: "last_year", label: "Last Year" },
  ],
};

const linesToWorkbook = (sheets: { name: string; lines: ReportLine[] }[]) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, lines }) => {
    const data = [
      ["Account", "Amount (KES)"],
      ...lines.map((l) => [l.label, l.value === 0 && l.level === 0 ? "" : Math.round(l.value)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 40 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  return wb;
};

const Reports = () => {
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState(0);
  const [payablesTotal, setPayablesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<PeriodMode>("monthly");
  const [preset, setPreset] = useState<RangePreset>("this_month");
  const [companyType, setCompanyType] = useState<CompanyType>("local");
  const [tab, setTab] = useState("pl");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [txnRes, assetRes, liabRes, invRes, payRes] = await Promise.all([
        supabase.from("transactions").select("*").order("txn_date", { ascending: false }).limit(2000),
        supabase.from("assets").select("*").order("created_at", { ascending: false }),
        supabase.from("liabilities").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("total").in("status", ["sent", "overdue"]),
        supabase.from("payments").select("amount").eq("status", "pending"),
      ]);
      if (txnRes.error) {
        toast({
          title: "Couldn't load transactions",
          description: txnRes.error.message,
          variant: "destructive",
        });
      } else {
        setAllTxns((txnRes.data ?? []) as Transaction[]);
      }
      if (assetRes.error) {
        toast({ title: "Couldn't load assets", description: assetRes.error.message, variant: "destructive" });
      } else {
        setAssets((assetRes.data ?? []) as AssetRow[]);
      }
      if (liabRes.error) {
        toast({ title: "Couldn't load liabilities", description: liabRes.error.message, variant: "destructive" });
      } else {
        setLiabilities((liabRes.data ?? []) as LiabilityRow[]);
      }
      if (invRes.error) {
        toast({ title: "Couldn't load receivables", description: invRes.error.message, variant: "destructive" });
      } else {
        setReceivablesTotal(
          (invRes.data ?? []).reduce((s, r: { total: number | null }) => s + (Number(r.total) || 0), 0),
        );
      }
      if (payRes.error) {
        toast({ title: "Couldn't load payables", description: payRes.error.message, variant: "destructive" });
      } else {
        setPayablesTotal(
          (payRes.data ?? []).reduce((s, r: { amount: number | null }) => s + (Number(r.amount) || 0), 0),
        );
      }
      setLoading(false);
    };
    load();
  }, []);

  const { from, to, label } = computeRange(preset);
  const subtitle = `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`;

  const periodTxns = useMemo(() => filterByDateRange(allTxns, from, to), [allTxns, from, to]);

  const pl = useMemo(() => profitAndLoss(periodTxns, companyType), [periodTxns, companyType]);
  const cf = useMemo(() => cashFlow(periodTxns), [periodTxns]);
  const bs = useMemo(
    () => combinedBalanceSheet(allTxns, assets, liabilities, to, receivablesTotal, payablesTotal),
    [allTxns, assets, liabilities, to, receivablesTotal, payablesTotal],
  );
  const sce = useMemo(() => changesInEquity(periodTxns, companyType), [periodTxns, companyType]);

  // Comprehensive income = Net profit + (placeholder) Other Comprehensive Income items
  const ci: ReportLine[] = useMemo(() => {
    const net = pl.find((l) => l.label === "Net Profit / (Loss)")?.value ?? 0;
    return [
      { label: "Profit or Loss", value: 0, level: 0 },
      { label: "Net Profit / (Loss) for the period", value: net, level: 2 },
      { label: "Other Comprehensive Income (OCI)", value: 0, level: 0 },
      { label: "Revaluation surplus on PPE", value: 0, level: 2 },
      { label: "Foreign currency translation differences", value: 0, level: 2 },
      { label: "Fair value changes on financial assets", value: 0, level: 2 },
      { label: "Total OCI", value: 0, level: 3, emphasis: true },
      { label: "Total Comprehensive Income", value: net, level: 3, emphasis: true },
    ];
  }, [pl]);

  const current =
    tab === "pl" ? { lines: pl, title: "Income Statement", id: "report-pl" }
    : tab === "cf" ? { lines: cf, title: "Cash Flow Statement", id: "report-cf" }
    : tab === "bs" ? { lines: bs, title: "Balance Sheet", id: "report-bs" }
    : tab === "sce" ? { lines: sce, title: "Statement of Changes in Equity", id: "report-sce" }
    : { lines: ci, title: "Comprehensive Income", id: "report-ci" };

  const onExportCsv = () => {
    const csv = linesToCsv(current.lines);
    downloadCsv(`${current.title.replace(/\s+/g, "-").toLowerCase()}-${preset}.csv`, csv);
  };
  const onExportPdf = () => downloadPdf(current.id, `${current.title} — ${label}`);
  const onExportExcel = () => {
    const wb = linesToWorkbook([
      { name: "Income Statement", lines: pl },
      { name: "Cash Flow", lines: cf },
      { name: "Balance Sheet", lines: bs },
      { name: "Changes in Equity", lines: sce },
      { name: "Comprehensive Income", lines: ci },
    ]);
    XLSX.writeFile(wb, `financial-reports-${preset}.xlsx`);
    toast({ title: "Excel workbook exported", description: "All 5 statements included." });
  };
  const onEmail = () => {
    const subj = encodeURIComponent(`${current.title} — ${label}`);
    const body = encodeURIComponent(
      `Please find the ${current.title} for ${label} (${subtitle}) attached.\n\n— BLAVIA Finance`,
    );
    window.location.href = `mailto:?subject=${subj}&body=${body}`;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Financial Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {label} · {subtitle}
              {loading && " · loading…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={mode}
              onValueChange={(v) => {
                const m = v as PeriodMode;
                setMode(m);
                setPreset(presetsByMode[m][0].v);
              }}
            >
              <SelectTrigger className="w-[140px] gap-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={preset} onValueChange={(v) => setPreset(v as RangePreset)}>
              <SelectTrigger className="w-[180px] gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presetsByMode[mode].map((p) => (
                  <SelectItem key={p.v} value={p.v}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={companyType} onValueChange={(v) => setCompanyType(v as CompanyType)}>
              <SelectTrigger className="w-[180px] gap-2" title="Corporate tax rate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local Company (30%)</SelectItem>
                <SelectItem value="international">International (37.5%)</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onExportPdf} className="gap-2">
                  <Printer className="h-4 w-4" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportExcel} className="gap-2">
                  <Sheet className="h-4 w-4" />
                  Excel (all sheets)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportCsv} className="gap-2">
                  <FileText className="h-4 w-4" />
                  CSV (current)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEmail} className="gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
            <TabsTrigger value="pl" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Income Statement
            </TabsTrigger>
            <TabsTrigger value="cf" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="bs" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="sce" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Changes in Equity
            </TabsTrigger>
            <TabsTrigger value="ci" className="gap-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4" />
              Comprehensive Income
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pl" className="mt-0 space-y-4">
            <ApprovalWorkflow reportName="Income Statement" />
            <Card className="border border-border/60 p-6 shadow-card md:p-8">
              <ReportTableView id="report-pl" title="Income Statement" subtitle={`${label} · ${subtitle}`} lines={pl} />
            </Card>
          </TabsContent>

          <TabsContent value="cf" className="mt-0 space-y-4">
            <ApprovalWorkflow reportName="Cash Flow Statement" />
            <Card className="border border-border/60 p-6 shadow-card md:p-8">
              <ReportTableView id="report-cf" title="Cash Flow Statement" subtitle={`${label} · ${subtitle}`} lines={cf} />
            </Card>
          </TabsContent>

          <TabsContent value="bs" className="mt-0">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <ApprovalWorkflow reportName="Balance Sheet" initial="pending" />
                <Card className="border border-border/60 p-6 shadow-card md:p-8">
                  <ReportTableView
                    id="report-bs"
                    title="Balance Sheet"
                    subtitle={`As of ${to.toISOString().slice(0, 10)}`}
                    lines={bs}
                  />
                </Card>
              </div>
              <div className="space-y-4">
                <AssetsLiabilitiesChart lines={bs} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sce" className="mt-0 space-y-4">
            <ApprovalWorkflow reportName="Statement of Changes in Equity" />
            <Card className="border border-border/60 p-6 shadow-card md:p-8">
              <ReportTableView
                id="report-sce"
                title="Statement of Changes in Equity"
                subtitle={`${label} · ${subtitle}`}
                lines={sce}
              />
            </Card>
          </TabsContent>

          <TabsContent value="ci" className="mt-0 space-y-4">
            <ApprovalWorkflow reportName="Comprehensive Income" />
            <Card className="border border-border/60 p-6 shadow-card md:p-8">
              <ReportTableView
                id="report-ci"
                title="Comprehensive Income"
                subtitle={`${label} · ${subtitle}`}
                lines={ci}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div style={{ position: "absolute", left: -99999, top: -99999 }} aria-hidden>
        <PrintReport id="report-pl" title="Income Statement" subtitle={`${label} · ${subtitle}`} lines={pl} />
        <PrintReport id="report-cf" title="Cash Flow Statement" subtitle={`${label} · ${subtitle}`} lines={cf} />
        <PrintReport id="report-bs" title="Balance Sheet" subtitle={`As of ${to.toISOString().slice(0, 10)}`} lines={bs} />
        <PrintReport id="report-sce" title="Statement of Changes in Equity" subtitle={`${label} · ${subtitle}`} lines={sce} />
        <PrintReport id="report-ci" title="Comprehensive Income" subtitle={`${label} · ${subtitle}`} lines={ci} />
      </div>
    </AppShell>
  );
};

const PrintReport = ({
  id,
  title,
  subtitle,
  lines,
}: {
  id: string;
  title: string;
  subtitle: string;
  lines: ReportLine[];
}) => (
  <div id={id}>
    <h1>{title}</h1>
    <div className="sub">{subtitle}</div>
    <table>
      <tbody>
        {lines.map((l, i) => {
          const isSection = l.level === 0;
          const isTotal = l.emphasis;
          const cls = isSection ? "section" : isTotal ? "total" : "line";
          return (
            <tr key={`${l.label}-${i}`} className={cls}>
              <td className={l.level && l.level >= 2 ? "indent" : ""}>{l.label}</td>
              <td className={cn("amt", l.value < 0 && "neg")}>{isSection ? "" : fmt(l.value)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const ReportTableView = ({
  id,
  title,
  subtitle,
  lines,
}: {
  id: string;
  title: string;
  subtitle: string;
  lines: ReportLine[];
}) => (
  <div className="space-y-5" data-print-target={id}>
    <div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{subtitle}</p>
    </div>
    <div className="divide-y divide-border">
      {lines.map((l, i) => {
        const isSection = l.level === 0;
        const isTotal = l.emphasis;
        if (isSection) {
          return (
            <div
              key={`${l.label}-${i}`}
              className="pt-5 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
            >
              {l.label}
            </div>
          );
        }
        return (
          <div
            key={`${l.label}-${i}`}
            className={cn(
              "flex items-center justify-between py-2.5 text-sm",
              isTotal && "border-t-2 border-foreground pt-3 font-bold text-foreground",
              !isTotal && l.level === 2 && "pl-4 text-foreground/85",
            )}
          >
            <span>{l.label}</span>
            <span className={cn("tabular-nums", l.value < 0 && "text-destructive")}>{fmt(l.value)}</span>
          </div>
        );
      })}
    </div>
  </div>
);

export default Reports;