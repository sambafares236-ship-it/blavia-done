import { useEffect, useState, useRef } from "react";
import {
  Save, Shield, CheckCircle, AlertCircle, Loader2,
  RefreshCw, Upload, ImageIcon, Smartphone, Mail,
  MessageCircle, Building2, MapPin, DollarSign, Lock, X
} from "lucide-react";
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
import type { EtimsMode } from "@/lib/kraTax";
import { useNavigate } from "react-router-dom";

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Murang'a",
  "Nairobi","Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri",
  "Samburu","Siaya","Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia",
  "Turkana","Uasin Gishu","Vihiga","Wajir","West Pokot"
];

interface EtimsConfig {
  id?: string;
  kra_pin: string;
  branch_id: string;
  device_serial: string;
  environment: "sandbox" | "production";
  mode: EtimsMode;
  status: "pending" | "active" | "error";
  is_active: boolean;
  cmc_key?: string;
  last_initialized_at?: string;
  error_message?: string;
}

const EtimsStatusBadge = ({ status }: { status: string }) => {
  if (status === "active") return (
    <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
      <CheckCircle className="h-3 w-3" />eTIMS Active
    </Badge>
  );
  if (status === "error") return (
    <Badge className="gap-1 bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
      <AlertCircle className="h-3 w-3" />eTIMS Error
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200">
      <AlertCircle className="h-3 w-3" />Setup Required
    </Badge>
  );
};

const SectionHeader = ({ icon: Icon, title, description }: {
  icon: any; title: string; description?: string
}) => (
  <div className="flex items-start gap-3 mb-5">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
      <Icon className="h-4 w-4 text-primary" />
    </div>
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  </div>
);

