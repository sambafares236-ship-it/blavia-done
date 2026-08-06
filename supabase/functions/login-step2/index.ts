// supabase/functions/login-step2/index.ts
//
// STEP 2 of the login flow.
// Verifies the emailed one-time code. On success, clears the pending_mfa
// flag (server-side only) and returns a real, usable session to the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token } = await req.json()

    if (!email || !token) {
      return new Response(JSON.stringify({ error: 'Email and code are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authClient = createClient(supabaseUrl, anonKey)

    const { data, error } = await authClient.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error || !data.session || !data.user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Clear the pending flag now that the email step succeeded.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    await adminClient.auth.admin.updateUserById(data.user.id, {
      app_metadata: { pending_mfa: false },
    })

    return new Response(
      JSON.stringify({
        session: data.session,
        user: data.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})