import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { business_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get this business's eTIMS credentials
    const { data: config, error } = await supabase
      .from("etims_configs")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (error || !config) {
      return new Response(JSON.stringify({ error: "eTIMS not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const baseUrl = config.environment === "production"
      ? "https://etims.kra.go.ke"
      : "https://etims-sbx.kra.go.ke";

    // Get token from KRA
    const response = await fetch(`${baseUrl}/etims-api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.client_id,
        client_secret: config.client_secret,
      }),
    });

    const token = await response.json();

    return new Response(JSON.stringify({ token, base_url: baseUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});