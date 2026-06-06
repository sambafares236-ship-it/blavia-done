import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

const EtimsSettings = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    kra_pin: "",
    client_id: "",
    client_secret: "",
    branch_id: "00",
    environment: "sandbox",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("etims_configs")
        .select("*")
        .eq("business_id", user?.id)
        .single();
      if (data) setConfig(data);
    };
    if (user) fetchConfig();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("etims_configs")
      .upsert({ ...config, business_id: user?.id });

    if (error) {
      toast({ title: "Error saving eTIMS config", variant: "destructive" });
    } else {
      toast({ title: "eTIMS configuration saved!" });
    }
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">eTIMS Integration</h1>
        <p className="text-muted-foreground">
          Connect your KRA eTIMS credentials to automatically submit invoices to KRA.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border p-6">
        <div className="space-y-2">
          <Label>KRA PIN</Label>
          <Input
            value={config.kra_pin}
            onChange={(e) => setConfig({ ...config, kra_pin: e.target.value })}
            placeholder="P000000000A"
          />
        </div>
        <div className="space-y-2">
          <Label>Client ID</Label>
          <Input
            value={config.client_id}
            onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
            placeholder="From KRA eTIMS portal"
          />
        </div>
        <div className="space-y-2">
          <Label>Client Secret</Label>
          <Input
            type="password"
            value={config.client_secret}
            onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
            placeholder="From KRA eTIMS portal"
          />
        </div>
        <div className="space-y-2">
          <Label>Branch ID</Label>
          <Input
            value={config.branch_id}
            onChange={(e) => setConfig({ ...config, branch_id: e.target.value })}
            placeholder="00"
          />
        </div>
        <div className="space-y-2">
          <Label>Environment</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={config.environment}
            onChange={(e) => setConfig({ ...config, environment: e.target.value })}
          >
            <option value="sandbox">Sandbox (Testing)</option>
            <option value="production">Production (Live)</option>
          </select>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save eTIMS Configuration"}
        </Button>
      </div>
    </div>
  );
};

export default EtimsSettings;