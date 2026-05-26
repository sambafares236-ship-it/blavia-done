-- ============================================================
-- BLAVIA — Multi-tenant Auth + Profiles + Businesses
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Safe to re-run: uses IF NOT EXISTS / drop-and-recreate where needed.
-- ============================================================

-- ============================================================
-- 1. BUSINESSES TABLE (one per tenant / signed-up user)
-- ============================================================
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

-- ============================================================
-- 2. PROFILES TABLE (linked to auth.users + businesses)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  phone text,
  role text not null default 'owner',
  business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add business_id if profiles table existed before this migration
alter table public.profiles
  add column if not exists business_id uuid references public.businesses(id) on delete set null;

alter table public.profiles enable row level security;

-- ============================================================
-- 3. SECURITY DEFINER HELPER — get current user's business_id
--    Avoids recursive RLS lookups on profiles.
-- ============================================================
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select business_id from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- 4. RLS POLICIES — profiles
-- ============================================================
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- 5. RLS POLICIES — businesses (tenant scoped)
-- ============================================================
drop policy if exists "Members can view their business" on public.businesses;
create policy "Members can view their business"
  on public.businesses for select
  using (id = public.current_business_id());

drop policy if exists "Owner can update their business" on public.businesses;
create policy "Owner can update their business"
  on public.businesses for update
  using (id = public.current_business_id());

-- Inserts happen via the signup trigger (security definer), so no insert
-- policy is needed for end-users.

-- ============================================================
-- 6. ADD business_id TO TENANT TABLES
--    Only alters tables that already exist.
-- ============================================================
do $$
begin
  if to_regclass('public.transactions') is not null then
    alter table public.transactions
      add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists transactions_business_id_idx on public.transactions(business_id);
  end if;

  if to_regclass('public.employees') is not null then
    alter table public.employees
      add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists employees_business_id_idx on public.employees(business_id);
  end if;

  if to_regclass('public.payslips') is not null then
    alter table public.payslips
      add column if not exists business_id uuid references public.businesses(id) on delete cascade;
    create index if not exists payslips_business_id_idx on public.payslips(business_id);
  end if;
end $$;

-- ============================================================
-- 7. RLS POLICIES — tenant tables
--    Apply only if the table exists.
-- ============================================================
do $$
begin
  if to_regclass('public.transactions') is not null then
    execute 'alter table public.transactions enable row level security';
    execute 'drop policy if exists "Tenant access" on public.transactions';
    execute 'create policy "Tenant access" on public.transactions
             for all
             using (business_id = public.current_business_id())
             with check (business_id = public.current_business_id())';
  end if;

  if to_regclass('public.employees') is not null then
    execute 'alter table public.employees enable row level security';
    execute 'drop policy if exists "Tenant access" on public.employees';
    execute 'create policy "Tenant access" on public.employees
             for all
             using (business_id = public.current_business_id())
             with check (business_id = public.current_business_id())';
  end if;

  if to_regclass('public.payslips') is not null then
    execute 'alter table public.payslips enable row level security';
    execute 'drop policy if exists "Tenant access" on public.payslips';
    execute 'create policy "Tenant access" on public.payslips
             for all
             using (business_id = public.current_business_id())
             with check (business_id = public.current_business_id())';
  end if;
end $$;

-- ============================================================
-- 8. updated_at trigger (shared)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- ============================================================
-- 9. SIGNUP TRIGGER — create a business + profile for each new user
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_company text;
begin
  v_company := coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''),
                        nullif(new.raw_user_meta_data ->> 'full_name', '') || '''s Business',
                        'My Business');

  -- 1. Create the tenant row
  insert into public.businesses (name, owner_id)
  values (v_company, new.id)
  returning id into v_business_id;

  -- 2. Create the profile linked to it
  insert into public.profiles (id, email, full_name, company_name, phone, role, business_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    v_company,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'owner',
    v_business_id
  )
  on conflict (id) do update
    set business_id = excluded.business_id,
        company_name = excluded.company_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 10. BACKFILL — give every existing profile its own business
--     (skips profiles that already have one)
-- ============================================================
do $$
declare
  r record;
  v_id uuid;
begin
  for r in select id, email, company_name, full_name from public.profiles where business_id is null loop
    insert into public.businesses (name, owner_id)
    values (coalesce(nullif(r.company_name, ''), nullif(r.full_name, '') || '''s Business', 'My Business'), r.id)
    returning id into v_id;
    update public.profiles set business_id = v_id where id = r.id;
  end loop;
