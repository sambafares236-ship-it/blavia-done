-- Same class of bug as the transactions/payments fixes: permissive
-- "qual = true" / "with_check = true" policies that grant ANY authenticated
-- user cross-tenant read/write, alongside correctly-scoped policies that they
-- silently override (Postgres ORs permissive policies together).
--
-- payslips.frontend_read_payslips — any authenticated user could read every
-- business's payslips (salaries, PAYE, etc). Already covered by "Tenant
-- access" / "Business owns their payslips" / "Users can view own payslips".
drop policy if exists "frontend_read_payslips" on public.payslips;

-- profiles — any authenticated user could read every user's name/email/phone
-- across every business. App only ever queries profiles by own id (verified
-- against src/), already covered by "Select own profile".
drop policy if exists "Allow authenticated users to view profiles" on public.profiles;

-- employees — any authenticated user could read (PII, mpesa numbers, salary)
-- or insert employee rows for any business. Already covered by "Tenant
-- access" / "Business owns their employees" / "Users can view own employees".
drop policy if exists "Allow authenticated users to view employees" on public.employees;
drop policy if exists "Allow authenticated users to insert employees" on public.employees;

-- payroll (legacy, distinct from payroll_runs/payslips) — unused in
-- application code and empty; had no scoped policy at all, just full lockdown.
drop policy if exists "Allow authenticated users to view payroll" on public.payroll;
drop policy if exists "Allow authenticated users to insert payroll" on public.payroll;
