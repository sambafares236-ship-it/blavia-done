import { Transaction } from "@/lib/supabase";
import { StatusBadge } from "./StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react";

interface TransactionsTableProps {
  rows: Transaction[];
  loading?: boolean;
}

const fmtCurrency = (n: number) =>
  "KES " +
  new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n ?? 0);

const fmtDate = (d: string) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toISOString().slice(0, 10);
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tone =
    pct >= 85 ? "bg-success" : pct >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
};

export const TransactionsTable = ({ rows, loading }: TransactionsTableProps) => {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Transaction
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Category
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AI Confidence
            </TableHead>
            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                Loading transactions…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                No transactions found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((t) => {
              const isIncome = (t.txn_type ?? "").toLowerCase() === "income";
              const ref = t.txn_id || t.ref_number;
              const confidence = Math.round(((t.confidence ?? 0.9) as number) * 100);
              return (
                <TableRow key={String(t.id)} className="border-b-border hover:bg-muted/30">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          isIncome
                            ? "bg-success/12 text-success"
                            : "bg-destructive/12 text-destructive",
                        )}
                      >
                        {isIncome ? (
                          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {t.narration || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(t.txn_date)}
                          {ref && (
                            <>
                              <span className="mx-1.5 opacity-60">•</span>
                              {ref}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground">
                      {t.category || "Uncategorized"}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold tabular-nums",
                      isIncome ? "text-success" : "text-destructive",
                    )}
                  >
                    {isIncome ? "+ " : "− "}
                    {fmtCurrency(Math.abs(Number(t.amount) || 0))}
                  </TableCell>
                  <TableCell>
                    <ConfidenceBar value={confidence} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <button className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
