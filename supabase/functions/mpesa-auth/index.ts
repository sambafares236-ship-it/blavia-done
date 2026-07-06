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
      return new Response(
        JSON.stringify({ error: "business_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch THIS business's M-Pesa credentials
    const { data: config, error } = await supabase
      .from("mpesa_configs")
      .select("*")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .single();

    if (error || !config) {
      return new Response(
        JSON.stringify({ error: "M-Pesa not configured for this business" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get base URL based on environment
    const baseUrl = config.environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";

    // Encode credentials
    const credentials = btoa(`${config.consumer_key}:${config.consumer_secret}`);

    // Request OAuth token from Safaricom
    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to get token from Safaricom", details: errText }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        base_url: baseUrl,
        shortcode: config.shortcode,
        passkey: config.passkey,
        environment: config.environment,
        // B2C and B2B (Business to Business) share the same Daraja API
        // user, so the initiator/security credential pair works for both.
        b2c_shortcode: config.b2c_shortcode,
        b2c_initiator_name: config.b2c_initiator_name,
        b2c_security_credential: config.b2c_security_credential,
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