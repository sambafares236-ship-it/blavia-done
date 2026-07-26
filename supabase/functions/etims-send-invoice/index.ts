// supabase/functions/etims-send-invoice/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { KRA_BANDS, bandForCode, rateForCode, type KraBand } from "../_shared/kraTax.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { business_id, invoice_id } = await req.json();

    if (!business_id || !invoice_id) {
      return new Response(
        JSON.stringify({ error: "business_id and invoice_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get eTIMS config (must be active + have CMC key)
    const { data: config, error: configError } = await supabase
      .from("etims_configs")
      .select("*")
      .eq("business_id", business_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "eTIMS not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.cmc_key || config.status !== "active") {
      return new Response(
        JSON.stringify({ error: "eTIMS not initialized. Run initialization first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Get invoice + items + contact (customer)
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(`
        *,
        contacts(id, name, email, phone, kra_pin),
        invoice_items(*)
      `)
      .eq("id", invoice_id)
      .eq("business_id", business_id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Get business name
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", business_id)
      .single();

    const baseUrl = config.environment === "production"
      ? "https://etims.kra.go.ke/etims-api"
      : "https://etims-sbx.kra.go.ke/etims-api";

    // 4. Build KRA invoice payload
    const salesDate = new Date(invoice.issue_date)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const confirmedDateTime = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", "")
      .replace(/:/g, "")
      .replace(/-/g, "");

    // Map payment method to KRA codes
    const pmtCodeMap: Record<string, string> = {
      cash: "01",
      mpesa: "02",
      bank_transfer: "04",
      cheque: "03",
      credit: "05",
    };

    // Aggregate each band from the line items rather than assuming everything
    // is standard-rated. The previous version put the whole subtotal into
    // taxblAmtA at 16% regardless of the codes on the lines, which misreported
    // exempt lines on mixed invoices and made a non-VAT invoice incoherent —
    // a 16% band carrying zero tax.
    const bandTotals: Record<KraBand, { taxbl: number; tax: number }> =
      Object.fromEntries(KRA_BANDS.map((b) => [b, { taxbl: 0, tax: 0 }])) as Record<
        KraBand,
        { taxbl: number; tax: number }
      >;

    for (const item of invoice.invoice_items ?? []) {
      const band = bandForCode(item.tax_code);
      const lineTotal = Number(item.total) || 0;
      const lineTax = Number(item.vat_amount) || 0;
      bandTotals[band].taxbl += lineTotal - lineTax;
      bandTotals[band].tax += lineTax;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const totTaxblAmt = round2(
      KRA_BANDS.reduce((s, b) => s + bandTotals[b].taxbl, 0),
    );
    const totTaxAmt = round2(KRA_BANDS.reduce((s, b) => s + bandTotals[b].tax, 0));

    const kraInvoice = {
      tin: config.kra_pin,
      bhfId: config.branch_id || "00",
      orgInvcNo: 0,
      cisInvcNo: invoice.invoice_number,
      // Buyer's KRA PIN. Captured on the contact and required for the buyer to
      // claim the expense; null for genuine walk-in B2C sales.
      custTin: invoice.contacts?.kra_pin || null,
      custNm: invoice.contacts?.name || "Retail Customer",
      rcptTyCd: "S",   // S = Sale
      pmtTyCd: pmtCodeMap[invoice.payment_method] || "01",
      salesSttsCd: "02", // 02 = Approved
      cfmDt: confirmedDateTime,
      salesDt: salesDate,
      stockRlsDt: null,
      cnclReqDt: null,
      cnclDt: null,
      rfdDt: null,
      rfdRsnCd: null,
      totItemCnt: invoice.invoice_items?.length || 0,
      taxblAmtA: round2(bandTotals.A.taxbl),
      taxblAmtB: round2(bandTotals.B.taxbl),
      taxblAmtC: round2(bandTotals.C.taxbl),
      taxblAmtD: round2(bandTotals.D.taxbl),
      taxRtA: rateForCode("A"),
      taxRtB: rateForCode("B"),
      taxRtC: rateForCode("C"),
      taxRtD: rateForCode("D"),
      taxAmtA: round2(bandTotals.A.tax),
      taxAmtB: round2(bandTotals.B.tax),
      taxAmtC: round2(bandTotals.C.tax),
      taxAmtD: round2(bandTotals.D.tax),
      totTaxblAmt,
      totTaxAmt,
      totAmt: invoice.total,
      prchrAcptcYn: "N",
      remark: invoice.notes || null,
      regrId: config.kra_pin,
      regrNm: business?.business_name || "Business",
      modrId: config.kra_pin,
      modrNm: business?.business_name || "Business",
      itemList: (invoice.invoice_items || []).map((item: any, index: number) => {
        const unitPrice = Number(item.unit_price) || 0;
        const qty = Number(item.quantity) || 1;
        const taxAmt = Number(item.vat_amount) || 0;
        const total = Number(item.total) || 0;
        const taxable = total - taxAmt;

        return {
          itemSeq: index + 1,
          itemCd: item.id, // use item UUID as item code
          itemClsCd: "5020230602", // default class code � general goods
          itemNm: item.description,
          bcd: null,
          pkgUnitCd: "NT",
          pkg: 1,
          qtyUnitCd: "U",
          qty: qty,
          prc: unitPrice,
          splyAmt: taxable,
          dcRt: 0,
          dcAmt: 0,
          isrccCd: null,
          isrccNm: null,
          isrcRt: 0,
          isrcAmt: 0,
          taxTyCd: bandForCode(item.tax_code),
          taxblAmt: taxable,
          taxAmt: taxAmt,
          totAmt: total,
        };
      }),
    };

    console.log("Sending invoice to KRA:", JSON.stringify(kraInvoice));

    // 5-7. POST to KRA and persist the outcome. Wrapped separately from the
    // outer catch so a network failure/timeout/non-JSON response (KRA
    // unreachable, not just KRA rejecting the invoice) still gets recorded as
    // a "failed" attempt instead of leaving the invoice's etims_status
    // untouched and invisible to any retry/alert polling.
    try {
      const kraRes = await fetch(`${baseUrl}/trnsSalesSave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "tin": config.kra_pin,
          "bhfId": config.branch_id || "00",
          "cmcKey": config.cmc_key,
        },
        body: JSON.stringify(kraInvoice),
      });

      const kraResult = await kraRes.json();
      console.log("KRA response:", JSON.stringify(kraResult));

      const success = kraResult.resultCd === "000";
      const cuin = kraResult.data?.invoiceNo || null;
      const qrCode = kraResult.data?.qrCode || null;
      const receiptNo = kraResult.data?.receiptNo || null;

      // 6. Save to etims_invoices audit table
      await supabase.from("etims_invoices").insert({
        business_id,
        invoice_id,
        invoice_number: invoice.invoice_number,
        cuin,
        customer_name: invoice.contacts?.name || "Retail Customer",
        customer_pin: null,
        total_amount: invoice.total,
        vat_amount: invoice.vat_amount,
        status: success ? "accepted" : "failed",
        etims_receipt_no: receiptNo,
        qr_code: qrCode,
        submitted_at: new Date().toISOString(),
        raw_request: kraInvoice,
        raw_response: kraResult,
      });

      // 7. Update the invoice record with KRA data
      const { error: invUpdErr } = await supabase
        .from("invoices")
        .update({
          etims_status: success ? "submitted" : "failed",
          cuin: cuin,
          etims_receipt_no: receiptNo,
          etims_submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      // Silently losing this write would leave a KRA-accepted invoice looking
      // unsubmitted, and the failure poller would never see it either.
      if (invUpdErr) {
        console.error("etims-send-invoice: invoice status write failed:", invUpdErr);
      }

      if (!success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `KRA rejected invoice: ${kraResult.resultMsg}`,
            kra_code: kraResult.resultCd,
            kra_response: kraResult,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          cuin,
          receipt_no: receiptNo,
          qr_code: qrCode,
          kra_response: kraResult,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (kraErr) {
      console.error("etims-send-invoice KRA call failed:", kraErr);

      await supabase.from("etims_invoices").insert({
        business_id,
        invoice_id,
        invoice_number: invoice.invoice_number,
        cuin: null,
        customer_name: invoice.contacts?.name || "Retail Customer",
        customer_pin: null,
        total_amount: invoice.total,
        vat_amount: invoice.vat_amount,
        status: "failed",
        etims_receipt_no: null,
        qr_code: null,
        submitted_at: new Date().toISOString(),
        raw_request: kraInvoice,
        raw_response: { network_error: true, message: kraErr.message },
      });

      await supabase
        .from("invoices")
        .update({
          etims_status: "failed",
          etims_submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Could not reach KRA eTIMS: ${kraErr.message}`,
          kra_code: null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("etims-send-invoice error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});