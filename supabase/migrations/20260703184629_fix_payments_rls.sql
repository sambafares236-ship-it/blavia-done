-- payments table had wide-open RLS: any authenticated user could read or
-- insert rows for ANY business_id (qual/with_check = true). Scope it to the
-- owning business, matching the pattern already used on payroll_runs/payslips.
-- Table was unused in application code and empty at the time of this fix.
drop policy if exists "Allow authenticated users to insert payments" on public.payments;
drop policy if exists "Allow authenticated users to view payments" on public.payments;

create policy "Business owns their payments"
  on public.payments
  for all
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (business_id in (select id from public.businesses where owner_id = auth.uid()));

create policy "service_role_full_payments"
  on public.payments
  for all
  using (auth.role() = 'service_role');
