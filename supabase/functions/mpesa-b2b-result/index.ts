import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get("payment_id");
    const isTimeout = url.searchParams.get("timeout") === "1";

    const body = await req.json();
    const result = body.Result;

    if (!result) {
      return new Response(JSON.stringify({ error: "Invalid callback" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resultCode = result.ResultCode;
    const isSuccess = !isTimeout && resultCode === 0;

    const transactionId: string | undefined = result.ResultParameters?.ResultParameter
      ?.find((p: { Key: string }) => p.Key === "TransactionReceipt")?.Value;

    if (paymentId) {
      await supabase
        .from("payments")
        .update(
          isSuccess
            ? {
                status: "paid",
                paid_date: todayStr(),
                payment_method: "mpesa",
                b2b_reference: transactionId || result.TransactionID || result.ConversationID,
                b2b_result: result.ResultDesc || "Success",
              }
            : {
                // Leave status as "pending" so the payable stays visible
                // and retryable — a failed/timed-out B2B request should
                // not silently disappear from the Payables list.
                b2b_result: isTimeout
                  ? "Timeout — no response from Safaricom"
                  : `ResultCode ${resultCode}: ${result.ResultDesc || "Unknown error"}`,
              }
        )
        .eq("id", paymentId);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
