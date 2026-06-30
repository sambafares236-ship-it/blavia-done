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
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch ONLY the fields needed to display + pay — never expose internal data
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        status,
        issue_date,
        due_date,
        total,
        payment_description,
        customer_phone,
        customer_email,
        business_id,
        mpesa_reference,
        paid_at
      `)
      .eq("id", invoice_id)
      .single();

    if (error || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business name + logo + shortcode for display (never credentials)
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, logo_url")
      .eq("id", invoice.business_id)
      .single();

    const { data: mpesaConfig } = await supabase
      .from("mpesa_configs")
      .select("shortcode")
      .eq("business_id", invoice.business_id)
      .eq("is_active", true)
      .single();

    return new Response(
      JSON.stringify({
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          status: invoice.status,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          total: invoice.total,
          description: invoice.payment_description,
          customer_phone: invoice.customer_phone,
          mpesa_reference: invoice.mpesa_reference,
          paid_at: invoice.paid_at,
        },
        business: {
          name: business?.business_name || "Business",
          logo_url: business?.logo_url || null,
        },
        paybill: mpesaConfig?.shortcode || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});