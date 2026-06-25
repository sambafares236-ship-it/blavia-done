// supabase/functions/etims-auth/index.ts
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
    const { business_id } = await req.json();

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

    // Fetch tenant eTIMS config
    const { data: config, error } = await supabase
      .from("etims_configs")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (error || !config) {
      return new Response(JSON.stringify({ error: "eTIMS not configured for this business" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already initialized and CMC key exists, return it
    if (config.cmc_key && config.status === "active") {
      return new Response(
        JSON.stringify({
          success: true,
          already_initialized: true,
          kra_pin: config.kra_pin,
          branch_id: config.branch_id,
          cmc_key: config.cmc_key,
          base_url: config.environment === "production"
            ? "https://etims.kra.go.ke/etims-api"
            : "https://etims-sbx.kra.go.ke/etims-api",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise initialize the OSCU device with KRA
    const baseUrl = config.environment === "production"
      ? "https://etims.kra.go.ke/etims-api"
      : "https://etims-sbx.kra.go.ke/etims-api";

    const initPayload = {
      tin: config.kra_pin,
      bhfId: config.branch_id || "00",
      dvcSrlNo: config.device_serial,
    };

    console.log("Initializing OSCU device with KRA:", initPayload);

    const kraRes = await fetch(`${baseUrl}/initializer/selectInitInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initPayload),
    });

    const kraData = await kraRes.json();
    console.log("KRA init response:", JSON.stringify(kraData));

    // KRA returns resultCd: "000" on success
    if (kraData.resultCd !== "000") {
      // Save error state
      await supabase
        .from("etims_configs")
        .update({
          status: "error",
          error_message: `KRA Error ${kraData.resultCd}: ${kraData.resultMsg}`,
          updated_at: new Date().toISOString(),
        })
        .eq("business_id", business_id);

      return new Response(
        JSON.stringify({
          error: `KRA initialization failed: ${kraData.resultMsg}`,
          kra_code: kraData.resultCd,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract CMC key from KRA response
    const cmcKey = kraData.data?.info?.cmcKey;

    if (!cmcKey) {
      return new Response(
        JSON.stringify({ error: "KRA did not return a CMC key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store CMC key and mark as active
    await supabase
      .from("etims_configs")
      .update({
        cmc_key: cmcKey,
        status: "active",
        is_active: true,
        last_initialized_at: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", business_id);

    return new Response(
      JSON.stringify({
        success: true,
        already_initialized: false,
        kra_pin: config.kra_pin,
        branch_id: config.branch_id,
        cmc_key: cmcKey,
        base_url: baseUrl,
        kra_response: kraData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("etims-auth error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});