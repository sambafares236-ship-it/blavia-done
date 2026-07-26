import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const FREQUENCIES = [
  { v: "one_off", label: "One-off" },
  { v: "weekly", label: "Weekly" },
  { v: "monthly", label: "Monthly" },
  { v: "quarterly", label: "Quarterly" },
  { v: "yearly", label: "Yearly" },
];

const METHODS = ["M-Pesa", "Bank", "Cash", "Card"];
const CATEGORIES = [
  "Rent", "Salaries", "Electricity", "Internet & Telephone",
  "Marketing", "Professional Fees", "Loan Repayment",
  "Subscriptions", "Inventory / Purchases", "Other",
];

export interface ScheduleInitial {
  id?: string;
  vendor?: string;
  category?: string;
  amount?: number;
  frequency?: string;
  next_due?: string;
  payment_method?: string | null;
  account_ref?: string | null;
  auto_post?: boolean;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ScheduleInitial;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const ScheduleDialog = ({ open, onOpenChange, initial, onSaved }: Props) => {
  const { profile } = useAuth();
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("0");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDue, setNextDue] = useState(today());
  const [method, setMethod] = useState<string>("M-Pesa");
  const [accountRef, setAccountRef] = useState("");
  const [autoPost, setAutoPost] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVendor(initial?.vendor ?? "");
    setCategory(initial?.category ?? CATEGORIES[0]);
    setAmount(String(initial?.amount ?? 0));
    setFrequency(initial?.frequency ?? "monthly");
    setNextDue(initial?.next_due ?? today());
    setMethod(initial?.payment_method ?? "M-Pesa");
    setAccountRef(initial?.account_ref ?? "");
    setAutoPost(initial?.auto_post ?? false);
    setNotes(initial?.notes ?? "");
  }, [open, initial]);

  const handleSave = async () => {
    if (!vendor.trim()) {
      toast({ title: "Vendor / payee is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      vendor: vendor.trim(),
      category,
      amount: Number(amount) || 0,
      frequency,
      next_due: nextDue,
      payment_method: method,
      account_ref: accountRef.trim() || null,
      auto_post: autoPost,
      notes: notes.trim() || null,
    };
    // business_id is NOT NULL and gated by the tenant RLS policy, so a new
    // row has to carry it explicitly. Updates leave it as-is.
    let error;
    if (initial?.id) {
      ({ error } = await supabase
        .from("scheduled_expenses")
        .update(payload)
        .eq("id", initial.id));
    } else {
      if (!profile?.business_id) {
        setSaving(false);
        toast({ title: "No business selected", variant: "destructive" });
        return;
      }
      ({ error } = await supabase
        .from("scheduled_expenses")
        .insert({ ...payload, business_id: profile.business_id }));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Scheduled expense ${initial?.id ? "updated" : "added"}` });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {initial?.id ? "Edit" : "New"} scheduled expense
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="vendor">Vendor / Payee</Label>
                <Input id="vendor" value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Kenya Power" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amt">Amount (KES)</Label>
                <Input id="amt" type="number" inputMode="decimal"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due">Next due</Label>
                <Input id="due" type="date" value={nextDue}
                  onChange={(e) => setNextDue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="ref">Account reference</Label>
                <Input id="ref" value={accountRef}
                  onChange={(e) => setAccountRef(e.target.value)}
                  placeholder="Paybill / Till / Account no." />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes}
                  onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Auto-post when due</p>
                  <p className="text-xs text-muted-foreground">
                    Reserved for future payment-provider integration.
                  </p>
                </div>
                <Switch checked={autoPost} onCheckedChange={setAutoPost} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};