end $$;

-- ============================================================
-- DONE.
-- After running, also confirm in Supabase Dashboard:
--   Authentication → Providers → Email → "Confirm email" is ENABLED
--   Authentication → URL Configuration → Site URL set to your app URL
--
-- NOTE: any existing rows in transactions/employees/payslips will
-- have a NULL business_id and won't be visible under RLS. Either
-- delete them or assign them a business_id manually.
-- ============================================================

-- ============================================================
-- 11. ASSETS — manual asset register (per-business)
-- ============================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Other',          -- Cash, Bank, Receivable, Inventory, Equipment, Vehicle, Property, Investment, Other
  value numeric(14,2) not null default 0,
  acquired_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_business_id_idx on public.assets(business_id);

alter table public.assets enable row level security;

drop policy if exists "Tenant access" on public.assets;
create policy "Tenant access" on public.assets
  for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- ============================================================
-- 12. LIABILITIES — manual liability register (per-business)
-- ============================================================
create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'Other',          -- Loan, Payable, Tax, Credit Card, Mortgage, Other
  value numeric(14,2) not null default 0,           -- outstanding balance
  due_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists liabilities_business_id_idx on public.liabilities(business_id);

alter table public.liabilities enable row level security;

drop policy if exists "Tenant access" on public.liabilities;
create policy "Tenant access" on public.liabilities
  for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop trigger if exists liabilities_set_updated_at on public.liabilities;
create trigger liabilities_set_updated_at
  before update on public.liabilities
  for each row execute function public.set_updated_at();

-- ============================================================
-- 13. SCHEDULED EXPENSES — recurring/one-off expense schedules
--     (per-business). Marking as paid creates a transaction.
-- ============================================================
create table if not exists public.scheduled_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  vendor text not null,
  category text not null default 'Other',
  amount numeric(14,2) not null default 0,
  frequency text not null default 'monthly',       -- one_off | weekly | monthly | quarterly | yearly
  next_due date not null,
  payment_method text,                              -- M-Pesa | Bank | Cash | Card
  account_ref text,                                 -- e.g. paybill / till / IBAN (display only for now)
  status text not null default 'active',            -- active | paused | cancelled
  auto_post boolean not null default false,         -- reserved for future provider auto-pay
  notes text,
  last_paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scheduled_expenses_business_id_idx on public.scheduled_expenses(business_id);
create index if not exists scheduled_expenses_next_due_idx on public.scheduled_expenses(next_due);

alter table public.scheduled_expenses enable row level security;

drop policy if exists "Tenant access" on public.scheduled_expenses;
create policy "Tenant access" on public.scheduled_expenses
  for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

drop trigger if exists scheduled_expenses_set_updated_at on public.scheduled_expenses;
create trigger scheduled_expenses_set_updated_at
  before update on public.scheduled_expenses
  for each row execute function public.set_updated_at();

-- ============================================================
-- 14. OWNERSHIP STAMPS — record who created each row
--     RLS still enforces tenant isolation via business_id,
--     these columns just let the UI show the author.
-- ============================================================
do $$
begin
  if to_regclass('public.assets') is not null then
    alter table public.assets
      add column if not exists created_by uuid references auth.users(id) on delete set null,
      add column if not exists created_by_email text;
  end if;
  if to_regclass('public.liabilities') is not null then
    alter table public.liabilities
      add column if not exists created_by uuid references auth.users(id) on delete set null,
      add column if not exists created_by_email text;
  end if;
  if to_regclass('public.scheduled_expenses') is not null then
    alter table public.scheduled_expenses
      add column if not exists created_by uuid references auth.users(id) on delete set null,
      add column if not exists created_by_email text;
  end if;
  if to_regclass('public.transactions') is not null then
    alter table public.transactions
      add column if not exists created_by uuid references auth.users(id) on delete set null,
      add column if not exists created_by_email text;
  end if;
  if to_regclass('public.employees') is not null then
    alter table public.employees
      add column if not exists created_by uuid references auth.users(id) on delete set null,
      add column if not exists created_by_email text;
  end if;
