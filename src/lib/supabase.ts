import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pvawptdrpapdhhwdoyxz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2YXdwdGRycGFwZGhod2RveXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY5ODQsImV4cCI6MjA5MTQxMjk4NH0.SjmTu5897j3GSLQmagSghGOc47NhKfB5YoIdWVWrq3k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});

export type Transaction = {
  id: string | number;
  txn_id?: string;
  txn_date: string;
  narration: string;
  amount: number;
  category: string | null;
  source?: string | null;
  source_bank?: string | null;
  ref_number?: string | null;
  status: string;
  txn_type: string;
  confidence?: number;
  business_name?: string | null;
};
