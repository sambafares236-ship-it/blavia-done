import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
serve(async (req) => {
  try {
    const body = await req.json(); const result = body.Result;
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const payslipId = result?.OriginatorConversationID?.replace("payslip-", "");
    if (payslipId) {
      await supabase.from("payslips").update({ payment_status: "failed", payment_reference: "Timeout - no response from Safaricom" }).eq("id", payslipId);

      // Same rollup as mpesa-b2c-result — otherwise a run whose last
      // outstanding payslip times out never leaves "draft".
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

        const allPaid = allPayslips?.every((p) => p.payment_status === "paid");
        const anyFailed = allPayslips?.some((p) => p.payment_status === "failed");

        if (allPaid) {
          await supabase.from("payroll_runs").update({ status: "completed" }).eq("id", payslip.payroll_run_id);
        } else if (anyFailed) {
          await supabase.from("payroll_runs").update({ status: "partial" }).eq("id", payslip.payroll_run_id);
        }
      }
    }
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Timeout noted" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) { return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
});
