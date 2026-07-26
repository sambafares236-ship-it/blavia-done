import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  businessId: string;
  customerName: string | null;
  total: number | null;
  vatAmount: number | null;
  onSaved: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Captures the CUIN for an invoice a business issued on KRA's own channels
 * (eTIMS Lite portal or *222#). Businesses without an OSCU device serial can't
 * have their invoices submitted from here, but the obligation still applies to
 * them, so the proof of reporting has to be recordable by hand.
 */
export const RecordEtimsDialog = ({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  businessId,
  customerName,
  total,
  vatAmount,
  onSaved,
}: Props) => {
  const [cuin, setCuin] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCuin("");
      setReceiptNo("");
      setIssuedOn(todayStr());
    }
  }, [open]);

  const handleSave = async () => {
    if (!cuin.trim()) {
      toast({ title: "CUIN is required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const submittedAt = new Date(`${issuedOn}T00:00:00`).toISOString();

    const { error } = await supabase
      .from("invoices")
      .update({
        cuin: cuin.trim(),
        etims_receipt_no: receiptNo.trim() || null,
        etims_submitted_at: submittedAt,
        etims_status: "recorded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) {
      setSaving(false);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }

    // Mirror the audit row the integrated route writes, so etims_invoices stays
    // a complete record of everything reported to KRA regardless of route.
    const { error: auditError } = await supabase.from("etims_invoices").insert({
      business_id: businessId,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      cuin: cuin.trim(),
      customer_name: customerName,
      total_amount: total,
      vat_amount: vatAmount,
      status: "recorded",
      etims_receipt_no: receiptNo.trim() || null,
      submitted_at: submittedAt,
      raw_request: null,
      raw_response: { recorded_manually: true, source: "etims_lite" },
    });

    setSaving(false);

    if (auditError) {
      // The invoice itself is updated, so don't present this as a failure —
      // just don't claim the audit trail is complete when it isn't.
      toast({
        title: "Recorded, but the audit entry failed",
        description: auditError.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "eTIMS details recorded" });
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record eTIMS details</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Issue this invoice on the KRA eTIMS portal or <span className="font-mono">*222#</span>,
          then enter the control number KRA returns.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="etims-cuin">CUIN / Invoice control number</Label>
            <Input
              id="etims-cuin"
              value={cuin}
              onChange={(e) => setCuin(e.target.value.toUpperCase())}
              placeholder="From KRA"
              className="font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="etims-receipt">Receipt no. (optional)</Label>
              <Input
                id="etims-receipt"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="etims-date">Issued on</Label>
              <Input
                id="etims-date"
                type="date"
                max={todayStr()}
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
