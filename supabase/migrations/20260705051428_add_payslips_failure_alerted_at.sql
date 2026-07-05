-- Add failure_alerted_at to payslips so the payroll B2C failure alert
-- n8n workflow (polling, not webhook-driven) can dedupe: only alert the
-- business owner once per failed payslip instead of re-notifying on
-- every polling tick.
alter table public.payslips
  add column if not exists failure_alerted_at timestamptz;

-- Partial index matching the exact poll query shape (unalerted failures,
-- scoped per business for the downstream join).
create index if not exists payslips_failure_alert_idx
  on public.payslips (business_id, payment_status)
  where payment_status = 'failed' and failure_alerted_at is null;