const Settings = () => {
  const { user, profile, business, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Business Profile ──────────────────────────────────────────────────────
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ── Contact & Notifications ───────────────────────────────────────────────
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // ── Email change modal ────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailChanging, setEmailChanging] = useState(false);

  // ── Financial Settings ────────────────────────────────────────────────────
  const [annualTurnover, setAnnualTurnover] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [currency, setCurrency] = useState("KES");
  const [alertThreshold, setAlertThreshold] = useState("");

  // ── eTIMS ─────────────────────────────────────────────────────────────────
  const [etimsConfig, setEtimsConfig] = useState<EtimsConfig | null>(null);
  const [etimsLoading, setEtimsLoading] = useState(false);
  const [etimsInitializing, setEtimsInitializing] = useState(false);
  const [etimsSaving, setEtimsSaving] = useState(false);
  const [kraPin, setKraPin] = useState("");
  const [branchId, setBranchId] = useState("00");
  const [etimsMode, setEtimsMode] = useState<EtimsMode>("none");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");

  // ── M-Pesa ────────────────────────────────────────────────────────────────
  const [hasMpesa, setHasMpesa] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!business) return;
    setBusinessName(business.business_name ?? "");
    setCategory(business.business_category ?? "");
    setStreetAddress((business as any).street_address ?? "");
    setCity((business as any).city ?? "");
    setCounty((business as any).county ?? "");
    setPostalCode((business as any).postal_code ?? "");
    setLogoUrl(business.logo_url ?? null);
    setWhatsappNumber(business.whatsapp_number ?? "");
    setAnnualTurnover(business.annual_turnover != null ? String(business.annual_turnover) : "");
    setVatRegistered(Boolean(business.vat_registered));
    setCurrency(business.currency ?? "KES");
    setAlertThreshold(business.alert_threshold != null ? String(business.alert_threshold) : "");
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
      // environment and status are plain text columns in the database, so
      // narrow them here rather than trusting whatever is stored.
      setEtimsConfig({
        ...data,
        branch_id: data.branch_id ?? "00",
        device_serial: data.device_serial ?? "",
        cmc_key: data.cmc_key ?? undefined,
        last_initialized_at: data.last_initialized_at ?? undefined,
        error_message: data.error_message ?? undefined,
        is_active: data.is_active ?? false,
        environment: data.environment === "production" ? "production" : "sandbox",
        mode: (["oscu", "lite"] as const).find((m) => m === data.mode) ?? "none",
        status:
          data.status === "active" || data.status === "error" ? data.status : "pending",
      });
      setKraPin(data.kra_pin || "");
      setBranchId(data.branch_id || "00");
      setEtimsMode((["oscu", "lite"] as const).find((m) => m === data.mode) ?? "none");
      setDeviceSerial(data.device_serial || "");
      setEnvironment(data.environment === "production" ? "production" : "sandbox");
    }
    setEtimsLoading(false);
  };

  // ── Logo Upload ───────────────────────────────────────────────────────────
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be less than 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setLogoUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${business.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("business-logos")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from("business-logos")
        .getPublicUrl(filePath);
      await supabase.from("businesses").update({ logo_url: publicUrl }).eq("id", business.id);
      setLogoUrl(publicUrl);
      toast({ title: "Logo uploaded!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!business?.id) return;
    await supabase.from("businesses").update({ logo_url: null }).eq("id", business.id);
    setLogoUrl(null);
    setLogoPreview(null);
    toast({ title: "Logo removed" });
  };

  // ── Email Change ──────────────────────────────────────────────────────────
  const handleEmailChange = async () => {
    if (!newEmail.trim() || !emailPassword.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setEmailChanging(true);
    try {
      // Verify current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: emailPassword,
      });
      if (signInError) {
        toast({ title: "Incorrect password", description: "Please check your password and try again.", variant: "destructive" });
        return;
      }
      // Update email
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateError) {
        toast({ title: "Failed to update email", description: updateError.message, variant: "destructive" });
        return;
      }
      setShowEmailModal(false);
      setNewEmail("");
      setEmailPassword("");
      toast({
        title: "Confirmation email sent",
        description: `Check ${newEmail} for a confirmation link. Your email will update once confirmed.`,
      });
    } finally {
      setEmailChanging(false);
    }
  };

  // ── Save business + profile ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!business?.id) return;
    setSaving(true);
    try {
      const { error: bizError } = await supabase
        .from("businesses")
        .update({
          business_name: businessName.trim(),
          business_category: category || null,
          street_address: streetAddress.trim() || null,
          city: city.trim() || null,
          county: county || null,
          postal_code: postalCode.trim() || null,
          whatsapp_number: whatsappNumber.trim() || null,
          annual_turnover: annualTurnover ? Number(annualTurnover) : null,
          vat_registered: vatRegistered,
          currency: currency || "KES",
          alert_threshold: alertThreshold ? Number(alertThreshold) : null,
        })
        .eq("id", business.id);

      if (bizError) throw bizError;

      if (profile?.id) {
        await supabase.from("profiles").update({
          full_name: profile.full_name,
          phone: whatsappNumber.trim() || null,
        }).eq("id", profile.id);
      }

      await refreshProfile();
      toast({ title: "Settings saved!" });
    } catch (err: any) {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Save eTIMS ────────────────────────────────────────────────────────────
  const handleSaveEtims = async () => {
    if (!business?.id) return;
    if (!kraPin) {
      toast({ title: "KRA PIN required", variant: "destructive" });
      return;
    }
    // Only the integrated route needs a device serial — eTIMS Lite users issue
    // on KRA's own channels and just record the result here.
    if (etimsMode === "oscu" && !deviceSerial) {
      toast({
        title: "Device serial required",
        description: "Register an OSCU on etims.kra.go.ke to get one, or choose eTIMS Lite.",
        variant: "destructive",
      });
      return;
    }
    setEtimsSaving(true);
    const payload = {
      business_id: business.id,
      kra_pin: kraPin.toUpperCase().trim(),
      branch_id: branchId.trim() || "00",
      device_serial: deviceSerial.trim() || null,
      environment,
      mode: etimsMode,
      status: (etimsConfig?.status || "pending") as "pending" | "active" | "error",
      is_active: true,
    };
    const { error } = etimsConfig?.id
      ? await supabase.from("etims_configs").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", etimsConfig.id)
      : await supabase.from("etims_configs").insert(payload);
    if (error) {
      toast({ title: "Failed to save eTIMS credentials", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "eTIMS credentials saved", description: "Now click Initialize to connect to KRA." });
      fetchEtimsConfig();
    }
    setEtimsSaving(false);
  };

  // ── Initialize eTIMS ──────────────────────────────────────────────────────
  const handleInitialize = async () => {
    if (!business?.id || !etimsConfig?.id) return;
    setEtimsInitializing(true);
    try {
      // etims-auth verifies the caller's session maps to this business before
      // touching KRA, so the anon key is no longer sufficient here.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/etims-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ business_id: business.id }),
        }
      );
      const result = await res.json();
      if (!res.ok || result.error) {
        toast({ title: "KRA Initialization Failed", description: result.error || "Unknown error from KRA", variant: "destructive" });
      } else if (result.already_initialized) {
        toast({ title: "Already initialized", description: "Your eTIMS device is already active with KRA." });
      } else {
        toast({ title: "eTIMS Initialized ✓", description: "Successfully connected to KRA." });
      }
      fetchEtimsConfig();
    } catch (err: any) {
      toast({ title: "Network error", description: err.message, variant: "destructive" });
    } finally {
      setEtimsInitializing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your business profile, notifications, and integrations.</p>
        </div>

        {/* ── 1. Business Profile ─────────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <SectionHeader
            icon={Building2}
            title="Business Profile"
            description="Your business details appear on invoices and reports."
          />

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="biz">Business name</Label>
                <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Kamau Enterprises Ltd" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
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
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />Business Address
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="street">Street Address</Label>
                  <Input id="street" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="123 Moi Avenue" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Nairobi" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="county">County</Label>
                  <Select value={county} onValueChange={setCounty}>
                    <SelectTrigger id="county"><SelectValue placeholder="Select county" /></SelectTrigger>
                    <SelectContent>
                      {KENYA_COUNTIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="postal">Postal Code</Label>
                  <Input id="postal" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="00100" />
                </div>
              </div>
            </div>

            {/* Logo */}
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Business Logo</p>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                  {logoPreview || logoUrl ? (
                    <img src={logoPreview || logoUrl!} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={logoUploading} className="gap-2">
                    {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {logoUploading ? "Uploading…" : "Upload Logo"}
                  </Button>
                  {(logoUrl || logoPreview) && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── 2. Contact & Notifications ──────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <SectionHeader
            icon={Mail}
            title="Contact & Notifications"
            description="How Blavia reaches you with reports and alerts."
          />

          <div className="space-y-4">
            {/* Email — read only until changed */}
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <div className="flex items-center gap-2">
                <Input value={user?.email ?? ""} disabled className="bg-muted/40" />
                <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)} className="shrink-0 gap-1.5">
                  <Lock className="h-3.5 w-3.5" />Change
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Your login email. Changing it requires password verification.</p>
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                WhatsApp number
              </Label>
              <Input
                id="whatsapp"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+254700000000"
              />
              <p className="text-xs text-muted-foreground">Receives daily cash reports, P&L summaries, and KRA reminders via WhatsApp.</p>
            </div>
          </div>
        </Card>

        {/* ── 3. Financial Settings ───────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <SectionHeader
            icon={DollarSign}
            title="Financial Settings"
            description="Used for tax calculations, reporting thresholds, and VAT compliance."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KES">KES — Kenyan Shilling</SelectItem>
                  <SelectItem value="USD">USD — US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="GBP">GBP — British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">Cash alert threshold (KES)</Label>
              <Input
                id="threshold"
                type="number"
                inputMode="numeric"
                min="0"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="e.g. 50000"
              />
              <p className="text-xs text-muted-foreground">Get alerted when cash drops below this amount.</p>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="vat" checked={vatRegistered} onCheckedChange={(v) => setVatRegistered(Boolean(v))} />
              <div>
                <Label htmlFor="vat" className="cursor-pointer">VAT Registered</Label>
                <p className="text-xs text-muted-foreground">Enables eTIMS integration and VAT calculations.</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── 4. M-Pesa ───────────────────────────────────────────────────── */}
        <Card className="border border-border/60 p-6 shadow-card">
          <SectionHeader
            icon={Smartphone}
            title="M-Pesa Integration"
            description="Connect your Safaricom Daraja API to accept payments and disburse payroll."
          />
          <div className="flex items-center justify-between">
            {hasMpesa ? (
              <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
                <CheckCircle className="h-3 w-3" />Connected
              </Badge>
            ) : (
              <Badge className="gap-1 bg-yellow-100 text-yellow-700 border-yellow-200">
                <AlertCircle className="h-3 w-3" />Not configured
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/mpesa-settings")} className="gap-2">
              <Smartphone className="h-4 w-4" />
              {hasMpesa ? "Manage M-Pesa" : "Set up M-Pesa"}
            </Button>
          </div>
        </Card>

        {/* ── 5. eTIMS (only if VAT registered) ──────────────────────────── */}
        {vatRegistered && (
          <Card className="border border-border/60 p-6 shadow-card">
            <div className="flex items-start justify-between mb-5">
              <SectionHeader
                icon={Shield}
                title="eTIMS / KRA Compliance"
                description="Required for every business, whether or not you are VAT registered."
              />
              {etimsConfig && !etimsLoading && (
                <EtimsStatusBadge status={etimsConfig.status || "pending"} />
              )}
            </div>
            <p className="text-xs text-muted-foreground -mt-4 mb-4 ml-12">
              Onboard on{" "}
              <a href="https://etims.kra.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                etims.kra.go.ke
              </a>{" "}
              first — KRA issues the device serial there.
            </p>

            {etimsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Loading eTIMS configuration…
              </div>
            ) : (
              <div className="space-y-4">
                {etimsConfig?.error_message && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <strong>KRA Error:</strong> {etimsConfig.error_message}
                  </div>
                )}
                {etimsConfig?.status === "active" && etimsConfig?.last_initialized_at && (
                  <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    <strong>Connected to KRA</strong> — Initialized on{" "}
                    {new Date(etimsConfig.last_initialized_at).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}.
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="etims_mode">How do you issue eTIMS invoices?</Label>
                  <Select value={etimsMode} onValueChange={(v) => setEtimsMode(v as EtimsMode)}>
                    <SelectTrigger id="etims_mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set up yet</SelectItem>
                      <SelectItem value="oscu">Integrated — Blavia submits to KRA</SelectItem>
                      <SelectItem value="lite">eTIMS Lite — I issue on KRA, record here</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {etimsMode === "oscu"
                      ? "Needs an OSCU device serial from KRA. Invoices are sent automatically and the CUIN comes back here."
                      : etimsMode === "lite"
                        ? "Issue each invoice on the KRA portal or *222#, then record its CUIN against the invoice in Blavia."
                        : "Choose a route to start reporting invoices to KRA."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="kra_pin">KRA PIN</Label>
                    <Input id="kra_pin" value={kraPin} onChange={(e) => setKraPin(e.target.value.toUpperCase())} placeholder="P000000000A" className="font-mono uppercase" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="branch_id">Branch ID</Label>
                    <Input id="branch_id" value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="00" className="font-mono" />
                    <p className="text-xs text-muted-foreground">Use 00 for main branch</p>
                  </div>
                  {etimsMode === "oscu" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="device_serial">Device Serial Number</Label>
                      <Input id="device_serial" value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} placeholder="From KRA after OSCU registration" className="font-mono" />
                      <p className="text-xs text-muted-foreground">Issued by KRA once you register an OSCU</p>
                    </div>
                  )}
                  <div className="space-y-1.5">
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
                  {etimsMode === "oscu" && (
                    <Button onClick={handleInitialize} disabled={etimsInitializing || !etimsConfig?.id} size="sm" className="gap-2">
                      {etimsInitializing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {etimsInitializing ? "Connecting to KRA…" : etimsConfig?.status === "active" ? "Re-initialize" : "Initialize with KRA"}
                    </Button>
                  )}
                </div>
                {etimsMode === "oscu" && !etimsConfig?.id && (
                  <p className="text-xs text-muted-foreground">Save your details first, then click Initialize.</p>
                )}
                {etimsMode === "lite" && (
                  <p className="text-xs text-muted-foreground">
                    No initialization needed. Open any invoice and use “Record eTIMS details” after issuing it on KRA.
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Save button */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* ── Email Change Modal ─────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Change Email Address</h3>
              <button onClick={() => { setShowEmailModal(false); setNewEmail(""); setEmailPassword(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Enter your current password and new email address. We'll send a confirmation link to your new email.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Your current password"
                />
              </div>
              <div className="space-y-1.5">
                <Label>New email address</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => { setShowEmailModal(false); setNewEmail(""); setEmailPassword(""); }}>
                Cancel
              </Button>
              <Button onClick={handleEmailChange} disabled={emailChanging} className="gap-2">
                {emailChanging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {emailChanging ? "Verifying…" : "Send confirmation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Settings;