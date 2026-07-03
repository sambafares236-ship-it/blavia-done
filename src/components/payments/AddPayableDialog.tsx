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
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export const PAYABLE_CATEGORIES = ["Supplier", "Rent", "Utilities", "Loan Repayment", "Tax", "Salaries", "Other"] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onSaved: () => void;
}

export const AddPayableDialog = ({ open, onOpenChange, businessId, onSaved }: Props) => {
  const [payee, setPayee] = useState("");
  const [category, setCategory] = useState<string>(PAYABLE_CATEGORIES[0]);
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPayee("");
      setCategory(PAYABLE_CATEGORIES[0]);
      setAmount("0");
      setDueDate("");
      setReference("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!payee.trim()) {
      toast({ title: "Payee / description is required", variant: "destructive" });
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("payments").insert({
      business_id: businessId,
      payment_type: category,
      amount: amt,
      narration: payee.trim(),
      status: "pending",
      reference_number: reference.trim() || null,
      due_date: dueDate || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save payable", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payable added" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payable</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pay-payee">Payee / description</Label>
            <Input
              id="pay-payee"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="e.g. ABC Suppliers Ltd — stock delivery"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYABLE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (KES)</Label>
              <Input
                id="pay-amount"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pay-due">Due date</Label>
              <Input
                id="pay-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">Reference (optional)</Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Invoice/PO number…"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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
