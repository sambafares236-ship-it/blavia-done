// src/lib/authFlow.ts
//
// Step-up login: password is checked server-side (Edge Function), then an
// emailed code must be verified before a real session is created.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export async function loginStep1(email: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/login-step1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function loginStep2(email: string, token: string) {
  const res = await fetch(`${FUNCTIONS_URL}/login-step2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, token }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Verification failed");

  // This is what actually creates the real session -- AuthContext's
  // onAuthStateChange listener will pick this up automatically and
  // load the profile/business as usual.
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setSessionError) throw setSessionError;

  return data;
}
