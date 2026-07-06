-- Adds M-Pesa B2B (Business to Business / Buy Goods) support to payables.
-- Each payable can carry the vendor's till number so the owner can pay it
-- directly from the app instead of manually via their phone. Mirrors the
-- *_alerted_at dedup pattern already used for invoices/payslips/cashflow
-- for the payables due/overdue reminder (last_reminder_sent_at).
alter table public.payments
  add column if not exists till_number text,
  add column if not exists b2b_reference text,
  add column if not exists b2b_result text,
  add column if not exists b2b_initiated_at timestamptz,
  add column if not exists last_reminder_sent_at timestamptz;

-- Matches the poll query shape for the payables due/overdue reminder.
create index if not exists payments_reminder_idx
  on public.payments (business_id, due_date)
  where status = 'pending';
