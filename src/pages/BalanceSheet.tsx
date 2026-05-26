import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Wallet, Scale } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { AssetLiabilityDialog, type Mode } from "@/components/balance/AssetLiabilityDialog";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(Math.abs(n));

interface Row {
  id: string;
  name: string;
  category: string;
  value: number;
  acquired_on?: string | null;
  due_on?: string | null;
  notes?: string | null;
}

export default function BalanceSheetPage() {
  const [assets, setAssets] = useState<Row[]>([]);
  const [liabilities, setLiabilities] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; mode: Mode; row?: Row }>({
    open: false, mode: "asset",
  });

  const load = async () => {
    setLoading(true);
    const [aRes, lRes] = await Promise.all([
      supabase.from("assets").select("*").order("created_at", { ascending: false }),
      supabase.from("liabilities").select("*").order("created_at", { ascending: false }),
    ]);
    if (aRes.error) {
      console.error("Load assets error:", aRes.error);
      toast({ title: "Load assets error", description: aRes.error.message, variant: "destructive" });
    } else setAssets(aRes.data as Row[]);
    if (lRes.error) {
      console.error("Load liabilities error:", lRes.error);
      toast({ title: "Load liabilities error", description: lRes.error.message, variant: "destructive" });
    } else setLiabilities(lRes.data as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (table: "assets" | "liabilities", id: string) => {
    if (!confirm(`Delete this ${table === "assets" ? "asset" : "liability"}?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      load();
    }
  };

  const totals = useMemo(() => {
    const a = assets.reduce((s, r) => s + Number(r.value || 0), 0);
    const l = liabilities.reduce((s, r) => s + Number(r.value || 0), 0);
    return { a, l, net: a - l };
  }, [assets, liabilities]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Assets & Liabilities
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your balance sheet items
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Total Assets</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{fmt(totals.a)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Total Liabilities</p>
            <p className="mt-1 text-xl font-bold text-destructive">{fmt(totals.l)}</p>
          </Card>
          <Card className="border border-border/60 p-4 shadow-card">
            <p className="text-xs text-muted-foreground">Net Position</p>
            <p className={cn("mt-1 text-xl font-bold", totals.net >= 0 ? "text-foreground" : "text-destructive")}>
              {fmt(totals.net)}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assets */}
          <Card className="border border-border/60 shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Wallet className="h-4 w-4 text-emerald-600" /> Assets
              </div>
              <Button size="sm" onClick={() => setDialog({ open: true, mode: "asset" })}>
                <Plus className="mr-1 h-4 w-4" /> Add asset
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No assets yet
                    </TableCell>
                  </TableRow>
                ) : assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(a.value)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setDialog({ open: true, mode: "asset", row: a })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete("assets", a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Liabilities */}
          <Card className="border border-border/60 shadow-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Scale className="h-4 w-4 text-destructive" /> Liabilities
              </div>
              <Button size="sm" variant="destructive"
                onClick={() => setDialog({ open: true, mode: "liability" })}>
                <Plus className="mr-1 h-4 w-4" /> Add liability
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {liabilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No liabilities yet
                    </TableCell>
                  </TableRow>
                ) : liabilities.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-destructive">{fmt(l.value)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setDialog({ open: true, mode: "liability", row: l })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete("liabilities", l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      <AssetLiabilityDialog
        mode={dialog.mode}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        initial={dialog.row ? {
          id: dialog.row.id,
          name: dialog.row.name,
          category: dialog.row.category,
          value: dialog.row.value,
          date: dialog.mode === "asset" ? dialog.row.acquired_on : dialog.row.due_on,
          notes: dialog.row.notes,
        } : undefined}
        onSaved={load}
      />
    </AppShell>
  );
}