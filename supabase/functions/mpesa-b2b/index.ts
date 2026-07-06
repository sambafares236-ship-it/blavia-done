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
    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ error: "payment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Never trust amount/till number from the caller — always read the
    // payable itself, same pattern as mpesa-stk-push reading the invoice.
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, business_id, amount, narration, reference_number, till_number, status")
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: "Payable not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payment.status === "paid") {
      return new Response(
        JSON.stringify({ error: "This payable has already been paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payment.till_number) {
      return new Response(
        JSON.stringify({ error: "This payable has no till number set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1 — Get auth token + credentials for this business ──
    const authResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ business_id: payment.business_id }),
      }
    );

    const authData = await authResponse.json();

    if (!authData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Safaricom", details: authData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!authData.b2c_initiator_name || !authData.b2c_security_credential) {
      return new Response(
        JSON.stringify({ error: "B2B/B2C initiator credentials aren't configured for this business yet — set them up in M-Pesa Settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2 — Callback URLs (carry payment_id so the result handler
    // knows which payable to update — Safaricom echoes back its own
    // ConversationID, not anything we send it) ──
    const resultUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-b2b-result?payment_id=${payment.id}`;
    const timeoutUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-b2b-result?payment_id=${payment.id}&timeout=1`;

    // ── Step 3 — Business to Business (Buy Goods / Till) payload ──
    const b2bPayload = {
      Initiator: authData.b2c_initiator_name,
      SecurityCredential: authData.b2c_security_credential,
      CommandID: "BusinessBuyGoods",
      SenderIdentifierType: "4",
      RecieverIdentifierType: "4",
      Amount: Math.ceil(Number(payment.amount)),
      PartyA: authData.b2c_shortcode || authData.shortcode,
      PartyB: payment.till_number,
      AccountReference: payment.reference_number || payment.narration || "BLAVIA",
      Remarks: payment.narration || "Payment via Blavia",
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
    };

    // ── Step 4 — Send B2B request ──
    const b2bResponse = await fetch(
      `${authData.base_url}/mpesa/b2b/v1/paymentrequest`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(b2bPayload),
      }
    );

    const b2bData = await b2bResponse.json();
    const succeeded = b2bData.ResponseCode === "0";

    await supabase
      .from("payments")
      .update({
        b2b_initiated_at: new Date().toISOString(),
        b2b_result: succeeded ? null : (b2bData.errorMessage || b2bData.ResponseDescription || "Request rejected"),
      })
      .eq("id", payment.id);

    if (succeeded) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "B2B payment initiated",
          conversation_id: b2bData.ConversationID,
          originator_conversation_id: b2bData.OriginatorConversationID,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: b2bData.errorMessage || b2bData.ResponseDescription,
          details: b2bData,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
