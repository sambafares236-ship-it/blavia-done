-- etims_invoices.business_id was mistakenly foreign-keyed against the
-- "users" table instead of public.businesses(id). Confirmed live: inserting
-- a row for ANY business_id — including a real, existing business — fails
-- with "violates foreign key constraint etims_invoices_business_id_fkey".
-- Since the original etims-send-invoice code inserted into etims_invoices
-- before updating invoices.etims_status, with no shared error handling
-- around the two, this meant every eTIMS submission attempt (including ones
-- KRA would have accepted) crashed at the audit-log step before ever
-- recording success on the invoice itself. Table has 0 rows, so this is a
-- safe swap with no data to migrate.
alter table public.etims_invoices
  drop constraint if exists etims_invoices_business_id_fkey;

alter table public.etims_invoices
  add constraint etims_invoices_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete cascade;
