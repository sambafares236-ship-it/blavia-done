import { useEffect, useState, useRef } from "react";
import { Save, Shield, CheckCircle, AlertCircle, Loader2, RefreshCw, Upload, ImageIcon, Smartphone } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "@/components/ui/use-toast";
import { BUSINESS_CATEGORIES } from "@/lib/taxRules";
import { useNavigate } from "react-router-dom";

interface EtimsConfig {
  id?: string;
  kra_pin: string;
  client_id: string;
  client_secret: string;
  branch_id: string;
  device_serial: string;
  environment: "sandbox" | "production";
  status: "pending" | "active" | "error";
  is_active: boolean;
  cmc_key?: string;
  last_initialized_at?: string;
  error_message?: string;
}

const EtimsStatusBadge = ({ status }: { status: string }) => {
  if (status === "active") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
        <CheckCircle className="h-3 w-3" />eTIMS Active
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
        <AlertCircle className="h-3 w-3" />eTIMS Error
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
      <AlertCircle className="h-3 w-3" />Setup Required
    </Badge>
  );
};

const Settings = () => {
  const { user, profile, business, refreshProfile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Business / profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("");
  const [annualTurnover, setAnnualTurnover] = useState<string>("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [saving, setSaving] = useState(false);

  // Logo states
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // M-Pesa state
  const [hasMpesa, setHasMpesa] = useState(false);

  // eTIMS fields
  const [etimsConfig, setEtimsConfig] = useState<EtimsConfig | null>(null);
  const [etimsLoading, setEtimsLoading] = useState(false);
  const [etimsInitializing, setEtimsInitializing] = useState(false);
  const [etimsSaving, setEtimsSaving] = useState(false);
  const [kraPin, setKraPin] = useState("");
  const [etimsUsername, setEtimsUsername] = useState("");
  const [etimsPassword, setEtimsPassword] = useState("");
  const [branchId, setBranchId] = useState("00");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setBusinessName(business?.business_name ?? profile?.company_name ?? "");
  }, [profile, business]);

  useEffect(() => {
    setCategory(business?.business_category ?? "");
    setAnnualTurnover(business?.annual_turnover != null ? String(business.annual_turnover) : "");
    setVatRegistered(Boolean(business?.vat_registered));
    setLogoUrl(business?.logo_url ?? null);
  }, [business]);

  useEffect(() => {
    if (!business?.id) return;
    fetchEtimsConfig();
    checkMpesa();
  }, [business?.id]);

  const checkMpesa = async () => {
    if (!business?.id) return;
    const { data } = await supabase
      .from("mpesa_configs")
      .select("id")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .single();
    setHasMpesa(!!data);
  };

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

  // ── Logo Upload ──────────────────────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business?.id) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be less than 2MB", variant: "destructive" });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLogoUploading(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${business.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-logos")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("business-logos")
        .getPublicUrl(filePath);

      // Save URL to businesses table
      const { error: updateError } = await supabase
        .from("businesses")
        .update({ logo_url: publicUrl })
        .eq("id", business.id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      toast({ title: "Logo uploaded successfully!" });
      refreshProfile();

    } catch (err: any) {
      toast({ title: "Logo upload failed", description: err.message, variant: "destructive" });
      setLogoPreview(null);
    }

    setLogoUploading(false);
  };

  const handleRemoveLogo = async () => {
    if (!business?.id) return;
    const { error } = await supabase
      .from("businesses")
      .update({ logo_url: null })
      .eq("id", business.id);

    if (!error) {
      setLogoUrl(null);
      setLogoPreview(null);
      toast({ title: "Logo removed" });
      refreshProfile();
    }
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
      toast({ title: "Couldn't save", description: pErr?.message || bErr?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved" });
    refreshProfile();
  };

  // ── Save eTIMS credentials ───────────────────────────────────────────────
  const handleSaveEtims = async () => {
    if (!business?.id) return;
    if (!kraPin || !etimsUsername || !etimsPassword || !deviceSerial) {
      toast({ title: "Missing fields", description: "Please fill in all eTIMS fields.", variant: "destructive" });
      return;
    }

    setEtimsSaving(true);
    const payload = {
      business_id: business.id,
      kra_pin: kraPin.toUpperCase().trim(),
      client_id: etimsUsername.trim(),
      client_secret: etimsPassword.trim(),
      branch_id: branchId.trim() || "00",
      device_serial: deviceSerial.trim(),
      environment,
      status: "pending",
      is_active: false,
    };

    const { error } = etimsConfig?.id
      ? await supabase.from("etims_configs").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", etimsConfig.id)
      : await supabase.from("etims_configs").insert(payload);

    setEtimsSaving(false);

    if (error) {
      toast({ title: "Failed to save eTIMS credentials", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "eTIMS credentials saved", description: "Now click Initialize to connect to KRA." });
    fetchEtimsConfig();
  };

  // ── Initialize OSCU with KRA ─────────────────────────────────────────────
  const handleInitialize = async () => {
    if (!business?.id) return;
    setEtimsInitializing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/etims-auth`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ business_id: business.id }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "KRA Initialization Failed", description: result.error || "Unknown error from KRA", variant: "destructive" });
        fetchEtimsConfig();
        return;
      }
      if (result.already_initialized) {
        toast({ title: "Already initialized", description: "Your eTIMS device is already active with KRA." });
      } else {
        toast({ title: "eTIMS Initialized ✓", description: "Successfully connected to KRA." });
      }
      fetchEtimsConfig();
    } catch (err: any) {
      toast({ title: "Initialization error", description: err.message, variant: "destructive" });
    } finally {
      setEtimsInitializing(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update your profile and business details.
            {profileLoading && " · loading…"}
          </p>
        </header>

        {/* ── Business Logo ─────────────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <h2 className="text-base font-semibold">Business Logo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your logo appears on invoices, emails and the payment page.
          </p>
          <div className="mt-4 flex items-center gap-5">
            {/* Logo preview */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 overflow-hidden">
              {(logoPreview || logoUrl) ? (
                <img
                  src={logoPreview || logoUrl!}
                  alt="Business logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>

            {/* Upload controls */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                className="gap-2"
              >
                {logoUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4" />Upload Logo</>
                )}
              </Button>
              {(logoUrl || logoPreview) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-red-500 hover:text-red-600 block"
                >
                  Remove logo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
            </div>
          </div>
        </Card>

        {/* ── M-Pesa ───────────────────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-green-600" />
              <h2 className="text-base font-semibold">M-Pesa Integration</h2>
            </div>
            {hasMpesa ? (
              <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3" />Connected
              </Badge>
            ) : (
              <Badge className="gap-1 bg-yellow-100 text-yellow-700 border-yellow-200">
                <AlertCircle className="h-3 w-3" />Not configured
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect your Safaricom Daraja API to accept payments and disburse payroll.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/mpesa-settings")}
            className="mt-4 gap-2"
          >
            <Smartphone className="h-4 w-4" />
            {hasMpesa ? "Manage M-Pesa Settings" : "Set up M-Pesa"}
          </Button>
        </Card>

        {/* ── Business card ─────────────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <h2 className="text-base font-semibold">Business</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This information powers your tax obligations and reporting.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="biz">Business name</Label>
              <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="My Business" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat">Business category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="turnover">Annual turnover (KES)</Label>
              <Input id="turnover" type="number" inputMode="numeric" min="0" value={annualTurnover} onChange={(e) => setAnnualTurnover(e.target.value)} placeholder="e.g. 4500000" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="vat" checked={vatRegistered} onCheckedChange={(v) => setVatRegistered(Boolean(v))} />
              <Label htmlFor="vat" className="cursor-pointer">VAT Registered</Label>
            </div>
          </div>
        </Card>

        {/* ── eTIMS card ────────────────────────────────────────────────── */}
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
              <a href="https://etims.kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                etims.kra.go.ke
              </a>{" "}
              first to get your credentials.
            </p>

            {etimsLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Loading eTIMS configuration…
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {etimsConfig?.error_message && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <strong>KRA Error:</strong> {etimsConfig.error_message}
                  </div>
                )}
                {etimsConfig?.status === "active" && etimsConfig?.last_initialized_at && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <strong>Connected to KRA</strong> — Initialized on{" "}
                    {new Date(etimsConfig.last_initialized_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}.
                    All invoices are automatically submitted to KRA.
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kra_pin">KRA PIN</Label>
                    <Input id="kra_pin" value={kraPin} onChange={(e) => setKraPin(e.target.value.toUpperCase())} placeholder="P000000000A" className="font-mono uppercase" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch_id">Branch ID</Label>
                    <Input id="branch_id" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="00" className="font-mono" />
                    <p className="text-xs text-muted-foreground">Use 00 for main branch</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device_serial">Device Serial Number</Label>
                    <Input id="device_serial" value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} placeholder="From KRA after OSCU registration" className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="etims_username">eTIMS Username</Label>
                    <Input id="etims_username" value={etimsUsername} onChange={(e) => setEtimsUsername(e.target.value)} placeholder="Your eTIMS portal username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="etims_password">eTIMS Password</Label>
                    <Input id="etims_password" type="password" value={etimsPassword} onChange={(e) => setEtimsPassword(e.target.value)} placeholder="Your eTIMS portal password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                      <SelectTrigger id="environment"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={handleSaveEtims} disabled={etimsSaving} variant="outline" size="sm" className="gap-2">
                    {etimsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {etimsSaving ? "Saving…" : "Save Credentials"}
                  </Button>
                  <Button onClick={handleInitialize} disabled={etimsInitializing || !etimsConfig?.id} size="sm" className="gap-2">
                    {etimsInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {etimsInitializing ? "Connecting to KRA…" : etimsConfig?.status === "active" ? "Re-initialize" : "Initialize with KRA"}
                  </Button>
                </div>
                {!etimsConfig?.id && (
                  <p className="text-xs text-muted-foreground">Save your credentials first, then click Initialize to connect to KRA.</p>
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
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254…" />
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