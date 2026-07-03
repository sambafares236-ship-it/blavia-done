-- Add the missing FK so PostgREST can resolve payslips -> employees embeds
-- (e.g. RunPayrollSection's pending-runs query, which was silently failing
-- with PGRST200 "Could not find a relationship between 'payslips' and 'employees'").
alter table public.payslips
  add constraint payslips_employee_id_fkey
  foreign key (employee_id) references public.employees(id);
