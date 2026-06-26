import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Smartphone, Shield, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

const MpesaSettings = () => {
  const { user } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showPasskey, setShowPasskey] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "failed" | null>(null);

  const [config, setConfig] = useState({
    consumer_key: "",
    consumer_secret: "",
    shortcode: "",
    passkey: "",
    environment: "sandbox",
    account_name: "",
    b2c_shortcode: "",
    b2c_initiator_name: "",
    b2c_security_credential: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Get business
      const { data: biz } = await supabase
        .from("businesses")
        .select("id, business_name")
        .eq("owner_id", user.id)
        .limit(1)
        .single();

      if (!biz) return;
      setBusinessId(biz.id);

      // Get existing config
      const { data: existing } = await supabase
        .from("mpesa_configs")
        .select("*")
        .eq("business_id", biz.id)
        .single();

      if (existing) {
        setHasConfig(true);
        setConfig({
          consumer_key: existing.consumer_key || "",
          consumer_secret: existing.consumer_secret || "",
          shortcode: existing.shortcode || "",
          passkey: existing.passkey || "",
          environment: existing.environment || "sandbox",
          account_name: existing.account_name || "",
          b2c_shortcode: existing.b2c_shortcode || "",
          b2c_initiator_name: existing.b2c_initiator_name || "",
          b2c_security_credential: existing.b2c_security_credential || "",
        });
      }
    };
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!businessId) return;
    if (!config.consumer_key || !config.consumer_secret || !config.shortcode || !config.passkey) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("mpesa_configs")
      .upsert({
        business_id: businessId,
        ...config,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id" });

    if (error) {
      toast({ title: "Error saving M-Pesa config", description: error.message, variant: "destructive" });
    } else {
      setHasConfig(true);
      toast({ title: "M-Pesa settings saved successfully!" });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!businessId) return;
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("mpesa-auth", {
        body: { business_id: businessId },
      });

      if (error || !data?.access_token) {
        setTestResult("failed");
        toast({ title: "Connection failed", description: "Check your credentials and try again.", variant: "destructive" });
      } else {
        setTestResult("success");
        toast({ title: "Connection successful!", description: "Your Daraja credentials are working correctly." });
      }
    } catch (err) {
      setTestResult("failed");
      toast({ title: "Connection failed", variant: "destructive" });
    }
    setTesting(false);
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">M-Pesa Integration</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Connect your Safaricom Daraja API to accept payments and send money
            </p>
          </div>
          {hasConfig && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Connected
            </span>
          )}
        </div>

        {/* Environment Toggle */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Environment
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setConfig({ ...config, environment: "sandbox" })}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                config.environment === "sandbox"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              🧪 Sandbox (Testing)
            </button>
            <button
              onClick={() => setConfig({ ...config, environment: "production" })}
              className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                config.environment === "production"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border hover:border-green-500/50"
              }`}
            >
              🚀 Production (Live)
            </button>
          </div>
          {config.environment === "sandbox" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
              <strong>Sandbox Mode:</strong> Use test credentials from developer.safaricom.co.ke.
              Sandbox shortcode: <strong>174379</strong>. No real money is moved.
            </div>
          )}
          {config.environment === "production" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Production Mode:</strong> Real money will be processed. Make sure your credentials are correct.
            </div>
          )}
        </div>

        {/* STK Push Credentials */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            STK Push Credentials
            <span className="text-xs text-muted-foreground font-normal">(for receiving payments)</span>
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Consumer Key *</Label>
              <Input
                value={config.consumer_key}
                onChange={(e) => setConfig({ ...config, consumer_key: e.target.value })}
                placeholder="From Daraja portal"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Consumer Secret *</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={config.consumer_secret}
                  onChange={(e) => setConfig({ ...config, consumer_secret: e.target.value })}
                  placeholder="From Daraja portal"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Business Shortcode *</Label>
              <Input
                value={config.shortcode}
                onChange={(e) => setConfig({ ...config, shortcode: e.target.value })}
                placeholder={config.environment === "sandbox" ? "174379" : "Your Paybill/Till number"}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Passkey *</Label>
              <div className="relative">
                <Input
                  type={showPasskey ? "text" : "password"}
                  value={config.passkey}
                  onChange={(e) => setConfig({ ...config, passkey: e.target.value })}
                  placeholder="From Daraja portal"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasskey(!showPasskey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPasskey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Account Name</Label>
              <Input
                value={config.account_name}
                onChange={(e) => setConfig({ ...config, account_name: e.target.value })}
                placeholder="Name that appears on customer's M-Pesa prompt"
              />
            </div>
          </div>
        </div>

        {/* B2C Credentials */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div>
            <h2 className="font-semibold">B2C Credentials</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Optional — for sending money to employees (payroll disbursement)</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>B2C Shortcode</Label>
              <Input
                value={config.b2c_shortcode}
                onChange={(e) => setConfig({ ...config, b2c_shortcode: e.target.value })}
                placeholder="Your B2C shortcode"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Initiator Name</Label>
              <Input
                value={config.b2c_initiator_name}
                onChange={(e) => setConfig({ ...config, b2c_initiator_name: e.target.value })}
                placeholder="API operator username"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Security Credential</Label>
              <Input
                type="password"
                value={config.b2c_security_credential}
                onChange={(e) => setConfig({ ...config, b2c_security_credential: e.target.value })}
                placeholder="Encrypted security credential"
              />
            </div>
          </div>
        </div>

        {/* Callback URL Info */}
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Callback URL (set this in Daraja portal)</p>
          <code className="text-xs bg-background border rounded px-2 py-1 block break-all">
            https://pvawptdrpapdhhwdoyxz.supabase.co/functions/v1/mpesa-callback
          </code>
          <p className="text-xs text-muted-foreground mt-2">Copy this URL and paste it as the Confirmation URL and Validation URL in your Daraja app settings.</p>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${
            testResult === "success"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}>
            {testResult === "success" ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${testResult === "success" ? "text-green-700" : "text-red-700"}`}>
              {testResult === "success"
                ? "Successfully connected to Safaricom Daraja API!"
                : "Connection failed. Please check your credentials."}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !config.consumer_key || !config.consumer_secret}
            className="gap-2"
          >
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? "Saving..." : "Save M-Pesa Settings"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default MpesaSettings;