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
    let {
      business_id,
      phone_number,
      amount,
      invoice_id,
      account_reference,
      transaction_desc,
    } = await req.json();

    if (!phone_number) {
      return new Response(
        JSON.stringify({ error: "phone_number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── If business_id is missing (e.g. public payment page), look it up
    // and the amount from the invoice itself — NEVER trust amount/business_id
    // from an unauthenticated caller.
    if (invoice_id) {
      const { data: invoiceRow, error: invError } = await supabase
        .from("invoices")
        .select("business_id, total, invoice_number, payment_description, status")
        .eq("id", invoice_id)
        .single();

      if (invError || !invoiceRow) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (invoiceRow.status === "paid") {
        return new Response(
          JSON.stringify({ error: "This invoice has already been paid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Always trust the server-side invoice record, not the caller
      business_id = invoiceRow.business_id;
      amount = invoiceRow.total;
      account_reference = invoiceRow.invoice_number;
      transaction_desc = invoiceRow.payment_description || "Payment for goods/services";
    }

    if (!business_id || !amount) {
      return new Response(
        JSON.stringify({ error: "business_id and amount are required (or a valid invoice_id)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1 — Get auth token for this business ─────────────
    const authResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ business_id }),
      }
    );

    const authData = await authResponse.json();

    if (!authData.access_token) {
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with Safaricom", details: authData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2 — Generate password ─────────────────────────────
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const passwordString = `${authData.shortcode}${authData.passkey}${timestamp}`;
    const password = btoa(passwordString);

    // ── Step 3 — Format phone number ───────────────────────────
    let formattedPhone = phone_number.toString().replace(/\s/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "254" + formattedPhone.slice(1);
    }
    if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.slice(1);
    }

    // ── Step 4 — Callback URL ───────────────────────────────────
    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-callback`;

    // ── Step 5 — STK Push payload ───────────────────────────────
    const stkPayload = {
      BusinessShortCode: authData.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(Number(amount)),
      PartyA: formattedPhone,
      PartyB: authData.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: account_reference || "BLAVIA",
      TransactionDesc: transaction_desc || "Payment via Blavia",
    };

    // ── Step 6 — Send STK Push ───────────────────────────────────
    const stkResponse = await fetch(
      `${authData.base_url}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPayload),
      }
    );

    const stkData = await stkResponse.json();

    // ── Step 7 — Save transaction to Supabase ────────────────────
    const { data: transaction, error: txError } = await supabase
      .from("mpesa_transactions")
      .insert({
        business_id,
        invoice_id: invoice_id || null,
        transaction_type: "STK_PUSH",
        merchant_request_id: stkData.MerchantRequestID,
        checkout_request_id: stkData.CheckoutRequestID,
        phone_number: formattedPhone,
        amount: Math.ceil(Number(amount)),
        account_reference: account_reference || "BLAVIA",
        transaction_desc: transaction_desc || "Payment via Blavia",
        status: stkData.ResponseCode === "0" ? "pending" : "failed",
        result_code: stkData.ResponseCode,
        result_desc: stkData.ResponseDescription,
      })
      .select()
      .single();

    if (txError) {
      console.error("Error saving transaction:", txError);
    }

    // ── Step 8 — If from public page, save phone on invoice too ──
    if (invoice_id && stkData.ResponseCode === "0") {
      await supabase
        .from("invoices")
        .update({ customer_phone: formattedPhone })
        .eq("id", invoice_id);
    }

    // ── Step 9 — Return response ──────────────────────────────────
    if (stkData.ResponseCode === "0") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "STK Push sent successfully. Check your phone.",
          checkout_request_id: stkData.CheckoutRequestID,
          merchant_request_id: stkData.MerchantRequestID,
          transaction_id: transaction?.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.errorMessage || stkData.ResponseDescription,
          details: stkData,
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