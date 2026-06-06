import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { business_id } = await req.json();

    // Get auth token
    const authRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/etims-auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_id }),
    });
    const { token, base_url } = await authRes.json();

    // Fetch KRA item codes
    const response = await fetch(`${base_url}/etims-api/code/selectCodeList`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify({ lastReqDt: "20240101000000" }),
    });

    const codes = await response.json();

    return new Response(JSON.stringify(codes), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});