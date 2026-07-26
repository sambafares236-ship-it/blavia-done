-- eTIMS applies to every business carrying on a trade, not only VAT-registered
-- ones, but the small non-VAT taxpayers KRA pushed onto eTIMS are the least
-- likely to obtain the OSCU device serial that /initializer/selectInitInfo
-- requires. Supporting them means recording invoices issued through eTIMS Lite
-- (KRA portal / *222#) alongside the ones this system submits itself, so the
-- config needs to say which route a business takes.
--
--   none  - not on eTIMS yet
--   oscu  - integrated; this system calls KRA and receives the CUIN back
--   lite  - business issues on KRA's own channels and records the CUIN here
alter table public.etims_configs
  add column if not exists mode text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'etims_configs_mode_check'
  ) then
    alter table public.etims_configs
      add constraint etims_configs_mode_check
      check (mode in ('none', 'oscu', 'lite'));
  end if;
end $$;

-- Anything already holding a CMC key completed the OSCU handshake by definition.
update public.etims_configs
   set mode = 'oscu'
 where cmc_key is not null
   and mode = 'none';

-- client_id / client_secret were collected as "eTIMS portal username/password"
-- and marked NOT NULL, but no KRA call has ever referenced them: etims-auth
-- sends tin/bhfId/dvcSrlNo, and etims-send-invoice authenticates with
-- tin/bhfId/cmcKey. They are dropped from the UI, so they must become
-- optional. Columns are retained rather than dropped in case a future KRA
-- endpoint needs them; nothing writes them now.
alter table public.etims_configs alter column client_id drop not null;
alter table public.etims_configs alter column client_secret drop not null;

comment on column public.etims_configs.mode is
  'How this business issues eTIMS invoices: none | oscu (integrated) | lite (recorded from KRA portal/USSD).';
