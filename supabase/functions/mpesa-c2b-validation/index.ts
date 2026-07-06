import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safaricom calls this before every C2B payment to ask "should I accept
// this?" — it must respond fast with ResultCode 0. We accept everything
// unconditionally (per Daraja's own guidance, since Paybill/Till validation
// has no way to check invoice existence without slowing down the payment
// flow) and let mpesa-c2b-confirmation do the actual matching afterward.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("C2B validation received:", JSON.stringify(body));
  } catch (_err) {
    // Malformed/empty body — still accept, never block a payment here.
  }

  return new Response(
    JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
