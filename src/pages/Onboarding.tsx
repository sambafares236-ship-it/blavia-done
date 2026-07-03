import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { BUSINESS_CATEGORIES } from "@/lib/taxRules";
import logo from "@/assets/blavia-logo.png";

const BRAND = "#0d1f2d";

// Business profile is intentionally required, not skippable — annual_turnover
// and vat_registered are what Dashboard/Tax Center use to pick a tax regime
// (see src/pages/Tax.tsx). Leaving them null silently defaulted every new
// signup to "exempt", which was wrong more often than not.
const Onboarding = () => {
  const { business, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [currency, setCurrency] = useState("KES");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!business) return;
    // Already completed onboarding (e.g. user navigated back here manually) — move on.
    if (business.annual_turnover !== null) {
      navigate("/dashboard", { replace: true });
      return;
    }
    setBusinessName(business.business_name ?? "");
    setCurrency(business.currency ?? "KES");
  }, [business, navigate]);

  const handleSubmit = async () => {
    if (!business?.id) return;
    if (!businessName.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Please select a business category", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        business_name: businessName.trim(),
        business_category: category,
        annual_turnover: annualTurnover ? Number(annualTurnover) : 0,
        vat_registered: vatRegistered,
        currency,
      })
      .eq("id", business.id);
    setSaving(false);

    if (error) {
      toast({ title: "Couldn't save your business profile", description: error.message, variant: "destructive" });
      return;
    }

    await refreshProfile();
    toast({ title: `Welcome to BLAVIA, ${profile?.full_name?.split(" ")[0] ?? "there"}!` });
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl p-2" style={{ background: BRAND }}>
            <img src={logo} alt="BLAVIA" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: BRAND }}>
            Tell us about your business
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This takes under a minute and lets BLAVIA calculate the right taxes and reports for you from day one.
          </p>
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm" style={{ borderColor: `${BRAND}20` }}>
          <div className="space-y-2">
            <Label htmlFor="ob-name">Business name</Label>
            <Input
              id="ob-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Kamau Enterprises Ltd"
            />
          </div>

          <div className="space-y-2">
            <Label>Business category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ob-turnover">Annual turnover (KES)</Label>
              <Input
                id="ob-turnover"
                type="number"
                inputMode="decimal"
                min={0}
                value={annualTurnover}
                onChange={(e) => setAnnualTurnover(e.target.value)}
                placeholder="0"
              />
              <p className="text-[11px] text-muted-foreground">
                Determines VAT / Turnover Tax / Corporate Tax. Best estimate is fine — you can update this later in Settings.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
            <Checkbox checked={vatRegistered} onCheckedChange={(v) => setVatRegistered(!!v)} />
            <span className="text-sm text-foreground">I'm registered for VAT with KRA</span>
          </label>

          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full gap-2 text-white hover:opacity-90"
            style={{ background: BRAND }}
          >
            {saving ? "Saving…" : "Finish setup"}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          You can change any of this later in Settings.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
