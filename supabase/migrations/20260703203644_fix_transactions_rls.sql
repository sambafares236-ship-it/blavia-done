-- transactions had two wide-open permissive policies alongside two correctly
-- scoped ones: "Allow authenticated users to view transactions" (qual = true)
-- let ANY authenticated user read every business's transactions, and
-- "Allow authenticated users to insert transactions" (with_check = true) let
-- any authenticated user insert rows under any business_id. Postgres ORs
-- permissive policies together, so these made the correctly-scoped policies
-- ("Tenant access", "Users can view own transactions") moot. Confirmed live
-- exploit path: ExecutiveDashboard.tsx queries transactions with no
-- business_id filter, so every signed-up user could see every other
-- business's financial data via /executive.
drop policy if exists "Allow authenticated users to view transactions" on public.transactions;
drop policy if exists "Allow authenticated users to insert transactions" on public.transactions;
