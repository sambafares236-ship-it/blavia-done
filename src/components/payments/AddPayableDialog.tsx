import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
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

const RECEIPT_BUCKET = "payable-receipts";
const MAX_RECEIPT_BYTES = 8 * 1024 * 1024; // phone-camera photo of a document, not a small logo

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

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setPayee("");
      setCategory(PAYABLE_CATEGORIES[0]);
      setAmount("0");
      setDueDate("");
      setReference("");
      setReceiptPath(null);
      setReceiptPreview(null);
    }
  }, [open]);

  const handleReceiptSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast({ title: "Image must be less than 8MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setReceiptUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${businessId}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      setReceiptPath(filePath);
    } catch (err: any) {
      toast({ title: "Receipt upload failed", description: err.message, variant: "destructive" });
      setReceiptPreview(null);
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptPath(null);
    setReceiptPreview(null);
  };

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
      receipt_path: receiptPath,
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
          <div className="space-y-2">
            <Label>Invoice photo (optional)</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden shrink-0">
                {receiptPreview ? (
                  <img src={receiptPreview} alt="Invoice" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleReceiptSelect}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => receiptInputRef.current?.click()}
                  disabled={receiptUploading}
                  className="gap-2"
                >
                  {receiptUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {receiptUploading ? "Uploading…" : receiptPreview ? "Replace photo" : "Attach photo"}
                </Button>
                {receiptPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveReceipt}
                    className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || receiptUploading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
