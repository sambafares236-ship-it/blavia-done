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
    const body = await req.json();
    const result = body.Result;

    if (!result) {
      return new Response(JSON.stringify({ error: "Invalid callback" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const conversationId = result.ConversationID;
    const originatorConversationId = result.OriginatorConversationID;
    const resultCode = result.ResultCode;
    const resultDesc = result.ResultDesc;
    const payslipId = result.ReferenceData?.ReferenceItem?.Value || originatorConversationId?.replace("payslip-", "");

    const isSuccess = resultCode === 0;

    // Update payslip payment status
    if (payslipId) {
      await supabase
        .from("payslips")
        .update({
          payment_status: isSuccess ? "paid" : "failed",
          payment_reference: conversationId,
          paid_at: isSuccess ? new Date().toISOString() : null,
        })
        .eq("id", payslipId);

      // If paid — check if all payslips in the run are paid
      if (isSuccess) {
        const { data: payslip } = await supabase
          .from("payslips")
          .select("payroll_run_id")
          .eq("id", payslipId)
          .single();

        if (payslip?.payroll_run_id) {
          const { data: allPayslips } = await supabase
            .from("payslips")
            .select("payment_status")
            .eq("payroll_run_id", payslip.payroll_run_id);

          const allPaid = allPayslips?.every(p => p.payment_status === "paid");
          const anyFailed = allPayslips?.some(p => p.payment_status === "failed");

          if (allPaid) {
            await supabase
              .from("payroll_runs")
              .update({ status: "completed" })
              .eq("id", payslip.payroll_run_id);
          } else if (anyFailed) {
            await supabase
              .from("payroll_runs")
              .update({ status: "partial" })
              .eq("id", payslip.payroll_run_id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});