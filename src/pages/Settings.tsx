import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { BUSINESS_CATEGORIES } from "@/lib/taxRules";

const Settings = () => {
  const { user, profile, business, refreshProfile, profileLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [annualTurnover, setAnnualTurnover] = useState<string>("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setBusinessName(business?.business_name ?? profile?.company_name ?? "");
  }, [profile, business]);

  useEffect(() => {
    setCategory(business?.business_category ?? "");
    setAnnualTurnover(
      business?.annual_turnover != null ? String(business.annual_turnover) : "",
    );
    setVatRegistered(Boolean(business?.vat_registered));
  }, [business]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const trimmedName = businessName.trim() || "My Business";

    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        company_name: trimmedName,
      })
      .eq("id", user.id);

    let bErr: { message: string } | null = null;
    if (business?.id) {
      const turnoverNum = annualTurnover.trim() === "" ? null : Number(annualTurnover);
      const { error } = await supabase
        .from("businesses")
        .update({
          business_name: trimmedName,
          business_category: category || null,
          annual_turnover: Number.isFinite(turnoverNum as number) ? turnoverNum : null,
          vat_registered: vatRegistered,
        })
        .eq("id", business.id);
      bErr = error;
    }

    setSaving(false);

    if (pErr || bErr) {
      toast({
        title: "Couldn't save",
        description: pErr?.message || bErr?.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Settings saved" });
    refreshProfile();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your profile and business details.
            {profileLoading && " · loading…"}
          </p>
        </header>

        <Card className="border border-border/60 p-6 shadow-card">
          <h2 className="text-base font-semibold">Business</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This information powers your tax obligations and reporting.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="biz">Business name</Label>
              <Input
                id="biz"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="My Business"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat">Business category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turnover">Annual turnover (KES)</Label>
              <Input
                id="turnover"
                type="number"
                inputMode="numeric"
                min="0"
                value={annualTurnover}
                onChange={(e) => setAnnualTurnover(e.target.value)}
                placeholder="e.g. 4500000"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="vat"
                checked={vatRegistered}
                onCheckedChange={(v) => setVatRegistered(Boolean(v))}
              />
              <Label htmlFor="vat" className="cursor-pointer">
                VAT Registered
              </Label>
            </div>
          </div>
        </Card>

        <Card className="border border-border/60 p-6 shadow-card">
          <h2 className="text-base font-semibold">Profile</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+254…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default Settings;