end $$;

-- Auto-fill created_by / created_by_email on insert from the JWT
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  if new.created_by_email is null then
    new.created_by_email := coalesce(
      (auth.jwt() ->> 'email'),
      (select email from auth.users where id = auth.uid())
    );
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['assets','liabilities','scheduled_expenses','transactions','employees'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists %I_stamp_created_by on public.%I', t, t);
      execute format('create trigger %I_stamp_created_by before insert on public.%I
        for each row execute function public.stamp_created_by()', t, t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 15. AUTO-FILL business_id ON INSERT (the missing piece)
--     Lets the client insert without passing business_id;
--     RLS policies will still enforce isolation.
-- ============================================================
create or replace function public.stamp_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_id is null then
    new.business_id := public.current_business_id();
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['assets','liabilities','scheduled_expenses','transactions','employees','payslips'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists %I_stamp_business_id on public.%I', t, t);
      execute format('create trigger %I_stamp_business_id before insert on public.%I
        for each row execute function public.stamp_business_id()', t, t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 16. BUSINESS PROFILE EXTENSIONS (category, turnover, VAT)
-- ============================================================
alter table public.businesses
  add column if not exists business_category text,
  add column if not exists annual_turnover numeric(14,2),
  add column if not exists vat_registered boolean not null default false;

-- ============================================================
-- 17. TAX RULES TABLE (per-category obligations)
-- ============================================================
create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  tax_name text not null,
  tax_rate numeric(6,3) not null,
  description text,
  min_turnover numeric(14,2),
  max_turnover numeric(14,2),
  applies_when text,
  created_at timestamptz not null default now()
);

alter table public.tax_rules enable row level security;

drop policy if exists "Anyone can read tax rules" on public.tax_rules;
create policy "Anyone can read tax rules"
  on public.tax_rules for select
  to authenticated
  using (true);

-- Seed defaults (idempotent-ish: only seed when empty)
do $$
begin
  if not exists (select 1 from public.tax_rules) then
    insert into public.tax_rules (category, tax_name, tax_rate, description, min_turnover, max_turnover, applies_when) values
      ('All', 'Corporate Tax', 30.0, 'Standard corporate income tax', null, null, 'always'),
      ('Professional Services', 'Withholding Tax', 5.0, 'WHT on professional fees', null, null, 'always'),
      ('Retail & Trading', 'Turnover Tax (TOT)', 3.0, 'TOT for businesses below VAT threshold', 0, 5000000, 'turnover_below'),
      ('Retail & Trading', 'VAT', 16.0, 'VAT for businesses above 5M turnover or VAT-registered', 5000000, null, 'turnover_above_or_vat'),
      ('Hospitality & Tourism', 'VAT', 16.0, 'VAT applies to hospitality services', null, null, 'vat_registered'),
      ('Manufacturing & Production', 'VAT', 16.0, 'VAT applies to manufactured goods', null, null, 'vat_registered'),
      ('Construction & Contracting', 'Withholding Tax', 3.0, 'WHT on contractual payments', null, null, 'always'),
      ('Real Estate & Property', 'Rental Income Tax', 10.0, 'Monthly rental income tax', null, null, 'always'),
      ('Transport & Logistics', 'Advance Tax', 0.0, 'Annual advance tax on commercial vehicles', null, null, 'always'),
      ('Agriculture & Farming', 'Agricultural Produce Cess', 1.0, 'County cess on agricultural produce', null, null, 'always');
  end if;
end $$;
