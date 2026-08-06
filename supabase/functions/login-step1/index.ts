// supabase/functions/login-step1/index.ts
//
// STEP 1 of the login flow.
// Verifies the user's email/password on the server, flags the account as
// "pending MFA" using app_metadata (which the client can NEVER edit), then
// sends a one-time code to the user's email. No usable session is returned
// to the client at this point.

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
    const { email, password } = await req.json()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // A) Verify the password with a normal (anon-key) client.
    const authClient = createClient(supabaseUrl, anonKey)
    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.user) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = signInData.user.id

    // B) Flag the user as pending MFA using the SERVICE ROLE client.
    // app_metadata cannot be modified by the client SDK, only from the
    // server — this is what makes the flag trustworthy.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { pending_mfa: true },
    })

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to start verification' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // C) Discard the password-only session — the client never even
    // receives it, since we only return a plain success message below.
    await authClient.auth.signOut()

    // D) Send the OTP code by email. shouldCreateUser:false ensures this
    // never accidentally creates a brand-new account.
    const { error: otpError } = await authClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })

    if (otpError) {
      return new Response(JSON.stringify({ error: 'Failed to send verification email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ message: 'Password verified. Check your email for a code.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})