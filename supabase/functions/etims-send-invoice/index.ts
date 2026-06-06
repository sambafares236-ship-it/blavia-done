import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { business_id, invoice } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth token first
    const authRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/etims-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id }),
    });
    const { token, base_url } = await authRes.json();

    // Get business KRA PIN
    const { data: config } = await supabase
      .from("etims_configs")
      .select("kra_pin, branch_id, device_serial")
      .eq("business_id", business_id)
      .single();

    // Format invoice for KRA
    const kraInvoice = {
      tin: config.kra_pin,
      bhfId: config.branch_id,
      orgInvcNo: 0,
      cisInvcNo: invoice.invoice_number,
      custTin: invoice.customer_pin || null,
      custNm: invoice.customer_name,
      rcptTyCd: "S", // S=Sale
      pmtTyCd: invoice.payment_method || "01", // 01=Cash, 02=M-Pesa
      salesSttsCd: "02", // 02=Approved
      cfmDt: new Date().toISOString().slice(0, 19).replace("T", " "),
      salesDt: invoice.date,
      stockRlsDt: null,
      cnclReqDt: null,
      cnclDt: null,
      rfdDt: null,
      rfdRsnCd: null,
      totItemCnt: invoice.items.length,
      taxblAmtA: invoice.taxable_amount,
      taxblAmtB: 0,
      taxblAmtC: 0,
      taxblAmtD: 0,
      taxRtA: 16,
      taxRtB: 0,
      taxRtC: 0,
      taxRtD: 0,
      taxAmtA: invoice.vat_amount,
      taxAmtB: 0,
      taxAmtC: 0,
      taxAmtD: 0,
      totTaxblAmt: invoice.taxable_amount,
      totTaxAmt: invoice.vat_amount,
      totAmt: invoice.total_amount,
      prchrAcptcYn: "N",
      remark: null,
      regrId: config.kra_pin,
      regrNm: invoice.business_name,
      modrId: config.kra_pin,
      modrNm: invoice.business_name,
      itemList: invoice.items.map((item: any, index: number) => ({
        itemSeq: index + 1,
        itemCd: item.item_code,
        itemClsCd: item.item_class_code,
        itemNm: item.name,
        bcd: null,
        pkgUnitCd: "NT",
        pkg: 1,
        qtyUnitCd: "U",
        qty: item.quantity,
        prc: item.unit_price,
        splyAmt: item.supply_amount,
        dcRt: 0,
        dcAmt: 0,
        isrccCd: null,
        isrccNm: null,
        isrcRt: 0,
        isrcAmt: 0,
        taxTyCd: item.tax_code || "A",
        taxblAmt: item.taxable_amount,
        taxAmt: item.tax_amount,
        totAmt: item.total_amount,
      })),
    };

    // Send to KRA
    const kraResponse = await fetch(`${base_url}/etims-api/invoice/addInvoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify(kraInvoice),
    });

    const kraResult = await kraResponse.json();

    // Save to Supabase with CUIN
    const { data: savedInvoice } = await supabase
      .from("etims_invoices")
      .insert({
        business_id,
        invoice_number: invoice.invoice_number,
        cuin: kraResult.data?.cuin || null,
        customer_name: invoice.customer_name,
        customer_pin: invoice.customer_pin,
        total_amount: invoice.total_amount,
        vat_amount: invoice.vat_amount,
        status: kraResult.resultCd === "000" ? "accepted" : "failed",
        raw_request: kraInvoice,
        raw_response: kraResult,
      })
      .select()
      .single();

    return new Response(JSON.stringify({ success: true, cuin: kraResult.data?.cuin, invoice: savedInvoice }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});