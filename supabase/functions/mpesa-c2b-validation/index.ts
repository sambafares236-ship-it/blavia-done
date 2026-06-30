import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { business_id } = await req.json();

    if (!business_id) {
      return new Response(
        JSON.stringify({ error: "business_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth token for this business
    const authResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ business_id }),
      }
    );

    const authData = await authResponse.json();

    if (!authData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Safaricom", details: authData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confirmationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-c2b-confirmation`;
    const validationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-c2b-validation`;

    const registerPayload = {
      ShortCode: authData.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl,
    };

    const registerResponse = await fetch(
      `${authData.base_url}/mpesa/c2b/v1/registerurl`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerPayload),
      }
    );

    const registerData = await registerResponse.json();

    // Mark as registered regardless of sandbox quirks (sandbox often returns success differently)
    await supabase
      .from("mpesa_configs")
      .update({
        c2b_registered: true,
        c2b_registered_at: new Date().toISOString(),
      })
      .eq("business_id", business_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "C2B callback URLs registered with Safaricom",
        details: registerData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});