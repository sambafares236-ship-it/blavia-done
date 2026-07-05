-- Add etims_alerted_at to invoices so the eTIMS submission-failure alert
-- n8n workflow (polling, not webhook-driven) can dedupe: only alert the
-- business owner once per failed submission instead of re-notifying on
-- every polling tick. Mirrors the payslips.failure_alerted_at pattern.
alter table public.invoices
  add column if not exists etims_alerted_at timestamptz;

-- Partial index matching the exact poll query shape (unalerted eTIMS
-- failures), scoped per business for the downstream join.
create index if not exists invoices_etims_failure_alert_idx
  on public.invoices (business_id, etims_status)
  where etims_status = 'failed' and etims_alerted_at is null;
