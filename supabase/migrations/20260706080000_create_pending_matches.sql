-- Unmatched M-Pesa C2B payments (Paybill or Till) that couldn't be tied to
-- an invoice automatically. The business owner resolves these manually from
-- the Payments page. trans_id is unique because Safaricom retries C2B
-- confirmation callbacks that don't get a fast 200 — without this, a retry
-- would create a second pending row for the same payment.
create table if not exists public.pending_matches (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  trans_id text not null unique,
  trans_amount numeric not null,
  msisdn text,
  first_name text,
  trans_time text,
  bill_ref_number text,
  transaction_type text,
  matched_invoice_id uuid references public.invoices(id),
  match_status text not null default 'pending', -- pending, matched, dismissed
  created_at timestamptz not null default now()
);

create index if not exists pending_matches_business_status_idx
  on public.pending_matches (business_id, match_status);

alter table public.pending_matches enable row level security;

drop policy if exists "Tenant access" on public.pending_matches;
create policy "Tenant access" on public.pending_matches
  for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());
