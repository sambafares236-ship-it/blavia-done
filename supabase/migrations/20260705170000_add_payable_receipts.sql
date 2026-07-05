-- Lets a business owner attach a photo of the vendor invoice/bill when
-- manually adding a payable, purely for visual confirmation against the
-- typed-in fields (no OCR/extraction). Private bucket + signed URLs since
-- invoice photos are more sensitive than the existing public business-logo
-- bucket; RLS mirrors "Business owns their payments"
-- (20260703184629_fix_payments_rls.sql), gated on the first path segment
-- (business_id) of the object's storage path, e.g. "<business_id>/<uuid>.jpg".
insert into storage.buckets (id, name, public)
values ('payable-receipts', 'payable-receipts', false)
on conflict (id) do nothing;

create policy "Business owns their payable receipts"
  on storage.objects
  for all
  using (
    bucket_id = 'payable-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'payable-receipts'
    and (storage.foldername(name))[1] in (
      select id::text from public.businesses where owner_id = auth.uid()
    )
  );

create policy "service_role_full_payable_receipts"
  on storage.objects
  for all
  using (bucket_id = 'payable-receipts' and auth.role() = 'service_role');

alter table public.payments
  add column if not exists receipt_path text;
