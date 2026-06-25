// supabase/functions/etims-get-codes/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { business_id, last_request_date } = await req.json();

    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: config } = await supabase
      .from("etims_configs")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (!config?.cmc_key || config.status !== "active") {
      return new Response(
        JSON.stringify({ error: "eTIMS not initialized" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = config.environment === "production"
      ? "https://etims.kra.go.ke/etims-api"
      : "https://etims-sbx.kra.go.ke/etims-api";

    const kraRes = await fetch(`${baseUrl}/code/selectCodeList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "tin": config.kra_pin,
        "bhfId": config.branch_id || "00",
        "cmcKey": config.cmc_key,
      },
      body: JSON.stringify({
        tin: config.kra_pin,
        bhfId: config.branch_id || "00",
        lastReqDt: last_request_date || "20240101000000",
      }),
    });

    const codes = await kraRes.json();

    return new Response(JSON.stringify(codes), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("etims-get-codes error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});