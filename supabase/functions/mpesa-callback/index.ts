import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendWhatsApp(to: string, body: string) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER")!;

  let formattedTo = to.toString().replace(/\s/g, "");
  if (formattedTo.startsWith("0")) formattedTo = "254" + formattedTo.slice(1);
  if (!formattedTo.startsWith("+")) formattedTo = "+" + formattedTo;

  const params = new URLSearchParams();
  params.append("From", fromNumber);
  params.append("To", `whatsapp:${formattedTo}`);
  params.append("Body", body);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data = await res.json();
    if (!res.ok) console.error("WhatsApp send failed:", data);
    return data;
  } catch (err) {
    console.error("WhatsApp send error:", err);
  }
}

const fmt = (n: number) =>
  "KES " + Number(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

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

    if (resultCode === 0 && transaction?.invoice_id) {
      const { data: invoiceData } = await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          mpesa_reference: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.invoice_id)
        .select("invoice_number")
        .single();

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

        // ── Fetch business for name + owner WhatsApp ──────────
        const { data: business } = await supabase
          .from("businesses")
          .select("business_name, whatsapp_number")
          .eq("id", transaction.business_id)
          .single();

        const invoiceNumber = invoiceData?.invoice_number || transaction.account_reference || "";

        // ── 1. Receipt to the CUSTOMER who paid ────────────────
        if (phoneNumber) {
          const customerMsg = `✅ *Payment Received!*\n\nThank you for your payment to *${business?.business_name || "the business"}*.\n\n💰 Amount: *${fmt(amount)}*\n🧾 Receipt: *${mpesaReceiptNumber}*\n${invoiceNumber ? `📄 Invoice: *${invoiceNumber}*\n` : ""}\n_Powered by BLAVIA_`;
          await sendWhatsApp(phoneNumber, customerMsg);
        }

        // ── 2. Alert to the BUSINESS OWNER ─────────────────────
        if (business?.whatsapp_number) {
          const ownerMsg = `💰 *Payment Received!*\n\nYou just received *${fmt(amount)}* via M-Pesa.\n\n🧾 Receipt: *${mpesaReceiptNumber}*\n${invoiceNumber ? `📄 Invoice: *${invoiceNumber}*\n` : ""}📱 From: ${phoneNumber}\n\n_Powered by BLAVIA_`;
          await sendWhatsApp(business.whatsapp_number, ownerMsg);
        }
      }
    }

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