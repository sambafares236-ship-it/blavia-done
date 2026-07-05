-- Add cashflow_alert_sent_at to businesses so the cash-flow health alert
-- n8n workflow (polling, not webhook-driven) can dedupe: only alert the
-- owner once per breach of alert_threshold, not on every poll tick. The
-- workflow resets this to null once cash-on-hand recovers above threshold,
-- so a later breach can alert again.
alter table public.businesses
  add column if not exists cashflow_alert_sent_at timestamptz;
