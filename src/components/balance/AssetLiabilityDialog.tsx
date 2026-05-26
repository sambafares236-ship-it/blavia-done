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
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";

export type Mode = "asset" | "liability";

const ASSET_CATEGORIES = [
  "Cash",
  "Bank",
  "Receivable",
  "Inventory",
  "Equipment",
  "Vehicle",
  "Property",
  "Investment",
  "Other",
];
const LIAB_CATEGORIES = [
  "Loan",
  "Payable",
  "Tax",
  "Credit Card",
  "Mortgage",
  "Other",
];

interface Props {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: {
    id?: string;
    name?: string;
    category?: string;
    value?: number;
    date?: string | null;
    notes?: string | null;
  };
  onSaved: () => void;
}

export const AssetLiabilityDialog = ({
  mode,
  open,
  onOpenChange,
  initial,
  onSaved,
}: Props) => {
  const isAsset = mode === "asset";
  const cats = isAsset ? ASSET_CATEGORIES : LIAB_CATEGORIES;
  const dateLabel = isAsset ? "Acquired on" : "Due on";
  const dateField = isAsset ? "acquired_on" : "due_on";
  const table = isAsset ? "assets" : "liabilities";

  const [name, setName] = useState("");
  const [category, setCategory] = useState(cats[0]);
  const [value, setValue] = useState("0");
  const [dateVal, setDateVal] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCategory(initial?.category ?? cats[0]);
      setValue(String(initial?.value ?? 0));
      setDateVal(initial?.date ?? "");
      setNotes(initial?.notes ?? "");
    }
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      category,
      value: Number(value) || 0,
      [dateField]: dateVal || null,
      notes: notes.trim() || null,
    };

    const { error } = initial?.id
      ? await supabase.from(table).update(payload).eq("id", initial.id)
      : await supabase.from(table).insert(payload);

    setSaving(false);
    if (error) {
      toast({
        title: `Couldn't save ${mode}`,
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({
      title: `${isAsset ? "Asset" : "Liability"} ${initial?.id ? "updated" : "added"}`,
    });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Edit" : "Add"} {isAsset ? "Asset" : "Liability"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="al-name">Name</Label>
            <Input
              id="al-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAsset ? "e.g. Toyota Hilux" : "e.g. KCB Term Loan"}
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
                  {cats.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="al-value">
                {isAsset ? "Value (KES)" : "Outstanding (KES)"}
              </Label>
              <Input
                id="al-value"
                type="number"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-date">{dateLabel}</Label>
            <Input
              id="al-date"
              type="date"
              value={dateVal}
              onChange={(e) => setDateVal(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="al-notes">Notes</Label>
            <Textarea
              id="al-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
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
