import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  try {
    const body = await req.json(); const result = body.Result;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const payslipId = result?.OriginatorConversationID?.replace("payslip-", "");
    if (payslipId) await supabase.from("payslips").update({ payment_status: "failed", payment_reference: "Timeout - no response from Safaricom" }).eq("id", payslipId);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Timeout noted" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
});
