import { useEffect, useState } from "react";
import { Save, Shield, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

// ─── eTIMS config type ────────────────────────────────────────────────────────
interface EtimsConfig {
  id?: string;
  kra_pin: string;
  client_id: string;       // used as eTIMS username
  client_secret: string;   // used as eTIMS password
  branch_id: string;
  device_serial: string;
  environment: "sandbox" | "production";
  status: "pending" | "active" | "error";
  is_active: boolean;
  cmc_key?: string;
  last_initialized_at?: string;
  error_message?: string;
}

// ─── eTIMS status badge ───────────────────────────────────────────────────────
const EtimsStatusBadge = ({ status }: { status: string }) => {
  if (status === "active") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle className="h-3 w-3" />
        eTIMS Active
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
        <AlertCircle className="h-3 w-3" />
        eTIMS Error
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
      <AlertCircle className="h-3 w-3" />
      Setup Required
    </Badge>
  );
};

// ─── Main Settings page ───────────────────────────────────────────────────────
const Settings = () => {
  const { user, profile, business, refreshProfile, profileLoading } = useAuth();

  // Business / profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [annualTurnover, setAnnualTurnover] = useState<string>("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [saving, setSaving] = useState(false);

  // eTIMS fields
  const [etimsConfig, setEtimsConfig] = useState<EtimsConfig | null>(null);
  const [etimsLoading, setEtimsLoading] = useState(false);
  const [etimsInitializing, setEtimsInitializing] = useState(false);
  const [etimsSaving, setEtimsSaving] = useState(false);
  const [kraPin, setKraPin] = useState("");
  const [etimsUsername, setEtimsUsername] = useState("");  // stored as client_id
  const [etimsPassword, setEtimsPassword] = useState("");  // stored as client_secret
  const [branchId, setBranchId] = useState("00");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");

  // ── Load business / profile ──────────────────────────────────────────────
  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setBusinessName(business?.business_name ?? profile?.company_name ?? "");
  }, [profile, business]);

  useEffect(() => {
    setCategory(business?.business_category ?? "");
    setAnnualTurnover(
      business?.annual_turnover != null ? String(business.annual_turnover) : ""
    );
    setVatRegistered(Boolean(business?.vat_registered));
  }, [business]);

  // ── Load eTIMS config ────────────────────────────────────────────────────
  useEffect(() => {
    if (!business?.id) return;
    fetchEtimsConfig();
  }, [business?.id]);

  const fetchEtimsConfig = async () => {
    if (!business?.id) return;
    setEtimsLoading(true);
    const { data } = await supabase
      .from("etims_configs")
      .select("*")
      .eq("business_id", business.id)
      .maybeSingle();

    if (data) {
      setEtimsConfig(data);
      setKraPin(data.kra_pin || "");
      setEtimsUsername(data.client_id || "");
      setEtimsPassword(data.client_secret || "");
      setBranchId(data.branch_id || "00");
      setDeviceSerial(data.device_serial || "");
      setEnvironment(data.environment || "sandbox");
    }
    setEtimsLoading(false);
  };

  // ── Save business + profile ──────────────────────────────────────────────
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

  // ── Save eTIMS credentials (upsert) ─────────────────────────────────────
  const handleSaveEtims = async () => {
    if (!business?.id) return;
    if (!kraPin || !etimsUsername || !etimsPassword || !deviceSerial) {
      toast({
        title: "Missing fields",
        description: "Please fill in all eTIMS fields.",
        variant: "destructive",
      });
      return;
    }

    setEtimsSaving(true);
    const payload = {
      business_id: business.id,
      kra_pin: kraPin.toUpperCase().trim(),
      client_id: etimsUsername.trim(),       // eTIMS username
      client_secret: etimsPassword.trim(),   // eTIMS password
      branch_id: branchId.trim() || "00",
      device_serial: deviceSerial.trim(),
      environment,
      status: "pending",
      is_active: false,
    };

    const { error } = etimsConfig?.id
      ? await supabase
          .from("etims_configs")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", etimsConfig.id)
      : await supabase.from("etims_configs").insert(payload);

    setEtimsSaving(false);

    if (error) {
      toast({ title: "Failed to save eTIMS credentials", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "eTIMS credentials saved", description: "Now click Initialize to connect to KRA." });
    fetchEtimsConfig();
  };

  // ── Initialize OSCU device with KRA ─────────────────────────────────────
  const handleInitialize = async () => {
    if (!business?.id) return;
    setEtimsInitializing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/etims-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ business_id: business.id }),
        }
      );

      const result = await res.json();

      if (!res.ok || result.error) {
        toast({
          title: "KRA Initialization Failed",
          description: result.error || "Unknown error from KRA",
          variant: "destructive",
        });
        fetchEtimsConfig();
        return;
      }

      if (result.already_initialized) {
        toast({ title: "Already initialized", description: "Your eTIMS device is already active with KRA." });
      } else {
        toast({
          title: "eTIMS Initialized ✓",
          description: "Successfully connected to KRA. Your invoices will now be eTIMS compliant.",
        });
      }

      fetchEtimsConfig();
    } catch (err: any) {
      toast({ title: "Initialization error", description: err.message, variant: "destructive" });
    } finally {
      setEtimsInitializing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
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

        {/* ── Business card ─────────────────────────────────────────────── */}
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

        {/* ── eTIMS / KRA Compliance card (only for VAT-registered) ──────── */}
        {vatRegistered && (
          <Card className="border border-border/60 p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">eTIMS / KRA Compliance</h2>
              </div>
              {etimsConfig && !etimsLoading && (
                <EtimsStatusBadge status={etimsConfig.status || "pending"} />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect your KRA OSCU device to automatically submit invoices to KRA.
              Register on{" "}
              <a
                href="https://etims.kra.go.ke"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                etims.kra.go.ke
              </a>{" "}
              first to get your credentials.
            </p>

            {etimsLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading eTIMS configuration…
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Error message from KRA */}
                {etimsConfig?.error_message && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <strong>KRA Error:</strong> {etimsConfig.error_message}
                  </div>
                )}

                {/* Active confirmation */}
                {etimsConfig?.status === "active" && etimsConfig?.last_initialized_at && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <strong>Connected to KRA</strong> — Initialized on{" "}
                    {new Date(etimsConfig.last_initialized_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    . All invoices are automatically submitted to KRA.
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kra_pin">KRA PIN</Label>
                    <Input
                      id="kra_pin"
                      value={kraPin}
                      onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                      placeholder="P000000000A"
                      className="font-mono uppercase"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branch_id">Branch ID</Label>
                    <Input
                      id="branch_id"
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      placeholder="00"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Use 00 for main branch</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device_serial">Device Serial Number</Label>
                    <Input
                      id="device_serial"
                      value={deviceSerial}
                      onChange={(e) => setDeviceSerial(e.target.value)}
                      placeholder="From KRA after OSCU registration"
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="etims_username">eTIMS Username</Label>
                    <Input
                      id="etims_username"
                      value={etimsUsername}
                      onChange={(e) => setEtimsUsername(e.target.value)}
                      placeholder="Your eTIMS portal username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="etims_password">eTIMS Password</Label>
                    <Input
                      id="etims_password"
                      type="password"
                      value={etimsPassword}
                      onChange={(e) => setEtimsPassword(e.target.value)}
                      placeholder="Your eTIMS portal password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={environment}
                      onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}
                    >
                      <SelectTrigger id="environment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={handleSaveEtims}
                    disabled={etimsSaving}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {etimsSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {etimsSaving ? "Saving…" : "Save Credentials"}
                  </Button>

                  <Button
                    onClick={handleInitialize}
                    disabled={etimsInitializing || !etimsConfig?.id}
                    size="sm"
                    className="gap-2"
                  >
                    {etimsInitializing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {etimsInitializing
                      ? "Connecting to KRA…"
                      : etimsConfig?.status === "active"
                      ? "Re-initialize"
                      : "Initialize with KRA"}
                  </Button>
                </div>

                {!etimsConfig?.id && (
                  <p className="text-xs text-muted-foreground">
                    Save your credentials first, then click Initialize to connect to KRA.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Profile card ──────────────────────────────────────────────── */}
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