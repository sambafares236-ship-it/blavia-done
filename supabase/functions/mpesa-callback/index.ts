import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    console.log("M-Pesa callback received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const callback = body?.Body?.stkCallback;

    if (!callback) {
      return new Response(JSON.stringify({ error: "Invalid callback" }), { status: 400 });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = callback.ResultCode;
    const resultDesc = callback.ResultDesc;

    // Extract M-Pesa receipt if successful
    let mpesaReceiptNumber = null;
    let transactionDate = null;
    let phoneNumber = null;
    let amount = null;

    if (resultCode === 0 && callback.CallbackMetadata?.Item) {
      const items = callback.CallbackMetadata.Item;
      mpesaReceiptNumber = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      transactionDate = items.find((i: any) => i.Name === "TransactionDate")?.Value;
      phoneNumber = items.find((i: any) => i.Name === "PhoneNumber")?.Value;
      amount = items.find((i: any) => i.Name === "Amount")?.Value;
    }

    // Update transaction status
    const { data: transaction, error: updateError } = await supabase
      .from("mpesa_transactions")
      .update({
        status: resultCode === 0 ? "success" : "failed",
        result_code: String(resultCode),
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        raw_callback: body,
        updated_at: new Date().toISOString(),
      })
      .eq("checkout_request_id", checkoutRequestId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating transaction:", updateError);
    }

    // If payment successful — update invoice status
    if (resultCode === 0 && transaction?.invoice_id) {
      const { error: invError } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          mpesa_reference: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.invoice_id);

      if (invError) {
        console.error("Error updating invoice:", invError);
      }

      // Also record in transactions table
      if (transaction?.business_id) {
        await supabase.from("transactions").insert({
          business_id: transaction.business_id,
          txn_date: new Date().toISOString().split("T")[0],
          narration: `M-Pesa payment - ${mpesaReceiptNumber}`,
          amount: amount,
          txn_type: "Income",
          category: "M-Pesa Payments",
          status: "Approved",
          ref_number: mpesaReceiptNumber,
          input_source: "mpesa",
        });
      }
    }

    // Always return success to Safaricom
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Callback error:", err);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});