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

// Safaricom always sends MSISDN as 2547XXXXXXXX, but customer_phone in our
// own tables has been saved in mixed formats (0700..., 254700..., +254700...)
// — normalize both sides before comparing or a real match gets silently missed.
function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let p = raw.toString().replace(/\s/g, "").replace(/^\+/, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  return p;
}

const ACCEPT = { ResultCode: 0, ResultDesc: "Accepted" };
const acceptResponse = () =>
  new Response(JSON.stringify(ACCEPT), { headers: { "Content-Type": "application/json" } });

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
    const transId: string = body.TransID;
    const transTime = body.TransTime;
    const transactionType = body.TransactionType;
    const phoneNumber = body.MSISDN;
    const customerName = `${body.FirstName || ""} ${body.LastName || ""}`.trim();
    const isTill = accountRef === "";

    // ── Idempotency — Safaricom retries confirmation calls that don't get
    // a fast 200. Without this guard a retry would double-book the payment.
    // Plain array query (not .single()/.maybeSingle()) so this can never
    // throw if duplicate rows exist for any reason.
    const { data: existingRows } = await supabase
      .from("mpesa_transactions")
      .select("id")
      .eq("mpesa_receipt_number", transId)
      .eq("transaction_type", "C2B")
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      console.log("Duplicate C2B callback for TransID, skipping:", transId);
      return acceptResponse();
    }

    // Multiple businesses can legitimately share Safaricom's public sandbox
    // shortcode (174379) while each independently testing — a plain array
    // query means a collision degrades to "first match" instead of crashing
    // the whole callback the way .single() does. In production, real
    // Paybill/Till numbers are unique per merchant so this never applies.
    const { data: configRows } = await supabase
      .from("mpesa_configs")
      .select("business_id")
      .eq("shortcode", shortcode)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (!configRows || configRows.length === 0) {
      console.error("No business found for shortcode:", shortcode);
      return acceptResponse();
    }

    const business_id = configRows[0].business_id;

    // ── Find a matching invoice ─────────────────────────────────
    let invoice: { id: string; status: string; total: number; invoice_number: string } | null = null;

    if (!isTill) {
      // Paybill — the customer typed the invoice number as the account reference.
      const { data } = await supabase
        .from("invoices")
        .select("id, status, total, invoice_number")
        .eq("business_id", business_id)
        .eq("invoice_number", accountRef)
        .neq("status", "paid")
        .limit(1);
      invoice = data && data.length === 1 ? data[0] : null;
    } else {
      // Till — no account reference, so match on amount, refined by phone.
      const { data: byAmount } = await supabase
        .from("invoices")
        .select("id, status, total, invoice_number, customer_phone")
        .eq("business_id", business_id)
        .eq("total", amount)
        .neq("status", "paid");

      const candidates = byAmount || [];
      const normalizedMsisdn = normalizePhone(phoneNumber);
      const byPhoneAndAmount = candidates.filter(
        (c) => normalizePhone(c.customer_phone) === normalizedMsisdn
      );

      if (byPhoneAndAmount.length === 1) {
        invoice = byPhoneAndAmount[0];
      } else if (byPhoneAndAmount.length === 0 && candidates.length === 1) {
        invoice = candidates[0];
      }
      // byPhoneAndAmount.length > 1, or candidates.length !== 1 with no
      // phone match — ambiguous or no match, falls through to unmatched.
    }

    // ── Log the raw callback for audit/idempotency regardless of outcome ──
    await supabase.from("mpesa_transactions").insert({
      business_id,
      invoice_id: invoice?.id || null,
      transaction_type: "C2B",
      mpesa_receipt_number: transId,
      phone_number: phoneNumber,
      amount,
      account_reference: accountRef || null,
      transaction_desc: `C2B ${isTill ? "Till" : "Paybill"} payment from ${customerName || phoneNumber}`,
      status: "success",
      result_code: "0",
      result_desc: "C2B payment received",
      raw_callback: body,
    });

    let matched = false;

    if (invoice) {
      matched = true;
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          mpesa_reference: transId,
        })
        .eq("id", invoice.id);

      await supabase.from("transactions").insert({
        business_id,
        txn_date: new Date().toISOString().split("T")[0],
        narration: `M-Pesa ${isTill ? "Till" : "Paybill"} payment - ${isTill ? invoice.invoice_number : accountRef}`,
        amount,
        txn_type: "Income",
        category: "M-Pesa Payments",
        status: "Approved",
        ref_number: transId,
        input_source: "mpesa_c2b",
      });
    } else {
      // No confident match (zero or multiple candidates) — never reject the
      // payment; record it as unmatched income and queue it for manual
      // matching from the Payments page.
      await supabase.from("transactions").insert({
        business_id,
        txn_date: new Date().toISOString().split("T")[0],
        narration: `Unmatched ${isTill ? "Till" : "Paybill"} payment from ${customerName || phoneNumber}`,
        amount,
        txn_type: "Income",
        category: "Unmatched Payments",
        status: "Approved",
        ref_number: transId,
        input_source: "mpesa_c2b",
      });

      await supabase.from("pending_matches").insert({
        business_id,
        trans_id: transId,
        trans_amount: amount,
        msisdn: phoneNumber,
        first_name: customerName || null,
        trans_time: transTime,
        bill_ref_number: accountRef || null,
        transaction_type: transactionType,
        match_status: "pending",
      });
    }

    // ── WhatsApp notifications ────────────────────────────────
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, whatsapp_number")
      .eq("id", business_id)
      .single();

    const invoiceNumber = invoice?.invoice_number || accountRef;

    if (phoneNumber) {
      const customerMsg = matched
        ? `✅ *Payment Received!*\n\nThank you for your payment to *${business?.business_name || "the business"}*.\n\n💰 Amount: *${fmt(amount)}*\n🧾 Receipt: *${transId}*\n${invoiceNumber ? `📄 Reference: *${invoiceNumber}*\n` : ""}\n_Powered by BLAVIA_`
        : `✅ *Payment Received!*\n\nThank you for your payment to *${business?.business_name || "the business"}*.\n\n💰 Amount: *${fmt(amount)}*\n🧾 Receipt: *${transId}*\n\n_Powered by BLAVIA_`;
      await sendWhatsApp(phoneNumber, customerMsg);
    }

    if (business?.whatsapp_number) {
      const ownerMsg = matched
        ? `💰 *${isTill ? "Till" : "Paybill"} Payment Received!*\n\nYou just received *${fmt(amount)}* via M-Pesa.\n\n🧾 Receipt: *${transId}*\n${invoiceNumber ? `📄 Reference: *${invoiceNumber}*\n` : ""}📱 From: ${customerName || phoneNumber}\n\n_Powered by BLAVIA_`
        : `⚠️ *Unmatched ${isTill ? "Till" : "Paybill"} Payment*\n\nReceived *${fmt(amount)}* via M-Pesa but couldn't auto-match it to an invoice.\n\n🧾 Receipt: *${transId}*\n📱 From: ${customerName || phoneNumber}\n\nOpen Payments in Blavia to match it manually.\n\n_Powered by BLAVIA_`;
      await sendWhatsApp(business.whatsapp_number, ownerMsg);
    }

    return acceptResponse();

  } catch (err) {
    console.error("C2B confirmation error:", err);
    return acceptResponse();
  }
});
