import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const SUPABASE_URL = "https://pvawptdrpapdhhwdoyxz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2YXdwdGRycGFwZGhod2RveXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY5ODQsImV4cCI6MjA5MTQxMjk4NH0.SjmTu5897j3GSLQmagSghGOc47NhKfB5YoIdWVWrq3k";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
