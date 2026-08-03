import { useEffect, useState } from "react";
import { AlertTriangle, Link2, Loader2, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

const fmtKES = (n: number) =>
  "KES " + new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 }).format(n ?? 0);

// Safaricom sends TransTime as "yyyyMMddHHmmss"; email-sourced rows store
// a plain ISO timestamp instead (see inbound-email edge function).
const fmtTransTime = (t: string | null) => {
  if (!t) return "—";
  if (t.length === 14) {
    const y = t.slice(0, 4), mo = t.slice(4, 6), d = t.slice(6, 8);
    const h = t.slice(8, 10), mi = t.slice(10, 12);
    return `${d}/${mo}/${y} ${h}:${mi}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toLocaleString("en-KE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return t;
};

interface PendingMatch {
  id: string;
  trans_id: string;
  trans_amount: number;
  msisdn: string | null;
  first_name: string | null;
  trans_time: string | null;
  bill_ref_number: string | null;
  transaction_type: string | null;
  source: string;
}

interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  total: number;
}

interface Props {
  businessId: string;
  onMatched: () => void;
}

export const UnmatchedPaymentsSection = ({ businessId, onMatched }: Props) => {
  const [items, setItems] = useState<PendingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchTarget, setMatchTarget] = useState<PendingMatch | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pending_matches")
      .select("id, trans_id, trans_amount, msisdn, first_name, trans_time, bill_ref_number, transaction_type, source")
      .eq("business_id", businessId)
      .eq("match_status", "pending")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Couldn't load unmatched payments", description: error.message, variant: "destructive" });
    } else {
      setItems((data ?? []) as PendingMatch[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (businessId) load();
  }, [businessId]);

  const openMatchDialog = async (item: PendingMatch) => {
    setMatchTarget(item);
    setSelectedInvoiceId("");
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total")
      .eq("business_id", businessId)
      .neq("status", "paid")
      .order("created_at", { ascending: false });
    setUnpaidInvoices((data ?? []) as UnpaidInvoice[]);
  };

  const confirmMatch = async () => {
    if (!matchTarget || !selectedInvoiceId) return;
    setConfirming(true);

    const invoice = unpaidInvoices.find((i) => i.id === selectedInvoiceId);

    const { error: invError } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        mpesa_reference: matchTarget.trans_id,
      })
      .eq("id", selectedInvoiceId);

    if (invError) {
      toast({ title: "Couldn't update invoice", description: invError.message, variant: "destructive" });
      setConfirming(false);
      return;
    }

    await supabase.from("transactions").insert({
      business_id: businessId,
      txn_date: new Date().toISOString().split("T")[0],
      narration: `M-Pesa payment matched - ${invoice?.invoice_number ?? ""}`,
      amount: matchTarget.trans_amount,
      txn_type: "Income",
      category: "M-Pesa Payments",
      status: "Approved",
      ref_number: matchTarget.trans_id,
      input_source: "mpesa_c2b_manual_match",
    });

    await supabase
      .from("pending_matches")
      .update({ match_status: "matched", matched_invoice_id: selectedInvoiceId })
      .eq("id", matchTarget.id);

    toast({ title: "Payment matched!", description: `${invoice?.invoice_number ?? "Invoice"} marked as paid.` });
    setMatchTarget(null);
    setConfirming(false);
    load();
    onMatched();
  };

  const dismiss = async (item: PendingMatch) => {
    setDismissingId(item.id);
    const { error } = await supabase
      .from("pending_matches")
      .update({ match_status: "dismissed" })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Couldn't dismiss", description: error.message, variant: "destructive" });
    } else {
      load();
    }
    setDismissingId(null);
  };

  if (!loading && items.length === 0) return null;

  return (
    <>
      <Card className="border-2 border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800">
            Unmatched Payments {!loading && `(${items.length})`}
          </h3>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-white border border-amber-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm flex items-center gap-2">
                    {fmtKES(item.trans_amount)}
                    {item.source === "email" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        <Mail className="h-2.5 w-2.5" />
                        via Email
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.source === "email"
                      ? item.first_name || "Unknown sender"
                      : `${item.msisdn || "Unknown number"}${item.first_name ? ` · ${item.first_name}` : ""}`}
                    {" · "}
                    {item.source === "email"
                      ? item.bill_ref_number
                        ? `Ref: ${item.bill_ref_number}`
                        : "No reference found"
                      : item.bill_ref_number
                        ? `Paybill (ref: ${item.bill_ref_number})`
                        : "Till"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmtTransTime(item.trans_time)} · {item.source === "email" ? "Message" : "Receipt"} {item.trans_id}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    onClick={() => openMatchDialog(item)}
                    size="sm"
                    className="gap-2 bg-amber-600 hover:bg-amber-700"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Match to Invoice
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismiss(item)}
                    disabled={dismissingId === item.id}
                    className="gap-1 text-muted-foreground hover:text-destructive"
                  >
                    {dismissingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!matchTarget} onOpenChange={(o) => !o && setMatchTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Match Payment to Invoice</DialogTitle>
          </DialogHeader>

          {matchTarget && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">{fmtKES(matchTarget.trans_amount)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matchTarget.msisdn} · Receipt {matchTarget.trans_id}
                </p>
              </div>

              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an unpaid invoice…" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No unpaid invoices found.
                    </div>
                  ) : (
                    unpaidInvoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {fmtKES(inv.total)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchTarget(null)} disabled={confirming}>
              Cancel
            </Button>
            <Button onClick={confirmMatch} disabled={!selectedInvoiceId || confirming} className="gap-2">
              {confirming ? <><Loader2 className="h-4 w-4 animate-spin" />Matching…</> : "Confirm Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};