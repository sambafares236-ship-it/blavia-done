import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { PAYMENT_METHODS, PaymentMethod, recordInstantPayment } from "@/lib/instantPayments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  direction?: "Income" | "Expense";
  title?: string;
  defaultAmount?: number;
  lockAmount?: boolean;
  defaultNarration?: string;
  defaultReference?: string;
  defaultCategory?: string;
  onRecorded: (method: PaymentMethod) => void;
}

export const RecordPaymentDialog = ({
  open, onOpenChange, businessId, direction = "Income", title,
  defaultAmount = 0, lockAmount = false, defaultNarration = "",
  defaultReference = "", defaultCategory, onRecorded,
}: Props) => {
  const [amount, setAmount] = useState(String(defaultAmount));
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [narration, setNarration] = useState(defaultNarration);
  const [reference, setReference] = useState(defaultReference);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(String(defaultAmount));
      setMethod("Cash");
      setNarration(defaultNarration);
      setReference(defaultReference);
    }
  }, [open, defaultAmount, defaultNarration, defaultReference]);

  const handleSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!narration.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await recordInstantPayment({
      businessId, amount: amt, direction, method,
      narration: narration.trim(), reference: reference.trim() || undefined,
      category: defaultCategory,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't record payment", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment recorded" });
    onOpenChange(false);
    onRecorded(method);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? (direction === "Income" ? "Record Payment" : "Record Expense Payment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rp-amount">Amount (KES)</Label>
              <Input
                id="rp-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                disabled={lockAmount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-narration">Description</Label>
            <Input
              id="rp-narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Walk-in sale, cash"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-ref">Reference (optional)</Label>
            <Input
              id="rp-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa code, receipt no…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Recording…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
