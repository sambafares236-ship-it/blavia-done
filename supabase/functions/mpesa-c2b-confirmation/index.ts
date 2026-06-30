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
    console.log("C2B confirmation received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const shortcode = body.BusinessShortCode;
    const accountRef = (body.BillRefNumber || "").trim().toUpperCase();
    const amount = Number(body.TransAmount);
    const mpesaReceiptNumber = body.TransID;
    const phoneNumber = body.MSISDN;
    const customerName = `${body.FirstName || ""} ${body.LastName || ""}`.trim();

    const { data: mpesaConfig } = await supabase
      .from("mpesa_configs")
      .select("business_id")
      .eq("shortcode", shortcode)
      .eq("is_active", true)
      .single();

    if (!mpesaConfig) {
      console.error("No business found for shortcode:", shortcode);
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const business_id = mpesaConfig.business_id;

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status, total, invoice_number")
      .eq("business_id", business_id)
      .eq("invoice_number", accountRef)
      .single();

    await supabase.from("mpesa_transactions").insert({
      business_id,
      invoice_id: invoice?.id || null,
      transaction_type: "C2B",
      mpesa_receipt_number: mpesaReceiptNumber,
      phone_number: phoneNumber,
      amount,
      account_reference: accountRef,
      transaction_desc: `C2B payment from ${customerName || phoneNumber}`,
      status: "success",
      result_code: "0",
      result_desc: "C2B payment received",
      raw_callback: body,
    });

    if (invoice && invoice.status !== "paid") {
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          mpesa_reference: mpesaReceiptNumber,
        })
        .eq("id", invoice.id);

      await supabase.from("transactions").insert({
        business_id,
        txn_date: new Date().toISOString().split("T")[0],
        narration: `M-Pesa Paybill payment - ${mpesaReceiptNumber}`,
        amount,
        txn_type: "Income",
        category: "M-Pesa Payments",
        status: "Approved",
        ref_number: mpesaReceiptNumber,
        input_source: "mpesa_c2b",
      });
    }

    // ── WhatsApp notifications ────────────────────────────────
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, whatsapp_number")
      .eq("id", business_id)
      .single();

    const invoiceNumber = invoice?.invoice_number || accountRef;

    // 1. Receipt to the customer who paid
    if (phoneNumber) {
      const customerMsg = `✅ *Payment Received!*\n\nThank you for your payment to *${business?.business_name || "the business"}*.\n\n💰 Amount: *${fmt(amount)}*\n🧾 Receipt: *${mpesaReceiptNumber}*\n${invoiceNumber ? `📄 Reference: *${invoiceNumber}*\n` : ""}\n_Powered by BLAVIA_`;
      await sendWhatsApp(phoneNumber, customerMsg);
    }

    // 2. Alert to the business owner
    if (business?.whatsapp_number) {
      const ownerMsg = `💰 *Paybill Payment Received!*\n\nYou just received *${fmt(amount)}* via M-Pesa Paybill.\n\n🧾 Receipt: *${mpesaReceiptNumber}*\n${invoiceNumber ? `📄 Reference: *${invoiceNumber}*\n` : ""}📱 From: ${customerName || phoneNumber}\n\n_Powered by BLAVIA_`;
      await sendWhatsApp(business.whatsapp_number, ownerMsg);
    }

    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("C2B confirmation error:", err);
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});